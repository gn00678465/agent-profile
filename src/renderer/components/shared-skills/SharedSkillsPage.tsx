import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FolderOpen, Package, Plus, RefreshCw, AlertCircle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSkills } from '@/hooks/useConfig';
import { callElectron, electronAPI } from '@/lib/electron';
import { agentAccent, CHIP_AGENT_ORDER } from '@/lib/agentColors';
import { SharedSkillRow } from './SharedSkillRow';
import { SharedSkillDetail } from './SharedSkillDetail';
import { InstallFromRegistryDialog } from './InstallFromRegistryDialog';
import { UpdateRegistryDialog } from './UpdateRegistryDialog';
import type {
  AgentProfile,
  AgentType,
  LinkedByAgentType,
  Skill,
  SkillLinkedBy,
  SkillLockEntry,
} from '@shared/types';

interface SharedSkillsPageProps {
  configDir: string;
  /** Invoked when a user clicks an agent icon on a row — switches the main app to that agent. */
  onSelectAgentType?: (type: AgentType) => void;
}

type ViewState = { mode: 'list' } | { mode: 'edit'; skillId: string } | { mode: 'new' };

export function SharedSkillsPage({ configDir, onSelectAgentType }: SharedSkillsPageProps) {
  const {
    skills,
    loading,
    error,
    saveSkill,
    deleteSkill,
    refresh,
  } = useSkills(configDir);

  const [view, setView] = useState<ViewState>({ mode: 'list' });
  const [linkedBy, setLinkedBy] = useState<SkillLinkedBy[]>([]);
  const [linkedByError, setLinkedByError] = useState<string | null>(null);
  const [lockMap, setLockMap] = useState<Record<string, SkillLockEntry>>({});
  const [chipCounts, setChipCounts] = useState<Record<LinkedByAgentType, number>>({
    'claude-code': 0,
    'claude-desktop': 0,
    gemini: 0,
    copilot: 0,
  });
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [updateDialog, setUpdateDialog] = useState<{ ids: string[]; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Map skillId → linked agent list (memoised)
  const linkedAgentsByskill = useMemo(() => {
    const m = new Map<string, LinkedByAgentType[]>();
    for (const entry of linkedBy) m.set(entry.skillId, entry.agents);
    return m;
  }, [linkedBy]);

  // Load reverse-link map + agent own-dir counts + skill-lock. CA-09 dedup applied here.
  const loadLinkedByAndCounts = useCallback(async () => {
    try {
      // Lock parse runs in parallel — best-effort; failure does not block.
      const [lb, lock] = await Promise.all([
        callElectron(() => electronAPI().config.getSkillsLinkedBy(configDir)),
        callElectron(() => electronAPI().config.getSkillLock(configDir)).catch(() => null),
      ]);
      setLinkedBy(lb);
      setLockMap(lock?.skills ?? {});

      // Aggregate the linkedBy term
      const linkedTerm: Record<LinkedByAgentType, number> = {
        'claude-code': 0, 'claude-desktop': 0, gemini: 0, copilot: 0,
      };
      for (const entry of lb) {
        for (const a of entry.agents) linkedTerm[a] += 1;
      }

      // For the own-dir term: getAgents + getSkills(configDir) for each non-shared agent.
      // CA-09: drop entries where isSymbolicLink === true (avoids double-count).
      const agents = await callElectron(() => electronAPI().config.getAgents());
      const ownTerm: Record<LinkedByAgentType, number> = {
        'claude-code': 0, 'claude-desktop': 0, gemini: 0, copilot: 0,
      };
      const linkedByAgentType = (a: AgentProfile): LinkedByAgentType | null =>
        a.type === 'shared' || a.type === 'custom' ? null : (a.type as LinkedByAgentType);
      for (const a of agents) {
        const key = linkedByAgentType(a);
        if (!key) continue;
        try {
          const own = await callElectron(() => electronAPI().config.getSkills(a.configDir));
          const nonLinks = own.filter((s) => s.isSymbolicLink !== true);
          ownTerm[key] += nonLinks.length;
        } catch {
          // Skip this agent — leave term at 0
        }
      }

      setChipCounts({
        'claude-code': linkedTerm['claude-code'] + ownTerm['claude-code'],
        'claude-desktop': linkedTerm['claude-desktop'] + ownTerm['claude-desktop'],
        gemini: linkedTerm.gemini + ownTerm.gemini,
        copilot: linkedTerm.copilot + ownTerm.copilot,
      });
      setLinkedByError(null);
    } catch (e) {
      setLinkedByError(e instanceof Error ? e.message : 'Failed to load linked-by map');
    }
  }, [configDir]);

  useEffect(() => {
    void loadLinkedByAndCounts();
  }, [loadLinkedByAndCounts, skills.length]);

  function selectSkill(skill: Skill) {
    setSaveError(null);
    setView({ mode: 'edit', skillId: skill.id });
  }

  async function handleDelete(skillId: string) {
    if (!confirm(`Delete skill "${skillId}"? This cannot be undone.`)) return;
    setActionError(null);
    try {
      if (lockMap[skillId]) {
        // Lock-tracked: route through `npx skills remove <id>` so the CLI also
        // cleans up symlinks across each agent's own skills/ dir and updates
        // the lockfile. Falls back to fs.rm if the CLI run fails for any
        // reason — the user's intent is still "delete this skill".
        try {
          const result = await callElectron(() =>
            electronAPI().config.removeSkillFromRegistry(configDir, [skillId])
          );
          if (result.exitCode !== 0) {
            // CLI reported failure — surface stderr and fall through to fs.rm
            throw new Error(result.stderr.trim() || `npx skills remove exited ${result.exitCode}`);
          }
          await refresh();
          await loadLinkedByAndCounts();
          return;
        } catch (cliErr) {
          // Defensive fallback: even if the CLI failed, attempt to unlink the
          // local folder so the row at least disappears from the list.
          try {
            await deleteSkill(skillId);
          } catch {
            setActionError(cliErr instanceof Error ? cliErr.message : 'Remove failed');
            return;
          }
          // Surface CLI failure to the user even though the fallback succeeded
          // — there may be lingering symlinks in other agents' dirs.
          const reason = cliErr instanceof Error ? cliErr.message : 'Unknown error';
          setActionError(
            `Removed locally, but "npx skills remove" failed: ${reason}. Agent symlinks may not have been cleaned up.`,
          );
        }
        return;
      }
      // Not lock-tracked: simple fs.rm via existing handler.
      await deleteSkill(skillId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function handleSave(id: string, content: string) {
    setSaving(true);
    setSaveError(null);
    try {
      const nameMatch = /^name:\s*(.+)$/m.exec(content);
      const name = nameMatch ? nameMatch[1].trim() : id;
      await saveSkill({ id, name, content });
      setView({ mode: 'list' });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleImportFolder() {
    setActionError(null);
    try {
      const picked = await callElectron(() => electronAPI().dialog.openDir());
      if (!picked) return;
      await callElectron(() => electronAPI().config.importSkillFromFolder(configDir, picked));
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Import failed');
    }
  }

  async function handleInstallZip() {
    setActionError(null);
    try {
      const picked = await callElectron(() =>
        electronAPI().dialog.openFile([{ name: 'ZIP Archive', extensions: ['zip'] }])
      );
      if (!picked) return;
      await callElectron(() => electronAPI().config.installSkillFromZip(configDir, picked));
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'ZIP install failed');
    }
  }

  function handleAgentIconClick(agentType: LinkedByAgentType) {
    onSelectAgentType?.(agentType);
  }

  if (view.mode !== 'list') {
    const editSkill = view.mode === 'edit' ? skills.find((s) => s.id === view.skillId) : undefined;
    return (
      <SharedSkillDetail
        mode={view.mode === 'new' ? 'new' : 'edit'}
        skill={editSkill}
        saving={saving}
        saveError={saveError}
        onSave={handleSave}
        onBack={() => { setView({ mode: 'list' }); setSaveError(null); }}
      />
    );
  }

  return (
    <div data-testid="shared-skills-page" className="flex h-full flex-col">
      {/* Header */}
      <div
        data-testid="shared-skills-header"
        className="flex shrink-0 items-center justify-between border-b-whisper px-4 py-3"
      >
        <h2 className="text-card-title m-0" style={{ color: 'var(--text-primary)' }}>
          Shared Skills
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            data-testid="header-install-registry"
            onClick={() => setInstallDialogOpen(true)}
          >
            <Download className="h-3.5 w-3.5" />
            Install from registry
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="header-import-folder"
            onClick={() => { void handleImportFolder(); }}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Import existing folder
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="header-install-zip"
            onClick={() => { void handleInstallZip(); }}
          >
            <Package className="h-3.5 w-3.5" />
            Install from ZIP
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="header-update-all"
            disabled={Object.keys(lockMap).length === 0}
            onClick={() => setUpdateDialog({ ids: [], label: 'all tracked skills' })}
            title="Run `npx skills update` for every tracked skill"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Update all
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div
        data-testid="shared-skills-filter"
        className="flex shrink-0 items-center justify-between border-b-whisper px-4 py-2.5"
      >
        <div data-testid="filter-chip-group" className="flex items-center gap-2">
          {CHIP_AGENT_ORDER.map((agentType) => {
            const accent = agentAccent(agentType);
            const count = chipCounts[agentType];
            return (
              <span
                key={agentType}
                data-testid={`filter-chip-${agentType}`}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-mono"
                style={{ background: accent.subtle, color: accent.primary }}
              >
                <span>{accent.glyph}</span>
                <span>{accent.label}</span>
                <span className="opacity-60">·</span>
                <span data-testid={`filter-chip-count-${agentType}`}>{count}</span>
              </span>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          data-testid="filter-refresh"
          onClick={() => { void refresh(); void loadLinkedByAndCounts(); }}
          aria-label="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Error banner — one row per source, stacked vertically (D-01) */}
      {(error || actionError || linkedByError) && (
        <div
          data-testid="error-banner"
          className="flex shrink-0 flex-col gap-1.5 border-l-4 border-destructive bg-destructive/5 px-4 py-2 text-xs text-destructive"
        >
          {[
            error && { key: 'load', msg: error },
            actionError && { key: 'action', msg: actionError },
            linkedByError && { key: 'linkedBy', msg: linkedByError },
          ].filter(Boolean).map((item) => {
            const entry = item as { key: string; msg: string };
            return (
              <div key={entry.key} className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{entry.msg}</span>
              </div>
            );
          })}
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => {
                setActionError(null);
                setLinkedByError(null);
                void refresh();
                void loadLinkedByAndCounts();
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* List region — flex column so the ScrollArea can shrink/grow properly.
          Bug fix: previously the parent was a plain block + ScrollArea used
          h-full, which caused the ScrollArea to overlap the Create-blank row
          above it and pushed the last list item below the viewport. */}
      <div data-testid="shared-skills-list" className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {/* D-02: Create blank link at top-left of list region per UI Spec */}
        <div className="flex shrink-0 items-center justify-start border-b-whisper px-4 py-1.5">
          <button
            type="button"
            data-testid="filter-create-blank"
            onClick={() => { setSaveError(null); setView({ mode: 'new' }); }}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Create blank skill
          </button>
        </div>
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Loading skills…
            </div>
          ) : skills.length === 0 ? (
            <div
              data-testid="empty-state"
              className="flex h-full items-center justify-center px-8 text-center text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              No shared skills yet. Use the buttons above to install from registry, import a folder, or install from ZIP.
            </div>
          ) : (
            <ScrollArea className="h-full">
              {skills.map((skill) => (
                <SharedSkillRow
                  key={skill.id}
                  skill={skill}
                  linkedAgents={linkedAgentsByskill.get(skill.id) ?? []}
                  lock={lockMap[skill.id]}
                  onOpen={() => selectSkill(skill)}
                  onDelete={() => { void handleDelete(skill.id); }}
                  onUpdate={lockMap[skill.id]
                    ? () => setUpdateDialog({ ids: [skill.id], label: skill.id })
                    : undefined}
                  onAgentIconClick={handleAgentIconClick}
                />
              ))}
            </ScrollArea>
          )}
        </div>
      </div>

      <InstallFromRegistryDialog
        open={installDialogOpen}
        onOpenChange={setInstallDialogOpen}
        sharedConfigDir={configDir}
        onInstallComplete={async () => {
          await refresh();
          await loadLinkedByAndCounts();
          setInstallDialogOpen(false);
        }}
      />

      {updateDialog && (
        <UpdateRegistryDialog
          open
          onOpenChange={(v) => { if (!v) setUpdateDialog(null); }}
          sharedConfigDir={configDir}
          skillIds={updateDialog.ids}
          targetLabel={updateDialog.label}
          onUpdateComplete={async () => {
            await refresh();
            await loadLinkedByAndCounts();
          }}
        />
      )}
    </div>
  );
}
