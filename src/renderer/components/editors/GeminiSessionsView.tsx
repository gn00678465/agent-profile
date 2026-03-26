import { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, FolderOpen, Search } from 'lucide-react';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { RemoveButton } from '@/components/ui/remove-button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { GeminiSessionEntry, GeminiSessionMessage } from '@shared/types';

interface GeminiSessionsViewProps {
  configDir: string;
  agentColor: string;
}

function formatDate(ts: number | string | undefined): string {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDirname(filePath: string): string {
  return filePath.replace(/[/\\][^/\\]+$/, '');
}

interface GeminiMessageBubbleProps {
  message: GeminiSessionMessage;
  accentColor: string;
}

function GeminiMessageBubble({ message, accentColor }: GeminiMessageBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const [thoughtsExpanded, setThoughtsExpanded] = useState(false);
  const MAX_CHARS = 300;
  // Defensive: normalize content at render time (IPC normalizes too, belt+suspenders)
  const raw = message.content as unknown;
  const text: string =
    typeof raw === 'string' ? raw
    : Array.isArray(raw)
      ? (raw as Array<{ text?: unknown }>).map((i) => String(i?.text ?? i ?? '')).join('')
      : raw && typeof raw === 'object' && 'text' in (raw as object)
        ? String((raw as { text: unknown }).text ?? '')
        : String(raw ?? '');
  const truncated = !expanded && text.length > MAX_CHARS;
  const displayText = truncated ? text.slice(0, MAX_CHARS) : text;

  if (message.type === 'info') {
    return (
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-muted-foreground italic bg-accent/30 rounded px-2 py-0.5">
          {message.content}
        </span>
      </div>
    );
  }

  const isUser = message.type === 'user';
  const thoughts = message.thoughts ?? [];
  const tokens = message.tokens;

  return (
    <div className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
      <span
        className="text-[10px] font-medium uppercase tracking-wider"
        style={isUser ? { color: 'var(--muted-foreground)' } : { color: accentColor }}
      >
        {isUser ? 'You' : 'Gemini'}
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
      {!isUser && tokens && (
        <span className="text-[10px] text-muted-foreground font-mono">
          in: {tokens.input} / out: {tokens.output}
        </span>
      )}
      {!isUser && thoughts.length > 0 && (
        <div className="flex flex-col gap-1">
          <button
            className="text-[10px] text-muted-foreground hover:text-foreground text-left"
            onClick={() => setThoughtsExpanded(!thoughtsExpanded)}
          >
            🧠 {thoughts.length} thought{thoughts.length !== 1 ? 's' : ''}
          </button>
          {thoughtsExpanded && (
            <div className="flex flex-col gap-1 pl-2">
              {thoughts.map((thought, i) => (
                <div key={i} className="text-xs">
                  <span className="font-bold">{thought.subject}</span>{' '}
                  <span className="text-muted-foreground">{thought.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface GeminiSessionDetailProps {
  session: GeminiSessionEntry;
  accentColor: string;
  onOpenFolder: (session: GeminiSessionEntry) => void;
}

function GeminiSessionDetail({ session, accentColor, onOpenFolder }: GeminiSessionDetailProps) {
  const [messages, setMessages] = useState<GeminiSessionMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setLoadingMessages(true);

    callElectron(() => electronAPI().config.getGeminiSessionMessages(session.path))
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

    return () => {
      cancelled = true;
    };
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
            <span className="font-mono font-semibold" style={{ color: accentColor }}>
              {session.sessionId}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Project</span>
            <span className="font-mono text-muted-foreground">
              {session.projectHash.slice(0, 8)}...
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Started</span>
            <span className="font-mono">{formatDate(session.startTime)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Updated</span>
            <span className="font-mono">{formatDate(session.lastUpdated)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Messages</span>
            <span className="font-mono">{session.messageCount ?? 0}</span>
          </div>
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
                {messages.map((msg) => (
                  <GeminiMessageBubble
                    key={msg.id}
                    message={msg}
                    accentColor={accentColor}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}

export function GeminiSessionsView({ configDir, agentColor }: GeminiSessionsViewProps) {
  const [sessions, setSessions] = useState<GeminiSessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GeminiSessionEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callElectron(() =>
        electronAPI().config.getGeminiSessions(configDir)
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

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = sessions.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.projectHash.toLowerCase().includes(search.toLowerCase()) ||
      s.sessionId.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(session: GeminiSessionEntry) {
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

  function handleOpenFolder(session: GeminiSessionEntry) {
    const dir = getDirname(session.path);
    void callElectron(() => electronAPI().app.openExternal(`file://${dir}`));
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
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                void load();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Sparkles className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {search ? 'No sessions match your search' : 'No sessions found'}
            </p>
            <p className="font-mono text-xs opacity-60">{configDir}/tmp/</p>
          </div>
        )}

        <ScrollArea className="flex-1">
          {filtered.map((session) => {
            const isSelected = selected?.id === session.id;
            return (
              <div
                role="button"
                tabIndex={0}
                key={`${session.id}-${session.path}`}
                onClick={() => setSelected(isSelected ? null : session)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ')
                    setSelected(isSelected ? null : session);
                }}
                className={`group relative flex w-full cursor-pointer items-center justify-between border-b border-border/40 px-4 py-3 text-left transition-all ${
                  isSelected ? 'bg-accent/50' : 'hover:bg-accent/20'
                }`}
              >
                {/* Left accent bar */}
                <div
                  className={`absolute left-0 top-0 h-full w-0.5 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}
                  style={{ backgroundColor: agentColor }}
                />

                <div className="flex min-w-0 items-center gap-3">
                  {/* Icon */}
                  <div className="shrink-0">
                    <Sparkles className="h-3.5 w-3.5" style={{ color: agentColor }} />
                  </div>
                  {/* Content */}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold tabular-nums tracking-tight">
                      {session.name}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted-foreground/50 truncate">
                      {session.projectHash.slice(0, 10)}
                    </div>
                  </div>
                </div>

                {/* Right: message count + delete */}
                <div className="ml-3 flex shrink-0 items-center gap-1.5">
                  {(session.messageCount ?? 0) > 0 && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-mono font-medium transition-colors whitespace-nowrap"
                      style={{
                        backgroundColor: isSelected ? `${agentColor}25` : 'var(--accent)',
                        color: isSelected ? agentColor : 'var(--muted-foreground)',
                      }}
                    >
                      {session.messageCount} msgs
                    </span>
                  )}
                  <RemoveButton
                    label="Delete session"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(session);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </ScrollArea>
      </div>

      {/* Detail panel */}
      {selected && (
        <GeminiSessionDetail
          session={selected}
          accentColor={agentColor}
          onOpenFolder={handleOpenFolder}
        />
      )}
    </div>
  );
}
