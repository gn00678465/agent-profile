// S3-2 — claudePluginsHandler test (5 cases)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { IPC_CHANNELS } from '../../../shared/types';

vi.mock('os', () => ({
  default: { homedir: vi.fn(() => '/home/testuser') },
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    rm: vi.fn(),
  },
}));

// cliRunner is irrelevant for read-handler tests — stub it.
vi.mock('../handlers/cliRunner', () => ({
  runMarketplaceAdd: vi.fn(),
  runMarketplaceRemove: vi.fn(),
  runMarketplaceUpdate: vi.fn(),
  runPluginInstall: vi.fn(),
  runPluginUninstall: vi.fn(),
  runPluginReload: vi.fn(),
}));

import fs from 'fs/promises';
import { registerClaudePluginsHandler, _resetErrorBufferForTests } from '../handlers/claudePluginsHandler';

function createMockIpcMain() {
  const handlers: Record<string, Function> = {};
  return {
    handle: (channel: string, fn: Function) => { handlers[channel] = fn; },
    invoke: async (channel: string, ...args: unknown[]) => {
      const handler = handlers[channel];
      if (!handler) throw new Error(`No handler for channel: ${channel}`);
      return handler({}, ...args);
    },
    handlers,
  };
}

const CONFIG_DIR = '/home/testuser/.claude';
const PLUGINS_DIR = path.join(CONFIG_DIR, 'plugins');
const INSTALLED = path.join(PLUGINS_DIR, 'installed_plugins.json');
const SETTINGS = path.join(CONFIG_DIR, 'settings.json');
const KNOWN = path.join(PLUGINS_DIR, 'known_marketplaces.json');

const MFP_ROOT = '/home/testuser/.claude/plugins/marketplaces/foo';
const MFP_JSON = path.join(MFP_ROOT, '.claude-plugin', 'marketplace.json');

function fileNotFound(): NodeJS.ErrnoException {
  const e = new Error('ENOENT') as NodeJS.ErrnoException;
  e.code = 'ENOENT';
  return e;
}

