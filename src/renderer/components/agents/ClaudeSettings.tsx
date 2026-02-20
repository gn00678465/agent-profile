import { useState, useEffect } from 'react';
import { Save, RefreshCw, Braces } from 'lucide-react';
import { useClaudeSettings } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { JsonEditor } from '@/components/ui/JsonEditor';
import type { ClaudeSettings as ClaudeSettingsType } from '@shared/types';

interface ClaudeSettingsProps {
  configDir: string;
}

export function ClaudeSettingsView({ configDir }: ClaudeSettingsProps) {
  const { config, loading, saving, error, save, refresh } = useClaudeSettings(configDir);
  const [rawJson, setRawJson] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    const data = config?.data ?? {};
    setRawJson(JSON.stringify(data, null, 2));
    setIsDirty(false);
    setJsonError(null);
  }, [config]);

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
    try {
      const parsed = JSON.parse(rawJson) as ClaudeSettingsType;
      setJsonError(null);
      await save(parsed);
      setIsDirty(false);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
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
          <h2 className="text-sm font-semibold">Claude Code Settings</h2>
          <p className="text-xs text-muted-foreground">{configDir}/settings.json</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleFormat} title="Format JSON">
            <Braces className="h-4 w-4" />
            Format
          </Button>
          <Button variant="outline" size="sm" onClick={() => { void refresh(); }}>
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
