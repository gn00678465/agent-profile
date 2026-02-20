import { Bot, Share2, PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { AgentProfile } from '@shared/types';

interface SidebarProps {
  agents: AgentProfile[];
  activeAgentId: string;
  collapsed: boolean;
  onAgentSelect: (id: string) => void;
  onToggleCollapse: () => void;
  accentColor: string;
}

const AGENT_ICONS: Record<string, React.ReactNode> = {
  'claude-code': <Bot className="h-4 w-4 text-amber-500" />,
  gemini: <Bot className="h-4 w-4 text-indigo-400" />,
  copilot: <Bot className="h-4 w-4 text-emerald-400" />,
  shared: <Share2 className="h-4 w-4 text-gray-400" />,
};

export function Sidebar({ agents, activeAgentId, collapsed, onAgentSelect, onToggleCollapse, accentColor }: SidebarProps) {
  return (
    <div
      className={cn(
        'flex h-full shrink-0 flex-col border-r transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}
      style={{ borderColor: '#2a2a2e', background: '#111113' }}
    >
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between px-3">
        {!collapsed && (
          <span className="font-mono text-[11px] tracking-widest uppercase" style={{ color: '#6b6b7b' }}>
            Agents
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <Separator className="opacity-30" />

      <ScrollArea className="flex-1 py-2">
        <div className={cn('flex flex-col gap-1', collapsed ? 'px-1.5' : 'px-2')}>
          {agents.map((agent) => {
            const isActive = agent.id === activeAgentId;

            return (
              <button
                key={agent.id}
                onClick={() => onAgentSelect(agent.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
                style={isActive ? { background: `${accentColor}15`, color: accentColor } : undefined}
                title={collapsed ? agent.name : undefined}
              >
                {AGENT_ICONS[agent.type] ?? <Bot className="h-4 w-4" />}
                {!collapsed && <span className="truncate">{agent.name}</span>}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
