import { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw, Braces } from 'lucide-react';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { TomlEditor } from '@/components/ui/TomlEditor';
import { parse as parseToml } from 'smol-toml';
import type { Taplo } from '@taplo/lib';

interface TomlFileEditorProps {
  filePath: string;
  title: string;
  description?: string;
  /** Called after a successful save (e.g. so a parent list can re-read the file). */
  onSaved?: () => void;
}

// Taplo (the TOML formatter) is a ~10 MB base64-inlined WASM module. Lazy-load
// it on first Format click and cache the initialized instance so the WASM never
// enters the initial renderer chunk and only ever initializes once.
let taploPromise: Promise<Taplo> | null = null;
function loadTaplo(): Promise<Taplo> {
  if (!taploPromise) {
    taploPromise = import('@taplo/lib').then((m) => m.Taplo.initialize());
  }
  return taploPromise;
}

// Mirrors JsonFileEditor's chrome (toolbar, banners, CodeMirror body) so the
// Codex settings tab matches the other agents' settings editors. Validates on
// save via smol-toml and writes bytes verbatim — TOML comments are preserved.
// Format uses Taplo, the only TOML formatter that keeps comments and key order
// intact (reorderKeys: false).
export function TomlFileEditor({ filePath, title, description, onSaved }: TomlFileEditorProps) {
  const [rawToml, setRawToml] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [fileExists, setFileExists] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tomlError, setTomlError] = useState<string | null>(null);
  const [formatting, setFormatting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTomlError(null);
    try {
      const content = await callElectron(() => electronAPI().file.read(filePath));
      setRawToml(content);
      setFileExists(true);
      setIsDirty(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ENOENT')) {
        setFileExists(false);
        setRawToml('');
        setIsDirty(false);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => { void load(); }, [load]);

  async function handleFormat() {
    setTomlError(null);
    setFormatting(true);
    try {
      const taplo = await loadTaplo();
      const formatted = taplo.format(rawToml, { options: { reorderKeys: false } });
      if (formatted !== rawToml) {
        setRawToml(formatted);
        setIsDirty(true);
      }
    } catch (e) {
      setTomlError(e instanceof Error ? e.message : 'Failed to format TOML');
    } finally {
      setFormatting(false);
    }
  }

  async function handleSave() {
    setTomlError(null);
    try {
      parseToml(rawToml);
    } catch (e) {
      setTomlError(e instanceof Error ? e.message : 'Invalid TOML');
      return;
    }
    setSaving(true);
    try {
      await callElectron(() => electronAPI().file.write(filePath, rawToml));
      await load();
      onSaved?.();
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
          <Button variant="outline" size="sm" onClick={() => { void handleFormat(); }} disabled={formatting} title="Format TOML">
            <Braces className="h-4 w-4" />
            {formatting ? 'Formatting...' : 'Format'}
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
      {tomlError && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {tomlError}
        </div>
      )}
      {!fileExists && (
        <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          {filePath} does not exist yet. Changes will create the file.
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <TomlEditor
          value={rawToml}
          onChange={(v) => { setRawToml(v); setIsDirty(true); setTomlError(null); }}
          height="100%"
        />
      </div>
    </div>
  );
}
