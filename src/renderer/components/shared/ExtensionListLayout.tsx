import type { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ExtensionListLayoutProps {
  loading: boolean;
  loadingText?: string;
  isEmpty: boolean;
  emptyIcon?: ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
  toolbar?: ReactNode;
  /** Always provided by the caller; rendered only when `!loading && !isEmpty`. */
  children: ReactNode;
}

export function ExtensionListLayout({
  loading,
  loadingText = 'Loading...',
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  toolbar,
  children,
}: ExtensionListLayoutProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        {loadingText}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {toolbar}
      <ScrollArea className="flex-1">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground [&>svg]:h-10 [&>svg]:w-10 [&>img]:h-10 [&>img]:w-10">
            {emptyIcon}
            <p className="text-card-title" style={{ color: 'var(--text-primary)' }}>{emptyTitle}</p>
            {emptyDescription && (
              <p className="text-[14px] text-muted-foreground">{emptyDescription}</p>
            )}
          </div>
        ) : (
          children
        )}
      </ScrollArea>
    </div>
  );
}
