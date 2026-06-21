import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, RefreshCw, Plus, X, Pencil } from 'lucide-react';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { RemoveButton } from '@/components/ui/remove-button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { SubagentFile } from '@shared/types';
import { MarkdownEditor } from './MarkdownEditor';
import { TomlFileEditor } from './TomlFileEditor';

interface SubagentsEditorProps {
  configDir: string;
  accentColor: string;
  /** Subfolder + extension for the subagent files. Defaults to Copilot's subagents/.agent.md. */
  subdir?: string;
  ext?: string;
  /** Right-panel editor: 'markdown' (Copilot .agent.md) or 'toml' (Codex .toml). */
  editorKind?: 'markdown' | 'toml';
  /** Builds the initial content for a newly-created file (e.g. a Codex TOML skeleton). */
  template?: (name: string) => string;
}

export function SubagentsEditor({
  configDir,
  accentColor,
  subdir = 'subagents',
  ext = '.agent.md',
  editorKind = 'markdown',
  template,
}: SubagentsEditorProps) {
  const [subagents, setSubagents] = useState<SubagentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SubagentFile | null>(null);

  // Add new subagent
  const [showAddInput, setShowAddInput] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [addError, setAddError] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  // Rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callElectron(() =>
        electronAPI().config.getSubagents(configDir, { dir: subdir, ext })
      );
      setSubagents(result);
      return result;
    } catch (err) {
      toast.error('Failed to load subagents', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      return [] as SubagentFile[];
    } finally {
      setLoading(false);
    }
  }, [configDir, subdir, ext]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (showAddInput) addInputRef.current?.focus();
  }, [showAddInput]);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  async function handleDelete(agent: SubagentFile) {
    if (!confirm(`Delete subagent "${agent.name}"?\n${agent.path}\n\nThis cannot be undone.`)) return;
    try {
      await callElectron(() => electronAPI().config.deleteSubagent(configDir, agent.name, { dir: subdir, ext }));
      toast.success('Subagent deleted');
      if (selected?.id === agent.id) setSelected(null);
      await load();
    } catch (err) {
      toast.error('Failed to delete subagent', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  async function handleAdd() {
    const trimmed = addValue.trim();
    if (!trimmed) { setAddError('Enter a subagent name'); return; }
    // Case-insensitive: Windows filesystems collide on case, silently overwriting.
    if (subagents.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())) {
      setAddError(`A subagent named "${trimmed}" already exists`);
      return;
    }
    try {
      const filePath = await callElectron(() =>
        electronAPI().config.createSubagent(configDir, trimmed, { dir: subdir, ext, template: template?.(trimmed) })
      );
      toast.success('Subagent created');
      setShowAddInput(false);
      setAddValue('');
      setAddError('');
      const freshAgents = await load();
      const newAgent = freshAgents.find((a) => a.path === filePath);
      if (newAgent) setSelected(newAgent);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create subagent');
    }
  }

  function startRename(agent: SubagentFile) {
    setRenamingId(agent.id);
    setRenameValue(agent.name);
    setRenameError('');
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue('');
    setRenameError('');
  }

  async function commitRename(agent: SubagentFile) {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === agent.name) { cancelRename(); return; }
    if (subagents.some((a) => a.id !== agent.id && a.name.toLowerCase() === trimmed.toLowerCase())) {
      setRenameError(`A subagent named "${trimmed}" already exists`);
      return;
    }
    try {
      const newPath = await callElectron(() =>
        electronAPI().config.renameSubagent(configDir, agent.name, trimmed, { dir: subdir, ext })
      );
      toast.success('Subagent renamed');
      cancelRename();
      const freshAgents = await load();
      const updated = freshAgents.find((a) => a.path === newPath);
      if (selected?.id === agent.id) setSelected(updated ?? null);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Rename failed');
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="flex flex-col overflow-hidden border-r border-border" style={{ width: 220, minWidth: 220 }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Subagents
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              title="Add subagent"
              onClick={() => { setShowAddInput((v) => !v); setAddValue(''); setAddError(''); }}
            >
              {showAddInput ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              onClick={() => { void load(); }} disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Add input */}
        {showAddInput && (
          <div className="border-b border-border px-2 py-2 shrink-0">
            <Input
              ref={addInputRef}
              className="h-6 text-xs font-mono"
              placeholder="subagent-name"
              value={addValue}
              onChange={(e) => { setAddValue(e.target.value); setAddError(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { void handleAdd(); }
                if (e.key === 'Escape') { setShowAddInput(false); setAddValue(''); setAddError(''); }
              }}
            />
            {addError && <p className="mt-1 text-[10px] text-destructive">{addError}</p>}
            <p className="mt-1 text-[10px] text-muted-foreground">
              Creates <span className="font-mono">{addValue || 'name'}{ext}</span> · Enter to create
            </p>
          </div>
        )}

        {/* File list */}
        {!loading && subagents.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
            <FileText className="h-8 w-8 opacity-30" />
            <p className="text-xs">No subagents found</p>
            <p className="font-mono text-[10px] opacity-60 break-all">{configDir}/{subdir}/</p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div>
              {subagents.map((agent) => {
                const isSelected = selected?.id === agent.id;
                const isRenaming = renamingId === agent.id;
                return (
                  <div
                    key={agent.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => { if (!isRenaming) setSelected(isSelected ? null : agent); }}
                    onKeyDown={(e) => {
                      if (!isRenaming && (e.key === 'Enter' || e.key === ' '))
                        setSelected(isSelected ? null : agent);
                    }}
                    className={`group flex w-full cursor-pointer items-center gap-1.5 px-3 py-1.5 text-left transition-colors ${
                      isSelected ? 'bg-accent/60' : 'hover:bg-accent/30'
                    }`}
                  >
                    <FileText
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: isSelected ? accentColor : undefined }}
                    />

                    {isRenaming ? (
                      <div className="flex flex-1 min-w-0 flex-col" onClick={(e) => e.stopPropagation()}>
                        <Input
                          ref={renameInputRef}
                          className="h-5 px-1 text-xs font-mono border-0 border-b rounded-none focus-visible:ring-0"
                          value={renameValue}
                          onChange={(e) => { setRenameValue(e.target.value); setRenameError(''); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { void commitRename(agent); }
                            if (e.key === 'Escape') { cancelRename(); }
                          }}
                          onBlur={() => { void commitRename(agent); }}
                        />
                        {renameError && (
                          <p className="text-[10px] text-destructive leading-tight mt-0.5">{renameError}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex w-[120px] min-w-0 flex-col">
                        <span
                          className="truncate text-xs"
                          style={{ ...(isSelected ? { color: accentColor, fontWeight: 500 } : {}) }}
                        >
                          {agent.name}
                        </span>
                        {agent.description && (
                          <span
                            className="truncate text-[10px] text-muted-foreground"
                            title={agent.description}
                          >
                            {agent.description}
                          </span>
                        )}
                      </div>
                    )}

                    {!isRenaming && (
                      <>
                        <Button
                          variant="ghost" size="icon"
                          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 hover:bg-accent"
                          title="Rename"
                          onClick={(e) => { e.stopPropagation(); startRename(agent); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <RemoveButton
                          label="Delete"
                          className="h-5 w-5"
                          onClick={(e) => { e.stopPropagation(); void handleDelete(agent); }}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selected === null ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm">Select a subagent to edit</p>
          </div>
        ) : editorKind === 'toml' ? (
          <TomlFileEditor
            filePath={selected.path}
            title={selected.name}
            description={`${selected.name}${ext}`}
            onSaved={() => { void load(); }}
          />
        ) : (
          <MarkdownEditor
            filePath={selected.path}
            title={selected.name}
            description={`${selected.name}${ext}`}
            onSaved={() => { void load(); }}
          />
        )}
      </div>
    </div>
  );
}