describe('claudePluginsHandler', () => {
  let ipc: ReturnType<typeof createMockIpcMain>;

  beforeEach(() => {
    vi.resetAllMocks();
    _resetErrorBufferForTests();
    ipc = createMockIpcMain();
    registerClaudePluginsHandler(ipc as any, '/home/testuser');
  });

  // (a) installed_plugins.json 正常解析（含 components 計數讀 plugin.json）
  it('parses installed_plugins.json and reads plugin.json + component counts', async () => {
    const installPath = '/home/testuser/.claude/plugins/cache/m1/plug-a/1.0.0';
    (fs.readFile as any).mockImplementation(async (p: string) => {
      if (p === INSTALLED) {
        return JSON.stringify({
          version: 2,
          plugins: {
            'plug-a@m1': [
              {
                scope: 'user',
                installPath,
                version: '1.0.0',
                installedAt: '2026-01-01T00:00:00Z',
                lastUpdated: '2026-01-02T00:00:00Z',
              },
            ],
          },
        });
      }
      if (p === SETTINGS) {
        return JSON.stringify({ enabledPlugins: { 'plug-a@m1': true } });
      }
      if (p === path.join(installPath, '.claude-plugin', 'plugin.json')) {
        return JSON.stringify({
          name: 'plug-a',
          version: '1.0.0',
          description: 'Test plugin',
          author: { name: 'Tester' },
          homepage: 'https://example.com',
          license: 'MIT',
        });
      }
      throw fileNotFound();
    });
    (fs.readdir as any).mockImplementation(async (p: string) => {
      if (p === path.join(installPath, 'skills')) {
        return [
          { isDirectory: () => true, isFile: () => false, name: 'skill1' },
          { isDirectory: () => true, isFile: () => false, name: 'skill2' },
        ];
      }
      if (p === path.join(installPath, 'agents')) {
        return [{ isDirectory: () => false, isFile: () => true, name: 'agent.md' }];
      }
      throw fileNotFound();
    });
    (fs.stat as any).mockImplementation(async (p: string) => {
      if (p === path.join(installPath, '.mcp.json')) return {};
      throw fileNotFound();
    });

    const res = await ipc.invoke(IPC_CHANNELS.CONFIG_GET_CLAUDE_PLUGINS, CONFIG_DIR);
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
    const p = res.data[0];
    expect(p.id).toBe('plug-a@m1');
    expect(p.enabled).toBe(true);
    expect(p.description).toBe('Test plugin');
    expect(p.author?.name).toBe('Tester');
    expect(p.license).toBe('MIT');
    expect(p.components).toEqual({
      skills: 2,
      agents: 1,
      hooks: 0,
      mcp: true,
      lsp: false,
      monitors: 0,
    });
  });

  // (a2) duplicate installs (same scope + same installPath) are deduped
  it('dedupes duplicate installs within the same pluginId', async () => {
    const installPath = '/home/testuser/.claude/plugins/cache/sentry-skills/sentry-skills/abc';
    (fs.readFile as any).mockImplementation(async (p: string) => {
      if (p === INSTALLED) {
        return JSON.stringify({
          version: 2,
          plugins: {
            'sentry-skills@sentry-skills': [
              { scope: 'local', installPath, version: 'abc', installedAt: '', lastUpdated: '' },
              { scope: 'local', installPath, version: 'abc', installedAt: '', lastUpdated: '' },
            ],
          },
        });
      }
      throw fileNotFound();
    });

    const res = await ipc.invoke(IPC_CHANNELS.CONFIG_GET_CLAUDE_PLUGINS, CONFIG_DIR);
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
  });

  // (b) installed_plugins.json 不存在 → 回空陣列 (RC2)
  it('returns empty array when installed_plugins.json is missing', async () => {
    (fs.readFile as any).mockImplementation(async () => {
      throw fileNotFound();
    });

    const res = await ipc.invoke(IPC_CHANNELS.CONFIG_GET_CLAUDE_PLUGINS, CONFIG_DIR);
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });

  // (c) installed_plugins.json 損毀 → 回 success:false (RC3)
  it('returns success:false when installed_plugins.json is corrupt', async () => {
    (fs.readFile as any).mockImplementation(async (p: string) => {
      if (p === INSTALLED) return '{not valid json';
      throw fileNotFound();
    });

    const res = await ipc.invoke(IPC_CHANNELS.CONFIG_GET_CLAUDE_PLUGINS, CONFIG_DIR);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/JSON|Unexpected/i);
  });

  // (d) getMarketplaces 合併 known_marketplaces.json + extraKnownMarketplaces
  it('merges known_marketplaces.json with extraKnownMarketplaces and flags unsynced', async () => {
    (fs.readFile as any).mockImplementation(async (p: string) => {
      if (p === KNOWN) {
        return JSON.stringify({
          'claude-plugins-official': {
            source: { source: 'github', repo: 'anthropics/claude-plugins-official' },
            installLocation: '/home/testuser/.claude/plugins/marketplaces/claude-plugins-official',
            lastUpdated: '2026-05-01T00:00:00Z',
          },
        });
      }
      if (p === SETTINGS) {
        return JSON.stringify({
          extraKnownMarketplaces: {
            'pending-mp': {
              source: { source: 'github', repo: 'someone/pending-mp' },
              autoUpdate: true,
            },
          },
        });
      }
      throw fileNotFound();
    });

    const res = await ipc.invoke(IPC_CHANNELS.CONFIG_GET_CLAUDE_MARKETPLACES, CONFIG_DIR);
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(2);
    const official = res.data.find((m: any) => m.name === 'claude-plugins-official');
    expect(official.isOfficial).toBe(true);
    expect(official.autoUpdate).toBe(true);
    const pending = res.data.find((m: any) => m.name === 'pending-mp');
    expect(pending.unsynced).toBe(true);
    expect(pending.installLocation).toBe('');
  });

  // (e) getDiscovery 讀指定市場 marketplace.json 並標記 installed flag
  it('returns discovery items with `installed` flag against installed_plugins.json', async () => {
    (fs.readFile as any).mockImplementation(async (p: string) => {
      if (p === KNOWN) {
        return JSON.stringify({
          foo: {
            source: { source: 'github', repo: 'foo/bar' },
            installLocation: MFP_ROOT,
          },
        });
      }
      if (p === MFP_JSON) {
        return JSON.stringify({
          name: 'foo',
          plugins: [
            { name: 'p1', description: 'Plugin one', author: { name: 'a' }, category: 'dev' },
            { name: 'p2', description: 'Plugin two', category: 'design' },
          ],
        });
      }
      if (p === INSTALLED) {
        return JSON.stringify({
          version: 2,
          plugins: { 'p1@foo': [{ scope: 'user', installPath: '/x', version: '1', installedAt: '', lastUpdated: '' }] },
        });
      }
      throw fileNotFound();
    });

    const res = await ipc.invoke(IPC_CHANNELS.CONFIG_GET_CLAUDE_PLUGIN_DISCOVERY, CONFIG_DIR, 'foo');
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(2);
    const p1 = res.data.find((d: any) => d.name === 'p1');
    expect(p1.installed).toBe(true);
    const p2 = res.data.find((d: any) => d.name === 'p2');
    expect(p2.installed).toBe(false);
  });
});
