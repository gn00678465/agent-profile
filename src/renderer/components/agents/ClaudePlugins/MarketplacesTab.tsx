import { useState, useCallback, useEffect } from 'react';
import { Plus, RefreshCw, Trash2, Store } from 'lucide-react';
import { toast } from 'sonner';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import type { ClaudeMarketplace, ClaudeMarketplaceSource } from '@shared/types';
import { MarketplaceDialog } from './MarketplaceDialog';

interface MarketplacesTabProps {
  configDir: string;
  onChanged?: () => void;
}

function sourceLabel(s: ClaudeMarketplaceSource): string {
  switch (s.source) {
    case 'github':     return s.repo;
    case 'git':        return s.url;
    case 'git-subdir': return `${s.url} :: ${s.path}`;
    case 'url':        return s.url;
    case 'directory':  return s.path;
    default:           return 'unknown';
  }
}

export function MarketplacesTab({ configDir, onChanged }: MarketplacesTabProps) {
  const [items, setItems] = useState<ClaudeMarketplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callElectron(() => electronAPI().config.getClaudeMarketplaces(configDir));
      setItems(result ?? []);
    } catch (err) {
      toast.error('Failed to load marketplaces', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [configDir]);

  useEffect(() => { void load(); }, [load]);

  async function handleAdd(name: string, source: ClaudeMarketplaceSource) {
    setBusy('add');
    try {
      const result = await callElectron(() => electronAPI().claudeCli.marketplaceAdd(name, source));
      if (result.success) {
        toast.success('Marketplace added', { description: name });
        await load();
        onChanged?.();
        setDialogOpen(false);
      } else {
        toast.error('Failed to add marketplace', { description: result.error ?? result.stderr ?? 'Unknown error' });
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(m: ClaudeMarketplace) {
    if (m.isOfficial) return;
    if (!confirm(`Remove marketplace "${m.name}"?`)) return;
    setBusy(m.name);
    try {
      const result = await callElectron(() => electronAPI().claudeCli.marketplaceRemove(m.name));
      if (result.success) {
        toast.success('Marketplace removed', { description: m.name });
        await load();
        onChanged?.();
      } else {
        toast.error('Failed to remove marketplace', { description: result.error ?? result.stderr ?? 'Unknown error' });
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleUpdate(m: ClaudeMarketplace) {
    setBusy(m.name);
    try {
      const result = await callElectron(() => electronAPI().claudeCli.marketplaceUpdate(m.name));
      if (result.success) {
        toast.success('Marketplace updated', { description: m.name });
        await load();
      } else {
        toast.error('Failed to update marketplace', { description: result.error ?? result.stderr ?? 'Unknown error' });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b-whisper px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Marketplaces ({items.length})
        </span>
        <Button size="sm" onClick={() => setDialogOpen(true)} aria-label="Add Marketplace">
          <Plus className="h-3.5 w-3.5" />
          Add Marketplace
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="text-sm text-muted-foreground">Loading marketplaces…</div>
        )}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Store className="h-10 w-10 opacity-30" />
            <div className="text-sm">No marketplaces registered</div>
          </div>
        )}
        {!loading && items.length > 0 && (
          <div className="flex flex-col gap-3">
            {items.map((m) => (
              <Card key={m.name} className="border-whisper p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{m.name}</span>
                      {m.isOfficial && <span className="badge-notion">Built-in</span>}
                      {m.unsynced && (
                        <span className="badge-notion" title="extraKnownMarketplaces declared but not yet materialized">
                          unsynced
                        </span>
                      )}
                      <span className="badge-notion">{m.source.source}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground break-all">
                      {sourceLabel(m.source)}
                    </div>
                    {m.installLocation && (
                      <div className="mt-1 text-[10px] text-muted-foreground break-all font-mono">
                        {m.installLocation}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{m.pluginCount} plugins</span>
                      <span>·</span>
                      <span>auto-update</span>
                      <Switch
                        checked={m.autoUpdate}
                        disabled={m.isOfficial}
                        aria-label={`auto-update for ${m.name}`}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { void handleUpdate(m); }}
                      disabled={busy === m.name}
                      aria-label={`Update ${m.name}`}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Update
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { void handleRemove(m); }}
                      disabled={m.isOfficial || busy === m.name}
                      aria-label={`Remove ${m.name}`}
                      title={m.isOfficial ? 'Built-in marketplace cannot be removed' : undefined}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <MarketplaceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(name, source) => { void handleAdd(name, source); }}
        busy={busy === 'add'}
      />
    </div>
  );
}
