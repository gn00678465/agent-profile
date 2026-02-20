import { useState, useEffect } from 'react';
import { Save, RefreshCw, Plus, Trash2, Code, FileText } from 'lucide-react';
import { useClaudeSettings } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import type { ClaudeSettings as ClaudeSettingsType } from '@shared/types';

interface ClaudeSettingsProps {
  configDir: string;
}

export function ClaudeSettingsView({ configDir }: ClaudeSettingsProps) {
  const { config, loading, saving, error, save, refresh } = useClaudeSettings(configDir);
  const [draft, setDraft] = useState<ClaudeSettingsType>({});
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');
  const [newPermission, setNewPermission] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
  const [rawJson, setRawJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (config?.data) {
      setDraft(config.data);
      setIsDirty(false);
    } else if (config && !config.data) {
      setDraft({});
      setIsDirty(false);
    }
  }, [config]);

  function update(patch: Partial<ClaudeSettingsType>) {
    setDraft((d) => ({ ...d, ...patch }));
    setIsDirty(true);
  }

  async function handleSave() {
    if (viewMode === 'json') {
      try {
        const parsed = JSON.parse(rawJson) as ClaudeSettingsType;
        setJsonError(null);
        await save(parsed);
        setDraft(parsed);
        setIsDirty(false);
      } catch (e) {
        setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
        return;
      }
    } else {
      await save(draft);
      setIsDirty(false);
    }
  }

  function toggleViewMode() {
    if (viewMode === 'form') {
      setRawJson(JSON.stringify(draft, null, 2));
      setJsonError(null);
      setViewMode('json');
    } else {
      try {
        const parsed = JSON.parse(rawJson) as ClaudeSettingsType;
        setDraft(parsed);
        setJsonError(null);
      } catch {
        // Keep current draft if JSON is invalid
      }
      setViewMode('form');
    }
  }

  function addEnvVar() {
    if (!newEnvKey.trim()) return;
    update({ env: { ...(draft.env ?? {}), [newEnvKey.trim()]: newEnvVal } });
    setNewEnvKey('');
    setNewEnvVal('');
  }

  function removeEnvVar(key: string) {
    const env = { ...(draft.env ?? {}) };
    delete env[key];
    update({ env });
  }

  function addPermission() {
    if (!newPermission.trim()) return;
    const allow = [...(draft.permissions?.allow ?? []), newPermission.trim()];
    update({ permissions: { ...(draft.permissions ?? {}), allow } });
    setNewPermission('');
  }

  function removePermission(perm: string) {
    const allow = (draft.permissions?.allow ?? []).filter((p) => p !== perm);
    update({ permissions: { ...(draft.permissions ?? {}), allow } });
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Claude Code Settings</h2>
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
      {/* Model */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Model</CardTitle>
          <CardDescription>Active model for Claude Code</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              className="max-w-xs"
              placeholder="opus"
              value={draft.model ?? ''}
              onChange={(e) => update({ model: e.target.value || undefined })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Behavior</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Skip Dangerous Mode Prompt</Label>
              <p className="text-xs text-muted-foreground">Skip permission confirmation in dangerous mode</p>
            </div>
            <Switch
              checked={draft.skipDangerousModePermissionPrompt ?? false}
              onCheckedChange={(v) => update({ skipDangerousModePermissionPrompt: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Environment Variables</CardTitle>
          <CardDescription>Injected into Claude Code sessions</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Object.entries(draft.env ?? {}).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <code className="min-w-[160px] rounded bg-muted px-2 py-1 text-xs font-mono">{key}</code>
              <Input
                className="flex-1 font-mono text-xs"
                value={String(val)}
                onChange={(e) => update({ env: { ...(draft.env ?? {}), [key]: e.target.value } })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                onClick={() => removeEnvVar(key)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              className="min-w-[160px] font-mono text-xs"
              placeholder="KEY"
              value={newEnvKey}
              onChange={(e) => setNewEnvKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addEnvVar()}
            />
            <Input
              className="flex-1 font-mono text-xs"
              placeholder="value"
              value={newEnvVal}
              onChange={(e) => setNewEnvVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addEnvVar()}
            />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={addEnvVar}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Permissions</CardTitle>
          <CardDescription>Tool permission rules (allow list)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {(draft.permissions?.allow ?? []).map((perm) => (
              <Badge
                key={perm}
                variant="secondary"
                className="cursor-pointer gap-1 text-xs"
                onClick={() => removePermission(perm)}
              >
                {perm}
                <Trash2 className="h-3 w-3" />
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              className="max-w-xs text-xs font-mono"
              placeholder="Bash(*)"
              value={newPermission}
              onChange={(e) => setNewPermission(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPermission()}
            />
            <Button variant="outline" size="sm" onClick={addPermission}>
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enabled Plugins summary */}
      {draft.enabledPlugins && Object.keys(draft.enabledPlugins).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Enabled Plugins</CardTitle>
            <CardDescription>Manage in the Plugins tab</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(draft.enabledPlugins).map(([id, enabled]) => (
              <Badge key={id} variant={enabled ? 'default' : 'outline'} className="text-xs">
                {id}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
      </>
      )}
    </div>
  );
}
