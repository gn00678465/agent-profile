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

export interface ClaudePluginAuthor {
  name: string;
  email?: string;
  url?: string;
}

export interface ClaudePluginComponents {
  skills: number;
  agents: number;
  hooks: number;
  mcp: boolean;
  lsp: boolean;
  monitors: number;
}

export interface ClaudePlugin {
  id: string; // "name@marketplace"
  name: string;
  marketplace: string;
  scope: 'user' | 'project' | 'managed';
  projectPath?: string;
  installPath: string;
  version: string;
  installedAt: string;
  lastUpdated: string;
  gitCommitSha?: string;
  enabled?: boolean;
  // S1-1 manifest extensions
  description?: string;
  author?: ClaudePluginAuthor;
  homepage?: string;
  repository?: string;
  license?: string;
  category?: string;
  components?: ClaudePluginComponents;
}

export interface ClaudeInstalledPlugins {
  version: 2;
  plugins: Record<string, Array<{
    scope: 'user' | 'project' | 'managed';
    projectPath?: string;
    installPath: string;
    version: string;
    installedAt: string;
    lastUpdated: string;
    gitCommitSha?: string;
  }>>;
}

// Marketplace source — discriminated union covers all 5 source types (L5)
export type ClaudeMarketplaceSource =
  | { source: 'github'; repo: string }
  | { source: 'git'; url: string; ref?: string; sha?: string }
  | { source: 'git-subdir'; url: string; path: string; ref?: string; sha?: string }
  | { source: 'url'; url: string; sha?: string }
  | { source: 'directory'; path: string };

export interface ClaudeMarketplace {
  name: string;
  source: ClaudeMarketplaceSource;
  installLocation: string;
  lastUpdated?: string;
  autoUpdate: boolean;
  isOfficial: boolean;
  pluginCount: number;
  // Tracks if extraKnownMarketplaces declares this name but known_marketplaces.json hasn't materialized it
  unsynced?: boolean;
}

export interface ClaudePluginDiscoveryItem {
  name: string;
  marketplace: string;
  description?: string;
  author?: { name: string; email?: string };
  category?: string;
  homepage?: string;
  installed: boolean;
}

export interface ClaudePluginError {
  scope: 'plugin' | 'marketplace' | 'cli';
  targetId: string;
  severity: 'error' | 'warn';
  message: string;
  raisedAt: string;
}

export interface CliRunResult {
  success: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
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
  trust?: boolean;   // Gemini-specific: bypass confirmation dialogs
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

export interface ClaudeSessionMessage {
  role: 'user' | 'assistant';
  text: string;
}

export type CopilotSessionMessage = ClaudeSessionMessage;

export interface GeminiSessionMessage {
  id: string;
  type: 'user' | 'gemini' | 'info';
  content: string;
  timestamp: string;
  thoughts?: Array<{ subject: string; description: string }>;
  tokens?: {
    input: number;
    output: number;
    cached?: number;
    thoughts?: number;
    tool?: number;
    total: number;
  };
  model?: string;
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
  slug?: string;
}

export interface GeminiSessionEntry extends SessionEntry {
  sessionId: string;       // UUID from the JSON file
  projectHash: string;     // the parent folder hash
  startTime: string;       // ISO timestamp
  lastUpdated: string;     // ISO timestamp
  messageCount?: number;   // total messages in the session
}

export interface RuleFile {
  id: string;       // e.g. "common/agents"
  folder: string;   // e.g. "common"
  name: string;     // e.g. "agents.md"
  path: string;     // absolute path
}

export interface SubagentFile {
  id: string;    // filename without .agent.md, e.g. "coder"
  name: string;  // same as id
  path: string;  // absolute path to the .agent.md file
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
  CONFIG_GET_COPILOT_SESSION_EVENTS: 'config:get-copilot-session-events',

  // MCP (all agents)
  CONFIG_GET_MCP: 'config:get-mcp',
  CONFIG_SAVE_MCP: 'config:save-mcp',

