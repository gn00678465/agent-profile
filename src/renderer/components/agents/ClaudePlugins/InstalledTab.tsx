import { useState, useCallback } from 'react';
import { Puzzle } from 'lucide-react';
import { toast } from 'sonner';
import { callElectron, electronAPI } from '@/lib/electron';
import { Switch } from '@/components/ui/switch';
import { useItemLoader } from '@/hooks/useItemLoader';
import { ExtensionListLayout } from '@/components/shared/ExtensionListLayout';
import { ExtensionRow } from '@/components/shared/ExtensionRow';
import type { ClaudePlugin } from '@shared/types';
import { FilterToolbar, type FilterValue } from './FilterToolbar';
import { PluginManifestPanel } from './PluginManifestPanel';

interface InstalledTabProps {
  configDir: string;
  accentColor: string;
}

type ScopeFilter = FilterValue | 'local';

export function InstalledTab({ configDir, accentColor }: InstalledTabProps) {
  const [selected, setSelected] = useState<ClaudePlugin | null>(null);
  const [filter, setFilter] = useState<ScopeFilter>('all');

  const loadFn = useCallback(async (): Promise<ClaudePlugin[]> => {
    try {
      return await callElectron(() =>
        electronAPI().config.getClaudePlugins(configDir)
      );
    } catch (err) {
      toast.error('Failed to load plugins', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      return [];
    }
  }, [configDir]);

  const { items: plugins, loading, setItems: setPlugins, load } = useItemLoader(loadFn);

  async function handleToggle(pluginId: string, enabled: boolean) {
    try {
      await callElectron(() =>
        electronAPI().config.setPluginEnabled(configDir, pluginId, enabled)
      );
      setPlugins((prev) =>
        prev.map((p) => (p.id === pluginId ? { ...p, enabled } : p))
      );
      if (selected?.id === pluginId) {
        setSelected((prev) => (prev ? { ...prev, enabled } : prev));
      }
      toast.success(`Plugin ${enabled ? 'enabled' : 'disabled'}`, { description: pluginId });
    } catch (err) {
      toast.error('Failed to update plugin', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  function sameInstall(a: ClaudePlugin, b: ClaudePlugin): boolean {
    return a.id === b.id && a.scope === b.scope && a.projectPath === b.projectPath && a.installPath === b.installPath;
  }

  // Heuristic for directory-source plugins: their installPath is the user's
  // own project root (e.g., D:\Projects\harness-helper) instead of being
  // under ~/.claude/plugins/cache/. Detect by checking if installPath
  // contains the standard cache fragment. False negatives are safe (extra
  // confirmation only); false positives would be unsafe (skip warning).
  function isDirectorySource(p: ClaudePlugin): boolean {
    return !p.installPath.includes('plugins\\cache\\') && !p.installPath.includes('plugins/cache/');
  }

  async function handleDelete(plugin: ClaudePlugin) {
    const projectHint = plugin.projectPath ? ` @ ${plugin.projectPath}` : '';
    const dirSource = isDirectorySource(plugin);
    const baseMsg = `Delete plugin "${plugin.name}" (${plugin.scope}${projectHint})?`;
    const tail = dirSource
      ? `\n\n⚠ This is a directory-source plugin. Install path is\n  ${plugin.installPath}\n— probably your own project. The CLI will only unregister it; the folder will NOT be deleted.`
      : `\n\nThis runs \`claude plugin uninstall ${plugin.id} --scope ${plugin.scope}\` and removes the plugin config + cache folder. If the CLI is unavailable, falls back to local file delete.`;
    const confirmed = confirm(baseMsg + tail);
    if (!confirmed) return;
    try {
      const cliScope = (plugin.scope === 'managed' ? 'user' : plugin.scope) as 'user' | 'project' | 'local';
      const result = await callElectron(() =>
        electronAPI().config.deletePlugin(configDir, plugin.id, plugin.installPath, {
          scope: cliScope,
          fileFallback: dirSource, // directory-source: skip CLI, use file path (which respects assertSafePath + share-check)
        })
      );
      setPlugins((prev) => prev.filter((p) => !sameInstall(p, plugin)));
      if (selected && sameInstall(selected, plugin)) {
        setSelected(null);
      }
      const via = result?.via === 'cli' ? 'via CLI' : 'via local file delete';
      toast.success(`Plugin deleted ${via}`, { description: plugin.id });
    } catch (err) {
      toast.error('Failed to delete plugin', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  const filtered = plugins.filter((p) => {
    if (filter === 'all') return true;
    return p.scope === filter;
  });

  return (
    <div className="flex h-full overflow-hidden">
      <ExtensionListLayout
        loading={loading}
        loadingText="Loading plugins..."
        isEmpty={filtered.length === 0}
        emptyTitle="No plugins installed"
        emptyIcon={<Puzzle className="h-10 w-10 opacity-30" />}
        toolbar={
          <div className="flex flex-col">
            <FilterToolbar
              filter={filter === 'local' ? 'all' : filter}
              count={plugins.length}
              onChange={(f) => setFilter(f)}
              onRefresh={() => { void load(); }}
              accentColor={accentColor}
            />
            <div className="flex items-center justify-end gap-2 border-b-whisper px-4 py-1.5">
              <span className="text-xs text-muted-foreground">Local only</span>
              <Switch
                checked={filter === 'local'}
                onCheckedChange={(v) => setFilter(v ? 'local' : 'all')}
              />
            </div>
          </div>
        }
      >
        {filtered.map((plugin) => {
          const projectLabel = plugin.projectPath ? plugin.projectPath.split(/[\\/]/).pop() : undefined;
          const isSelected = !!selected && sameInstall(selected, plugin);
          return (
            <ExtensionRow
              key={`${plugin.id}-${plugin.scope}-${plugin.projectPath ?? ''}-${plugin.installPath}`}
              name={plugin.name}
              enabled={plugin.enabled ?? false}
              accentColor={accentColor}
              subtitle={
                <span className="flex items-center gap-2">
                  <span className="font-mono">v{plugin.version?.slice(0, 8)}</span>
                  <span>·</span>
                  <span>{plugin.marketplace}</span>
                  {projectLabel && (
                    <>
                      <span>·</span>
                      <span className="font-mono" title={plugin.projectPath}>{projectLabel}</span>
                    </>
                  )}
                </span>
              }
              badge={<span className="badge-notion">{plugin.scope}</span>}
              deleteLabel="Delete plugin"
              onToggle={(v) => { void handleToggle(plugin.id, v); }}
              onClick={() => setSelected(isSelected ? null : plugin)}
              selected={isSelected}
              showChevron
              onDelete={() => { void handleDelete(plugin); }}
            />
          );
        })}
      </ExtensionListLayout>

      {selected && (
        <PluginManifestPanel
          plugin={selected}
          onToggle={(id, enabled) => { void handleToggle(id, enabled); }}
          onDelete={(p) => { void handleDelete(p); }}
          accentColor={accentColor}
        />
      )}
    </div>
  );
}
