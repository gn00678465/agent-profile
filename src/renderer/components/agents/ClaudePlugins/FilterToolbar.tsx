import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type FilterValue = 'all' | 'user' | 'project';

interface FilterToolbarProps {
  filter: FilterValue;
  count: number;
  onChange: (filter: FilterValue) => void;
  onRefresh: () => void;
  accentColor: string;
}

export function FilterToolbar({ filter, count, onChange, onRefresh, accentColor }: FilterToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Installed Plugins ({count})
        </span>
        <div className="flex gap-1">
          {(['all', 'user', 'project'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onChange(f)}
              className={`rounded px-2 py-0.5 text-xs capitalize transition-colors ${
                filter === f
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              style={filter === f ? { background: accentColor } : undefined}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
