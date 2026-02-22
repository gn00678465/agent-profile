// Shared type definitions between main and renderer processes

export interface AgentProfile {
  id: string;
  name: string;
  configDir: string;
  description?: string;
  type: AgentType;
}

// Agent types discovered from research
export type AgentType = 'claude-code' | 'claude-desktop' | 'gemini' | 'copilot' | 'shared' | 'custom';

// ─── Claude Code (`~/.claude/`) ─────────────────────────────────────────────

export interface ClaudeSettings {
  env?: Record<string, string>;
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  enabledPlugins?: Record<string, boolean>;
  skipDangerousModePermissionPrompt?: boolean;
  model?: string;
  [key: string]: unknown;
}

export interface ClaudePlugin {
  id: string; // "name@marketplace"
  name: string;
  marketplace: string;
  scope: 'user' | 'project';
  projectPath?: string;
  installPath: string;
  version: string;
  installedAt: string;
  lastUpdated: string;
  gitCommitSha?: string;
  enabled?: boolean;
}

export interface ClaudeInstalledPlugins {
  version: 2;
  plugins: Record<string, Array<{
    scope: 'user' | 'project';
    projectPath?: string;
    installPath: string;
    version: string;
    installedAt: string;
    lastUpdated: string;
    gitCommitSha?: string;
  }>>;
}

// ─── Gemini (`~/.gemini/`) ───────────────────────────────────────────────────

export interface GeminiSettings {
  ide?: { hasSeenNudge?: boolean };
  security?: {
    auth?: {
      selectedType?: 'oauth-personal' | 'oauth-workspace' | 'api-key';
    };
  };
  general?: {
    previewFeatures?: boolean;
    vimMode?: boolean;
    sessionRetention?: { enabled?: boolean };
    enablePromptCompletion?: boolean;
  };
  ui?: {
    hideContextSummary?: boolean;
    showMemoryUsage?: boolean;
    showModelInfoInChat?: boolean;
  };
  experimental?: {
    skills?: boolean;
  };
  mcpServers?: Record<string, McpServer>;
  [key: string]: unknown;
}

export interface GeminiExtension {
  name: string;
  version?: string;
  description?: string;
  contextFileName?: string;
  mcpServers?: Record<string, McpServer>;
}

export interface GeminiExtensionEnablement {
  [extensionName: string]: {
    overrides?: string[];
  };
}

// ─── Copilot (`~/.copilot/`) ─────────────────────────────────────────────────

export interface CopilotConfig {
  banner?: 'never' | 'always' | string;
  last_logged_in_user?: { host: string; login: string };
  logged_in_users?: Array<{ host: string; login: string }>;
  model?: string;
  render_markdown?: boolean;
  screen_reader?: boolean;
  theme?: 'auto' | 'light' | 'dark';
  asked_setup_terminals?: string[];
  [key: string]: unknown;
}

// ─── MCP Servers (shared format) ─────────────────────────────────────────────

export interface McpServer {
  type?: 'stdio' | 'sse' | 'http' | 'local' | 'remote';
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  disabled?: boolean;
  alwaysAllow?: string[];
  tools?: string[];
  timeout?: number;
}

export interface McpSettings {
  mcpServers?: Record<string, McpServer>;
}

// ─── Skills (universal format across all agents) ──────────────────────────────

export interface SkillFrontmatter {
  name: string;
  version?: string;
  description?: string;
  'user-invocable'?: boolean;
  license?: string;
  'allowed-tools'?: string[];
  hooks?: {
    PreToolUse?: SkillHookConfig[];
    PostToolUse?: SkillHookConfig[];
    Stop?: SkillHookConfig[];
  };
}

export interface SkillHookConfig {
  matcher?: string;
  hooks?: Array<{
    type: 'command';
    command: string;
  }>;
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  version?: string;
  content: string;         // full SKILL.md text
  frontmatter?: SkillFrontmatter;
  filePath?: string;
  dirPath?: string;        // skill folder path
  userInvocable?: boolean;
  isSymbolicLink?: boolean;
}

// ─── Session types ────────────────────────────────────────────────────────────

