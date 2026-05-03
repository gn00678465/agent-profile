import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';
import type {
  IpcResponse,
  AgentType,
  DirectoryEntry,
  AgentProfile,
  ClaudeSettings,
  ClaudePlugin,
  ClaudeMarketplace,
  ClaudeMarketplaceSource,
  ClaudePluginDiscoveryItem,
  ClaudePluginError,
  CliRunResult,
  GeminiSettings,
  CopilotConfig,
  McpSettings,
  Skill,
  ConfigFile,
  SessionEntry,
  ClaudeSessionMessage,
  RuleFile,
  SubagentFile,
} from '../shared/types';

function invoke<T>(channel: string, ...args: unknown[]): Promise<IpcResponse<T>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResponse<T>>;
}

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  file: {
    read: (filePath: string) =>
      invoke<string>(IPC_CHANNELS.FILE_READ, filePath),
    write: (filePath: string, content: string) =>
      invoke<void>(IPC_CHANNELS.FILE_WRITE, filePath, content),
    exists: (filePath: string) =>
      invoke<boolean>(IPC_CHANNELS.FILE_EXISTS, filePath),
    delete: (filePath: string) =>
      invoke<void>(IPC_CHANNELS.FILE_DELETE, filePath),
  },

  // JSON operations
  json: {
    read: <T>(filePath: string) =>
      invoke<T>(IPC_CHANNELS.JSON_READ, filePath),
    write: (filePath: string, data: unknown) =>
      invoke<void>(IPC_CHANNELS.JSON_WRITE, filePath, data),
  },

  // Directory operations
  dir: {
    list: (dirPath: string) =>
      invoke<DirectoryEntry[]>(IPC_CHANNELS.DIR_LIST, dirPath),
    create: (dirPath: string) =>
      invoke<void>(IPC_CHANNELS.DIR_CREATE, dirPath),
    exists: (dirPath: string) =>
      invoke<boolean>(IPC_CHANNELS.DIR_EXISTS, dirPath),
  },

  // Config operations
  config: {
    getAgents: () =>
      invoke<AgentProfile[]>(IPC_CHANNELS.CONFIG_GET_AGENTS),

    // Claude
    getClaudeSettings: (configDir: string) =>
      invoke<ConfigFile<ClaudeSettings>>(IPC_CHANNELS.CONFIG_GET_CLAUDE_SETTINGS, configDir),
    saveClaudeSettings: (configDir: string, settings: ClaudeSettings) =>
      invoke<void>(IPC_CHANNELS.CONFIG_SAVE_CLAUDE_SETTINGS, configDir, settings),
    getClaudePlugins: (configDir: string) =>
      invoke<ClaudePlugin[]>(IPC_CHANNELS.CONFIG_GET_CLAUDE_PLUGINS, configDir),

    // Gemini
    getGeminiSettings: (configDir: string) =>
      invoke<ConfigFile<GeminiSettings>>(IPC_CHANNELS.CONFIG_GET_GEMINI_SETTINGS, configDir),
    saveGeminiSettings: (configDir: string, settings: GeminiSettings) =>
      invoke<void>(IPC_CHANNELS.CONFIG_SAVE_GEMINI_SETTINGS, configDir, settings),
    getGeminiExtensions: (configDir: string) =>
      invoke<{ extensions: Array<{ name: string; enabled: boolean }>; enablement: Record<string, unknown> }>(
        IPC_CHANNELS.CONFIG_GET_GEMINI_EXTENSIONS, configDir
      ),
    deleteGeminiExtension: (configDir: string, extensionName: string) =>
      invoke<void>(IPC_CHANNELS.CONFIG_DELETE_GEMINI_EXTENSION, configDir, extensionName),

    // Copilot
    getCopilotConfig: (configDir: string) =>
      invoke<ConfigFile<CopilotConfig>>(IPC_CHANNELS.CONFIG_GET_COPILOT_CONFIG, configDir),
    saveCopilotConfig: (configDir: string, config: CopilotConfig) =>
      invoke<void>(IPC_CHANNELS.CONFIG_SAVE_COPILOT_CONFIG, configDir, config),

    // MCP (all agents)
    getMcp: (configDir: string, agentType: AgentType) =>
      invoke<ConfigFile<McpSettings>>(IPC_CHANNELS.CONFIG_GET_MCP, configDir, agentType),
    saveMcp: (configDir: string, agentType: AgentType, settings: McpSettings) =>
      invoke<void>(IPC_CHANNELS.CONFIG_SAVE_MCP, configDir, agentType, settings),

    // Skills (all agents)
    getSkills: (configDir: string) =>
      invoke<Skill[]>(IPC_CHANNELS.CONFIG_GET_SKILLS, configDir),
    saveSkill: (configDir: string, skill: Skill) =>
      invoke<void>(IPC_CHANNELS.CONFIG_SAVE_SKILL, configDir, skill),
    deleteSkill: (configDir: string, skillId: string) =>
      invoke<void>(IPC_CHANNELS.CONFIG_DELETE_SKILL, configDir, skillId),
    linkSharedSkill: (agentConfigDir: string, sharedSkillPath: string, skillId: string) =>
      invoke<void>(IPC_CHANNELS.SKILL_LINK_SHARED, agentConfigDir, sharedSkillPath, skillId),
    installSkillFromZip: (agentConfigDir: string, zipFilePath: string) =>
      invoke<void>(IPC_CHANNELS.SKILL_INSTALL_ZIP, agentConfigDir, zipFilePath),

    // Markdown
    getMarkdown: (filePath: string) =>
      invoke<ConfigFile<string>>(IPC_CHANNELS.CONFIG_GET_MARKDOWN, filePath),
    saveMarkdown: (filePath: string, content: string) =>
      invoke<void>(IPC_CHANNELS.CONFIG_SAVE_MARKDOWN, filePath, content),

    // Sessions
    getSessions: (configDir: string, agentType: string) =>
      invoke<SessionEntry[]>(IPC_CHANNELS.CONFIG_GET_SESSIONS, configDir, agentType),
    deleteSession: (sessionPath: string) =>
      invoke<void>(IPC_CHANNELS.CONFIG_DELETE_SESSION, sessionPath),
    getClaudeSessions: (configDir: string) =>
      invoke<SessionEntry[]>(IPC_CHANNELS.CONFIG_GET_CLAUDE_SESSIONS, configDir),
    getSessionMessages: (filePath: string) =>
      invoke<ClaudeSessionMessage[]>(IPC_CHANNELS.CONFIG_GET_SESSION_MESSAGES, filePath),
    getCopilotSessionEvents: (sessionPath: string) =>
      invoke<ClaudeSessionMessage[]>(IPC_CHANNELS.CONFIG_GET_COPILOT_SESSION_EVENTS, sessionPath),
    getGeminiSessions: (configDir: string) =>
      invoke<SessionEntry[]>(IPC_CHANNELS.CONFIG_GET_GEMINI_SESSIONS, configDir),
    getGeminiSessionMessages: (sessionPath: string) =>
      invoke<ClaudeSessionMessage[]>(IPC_CHANNELS.CONFIG_GET_GEMINI_SESSION_MESSAGES, sessionPath),
    getRules: (configDir: string) =>
      invoke<RuleFile[]>(IPC_CHANNELS.CONFIG_GET_RULES, configDir),
    createRule: (configDir: string, rulePath: string) =>
      invoke<string>(IPC_CHANNELS.CONFIG_CREATE_RULE, configDir, rulePath),
    saveRule: (filePath: string, content: string) =>
      invoke<void>(IPC_CHANNELS.CONFIG_SAVE_RULE, filePath, content),
    deleteRule: (filePath: string) =>
      invoke<void>(IPC_CHANNELS.CONFIG_DELETE_RULE, filePath),
    deleteRuleFolder: (configDir: string, folderName: string) =>
      invoke<void>(IPC_CHANNELS.CONFIG_DELETE_RULE_FOLDER, configDir, folderName),

    // Subagents (Copilot)
    getSubagents: (configDir: string) =>
      invoke<SubagentFile[]>(IPC_CHANNELS.CONFIG_GET_SUBAGENTS, configDir),
    createSubagent: (configDir: string, name: string) =>
      invoke<string>(IPC_CHANNELS.CONFIG_CREATE_SUBAGENT, configDir, name),
    deleteSubagent: (configDir: string, name: string) =>
      invoke<void>(IPC_CHANNELS.CONFIG_DELETE_SUBAGENT, configDir, name),
    renameSubagent: (configDir: string, oldName: string, newName: string) =>
      invoke<string>(IPC_CHANNELS.CONFIG_RENAME_SUBAGENT, configDir, oldName, newName),
    renameRule: (filePath: string, newName: string) =>
      invoke<string>(IPC_CHANNELS.CONFIG_RENAME_RULE, filePath, newName),

    // Plugin enable/disable
    setPluginEnabled: (configDir: string, pluginId: string, enabled: boolean) =>
      invoke<void>(IPC_CHANNELS.CONFIG_SET_PLUGIN_ENABLED, configDir, pluginId, enabled),

    // Plugin deletion
    deletePlugin: (configDir: string, pluginId: string, installPath: string) =>
      invoke<void>(IPC_CHANNELS.CONFIG_DELETE_PLUGIN, configDir, pluginId, installPath),

    // Claude plugin extended reads (feat-019).
    // Surface inventory (1-line per binding for F2 grep discoverability):
    //   config.getClaudeMarketplaces — read known + extra marketplaces
    //   config.getClaudePluginDiscovery — list marketplace plugins
    //   config.getClaudePluginErrors — accumulated plugin errors
    getClaudeMarketplaces: (configDir: string) =>
      invoke<ClaudeMarketplace[]>(IPC_CHANNELS.CONFIG_GET_CLAUDE_MARKETPLACES, configDir),
    getClaudePluginDiscovery: (configDir: string, marketplaceName: string) =>
      invoke<ClaudePluginDiscoveryItem[]>(IPC_CHANNELS.CONFIG_GET_CLAUDE_PLUGIN_DISCOVERY, configDir, marketplaceName),
    getClaudePluginErrors: (configDir: string) =>
      invoke<ClaudePluginError[]>(IPC_CHANNELS.CONFIG_GET_CLAUDE_PLUGIN_ERRORS, configDir),
  },

  // Claude CLI integration (feat-019).
  // Surface inventory (1-line per binding for F2 grep discoverability):
  //   claudeCli.marketplaceAdd — register a new marketplace via CLI
  //   claudeCli.marketplaceRemove — unregister a marketplace via CLI
  //   claudeCli.marketplaceUpdate — refresh a marketplace via CLI
  //   claudeCli.pluginInstall — install a plugin into a scope
  //   claudeCli.pluginUninstall — uninstall a plugin from a scope
  //   claudeCli.reload — reload the plugin subsystem (equivalent of /reload-plugins)
  claudeCli: {
    marketplaceAdd: (name: string, source: ClaudeMarketplaceSource) =>
      invoke<CliRunResult>(IPC_CHANNELS.CLAUDE_CLI_MARKETPLACE_ADD, name, source),
    marketplaceRemove: (name: string) =>
      invoke<CliRunResult>(IPC_CHANNELS.CLAUDE_CLI_MARKETPLACE_REMOVE, name),
    marketplaceUpdate: (name: string) =>
      invoke<CliRunResult>(IPC_CHANNELS.CLAUDE_CLI_MARKETPLACE_UPDATE, name),
    pluginInstall: (pluginId: string, scope: 'user' | 'project' | 'local') =>
      invoke<CliRunResult>(IPC_CHANNELS.CLAUDE_CLI_PLUGIN_INSTALL, pluginId, scope),
    pluginUninstall: (pluginId: string, scope: 'user' | 'project' | 'local') =>
      invoke<CliRunResult>(IPC_CHANNELS.CLAUDE_CLI_PLUGIN_UNINSTALL, pluginId, scope),
    reload: () =>
      invoke<CliRunResult>(IPC_CHANNELS.CLAUDE_CLI_RELOAD),
  },

  // Dialog operations
  dialog: {
    openDir: (defaultPath?: string) =>
      invoke<string | null>(IPC_CHANNELS.DIALOG_OPEN_DIR, defaultPath),
    openFile: (filters?: Electron.FileFilter[], defaultPath?: string) =>
      invoke<string | null>(IPC_CHANNELS.DIALOG_OPEN_FILE, filters, defaultPath),
    saveFile: (filters?: Electron.FileFilter[], defaultPath?: string) =>
      invoke<string | null>(IPC_CHANNELS.DIALOG_SAVE_FILE, filters, defaultPath),
  },

  // App operations
  app: {
    getUserDataPath: () =>
      invoke<string>(IPC_CHANNELS.APP_GET_USER_DATA_PATH),
    getHomePath: () =>
      invoke<string>(IPC_CHANNELS.APP_GET_HOME_PATH),
    openExternal: (url: string) =>
      invoke<void>(IPC_CHANNELS.APP_OPEN_EXTERNAL, url),
  },
});
