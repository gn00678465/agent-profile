import { useState, useEffect } from 'react';
import { Save, RefreshCw, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useMcpSettings } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { McpServer, McpSettings } from '@shared/types';

interface McpEditorProps {
  configDir: string;
}

interface ServerEditorProps {
  name: string;
  server: McpServer;
  onChange: (server: McpServer) => void;
  onDelete: () => void;
}

function ServerEditor({ name, server, onChange, onDelete }: ServerEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [newArgValue, setNewArgValue] = useState('');
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');

  function updateServer(patch: Partial<McpServer>) {
    onChange({ ...server, ...patch });
  }

  function addArg() {
    if (!newArgValue.trim()) return;
    onChange({ ...server, args: [...(server.args ?? []), newArgValue.trim()] });
    setNewArgValue('');
  }

  function removeArg(index: number) {
    const args = (server.args ?? []).filter((_, i) => i !== index);
    updateServer({ args });
  }

  function addEnv() {
    if (!newEnvKey.trim()) return;
    updateServer({ env: { ...(server.env ?? {}), [newEnvKey.trim()]: newEnvVal } });
    setNewEnvKey('');
    setNewEnvVal('');
  }

  function removeEnv(key: string) {
    const env = { ...(server.env ?? {}) };
    delete env[key];
    updateServer({ env });
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex flex-1 items-center gap-2 text-sm font-medium"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <code className="font-mono">{name}</code>
            {server.command && (
              <span className="text-xs text-muted-foreground">
                {server.command} {(server.args ?? []).join(' ')}
              </span>
            )}
            {server.url && (
              <span className="text-xs text-muted-foreground">{server.url}</span>
            )}
          </button>
          <Switch
            checked={!server.disabled}
            onCheckedChange={(v) => updateServer({ disabled: !v })}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:bg-destructive/10"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="flex flex-col gap-4 border-t px-4 py-4">
          {/* Transport type */}
          <div className="flex items-center gap-3">
            <Label className="w-24 shrink-0">Transport</Label>
            <div className="flex gap-2">
              {(['stdio', 'sse', 'http'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => updateServer({ type: t })}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    (server.type ?? 'stdio') === t
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Command */}
          <div className="flex items-center gap-3">
            <Label className="w-24 shrink-0">Command</Label>
            <Input
              className="font-mono text-xs"
              placeholder="npx, uvx, docker..."
              value={server.command ?? ''}
              onChange={(e) => updateServer({ command: e.target.value || undefined })}
            />
          </div>

          {/* URL (for sse/http) */}
          {(server.type === 'sse' || server.type === 'http') && (
            <div className="flex items-center gap-3">
              <Label className="w-24 shrink-0">URL</Label>
              <Input
                className="font-mono text-xs"
                placeholder="https://..."
                value={server.url ?? ''}
                onChange={(e) => updateServer({ url: e.target.value || undefined })}
              />
            </div>
          )}

          {/* Args */}
          <div className="flex flex-col gap-2">
            <Label>Arguments</Label>
            {(server.args ?? []).map((arg, i) => (
              <div key={i} className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-2 py-1 text-xs font-mono">{arg}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeArg(i)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                className="font-mono text-xs"
                placeholder="-y @some/package"
                value={newArgValue}
                onChange={(e) => setNewArgValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addArg()}
              />
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={addArg}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Env vars */}
          <div className="flex flex-col gap-2">
            <Label>Environment Variables</Label>
            {Object.entries(server.env ?? {}).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <code className="w-36 shrink-0 rounded bg-muted px-2 py-1 text-xs font-mono">{key}</code>
                <Input
                  className="flex-1 font-mono text-xs"
                  value={String(val)}
                  onChange={(e) =>
                    updateServer({ env: { ...(server.env ?? {}), [key]: e.target.value } })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeEnv(key)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                className="w-36 shrink-0 font-mono text-xs"
                placeholder="API_KEY"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
              />
              <Input
                className="flex-1 font-mono text-xs"
                placeholder="value"
                value={newEnvVal}
                onChange={(e) => setNewEnvVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEnv()}
              />
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={addEnv}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function McpEditor({ configDir }: McpEditorProps) {
  const { config, loading, saving, error, save, refresh } = useMcpSettings(configDir);
  const [servers, setServers] = useState<Record<string, McpServer>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [newServerName, setNewServerName] = useState('');

  useEffect(() => {
    if (config?.data?.mcpServers) {
      setServers(config.data.mcpServers);
    } else {
      setServers({});
    }
    setIsDirty(false);
  }, [config]);

  function updateServer(name: string, server: McpServer) {
    setServers((s) => ({ ...s, [name]: server }));
    setIsDirty(true);
  }

  function deleteServer(name: string) {
    setServers((s) => {
      const copy = { ...s };
      delete copy[name];
      return copy;
    });
    setIsDirty(true);
  }

  function addServer() {
    const name = newServerName.trim();
    if (!name || name in servers) return;
    setServers((s) => ({
      ...s,
      [name]: { type: 'stdio', command: '', args: [] },
    }));
    setNewServerName('');
    setIsDirty(true);
  }

  async function handleSave() {
    const settings: McpSettings = { mcpServers: servers };
    await save(settings);
    setIsDirty(false);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading MCP servers...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">MCP Servers</h2>
          <p className="text-sm text-muted-foreground">{config?.path ?? configDir}</p>
        </div>
        <div className="flex gap-2">
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

      {Object.keys(servers).length === 0 && (
        <div className="rounded-md border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No MCP servers configured. Add one below.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {Object.entries(servers).map(([name, server]) => (
          <ServerEditor
            key={name}
            name={name}
            server={server}
            onChange={(s) => updateServer(name, s)}
            onDelete={() => deleteServer(name)}
          />
        ))}
      </div>

      {/* Add new server */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Server name (e.g. context7)"
          value={newServerName}
          onChange={(e) => setNewServerName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addServer()}
          className="max-w-xs"
        />
        <Button variant="outline" onClick={addServer}>
          <Plus className="h-4 w-4" />
          Add Server
        </Button>
      </div>
    </div>
  );
}
