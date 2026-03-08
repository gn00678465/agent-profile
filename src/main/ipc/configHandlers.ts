import { IpcMain } from 'electron';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
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
  ClaudeSessionMessage,
  RuleFile,
} from '../../shared/types';

const execFileAsync = promisify(execFile);

/**
 * Throws if `inputPath` does not resolve to a location within at least one
 * of `allowedRoots`. Prevents path-traversal attacks from renderer-supplied paths.
 */
function assertSafePath(inputPath: string, ...allowedRoots: string[]): void {
  const resolved = path.resolve(inputPath);
  const safe = allowedRoots.some((root) => {
    const rootResolved = path.resolve(root);
    return resolved === rootResolved || resolved.startsWith(rootResolved + path.sep);
  });
  if (!safe) {
    throw new Error('Access denied: path is outside allowed directories');
  }
}

/**
 * Throws if `name` contains path separators or traversal sequences.
 * Use for renderer-supplied name/id values used as path components.
 */
function assertSafeName(name: string): void {
  if (!name || /[/\\]/.test(name) || name === '..' || name.includes('..')) {
    throw new Error(`Invalid name: "${name}"`);
  }
}

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
async function readSkillFolder(folderPath: string, isSymbolicLink?: boolean): Promise<Skill | null> {
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
      isSymbolicLink,
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

  // GitHub Copilot CLI
  agents.push({
    id: 'copilot',
    name: 'GitHub Copilot',
    configDir: path.join(home, '.copilot'),
    description: 'GitHub Copilot CLI agent',
    type: 'copilot',
  });

  // Gemini CLI
  agents.push({
    id: 'gemini',
    name: 'Gemini CLI',
    configDir: path.join(home, '.gemini'),
    description: 'Google Gemini CLI agent',
    type: 'gemini',
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

  const KNOWN_CONFIG_DIRS = [
    path.join(home, '.claude'),
    path.join(home, '.gemini'),
    path.join(home, '.copilot'),
    path.join(home, '.agents'),
  ];

  function assertKnownConfigDir(configDir: string): void {
    const resolved = path.resolve(configDir);
    if (!KNOWN_CONFIG_DIRS.some((d) => path.resolve(d) === resolved)) {
      throw new Error('Access denied: unknown config directory');
    }
  }

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
        assertSafeName(extensionName);
        const extensionsDir = path.join(configDir, 'extensions');

        // 1. Remove from extension-enablement.json
        const enablementPath = path.join(extensionsDir, 'extension-enablement.json');
        const enablementResult = await readJsonFile<GeminiExtensionEnablement>(enablementPath);
        if (enablementResult.data && extensionName in enablementResult.data) {
          const updated = Object.fromEntries(
            Object.entries(enablementResult.data).filter(([k]) => k !== extensionName)
          );
          await writeJsonFile(enablementPath, updated);
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
            const lstat = await fs.lstat(entryPath);
            const isSymbolicLink = lstat.isSymbolicLink();
            
            // If it's a symbolic link, we need to check if the target is a directory
            if (isSymbolicLink) {
              const stat = await fs.stat(entryPath);
              if (!stat.isDirectory()) continue;
            } else if (!lstat.isDirectory()) {
              continue;
            }

            const skill = await readSkillFolder(entryPath, isSymbolicLink);
            if (skill) skills.push(skill);
          } catch {
            continue;
          }
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
        assertSafeName(skill.id);
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
        assertSafeName(skillId);
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
        assertSafePath(sessionPath, os.homedir());
        await fs.rm(sessionPath, { recursive: true, force: true });
        return success(undefined);
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

  // ── Plugin deletion (Claude) ──────────────────────────────────────────────

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

  // ── Skill: link shared skill via symbolic link ──────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.SKILL_LINK_SHARED,
    async (_event, agentConfigDir: string, sharedSkillPath: string, skillId: string) => {
      try {
        assertSafeName(skillId);
        assertSafePath(sharedSkillPath, os.homedir());
        const skillsDir = path.join(agentConfigDir, 'skills');
        await fs.mkdir(skillsDir, { recursive: true });
        const linkPath = path.join(skillsDir, skillId);

        // Check for existing entry
        try {
          const lstat = await fs.lstat(linkPath);
          if (lstat.isSymbolicLink()) {
            const existing = await fs.readlink(linkPath);
            if (path.resolve(existing) === path.resolve(sharedSkillPath)) {
              // Already correctly linked
              return success(undefined);
            }
            // Different symlink — remove and re-create
            await fs.unlink(linkPath);
          } else {
            return failure(new Error(`A real skill named "${skillId}" already exists. Remove it first.`));
          }
        } catch (e) {
          const err = e as NodeJS.ErrnoException;
          if (err.code !== 'ENOENT') throw err;
          // Expected: path doesn't exist yet
        }

        // On Windows use 'junction' for directory symlinks; on others use 'dir'
        const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
        await fs.symlink(sharedSkillPath, linkPath, symlinkType);
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── Skill: install from ZIP archive ───────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.SKILL_INSTALL_ZIP,
    async (_event, agentConfigDir: string, zipFilePath: string) => {
      try {
        const skillsDir = path.join(agentConfigDir, 'skills');
        await fs.mkdir(skillsDir, { recursive: true });

        if (process.platform === 'win32') {
          // Paths are passed via environment variables — never interpolated into the
          // command string — to prevent command injection from renderer-supplied paths.
          const ps1 =
            "$ErrorActionPreference = 'Stop'; " +
            'Expand-Archive -Force -LiteralPath $env:ZIP_SRC -DestinationPath $env:ZIP_DST';
          await execFileAsync(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', ps1],
            { env: { ...process.env, ZIP_SRC: zipFilePath, ZIP_DST: skillsDir } }
          );
        } else {
          await execFileAsync('unzip', ['-o', zipFilePath, '-d', skillsDir]);
        }
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── Rules (Claude Code ~/.claude/rules/) ──────────────────────────────────

  /**
   * Parses a renderer-supplied rule path like `folder/rule.md` or `rule.md`.
   * Validates that it is at most one level deep and contains no traversal.
   * Returns { folder, fileName } where folder is null for top-level files.
   */
  function parseRulePath(rulePath: string): { folder: string | null; fileName: string } {
    if (!rulePath || rulePath.trim() === '') {
      throw new Error('Invalid rule path: empty');
    }
    const parts = rulePath.split('/');
    if (parts.length > 2) {
      throw new Error('Invalid rule path: only one folder level is supported');
    }
    for (const part of parts) {
      if (!part || part === '..' || part.includes('..') || /[\\]/.test(part)) {
        throw new Error(`Invalid rule path component: "${part}"`);
      }
    }
    if (parts.length === 2) {
      return { folder: parts[0], fileName: parts[1] };
    }
    return { folder: null, fileName: parts[0] };
  }

  /**
   * Creates an empty rule file within configDir/rules/.
   * Shared logic used by CONFIG_CREATE_RULE.
   * Returns the absolute path of the created file.
   */
  async function createRuleFile(configDir: string, rulePath: string): Promise<string> {
    assertKnownConfigDir(configDir);
    const { folder, fileName } = parseRulePath(rulePath);
    const rulesDir = path.join(configDir, 'rules');
    const targetDir = folder ? path.join(rulesDir, folder) : rulesDir;
    const filePath = path.join(targetDir, fileName);
    assertSafePath(filePath, os.homedir());
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(filePath, '', 'utf-8');
    return filePath;
  }

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_CREATE_RULE,
    async (_event, configDir: string, rulePath: string) => {
      try {
        const filePath = await createRuleFile(configDir, rulePath);
        return success(filePath);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_RULE_FOLDER,
    async (_event, configDir: string, folderName: string) => {
      try {
        assertKnownConfigDir(configDir);
        assertSafeName(folderName);
        const folderPath = path.join(configDir, 'rules', folderName);
        assertSafePath(folderPath, os.homedir());
        await fs.rm(folderPath, { recursive: true, force: true });
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_RULES,
    async (_event, configDir: string) => {
      try {
        const rulesDir = path.join(configDir, 'rules');
        const rules: RuleFile[] = [];

        let topEntries: string[] = [];
        try {
          topEntries = await fs.readdir(rulesDir);
        } catch {
          return success<RuleFile[]>([]);
        }

        for (const topName of topEntries) {
          const topPath = path.join(rulesDir, topName);
          let topStat;
          try { topStat = await fs.stat(topPath); } catch { continue; }

          if (topStat.isDirectory()) {
            // Folder — list .md files inside
            let subEntries: string[] = [];
            try { subEntries = await fs.readdir(topPath); } catch { continue; }
            for (const subName of subEntries) {
              if (!subName.endsWith('.md')) continue;
              const filePath = path.join(topPath, subName);
              try {
                const s = await fs.stat(filePath);
                if (!s.isFile()) continue;
              } catch { continue; }
              rules.push({
                id: `${topName}/${subName.slice(0, -3)}`,
                folder: topName,
                name: subName,
                path: filePath,
              });
            }
          } else if (topStat.isFile() && topName.endsWith('.md')) {
            // Top-level .md file
            rules.push({
              id: topName.slice(0, -3),
              folder: '',
              name: topName,
              path: topPath,
            });
          }
        }

        return success(rules);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE_RULE,
    async (_event, filePath: string, content: string) => {
      try {
        assertSafePath(filePath, os.homedir());
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_RULE,
    async (_event, filePath: string) => {
      try {
        assertSafePath(filePath, os.homedir());
        await fs.unlink(filePath);
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
