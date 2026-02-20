import { useState, useEffect } from 'react';
import { Save, RefreshCw, Braces } from 'lucide-react';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { JsonEditor } from '@/components/ui/JsonEditor';
import type { GeminiSettings, ConfigFile } from '@shared/types';

interface GeminiSettingsProps {
  configDir: string;
}

export function GeminiSettingsView({ configDir }: GeminiSettingsProps) {
  const [config, setConfig] = useState<ConfigFile<GeminiSettings> | null>(null);
  const [rawJson, setRawJson] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await callElectron(() =>
        electronAPI().config.getGeminiSettings(configDir)
      );
      const data = result.data ?? {};
      setConfig(result);
      setRawJson(JSON.stringify(data, null, 2));
      setIsDirty(false);
      setJsonError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [configDir]);

  function handleFormat() {
    try {
      const parsed = JSON.parse(rawJson);
      setRawJson(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const parsed = JSON.parse(rawJson) as GeminiSettings;
      setJsonError(null);
      await callElectron(() =>
        electronAPI().config.saveGeminiSettings(configDir, parsed)
      );
      await load();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setJsonError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <div>
          <h2 className="text-sm font-semibold">Gemini CLI Settings</h2>
          <p className="text-xs text-muted-foreground">{configDir}/settings.json</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleFormat} title="Format JSON">
            <Braces className="h-4 w-4" />
            Format
          </Button>
          <Button variant="outline" size="sm" onClick={() => { void load(); }}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" disabled={!isDirty || saving} onClick={() => { void handleSave(); }}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Banners */}
      {error && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {jsonError && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {jsonError}
        </div>
      )}
      {!config?.exists && (
        <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          settings.json does not exist yet. Changes will create the file.
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <JsonEditor
          value={rawJson}
          onChange={(v) => { setRawJson(v); setIsDirty(true); setJsonError(null); }}
          height="100%"
        />
      </div>
    </div>
  );
}
