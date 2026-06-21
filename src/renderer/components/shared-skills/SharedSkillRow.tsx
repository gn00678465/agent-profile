import { Trash2, GitBranch, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { agentAccent, agentIconSrc } from '@/lib/agentColors';
import type { Skill, LinkedByAgentType, SkillLockEntry } from '@shared/types';

interface SharedSkillRowProps {
  skill: Skill;
  linkedAgents: LinkedByAgentType[];
  /** Lock metadata for this skill (from .skill-lock.json) — undefined if not tracked. */
  lock?: SkillLockEntry;
  onOpen: () => void;
  onDelete: () => void;
  onUpdate?: () => void;
  onAgentIconClick: (agent: LinkedByAgentType) => void;
}

export function SharedSkillRow({
  skill,
  linkedAgents,
  lock,
  onOpen,
  onDelete,
  onUpdate,
  onAgentIconClick,
}: SharedSkillRowProps) {
  return (
    <div
      data-testid={`shared-skill-row-${skill.id}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className="group flex w-full items-center gap-3 border-b-whisper px-4 py-3 text-left transition-colors hover:bg-accent/40 cursor-pointer"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{skill.name}</span>
          {lock ? (
            <Badge
              variant="outline"
              data-testid={`source-badge-${skill.id}`}
              className="shrink-0 text-[10px] px-1.5 py-0 font-mono border-muted-foreground/30 text-muted-foreground inline-flex items-center gap-1"
              title={`Source: ${lock.source}\nInstalled: ${lock.installedAt}\nUpdated: ${lock.updatedAt}`}
            >
              <GitBranch className="h-2.5 w-2.5" />
              {lock.source}
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground">
              本地
            </Badge>
          )}
        </div>
        {skill.description && (
          <div
            className="line-clamp-1 text-xs"
            title={skill.description}
            style={{ color: 'var(--text-secondary)' }}
          >
            {skill.description}
          </div>
        )}
      </div>

      <div data-testid="row-agent-icons" className="flex shrink-0 items-center gap-1.5">
        {linkedAgents.map((agentType) => {
          const accent = agentAccent(agentType);
          return (
            <button
              key={agentType}
              type="button"
              data-testid={`agent-icon-${agentType}`}
              aria-label={`Open ${accent.label} skills`}
              onClick={(e) => { e.stopPropagation(); onAgentIconClick(agentType); }}
              onKeyDown={(e) => { e.stopPropagation(); }}
              className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
              style={{ background: accent.subtle }}
            >
              <img src={agentIconSrc(agentType)} alt="" className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      {lock && onUpdate && (
        <button
          type="button"
          data-testid={`update-${skill.id}`}
          aria-label={`Update ${skill.name}`}
          title={`Pull latest from ${lock.source}`}
          onClick={(e) => { e.stopPropagation(); onUpdate(); }}
          className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        aria-label={`Delete ${skill.name}`}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
