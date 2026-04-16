import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { RemoveButton } from '@/components/ui/remove-button';

interface ExtensionRowProps {
  name: string;
  enabled: boolean;
  accentColor: string;
  /** Second line of text (e.g. description or "v1.0.0 · marketplace") */
  subtitle?: ReactNode;
  /** Badge displayed next to the name (e.g. scope badge) */
  badge?: ReactNode;
  /** Accessible label for the delete button */
  deleteLabel?: string;
  /** If provided, renders a Switch toggle */
  onToggle?: (enabled: boolean) => void;
  /** If provided, the row is clickable (role="button") */
  onClick?: () => void;
  /** Highlight the row as selected (only meaningful when onClick is set) */
  selected?: boolean;
  /** Show a ChevronRight icon on the right */
  showChevron?: boolean;
  onDelete: () => void;
}

export function ExtensionRow({
  name,
  enabled,
  accentColor,
  subtitle,
  badge,
  deleteLabel = 'Delete',
  onToggle,
  onClick,
  selected,
  showChevron,
  onDelete,
}: ExtensionRowProps) {
  const isClickable = !!onClick;

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={[
        'group flex w-full items-center justify-between border-b-whisper px-4 py-3 text-left transition-colors',
        isClickable ? 'cursor-pointer' : '',
        selected ? 'bg-accent/60' : isClickable ? 'hover:bg-accent/30' : '',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-1 shrink-0">
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: enabled ? accentColor : 'var(--text-muted)' }}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{name}</span>
            {badge}
          </div>
          {subtitle && (
            <div className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{subtitle}</div>
          )}
        </div>
      </div>

      <div className="ml-2 flex shrink-0 items-center gap-2">
        {onToggle && (
          <Switch
            checked={enabled ?? false}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={onToggle}
          />
        )}
        <RemoveButton
          label={deleteLabel}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        />
        {showChevron && (
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
        )}
      </div>
    </div>
  );
}
