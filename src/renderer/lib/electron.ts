// Type-safe wrapper around the Electron API exposed via preload
import type {
  AgentProfile,
  ClaudeSettings,
  ClaudePlugin,
  GeminiSettings,
  CopilotConfig,
  McpSettings,
  Skill,
  ConfigFile,
  DirectoryEntry,
  IpcResponse,
  SessionEntry,
} from '@shared/types';

declare global {
  interface Window {
    electronAPI: {
      file: {
        read: (filePath: string) => Promise<IpcResponse<string>>;
        write: (filePath: string, content: string) => Promise<IpcResponse<void>>;
        exists: (filePath: string) => Promise<IpcResponse<boolean>>;
        delete: (filePath: string) => Promise<IpcResponse<void>>;
      };
      json: {
        read: <T>(filePath: string) => Promise<IpcResponse<T>>;
        write: (filePath: string, data: unknown) => Promise<IpcResponse<void>>;
      };
      dir: {
        list: (dirPath: string) => Promise<IpcResponse<DirectoryEntry[]>>;
        create: (dirPath: string) => Promise<IpcResponse<void>>;
        exists: (dirPath: string) => Promise<IpcResponse<boolean>>;
      };
      config: {
        getAgents: () => Promise<IpcResponse<AgentProfile[]>>;
        getClaudeSettings: (configDir: string) => Promise<IpcResponse<ConfigFile<ClaudeSettings>>>;
        saveClaudeSettings: (configDir: string, settings: ClaudeSettings) => Promise<IpcResponse<void>>;
        getClaudePlugins: (configDir: string) => Promise<IpcResponse<ClaudePlugin[]>>;
        getGeminiSettings: (configDir: string) => Promise<IpcResponse<ConfigFile<GeminiSettings>>>;
        saveGeminiSettings: (configDir: string, settings: GeminiSettings) => Promise<IpcResponse<void>>;
        getGeminiExtensions: (configDir: string) => Promise<IpcResponse<{
          extensions: Array<{ name: string; enabled: boolean; description?: string; version?: string }>;
          enablement: Record<string, unknown>;
        }>>;
        deleteGeminiExtension: (configDir: string, extensionName: string) => Promise<IpcResponse<void>>;
        getCopilotConfig: (configDir: string) => Promise<IpcResponse<ConfigFile<CopilotConfig>>>;
        saveCopilotConfig: (configDir: string, config: CopilotConfig) => Promise<IpcResponse<void>>;
        getMcp: (configDir: string) => Promise<IpcResponse<ConfigFile<McpSettings>>>;
        saveMcp: (configDir: string, settings: McpSettings) => Promise<IpcResponse<void>>;
        getSkills: (configDir: string) => Promise<IpcResponse<Skill[]>>;
        saveSkill: (configDir: string, skill: Skill) => Promise<IpcResponse<void>>;
        deleteSkill: (configDir: string, skillId: string) => Promise<IpcResponse<void>>;
        linkSharedSkill: (agentConfigDir: string, sharedSkillPath: string, skillId: string) => Promise<IpcResponse<void>>;
        installSkillFromZip: (agentConfigDir: string, zipFilePath: string) => Promise<IpcResponse<void>>;
        getMarkdown: (filePath: string) => Promise<IpcResponse<ConfigFile<string>>>;
        saveMarkdown: (filePath: string, content: string) => Promise<IpcResponse<void>>;
        getSessions: (configDir: string, agentType: string) => Promise<IpcResponse<SessionEntry[]>>;
        deleteSession: (sessionPath: string) => Promise<IpcResponse<void>>;
        setPluginEnabled: (configDir: string, pluginId: string, enabled: boolean) => Promise<IpcResponse<void>>;
        deletePlugin: (configDir: string, pluginId: string, installPath: string) => Promise<IpcResponse<void>>;
      };
      dialog: {
        openDir: (defaultPath?: string) => Promise<IpcResponse<string | null>>;
        openFile: (
          filters?: { name: string; extensions: string[] }[],
          defaultPath?: string
        ) => Promise<IpcResponse<string | null>>;
        saveFile: (
          filters?: { name: string; extensions: string[] }[],
          defaultPath?: string
        ) => Promise<IpcResponse<string | null>>;
      };
      app: {
        getUserDataPath: () => Promise<IpcResponse<string>>;
        getHomePath: () => Promise<IpcResponse<string>>;
        openExternal: (url: string) => Promise<IpcResponse<void>>;
      };
    };
  }
}

export const isElectron = (): boolean =>
  typeof window !== 'undefined' && 'electronAPI' in window;

export async function callElectron<T>(fn: () => Promise<IpcResponse<T>>): Promise<T> {
  const response = await fn();
  if (!response.success) {
    throw new Error(response.error ?? 'Unknown error');
  }
  return response.data as T;
}

export const electronAPI = () => {
  if (!isElectron()) throw new Error('Not running in Electron');
  return window.electronAPI;
};
