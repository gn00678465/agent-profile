import { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw, Braces } from 'lucide-react';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { JsonEditor } from '@/components/ui/JsonEditor';

interface JsonFileEditorProps {
  filePath: string;
  title: string;
  description?: string;
  agentColor?: string;
}

export function JsonFileEditor({ filePath, title, description }: JsonFileEditorProps) {
  const [rawJson, setRawJson] = useState('{}');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [fileExists, setFileExists] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setJsonError(null);
    try {
      const content = await callElectron(() => electronAPI().file.read(filePath));
      setRawJson(content);
      setFileExists(true);
      setIsDirty(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ENOENT')) {
        setFileExists(false);
        setRawJson('{}');
        setIsDirty(false);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => { void load(); }, [load]);

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
    setJsonError(null);
    try {
      JSON.parse(rawJson);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
      return;
    }
    setSaving(true);
    try {
      await callElectron(() => electronAPI().file.write(filePath, rawJson));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
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
      {!fileExists && (
        <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          {filePath} does not exist yet. Changes will create the file.
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
