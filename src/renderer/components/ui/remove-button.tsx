import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface RemoveButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /**
   * `ghost`  — icon-only, fades in when parent has `group` and is hovered (default)
   * `panel`  — full-width outline button with icon + label text
   */
  variant?: 'ghost' | 'panel';
  /** Accessible label used as aria-label and title tooltip */
  label?: string;
  /** Keep the button visible even when the parent is not hovered.
   *  Only applies to the `ghost` variant. */
  alwaysVisible?: boolean;
}

const RemoveButton = React.forwardRef<HTMLButtonElement, RemoveButtonProps>(
  ({ variant = 'ghost', label, alwaysVisible = false, className, onClick, ...props }, ref) => {
    if (variant === 'panel') {
      return (
        <Button
          ref={ref}
          variant="outline"
          size="sm"
          className={cn(
            'w-full justify-start gap-2',
            'border-destructive/40 text-destructive',
            'transition-colors duration-150',
            'hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive',
            'active:scale-[0.98]',
            className,
          )}
          onClick={onClick}
          aria-label={label}
          title={label}
          {...props}
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" />
          {label ?? 'Delete'}
        </Button>
      );
    }

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        className={cn(
          'h-6 w-6 shrink-0',
          'text-muted-foreground',
          'transition-all duration-150',
          'hover:bg-destructive/10 hover:text-destructive',
          'active:scale-90',
          !alwaysVisible && 'opacity-0 group-hover:opacity-100',
          className,
        )}
        onClick={onClick}
        aria-label={label ?? 'Delete'}
        title={label}
        {...props}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    );
  },
);

RemoveButton.displayName = 'RemoveButton';

export { RemoveButton };
