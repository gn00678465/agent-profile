import { useState, useEffect } from 'react';
import { Save, RefreshCw, Code, FileText } from 'lucide-react';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { GeminiSettings, ConfigFile } from '@shared/types';

interface GeminiSettingsProps {
  configDir: string;
}

export function GeminiSettingsView({ configDir }: GeminiSettingsProps) {
  const [config, setConfig] = useState<ConfigFile<GeminiSettings> | null>(null);
  const [draft, setDraft] = useState<GeminiSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
  const [rawJson, setRawJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await callElectron(() =>
        electronAPI().config.getGeminiSettings(configDir)
      );
      setConfig(result);
      setDraft(result.data ?? {});
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [configDir]);

  function update(patch: Partial<GeminiSettings>) {
    setDraft((d) => ({ ...d, ...patch }));
    setIsDirty(true);
  }

  function updateGeneral(patch: Partial<NonNullable<GeminiSettings['general']>>) {
    update({ general: { ...(draft.general ?? {}), ...patch } });
  }

  function updateUi(patch: Partial<NonNullable<GeminiSettings['ui']>>) {
    update({ ui: { ...(draft.ui ?? {}), ...patch } });
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (viewMode === 'json') {
        try {
          const parsed = JSON.parse(rawJson) as GeminiSettings;
          setJsonError(null);
          await callElectron(() =>
            electronAPI().config.saveGeminiSettings(configDir, parsed)
          );
          setDraft(parsed);
        } catch (e) {
          if (e instanceof SyntaxError) {
            setJsonError(e.message);
            return;
          }
          throw e;
        }
      } else {
        await callElectron(() =>
          electronAPI().config.saveGeminiSettings(configDir, draft)
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function toggleViewMode() {
    if (viewMode === 'form') {
      setRawJson(JSON.stringify(draft, null, 2));
      setJsonError(null);
      setViewMode('json');
    } else {
      try {
        const parsed = JSON.parse(rawJson) as GeminiSettings;
        setDraft(parsed);
        setJsonError(null);
      } catch {
        // Keep current draft if JSON is invalid
      }
      setViewMode('form');
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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gemini CLI Settings</h2>
          <p className="text-sm text-muted-foreground">{configDir}/settings.json</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleViewMode}
            title={viewMode === 'form' ? 'Switch to JSON' : 'Switch to Form'}
          >
            {viewMode === 'form' ? <Code className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            {viewMode === 'form' ? 'JSON' : 'Form'}
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

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!config?.exists && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          settings.json does not exist yet. Changes will create the file.
        </div>
      )}

      {viewMode === 'json' ? (
        <div className="flex flex-col gap-2">
          {jsonError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {jsonError}
            </div>
          )}
          <Textarea
            className="min-h-[400px] font-mono text-xs"
            value={rawJson}
            onChange={(e) => { setRawJson(e.target.value); setIsDirty(true); setJsonError(null); }}
          />
        </div>
      ) : (
      <>
      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">General</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Preview Features</Label>
              <p className="text-xs text-muted-foreground">Enable experimental preview features</p>
            </div>
            <Switch
              checked={draft.general?.previewFeatures ?? false}
              onCheckedChange={(v) => updateGeneral({ previewFeatures: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Vim Mode</Label>
              <p className="text-xs text-muted-foreground">Enable vim keybindings in the editor</p>
            </div>
            <Switch
              checked={draft.general?.vimMode ?? false}
              onCheckedChange={(v) => updateGeneral({ vimMode: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Session Retention</Label>
              <p className="text-xs text-muted-foreground">Persist sessions across restarts</p>
            </div>
            <Switch
              checked={draft.general?.sessionRetention?.enabled ?? false}
              onCheckedChange={(v) =>
                updateGeneral({ sessionRetention: { enabled: v } })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Prompt Completion</Label>
              <p className="text-xs text-muted-foreground">Enable prompt auto-completion</p>
            </div>
            <Switch
              checked={draft.general?.enablePromptCompletion ?? false}
              onCheckedChange={(v) => updateGeneral({ enablePromptCompletion: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* UI */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">UI Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Show Memory Usage</Label>
              <p className="text-xs text-muted-foreground">Display memory usage in chat</p>
            </div>
            <Switch
              checked={draft.ui?.showMemoryUsage ?? false}
              onCheckedChange={(v) => updateUi({ showMemoryUsage: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Show Model Info in Chat</Label>
              <p className="text-xs text-muted-foreground">Display active model name in chat header</p>
            </div>
            <Switch
              checked={draft.ui?.showModelInfoInChat ?? false}
              onCheckedChange={(v) => updateUi({ showModelInfoInChat: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Hide Context Summary</Label>
              <p className="text-xs text-muted-foreground">Hide the context window summary panel</p>
            </div>
            <Switch
              checked={draft.ui?.hideContextSummary ?? false}
              onCheckedChange={(v) => updateUi({ hideContextSummary: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Experimental */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Experimental</CardTitle>
          <CardDescription>Feature flags for experimental capabilities</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Skills</Label>
              <p className="text-xs text-muted-foreground">Enable the skills system</p>
            </div>
            <Switch
              checked={draft.experimental?.skills ?? false}
              onCheckedChange={(v) =>
                update({ experimental: { ...(draft.experimental ?? {}), skills: v } })
              }
            />
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
