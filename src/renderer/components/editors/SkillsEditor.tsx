import { useState } from 'react';
import { Plus, Save, X, RefreshCw, Zap, Link } from 'lucide-react';
import { useSkills } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { RemoveButton } from '@/components/ui/remove-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AddSkillDialog } from './AddSkillDialog';
import type { Skill } from '@shared/types';

interface SkillsEditorProps {
  configDir: string;
  agentName: string;
  /** 'shared' hides the "Link from Shared" option in the dialog */
  agentType?: string;
}

export const DEFAULT_SKILL_TEMPLATE = `---
name: my-skill
version: "1.0.0"
description: "Describe when to use this skill"
user-invocable: true
allowed-tools:
  - Read
  - Write
---

# My Skill

Describe what this skill does and how to use it.

## Instructions

Add your skill instructions here.
`;

export function SkillsEditor({ configDir, agentName, agentType = 'custom' }: SkillsEditorProps) {
  const { skills, loading, error, saveSkill, deleteSkill, linkSharedSkill, installSkillFromZip, refresh } = useSkills(configDir);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [newSkillId, setNewSkillId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const selectedSkill = skills.find((s) => s.id === selectedId);

  function startNew() {
    setIsNew(true);
    setSelectedId(null);
    setNewSkillId('');
    setEditingContent(DEFAULT_SKILL_TEMPLATE);
  }

  function selectSkill(skill: Skill) {
    setIsNew(false);
    setSelectedId(skill.id);
    setEditingContent(skill.content);
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingContent(null);
    setIsNew(false);
    setSelectedId(null);
  }

  async function handleSave() {
    if (!editingContent) return;

    const id = isNew ? newSkillId.trim() : selectedId;
    if (!id) {
      setSaveError('Skill ID is required');
      return;
    }

    // Extract name from frontmatter or use id
    const nameMatch = /^name:\s*(.+)$/m.exec(editingContent);
    const name = nameMatch ? nameMatch[1].trim() : id;

    setSaving(true);
    setSaveError(null);
    try {
      await saveSkill({
        id,
        name,
        content: editingContent,
      });
      setIsNew(false);
      setSelectedId(id);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(skillId: string) {
    if (!confirm(`Delete skill "${skillId}"? This cannot be undone.`)) return;
    try {
      await deleteSkill(skillId);
      if (selectedId === skillId) {
        setSelectedId(null);
        setEditingContent(null);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading skills...
      </div>
    );
  }

  return (
    <div className="flex h-full gap-0">
      {/* Skills list sidebar */}
      <div className="flex w-56 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            {agentName} Skills
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => { void refresh(); }}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {error && (
          <div className="px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        <ScrollArea className="flex-1">
          {skills.length === 0 && !isNew && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              No skills installed.
              <br />
              Click + to create one.
            </div>
          )}

          {isNew && (
            <div className="border-b bg-primary/5 px-3 py-2">
              <div className="flex items-center gap-1 text-xs font-medium text-primary">
                <Zap className="h-3 w-3" />
                New Skill
              </div>
            </div>
          )}

          {skills.map((skill) => (
            <div
              key={skill.id}
              role="button"
              tabIndex={0}
              onClick={() => selectSkill(skill)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectSkill(skill); }}
              className={`group flex w-full overflow-hidden cursor-pointer items-center justify-between border-b px-3 py-2 text-left text-sm transition-colors ${
                selectedId === skill.id
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              }`}
            >
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <div className="truncate text-xs font-medium">{skill.name}</div>
                  {skill.isSymbolicLink && (
                    <Link className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                  )}
                </div>
                {skill.description && (
                  <div className="line-clamp-1 text-xs text-muted-foreground">
                    {skill.description}
                  </div>
                )}
              </div>
              <RemoveButton
                label="Delete skill"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(skill.id);
                }}
              />
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Editor panel */}
      <div className="flex flex-1 flex-col">
        {editingContent !== null ? (
          <>
            {/* Editor header */}
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div className="flex items-center gap-3">
                {isNew && (
                  <Input
                    className="h-7 w-40 text-xs font-mono"
                    placeholder="skill-id"
                    value={newSkillId}
                    onChange={(e) => setNewSkillId(e.target.value)}
                  />
                )}
                {!isNew && selectedSkill && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {selectedSkill.id}
                    </span>
                    {selectedSkill.version && (
                      <Badge variant="outline" className="text-xs">
                        v{selectedSkill.version}
                      </Badge>
                    )}
                    {selectedSkill.userInvocable && (
                      <Badge variant="secondary" className="text-xs">
                        user-invocable
                      </Badge>
                    )}
                    {selectedSkill.isSymbolicLink && (
                      <Badge variant="outline" className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase border-muted-foreground/30">
                        <Link className="h-2 w-2" />
                        Symbolic Link
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button size="sm" disabled={saving} onClick={() => { void handleSave(); }}>
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>

            {saveError && (
              <div className="border-b border-destructive/50 bg-destructive/10 px-4 py-2 text-xs text-destructive">
                {saveError}
              </div>
            )}

            {/* Markdown editor */}
            <Textarea
              className="flex-1 resize-none rounded-none border-0 font-mono text-xs leading-relaxed focus-visible:ring-0"
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              placeholder="SKILL.md content..."
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Zap className="h-10 w-10 opacity-30" />
            <p className="text-sm">Select a skill to edit or create a new one</p>
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Skill
            </Button>
          </div>
        )}
      </div>

      {/* Add Skill Dialog */}
      <AddSkillDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        configDir={configDir}
        agentName={agentName}
        isShared={agentType === 'shared'}
        installedSkillIds={skills.map((s) => s.id)}
        linkSharedSkill={linkSharedSkill ?? (async () => {})}
        installSkillFromZip={installSkillFromZip ?? (async () => {})}
        onCreateNew={startNew}
      />
    </div>
  );
}
