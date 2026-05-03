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

  async function handleDelete(plugin: ClaudePlugin) {
    const confirmed = confirm(`Delete plugin "${plugin.name}" (${plugin.scope})?\n\nThis will remove the plugin config and its install folder.`);
    if (!confirmed) return;
    try {
      await callElectron(() =>
        electronAPI().config.deletePlugin(configDir, plugin.id, plugin.installPath)
      );
      setPlugins((prev) => prev.filter((p) => !(p.id === plugin.id && p.installPath === plugin.installPath)));
      if (selected?.id === plugin.id && selected?.installPath === plugin.installPath) {
        setSelected(null);
      }
      toast.success('Plugin deleted', { description: plugin.id });
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
        {filtered.map((plugin) => (
          <ExtensionRow
            key={`${plugin.id}-${plugin.scope}-${plugin.installPath}`}
            name={plugin.name}
            enabled={plugin.enabled ?? false}
            accentColor={accentColor}
            subtitle={
              <span className="flex items-center gap-2">
                <span className="font-mono">v{plugin.version?.slice(0, 8)}</span>
                <span>·</span>
                <span>{plugin.marketplace}</span>
              </span>
            }
            badge={<span className="badge-notion">{plugin.scope}</span>}
            deleteLabel="Delete plugin"
            onToggle={(v) => { void handleToggle(plugin.id, v); }}
            onClick={() =>
              setSelected(
                selected?.id === plugin.id && selected.scope === plugin.scope ? null : plugin
              )
            }
            selected={selected?.id === plugin.id && selected?.scope === plugin.scope}
            showChevron
            onDelete={() => { void handleDelete(plugin); }}
          />
        ))}
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
