import { useState, useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { callElectron, electronAPI } from '@/lib/electron';
import { Card } from '@/components/ui/card';
import { ExtensionListLayout } from '@/components/shared/ExtensionListLayout';
import type { ClaudePluginError } from '@shared/types';

interface ErrorsTabProps {
  configDir: string;
  onCountChange?: (count: number) => void;
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function ErrorsTab({ configDir, onCountChange }: ErrorsTabProps) {
  const [errors, setErrors] = useState<ClaudePluginError[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callElectron(() => electronAPI().config.getClaudePluginErrors(configDir));
      const list = result ?? [];
      setErrors(list);
      onCountChange?.(list.filter((e: ClaudePluginError) => e.severity === 'error').length);
    } catch (err) {
      toast.error('Failed to load errors', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      setErrors([]);
      onCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [configDir, onCountChange]);

  useEffect(() => { void load(); }, [load]);

  return (
    <ExtensionListLayout
      loading={loading}
      loadingText="Loading errors..."
      isEmpty={errors.length === 0}
      emptyTitle="No plugin errors"
      emptyIcon={<AlertCircle className="h-10 w-10 opacity-30" />}
    >
      <div className="flex flex-col gap-3 p-4">
        {errors.map((e) => (
          <Card
            key={`${e.scope}:${e.targetId}:${e.raisedAt}:${e.message.slice(0, 32)}`}
            className="border-whisper p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="badge-notion">{e.scope}</span>
                  <span className="badge-notion">{e.severity}</span>
                  <span className="font-mono text-xs">{e.targetId}</span>
                </div>
                <div className="mt-2 text-sm break-all">{e.message}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {formatTime(e.raisedAt)}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ExtensionListLayout>
  );
}