export interface GeminiSession {
  id: string;
  name: string;
  path: string;
  type: 'hash' | 'named';
}

export interface CopilotSession {
  id: string;
  path: string;
  cwd?: string;
  summary?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Generic config file result ───────────────────────────────────────────────

export interface ConfigFile<T = unknown> {
  path: string;
  exists: boolean;
  data: T | null;
  error?: string;
}

// ─── Directory listing ────────────────────────────────────────────────────────

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size?: number;
  lastModified?: number;
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export interface SessionEntry {
  id: string;
  name: string;
  path: string;
  type: 'named' | 'hash';
  agentType: AgentType;
  // Gemini
  hasChats?: boolean;
  hasLogs?: boolean;
  // Copilot workspace.yaml
  cwd?: string;
  summary?: string;
  createdAt?: string;
  updatedAt?: string;
  checkpointCount?: number;
  // Common
  lastModified?: number;
}

// ─── IPC Channels ────────────────────────────────────────────────────────────

export const IPC_CHANNELS = {
  // File operations
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_EXISTS: 'file:exists',
  FILE_DELETE: 'file:delete',

  // JSON operations
  JSON_READ: 'json:read',
  JSON_WRITE: 'json:write',

  // Directory operations
  DIR_LIST: 'dir:list',
  DIR_CREATE: 'dir:create',
  DIR_EXISTS: 'dir:exists',

  // Config-specific operations
  CONFIG_GET_AGENTS: 'config:get-agents',

  // Claude
  CONFIG_GET_CLAUDE_SETTINGS: 'config:get-claude-settings',
  CONFIG_SAVE_CLAUDE_SETTINGS: 'config:save-claude-settings',
  CONFIG_GET_CLAUDE_PLUGINS: 'config:get-claude-plugins',

  // Gemini
  CONFIG_GET_GEMINI_SETTINGS: 'config:get-gemini-settings',
  CONFIG_SAVE_GEMINI_SETTINGS: 'config:save-gemini-settings',
  CONFIG_GET_GEMINI_EXTENSIONS: 'config:get-gemini-extensions',
  CONFIG_DELETE_GEMINI_EXTENSION: 'config:delete-gemini-extension',

  // Copilot
  CONFIG_GET_COPILOT_CONFIG: 'config:get-copilot-config',
  CONFIG_SAVE_COPILOT_CONFIG: 'config:save-copilot-config',

  // MCP (all agents)
  CONFIG_GET_MCP: 'config:get-mcp',
  CONFIG_SAVE_MCP: 'config:save-mcp',

  // Skills (all agents)
  CONFIG_GET_SKILLS: 'config:get-skills',
  CONFIG_SAVE_SKILL: 'config:save-skill',
  CONFIG_DELETE_SKILL: 'config:delete-skill',

  // Markdown files (CLAUDE.md / GEMINI.md)
  CONFIG_GET_MARKDOWN: 'config:get-markdown',
  CONFIG_SAVE_MARKDOWN: 'config:save-markdown',

  // Sessions
  CONFIG_GET_SESSIONS: 'config:get-sessions',
  CONFIG_DELETE_SESSION: 'config:delete-session',

  // Plugin enable/disable
  CONFIG_SET_PLUGIN_ENABLED: 'config:set-plugin-enabled',

  // Plugin deletion
  CONFIG_DELETE_PLUGIN: 'config:delete-plugin',

  // Dialog operations
  DIALOG_OPEN_DIR: 'dialog:open-dir',
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_SAVE_FILE: 'dialog:save-file',

  // App operations
  APP_GET_USER_DATA_PATH: 'app:get-user-data-path',
  APP_GET_HOME_PATH: 'app:get-home-path',
  APP_OPEN_EXTERNAL: 'app:open-external',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Agent config paths ───────────────────────────────────────────────────────

export interface AgentConfigPaths {
  root: string;
  settingsFile?: string;
  mcpFile?: string;
  skillsDir?: string;
  markdownFile?: string;
  extensionsDir?: string;
  pluginsDir?: string;
  sessionsDir?: string;
}
