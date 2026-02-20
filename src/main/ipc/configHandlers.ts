import { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { IPC_CHANNELS } from '../../shared/types';
import type {
  IpcResponse,
  AgentProfile,
  ClaudeSettings,
  ClaudeInstalledPlugins,
  ClaudePlugin,
  GeminiSettings,
  GeminiExtension,
  GeminiExtensionEnablement,
  CopilotConfig,
  McpSettings,
  Skill,
  SkillFrontmatter,
  ConfigFile,
  SessionEntry,
} from '../../shared/types';

function success<T>(data: T): IpcResponse<T> {
  return { success: true, data };
}

function failure(error: unknown): IpcResponse<never> {
  const message = error instanceof Error ? error.message : String(error);
  return { success: false, error: message };
}

async function readJsonFile<T>(filePath: string): Promise<ConfigFile<T>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as T;
    return { path: filePath, exists: true, data };
  } catch (err) {
    const isNotFound =
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (isNotFound) {
      return { path: filePath, exists: false, data: null };
    }
    return {
      path: filePath,
      exists: true,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Parse SKILL.md frontmatter
function parseSkillFrontmatter(content: string): SkillFrontmatter | undefined {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) return undefined;
  try {
    // Simple YAML parser for skill frontmatter (no external deps needed)
    const yaml = match[1];
    const fm: Record<string, unknown> = {};
    const lines = yaml.split('\n');
    let currentKey: string | null = null;
    let arrayItems: string[] = [];

    for (const line of lines) {
      const arrayItemMatch = /^\s{2}-\s+(.+)$/.exec(line);
      const keyValueMatch = /^(\S+):\s*(.*)$/.exec(line);

      if (arrayItemMatch && currentKey) {
        arrayItems.push(arrayItemMatch[1].trim());
        fm[currentKey] = arrayItems;
      } else if (keyValueMatch) {
        if (currentKey && arrayItems.length > 0) {
          fm[currentKey] = arrayItems;
        }
        currentKey = keyValueMatch[1];
        arrayItems = [];
        const val = keyValueMatch[2].trim();
        if (val === 'true') fm[currentKey] = true;
        else if (val === 'false') fm[currentKey] = false;
        else if (val.startsWith('"') && val.endsWith('"')) fm[currentKey] = val.slice(1, -1);
        else if (val !== '') fm[currentKey] = val;
      }
    }
    return fm as unknown as SkillFrontmatter;
  } catch {
    return undefined;
  }
}

// Read a skill from a folder
async function readSkillFolder(folderPath: string): Promise<Skill | null> {
  const skillMdPath = path.join(folderPath, 'SKILL.md');
  try {
    const content = await fs.readFile(skillMdPath, 'utf-8');
    const id = path.basename(folderPath);
    const frontmatter = parseSkillFrontmatter(content);
    const name = frontmatter?.name ?? id;
    return {
      id,
      name,
      description: frontmatter?.description,
      version: frontmatter?.version,
      content,
      frontmatter,
      filePath: skillMdPath,
      dirPath: folderPath,
      userInvocable: frontmatter?.['user-invocable'],
    };
  } catch {
    return null;
  }
}

// Resolve known agent directories from home dir
function getKnownAgents(home: string): AgentProfile[] {
  const agents: AgentProfile[] = [];

  // Claude Code
  agents.push({
    id: 'claude-code',
    name: 'Claude Code',
    configDir: path.join(home, '.claude'),
    description: 'Claude Code CLI agent',
    type: 'claude-code',
  });

  // Gemini CLI
  agents.push({
    id: 'gemini',
    name: 'Gemini CLI',
    configDir: path.join(home, '.gemini'),
    description: 'Google Gemini CLI agent',
    type: 'gemini',
  });

  // GitHub Copilot CLI
  agents.push({
    id: 'copilot',
    name: 'GitHub Copilot',
    configDir: path.join(home, '.copilot'),
    description: 'GitHub Copilot CLI agent',
    type: 'copilot',
  });

  // Shared agents directory
  agents.push({
    id: 'shared',
    name: 'Shared Skills',
    configDir: path.join(home, '.agents'),
    description: 'Cross-agent shared skills and config',
    type: 'shared',
  });

  return agents;
}

export function registerConfigHandlers(ipcMain: IpcMain) {
  const home = os.homedir();

  // ── Agents list ──────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_AGENTS, async () => {
    try {
      return success(getKnownAgents(home));
    } catch (err) {
      return failure(err);
    }
  });

  // ── Claude Code settings ─────────────────────────────────────────────────

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

  // ── Gemini settings ───────────────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_GEMINI_SETTINGS,
    async (_event, configDir: string) => {
      try {
        const settingsPath = path.join(configDir, 'settings.json');
        const result = await readJsonFile<GeminiSettings>(settingsPath);
        return success(result);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE_GEMINI_SETTINGS,
    async (_event, configDir: string, settings: GeminiSettings) => {
      try {
        await writeJsonFile(path.join(configDir, 'settings.json'), settings);
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // Gemini extensions
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_GEMINI_EXTENSIONS,
    async (_event, configDir: string) => {
      try {
        const extensionsDir = path.join(configDir, 'extensions');
        const enablementPath = path.join(extensionsDir, 'extension-enablement.json');

        let entryNames: string[] = [];
        try {
          entryNames = await fs.readdir(extensionsDir);
        } catch {
          return success({ extensions: [], enablement: {} });
        }

        const [enablementResult] = await Promise.all([
          readJsonFile<GeminiExtensionEnablement>(enablementPath),
        ]);

        const extensions: Array<GeminiExtension & { name: string; enabled: boolean }> = [];
        for (const entryName of entryNames) {
          const entryPath = path.join(extensionsDir, entryName);
          try {
            const stat = await fs.stat(entryPath);
            if (!stat.isDirectory()) continue;
          } catch {
            continue;
          }
          const manifestPath = path.join(entryPath, 'gemini-extension.json');
          const manifest = await readJsonFile<GeminiExtension>(manifestPath);
          if (manifest.data) {
            const enablement = enablementResult.data ?? {};
            extensions.push({
              ...manifest.data,
              name: entryName,
              enabled: entryName in enablement,
            });
          }
        }

        return success({
          extensions,
          enablement: enablementResult.data ?? {},
        });
      } catch (err) {
        return failure(err);
      }
    }
  );

  // Delete a Gemini extension (remove enablement entry + extension folder)
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_GEMINI_EXTENSION,
    async (_event, configDir: string, extensionName: string) => {
      try {
        const extensionsDir = path.join(configDir, 'extensions');

        // 1. Remove from extension-enablement.json
        const enablementPath = path.join(extensionsDir, 'extension-enablement.json');
        const enablementResult = await readJsonFile<GeminiExtensionEnablement>(enablementPath);
        if (enablementResult.data && extensionName in enablementResult.data) {
          delete enablementResult.data[extensionName];
          await writeJsonFile(enablementPath, enablementResult.data);
        }

        // 2. Remove the extension folder
        const extPath = path.join(extensionsDir, extensionName);
        await fs.rm(extPath, { recursive: true, force: true });

        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── Copilot config ────────────────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_COPILOT_CONFIG,
    async (_event, configDir: string) => {
      try {
        const configPath = path.join(configDir, 'config.json');
        const result = await readJsonFile<CopilotConfig>(configPath);
        return success(result);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE_COPILOT_CONFIG,
    async (_event, configDir: string, config: CopilotConfig) => {
      try {
        await writeJsonFile(path.join(configDir, 'config.json'), config);
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── MCP servers (multi-agent support) ────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_MCP,
    async (_event, configDir: string) => {
      try {
        // Try agent-specific MCP config files in priority order
        const candidates = [
          path.join(configDir, 'mcp-config.json'),        // Copilot
          path.join(configDir, 'claude_desktop_config.json'), // Claude Desktop
          path.join(configDir, 'settings.json'),          // Gemini / Claude Code
        ];

        for (const candidate of candidates) {
          const result = await readJsonFile<McpSettings>(candidate);
          if (result.exists && result.data?.mcpServers != null) {
            return success(result);
          }
        }

        // Return empty config pointing to the most appropriate file
        const defaultFile = path.join(configDir, 'mcp-config.json');
        return success<ConfigFile<McpSettings>>({
          path: defaultFile,
          exists: false,
          data: { mcpServers: {} },
        });
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE_MCP,
    async (_event, configDir: string, settings: McpSettings) => {
      try {
        // Determine target file: prefer existing MCP config
        const candidates = [
          path.join(configDir, 'mcp-config.json'),
          path.join(configDir, 'claude_desktop_config.json'),
          path.join(configDir, 'settings.json'),
        ];

        let targetPath = candidates[0];
        for (const candidate of candidates) {
          try {
            const content = await fs.readFile(candidate, 'utf-8');
            const data = JSON.parse(content) as Record<string, unknown>;
            if (data.mcpServers != null) {
              targetPath = candidate;
              break;
            }
          } catch {
            // file doesn't exist or isn't JSON
          }
        }

        // Merge MCP settings into existing file
        let existing: Record<string, unknown> = {};
        try {
          const content = await fs.readFile(targetPath, 'utf-8');
          existing = JSON.parse(content) as Record<string, unknown>;
        } catch {
          // New file
        }

        await writeJsonFile(targetPath, { ...existing, ...settings });
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── Skills (folder-based, all agents) ────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_SKILLS,
    async (_event, configDir: string) => {
      try {
        const skillsDir = path.join(configDir, 'skills');
        let entryNames: string[];
        try {
          entryNames = await fs.readdir(skillsDir);
        } catch {
          return success<Skill[]>([]);
        }

        const skills: Skill[] = [];
        for (const entryName of entryNames) {
          const entryPath = path.join(skillsDir, entryName);
          try {
            const stat = await fs.stat(entryPath);
            if (!stat.isDirectory()) continue;
          } catch {
            continue;
          }
          const skill = await readSkillFolder(entryPath);
          if (skill) skills.push(skill);
        }

        return success(skills);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE_SKILL,
    async (_event, configDir: string, skill: Skill) => {
      try {
        const skillDir = path.join(configDir, 'skills', skill.id);
        const skillPath = path.join(skillDir, 'SKILL.md');
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(skillPath, skill.content, 'utf-8');
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_SKILL,
    async (_event, configDir: string, skillId: string) => {
      try {
        const skillDir = path.join(configDir, 'skills', skillId);
        await fs.rm(skillDir, { recursive: true, force: true });
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── Markdown files (CLAUDE.md, GEMINI.md, etc.) ──────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_MARKDOWN,
    async (_event, filePath: string) => {
      try {
        let content: string | null = null;
        let exists = false;
        try {
          content = await fs.readFile(filePath, 'utf-8');
          exists = true;
        } catch {
          // File doesn't exist
        }
        return success<ConfigFile<string>>({ path: filePath, exists, data: content });
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE_MARKDOWN,
    async (_event, filePath: string, content: string) => {
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── Sessions ──────────────────────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_SESSIONS,
    async (_event, configDir: string, agentType: string) => {
      try {
        const sessions: SessionEntry[] = [];

        if (agentType === 'gemini') {
          // Gemini sessions in ~/.gemini/tmp/ (SHA256 hash folders) + ~/.gemini/history/
          const tmpDir = path.join(configDir, 'tmp');
          const histDir = path.join(configDir, 'history');

          for (const baseDir of [tmpDir, histDir]) {
            let names: string[] = [];
            try { names = await fs.readdir(baseDir); } catch { continue; }
            for (const name of names) {
              const sessionPath = path.join(baseDir, name);
              let stat;
              try { stat = await fs.stat(sessionPath); } catch { continue; }
              if (!stat.isDirectory()) continue;
              const isHash = /^[0-9a-f]{8,}$/i.test(name);
              sessions.push({
                id: name,
                name: isHash ? name.slice(0, 8) + '...' : name,
                path: sessionPath,
                type: isHash ? 'hash' : 'named',
                agentType: 'gemini',
                lastModified: stat.mtimeMs,
              });
            }
          }
        } else if (agentType === 'copilot') {
          // Copilot sessions in ~/.copilot/session-state/ (UUID folders)
          const sessionDir = path.join(configDir, 'session-state');
          let names: string[] = [];
          try { names = await fs.readdir(sessionDir); } catch { /* no sessions */ }

          for (const name of names) {
            const sessionPath = path.join(sessionDir, name);
            let stat;
            try { stat = await fs.stat(sessionPath); } catch { continue; }
            if (!stat.isDirectory()) continue;

            // Try to read workspace.yaml for metadata
            const workspacePath = path.join(sessionPath, 'workspace.yaml');
            let cwd: string | undefined;
            let summary: string | undefined;
            let createdAt: string | undefined;
            let updatedAt: string | undefined;
            let checkpointCount = 0;

            try {
              const yaml = await fs.readFile(workspacePath, 'utf-8');
              const cwdMatch = /^cwd:\s*(.+)$/m.exec(yaml);
              const summaryMatch = /^summary:\s*"(.+)"$/m.exec(yaml);
              const createdMatch = /^created_at:\s*(.+)$/m.exec(yaml);
              const updatedMatch = /^updated_at:\s*(.+)$/m.exec(yaml);
              if (cwdMatch) cwd = cwdMatch[1].trim();
              if (summaryMatch) summary = summaryMatch[1].trim();
              if (createdMatch) createdAt = createdMatch[1].trim();
              if (updatedMatch) updatedAt = updatedMatch[1].trim();

              // Count checkpoints
              const checkpointDir = path.join(sessionPath, 'checkpoints');
              try {
                const checkpoints = await fs.readdir(checkpointDir);
                checkpointCount = checkpoints.length;
              } catch { /* no checkpoints */ }
            } catch { /* no workspace.yaml */ }

            sessions.push({
              id: name,
              name: summary ? summary.slice(0, 40) : name.slice(0, 8) + '...',
              path: sessionPath,
              type: 'hash', // UUIDs treated as hash
              agentType: 'copilot',
              cwd,
              summary,
              createdAt,
              updatedAt,
              checkpointCount,
              lastModified: stat.mtimeMs,
            });
          }
        }

        // Sort by lastModified descending (newest first)
        sessions.sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
        return success(sessions);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_SESSION,
    async (_event, sessionPath: string) => {
      try {
        await fs.rm(sessionPath, { recursive: true, force: true });
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── Plugin deletion (Claude) ──────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_PLUGIN,
    async (_event, configDir: string, pluginId: string, installPath: string) => {
      try {
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

  // ── Plugin enable/disable (Claude) ────────────────────────────────────────

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
