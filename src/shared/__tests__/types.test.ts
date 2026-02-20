import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from '../types';
import type {
  AgentProfile,
  ClaudeSettings,
  GeminiSettings,
  CopilotConfig,
  McpServer,
  McpSettings,
  Skill,
  ConfigFile,
  IpcResponse,
} from '../types';

describe('IPC_CHANNELS', () => {
  it('has all required file operation channels', () => {
    expect(IPC_CHANNELS.FILE_READ).toBe('file:read');
    expect(IPC_CHANNELS.FILE_WRITE).toBe('file:write');
    expect(IPC_CHANNELS.FILE_EXISTS).toBe('file:exists');
    expect(IPC_CHANNELS.FILE_DELETE).toBe('file:delete');
  });

  it('has all required JSON operation channels', () => {
    expect(IPC_CHANNELS.JSON_READ).toBe('json:read');
    expect(IPC_CHANNELS.JSON_WRITE).toBe('json:write');
  });

  it('has all required directory operation channels', () => {
    expect(IPC_CHANNELS.DIR_LIST).toBe('dir:list');
    expect(IPC_CHANNELS.DIR_CREATE).toBe('dir:create');
    expect(IPC_CHANNELS.DIR_EXISTS).toBe('dir:exists');
  });

  it('has all required config operation channels', () => {
    expect(IPC_CHANNELS.CONFIG_GET_AGENTS).toBe('config:get-agents');
    expect(IPC_CHANNELS.CONFIG_GET_CLAUDE_SETTINGS).toBe('config:get-claude-settings');
    expect(IPC_CHANNELS.CONFIG_SAVE_CLAUDE_SETTINGS).toBe('config:save-claude-settings');
    expect(IPC_CHANNELS.CONFIG_GET_CLAUDE_PLUGINS).toBe('config:get-claude-plugins');
    expect(IPC_CHANNELS.CONFIG_GET_GEMINI_SETTINGS).toBe('config:get-gemini-settings');
    expect(IPC_CHANNELS.CONFIG_SAVE_GEMINI_SETTINGS).toBe('config:save-gemini-settings');
    expect(IPC_CHANNELS.CONFIG_GET_GEMINI_EXTENSIONS).toBe('config:get-gemini-extensions');
    expect(IPC_CHANNELS.CONFIG_GET_COPILOT_CONFIG).toBe('config:get-copilot-config');
    expect(IPC_CHANNELS.CONFIG_SAVE_COPILOT_CONFIG).toBe('config:save-copilot-config');
    expect(IPC_CHANNELS.CONFIG_GET_MCP).toBe('config:get-mcp');
    expect(IPC_CHANNELS.CONFIG_SAVE_MCP).toBe('config:save-mcp');
    expect(IPC_CHANNELS.CONFIG_GET_SKILLS).toBe('config:get-skills');
    expect(IPC_CHANNELS.CONFIG_SAVE_SKILL).toBe('config:save-skill');
    expect(IPC_CHANNELS.CONFIG_DELETE_SKILL).toBe('config:delete-skill');
    expect(IPC_CHANNELS.CONFIG_GET_MARKDOWN).toBe('config:get-markdown');
    expect(IPC_CHANNELS.CONFIG_SAVE_MARKDOWN).toBe('config:save-markdown');
  });

  it('has all required dialog operation channels', () => {
    expect(IPC_CHANNELS.DIALOG_OPEN_DIR).toBe('dialog:open-dir');
    expect(IPC_CHANNELS.DIALOG_OPEN_FILE).toBe('dialog:open-file');
    expect(IPC_CHANNELS.DIALOG_SAVE_FILE).toBe('dialog:save-file');
  });

  it('has all required app operation channels', () => {
    expect(IPC_CHANNELS.APP_GET_USER_DATA_PATH).toBe('app:get-user-data-path');
    expect(IPC_CHANNELS.APP_GET_HOME_PATH).toBe('app:get-home-path');
    expect(IPC_CHANNELS.APP_OPEN_EXTERNAL).toBe('app:open-external');
  });

  it('all channel values are unique (no collisions)', () => {
    const values = Object.values(IPC_CHANNELS);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

describe('Type shape validation', () => {
  it('AgentProfile has required fields', () => {
    const agent: AgentProfile = {
      id: 'claude-code',
      name: 'Claude Code',
      configDir: '/home/.claude',
      type: 'claude-code',
    };
    expect(agent.id).toBeDefined();
    expect(agent.name).toBeDefined();
    expect(agent.configDir).toBeDefined();
    expect(agent.type).toBeDefined();
  });

  it('AgentProfile description is optional', () => {
    const agent: AgentProfile = {
      id: 'test',
      name: 'Test',
      configDir: '/test',
      type: 'custom',
    };
    expect(agent.description).toBeUndefined();
  });

  it('ClaudeSettings allows partial fields', () => {
    const settings: ClaudeSettings = {};
    expect(settings.model).toBeUndefined();
    expect(settings.env).toBeUndefined();
    expect(settings.permissions).toBeUndefined();
  });

  it('ClaudeSettings accepts all known fields', () => {
    const settings: ClaudeSettings = {
      model: 'opus',
      env: { MY_VAR: 'value' },
      permissions: { allow: ['Bash(*)'], deny: [] },
      enabledPlugins: { 'context7@official': true },
      skipDangerousModePermissionPrompt: false,
    };
    expect(settings.model).toBe('opus');
    expect(settings.env?.MY_VAR).toBe('value');
    expect(settings.permissions?.allow).toContain('Bash(*)');
  });

  it('GeminiSettings allows nested optional objects', () => {
    const settings: GeminiSettings = {
      general: {
        previewFeatures: true,
        vimMode: false,
        sessionRetention: { enabled: true },
        enablePromptCompletion: true,
      },
      ui: {
        hideContextSummary: false,
        showMemoryUsage: true,
        showModelInfoInChat: true,
      },
      experimental: { skills: true },
    };
    expect(settings.general?.vimMode).toBe(false);
    expect(settings.ui?.showMemoryUsage).toBe(true);
    expect(settings.experimental?.skills).toBe(true);
  });

  it('CopilotConfig matches expected schema', () => {
    const config: CopilotConfig = {
      banner: 'never',
      model: 'claude-sonnet-4.5',
      render_markdown: true,
      screen_reader: false,
      theme: 'auto',
      last_logged_in_user: { host: 'https://github.com', login: 'user' },
      logged_in_users: [{ host: 'https://github.com', login: 'user' }],
    };
    expect(config.theme).toBe('auto');
    expect(config.logged_in_users).toHaveLength(1);
  });

  it('McpServer supports all transport types', () => {
    const stdioServer: McpServer = { type: 'stdio', command: 'npx', args: ['-y', 'mcp'] };
    const sseServer: McpServer = { type: 'sse', url: 'https://mcp.example.com' };
    const httpServer: McpServer = { type: 'http', url: 'https://api.example.com' };
    const localServer: McpServer = { type: 'local', command: 'docker', args: ['mcp', 'run'] };

    expect(stdioServer.type).toBe('stdio');
    expect(sseServer.type).toBe('sse');
    expect(httpServer.type).toBe('http');
    expect(localServer.type).toBe('local');
  });

  it('McpSettings has optional mcpServers record', () => {
    const empty: McpSettings = {};
    const withServers: McpSettings = {
      mcpServers: {
        test: { type: 'stdio', command: 'npx' },
      },
    };
    expect(empty.mcpServers).toBeUndefined();
    expect(withServers.mcpServers?.test).toBeDefined();
  });

  it('ConfigFile with exists=false has null data', () => {
    const notFound: ConfigFile<string> = {
      path: '/some/path',
      exists: false,
      data: null,
    };
    expect(notFound.data).toBeNull();
    expect(notFound.error).toBeUndefined();
  });

  it('ConfigFile with exists=true and error describes parse failure', () => {
    const parseError: ConfigFile<object> = {
      path: '/some/config.json',
      exists: true,
      data: null,
      error: 'Unexpected token } in JSON',
    };
    expect(parseError.exists).toBe(true);
    expect(parseError.data).toBeNull();
    expect(parseError.error).toBeDefined();
  });

  it('IpcResponse success shape', () => {
    const ok: IpcResponse<string[]> = { success: true, data: ['a', 'b'] };
    expect(ok.success).toBe(true);
    expect(ok.data).toEqual(['a', 'b']);
    expect(ok.error).toBeUndefined();
  });

  it('IpcResponse failure shape', () => {
    const err: IpcResponse<never> = { success: false, error: 'Something went wrong' };
    expect(err.success).toBe(false);
    expect(err.error).toBe('Something went wrong');
    expect(err.data).toBeUndefined();
  });

  it('Skill has required id, name, content fields', () => {
    const skill: Skill = {
      id: 'my-skill',
      name: 'My Skill',
      content: '---\nname: My Skill\n---\n# My Skill',
    };
    expect(skill.id).toBe('my-skill');
    expect(skill.name).toBe('My Skill');
    expect(skill.content).toBeTruthy();
  });

  it('Skill frontmatter allows all optional hook types', () => {
    const skill: Skill = {
      id: 'hooked-skill',
      name: 'Hooked Skill',
      content: '',
      frontmatter: {
        name: 'Hooked Skill',
        hooks: {
          PreToolUse: [{ matcher: 'Write|Edit', hooks: [{ type: 'command', command: 'lint' }] }],
          PostToolUse: [{ hooks: [{ type: 'command', command: 'format' }] }],
          Stop: [{ hooks: [{ type: 'command', command: 'cleanup' }] }],
        },
      },
    };
    expect(skill.frontmatter?.hooks?.PreToolUse).toHaveLength(1);
    expect(skill.frontmatter?.hooks?.Stop).toHaveLength(1);
  });
});
