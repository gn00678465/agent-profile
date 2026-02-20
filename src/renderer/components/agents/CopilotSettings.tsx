import { useState, useEffect } from 'react';
import { Save, RefreshCw, Code, FileText } from 'lucide-react';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { CopilotConfig, ConfigFile } from '@shared/types';

interface CopilotSettingsProps {
  configDir: string;
}

const THEMES = ['auto', 'light', 'dark'] as const;

export function CopilotSettingsView({ configDir }: CopilotSettingsProps) {
  const [config, setConfig] = useState<ConfigFile<CopilotConfig> | null>(null);
  const [draft, setDraft] = useState<CopilotConfig>({});
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
        electronAPI().config.getCopilotConfig(configDir)
      );
      setConfig(result);
      setDraft(result.data ?? {});
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [configDir]);

  function update(patch: Partial<CopilotConfig>) {
    setDraft((d) => ({ ...d, ...patch }));
    setIsDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (viewMode === 'json') {
        try {
          const parsed = JSON.parse(rawJson) as CopilotConfig;
          setJsonError(null);
          await callElectron(() =>
            electronAPI().config.saveCopilotConfig(configDir, parsed)
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
          electronAPI().config.saveCopilotConfig(configDir, draft)
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
        const parsed = JSON.parse(rawJson) as CopilotConfig;
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
        Loading config...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">GitHub Copilot Settings</h2>
          <p className="text-sm text-muted-foreground">{configDir}/config.json</p>
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
          config.json does not exist yet. Changes will create the file.
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
      {/* Model */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Model</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Label htmlFor="cp-model">Model</Label>
            <Input
              id="cp-model"
              className="max-w-xs"
              placeholder="claude-sonnet-4.5"
              value={draft.model ?? ''}
              onChange={(e) => update({ model: e.target.value || undefined })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Label>Theme</Label>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t}
                  onClick={() => update({ theme: t })}
                  className={`rounded-md border px-3 py-1 text-xs capitalize transition-colors ${
                    (draft.theme ?? 'auto') === t
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UI Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">UI Options</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Render Markdown</Label>
              <p className="text-xs text-muted-foreground">Render markdown formatting in responses</p>
            </div>
            <Switch
              checked={draft.render_markdown ?? true}
              onCheckedChange={(v) => update({ render_markdown: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Screen Reader</Label>
              <p className="text-xs text-muted-foreground">Optimize output for screen readers</p>
            </div>
            <Switch
              checked={draft.screen_reader ?? false}
              onCheckedChange={(v) => update({ screen_reader: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Logged In Users */}
      {draft.logged_in_users && draft.logged_in_users.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Logged In Users</CardTitle>
          </CardHeader>
          <CardContent>
            {draft.logged_in_users.map((u, i) => (
              <div key={i} className="flex items-center gap-2 py-1 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{u.host}</span>
                <span className="font-medium">{u.login}</span>
                {draft.last_logged_in_user?.login === u.login && (
                  <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
                    active
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      </>
      )}
    </div>
  );
}
