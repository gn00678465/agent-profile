import { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { IPC_CHANNELS } from '../../../shared/types';
import type {
  ClaudeSettings,
  ClaudeInstalledPlugins,
  ClaudePlugin,
  ClaudeSessionMessage,
  SessionEntry,
} from '../../../shared/types';
import { assertSafePath, assertSafeName, success, failure, readJsonFile, writeJsonFile } from './configUtils';

export function registerClaudeHandler(ipcMain: IpcMain, _home: string): void {
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_CLAUDE_SETTINGS,
    async (_event, configDir: string) => {
      try {
        const settingsPath = path.join(configDir, 'settings.json');
        const result = await readJsonFile<ClaudeSettings>(settingsPath);
        return success(result);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE_CLAUDE_SETTINGS,
    async (_event, configDir: string, settings: ClaudeSettings) => {
      try {
        await writeJsonFile(path.join(configDir, 'settings.json'), settings);
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // Claude plugins (read-only, parsed from installed_plugins.json)
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_CLAUDE_PLUGINS,
    async (_event, configDir: string) => {
      try {
        const pluginsDir = path.join(configDir, 'plugins');
        const installedPath = path.join(pluginsDir, 'installed_plugins.json');
        const settingsPath = path.join(configDir, 'settings.json');

        const [installedResult, settingsResult] = await Promise.all([
          readJsonFile<ClaudeInstalledPlugins>(installedPath),
          readJsonFile<ClaudeSettings>(settingsPath),
        ]);

        const enabledPlugins = settingsResult.data?.enabledPlugins ?? {};
        const plugins: ClaudePlugin[] = [];

        if (installedResult.data?.plugins) {
          for (const [pluginId, installs] of Object.entries(installedResult.data.plugins)) {
            const parts = pluginId.split('@');
            const pluginName = parts[0] ?? pluginId;
            const marketplace = parts[1] ?? 'unknown';

            for (const install of installs) {
              plugins.push({
                id: pluginId,
                name: pluginName,
                marketplace,
                scope: install.scope,
                projectPath: install.projectPath,
                installPath: install.installPath,
                version: install.version,
                installedAt: install.installedAt,
                lastUpdated: install.lastUpdated,
                gitCommitSha: install.gitCommitSha,
                enabled: enabledPlugins[pluginId] ?? false,
              });
            }
          }
        }

        return success(plugins);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_CLAUDE_SESSIONS,
    async (_event, configDir: string) => {
      try {
        const projectsDir = path.join(configDir, 'projects');
        const sessions: SessionEntry[] = [];

        let projectFolders: string[] = [];
        try {
          projectFolders = await fs.readdir(projectsDir);
        } catch {
          return success<SessionEntry[]>([]);
        }

        for (const folder of projectFolders) {
          const folderPath = path.join(projectsDir, folder);
          let folderStat;
          try { folderStat = await fs.stat(folderPath); } catch { continue; }
          if (!folderStat.isDirectory()) continue;

          let files: string[] = [];
          try { files = await fs.readdir(folderPath); } catch { continue; }

          for (const file of files) {
            if (!file.endsWith('.jsonl')) continue;
            const filePath = path.join(folderPath, file);
            const sessionId = file.slice(0, -6); // remove .jsonl

            let cwd: string | undefined;
            let slug: string | undefined;
            let earliestTs: number | undefined;
            let fileStat;
            try { fileStat = await fs.stat(filePath); } catch { continue; }

            // Read only first 8 KB — avoids loading large JSONL files into memory
            try {
              const METADATA_BYTES = 8 * 1024;
              const fd = await fs.open(filePath, 'r');
              let partial: string;
              try {
                const buf = Buffer.alloc(METADATA_BYTES);
                const { bytesRead } = await fd.read(buf, 0, METADATA_BYTES, 0);
                partial = buf.subarray(0, bytesRead).toString('utf-8');
              } finally {
                await fd.close();
              }
              const lines = partial.split('\n').slice(0, 50);
              for (const line of lines) {
                if (!line.trim()) continue;
                let entry: Record<string, unknown>;
                try { entry = JSON.parse(line) as Record<string, unknown>; } catch { continue; }

                if (!cwd && typeof entry.cwd === 'string') cwd = entry.cwd;
                if (!slug) {
                  if (typeof entry.slug === 'string') slug = entry.slug;
                  else if (typeof entry.leafName === 'string') slug = entry.leafName;
                }
                if (typeof entry.timestamp === 'string') {
                  const ts = new Date(entry.timestamp).getTime();
                  if (!isNaN(ts)) {
                    if (earliestTs === undefined || ts < earliestTs) earliestTs = ts;
                  }
                }
              }
            } catch { continue; }

            if (!slug) slug = sessionId.slice(0, 12);

            sessions.push({
              id: sessionId,
              name: slug,
              path: filePath,
              type: 'hash',
              agentType: 'claude-code',
              cwd,
              slug,
              lastModified: fileStat.mtimeMs,
              createdAt: earliestTs ? new Date(earliestTs).toISOString() : undefined,
            });
          }
        }

        sessions.sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
        return success(sessions);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_SESSION_MESSAGES,
    async (_event, filePath: string) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const messages: ClaudeSessionMessage[] = [];

        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          let entry: Record<string, unknown>;
          try { entry = JSON.parse(line) as Record<string, unknown>; } catch { continue; }

          // Determine role
          let role: 'user' | 'assistant' | null = null;
          const entryRole = (entry.role as string | undefined) ??
            ((entry.message as Record<string, unknown> | undefined)?.role as string | undefined);

          if (entryRole === 'user' || entryRole === 'human') role = 'user';
          else if (entryRole === 'assistant') role = 'assistant';

          if (!role) {
            const t = entry.type as string | undefined;
            if (t === 'human' || t === 'user') role = 'user';
            else if (t === 'assistant') role = 'assistant';
          }
          if (!role) continue;

          // Extract content
          const rawContent: unknown =
            (entry.message as Record<string, unknown> | undefined)?.content ??
            (typeof (entry.message as unknown) === 'string' ? entry.message : undefined) ??
            entry.content;

          if (!rawContent) continue;

          // Purify text
          let text = '';
          if (typeof rawContent === 'string') {
            text = rawContent;
          } else if (Array.isArray(rawContent)) {
            text = (rawContent as Array<Record<string, unknown>>)
              .filter((b) => b.type === 'text')
              .map((b) => String(b.text ?? ''))
              .join('');
          }

          text = text.trim();
          if (!text) continue;
          messages.push({ role, text });
        }

        // Return at most the last 500 messages to avoid overwhelming the renderer
        const MAX_MESSAGES = 500;
        const result = messages.length > MAX_MESSAGES
          ? messages.slice(messages.length - MAX_MESSAGES)
          : messages;
        return success(result);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_PLUGIN,
    async (_event, configDir: string, pluginId: string, installPath: string) => {
      try {
        assertSafeName(pluginId);
        assertSafePath(installPath, os.homedir());
        // 1. Remove from installed_plugins.json
        const pluginsDir = path.join(configDir, 'plugins');
        const installedPath = path.join(pluginsDir, 'installed_plugins.json');
        const installedResult = await readJsonFile<ClaudeInstalledPlugins>(installedPath);

        if (installedResult.data?.plugins?.[pluginId]) {
          const installs = installedResult.data.plugins[pluginId].filter(
            (i) => i.installPath !== installPath
          );
          if (installs.length === 0) {
            delete installedResult.data.plugins[pluginId];
          } else {
            installedResult.data.plugins[pluginId] = installs;
          }
          await writeJsonFile(installedPath, installedResult.data);
        }

        // 2. If no installs remain for this pluginId, remove from settings.json enabledPlugins
        const remainingInstalls = installedResult.data?.plugins?.[pluginId];
        if (!remainingInstalls || remainingInstalls.length === 0) {
          const settingsPath = path.join(configDir, 'settings.json');
          try {
            const content = await fs.readFile(settingsPath, 'utf-8');
            const settings = JSON.parse(content) as ClaudeSettings;
            if (settings.enabledPlugins?.[pluginId] !== undefined) {
              delete settings.enabledPlugins[pluginId];
              await writeJsonFile(settingsPath, settings);
            }
          } catch { /* settings file may not exist */ }
        }

        // 3. Remove install folder
        await fs.rm(installPath, { recursive: true, force: true });

        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SET_PLUGIN_ENABLED,
    async (_event, configDir: string, pluginId: string, enabled: boolean) => {
      try {
        const settingsPath = path.join(configDir, 'settings.json');
        let settings: ClaudeSettings = {};
        try {
          const content = await fs.readFile(settingsPath, 'utf-8');
          settings = JSON.parse(content) as ClaudeSettings;
        } catch { /* file doesn't exist yet */ }

        settings.enabledPlugins = {
          ...(settings.enabledPlugins ?? {}),
          [pluginId]: enabled,
        };
        await writeJsonFile(settingsPath, settings);
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );
}
