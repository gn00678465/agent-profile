import { useState, useEffect, useCallback } from 'react';
import { Trash2, Plus, RefreshCw } from 'lucide-react';
import { parseMcpCommand } from '@/lib/parseMcpCommand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { callElectron, electronAPI } from '@/lib/electron';
import type { McpServer, McpSettings, AgentType, ConfigFile } from '@shared/types';

interface McpCommandEditorProps {
  configDir: string;
  agentType: 'claude-code' | 'gemini';
}

export function McpCommandEditor({ configDir, agentType }: McpCommandEditorProps) {
  const [servers, setServers] = useState<Record<string, McpServer>>({});
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const placeholder = agentType === 'claude-code'
    ? 'claude mcp add --transport http name https://...'
    : 'gemini mcp add --transport http name https://...';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callElectron(() =>
        electronAPI().config.getMcp(configDir, agentType as AgentType)
      ) as ConfigFile<McpSettings>;
      setServers(result?.data?.mcpServers ?? {});
    } finally {
      setLoading(false);
    }
  }, [configDir, agentType]);

  useEffect(() => { void load(); }, [load]);

  async function saveServers(updated: Record<string, McpServer>) {
    setSaving(true);
    setSaveError(null);
    try {
      const settings: McpSettings = { mcpServers: updated };
      await callElectron(() =>
        electronAPI().config.saveMcp(configDir, agentType as AgentType, settings)
      );
      setServers(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save MCP config');
    } finally {
      setSaving(false);
    }
  }

  function handleAdd() {
    setParseError(null);
    setSaveError(null);
    const parsed = parseMcpCommand(input.trim(), agentType);
    if (!parsed.ok) {
      setParseError(parsed.error);
      return;
    }
    if (parsed.name in servers) {
      setParseError(`Server "${parsed.name}" already exists`);
      return;
    }
    const updated = { ...servers, [parsed.name]: parsed.server };
    void saveServers(updated);
    setInput('');
  }

  function handleDelete(name: string) {
    const { [name]: _removed, ...updated } = servers;
    void saveServers(updated);
  }

  function serverSummary(server: McpServer): string {
    if (server.url) return server.url;
    if (server.command) {
      const args = server.args?.join(' ') ?? '';
      return args ? `${server.command} ${args}` : server.command;
    }
    return '';
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading MCP servers...
      </div>
    );
  }

  const serverEntries = Object.entries(servers);

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">MCP Servers</h2>
            <p className="text-xs text-muted-foreground">
              {agentType === 'claude-code' ? '~/.claude.json' : `${configDir}/settings.json`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { void load(); }}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Command input */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              className="font-mono text-xs"
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={saving} size="sm">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {parseError && <p className="text-xs text-destructive">{parseError}</p>}
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        </div>

        {/* Server list */}
        {serverEntries.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No MCP servers configured. Add one above.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {serverEntries.map(([name, server]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-md border border-border/60 px-4 py-3"
              >
                <div className="flex items-center gap-3 font-mono text-xs min-w-0">
                  <span className="font-semibold shrink-0">{name}</span>
                  <span className="text-muted-foreground shrink-0">{server.type ?? 'stdio'}</span>
                  <span className="text-muted-foreground truncate">{serverSummary(server)}</span>
                  {server.disabled && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      disabled
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(name)}
                  aria-label={`Delete ${name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
