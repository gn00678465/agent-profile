import { useState, useEffect, useCallback, useRef } from 'react';
import { FolderOpen, FolderClosed, FileText, RefreshCw, ChevronRight, Plus, X, Pencil } from 'lucide-react';
import { callElectron, electronAPI } from '@/lib/electron';
import { Button } from '@/components/ui/button';
import { RemoveButton } from '@/components/ui/remove-button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { RuleFile } from '@shared/types';
import { MarkdownEditor } from './MarkdownEditor';

interface RulesEditorProps {
  configDir: string;
  accentColor: string;
}

export function RulesEditor({ configDir, accentColor }: RulesEditorProps) {
  const [rules, setRules] = useState<RuleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<RuleFile | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());

  // Add
  const [showAddInput, setShowAddInput] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [addError, setAddError] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  // Rename
  const [renamingRuleId, setRenamingRuleId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  function toggleFolder(folder: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callElectron(() =>
        electronAPI().config.getRules(configDir)
      );
      setRules(result);
    } catch (err) {
      toast.error('Failed to load rules', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [configDir]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (showAddInput) addInputRef.current?.focus();
  }, [showAddInput]);

  useEffect(() => {
    if (renamingRuleId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingRuleId]);

  async function handleDelete(rule: RuleFile) {
    if (!confirm(`Delete rule "${rule.name}"?\n${rule.path}\n\nThis cannot be undone.`)) return;
    try {
      await callElectron(() => electronAPI().config.deleteRule(rule.path));
      toast.success('Rule deleted');
      if (selectedRule?.id === rule.id) setSelectedRule(null);
      await load();
    } catch (err) {
      toast.error('Failed to delete rule', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  async function handleDeleteFolder(folder: string) {
    if (!confirm(`Delete folder "${folder}" and all its rules?\n\nThis cannot be undone.`)) return;
    try {
      await callElectron(() => electronAPI().config.deleteRuleFolder(configDir, folder));
      toast.success(`Folder "${folder}" deleted`);
      if (selectedRule?.folder === folder) setSelectedRule(null);
      await load();
    } catch (err) {
      toast.error('Failed to delete folder', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  async function handleAddRule() {
    const trimmed = addValue.trim();
    if (!trimmed) { setAddError('Enter a rule path'); return; }
    try {
      const filePath = await callElectron(() =>
        electronAPI().config.createRule(configDir, trimmed)
      );
      toast.success('Rule created');
      setShowAddInput(false);
      setAddValue('');
      setAddError('');
      const freshRules = await callElectron(() => electronAPI().config.getRules(configDir));
      setRules(freshRules);
      const newRule = freshRules.find((r) => r.path === filePath);
      if (newRule) setSelectedRule(newRule);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create rule');
    }
  }

  function startRename(rule: RuleFile) {
    setRenamingRuleId(rule.id);
    setRenameValue(rule.name);
    setRenameError('');
  }

  function cancelRename() {
    setRenamingRuleId(null);
    setRenameValue('');
    setRenameError('');
  }

  async function commitRename(rule: RuleFile) {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === rule.name) { cancelRename(); return; }
    try {
      const newPath = await callElectron(() =>
        electronAPI().config.renameRule(rule.path, trimmed)
      );
      toast.success('Rule renamed');
      cancelRename();
      const freshRules = await callElectron(() => electronAPI().config.getRules(configDir));
      setRules(freshRules);
      const updated = freshRules.find((r) => r.path === newPath);
      if (selectedRule?.id === rule.id) setSelectedRule(updated ?? null);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Rename failed');
    }
  }

  // Group rules by folder
  const grouped = rules.reduce((acc, rule) => {
    const key = rule.folder || '';
    if (!acc[key]) acc[key] = [];
    acc[key].push(rule);
    return acc;
  }, {} as Record<string, RuleFile[]>);

  const folders = Object.keys(grouped).sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: file tree */}
      <div className="flex flex-col overflow-hidden border-r border-border" style={{ width: 220, minWidth: 220 }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Rules
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              title="Add rule"
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

        {/* Add rule input */}
        {showAddInput && (
          <div className="border-b border-border px-2 py-2 shrink-0">
            <Input
              ref={addInputRef}
              className="h-6 text-xs font-mono"
              placeholder="folder/rule.md or rule.md"
              value={addValue}
              onChange={(e) => { setAddValue(e.target.value); setAddError(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { void handleAddRule(); }
                if (e.key === 'Escape') { setShowAddInput(false); setAddValue(''); setAddError(''); }
              }}
            />
            {addError && <p className="mt-1 text-[10px] text-destructive">{addError}</p>}
            <p className="mt-1 text-[10px] text-muted-foreground">Press Enter to create</p>
          </div>
        )}

        {/* File list */}
        {!loading && rules.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
            <FileText className="h-8 w-8 opacity-30" />
            <p className="text-xs">No rules files found</p>
            <p className="font-mono text-[10px] opacity-60 break-all">{configDir}/rules/</p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div>
              {folders.map((folder) => (
                <div key={folder}>
                  {/* Folder header */}
                  {folder !== '' && (
                    <div className="group flex w-full items-center gap-1.5 px-3 py-1.5">
                      <button
                        className="flex flex-1 min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                        onClick={() => toggleFolder(folder)}
                      >
                        <ChevronRight
                          className="h-3 w-3 shrink-0 transition-transform"
                          style={{ transform: collapsedFolders.has(folder) ? 'rotate(0deg)' : 'rotate(90deg)' }}
                        />
                        {collapsedFolders.has(folder)
                          ? <FolderClosed className="h-3 w-3 shrink-0" />
                          : <FolderOpen className="h-3 w-3 shrink-0" />
                        }
                        <span className="truncate">{folder}</span>
                      </button>
                      <RemoveButton
                        label={`Delete folder "${folder}"`}
                        className="h-4 w-4"
                        onClick={() => { void handleDeleteFolder(folder); }}
                      />
                    </div>
                  )}

                  {/* Files */}
                  {!collapsedFolders.has(folder) && grouped[folder].map((rule) => {
                    const isSelected = selectedRule?.id === rule.id;
                    const isRenaming = renamingRuleId === rule.id;
                    const displayName = rule.name.replace(/\.md$/i, '');
                    return (
                      <div
                        key={rule.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => { if (!isRenaming) setSelectedRule(isSelected ? null : rule); }}
                        onKeyDown={(e) => {
                          if (!isRenaming && (e.key === 'Enter' || e.key === ' '))
                            setSelectedRule(isSelected ? null : rule);
                        }}
                        className={`group flex w-full cursor-pointer items-center gap-1.5 py-1.5 text-left transition-colors ${
                          folder !== '' ? 'pl-6 pr-3' : 'px-3'
                        } ${isSelected ? 'bg-accent/60' : 'hover:bg-accent/30'}`}
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
                                if (e.key === 'Enter') { void commitRename(rule); }
                                if (e.key === 'Escape') { cancelRename(); }
                              }}
                              onBlur={() => { void commitRename(rule); }}
                            />
                            {renameError && (
                              <p className="text-[10px] text-destructive leading-tight mt-0.5">{renameError}</p>
                            )}
                          </div>
                        ) : (
                          <span
                            className="truncate text-xs w-[120px]"
                            style={{ ...(isSelected ? { color: accentColor, fontWeight: 500 } : {}) }}
                          >
                            {displayName}
                          </span>
                        )}

                        {!isRenaming && (
                          <>
                            <Button
                              variant="ghost" size="icon"
                              className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 hover:bg-accent"
                              title="Rename"
                              onClick={(e) => { e.stopPropagation(); startRename(rule); }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <RemoveButton
                              label="Delete"
                              className="h-5 w-5"
                              onClick={(e) => { e.stopPropagation(); void handleDelete(rule); }}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Right panel: editor */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedRule === null ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm">Select a rule to edit</p>
          </div>
        ) : (
          <MarkdownEditor
            filePath={selectedRule.path}
            title={selectedRule.name.replace(/\.md$/i, '')}
            description={`${selectedRule.folder ? selectedRule.folder + '/' : ''}${selectedRule.name}`}
          />
        )}
      </div>
    </div>
  );
}
