import { useState, useEffect, useCallback } from 'react';
import { Folder, Code, Trash2, RefreshCw, FolderOpen, Search } from 'lucide-react';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { SessionEntry, AgentType } from '@shared/types';

interface SessionsViewProps {
  configDir: string;
  agentType: AgentType;
  agentColor: string;
}

function formatDate(ts: number | string | undefined): string {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface SessionDetailProps {
  session: SessionEntry;
  onDelete: (session: SessionEntry) => void;
  onOpenFolder: (path: string) => void;
  accentColor: string;
}

function SessionDetail({ session, onDelete, onOpenFolder, accentColor }: SessionDetailProps) {
  return (
    <div className="border-l border-border bg-[#141416] flex flex-col" style={{ minWidth: 320, maxWidth: 360 }}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Session Detail</span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div>
          <div className="font-mono text-sm font-semibold" style={{ color: accentColor }}>
            {session.name}
          </div>
          <div className="mt-1 font-mono text-xs text-muted-foreground break-all">{session.path}</div>
        </div>

        {/* Metadata grid */}
        <div className="flex flex-col gap-2 rounded border border-border/60 bg-[#1c1c1f] p-3 text-xs">
          {session.createdAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="font-mono">{formatDate(session.createdAt)}</span>
            </div>
          )}
          {session.updatedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span className="font-mono">{formatDate(session.updatedAt)}</span>
            </div>
          )}
          {session.lastModified && !session.updatedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modified</span>
              <span className="font-mono">{formatDate(session.lastModified)}</span>
            </div>
          )}
          {session.cwd && (
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Working Dir</span>
              <span className="font-mono text-[11px] break-all">{session.cwd}</span>
            </div>
          )}
          {session.summary && (
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Summary</span>
              <span className="text-[11px] leading-relaxed">{session.summary}</span>
            </div>
          )}
          {session.checkpointCount !== undefined && session.checkpointCount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Checkpoints</span>
              <span className="font-mono">{session.checkpointCount}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="justify-start gap-2 text-xs"
            onClick={() => onOpenFolder(session.path)}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Open in Explorer
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start gap-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(session)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Session
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SessionsView({ configDir, agentType, agentColor }: SessionsViewProps) {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SessionEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callElectron(() =>
        electronAPI().config.getSessions(configDir, agentType)
      );
      setSessions(result);
    } catch (err) {
      toast.error('Failed to load sessions', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [configDir, agentType]);

  useEffect(() => { void load(); }, [load]);

  const filtered = sessions.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.path.toLowerCase().includes(search.toLowerCase()) ||
      (s.summary ?? '').toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(session: SessionEntry) {
    if (!confirm(`Delete session "${session.name}"?\n${session.path}\n\nThis cannot be undone.`)) return;
    try {
      await callElectron(() => electronAPI().config.deleteSession(session.path));
      toast.success('Session deleted');
      if (selected?.id === session.id) setSelected(null);
      await load();
    } catch (err) {
      toast.error('Failed to delete session', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  function openFolder(folderPath: string) {
    void callElectron(() => electronAPI().app.openExternal(`file://${folderPath}`));
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading sessions...
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Session list */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Sessions ({sessions.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-7 w-48 pl-7 text-xs"
                placeholder="Search sessions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { void load(); }}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Folder className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {search ? 'No sessions match your search' : 'No sessions found'}
            </p>
            <p className="font-mono text-xs opacity-60">
              {configDir}/{agentType === 'gemini' ? 'tmp/' : 'session-state/'}
            </p>
          </div>
        )}

        <ScrollArea className="flex-1">
          {filtered.map((session) => (
            <div
              role="button"
              tabIndex={0}
              key={`${session.id}-${session.path}`}
              onClick={() => setSelected(selected?.id === session.id ? null : session)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected(selected?.id === session.id ? null : session); }}
              className={`group flex w-full cursor-pointer items-center justify-between border-b border-border/50 px-4 py-3 text-left transition-colors ${
                selected?.id === session.id
                  ? 'bg-accent/60'
                  : 'hover:bg-accent/30'
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                {/* Icon */}
                <div className="mt-0.5 shrink-0">
                  {session.type === 'named' ? (
                    <Folder className="h-4 w-4" style={{ color: agentColor }} />
                  ) : (
                    <Code className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {/* Content */}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{session.name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    {session.path}
                  </div>
                  {session.summary && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {session.summary}
                    </div>
                  )}
                </div>
              </div>

              {/* Date + delete */}
              <div className="ml-3 flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDate(session.updatedAt ?? session.lastModified)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(session);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Detail panel */}
      {selected && (
        <SessionDetail
          session={selected}
          onDelete={(s) => { void handleDelete(s); }}
          onOpenFolder={openFolder}
          accentColor={agentColor}
        />
      )}
    </div>
  );
}
