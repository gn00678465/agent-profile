import { useCallback } from 'react';
import { callElectron, electronAPI } from '@/lib/electron';
import { toast } from 'sonner';
import { useItemLoader } from '@/hooks/useItemLoader';
import { ExtensionListLayout } from '@/components/shared/ExtensionListLayout';
import { ExtensionRow } from '@/components/shared/ExtensionRow';

interface GeminiExtensionsProps {
  configDir: string;
  accentColor: string;
}

type GeminiExt = { name: string; enabled: boolean; description?: string; version?: string };

export function GeminiExtensionsView({ configDir, accentColor }: GeminiExtensionsProps) {
  const loadFn = useCallback(async (): Promise<GeminiExt[]> => {
    try {
      const d = await callElectron(() => electronAPI().config.getGeminiExtensions(configDir));
      return d.extensions;
    } catch {
      toast.error('Failed to load extensions');
      return [];
    }
  }, [configDir]);

  const { items: exts, loading, setItems: setExts } = useItemLoader(loadFn);

  async function handleDelete(ext: GeminiExt) {
    const confirmed = confirm(
      `Delete extension "${ext.name}"?\n\nThis will remove the enablement entry and the extension folder.`
    );
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-1 border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold">Gemini Extensions</h2>
        <p className="text-xs text-muted-foreground">{configDir}/extensions/</p>
      </div>
      <ExtensionListLayout
        loading={loading}
        loadingText="Loading extensions..."
        isEmpty={exts.length === 0}
        emptyTitle="No extensions installed."
      >
        {exts.map((ext) => (
          <ExtensionRow
            key={ext.name}
            name={ext.name}
            enabled={ext.enabled}
            accentColor={accentColor}
            subtitle={ext.description}
            badge={
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  ext.enabled
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {ext.enabled ? 'enabled' : 'disabled'}
              </span>
            }
            deleteLabel="Delete extension"
            onDelete={() => { void handleDelete(ext); }}
          />
        ))}
      </ExtensionListLayout>
    </div>
  );
}
