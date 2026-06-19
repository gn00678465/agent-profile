import { useState, useEffect, useCallback } from 'react';
import { Search, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { ClaudeMarketplace, ClaudePluginDiscoveryItem } from '@shared/types';

interface DiscoverTabProps {
  configDir: string;
}

type Scope = 'user' | 'project' | 'local';
const SCOPES: Scope[] = ['user', 'project', 'local'];

export function DiscoverTab({ configDir }: DiscoverTabProps) {
  const [marketplaces, setMarketplaces] = useState<ClaudeMarketplace[]>([]);
  const [selectedMp, setSelectedMp] = useState<string | null>(null);
  const [items, setItems] = useState<ClaudePluginDiscoveryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [scopeChooser, setScopeChooser] = useState<{ pluginId: string; name: string } | null>(null);
  const [chosenScope, setChosenScope] = useState<Scope>('user');

  useEffect(() => {
    void (async () => {
      try {
        const list = await callElectron(() => electronAPI().config.getClaudeMarketplaces(configDir));
        setMarketplaces(list ?? []);
      } catch {
        setMarketplaces([]);
      }
    })();
  }, [configDir]);

  const load = useCallback(async (mpName: string) => {
    setLoading(true);
    try {
      const result = await callElectron(() =>
        electronAPI().config.getClaudePluginDiscovery(configDir, mpName)
      );
      setItems(result ?? []);
    } catch (err) {
      toast.error('Failed to load discovery', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [configDir]);

  useEffect(() => {
    if (selectedMp) void load(selectedMp);
  }, [selectedMp, load]);

  function openScopeChooser(item: ClaudePluginDiscoveryItem) {
    const pluginId = `${item.name}@${item.marketplace}`;
    setScopeChooser({ pluginId, name: item.name });
    setChosenScope('user');
  }

  async function confirmInstall() {
    if (!scopeChooser) return;
    const { pluginId } = scopeChooser;
    setInstalling(pluginId);
    setScopeChooser(null);
    try {
      const result = await callElectron(() =>
        electronAPI().claudeCli.pluginInstall(pluginId, chosenScope)
      );
      if (result.success) {
        const stdoutTail = (result.stdout ?? '').split('\n').slice(-4).filter(Boolean).join('\n');
        toast.success(`Installed ${pluginId}`, {
          description: stdoutTail || `scope: ${chosenScope}`,
        });
        if (selectedMp) await load(selectedMp);
      } else {
        toast.error(`Failed to install ${pluginId}`, {
          description: result.error ?? result.stderr ?? 'CLI exited non-zero',
        });
      }
    } finally {
      setInstalling(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b-whisper px-4 py-2">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Discover Plugins
        </div>
        <div className="flex flex-wrap gap-2">
          {marketplaces.map((m) => (
            <button
              key={m.name}
              type="button"
              onClick={() => setSelectedMp(m.name)}
              className={
                selectedMp === m.name
                  ? 'rounded-md border-whisper bg-accent px-3 py-1 text-xs'
                  : 'rounded-md border-whisper bg-card px-3 py-1 text-xs hover:bg-accent/50'
              }
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!selectedMp && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Search className="h-10 w-10 opacity-30" />
            <div className="text-sm">Select a marketplace to discover plugins</div>
          </div>
        )}
        {selectedMp && loading && (
          <div className="text-sm text-muted-foreground">Loading discovery…</div>
        )}
        {selectedMp && !loading && items.length === 0 && (
          <div className="text-sm text-muted-foreground">No plugins available in this marketplace.</div>
        )}
        {selectedMp && !loading && items.length > 0 && (
          <div className="grid gap-3">
            {items.map((item) => {
              const pluginId = `${item.name}@${item.marketplace}`;
              const isInstalling = installing === pluginId;
              return (
                <Card key={pluginId} className="border-whisper p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold">{item.name}</span>
                        {item.category && <span className="badge-notion">{item.category}</span>}
                        {item.installed && <span className="badge-notion">installed</span>}
                      </div>
                      {item.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                          {item.description}
                        </p>
                      )}
                      {item.author?.name && (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          by {item.author.name}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openScopeChooser(item)}
                      disabled={item.installed || isInstalling}
                      aria-label={`Install ${item.name}`}
                    >
                      {isInstalling ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Installing…
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5" />
                          {item.installed ? 'Installed' : 'Install'}
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!scopeChooser} onOpenChange={(o) => !o && setScopeChooser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Install scope</DialogTitle>
            <DialogDescription>
              Choose where to install {scopeChooser?.name}.
            </DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Install scope" className="flex flex-col gap-2">
            {SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={chosenScope === s}
                onClick={() => setChosenScope(s)}
                className={
                  chosenScope === s
                    ? 'flex items-center justify-between rounded-md border-whisper bg-accent px-3 py-2 text-sm'
                    : 'flex items-center justify-between rounded-md border-whisper bg-card px-3 py-2 text-sm hover:bg-accent/50'
                }
              >
                <span className="capitalize font-medium">{s}</span>
                <span className="text-xs text-muted-foreground">
                  {s === 'user' && '~/.claude/'}
                  {s === 'project' && './.claude/'}
                  {s === 'local' && 'project (untracked)'}
                </span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScopeChooser(null)}>Cancel</Button>
            <Button onClick={() => { void confirmInstall(); }}>Install</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
