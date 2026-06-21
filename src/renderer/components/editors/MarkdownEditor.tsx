import { useState, useEffect } from 'react';
import { Save, RefreshCw, FileText } from 'lucide-react';
import { useMarkdown } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MarkdownEditorProps {
  filePath: string;
  title: string;
  description?: string;
  placeholder?: string;
  autoCreate?: boolean;
  /** Called after a successful manual save (e.g. so a parent list can re-read the file). */
  onSaved?: () => void;
}

export function MarkdownEditor({ filePath, title, description, placeholder, autoCreate, onSaved }: MarkdownEditorProps) {
  const { config, loading, saving, error, save, refresh } = useMarkdown(filePath);
  const [draft, setDraft] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (config !== null) {
      // eslint-disable-next-line react/set-state-in-effect -- intentional sync with external config after save/refresh
      setDraft(config.data ?? '');
      // eslint-disable-next-line react/set-state-in-effect -- intentional sync with external config after save/refresh
      setIsDirty(false);
      // Auto-create: immediately create the file with empty content if it doesn't exist
      if (autoCreate && !config.exists) {
        void save('');
      }
    }
  }, [config, autoCreate]); // eslint-disable-line react/exhaustive-deps

  async function handleSave() {
    await save(draft);
    setIsDirty(false);
    onSaved?.();
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div>
            <span className="font-medium text-sm">{title}</span>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { void refresh(); }}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" disabled={!isDirty || saving} onClick={() => { void handleSave(); }}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* File path */}
      <div className="border-b bg-muted/30 px-6 py-1.5 text-xs text-muted-foreground font-mono">
        {filePath}
      </div>

      {error && (
        <div className="border-b border-destructive/50 bg-destructive/10 px-6 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!config?.exists && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-sm text-amber-600 dark:text-amber-400">
          File does not exist yet. Changes will create it.
        </div>
      )}

      {/* Editor */}
      <Textarea
        className="flex-1 resize-none rounded-none border-0 p-6 font-mono text-sm leading-relaxed focus-visible:ring-0"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setIsDirty(true);
        }}
        placeholder={placeholder ?? `# ${title}\n\nAdd instructions here...`}
      />
    </div>
  );
}
