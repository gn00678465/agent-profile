import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronRight, Puzzle } from 'lucide-react';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { RemoveButton } from '@/components/ui/remove-button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { ClaudePlugin } from '@shared/types';

interface ClaudePluginsProps {
  configDir: string;
  accentColor: string;
}

const SCOPE_COLORS: Record<string, string> = {
  user: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  project: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

interface PluginDetailProps {
  plugin: ClaudePlugin;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (plugin: ClaudePlugin) => void;
  accentColor: string;
}

function PluginDetail({ plugin, onToggle, onDelete, accentColor }: PluginDetailProps) {
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      onToggle(plugin.id, !plugin.enabled);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="border-l border-border bg-[var(--bg-surface)] flex flex-col" style={{ minWidth: 320, maxWidth: 360 }}>
      <div className="border-b border-border px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Plugin Detail</span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {/* Header */}
        <div>
          <div className="font-mono text-sm font-semibold" style={{ color: accentColor }}>
            {plugin.name}
          </div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">{plugin.id}</div>
        </div>

        {/* Metadata */}
        <div className="flex flex-col gap-2 rounded border border-border/60 bg-[var(--bg-raised)] p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span className="font-mono">{plugin.version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Scope</span>
            <span className={`rounded border px-1.5 py-0.5 text-xs ${SCOPE_COLORS[plugin.scope] ?? ''}`}>
              {plugin.scope}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Marketplace</span>
            <span className="font-mono">{plugin.marketplace}</span>
          </div>
          {plugin.installedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Installed</span>
              <span className="font-mono">{new Date(plugin.installedAt).toLocaleDateString()}</span>
            </div>
          )}
          {plugin.lastUpdated && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span className="font-mono">{new Date(plugin.lastUpdated).toLocaleDateString()}</span>
            </div>
          )}
          {plugin.gitCommitSha && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Commit</span>
              <span className="font-mono">{plugin.gitCommitSha.slice(0, 8)}</span>
            </div>
          )}
        </div>

        {/* Install path */}
        {plugin.installPath && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Install Path</span>
            <span className="break-all font-mono text-[10px] text-muted-foreground">{plugin.installPath}</span>
          </div>
        )}

        {/* Enable toggle */}
        <div className="flex items-center justify-between rounded border border-border/60 bg-[var(--bg-raised)] px-3 py-2">
          <span className="text-sm">Enabled</span>
          <Switch
            checked={plugin.enabled ?? false}
            disabled={toggling}
            onCheckedChange={() => { void handleToggle(); }}
          />
        </div>

        {/* Delete */}
        <RemoveButton
          variant="panel"
          label="Delete Plugin"
          onClick={() => onDelete(plugin)}
        />
      </div>
    </div>
  );
}

export function ClaudePluginsView({ configDir, accentColor }: ClaudePluginsProps) {
  const [plugins, setPlugins] = useState<ClaudePlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ClaudePlugin | null>(null);
  const [filter, setFilter] = useState<'all' | 'user' | 'project'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callElectron(() =>
        electronAPI().config.getClaudePlugins(configDir)
      );
      setPlugins(result);
    } catch (err) {
      toast.error('Failed to load plugins', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [configDir]);

  useEffect(() => { void load(); }, [load]);

  async function handleToggle(pluginId: string, enabled: boolean) {
    try {
      await callElectron(() =>
        electronAPI().config.setPluginEnabled(configDir, pluginId, enabled)
      );
      setPlugins((prev) =>
        prev.map((p) => (p.id === pluginId ? { ...p, enabled } : p))
      );
      if (selected?.id === pluginId) {
        setSelected((prev) => prev ? { ...prev, enabled } : prev);
      }
      toast.success(`Plugin ${enabled ? 'enabled' : 'disabled'}`, {
        description: pluginId,
      });
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

  const filtered = plugins.filter((p) =>
    filter === 'all' ? true : p.scope === filter
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading plugins...
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Plugin list */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Installed Plugins ({plugins.length})
            </span>
            {/* Filter pills */}
            <div className="flex gap-1">
              {(['all', 'user', 'project'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded px-2 py-0.5 text-xs capitalize transition-colors ${
                    filter === f
                      ? 'text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  style={filter === f ? { background: accentColor } : undefined}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { void load(); }}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Puzzle className="h-10 w-10 opacity-30" />
            <p className="text-sm">No plugins installed</p>
          </div>
        )}

        <ScrollArea className="flex-1">
          {filtered.map((plugin) => (
            <div
              role="button"
              tabIndex={0}
              key={`${plugin.id}-${plugin.scope}-${plugin.installPath}`}
              onClick={() => setSelected(selected?.id === plugin.id && selected.scope === plugin.scope ? null : plugin)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected(selected?.id === plugin.id && selected.scope === plugin.scope ? null : plugin); }}
              className={`group flex w-full cursor-pointer items-center justify-between border-b border-border/50 px-4 py-3 text-left transition-colors ${
                selected?.id === plugin.id && selected?.scope === plugin.scope
                  ? 'bg-accent/60'
                  : 'hover:bg-accent/30'
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                {/* Enable indicator */}
                <div className="mt-1 shrink-0">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ background: plugin.enabled ? accentColor : 'var(--text-muted)' }}
                  />
                </div>
                {/* Content */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{plugin.name}</span>
                    <span className={`rounded border px-1.5 py-0 text-[10px] ${SCOPE_COLORS[plugin.scope] ?? ''}`}>
                      {plugin.scope}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">v{plugin.version?.slice(0, 8)}</span>
                    <span>·</span>
                    <span>{plugin.marketplace}</span>
                  </div>
                </div>
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-2">
                <Switch
                  checked={plugin.enabled ?? false}
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={(v) => { void handleToggle(plugin.id, v); }}
                />
                <RemoveButton
                  label="Delete plugin"
                  onClick={(e) => { e.stopPropagation(); void handleDelete(plugin); }}
                />
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Detail panel */}
      {selected && (
        <PluginDetail
          plugin={selected}
          onToggle={(id, enabled) => { void handleToggle(id, enabled); }}
          onDelete={(p) => { void handleDelete(p); }}
          accentColor={accentColor}
        />
      )}
    </div>
  );
}
