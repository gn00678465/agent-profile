import { Sun, Moon, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import type { AgentProfile } from '@shared/types';
import claudeIcon from '../../../assets/claude-color.svg';
import geminiIcon from '../../../assets/gemini-color.svg';
import copilotIcon from '../../../assets/githubcopilot.svg';

const AGENT_COLORS: Record<string, string> = {
  'claude-code': '#d97706',
  gemini: '#7c6ef5',
  copilot: '#2eb88a',
  shared: '#6b7280',
};

interface SidebarProps {
  agents: AgentProfile[];
  activeAgentId: string;
  collapsed: boolean;
  onAgentSelect: (id: string) => void;
  accentColor: string;
}

const AGENT_ICONS: Record<string, React.ReactNode> = {
  'claude-code': <img src={claudeIcon} alt="Claude" className="h-5 w-5" />,
  gemini: <img src={geminiIcon} alt="Gemini" className="h-5 w-5" />,
  copilot: <img src={copilotIcon} alt="Copilot" className="h-5 w-5" />,
  shared: <Share2 className="h-5 w-5 text-gray-400" />,
};

export function Sidebar({ agents, activeAgentId, collapsed, onAgentSelect }: SidebarProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r transition-[width] duration-200 p-3 gap-2',
        collapsed ? 'w-[42px]' : 'w-[200px]'
      )}
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}
    >
      {/* Agent grid / column */}
      <div className="flex-1 overflow-y-auto px-1">
        <div
          className={cn(
            collapsed
              ? 'flex flex-col items-center gap-1'
              : 'grid grid-cols-4 gap-2'
          )}
        >
          {agents.map((agent) => {
            const isActive = agent.id === activeAgentId;
            const agentAccent = AGENT_COLORS[agent.type] ?? AGENT_COLORS.shared;

            return (
              <button
                key={agent.id}
                onClick={() => onAgentSelect(agent.id)}
                className={cn(
                  'flex items-center justify-center rounded-lg cursor-pointer transition-colors',
                  collapsed ? 'w-8 h-8' : 'w-9 h-9',
                  !isActive && 'hover:bg-accent/50'
                )}
                style={isActive ? {
                  background: `${agentAccent}20`,
                  boxShadow: `inset 0 0 0 1.5px ${agentAccent}`,
                } : undefined}
                title={agent.name}
              >
                {AGENT_ICONS[agent.type] ?? <Share2 className="h-5 w-5 text-gray-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer — theme toggle */}
      <div className="flex shrink-0 items-center justify-center">
        <button
          onClick={toggleTheme}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
