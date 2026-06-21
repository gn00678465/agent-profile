// codexPluginsHandler tests — hybrid marketplace merge + plugin parse + CLI mutation forwarding.
// codexCliRunner is mocked (no real spawn); fs/promises is mocked for config.toml reads.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { IPC_CHANNELS } from '../../../shared/types';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
}));

vi.mock('../handlers/codexCliRunner', () => ({
  runMarketplaceList: vi.fn(),
  runMarketplaceAdd: vi.fn(),
  runMarketplaceRemove: vi.fn(),
  runMarketplaceUpgrade: vi.fn(),
  runPluginList: vi.fn(),
  runPluginAdd: vi.fn(),
  runPluginRemove: vi.fn(),
}));

import fs from 'fs/promises';
import { registerCodexPluginsHandler } from '../handlers/codexPluginsHandler';
import {
  runMarketplaceList,
  runMarketplaceAdd,
  runMarketplaceRemove,
  runMarketplaceUpgrade,
  runPluginList,
  runPluginAdd,
  runPluginRemove,
} from '../handlers/codexCliRunner';

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

const CONFIG_DIR = 'C:\\Users\\gn006\\.codex';
const CONFIG_TOML = path.join(CONFIG_DIR, 'config.toml');

// `marketplace list` reports both the user marketplace (ponytail) and a built-in one
// (openai-curated) that does NOT appear in config.toml.
const MARKETPLACE_LIST_STDOUT = [
  'MARKETPLACE     ROOT',
  'ponytail        C:\\Users\\gn006\\.codex\\.tmp\\marketplaces\\ponytail',
  'openai-curated  C:\\Users\\gn006\\.codex\\.tmp\\plugins',
  '',
].join('\n');

// config.toml: only `ponytail` is a user marketplace with source metadata.
const CONFIG_TOML_CONTENT = [
  '[marketplaces.ponytail]',
  'source_type = "git"',
  'source = "https://github.com/DietrichGebert/ponytail.git"',
  'last_updated = "2026-06-20T12:00:00Z"',
  '',
].join('\n');

const PLUGIN_LIST_STDOUT = [
  'Marketplace `ponytail`',
  'C:\\Users\\gn006\\.codex\\.tmp\\marketplaces\\ponytail\\.agents\\plugins\\marketplace.json',
  '',
  'PLUGIN             STATUS         VERSION  PATH',
  'ponytail@ponytail  not installed           https://github.com/DietrichGebert/ponytail.git, ref `main`',
  '',
].join('\n');

function fileNotFound(): NodeJS.ErrnoException {
  const e = new Error('ENOENT') as NodeJS.ErrnoException;
  e.code = 'ENOENT';
  return e;
}

const NOT_FOUND_MSG_CODEX =
  'codex CLI not found in PATH; install via instructions at https://developers.openai.com/codex/cli';