  // Skills (all agents)
  CONFIG_GET_SKILLS: 'config:get-skills',
  CONFIG_SAVE_SKILL: 'config:save-skill',
  CONFIG_DELETE_SKILL: 'config:delete-skill',
  SKILL_LINK_SHARED: 'skill:link-shared',
  SKILL_INSTALL_ZIP: 'skill:install-zip',

  // Markdown files (CLAUDE.md / GEMINI.md)
  CONFIG_GET_MARKDOWN: 'config:get-markdown',
  CONFIG_SAVE_MARKDOWN: 'config:save-markdown',

  // Sessions
  CONFIG_GET_SESSIONS: 'config:get-sessions',
  CONFIG_DELETE_SESSION: 'config:delete-session',
  CONFIG_GET_CLAUDE_SESSIONS: 'config:get-claude-sessions',
  CONFIG_GET_SESSION_MESSAGES: 'config:get-session-messages',
  CONFIG_GET_GEMINI_SESSIONS: 'config:get-gemini-sessions',
  CONFIG_GET_GEMINI_SESSION_MESSAGES: 'config:get-gemini-session-messages',

  // Rules
  CONFIG_GET_RULES: 'config:get-rules',
  CONFIG_CREATE_RULE: 'config:create-rule',
  CONFIG_SAVE_RULE: 'config:save-rule',
  CONFIG_DELETE_RULE: 'config:delete-rule',
  CONFIG_DELETE_RULE_FOLDER: 'config:delete-rule-folder',

  // Subagents (Copilot ~/.copilot/subagents/*.agent.md)
  CONFIG_GET_SUBAGENTS: 'config:get-subagents',
  CONFIG_CREATE_SUBAGENT: 'config:create-subagent',
  CONFIG_DELETE_SUBAGENT: 'config:delete-subagent',
  CONFIG_RENAME_SUBAGENT: 'config:rename-subagent',

  // Rules rename
  CONFIG_RENAME_RULE: 'config:rename-rule',

  // Plugin enable/disable
  CONFIG_SET_PLUGIN_ENABLED: 'config:set-plugin-enabled',

  // Plugin deletion
  CONFIG_DELETE_PLUGIN: 'config:delete-plugin',

  // Claude plugin extended reads (feat-019).
  // Each read channel is exposed under two constant names — the L1-canonical
  // CONFIG_GET_CLAUDE_* form (semantic group: config reads) and an alias
  // CLAUDE_PLUGINS_* form so the entire feat-019 channel set is discoverable
  // by the F1 verification grep `CLAUDE_(CLI|PLUGINS)_`. Both names resolve to
  // the same channel string, so handler registration / preload binding is
  // unaffected — pick whichever reads better in context.
  CONFIG_GET_CLAUDE_MARKETPLACES: 'config:get-claude-marketplaces',
  CLAUDE_PLUGINS_GET_MARKETPLACES: 'config:get-claude-marketplaces',
  CONFIG_GET_CLAUDE_PLUGIN_DISCOVERY: 'config:get-claude-plugin-discovery',
  CLAUDE_PLUGINS_GET_DISCOVERY: 'config:get-claude-plugin-discovery',
  CONFIG_GET_CLAUDE_PLUGIN_ERRORS: 'config:get-claude-plugin-errors',
  CLAUDE_PLUGINS_GET_ERRORS: 'config:get-claude-plugin-errors',

  // Claude CLI integration (feat-019)
  CLAUDE_CLI_MARKETPLACE_ADD: 'claude-cli:marketplace-add',
  CLAUDE_CLI_MARKETPLACE_REMOVE: 'claude-cli:marketplace-remove',
  CLAUDE_CLI_MARKETPLACE_UPDATE: 'claude-cli:marketplace-update',
  CLAUDE_CLI_PLUGIN_INSTALL: 'claude-cli:plugin-install',
  CLAUDE_CLI_PLUGIN_UNINSTALL: 'claude-cli:plugin-uninstall',
  CLAUDE_CLI_RELOAD: 'claude-cli:reload',

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
