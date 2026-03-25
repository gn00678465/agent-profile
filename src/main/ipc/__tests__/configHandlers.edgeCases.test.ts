import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { registerConfigHandlers } from '../configHandlers';

vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/home/testuser'),
  },
}));

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
  };
}

describe('configHandlers - edge cases', () => {
  let ipc: ReturnType<typeof createMockIpcMain>;

  beforeEach(() => {
    vi.resetAllMocks();
    ipc = createMockIpcMain();
    registerConfigHandlers(ipc as any);
  });

  // ── Skill Frontmatter Parsing ─────────────────────────────────────────────

  describe('parseSkillFrontmatter (via config:get-skills)', () => {
    async function getSkillsWithContent(content: string) {
      vi.mocked(fs.readdir).mockResolvedValue(['test-skill'] as any);
      vi.mocked(fs.lstat).mockResolvedValue({ isDirectory: () => true, isSymbolicLink: () => false } as any);
      vi.mocked(fs.readFile).mockResolvedValue(content as any);
      const result = await ipc.invoke('config:get-skills', '/home/testuser/.claude');
      return result.data[0];
    }

    it('parses name from frontmatter', async () => {
      const skill = await getSkillsWithContent('---\nname: My Skill\n---\n# Body');
      expect(skill.name).toBe('My Skill');
    });

    it('parses version string from frontmatter', async () => {
      const skill = await getSkillsWithContent('---\nname: Test\nversion: "2.0.0"\n---\n# Body');
      expect(skill.version).toBe('2.0.0');
    });

    it('parses unquoted version from frontmatter', async () => {
      const skill = await getSkillsWithContent('---\nname: Test\nversion: 1.5\n---\n# Body');
      expect(skill.version).toBe('1.5');
    });

    it('parses boolean true for user-invocable', async () => {
      const skill = await getSkillsWithContent('---\nname: Test\nuser-invocable: true\n---\n# Body');
      expect(skill.userInvocable).toBe(true);
    });

    it('parses boolean false for user-invocable', async () => {
      const skill = await getSkillsWithContent('---\nname: Test\nuser-invocable: false\n---\n# Body');
      expect(skill.userInvocable).toBe(false);
    });

    it('parses description from frontmatter', async () => {
      const skill = await getSkillsWithContent('---\nname: Test\ndescription: A helpful skill\n---\n# Body');
      expect(skill.description).toBe('A helpful skill');
    });

    it('parses quoted strings from frontmatter', async () => {
      const skill = await getSkillsWithContent('---\nname: "Quoted Name"\n---\n# Body');
      expect(skill.name).toBe('Quoted Name');
    });

    it('uses folder name as fallback when no frontmatter', async () => {
      const skill = await getSkillsWithContent('# No frontmatter here\n\nJust content.');
      expect(skill.name).toBe('test-skill');
      expect(skill.id).toBe('test-skill');
    });

    it('parses array values in frontmatter (allowed-tools)', async () => {
      const content = `---
name: Tool Skill
allowed-tools:
  - Read
  - Write
  - Bash
---
# Body`;
      const skill = await getSkillsWithContent(content);
      expect(skill.frontmatter?.['allowed-tools']).toEqual(['Read', 'Write', 'Bash']);
    });

    it('handles complete frontmatter with all fields', async () => {
      const content = `---
name: Full Skill
version: "1.2.3"
description: Fully featured skill
user-invocable: true
license: MIT
---
# Full Skill

Content here.`;
      const skill = await getSkillsWithContent(content);
      expect(skill.name).toBe('Full Skill');
      expect(skill.version).toBe('1.2.3');
      expect(skill.description).toBe('Fully featured skill');
      expect(skill.userInvocable).toBe(true);
    });

    it('handles skill content that is just empty frontmatter dashes', async () => {
      const skill = await getSkillsWithContent('---\n---\n# Body');
      // No name in frontmatter, falls back to folder name
      expect(skill.name).toBe('test-skill');
    });

    it('preserves full file content in skill.content', async () => {
      const content = '---\nname: My Skill\n---\n# Body\n\nThis is the body.';
      const skill = await getSkillsWithContent(content);
      expect(skill.content).toBe(content);
    });

    it('sets filePath and dirPath correctly', async () => {
      const skill = await getSkillsWithContent('---\nname: My Skill\n---\n# Body');
      expect(skill.filePath).toContain('SKILL.md');
      expect(skill.dirPath).toContain('test-skill');
    });
  });

  // ── MCP config edge cases ─────────────────────────────────────────────────

  describe('config:get-mcp - edge cases', () => {
    it('prioritizes mcp-config.json for copilot agentType', async () => {
      const mcpConfig = { mcpServers: { docker: { command: 'docker' } } };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mcpConfig) as any);

      const result = await ipc.invoke('config:get-mcp', '/home/testuser/.copilot', 'copilot');
      expect(result.success).toBe(true);
      expect(result.data.path).toContain('mcp-config.json');
      expect(result.data.data?.mcpServers).toHaveProperty('docker');
    });

    it('reads ~/.claude.json for claude-code agentType and returns its mcpServers', async () => {
      const claudeJson = { model: 'claude-3', mcpServers: { server1: { command: 'server1' } } };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(claudeJson) as any);

      const result = await ipc.invoke('config:get-mcp', '/home/testuser/.claude', 'claude-code');
      expect(result.success).toBe(true);
      expect(result.data.data?.mcpServers).toBeDefined();
      expect(result.data.data?.mcpServers).toHaveProperty('server1');
    });

    it('returns exists:true when mcpServers is an empty object in the file', async () => {
      const settingsWithEmptyMcp = { model: 'opus', mcpServers: {} };
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(settingsWithEmptyMcp) as any);

      const result = await ipc.invoke('config:get-mcp', '/home/testuser/.gemini', 'gemini');
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(true);
      expect(result.data.data?.mcpServers).toEqual({});
    });
  });

  describe('config:save-mcp - edge cases', () => {
    it('prefers settings.json for Gemini agents that have mcpServers there', async () => {
      const existingGeminiSettings = { general: { vimMode: false }, mcpServers: { old: { command: 'old' } } };
      const newMcpSettings = { mcpServers: { new: { command: 'new' } } };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(existingGeminiSettings) as any); // settings.json read for merge

      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const result = await ipc.invoke('config:save-mcp', '/home/testuser/.gemini', 'gemini', newMcpSettings);
      expect(result.success).toBe(true);

      const writtenContent = JSON.parse(
        vi.mocked(fs.writeFile).mock.calls[0][1] as string
      );
      // Should preserve general settings and apply new mcpServers
      expect(writtenContent.general).toEqual(existingGeminiSettings.general);
      expect(writtenContent.mcpServers).toEqual(newMcpSettings.mcpServers);
    });

    it('creates new mcp-config.json when all candidates are missing', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readFile).mockRejectedValue(err);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const newSettings = { mcpServers: { brand_new: { command: 'new' } } };
      const result = await ipc.invoke('config:save-mcp', '/home/testuser/.copilot', 'copilot', newSettings);

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('mcp-config.json'),
        expect.any(String),
        'utf-8'
      );
    });
  });

  // ── Gemini Extensions edge cases ──────────────────────────────────────────

  describe('config:get-gemini-extensions - edge cases', () => {
    it('skips entries that fail stat check', async () => {
      const manifest = {
        name: 'context7',
        version: '1.0.0',
        mcpServers: { context7: { command: 'npx' } },
      };

      vi.mocked(fs.readdir).mockResolvedValue(['bad-entry', 'context7'] as any);
      vi.mocked(fs.stat)
        .mockRejectedValueOnce(new Error('stat failed'))  // bad-entry
        .mockResolvedValueOnce({ isDirectory: () => true } as any);  // context7

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('{}' as any)  // extension-enablement.json
        .mockResolvedValueOnce(JSON.stringify(manifest) as any);  // context7/gemini-extension.json

      const result = await ipc.invoke('config:get-gemini-extensions', '/home/testuser/.gemini');
      expect(result.success).toBe(true);
      expect(result.data.extensions).toHaveLength(1);
      expect(result.data.extensions[0].name).toBe('context7');
    });

    it('handles extension with no manifest (gemini-extension.json missing)', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

      vi.mocked(fs.readdir).mockResolvedValue(['nomanifest-ext'] as any);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('{}' as any)  // enablement
        .mockRejectedValueOnce(err);  // missing gemini-extension.json

      const result = await ipc.invoke('config:get-gemini-extensions', '/home/testuser/.gemini');
      expect(result.success).toBe(true);
      expect(result.data.extensions).toHaveLength(0); // skipped because no manifest data
    });

    it('marks extension as enabled when it appears in enablement file', async () => {
      const manifest = { name: 'my-ext', version: '1.0', mcpServers: {} };
      const enablement = { 'my-ext': { overrides: [] } };

      vi.mocked(fs.readdir).mockResolvedValue(['my-ext'] as any);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(enablement) as any)  // enablement
        .mockResolvedValueOnce(JSON.stringify(manifest) as any);  // manifest

      const result = await ipc.invoke('config:get-gemini-extensions', '/home/testuser/.gemini');
      expect(result.success).toBe(true);
      expect(result.data.extensions[0].enabled).toBe(true);
    });

    it('marks extension as disabled when it does not appear in enablement file', async () => {
      const manifest = { name: 'disabled-ext', version: '1.0', mcpServers: {} };
      const enablement = {}; // empty

      vi.mocked(fs.readdir).mockResolvedValue(['disabled-ext'] as any);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(enablement) as any)
        .mockResolvedValueOnce(JSON.stringify(manifest) as any);

      const result = await ipc.invoke('config:get-gemini-extensions', '/home/testuser/.gemini');
      expect(result.success).toBe(true);
      expect(result.data.extensions[0].enabled).toBe(false);
    });

    it('returns empty enablement object when enablement file is missing', async () => {
      const manifest = { name: 'some-ext', mcpServers: {} };
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

      vi.mocked(fs.readdir).mockResolvedValue(['some-ext'] as any);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.readFile)
        .mockRejectedValueOnce(err)  // enablement file missing -> readJsonFile returns not-found
        .mockResolvedValueOnce(JSON.stringify(manifest) as any);

      const result = await ipc.invoke('config:get-gemini-extensions', '/home/testuser/.gemini');
      expect(result.success).toBe(true);
      expect(result.data.enablement).toEqual({});
    });

    it('skips non-directory entries like extension-enablement.json in listing', async () => {
      const manifest = { name: 'ext1', mcpServers: {} };

      vi.mocked(fs.readdir).mockResolvedValue(['extension-enablement.json', 'ext1'] as any);
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ isDirectory: () => false } as any)  // json file, not dir
        .mockResolvedValueOnce({ isDirectory: () => true } as any);  // ext1

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('{}' as any)  // enablement
        .mockResolvedValueOnce(JSON.stringify(manifest) as any);  // ext1 manifest

      const result = await ipc.invoke('config:get-gemini-extensions', '/home/testuser/.gemini');
      expect(result.success).toBe(true);
      expect(result.data.extensions).toHaveLength(1);
    });
  });

  // ── Claude plugins edge cases ─────────────────────────────────────────────

  describe('config:get-claude-plugins - edge cases', () => {
    it('handles empty plugins object in installed_plugins.json', async () => {
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify({ version: 2, plugins: {} }) as any)
        .mockResolvedValueOnce(JSON.stringify({ enabledPlugins: {} }) as any);

      const result = await ipc.invoke('config:get-claude-plugins', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('handles missing enabledPlugins in settings.json (defaults to false)', async () => {
      const installedPlugins = {
        version: 2,
        plugins: {
          'test@official': [
            { scope: 'user', installPath: '/path', version: '1.0', installedAt: '2026-01-01', lastUpdated: '2026-01-01' },
          ],
        },
      };
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(installedPlugins) as any)
        .mockResolvedValueOnce(JSON.stringify({}) as any); // settings.json without enabledPlugins

      const result = await ipc.invoke('config:get-claude-plugins', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data[0].enabled).toBe(false);
    });

    it('correctly splits plugin id into name and marketplace', async () => {
      const installedPlugins = {
        version: 2,
        plugins: {
          'my-plugin@my-marketplace': [
            { scope: 'user', installPath: '/path', version: '1.0', installedAt: '2026-01-01', lastUpdated: '2026-01-01' },
          ],
        },
      };
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(installedPlugins) as any)
        .mockResolvedValueOnce(JSON.stringify({ enabledPlugins: {} }) as any);

      const result = await ipc.invoke('config:get-claude-plugins', '/home/testuser/.claude');
      expect(result.data[0].name).toBe('my-plugin');
      expect(result.data[0].marketplace).toBe('my-marketplace');
    });

    it('handles settings.json ENOENT gracefully (no enabledPlugins)', async () => {
      const installedPlugins = {
        version: 2,
        plugins: {
          'test@official': [
            { scope: 'user', installPath: '/path', version: '1.0', installedAt: '2026-01-01', lastUpdated: '2026-01-01' },
          ],
        },
      };
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(installedPlugins) as any)
        .mockRejectedValueOnce(err);  // settings.json not found

      const result = await ipc.invoke('config:get-claude-plugins', '/home/testuser/.claude');
      expect(result.success).toBe(true);
      expect(result.data[0].enabled).toBe(false); // defaults to false
    });

    it('includes gitCommitSha when present in plugin install', async () => {
      const installedPlugins = {
        version: 2,
        plugins: {
          'versioned@official': [
            {
              scope: 'user',
              installPath: '/path',
              version: 'abc1234',
              installedAt: '2026-01-01',
              lastUpdated: '2026-01-01',
              gitCommitSha: 'abc1234deadbeef',
            },
          ],
        },
      };
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(installedPlugins) as any)
        .mockResolvedValueOnce(JSON.stringify({ enabledPlugins: {} }) as any);

      const result = await ipc.invoke('config:get-claude-plugins', '/home/testuser/.claude');
      expect(result.data[0].gitCommitSha).toBe('abc1234deadbeef');
    });
  });

  // ── Config read/write path construction ───────────────────────────────────

  describe('config path construction', () => {
    it('save-claude-settings uses configDir/settings.json', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      await ipc.invoke('config:save-claude-settings', '/custom/dir', { model: 'opus' });
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/custom/dir', 'settings.json'),
        expect.any(String),
        'utf-8'
      );
    });

    it('save-gemini-settings uses configDir/settings.json', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      await ipc.invoke('config:save-gemini-settings', '/gemini/dir', { general: { vimMode: true } });
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/gemini/dir', 'settings.json'),
        expect.any(String),
        'utf-8'
      );
    });

    it('save-copilot-config uses configDir/config.json', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      await ipc.invoke('config:save-copilot-config', '/copilot/dir', { theme: 'dark' });
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/copilot/dir', 'config.json'),
        expect.any(String),
        'utf-8'
      );
    });

    it('config:get-claude-plugins reads from plugins/installed_plugins.json', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readFile).mockRejectedValue(err);

      await ipc.invoke('config:get-claude-plugins', '/home/testuser/.claude');
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join('/home/testuser/.claude', 'plugins', 'installed_plugins.json'),
        'utf-8'
      );
    });

    it('config:get-skills reads from configDir/skills/', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      await ipc.invoke('config:get-skills', '/my/config');
      expect(fs.readdir).toHaveBeenCalledWith(
        path.join('/my/config', 'skills')
      );
    });

    it('config:save-skill creates correct directory structure', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      await ipc.invoke('config:save-skill', '/my/config', {
        id: 'test-skill',
        name: 'Test',
        content: '# Test',
      });

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('/my/config', 'skills', 'test-skill'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/my/config', 'skills', 'test-skill', 'SKILL.md'),
        '# Test',
        'utf-8'
      );
    });
  });

  // ── JSON serialization ────────────────────────────────────────────────────

  describe('JSON serialization', () => {
    it('writes settings with 2-space indentation', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const settings = { model: 'opus', permissions: { allow: ['Bash(*)'] } };
      await ipc.invoke('config:save-claude-settings', '/home/testuser/.claude', settings);

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(written).toBe(JSON.stringify(settings, null, 2));
    });

    it('writes copilot config with 2-space indentation', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const config = { theme: 'dark', model: 'claude-sonnet-4.5' };
      await ipc.invoke('config:save-copilot-config', '/home/testuser/.copilot', config);

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(written).toBe(JSON.stringify(config, null, 2));
    });

    it('handles empty object settings', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const result = await ipc.invoke('config:save-gemini-settings', '/home/testuser/.gemini', {});
      expect(result.success).toBe(true);
      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(JSON.parse(written)).toEqual({});
    });
  });

  // ── Permission errors ─────────────────────────────────────────────────────

  describe('permission errors', () => {
    it('save-claude-settings returns failure on EACCES', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockRejectedValue(
        Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      );

      const result = await ipc.invoke('config:save-claude-settings', '/readonly/.claude', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('EACCES');
    });

    it('save-markdown returns failure on EACCES', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockRejectedValue(
        Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      );

      const result = await ipc.invoke('config:save-markdown', '/readonly/CLAUDE.md', '# test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('EACCES');
    });

    it('delete-skill returns failure on EACCES', async () => {
      vi.mocked(fs.rm).mockRejectedValue(
        Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      );

      const result = await ipc.invoke('config:delete-skill', '/readonly/.claude', 'test-skill');
      expect(result.success).toBe(false);
      expect(result.error).toContain('EACCES');
    });
  });

  // ── Malformed JSON handling ───────────────────────────────────────────────

  describe('malformed JSON config files', () => {
    it('get-gemini-settings returns error config for malformed JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{invalid json content' as any);

      const result = await ipc.invoke('config:get-gemini-settings', '/home/testuser/.gemini');
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(true);
      expect(result.data.data).toBeNull();
      expect(result.data.error).toBeDefined();
    });

    it('get-copilot-config returns error config for malformed JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('not valid json' as any);

      const result = await ipc.invoke('config:get-copilot-config', '/home/testuser/.copilot');
      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(true);
      expect(result.data.data).toBeNull();
      expect(result.data.error).toBeDefined();
    });

    it('get-mcp returns failure when all candidates exist but have malformed JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{{bad json' as any);

      const result = await ipc.invoke('config:get-mcp', '/home/testuser/.copilot', 'copilot');
      expect(result.success).toBe(false);
    });
  });
});
