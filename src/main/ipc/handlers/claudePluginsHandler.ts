// claudePluginsHandler — feat-019 read + CLI orchestration for Claude plugin subsystem.
// Read handlers parse ~/.claude/plugins/{installed_plugins.json,known_marketplaces.json,
// marketplaces/<m>/.claude-plugin/marketplace.json,cache/<m>/<p>/<v>/.claude-plugin/plugin.json}.
// CLI handlers delegate to cliRunner.

import { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC_CHANNELS } from '../../../shared/types';
import type {
  ClaudeSettings,
  ClaudeInstalledPlugins,
  ClaudePlugin,
  ClaudePluginAuthor,
  ClaudePluginComponents,
  ClaudeMarketplace,
  ClaudeMarketplaceSource,
  ClaudePluginDiscoveryItem,
  ClaudePluginError,
} from '../../../shared/types';
import { assertSafeName, success, failure, readJsonFile } from './configUtils';
import {
  runMarketplaceAdd,
  runMarketplaceRemove,
  runMarketplaceUpdate,
  runPluginInstall,
  runPluginUninstall,
  runPluginReload,
} from './cliRunner';
import { deletePlugin, deletePluginFile, type DeletePluginOpts } from './claudePluginsDelete';

const OFFICIAL_MARKETPLACE = 'claude-plugins-official';

interface KnownMarketplaceEntry {
  source: ClaudeMarketplaceSource;
  installLocation: string;
  lastUpdated?: string;
  autoUpdate?: boolean;
}

interface MarketplaceJsonFile {
  name?: string;
  description?: string;
  owner?: { name: string; email?: string };
  plugins?: Array<{
    name: string;
    description?: string;
    author?: { name: string; email?: string };
    category?: string;
    homepage?: string;
    source?: unknown;
  }>;
}

interface PluginManifestJson {
  name?: string;
  version?: string;
  description?: string;
  author?: ClaudePluginAuthor;
  homepage?: string;
  repository?: string;
  license?: string;
  category?: string;
}

// Module-level error accumulator (populated by read handlers, drained by getErrors).
const errorBuffer: ClaudePluginError[] = [];

function pushError(e: ClaudePluginError): void {
  // Dedup on (scope, targetId, message)
  const exists = errorBuffer.some(
    (x) => x.scope === e.scope && x.targetId === e.targetId && x.message === e.message
  );
  if (!exists) errorBuffer.push(e);
}

export function _resetErrorBufferForTests(): void {
  errorBuffer.length = 0;
}

async function readPluginManifest(installPath: string): Promise<{ manifest: PluginManifestJson; components: ClaudePluginComponents }> {
  const manifestPath = path.join(installPath, '.claude-plugin', 'plugin.json');
  let manifest: PluginManifestJson = {};
  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(content) as PluginManifestJson;
  } catch {
    // missing manifest → empty fallback
  }

  const components: ClaudePluginComponents = {
    skills: 0,
    agents: 0,
    hooks: 0,
    mcp: false,
    lsp: false,
    monitors: 0,
  };

  // skills/<name>/SKILL.md → count subdirs
  try {
    const entries = await fs.readdir(path.join(installPath, 'skills'), { withFileTypes: true });
    components.skills = entries.filter((e) => e.isDirectory()).length;
  } catch { /* missing dir is fine */ }

  // agents/<name>.md → count files
  try {
    const entries = await fs.readdir(path.join(installPath, 'agents'), { withFileTypes: true });
    components.agents = entries.filter((e) => e.isFile() && e.name.endsWith('.md')).length;
  } catch { /* missing dir is fine */ }

  // hooks/hooks.json → 1 if present
  try {
    await fs.stat(path.join(installPath, 'hooks', 'hooks.json'));
    components.hooks = 1;
  } catch { /* missing file is fine */ }

  // .mcp.json → boolean
  try {
    await fs.stat(path.join(installPath, '.mcp.json'));
    components.mcp = true;
  } catch { /* missing file is fine */ }

  // .lsp.json → boolean
  try {
    await fs.stat(path.join(installPath, '.lsp.json'));
    components.lsp = true;
  } catch { /* missing file is fine */ }

  // monitors/monitors.json → 1 if present
  try {
    await fs.stat(path.join(installPath, 'monitors', 'monitors.json'));
    components.monitors = 1;
  } catch { /* missing file is fine */ }

  return { manifest, components };
}

