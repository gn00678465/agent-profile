import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { callElectron, electronAPI } from '@/lib/electron';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface GeminiExtensionsProps {
  configDir: string;
  accentColor: string;
}

export function GeminiExtensionsView({ configDir, accentColor }: GeminiExtensionsProps) {
  const [exts, setExts] = useState<Array<{ name: string; enabled: boolean; description?: string; version?: string }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await callElectron(() => electronAPI().config.getGeminiExtensions(configDir));
      setExts(d.extensions);
    } catch {
      toast.error('Failed to load extensions');
    } finally {
      setLoading(false);
    }
  }, [configDir]);

  useEffect(() => { void load(); }, [load]);

  async function handleDelete(ext: { name: string }) {
    const confirmed = confirm(`Delete extension "${ext.name}"?\n\nThis will remove the enablement entry and the extension folder.`);
    if (!confirmed) return;
    try {
      await callElectron(() =>
        electronAPI().config.deleteGeminiExtension(configDir, ext.name)
      );
      setExts((prev) => prev.filter((e) => e.name !== ext.name));
      toast.success('Extension deleted', { description: ext.name });
    } catch (err) {
      toast.error('Failed to delete extension', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  if (loading) return <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Loading extensions...</div>;

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-4 p-6">
        <div>
          <h2 className="text-sm font-semibold">Gemini Extensions</h2>
          <p className="text-xs text-muted-foreground">{configDir}/extensions/</p>
        </div>
        {exts.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No extensions installed.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {exts.map((ext) => (
              <div key={ext.name} className="group flex items-center justify-between rounded-md border border-border bg-[#141416] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full" style={{ background: ext.enabled ? accentColor : '#4a4a56' }} />
                  <div>
                    <div className="font-mono text-sm">{ext.name}</div>
                    {ext.description && <div className="text-xs text-muted-foreground">{ext.description}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Delete extension"
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    onClick={() => { void handleDelete(ext); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <span className={`rounded px-2 py-0.5 text-xs ${ext.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                    {ext.enabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