describe('codexPluginsHandler', () => {
  let ipc: ReturnType<typeof createMockIpcMain>;

  beforeEach(() => {
    vi.resetAllMocks();
    ipc = createMockIpcMain();
    registerCodexPluginsHandler(ipc as any, CONFIG_DIR);
  });

  // ─── get-marketplaces: hybrid merge ────────────────────────────────────────
  it('merges CLI marketplace list with config.toml: user (in toml) vs built-in (not in toml)', async () => {
    (runMarketplaceList as any).mockResolvedValue({ success: true, exitCode: 0, stdout: MARKETPLACE_LIST_STDOUT });
    (fs.readFile as any).mockImplementation(async (p: string) => {
      if (p === CONFIG_TOML) return CONFIG_TOML_CONTENT;
      throw fileNotFound();
    });

    const res = await ipc.invoke(IPC_CHANNELS.CONFIG_GET_CODEX_MARKETPLACES, CONFIG_DIR);

    expect(res.success).toBe(true);
    expect(res.data).toEqual([
      {
        name: 'ponytail',
        root: 'C:\\Users\\gn006\\.codex\\.tmp\\marketplaces\\ponytail',
        builtin: false,
        source: 'https://github.com/DietrichGebert/ponytail.git',
        sourceType: 'git',
        lastUpdated: '2026-06-20T12:00:00Z',
      },
      {
        name: 'openai-curated',
        root: 'C:\\Users\\gn006\\.codex\\.tmp\\plugins',
        builtin: true,
      },
    ]);
  });

  it('returns the CLI list with all builtin:true when config.toml is missing', async () => {
    (runMarketplaceList as any).mockResolvedValue({ success: true, exitCode: 0, stdout: MARKETPLACE_LIST_STDOUT });
    (fs.readFile as any).mockRejectedValue(fileNotFound());

    const res = await ipc.invoke(IPC_CHANNELS.CONFIG_GET_CODEX_MARKETPLACES, CONFIG_DIR);

    expect(res.success).toBe(true);
    expect(res.data).toEqual([
      expect.objectContaining({ name: 'ponytail', builtin: true }),
      expect.objectContaining({ name: 'openai-curated', builtin: true }),
    ]);
  });

  it('treats invalid config.toml as no user marketplaces (still returns CLI list)', async () => {
    (runMarketplaceList as any).mockResolvedValue({ success: true, exitCode: 0, stdout: MARKETPLACE_LIST_STDOUT });
    (fs.readFile as any).mockResolvedValue('this is = = not valid toml [[[');

    const res = await ipc.invoke(IPC_CHANNELS.CONFIG_GET_CODEX_MARKETPLACES, CONFIG_DIR);

    expect(res.success).toBe(true);
    expect(res.data).toEqual([
      expect.objectContaining({ name: 'ponytail', builtin: true }),
      expect.objectContaining({ name: 'openai-curated', builtin: true }),
    ]);
  });

  it('surfaces an envelope error (no crash) when codex binary is missing — get-marketplaces', async () => {
    (runMarketplaceList as any).mockResolvedValue({ success: false, error: NOT_FOUND_MSG_CODEX });

    const res = await ipc.invoke(IPC_CHANNELS.CONFIG_GET_CODEX_MARKETPLACES, CONFIG_DIR);

    expect(res.success).toBe(false);
    expect(res.error).toBe(NOT_FOUND_MSG_CODEX);
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  // ─── get-plugins ───────────────────────────────────────────────────────────
  it('parses `codex plugin list` stdout into CodexPlugin[]', async () => {
    (runPluginList as any).mockResolvedValue({ success: true, exitCode: 0, stdout: PLUGIN_LIST_STDOUT });

    const res = await ipc.invoke(IPC_CHANNELS.CONFIG_GET_CODEX_PLUGINS);

    expect(res.success).toBe(true);
    expect(res.data).toEqual([
      {
        id: 'ponytail@ponytail',
        name: 'ponytail',
        marketplace: 'ponytail',
        status: 'not-installed',
        path: 'https://github.com/DietrichGebert/ponytail.git, ref `main`',
      },
    ]);
  });

  it('surfaces an envelope error (no crash) when codex binary is missing — get-plugins', async () => {
    (runPluginList as any).mockResolvedValue({ success: false, error: NOT_FOUND_MSG_CODEX });

    const res = await ipc.invoke(IPC_CHANNELS.CONFIG_GET_CODEX_PLUGINS);

    expect(res.success).toBe(false);
    expect(res.error).toBe(NOT_FOUND_MSG_CODEX);
  });

  // ─── mutations: forward args + return CliRunResult in data ──────────────────
  it('marketplace-add forwards source + ref and returns the runner CliRunResult', async () => {
    const runResult = { success: true, exitCode: 0, stdout: 'added' };
    (runMarketplaceAdd as any).mockResolvedValue(runResult);

    const res = await ipc.invoke(IPC_CHANNELS.CODEX_CLI_MARKETPLACE_ADD, 'owner/repo', 'main');

    expect(runMarketplaceAdd).toHaveBeenCalledWith('owner/repo', 'main');
    expect(res).toEqual({ success: true, data: runResult });
  });

  it('marketplace-add forwards undefined ref when omitted', async () => {
    const runResult = { success: true, exitCode: 0 };
    (runMarketplaceAdd as any).mockResolvedValue(runResult);

    const res = await ipc.invoke(IPC_CHANNELS.CODEX_CLI_MARKETPLACE_ADD, 'owner/repo');

    expect(runMarketplaceAdd).toHaveBeenCalledWith('owner/repo', undefined);
    expect(res.data).toEqual(runResult);
  });

  it('marketplace-remove forwards name and returns the runner CliRunResult', async () => {
    const runResult = { success: true, exitCode: 0, stdout: 'removed' };
    (runMarketplaceRemove as any).mockResolvedValue(runResult);

    const res = await ipc.invoke(IPC_CHANNELS.CODEX_CLI_MARKETPLACE_REMOVE, 'ponytail');

    expect(runMarketplaceRemove).toHaveBeenCalledWith('ponytail');
    expect(res).toEqual({ success: true, data: runResult });
  });

  it('marketplace-upgrade forwards optional name and returns the runner CliRunResult', async () => {
    const runResult = { success: true, exitCode: 0, stdout: 'upgraded' };
    (runMarketplaceUpgrade as any).mockResolvedValue(runResult);

    const res = await ipc.invoke(IPC_CHANNELS.CODEX_CLI_MARKETPLACE_UPGRADE, 'ponytail');

    expect(runMarketplaceUpgrade).toHaveBeenCalledWith('ponytail');
    expect(res).toEqual({ success: true, data: runResult });
  });

  it('plugin-add forwards plugin id and returns the runner CliRunResult', async () => {
    const runResult = { success: true, exitCode: 0, stdout: 'installed' };
    (runPluginAdd as any).mockResolvedValue(runResult);

    const res = await ipc.invoke(IPC_CHANNELS.CODEX_CLI_PLUGIN_ADD, 'ponytail@ponytail');

    expect(runPluginAdd).toHaveBeenCalledWith('ponytail@ponytail');
    expect(res).toEqual({ success: true, data: runResult });
  });

  it('plugin-remove forwards plugin id and returns the runner CliRunResult', async () => {
    const runResult = { success: true, exitCode: 0, stdout: 'removed' };
    (runPluginRemove as any).mockResolvedValue(runResult);

    const res = await ipc.invoke(IPC_CHANNELS.CODEX_CLI_PLUGIN_REMOVE, 'ponytail@ponytail');

    expect(runPluginRemove).toHaveBeenCalledWith('ponytail@ponytail');
    expect(res).toEqual({ success: true, data: runResult });
  });

  // A failed mutation (e.g. codex missing) still returns the CliRunResult in `data`
  // — the runner reports failure inside CliRunResult, not by throwing.
  it('plugin-add returns a failed CliRunResult in data when the runner reports failure', async () => {
    const runResult = { success: false, error: NOT_FOUND_MSG_CODEX };
    (runPluginAdd as any).mockResolvedValue(runResult);

    const res = await ipc.invoke(IPC_CHANNELS.CODEX_CLI_PLUGIN_ADD, 'ponytail@ponytail');

    expect(res).toEqual({ success: true, data: runResult });
  });
});
