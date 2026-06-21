import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { registerConfigHandlers } from '../configHandlers';

// Use path.join consistently to handle platform-specific separators (Win32 uses backslashes)

// Mock os to control home directory
vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/home/testuser'),
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    lstat: vi.fn(),
    unlink: vi.fn(),
    rm: vi.fn(),
    rename: vi.fn(),
    access: vi.fn(),
  },
}));

import fs from 'fs/promises';

function createMockIpcMain() {
  const handlers: Record<string, Function> = {};
  return {
    handle: (channel: string, fn: Function) => {
      handlers[channel] = fn;
    },
    invoke: async (channel: string, ...args: unknown[]) => {
      const handler = handlers[channel];
      if (!handler) throw new Error(`No handler for channel: ${channel}`);
      return handler({}, ...args);
    },
    handlers,
  };
}

describe('configHandlers', () => {
  let ipc: ReturnType<typeof createMockIpcMain>;
  const HOME = '/home/testuser';

  beforeEach(() => {
    vi.resetAllMocks();
    ipc = createMockIpcMain();
    registerConfigHandlers(ipc as any);
  });

  // ── CONFIG_GET_AGENTS ──────────────────────────────────────────────────────

  describe('config:get-agents', () => {
    it('returns all five known agents', async () => {
      const result = await ipc.invoke('config:get-agents');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(5);
    });

    it('includes Claude Code agent with correct config dir', async () => {
      const result = await ipc.invoke('config:get-agents');
      const claudeAgent = result.data.find((a: any) => a.id === 'claude-code');
      expect(claudeAgent).toBeDefined();
      expect(claudeAgent.configDir).toBe(path.join(HOME, '.claude'));
      expect(claudeAgent.type).toBe('claude-code');
      expect(claudeAgent.name).toBe('Claude Code');
    });

    it('includes Gemini agent with correct config dir', async () => {
      const result = await ipc.invoke('config:get-agents');
      const geminiAgent = result.data.find((a: any) => a.id === 'gemini');
      expect(geminiAgent).toBeDefined();
      expect(geminiAgent.configDir).toBe(path.join(HOME, '.gemini'));
      expect(geminiAgent.type).toBe('gemini');
    });

    it('includes Copilot agent with correct config dir', async () => {
      const result = await ipc.invoke('config:get-agents');
      const copilotAgent = result.data.find((a: any) => a.id === 'copilot');
      expect(copilotAgent).toBeDefined();
      expect(copilotAgent.configDir).toBe(path.join(HOME, '.copilot'));
      expect(copilotAgent.type).toBe('copilot');
    });

    it('includes Codex agent with correct config dir', async () => {
      const result = await ipc.invoke('config:get-agents');
      const codexAgent = result.data.find((a: any) => a.id === 'codex');
      expect(codexAgent).toBeDefined();
      expect(codexAgent.configDir).toBe(path.join(HOME, '.codex'));
      expect(codexAgent.type).toBe('codex');
    });

    it('includes shared agent with correct config dir', async () => {
      const result = await ipc.invoke('config:get-agents');
      const sharedAgent = result.data.find((a: any) => a.id === 'shared');
      expect(sharedAgent).toBeDefined();
      expect(sharedAgent.configDir).toBe(path.join(HOME, '.agents'));
      expect(sharedAgent.type).toBe('shared');
    });

    it('all agents have required fields', async () => {
      const result = await ipc.invoke('config:get-agents');
      for (const agent of result.data) {
        expect(agent.id).toBeDefined();
        expect(agent.name).toBeDefined();
        expect(agent.configDir).toBeDefined();
        expect(agent.type).toBeDefined();
      }
    });
  });

  // ── CONFIG_GET_CLAUDE_SETTINGS ─────────────────────────────────────────────

  describe('config:get-claude-settings', () => {
    it('reads settings.json and returns parsed config', async () => {
      const settings = { model: 'opus', permissions: { allow: ['Bash(*)'] } };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(settings) as any);

      const result = await ipc.invoke('config:get-claude-settings', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(true);
      expect(result.data.data).toEqual(settings);
      expect(result.data.path).toContain('settings.json');
    });

    it('returns not-found config when settings.json does not exist', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readFile).mockRejectedValue(err);

      const result = await ipc.invoke('config:get-claude-settings', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(false);
      expect(result.data.data).toBeNull();
    });

    it('returns error config for malformed JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{malformed json' as any);

      const result = await ipc.invoke('config:get-claude-settings', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(true);
      expect(result.data.data).toBeNull();
      expect(result.data.error).toBeDefined();
    });

    it('reads from correct path: configDir/settings.json', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{}' as any);

      await ipc.invoke('config:get-claude-settings', '/custom/config/dir');
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('/custom/config/dir', 'settings.json'),
        'utf-8'
      );
    });
  });

  // ── CONFIG_SAVE_CLAUDE_SETTINGS ────────────────────────────────────────────

  describe('config:save-claude-settings', () => {
    it('writes settings to settings.json', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const settings = { model: 'sonnet', env: { FOO: 'bar' } };
      const result = await ipc.invoke('config:save-claude-settings', '/home/testuser/.claude', settings);

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/home/testuser/.claude', 'settings.json'),
        JSON.stringify(settings, null, 2),
        'utf-8'
      );
    });

    it('creates parent directories before writing', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const configDir = path.join('/', 'new', 'config', 'dir');
      await ipc.invoke('config:save-claude-settings', configDir, {});
      expect(fs.mkdir).toHaveBeenCalledWith(configDir, { recursive: true });
    });

    it('returns failure when write fails', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      const result = await ipc.invoke('config:save-claude-settings', '/home/testuser/.claude', {});
      expect(result.success).toBe(false);
    });
  });

  // ── CONFIG_GET_GEMINI_SETTINGS ─────────────────────────────────────────────

  describe('config:get-gemini-settings', () => {
    it('reads settings.json and returns parsed Gemini config', async () => {
      const settings = {
        general: { previewFeatures: true, vimMode: false },
        ui: { showMemoryUsage: true },
        experimental: { skills: true },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(settings) as any);

      const result = await ipc.invoke('config:get-gemini-settings', '/home/testuser/.gemini');
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(true);
      expect(result.data.data).toEqual(settings);
    });

    it('returns not-found when settings.json is absent', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readFile).mockRejectedValue(err);

      const result = await ipc.invoke('config:get-gemini-settings', '/home/testuser/.gemini');
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(false);
    });
  });

  // ── CONFIG_SAVE_GEMINI_SETTINGS ────────────────────────────────────────────

  describe('config:save-gemini-settings', () => {
    it('writes Gemini settings to settings.json', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const settings = { general: { vimMode: true }, mcpServers: {} };
      const result = await ipc.invoke('config:save-gemini-settings', '/home/testuser/.gemini', settings);

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/home/testuser/.gemini', 'settings.json'),
        JSON.stringify(settings, null, 2),
        'utf-8'
      );
    });
  });

  // ── CONFIG_GET_COPILOT_CONFIG ──────────────────────────────────────────────

  describe('config:get-copilot-config', () => {
    it('reads config.json and returns parsed Copilot config', async () => {
      const config = {
        model: 'claude-sonnet-4.5',
        theme: 'auto',
        render_markdown: true,
        screen_reader: false,
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(config) as any);

      const result = await ipc.invoke('config:get-copilot-config', '/home/testuser/.copilot');
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(true);
      expect(result.data.data).toEqual(config);
      expect(result.data.path).toContain('config.json');
    });

    it('returns not-found config when config.json does not exist', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readFile).mockRejectedValue(err);

      const result = await ipc.invoke('config:get-copilot-config', '/home/testuser/.copilot');
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(false);
      expect(result.data.data).toBeNull();
    });
  });

  // ── CONFIG_SAVE_COPILOT_CONFIG ─────────────────────────────────────────────

  describe('config:save-copilot-config', () => {
    it('writes Copilot config to config.json', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const config = { model: 'gpt-4o', theme: 'dark' };
      const result = await ipc.invoke('config:save-copilot-config', '/home/testuser/.copilot', config);

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/home/testuser/.copilot', 'config.json'),
        JSON.stringify(config, null, 2),
        'utf-8'
      );
    });
  });

  // ── CONFIG_GET_MCP ─────────────────────────────────────────────────────────

  describe('config:get-mcp', () => {
    it('finds MCP config in mcp-config.json (Copilot format)', async () => {
      const mcpConfig = {
        mcpServers: {
          docker: { type: 'local', command: 'docker', args: ['mcp', 'gateway', 'run'] },
        },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mcpConfig) as any);

      const result = await ipc.invoke('config:get-mcp', '/home/testuser/.copilot', 'copilot');
      expect(result.success).toBe(true);
      expect(result.data.data?.mcpServers).toBeDefined();
      expect(result.data.path).toContain('mcp-config.json');
    });

    it('reads settings.json for gemini agentType', async () => {
      const settingsWithMcp = { mcpServers: { test: { command: 'npx' } } };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(settingsWithMcp) as any);

      const result = await ipc.invoke('config:get-mcp', '/home/testuser/.gemini', 'gemini');
      expect(result.success).toBe(true);
      expect(result.data.data?.mcpServers).toBeDefined();
    });

    it('returns empty MCP config on ENOENT', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readFile).mockRejectedValue(err);

      const result = await ipc.invoke('config:get-mcp', '/home/testuser/.copilot', 'copilot');
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(false);
      expect(result.data.data).toEqual({ mcpServers: {} });
    });

    it('getMcp for claude-code reads ~/.claude.json', async () => {
      const claudeJsonContent = JSON.stringify({
        model: 'claude-3',
        mcpServers: { notion: { type: 'http', url: 'https://mcp.notion.com' } },
      });
      vi.mocked(fs.readFile).mockResolvedValueOnce(claudeJsonContent as never);

      const result = await ipc.invoke('config:get-mcp', '/some/configDir', 'claude-code');
      expect(result.success).toBe(true);
      expect(result.data?.data?.mcpServers).toHaveProperty('notion');
      expect(result.data?.path).toContain('.claude.json');
      expect(result.data?.path).not.toContain('configDir');
    });

    it('getMcp for gemini reads configDir/settings.json', async () => {
      const content = JSON.stringify({
        mcpServers: { myserver: { type: 'stdio', command: 'python' } },
      });
      vi.mocked(fs.readFile).mockResolvedValueOnce(content as never);

      const result = await ipc.invoke('config:get-mcp', '/home/testuser/.gemini', 'gemini');
      expect(result.success).toBe(true);
      expect(result.data?.data?.mcpServers).toHaveProperty('myserver');
    });

    it('getMcp returns empty config on ENOENT', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readFile).mockRejectedValueOnce(err);

      const result = await ipc.invoke('config:get-mcp', '/home/testuser/.copilot', 'copilot');
      expect(result.success).toBe(true);
      expect(result.data?.exists).toBe(false);
      expect(result.data?.data?.mcpServers).toEqual({});
    });
  });

  // ── CONFIG_SAVE_MCP ────────────────────────────────────────────────────────

  describe('config:save-mcp', () => {
    it('creates mcp-config.json for copilot when no existing MCP config found', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readFile).mockRejectedValue(err);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const settings = { mcpServers: { test: { command: 'npx' } } };
      const result = await ipc.invoke('config:save-mcp', '/home/testuser/.copilot', 'copilot', settings);

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('mcp-config.json'),
        expect.stringContaining('"mcpServers"'),
        'utf-8'
      );
    });

    it('merges MCP settings with existing file content', async () => {
      const existingContent = { model: 'opus', mcpServers: { old: { command: 'old' } } };
      const newSettings = { mcpServers: { new: { command: 'new' } } };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingContent) as any);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const result = await ipc.invoke('config:save-mcp', '/home/testuser/.copilot', 'copilot', newSettings);
      expect(result.success).toBe(true);

      const writtenContent = JSON.parse(
        (vi.mocked(fs.writeFile).mock.calls[0][1] as string)
      );
      // Should merge: keep model, apply new mcpServers
      expect(writtenContent.model).toBe('opus');
      expect(writtenContent.mcpServers).toEqual(newSettings.mcpServers);
    });

    it('saveMcp for claude-code preserves existing keys', async () => {
      const existing = JSON.stringify({ model: 'claude-3', permissions: { allow: ['*'] } });
      vi.mocked(fs.readFile).mockResolvedValueOnce(existing as never);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      await ipc.invoke(
        'config:save-mcp',
        '/ignored',
        'claude-code',
        { mcpServers: { test: { type: 'http', url: 'https://x.com' } } }
      );

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const written = JSON.parse(writeCall[1] as string);
      expect(written.model).toBe('claude-3');
      expect(written.permissions).toEqual({ allow: ['*'] });
      expect(written.mcpServers).toHaveProperty('test');
    });

    it('saveMcp returns error when file is malformed JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce('not valid json {{{' as never);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const result = await ipc.invoke(
        'config:save-mcp',
        '/ignored',
        'claude-code',
        { mcpServers: {} }
      );
      expect(result.success).toBe(false);
    });
  });

  // ── CONFIG_GET_SKILLS ──────────────────────────────────────────────────────

  describe('config:get-skills', () => {
    it('returns empty array when skills directory does not exist', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readdir).mockRejectedValue(err);

      const result = await ipc.invoke('config:get-skills', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('reads skills from folders in the skills directory', async () => {
      const skillContent = `---
name: My Skill
version: "1.0.0"
description: A test skill
user-invocable: true
---

# My Skill

Skill instructions here.`;

      vi.mocked(fs.readdir).mockResolvedValue(['my-skill'] as any);
      vi.mocked(fs.lstat).mockResolvedValue({ isDirectory: () => true, isSymbolicLink: () => false } as any);
      vi.mocked(fs.readFile).mockResolvedValue(skillContent as any);

      const result = await ipc.invoke('config:get-skills', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('my-skill');
      expect(result.data[0].name).toBe('My Skill');
      expect(result.data[0].description).toBe('A test skill');
      expect(result.data[0].version).toBe('1.0.0');
      expect(result.data[0].userInvocable).toBe(true);
    });

    it('skips non-directory entries in skills folder', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['file.txt', 'skill-folder'] as any);
      vi.mocked(fs.lstat)
        .mockResolvedValueOnce({ isDirectory: () => false, isSymbolicLink: () => false } as any) // file.txt
        .mockResolvedValueOnce({ isDirectory: () => true, isSymbolicLink: () => false } as any);  // skill-folder

      const skillContent = '---\nname: A Skill\ndescription: desc\n---\n# A Skill';
      vi.mocked(fs.readFile).mockResolvedValue(skillContent as any);

      const result = await ipc.invoke('config:get-skills', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('skill-folder');
    });

    it('uses folder name as skill name when frontmatter name is absent', async () => {
      const contentWithoutName = '# Skill Without Frontmatter\n\nSome content.';
      vi.mocked(fs.readdir).mockResolvedValue(['unnamed-skill'] as any);
      vi.mocked(fs.lstat).mockResolvedValue({ isDirectory: () => true, isSymbolicLink: () => false } as any);
      vi.mocked(fs.readFile).mockResolvedValue(contentWithoutName as any);

      const result = await ipc.invoke('config:get-skills', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data[0].id).toBe('unnamed-skill');
      expect(result.data[0].name).toBe('unnamed-skill');
    });

    it('skips skills whose SKILL.md cannot be read', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['bad-skill', 'good-skill'] as any);
      vi.mocked(fs.lstat).mockResolvedValue({ isDirectory: () => true, isSymbolicLink: () => false } as any);
      vi.mocked(fs.readFile)
        .mockRejectedValueOnce(new Error('Cannot read'))   // bad-skill SKILL.md
        .mockResolvedValue('---\nname: Good\ndescription: Good skill\n---\n# Good' as any);

      const result = await ipc.invoke('config:get-skills', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('good-skill');
    });
  });

  // ── CONFIG_SAVE_SKILL ──────────────────────────────────────────────────────

  describe('config:save-skill', () => {
    it('writes skill to correct path in skills directory', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const skill = {
        id: 'my-skill',
        name: 'My Skill',
        content: '---\nname: My Skill\n---\n# My Skill',
      };
      const result = await ipc.invoke('config:save-skill', '/home/testuser/.claude', skill);

      expect(result.success).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('/home/testuser/.claude', 'skills', 'my-skill'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/home/testuser/.claude', 'skills', 'my-skill', 'SKILL.md'),
        skill.content,
        'utf-8'
      );
    });
  });

  // ── CONFIG_DELETE_SKILL ────────────────────────────────────────────────────

  describe('config:delete-skill', () => {
    it('removes skill directory recursively', async () => {
      vi.mocked(fs.rm).mockResolvedValue(undefined as any);

      const result = await ipc.invoke('config:delete-skill', '/home/testuser/.claude', 'my-skill');
      expect(result.success).toBe(true);
      expect(fs.rm).toHaveBeenCalledWith(
        path.join('/home/testuser/.claude', 'skills', 'my-skill'),
        { recursive: true, force: true }
      );
    });

    it('returns failure when rm fails', async () => {
      vi.mocked(fs.rm).mockRejectedValue(new Error('Cannot remove'));

      const result = await ipc.invoke('config:delete-skill', '/home/testuser/.claude', 'bad-skill');
      expect(result.success).toBe(false);
    });
  });

  // ── CONFIG_GET_MARKDOWN ────────────────────────────────────────────────────

  describe('config:get-markdown', () => {
    it('reads and returns markdown file content', async () => {
      const content = '# Instructions\n\nSome global instructions.';
      vi.mocked(fs.readFile).mockResolvedValue(content as any);

      const result = await ipc.invoke('config:get-markdown', '/home/testuser/.claude/CLAUDE.md');
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(true);
      expect(result.data.data).toBe(content);
      expect(result.data.path).toBe('/home/testuser/.claude/CLAUDE.md');
    });

    it('returns not-found config when file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await ipc.invoke('config:get-markdown', '/home/testuser/.claude/CLAUDE.md');
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(false);
      expect(result.data.data).toBeNull();
    });

    it('handles empty markdown file', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('' as any);

      const result = await ipc.invoke('config:get-markdown', '/home/testuser/.gemini/GEMINI.md');
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(true);
      expect(result.data.data).toBe('');
    });
  });

  // ── CONFIG_SAVE_MARKDOWN ───────────────────────────────────────────────────

  describe('config:save-markdown', () => {
    it('creates parent directories and writes markdown content', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const content = '# My Instructions\n\nDo this and that.';
      const result = await ipc.invoke(
        'config:save-markdown',
        '/home/testuser/.claude/CLAUDE.md',
        content
      );

      expect(result.success).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith('/home/testuser/.claude', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/home/testuser/.claude/CLAUDE.md',
        content,
        'utf-8'
      );
    });

    it('returns failure when write fails', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Read-only filesystem'));

      const result = await ipc.invoke('config:save-markdown', '/read-only/CLAUDE.md', '# Test');
      expect(result.success).toBe(false);
    });
  });

  // ── CONFIG_GET_GEMINI_EXTENSIONS ───────────────────────────────────────────

  describe('config:get-gemini-extensions', () => {
    it('returns empty when extensions directory does not exist', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readdir).mockRejectedValue(err);

      const result = await ipc.invoke('config:get-gemini-extensions', '/home/testuser/.gemini');
      expect(result.success).toBe(true);
      expect(result.data.extensions).toEqual([]);
    });

    it('reads extension manifests from subfolders', async () => {
      const manifest = {
        name: 'context7',
        version: '1.0.0',
        description: 'Up-to-date code docs',
        mcpServers: { context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] } },
      };
      const enablement = { context7: { overrides: ['/home/testuser/*'] } };

      vi.mocked(fs.readdir).mockResolvedValue(['context7', 'extension-enablement.json'] as any);
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ isDirectory: () => true } as any)   // context7 folder
        .mockRejectedValueOnce(new Error('not dir')); // extension-enablement.json - not dir, skip
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(enablement) as any)   // extension-enablement.json
        .mockResolvedValueOnce(JSON.stringify(manifest) as any);    // gemini-extension.json

      const result = await ipc.invoke('config:get-gemini-extensions', '/home/testuser/.gemini');
      expect(result.success).toBe(true);
    });
  });

  // ── CONFIG_GET_CLAUDE_PLUGINS ──────────────────────────────────────────────

  describe('config:get-claude-plugins', () => {
    it('returns plugins with enabled state from settings.json', async () => {
      const installedPlugins = {
        version: 2,
        plugins: {
          'context7@claude-plugins-official': [
            {
              scope: 'user',
              installPath: '/path/to/context7',
              version: '8deab84',
              installedAt: '2026-01-01T00:00:00Z',
              lastUpdated: '2026-01-01T00:00:00Z',
            },
          ],
        },
      };
      const settings = {
        enabledPlugins: { 'context7@claude-plugins-official': true },
      };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(installedPlugins) as any) // installed_plugins.json
        .mockResolvedValueOnce(JSON.stringify(settings) as any);        // settings.json

      const result = await ipc.invoke('config:get-claude-plugins', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('context7@claude-plugins-official');
      expect(result.data[0].name).toBe('context7');
      expect(result.data[0].marketplace).toBe('claude-plugins-official');
      expect(result.data[0].enabled).toBe(true);
      expect(result.data[0].scope).toBe('user');
    });

    it('returns empty array when installed_plugins.json does not exist', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readFile).mockRejectedValue(err);

      const result = await ipc.invoke('config:get-claude-plugins', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('marks plugins as disabled when not in enabledPlugins', async () => {
      const installedPlugins = {
        version: 2,
        plugins: {
          'github@claude-plugins-official': [
            {
              scope: 'user',
              installPath: '/path/to/github',
              version: '1.0.0',
              installedAt: '2026-01-01T00:00:00Z',
              lastUpdated: '2026-01-01T00:00:00Z',
            },
          ],
        },
      };
      const settings = {
        enabledPlugins: { 'github@claude-plugins-official': false },
      };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(installedPlugins) as any)
        .mockResolvedValueOnce(JSON.stringify(settings) as any);

      const result = await ipc.invoke('config:get-claude-plugins', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data[0].enabled).toBe(false);
    });

    it('handles multiple installs of the same plugin', async () => {
      const installedPlugins = {
        version: 2,
        plugins: {
          'claude-mem@thedotmack': [
            {
              scope: 'user',
              installPath: '/user/install',
              version: '7.4.1',
              installedAt: '2026-01-01T00:00:00Z',
              lastUpdated: '2026-01-01T00:00:00Z',
            },
            {
              scope: 'project',
              projectPath: '/some/project',
              installPath: '/project/install',
              version: '7.4.1',
              installedAt: '2026-01-02T00:00:00Z',
              lastUpdated: '2026-01-02T00:00:00Z',
            },
          ],
        },
      };
      const settings = { enabledPlugins: {} };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(installedPlugins) as any)
        .mockResolvedValueOnce(JSON.stringify(settings) as any);

      const result = await ipc.invoke('config:get-claude-plugins', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].scope).toBe('user');
      expect(result.data[1].scope).toBe('project');
      expect(result.data[1].projectPath).toBe('/some/project');
    });
  });

  // ── CONFIG_DELETE_PLUGIN ──────────────────────────────────────────────────

  describe('config:delete-plugin', () => {
    it('removes plugin install entry and deletes install folder', async () => {
      const INSTALL_PATH = path.join(HOME, '.claude', 'plugins', 'context7');
      const installedPlugins = {
        version: 2,
        plugins: {
          'context7@official': [
            {
              scope: 'user',
              installPath: INSTALL_PATH,
              version: '1.0.0',
              installedAt: '2026-01-01T00:00:00Z',
              lastUpdated: '2026-01-01T00:00:00Z',
            },
          ],
        },
      };
      const settings = {
        enabledPlugins: { 'context7@official': true },
      };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(installedPlugins) as any)  // installed_plugins.json
        .mockResolvedValueOnce(JSON.stringify(settings) as any);         // settings.json
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      const result = await ipc.invoke(
        'config:delete-plugin',
        path.join(HOME, '.claude'),
        'context7@official',
        INSTALL_PATH
      );
      expect(result.success).toBe(true);
      expect(fs.rm).toHaveBeenCalledWith(INSTALL_PATH, { recursive: true, force: true });
      // Should have written updated installed_plugins.json (plugin removed)
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('keeps other installs when deleting one of multiple', async () => {
      const USER_INSTALL = path.join(HOME, '.claude', 'plugins', 'user-install');
      const PROJECT_INSTALL = path.join(HOME, '.claude', 'plugins', 'project-install');
      const installedPlugins = {
        version: 2,
        plugins: {
          'myplugin@official': [
            {
              scope: 'user',
              installPath: USER_INSTALL,
              version: '1.0.0',
              installedAt: '2026-01-01T00:00:00Z',
              lastUpdated: '2026-01-01T00:00:00Z',
            },
            {
              scope: 'project',
              installPath: PROJECT_INSTALL,
              version: '1.0.0',
              installedAt: '2026-01-01T00:00:00Z',
              lastUpdated: '2026-01-01T00:00:00Z',
            },
          ],
        },
      };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(installedPlugins) as any); // installed_plugins.json
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      const result = await ipc.invoke(
        'config:delete-plugin',
        path.join(HOME, '.claude'),
        'myplugin@official',
        USER_INSTALL
      );
      expect(result.success).toBe(true);
      // Should have written back with the project install still present
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const written = JSON.parse(writeCall[1] as string);
      expect(written.plugins['myplugin@official']).toHaveLength(1);
      expect(written.plugins['myplugin@official'][0].installPath).toBe(PROJECT_INSTALL);
    });

    it('returns failure when fs.rm throws', async () => {
      const INSTALL_PATH = path.join(HOME, '.local', 'share', 'bad-plugin');
      const installedPlugins = { version: 2, plugins: {} };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(installedPlugins) as any);
      vi.mocked(fs.rm).mockRejectedValue(new Error('Permission denied'));

      const result = await ipc.invoke(
        'config:delete-plugin',
        path.join(HOME, '.claude'),
        'badplugin@official',
        INSTALL_PATH
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });

  // ── CONFIG_DELETE_GEMINI_EXTENSION ────────────────────────────────────────

  describe('config:delete-gemini-extension', () => {
    it('removes enablement entry and deletes extension folder', async () => {
      const enablement = { 'my-ext': { overrides: [] } };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(enablement) as any); // extension-enablement.json
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      const result = await ipc.invoke(
        'config:delete-gemini-extension',
        '/home/testuser/.gemini',
        'my-ext'
      );
      expect(result.success).toBe(true);
      expect(fs.rm).toHaveBeenCalledWith(
        path.join('/home/testuser/.gemini', 'extensions', 'my-ext'),
        { recursive: true, force: true }
      );
      // Should have written updated enablement (entry removed)
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const written = JSON.parse(writeCall[1] as string);
      expect(written).not.toHaveProperty('my-ext');
    });

    it('deletes folder even when extension not in enablement', async () => {
      const enablement = { 'other-ext': {} };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(enablement) as any);
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      const result = await ipc.invoke(
        'config:delete-gemini-extension',
        '/home/testuser/.gemini',
        'my-ext'
      );
      expect(result.success).toBe(true);
      expect(fs.rm).toHaveBeenCalledWith(
        path.join('/home/testuser/.gemini', 'extensions', 'my-ext'),
        { recursive: true, force: true }
      );
      // enablement should not have been modified (no writeFile for enablement)
    });

    it('returns failure when fs.rm throws', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify({}) as any);
      vi.mocked(fs.rm).mockRejectedValue(new Error('EPERM'));

      const result = await ipc.invoke(
        'config:delete-gemini-extension',
        '/home/testuser/.gemini',
        'bad-ext'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('EPERM');
    });
  });

  // ── CONFIG_CREATE_RULE ─────────────────────────────────────────────────────

  describe('config:create-rule', () => {
    it('creates a top-level rule file at rules/<rule>.md', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await ipc.invoke(
        'config:create-rule',
        path.join(HOME, '.claude'),
        'my-rule.md'
      );
      expect(result.success).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(HOME, '.claude', 'rules'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(HOME, '.claude', 'rules', 'my-rule.md'),
        '',
        'utf-8'
      );
    });

    it('creates folder and file at rules/<folder>/<rule>.md', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await ipc.invoke(
        'config:create-rule',
        path.join(HOME, '.claude'),
        'common/agents.md'
      );
      expect(result.success).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(HOME, '.claude', 'rules', 'common'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(HOME, '.claude', 'rules', 'common', 'agents.md'),
        '',
        'utf-8'
      );
    });

    it('rejects path traversal in rulePath', async () => {
      const result = await ipc.invoke(
        'config:create-rule',
        path.join(HOME, '.claude'),
        '../../../etc/passwd'
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid/i);
    });

    it('rejects more than one folder level', async () => {
      const result = await ipc.invoke(
        'config:create-rule',
        path.join(HOME, '.claude'),
        'a/b/c.md'
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid|one level/i);
    });

    it('rejects empty rulePath', async () => {
      const result = await ipc.invoke(
        'config:create-rule',
        path.join(HOME, '.claude'),
        ''
      );
      expect(result.success).toBe(false);
    });

    it('rejects folder component containing ..', async () => {
      const result = await ipc.invoke(
        'config:create-rule',
        path.join(HOME, '.claude'),
        '../secrets.md'
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid/i);
    });

    it('returns failure when fs.writeFile throws', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('ENOSPC'));

      const result = await ipc.invoke(
        'config:create-rule',
        path.join(HOME, '.claude'),
        'my-rule.md'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOSPC');
    });
  });

  // ── CONFIG_DELETE_RULE_FOLDER ──────────────────────────────────────────────

  describe('config:delete-rule-folder', () => {
    it('removes the rules folder recursively', async () => {
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      const result = await ipc.invoke(
        'config:delete-rule-folder',
        path.join(HOME, '.claude'),
        'common'
      );
      expect(result.success).toBe(true);
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(HOME, '.claude', 'rules', 'common'),
        { recursive: true, force: true }
      );
    });

    it('rejects folder name containing ..', async () => {
      const result = await ipc.invoke(
        'config:delete-rule-folder',
        path.join(HOME, '.claude'),
        '../secrets'
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid|access denied/i);
    });

    it('rejects empty folder name', async () => {
      const result = await ipc.invoke(
        'config:delete-rule-folder',
        path.join(HOME, '.claude'),
        ''
      );
      expect(result.success).toBe(false);
    });

    it('returns failure when fs.rm throws', async () => {
      vi.mocked(fs.rm).mockRejectedValue(new Error('EPERM'));

      const result = await ipc.invoke(
        'config:delete-rule-folder',
        path.join(HOME, '.claude'),
        'common'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('EPERM');
    });
  });

  // ── CONFIG_GET_SUBAGENTS ───────────────────────────────────────────────────

  describe('config:get-subagents', () => {
    const COPILOT_DIR = path.join(HOME, '.copilot');
    const SUBAGENTS_DIR = path.join(COPILOT_DIR, 'subagents');

    it('returns empty array when subagents directory does not exist', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readdir).mockRejectedValue(err);

      const result = await ipc.invoke('config:get-subagents', COPILOT_DIR);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('returns subagent files with .agent.md extension', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['coder.agent.md', 'reviewer.agent.md'] as any);
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ isFile: () => true, isDirectory: () => false } as any)
        .mockResolvedValueOnce({ isFile: () => true, isDirectory: () => false } as any);

      const result = await ipc.invoke('config:get-subagents', COPILOT_DIR);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('coder');
      expect(result.data[0].name).toBe('coder');
      expect(result.data[0].path).toBe(path.join(SUBAGENTS_DIR, 'coder.agent.md'));
      expect(result.data[1].id).toBe('reviewer');
    });

    it('skips files that do not end in .agent.md', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['coder.agent.md', 'readme.md', 'notes.txt'] as any);
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ isFile: () => true, isDirectory: () => false } as any);

      const result = await ipc.invoke('config:get-subagents', COPILOT_DIR);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('coder');
    });

    it('skips directories even if named *.agent.md', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['weird.agent.md'] as any);
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ isFile: () => false, isDirectory: () => true } as any);

      const result = await ipc.invoke('config:get-subagents', COPILOT_DIR);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  // ── CONFIG_CREATE_SUBAGENT ─────────────────────────────────────────────────

  describe('config:create-subagent', () => {
    const COPILOT_DIR = path.join(HOME, '.copilot');
    const SUBAGENTS_DIR = path.join(COPILOT_DIR, 'subagents');

    it('creates subagents dir and agent file', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await ipc.invoke('config:create-subagent', COPILOT_DIR, 'coder');
      expect(result.success).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(SUBAGENTS_DIR, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(SUBAGENTS_DIR, 'coder.agent.md'),
        '',
        'utf-8'
      );
      expect(result.data).toBe(path.join(SUBAGENTS_DIR, 'coder.agent.md'));
    });

    it('rejects empty name', async () => {
      const result = await ipc.invoke('config:create-subagent', COPILOT_DIR, '');
      expect(result.success).toBe(false);
    });

    it('rejects name containing path separators', async () => {
      const result = await ipc.invoke('config:create-subagent', COPILOT_DIR, 'foo/bar');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid/i);
    });

    it('rejects name containing ..', async () => {
      const result = await ipc.invoke('config:create-subagent', COPILOT_DIR, '../secrets');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid/i);
    });

    it('returns failure when fs.writeFile throws', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('ENOSPC'));

      const result = await ipc.invoke('config:create-subagent', COPILOT_DIR, 'coder');
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOSPC');
    });
  });

  // ── CONFIG_DELETE_SUBAGENT ─────────────────────────────────────────────────

  describe('config:delete-subagent', () => {
    const COPILOT_DIR = path.join(HOME, '.copilot');
    const SUBAGENTS_DIR = path.join(COPILOT_DIR, 'subagents');

    it('deletes the agent file', async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      const result = await ipc.invoke('config:delete-subagent', COPILOT_DIR, 'coder');
      expect(result.success).toBe(true);
      expect(fs.unlink).toHaveBeenCalledWith(path.join(SUBAGENTS_DIR, 'coder.agent.md'));
    });

    it('rejects empty name', async () => {
      const result = await ipc.invoke('config:delete-subagent', COPILOT_DIR, '');
      expect(result.success).toBe(false);
    });

    it('rejects name with path traversal', async () => {
      const result = await ipc.invoke('config:delete-subagent', COPILOT_DIR, '../evil');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid/i);
    });

    it('returns failure when fs.unlink throws', async () => {
      vi.mocked(fs.unlink).mockRejectedValue(new Error('ENOENT'));

      const result = await ipc.invoke('config:delete-subagent', COPILOT_DIR, 'coder');
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });
  });

  // ── CONFIG_RENAME_SUBAGENT ─────────────────────────────────────────────────

  describe('config:rename-subagent', () => {
    const COPILOT_DIR = path.join(HOME, '.copilot');
    const SUBAGENTS_DIR = path.join(COPILOT_DIR, 'subagents');

    it('renames the .agent.md file to the new name', async () => {
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      const result = await ipc.invoke('config:rename-subagent', COPILOT_DIR, 'coder', 'senior-coder');
      expect(result.success).toBe(true);
      expect(fs.rename).toHaveBeenCalledWith(
        path.join(SUBAGENTS_DIR, 'coder.agent.md'),
        path.join(SUBAGENTS_DIR, 'senior-coder.agent.md')
      );
      expect(result.data).toBe(path.join(SUBAGENTS_DIR, 'senior-coder.agent.md'));
    });

    it('rejects empty old name', async () => {
      const result = await ipc.invoke('config:rename-subagent', COPILOT_DIR, '', 'new-name');
      expect(result.success).toBe(false);
    });

    it('rejects empty new name', async () => {
      const result = await ipc.invoke('config:rename-subagent', COPILOT_DIR, 'coder', '');
      expect(result.success).toBe(false);
    });

    it('rejects new name with path traversal', async () => {
      const result = await ipc.invoke('config:rename-subagent', COPILOT_DIR, 'coder', '../evil');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid/i);
    });

    it('returns failure when fs.rename throws', async () => {
      vi.mocked(fs.rename).mockRejectedValue(new Error('EEXIST'));

      const result = await ipc.invoke('config:rename-subagent', COPILOT_DIR, 'coder', 'reviewer');
      expect(result.success).toBe(false);
      expect(result.error).toContain('EEXIST');
    });
  });

  // ── CONFIG_RENAME_RULE ─────────────────────────────────────────────────────

  describe('config:rename-rule', () => {
    const CLAUDE_DIR = path.join(HOME, '.claude');

    it('renames the rule file to the new filename', async () => {
      const filePath = path.join(CLAUDE_DIR, 'rules', 'common', 'agents.md');
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      const result = await ipc.invoke('config:rename-rule', filePath, 'agent-rules.md');
      expect(result.success).toBe(true);
      expect(fs.rename).toHaveBeenCalledWith(
        filePath,
        path.join(CLAUDE_DIR, 'rules', 'common', 'agent-rules.md')
      );
      expect(result.data).toBe(path.join(CLAUDE_DIR, 'rules', 'common', 'agent-rules.md'));
    });

    it('rejects new name without .md extension', async () => {
      const filePath = path.join(CLAUDE_DIR, 'rules', 'agents.md');
      const result = await ipc.invoke('config:rename-rule', filePath, 'agents');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/\.md/);
    });

    it('rejects new name with path separators', async () => {
      const filePath = path.join(CLAUDE_DIR, 'rules', 'agents.md');
      const result = await ipc.invoke('config:rename-rule', filePath, 'other/agents.md');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid/i);
    });

    it('rejects empty new name', async () => {
      const filePath = path.join(CLAUDE_DIR, 'rules', 'agents.md');
      const result = await ipc.invoke('config:rename-rule', filePath, '');
      expect(result.success).toBe(false);
    });

    it('returns failure when fs.rename throws', async () => {
      const filePath = path.join(CLAUDE_DIR, 'rules', 'agents.md');
      vi.mocked(fs.rename).mockRejectedValue(new Error('EACCES'));

      const result = await ipc.invoke('config:rename-rule', filePath, 'new-agents.md');
      expect(result.success).toBe(false);
      expect(result.error).toContain('EACCES');
    });
  });

  describe('config:get-sessions (copilot old-format .jsonl files)', () => {
    it('includes old-format .jsonl files as sessions', async () => {
      const uuid = 'abcdef12-0000-0000-0000-000000000001';
      vi.mocked(fs.readdir).mockResolvedValue([`${uuid}.jsonl`] as any);
      vi.mocked(fs.stat).mockImplementation(async (p: any) => {
        if (String(p).endsWith('.jsonl')) {
          return { isDirectory: () => false, isFile: () => true, mtimeMs: 1000 } as any;
        }
        throw new Error('ENOENT');
      });
      const result = await ipc.invoke('config:get-sessions', path.join(HOME, '.copilot'), 'copilot');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(uuid);
      expect(result.data[0].path).toContain(`${uuid}.jsonl`);
      expect(result.data[0].agentType).toBe('copilot');
    });

    it('includes both directory sessions and old-format .jsonl sessions', async () => {
      const uuidDir = 'abcdef12-0000-0000-0000-000000000002';
      const uuidFile = 'abcdef12-0000-0000-0000-000000000003';
      vi.mocked(fs.readdir).mockResolvedValue([uuidDir, `${uuidFile}.jsonl`] as any);
      vi.mocked(fs.stat).mockImplementation(async (p: any) => {
        const s = String(p);
        if (s.endsWith('.jsonl')) {
          return { isDirectory: () => false, isFile: () => true, mtimeMs: 2000 } as any;
        }
        if (s.endsWith(uuidDir)) {
          return { isDirectory: () => true, isFile: () => false, mtimeMs: 1000 } as any;
        }
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      const result = await ipc.invoke('config:get-sessions', path.join(HOME, '.copilot'), 'copilot');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      const ids = result.data.map((s: any) => s.id);
      expect(ids).toContain(uuidDir);
      expect(ids).toContain(uuidFile);
    });

    it('ignores non-.jsonl files in session-state', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['README.txt', 'some-file.json'] as any);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true, mtimeMs: 1000 } as any);
      const result = await ipc.invoke('config:get-sessions', path.join(HOME, '.copilot'), 'copilot');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('config:get-copilot-session-events', () => {
    it('reads events from a .jsonl file path (old format)', async () => {
      const filePath = path.join(HOME, '.copilot', 'session-state', 'abc123.jsonl');
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, isDirectory: () => false } as any);
      const jsonlContent = [
        JSON.stringify({ role: 'user', content: 'Hello' }),
        JSON.stringify({ role: 'assistant', content: 'Hi there' }),
        'invalid-line',
      ].join('\n');
      vi.mocked(fs.readFile).mockResolvedValue(jsonlContent as any);

      const result = await ipc.invoke('config:get-copilot-session-events', filePath);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ role: 'user', text: 'Hello' });
      expect(result.data[1]).toEqual({ role: 'assistant', text: 'Hi there' });
    });

    it('reads events.jsonl from a directory path (new format)', async () => {
      const dirPath = path.join(HOME, '.copilot', 'session-state', 'abc-dir');
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => false, isDirectory: () => true } as any);
      const jsonlContent = [
        JSON.stringify({ role: 'user', text: 'Question?' }),
        JSON.stringify({ role: 'assistant', text: 'Answer.' }),
      ].join('\n');
      vi.mocked(fs.readFile).mockResolvedValue(jsonlContent as any);

      const result = await ipc.invoke('config:get-copilot-session-events', dirPath);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ role: 'user', text: 'Question?' });
    });

    it('returns empty array for malformed JSONL', async () => {
      const filePath = path.join(HOME, '.copilot', 'session-state', 'bad.jsonl');
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, isDirectory: () => false } as any);
      vi.mocked(fs.readFile).mockResolvedValue('not-json\nalso-not-json\n' as any);

      const result = await ipc.invoke('config:get-copilot-session-events', filePath);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('rejects path traversal attempts', async () => {
      const result = await ipc.invoke('config:get-copilot-session-events', '/etc/passwd');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/outside/i);
    });

    it('handles entries with content field instead of text', async () => {
      const filePath = path.join(HOME, '.copilot', 'session-state', 'abc.jsonl');
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, isDirectory: () => false } as any);
      const jsonlContent = [
        JSON.stringify({ role: 'user', content: 'Using content field' }),
      ].join('\n');
      vi.mocked(fs.readFile).mockResolvedValue(jsonlContent as any);

      const result = await ipc.invoke('config:get-copilot-session-events', filePath);
      expect(result.success).toBe(true);
      expect(result.data[0].text).toBe('Using content field');
    });

    it('returns empty array when file is empty', async () => {
      const filePath = path.join(HOME, '.copilot', 'session-state', 'empty.jsonl');
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, isDirectory: () => false } as any);
      vi.mocked(fs.readFile).mockResolvedValue('' as any);

      const result = await ipc.invoke('config:get-copilot-session-events', filePath);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('parses actual Copilot format: type=user.message with data.content', async () => {
      const filePath = path.join(HOME, '.copilot', 'session-state', 'real.jsonl');
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, isDirectory: () => false } as any);
      const jsonlContent = [
        JSON.stringify({ type: 'user.message', data: { content: 'Hello Copilot' } }),
        JSON.stringify({ type: 'assistant.message', data: { content: 'Hello! How can I help?' } }),
      ].join('\n');
      vi.mocked(fs.readFile).mockResolvedValue(jsonlContent as any);

      const result = await ipc.invoke('config:get-copilot-session-events', filePath);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({ role: 'user', text: 'Hello Copilot' });
      expect(result.data[1]).toEqual({ role: 'assistant', text: 'Hello! How can I help?' });
    });

    it('skips entries where data.content is empty string', async () => {
      const filePath = path.join(HOME, '.copilot', 'session-state', 'empty-content.jsonl');
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, isDirectory: () => false } as any);
      const jsonlContent = [
        JSON.stringify({ type: 'user.message', data: { content: '' } }),
        JSON.stringify({ type: 'assistant.message', data: { content: 'Valid response' } }),
        JSON.stringify({ type: 'user.message', data: { content: 'Non-empty' } }),
      ].join('\n');
      vi.mocked(fs.readFile).mockResolvedValue(jsonlContent as any);

      const result = await ipc.invoke('config:get-copilot-session-events', filePath);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].text).toBe('Valid response');
      expect(result.data[1].text).toBe('Non-empty');
    });

    it('skips non-message type entries (e.g. tool calls, metadata)', async () => {
      const filePath = path.join(HOME, '.copilot', 'session-state', 'mixed.jsonl');
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, isDirectory: () => false } as any);
      const jsonlContent = [
        JSON.stringify({ type: 'session.start', data: {} }),
        JSON.stringify({ type: 'user.message', data: { content: 'A question' } }),
        JSON.stringify({ type: 'tool.call', data: { name: 'read_file' } }),
        JSON.stringify({ type: 'assistant.message', data: { content: 'An answer' } }),
        JSON.stringify({ type: 'session.end', data: {} }),
      ].join('\n');
      vi.mocked(fs.readFile).mockResolvedValue(jsonlContent as any);

      const result = await ipc.invoke('config:get-copilot-session-events', filePath);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].role).toBe('user');
      expect(result.data[1].role).toBe('assistant');
    });
  });

  // ── CONFIG_GET_GEMINI_SESSIONS ─────────────────────────────────────────────

  describe('config:get-gemini-sessions', () => {
    it('returns empty array when tmp dir does not exist', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readdir).mockRejectedValue(err);

      const result = await ipc.invoke('config:get-gemini-sessions', path.join(HOME, '.gemini'));
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('returns parsed session entries from valid JSON files', async () => {
      const sessionJson = {
        sessionId: 'session-uuid-1',
        projectHash: 'proj-hash-1',
        startTime: '2026-01-06T14:11:00.829Z',
        lastUpdated: '2026-01-06T14:11:21.791Z',
        messages: [
          { id: '1', type: 'user', content: 'hello', timestamp: '2026-01-06T14:11:01Z' },
          { id: '2', type: 'assistant', content: 'hi', timestamp: '2026-01-06T14:11:02Z' },
        ],
      };

      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['hash-dir'] as any)     // baseDir (tmp)
        .mockResolvedValueOnce(['session.json'] as any) // chatsDir
        .mockRejectedValueOnce(new Error('ENOENT'));    // history scan

      vi.mocked(fs.stat)
        .mockResolvedValue({ mtimeMs: 1704555060829 } as any);

      vi.mocked(fs.readFile)
        .mockResolvedValue(JSON.stringify(sessionJson) as any);

      const result = await ipc.invoke('config:get-gemini-sessions', path.join(HOME, '.gemini'));
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].sessionId).toBe('session-uuid-1');
      expect(result.data[0].projectHash).toBe('proj-hash-1');
      expect(result.data[0].messageCount).toBe(2);
    });

    it('skips malformed JSON files gracefully', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['hash-dir'] as any)
        .mockResolvedValueOnce(['bad.json', 'good.json'] as any)
        .mockRejectedValueOnce(new Error('ENOENT')); // history

      const goodSession = {
        sessionId: 'good-session',
        projectHash: 'hash',
        startTime: '2026-01-06T14:00:00Z',
        messages: [],
      };

      vi.mocked(fs.readFile)
        .mockRejectedValueOnce(new Error('Invalid JSON')) // bad.json
        .mockResolvedValueOnce(JSON.stringify(goodSession) as any); // good.json

      vi.mocked(fs.stat)
        .mockResolvedValue({ mtimeMs: 1704555060829 } as any);

      const result = await ipc.invoke('config:get-gemini-sessions', path.join(HOME, '.gemini'));
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].sessionId).toBe('good-session');
    });

    it('sorts sessions by startTime descending (newest first)', async () => {
      const session1 = {
        sessionId: 'session-1',
        projectHash: 'hash1',
        startTime: '2026-01-06T10:00:00Z',
        messages: [],
      };
      const session2 = {
        sessionId: 'session-2',
        projectHash: 'hash2',
        startTime: '2026-01-06T14:00:00Z',
        messages: [],
      };
      const session3 = {
        sessionId: 'session-3',
        projectHash: 'hash3',
        startTime: '2026-01-06T12:00:00Z',
        messages: [],
      };

      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['h1', 'h2', 'h3'] as any)
        .mockResolvedValueOnce(['s1.json'] as any)
        .mockResolvedValueOnce(['s2.json'] as any)
        .mockResolvedValueOnce(['s3.json'] as any)
        .mockRejectedValueOnce(new Error('ENOENT')); // history

      vi.mocked(fs.stat)
        .mockResolvedValue({ mtimeMs: 1704555060829 } as any);

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(session1) as any)
        .mockResolvedValueOnce(JSON.stringify(session2) as any)
        .mockResolvedValueOnce(JSON.stringify(session3) as any);

      const result = await ipc.invoke('config:get-gemini-sessions', path.join(HOME, '.gemini'));
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data[0].sessionId).toBe('session-2'); // newest (14:00:00)
      expect(result.data[1].sessionId).toBe('session-3'); // middle (12:00:00)
      expect(result.data[2].sessionId).toBe('session-1'); // oldest (10:00:00)
    });

    it('returns only .json files (ignores other files)', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(['hash-dir'] as any)
        .mockResolvedValueOnce(['session.json', 'readme.txt', 'data.yaml'] as any)
        .mockRejectedValueOnce(new Error('ENOENT')); // history

      const sessionJson = {
        sessionId: 'test-session',
        projectHash: 'hash',
        startTime: '2026-01-06T14:00:00Z',
        messages: [],
      };

      vi.mocked(fs.stat)
        .mockResolvedValue({ mtimeMs: 1704555060829 } as any);

      vi.mocked(fs.readFile)
        .mockResolvedValue(JSON.stringify(sessionJson) as any);

      const result = await ipc.invoke('config:get-gemini-sessions', path.join(HOME, '.gemini'));
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('throws error when configDir is outside homedir (path traversal guard)', async () => {
      const result = await ipc.invoke('config:get-gemini-sessions', '/etc/passwd');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/outside/i);
    });
  });

  // ── CONFIG_GET_GEMINI_SESSION_MESSAGES ──────────────────────────────────────

  describe('config:get-gemini-session-messages', () => {
    it('returns messages from a valid session JSON file', async () => {
      const filePath = path.join(HOME, '.gemini', 'tmp', 'hash-dir', 'chats', 'session.json');
      const sessionJson = {
        sessionId: 'session-uuid',
        messages: [
          { id: '1', type: 'user', content: 'question', timestamp: '2026-01-06T14:00:00Z' },
          { id: '2', type: 'assistant', content: 'answer', timestamp: '2026-01-06T14:00:01Z' },
        ],
      };

      vi.mocked(fs.readFile)
        .mockResolvedValue(JSON.stringify(sessionJson) as any);

      const result = await ipc.invoke('config:get-gemini-session-messages', filePath);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('1');
      expect(result.data[1].id).toBe('2');
    });

    it('returns empty array when messages field is missing', async () => {
      const filePath = path.join(HOME, '.gemini', 'tmp', 'hash-dir', 'chats', 'session.json');
      const sessionJson = {
        sessionId: 'session-uuid',
        startTime: '2026-01-06T14:00:00Z',
      };

      vi.mocked(fs.readFile)
        .mockResolvedValue(JSON.stringify(sessionJson) as any);

      const result = await ipc.invoke('config:get-gemini-session-messages', filePath);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('truncates to last 500 messages if more than 500', async () => {
      const filePath = path.join(HOME, '.gemini', 'tmp', 'hash-dir', 'chats', 'session.json');
      const messages = Array.from({ length: 700 }, (_, i) => ({
        id: String(i),
        type: i % 2 === 0 ? 'user' : 'assistant',
        content: `message ${i}`,
        timestamp: '2026-01-06T14:00:00Z',
      }));

      const sessionJson = { sessionId: 'session-uuid', messages };

      vi.mocked(fs.readFile)
        .mockResolvedValue(JSON.stringify(sessionJson) as any);

      const result = await ipc.invoke('config:get-gemini-session-messages', filePath);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(500);
      expect(result.data[0].id).toBe('200'); // last 500: indices 200-699
      expect(result.data[499].id).toBe('699');
    });
  });
});
