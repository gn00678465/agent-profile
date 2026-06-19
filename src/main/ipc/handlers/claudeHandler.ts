import { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC_CHANNELS } from '../../../shared/types';
import type {
  ClaudeSettings,
  ClaudeSessionMessage,
  SessionEntry,
} from '../../../shared/types';
import { success, failure, readJsonFile, writeJsonFile } from './configUtils';

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

  // CONFIG_GET_CLAUDE_PLUGINS / CONFIG_DELETE_PLUGIN / CONFIG_SET_PLUGIN_ENABLED
  // moved to claudePluginsHandler.ts (feat-019, S1-7).

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

  // CONFIG_SET_PLUGIN_ENABLED — kept here as a settings-mutation helper
  // (writes ~/.claude/settings.json; not plugin-data-specific). DV5: enable/disable
  // intentionally bypasses cliRunner to avoid spawn cost on a simple boolean toggle.
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
