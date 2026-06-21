import { useState, useCallback, useEffect } from 'react';
import { Plus, RefreshCw, Trash2, Store, X } from 'lucide-react';
import { toast } from 'sonner';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CodexMarketplace } from '@shared/types';
import { CodexMissingState } from './CodexMissingState';
import { isCodexMissing } from './codexErrors';

interface MarketplacesTabProps {
  configDir: string;
  accentColor: string;
}

export function MarketplacesTab({ configDir, accentColor }: MarketplacesTabProps) {
  const [items, setItems] = useState<CodexMarketplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [source, setSource] = useState('');
  const [ref, setRef] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callElectron(() => electronAPI().config.getCodexMarketplaces(configDir));
      setItems(result ?? []);
      setMissing(false);
    } catch (err) {
      if (isCodexMissing(err)) {
        setMissing(true);
        setItems([]);
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [configDir]);

  useEffect(() => { void load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const src = source.trim();
    if (!src) return;
    const refArg = ref.trim() || undefined;
    setBusy('add');
    setError(null);
    try {
      const result = await callElectron(() => electronAPI().config.codexMarketplaceAdd(src, refArg));
      if (result.success) {
        toast.success('Marketplace added', { description: src });
        setSource('');
        setRef('');
        setShowAdd(false);
        await load();
      } else {
        setError(result.error ?? result.stderr ?? 'Failed to add marketplace');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add marketplace');
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(m: CodexMarketplace) {
    if (m.builtin) return;
    if (!confirm(`Remove marketplace "${m.name}"?`)) return;
    setBusy(m.name);
    setError(null);
    try {
      const result = await callElectron(() => electronAPI().config.codexMarketplaceRemove(m.name));
      if (result.success) {
        toast.success('Marketplace removed', { description: m.name });
        await load();
      } else {
        setError(result.error ?? result.stderr ?? 'Failed to remove marketplace');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove marketplace');
    } finally {
      setBusy(null);
    }
  }

  async function handleUpgrade(m: CodexMarketplace) {
    if (m.builtin) return;
    setBusy(m.name);
    setError(null);
    try {
      const result = await callElectron(() => electronAPI().config.codexMarketplaceUpgrade(m.name));
      if (result.success) {
        toast.success('Marketplace upgraded', { description: m.name });
        await load();
      } else {
        setError(result.error ?? result.stderr ?? 'Failed to upgrade marketplace');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade marketplace');
    } finally {
      setBusy(null);
    }
  }

  const userItems = items.filter((m) => !m.builtin);
  const builtinItems = items.filter((m) => m.builtin);

  if (missing) {
    return (
      <div className="flex h-full flex-col">
        <CodexMissingState />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b-whisper px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Marketplaces ({items.length})
        </span>
        <Button
          size="sm"
          onClick={() => setShowAdd((v) => !v)}
          aria-label="Add Marketplace"
          style={{ background: accentColor }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Marketplace
        </Button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="border-b-whisper bg-card px-4 py-3 flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="codex-mp-source">Source (owner/repo or git URL)</Label>
            <Input
              id="codex-mp-source"
              className="bg-background"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="DietrichGebert/ponytail"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="codex-mp-ref">Ref (branch / tag, optional)</Label>
            <Input
              id="codex-mp-ref"
              className="bg-background"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="main"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(false)}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!source.trim() || busy === 'add'}>
              {busy === 'add' ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </form>
      )}

      {error && (
        <div className="border-b-whisper bg-destructive/10 px-4 py-2 text-xs text-destructive" role="alert">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {loading && <div className="text-sm text-muted-foreground">Loading marketplaces…</div>}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Store className="h-10 w-10 opacity-30" />
            <div className="text-sm">No marketplaces registered</div>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Your marketplaces ({userItems.length})
              </h3>
              {userItems.length === 0 ? (
                <div className="text-xs text-muted-foreground">No user marketplaces yet.</div>
              ) : (
                userItems.map((m) => (
                  <Card key={m.name} className="border-whisper p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold">{m.name}</span>
                          {m.sourceType && <span className="badge-notion">{m.sourceType}</span>}
                        </div>
                        {m.source && (
                          <div className="mt-1 text-xs text-muted-foreground break-all">{m.source}</div>
                        )}
                        <div className="mt-1 text-[10px] text-muted-foreground break-all font-mono">{m.root}</div>
                        {m.lastUpdated && (
                          <div className="mt-1 text-[10px] text-muted-foreground">Updated {m.lastUpdated}</div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { void handleUpgrade(m); }}
                          disabled={busy === m.name}
                          aria-label={`Upgrade ${m.name}`}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Upgrade
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { void handleRemove(m); }}
                          disabled={busy === m.name}
                          aria-label={`Remove ${m.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Built-in ({builtinItems.length})
              </h3>
              {builtinItems.length === 0 ? (
                <div className="text-xs text-muted-foreground">No built-in marketplaces.</div>
              ) : (
                builtinItems.map((m) => (
                  <Card key={m.name} className="border-whisper p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold">{m.name}</span>
                          <span className="badge-notion">Built-in</span>
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground break-all font-mono">{m.root}</div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
