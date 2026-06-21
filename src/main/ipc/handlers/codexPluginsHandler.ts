// codexPluginsHandler — IPC surface for the Codex Marketplace/Plugins subsystem.
// Reads are hybrid: `codex plugin marketplace list` (full set, incl. built-in) merged
// with user marketplaces declared in config.toml (read-only smol-toml parse). All mutations
// are thin wrappers over codexCliRunner. Never throws across IPC — always returns the
// { success, data? } / { success:false, error } envelope.

import { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { parse as parseToml } from 'smol-toml';
import { IPC_CHANNELS } from '../../../shared/types';
import type { CodexMarketplace, CodexPlugin, CliRunResult } from '../../../shared/types';
import { success, failure } from './configUtils';
import {
  runMarketplaceList,
  runMarketplaceAdd,
  runMarketplaceRemove,
  runMarketplaceUpgrade,
  runPluginList,
  runPluginAdd,
  runPluginRemove,
} from './codexCliRunner';
import { parseCodexMarketplaceList, parseCodexPluginList } from './codexPluginsParse';

// Shape of the `[marketplaces.<name>]` tables we read out of config.toml (snake_case keys).
interface ConfigTomlMarketplaceEntry {
  source?: unknown;
  source_type?: unknown;
  last_updated?: unknown;
}

// Read config.toml and return the user-declared marketplaces keyed by name. Missing file or
// invalid TOML → empty map (the CLI list is still authoritative for built-in marketplaces).
async function readUserMarketplaces(
  configDir: string,
): Promise<Map<string, ConfigTomlMarketplaceEntry>> {
  const map = new Map<string, ConfigTomlMarketplaceEntry>();
  let content: string;
  try {
    content = await fs.readFile(path.join(configDir, 'config.toml'), 'utf-8');
  } catch {
    return map; // missing config.toml → no user marketplaces
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseToml(content) as Record<string, unknown>;
  } catch {
    return map; // invalid TOML → treat as no user marketplaces
  }

  const marketplaces = parsed.marketplaces;
  if (!marketplaces || typeof marketplaces !== 'object') return map;

  for (const [name, value] of Object.entries(marketplaces as Record<string, unknown>)) {
    if (value && typeof value === 'object') {
      map.set(name, value as ConfigTomlMarketplaceEntry);
    }
  }
  return map;
}

function asStringOrUndefined(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

// Throws on codex-missing / CLI failure so the wrap() envelope surfaces the error.
async function getCodexMarketplaces(configDir: string): Promise<CodexMarketplace[]> {
  const listResult = await runMarketplaceList();
  if (!listResult.success) {
    throw new Error(listResult.error ?? 'codex plugin marketplace list failed');
  }

  const cliEntries = parseCodexMarketplaceList(listResult.stdout ?? '');
  const userMarketplaces = await readUserMarketplaces(configDir);

  return cliEntries.map(({ name, root }) => {
    const user = userMarketplaces.get(name);
    if (user) {
      return {
        name,
        root,
        builtin: false,
        source: asStringOrUndefined(user.source),
        sourceType: asStringOrUndefined(user.source_type),
        lastUpdated: asStringOrUndefined(user.last_updated),
      };
    }
    return { name, root, builtin: true };
  });
}

async function getCodexPlugins(): Promise<CodexPlugin[]> {
  const listResult = await runPluginList();
  if (!listResult.success) {
    throw new Error(listResult.error ?? 'codex plugin list failed');
  }
  return parseCodexPluginList(listResult.stdout ?? '');
}

// Wrap a handler body in the standard try/catch → IpcResponse envelope.
function wrap<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
): (event: unknown, ...args: Args) => Promise<ReturnType<typeof success<R>> | ReturnType<typeof failure>> {
  return async (_event, ...args) => {
    try { return success(await fn(...args)); }
    catch (err) { return failure(err); }
  };
}

export function registerCodexPluginsHandler(ipcMain: IpcMain, _home: string): void {
  // Reads — hybrid marketplace merge + plugin table parse.
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_CODEX_MARKETPLACES, wrap((configDir: string) => getCodexMarketplaces(configDir)));
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_CODEX_PLUGINS, wrap(() => getCodexPlugins()));

  // Mutations — thin wrappers over codexCliRunner; each returns CliRunResult as data.
  // codexCliRunner never throws, so these always resolve to a CliRunResult envelope.
  ipcMain.handle(IPC_CHANNELS.CODEX_CLI_MARKETPLACE_ADD, wrap((source: string, ref?: string): Promise<CliRunResult> => runMarketplaceAdd(source, ref)));
  ipcMain.handle(IPC_CHANNELS.CODEX_CLI_MARKETPLACE_REMOVE, wrap((name: string): Promise<CliRunResult> => runMarketplaceRemove(name)));
  ipcMain.handle(IPC_CHANNELS.CODEX_CLI_MARKETPLACE_UPGRADE, wrap((name?: string): Promise<CliRunResult> => runMarketplaceUpgrade(name)));
  ipcMain.handle(IPC_CHANNELS.CODEX_CLI_PLUGIN_ADD, wrap((pluginId: string): Promise<CliRunResult> => runPluginAdd(pluginId)));
  ipcMain.handle(IPC_CHANNELS.CODEX_CLI_PLUGIN_REMOVE, wrap((pluginId: string): Promise<CliRunResult> => runPluginRemove(pluginId)));
}

// Test-only re-exports.
export const _internals = {
  getCodexMarketplaces,
  getCodexPlugins,
  readUserMarketplaces,
};