async function loadInstalledPlugins(configDir: string): Promise<ClaudePlugin[]> {
  const pluginsDir = path.join(configDir, 'plugins');
  const installedPath = path.join(pluginsDir, 'installed_plugins.json');
  const settingsPath = path.join(configDir, 'settings.json');

  const [installedResult, settingsResult] = await Promise.all([
    readJsonFile<ClaudeInstalledPlugins>(installedPath),
    readJsonFile<ClaudeSettings>(settingsPath),
  ]);

  // RC2: missing file → empty (exists:false). RC3: present but error → propagate as ClaudePluginError.
  if (installedResult.exists && installedResult.error) {
    pushError({
      scope: 'plugin',
      targetId: 'installed_plugins.json',
      severity: 'error',
      message: installedResult.error,
      raisedAt: new Date().toISOString(),
    });
    throw new Error(installedResult.error);
  }

  const enabledPlugins = settingsResult.data?.enabledPlugins ?? {};
  const out: ClaudePlugin[] = [];

  if (installedResult.data?.plugins) {
    // Dedupe by (id, scope, projectPath ?? '', installPath) — real-world
    // installed_plugins.json sometimes contains duplicates from CLI re-install
    // races; without dedupe renderer emits duplicate React keys.
    const seen = new Set<string>();
    for (const [pluginId, installs] of Object.entries(installedResult.data.plugins)) {
      const [pluginName = pluginId, marketplace = 'unknown'] = pluginId.split('@');
      for (const install of installs) {
        const dedupeKey = `${pluginId}|${install.scope}|${install.projectPath ?? ''}|${install.installPath}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const enriched: ClaudePlugin = {
          id: pluginId,
          name: pluginName,
          marketplace,
          scope: install.scope,
          projectPath: install.projectPath,
          installPath: install.installPath,
          version: install.version,
          installedAt: install.installedAt,
          lastUpdated: install.lastUpdated,
          gitCommitSha: install.gitCommitSha,
          enabled: enabledPlugins[pluginId] ?? false,
        };

        try {
          const { manifest, components } = await readPluginManifest(install.installPath);
          enriched.description = manifest.description;
          enriched.author = manifest.author;
          enriched.homepage = manifest.homepage;
          enriched.repository = manifest.repository;
          enriched.license = manifest.license;
          enriched.category = manifest.category;
          enriched.components = components;
        } catch {
          // manifest read failures are non-fatal
        }

        out.push(enriched);
      }
    }
  }

  return out;
}

async function loadMarketplaces(configDir: string): Promise<ClaudeMarketplace[]> {
  const knownPath = path.join(configDir, 'plugins', 'known_marketplaces.json');
  const settingsPath = path.join(configDir, 'settings.json');

  const [knownResult, settingsResult] = await Promise.all([
    readJsonFile<Record<string, KnownMarketplaceEntry>>(knownPath),
    readJsonFile<ClaudeSettings>(settingsPath),
  ]);

  if (knownResult.exists && knownResult.error) {
    pushError({
      scope: 'marketplace',
      targetId: 'known_marketplaces.json',
      severity: 'error',
      message: knownResult.error,
      raisedAt: new Date().toISOString(),
    });
  }

  const known = knownResult.data ?? {};
  const extra = (settingsResult.data?.extraKnownMarketplaces ?? {}) as Record<
    string,
    { source: ClaudeMarketplaceSource; autoUpdate?: boolean }
  >;

  const map = new Map<string, ClaudeMarketplace>();

  for (const [name, entry] of Object.entries(known)) {
    const isOfficial = name === OFFICIAL_MARKETPLACE;
    const pluginCount = await countPluginsInMarketplace(entry);
    map.set(name, {
      name,
      source: entry.source,
      installLocation: entry.installLocation,
      lastUpdated: entry.lastUpdated,
      autoUpdate: isOfficial ? true : (entry.autoUpdate ?? false),
      isOfficial,
      pluginCount,
    });
  }

  // RC6: extraKnownMarketplaces declared but not yet materialized → "unsynced"
  for (const [name, entry] of Object.entries(extra)) {
    if (!map.has(name)) {
      map.set(name, {
        name,
        source: entry.source,
        installLocation: '',
        lastUpdated: undefined,
        autoUpdate: entry.autoUpdate ?? false,
        isOfficial: false,
        pluginCount: 0,
        unsynced: true,
      });
    } else {
      const existing = map.get(name);
      if (existing && JSON.stringify(existing.source) !== JSON.stringify(entry.source)) {
        existing.unsynced = true;
      }
    }
  }

  return Array.from(map.values());
}

async function countPluginsInMarketplace(entry: KnownMarketplaceEntry): Promise<number> {
  if (!entry.installLocation) return 0;
  const mPath = path.join(entry.installLocation, '.claude-plugin', 'marketplace.json');
  try {
    const content = await fs.readFile(mPath, 'utf-8');
    const parsed = JSON.parse(content) as MarketplaceJsonFile;
    return parsed.plugins?.length ?? 0;
  } catch {
    return 0;
  }
}

async function loadDiscovery(configDir: string, marketplaceName: string): Promise<ClaudePluginDiscoveryItem[]> {
  const knownPath = path.join(configDir, 'plugins', 'known_marketplaces.json');
  const knownResult = await readJsonFile<Record<string, KnownMarketplaceEntry>>(knownPath);
  const entry = knownResult.data?.[marketplaceName];
  if (!entry) return [];

  const mPath = path.join(entry.installLocation, '.claude-plugin', 'marketplace.json');
  let parsed: MarketplaceJsonFile;
  try {
    const content = await fs.readFile(mPath, 'utf-8');
    parsed = JSON.parse(content) as MarketplaceJsonFile;
  } catch (err) {
    pushError({
      scope: 'marketplace',
      targetId: marketplaceName,
      severity: 'error',
      message: err instanceof Error ? err.message : String(err),
      raisedAt: new Date().toISOString(),
    });
    return [];
  }

  // Determine which plugins are already installed (intersect with installed_plugins.json)
  const installedPath = path.join(configDir, 'plugins', 'installed_plugins.json');
  const installedResult = await readJsonFile<ClaudeInstalledPlugins>(installedPath);
  const installedIds = new Set(Object.keys(installedResult.data?.plugins ?? {}));

  return (parsed.plugins ?? []).map((p) => ({
    name: p.name,
    marketplace: marketplaceName,
    description: p.description,
    author: p.author,
    category: p.category,
    homepage: p.homepage,
    installed: installedIds.has(`${p.name}@${marketplaceName}`),
  }));
}

// Wrap a handler body in the standard try/catch → IpcResponse envelope.
// Keeps registration table compact while preserving "never throw across IPC".
function wrap<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>
): (event: unknown, ...args: Args) => Promise<ReturnType<typeof success<R>> | ReturnType<typeof failure>> {
  return async (_event, ...args) => {
    try { return success(await fn(...args)); }
    catch (err) { return failure(err); }
  };
}

// Delete is split into ./claudePluginsDelete (DV6 patch). Re-imported above.

export function registerClaudePluginsHandler(ipcMain: IpcMain, _home: string): void {
  // Reads (S1-4)
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_CLAUDE_PLUGINS, wrap(loadInstalledPlugins));
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_CLAUDE_MARKETPLACES, wrap(loadMarketplaces));
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_CLAUDE_PLUGIN_DISCOVERY, wrap(async (configDir: string, marketplaceName: string) => {
    assertSafeName(marketplaceName);
    return loadDiscovery(configDir, marketplaceName);
  }));
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_CLAUDE_PLUGIN_ERRORS, wrap(async (configDir: string) => {
    await loadInstalledPlugins(configDir).catch(() => undefined);
    await loadMarketplaces(configDir).catch(() => undefined);
    return [...errorBuffer];
  }));

  // CLI delegations (S1-6) — every handler returns CliRunResult; cliRunner never throws.
  ipcMain.handle(IPC_CHANNELS.CLAUDE_CLI_MARKETPLACE_ADD, wrap((name: string, source: ClaudeMarketplaceSource) => runMarketplaceAdd(name, source)));
  ipcMain.handle(IPC_CHANNELS.CLAUDE_CLI_MARKETPLACE_REMOVE, wrap((name: string) => runMarketplaceRemove(name)));
  ipcMain.handle(IPC_CHANNELS.CLAUDE_CLI_MARKETPLACE_UPDATE, wrap((name: string) => runMarketplaceUpdate(name)));
  ipcMain.handle(IPC_CHANNELS.CLAUDE_CLI_PLUGIN_INSTALL, wrap((pluginId: string, scope: 'user' | 'project' | 'local') => runPluginInstall(pluginId, scope)));
  ipcMain.handle(IPC_CHANNELS.CLAUDE_CLI_PLUGIN_UNINSTALL, wrap((pluginId: string, scope: 'user' | 'project' | 'local') => runPluginUninstall(pluginId, scope)));
  ipcMain.handle(IPC_CHANNELS.CLAUDE_CLI_RELOAD, wrap(() => runPluginReload()));

  // Mutations (DELETE_PLUGIN moved from claudeHandler — S1-7; DV6 patch
  // delegates to cliRunner with file-fallback). 4th arg is optional opts:
  // { scope?, fileFallback? } — undefined args are tolerated by destructure.
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_PLUGIN,
    wrap((configDir: string, pluginId: string, installPath: string, opts?: DeletePluginOpts) =>
      deletePlugin(configDir, pluginId, installPath, opts ?? {}),
    ),
  );
}

// Test-only re-exports
export const _internals = {
  loadInstalledPlugins,
  loadMarketplaces,
  loadDiscovery,
  readPluginManifest,
  deletePlugin,
  deletePluginFile,
};
