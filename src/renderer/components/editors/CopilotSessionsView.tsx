import { useState, useEffect, useCallback } from 'react';
import { FileText, Folder, Trash2, RefreshCw, FolderOpen, Search } from 'lucide-react';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { SessionEntry, ClaudeSessionMessage } from '@shared/types';

interface CopilotSessionsViewProps {
  configDir: string;
  agentColor: string;
}

function formatDate(ts: number | string | undefined): string {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface MessageBubbleProps {
  message: ClaudeSessionMessage;
  accentColor: string;
}

function MessageBubble({ message, accentColor }: MessageBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const MAX_CHARS = 300;
  const isUser = message.role === 'user';
  const text = message.text ?? '';
  const truncated = !expanded && text.length > MAX_CHARS;
  const displayText = truncated ? text.slice(0, MAX_CHARS) : text;

  return (
    <div className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
      <span
        className="text-[10px] font-medium uppercase tracking-wider"
        style={isUser ? { color: 'var(--muted-foreground)' } : { color: accentColor }}
      >
        {isUser ? 'You' : 'Copilot'}
      </span>
      <div
        className={`rounded-lg px-3 py-2 text-xs leading-relaxed max-w-[90%] ${
          isUser ? 'bg-accent text-foreground' : 'text-foreground'
        }`}
      >
        <span className="whitespace-pre-wrap break-words">{displayText}</span>
        {truncated && (
          <>
            <span className="text-muted-foreground">... </span>
            <button
              className="text-[10px] underline text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(true)}
            >
              [show more]
            </button>
          </>
        )}
        {expanded && text.length > MAX_CHARS && (
          <>
            {' '}
            <button
              className="text-[10px] underline text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(false)}
            >
              [show less]
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface SessionDetailProps {
  session: SessionEntry;
  accentColor: string;
  onOpenFolder: (session: SessionEntry) => void;
}

function SessionDetail({ session, accentColor, onOpenFolder }: SessionDetailProps) {
  const [messages, setMessages] = useState<ClaudeSessionMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setLoadingMessages(true);

    callElectron(() => electronAPI().config.getCopilotSessionEvents(session.path))
      .then((result) => {
        if (!cancelled) setMessages(result ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error('Failed to load messages', {
            description: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });

    return () => { cancelled = true; };
  }, [session.path]);

  return (
    <div
      className="border-l border-border bg-[var(--bg-surface)] flex flex-col overflow-hidden"
      style={{ width: '50%', minWidth: 320 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Session Detail
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4 overflow-y-auto flex-1">
        {/* Actions */}
        <div className="flex flex-col gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="justify-start gap-2 text-xs"
            onClick={() => onOpenFolder(session)}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Open in Explorer
          </Button>
        </div>

        {/* Metadata */}
        <div className="flex flex-col gap-2 rounded border border-border/60 bg-[var(--bg-raised)] p-3 text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Session ID</span>
            <span className="font-mono font-semibold break-all" style={{ color: accentColor }}>
              {session.id}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Location</span>
            <span className="font-mono text-[11px] text-muted-foreground break-all">
              {session.path.replace(/[/\\][^/\\]+$/, '')}
            </span>
          </div>
          {session.cwd && (
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">Working Dir</span>
              <span className="font-mono text-[11px] break-all">{session.cwd}</span>
            </div>
          )}
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
          {session.checkpointCount !== undefined && session.checkpointCount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Checkpoints</span>
              <span className="font-mono">{session.checkpointCount}</span>
            </div>
          )}
        </div>

        {/* Conversation */}
        <div className="flex flex-col gap-2 grow">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Conversation
            </span>
            {!loadingMessages && (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {messages.length}
              </span>
            )}
          </div>

          {loadingMessages ? (
            <div className="text-xs text-muted-foreground py-2">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">No messages found.</div>
          ) : (
            <ScrollArea className="pr-1">
              <div className="flex flex-col gap-3 pb-2">
                {messages.map((msg, idx) => (
                  <MessageBubble key={idx} message={msg} accentColor={accentColor} />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}

export function CopilotSessionsView({ configDir, agentColor }: CopilotSessionsViewProps) {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SessionEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callElectron(() =>
        electronAPI().config.getSessions(configDir, 'copilot')
      );
      setSessions(result);
    } catch (err) {
      toast.error('Failed to load sessions', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [configDir]);

  useEffect(() => { void load(); }, [load]);

  const filtered = sessions.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.path.toLowerCase().includes(search.toLowerCase()) ||
      (s.cwd ?? '').toLowerCase().includes(search.toLowerCase()) ||
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

  function handleOpenFolder(session: SessionEntry) {
    const isFile = session.path.endsWith('.jsonl');
    const dir = isFile ? session.path.replace(/[/\\][^/\\]+$/, '') : session.path;
    void callElectron(() => electronAPI().app.openExternal(`file://${dir}`));
  }

  const isOldFormat = (session: SessionEntry) => session.path.endsWith('.jsonl');

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
              {configDir}/session-state/
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ')
                  setSelected(selected?.id === session.id ? null : session);
              }}
              className={`group flex w-full cursor-pointer items-center justify-between border-b border-border/50 px-4 py-3 text-left transition-colors ${
                selected?.id === session.id ? 'bg-accent/60' : 'hover:bg-accent/30'
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {isOldFormat(session) ? (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Folder className="h-4 w-4" style={{ color: agentColor }} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{session.name}</div>
                  {session.summary && session.name !== session.summary && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {session.summary}
                    </div>
                  )}
                </div>
              </div>

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
          accentColor={agentColor}
          onOpenFolder={handleOpenFolder}
        />
      )}
    </div>
  );
}
