import { useEffect, useState } from 'react';
import { ChevronLeft, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_SKILL_TEMPLATE } from '@/components/editors/SkillsEditor';
import type { Skill } from '@shared/types';

interface SharedSkillDetailProps {
  mode: 'edit' | 'new';
  skill?: Skill;
  saving: boolean;
  saveError: string | null;
  onSave: (id: string, content: string) => Promise<void> | void;
  onBack: () => void;
}

export function SharedSkillDetail({
  mode,
  skill,
  saving,
  saveError,
  onSave,
  onBack,
}: SharedSkillDetailProps) {
  const [newId, setNewId] = useState('');
  const [content, setContent] = useState<string>(
    mode === 'new' ? DEFAULT_SKILL_TEMPLATE : (skill?.content ?? '')
  );

  // Esc returns to list (AC-3)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  async function handleSave() {
    const id = mode === 'new' ? newId.trim() : (skill?.id ?? '');
    if (!id) return;
    await onSave(id, content);
  }

  return (
    <div
      data-testid="shared-skills-detail"
      className="flex h-full flex-col"
    >
      <div className="flex items-center justify-between border-b-whisper px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            aria-label="Back to list"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to list
          </Button>
          {mode === 'new' ? (
            <Input
              data-testid="new-skill-id-input"
              className="h-7 w-48 text-xs font-mono"
              placeholder="skill-id"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
            />
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate font-mono text-xs text-muted-foreground">
                {skill?.id}
              </span>
              {skill?.version && (
                <Badge variant="outline" className="text-xs">v{skill.version}</Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={saving || (mode === 'new' && !newId.trim())}
            onClick={() => { void handleSave(); }}
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {saveError}
        </div>
      )}

      <Textarea
        data-testid="shared-skill-editor"
        className="flex-1 resize-none rounded-none border-0 font-mono text-xs leading-relaxed focus-visible:ring-0"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="SKILL.md content…"
      />
    </div>
  );
}
