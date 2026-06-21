import { useState, useCallback, useEffect } from 'react';
import { Download, Loader2, RefreshCw, Puzzle } from 'lucide-react';
import { toast } from 'sonner';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { ExtensionListLayout } from '@/components/shared/ExtensionListLayout';
import type { CodexPlugin } from '@shared/types';
import { CodexMissingState } from './CodexMissingState';
import { isCodexMissing } from './codexErrors';

interface PluginsTabProps {
  accentColor: string;
}

type StatusFilter = 'all' | 'installed' | 'not-installed';
const STATUS_FILTERS: StatusFilter[] = ['all', 'installed', 'not-installed'];

const INSTALL_HINT =
  'If install needs interactive auth, run `codex plugin add <id>` in a terminal.';

export function PluginsTab({ accentColor }: PluginsTabProps) {
  const [plugins, setPlugins] = useState<CodexPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callElectron(() => electronAPI().config.getCodexPlugins());
      setPlugins(result ?? []);
      setMissing(false);
    } catch (err) {
      if (isCodexMissing(err)) {
        setMissing(true);
        setPlugins([]);
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setPlugins([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleInstall(plugin: CodexPlugin) {
    setBusy(plugin.id);
    setError(null);
    try {
      const result = await callElectron(() => electronAPI().config.codexPluginAdd(plugin.id));
      if (result.success) {
        toast.success('Plugin installed', { description: plugin.id });
        await load();
      } else {
        const reason = result.error ?? result.stderr ?? 'Failed to install plugin';
        setError(`${reason}\n${INSTALL_HINT}`);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to install plugin';
      setError(`${reason}\n${INSTALL_HINT}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(plugin: CodexPlugin) {
    if (!confirm(`Remove plugin "${plugin.id}"?`)) return;
    setBusy(plugin.id);
    setError(null);
    try {
      const result = await callElectron(() => electronAPI().config.codexPluginRemove(plugin.id));
      if (result.success) {
        toast.success('Plugin removed', { description: plugin.id });
        await load();
      } else {
        setError(result.error ?? result.stderr ?? 'Failed to remove plugin');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove plugin');
    } finally {
      setBusy(null);
    }
  }

  const marketplaces = Array.from(new Set(plugins.map((p) => p.marketplace))).sort();

  const filtered = plugins.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (marketplaceFilter !== 'all' && p.marketplace !== marketplaceFilter) return false;
    return true;
  });

  // Group filtered plugins by marketplace for sectioned rendering.
  const groups = new Map<string, CodexPlugin[]>();
  for (const p of filtered) {
    const arr = groups.get(p.marketplace) ?? [];
    arr.push(p);
    groups.set(p.marketplace, arr);
  }

  if (missing) {
    return (
      <div className="flex h-full flex-col">
        <CodexMissingState />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b-whisper px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Plugins ({plugins.length})
        </span>
        <div className="flex gap-1" role="group" aria-label="Status filter">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`rounded px-2 py-0.5 text-xs capitalize transition-colors ${
                statusFilter === f ? 'text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
              style={statusFilter === f ? { background: accentColor } : undefined}
            >
              {f === 'not-installed' ? 'not installed' : f}
            </button>
          ))}
        </div>
        <select
          aria-label="Marketplace filter"
          value={marketplaceFilter}
          onChange={(e) => setMarketplaceFilter(e.target.value)}
          className="h-7 rounded-md border-whisper bg-card px-2 text-xs"
        >
          <option value="all">All marketplaces</option>
          {marketplaces.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7"
          onClick={() => { void load(); }}
          aria-label="Refresh plugins"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {error && (
        <div className="border-b-whisper bg-destructive/10 px-4 py-2 text-xs text-destructive whitespace-pre-line" role="alert">
          {error}
        </div>
      )}

      <ExtensionListLayout
        loading={loading}
        loadingText="Loading plugins…"
        isEmpty={filtered.length === 0}
        emptyTitle="No plugins"
        emptyIcon={<Puzzle className="h-10 w-10 opacity-30" />}
      >
        {Array.from(groups.entries()).map(([marketplace, list]) => (
          <div key={marketplace}>
            <div className="border-b-whisper bg-muted/30 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {marketplace}
            </div>
            {list.map((plugin) => {
              const installed = plugin.status === 'installed';
              const isBusy = busy === plugin.id;
              return (
                <div key={plugin.id} className="flex items-center justify-between border-b-whisper px-4 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-1 shrink-0">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ background: installed ? accentColor : 'var(--text-muted)' }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium">{plugin.id}</span>
                        <span className="badge-notion">{installed ? 'installed' : 'not installed'}</span>
                        {plugin.version && <span className="badge-notion">v{plugin.version}</span>}
                      </div>
                      {plugin.path && (
                        <div className="mt-0.5 text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>
                          {plugin.path}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-2 shrink-0">
                    {installed ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { void handleRemove(plugin); }}
                        disabled={isBusy}
                        aria-label={`Remove ${plugin.id}`}
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Remove
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => { void handleInstall(plugin); }}
                        disabled={isBusy}
                        aria-label={`Install ${plugin.id}`}
                        style={{ background: accentColor }}
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        Install
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </ExtensionListLayout>
    </div>
  );
}
