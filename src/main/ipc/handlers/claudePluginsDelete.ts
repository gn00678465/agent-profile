// claudePluginsDelete — DV6 (feat-019 round-3 patch).
// Default delete path is `claude plugin uninstall <id> --scope <scope>`
// via cliRunner; file-based delete is the fallback for missing CLI,
// directory-source plugins, or explicit opt-in. Split out from
// claudePluginsHandler so the latter stays under the 400-line cap.

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { assertSafePath, assertSafeName, readJsonFile, writeJsonFile } from './configUtils';
import { runPluginUninstall } from './cliRunner';
import type { ClaudeInstalledPlugins, ClaudeSettings } from '../../../shared/types';

export interface DeletePluginOpts {
  scope?: 'user' | 'project' | 'local';
  fileFallback?: boolean;
}

export interface DeletePluginResult {
  via: 'cli' | 'file';
  cli?: { stdout?: string; stderr?: string };
}

// File-based fallback. Skips fs.rm when another install record (different
// projectPath, same installPath — sentry-skills/harness scenario) still
// references the same path; otherwise it would dangle the sibling.
export async function deletePluginFile(configDir: string, pluginId: string, installPath: string): Promise<void> {
  assertSafeName(pluginId);
  assertSafePath(installPath, os.homedir());
  const installedPath = path.join(configDir, 'plugins', 'installed_plugins.json');
  const installedResult = await readJsonFile<ClaudeInstalledPlugins>(installedPath);

  if (installedResult.data?.plugins?.[pluginId]) {
    const installs = installedResult.data.plugins[pluginId].filter((i) => i.installPath !== installPath);
    if (installs.length === 0) delete installedResult.data.plugins[pluginId];
    else installedResult.data.plugins[pluginId] = installs;
    await writeJsonFile(installedPath, installedResult.data);
  }

  const remaining = installedResult.data?.plugins?.[pluginId];
  if (!remaining || remaining.length === 0) {
    const settingsPath = path.join(configDir, 'settings.json');
    try {
      const settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8')) as ClaudeSettings;
      if (settings.enabledPlugins?.[pluginId] !== undefined) {
        delete settings.enabledPlugins[pluginId];
        await writeJsonFile(settingsPath, settings);
      }
    } catch { /* settings file may not exist */ }
  }

  const reread = await readJsonFile<ClaudeInstalledPlugins>(installedPath);
  const sharingPaths = new Set<string>();
  for (const installs of Object.values(reread.data?.plugins ?? {})) {
    for (const i of installs) sharingPaths.add(i.installPath);
  }
  if (!sharingPaths.has(installPath)) {
    await fs.rm(installPath, { recursive: true, force: true });
  }
}

export async function deletePlugin(
  configDir: string,
  pluginId: string,
  installPath: string,
  opts: DeletePluginOpts = {},
): Promise<DeletePluginResult> {
  if (opts.fileFallback) {
    await deletePluginFile(configDir, pluginId, installPath);
    return { via: 'file' };
  }
  const cli = await runPluginUninstall(pluginId, opts.scope ?? 'user');
  if (cli.success) return { via: 'cli', cli: { stdout: cli.stdout, stderr: cli.stderr } };
  // CLI failed → fall back to file delete; surface CLI stderr for caller toast.
  await deletePluginFile(configDir, pluginId, installPath);
  return { via: 'file', cli: { stdout: cli.stdout, stderr: cli.stderr } };
}
