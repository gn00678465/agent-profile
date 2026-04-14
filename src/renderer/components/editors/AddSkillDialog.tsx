import { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Link2,
  Package,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  FolderOpen,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { callElectron, electronAPI } from '@/lib/electron';
import type { Skill } from '@shared/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AddSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current agent config dir */
  configDir: string;
  agentName: string;
  /** When true (shared agent), the "Link from Shared" option is hidden */
  isShared: boolean;
  /** Already-installed skill ids (to show "linked" state) */
  installedSkillIds: string[];
  linkSharedSkill: (sharedSkillPath: string, skillId: string) => Promise<void>;
  installSkillFromZip: (zipFilePath: string) => Promise<void>;
  onCreateNew: () => void;
}

type DialogView = 'main' | 'link-shared';

interface SharedSkillState {
  skill: Skill;
  status: 'idle' | 'linking' | 'linked' | 'error';
  errorMsg?: string;
}

// ─── Option Card ────────────────────────────────────────────────────────────

interface OptionCardProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  badge?: string;
  accent?: string;
  onClick: () => void;
  disabled?: boolean;
}

function OptionCard({
  icon,
  label,
  description,
  badge,
  accent = 'var(--border-subtle)',
  onClick,
  disabled = false,
}: OptionCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'group relative flex w-full items-center gap-4 rounded-lg border px-4 py-3.5',
        'text-left transition-all duration-150 outline-none',
        'hover:border-border hover:bg-accent/40',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        'disabled:pointer-events-none disabled:opacity-40',
        'border-border bg-transparent',
      ].join(' ')}
      style={{ '--card-accent': accent } as React.CSSProperties}
    >
      {/* Left accent bar */}
      <span
        className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        style={{ background: accent }}
      />

      {/* Icon */}
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background/60 transition-colors duration-150 group-hover:border-[var(--card-accent)]/40"
        style={{}}
      >
        {icon}
      </span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-foreground">{label}</span>
          {badge && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono border-muted-foreground/30 text-muted-foreground">
              {badge}
            </Badge>
          )}
        </div>
        <span className="block truncate text-xs text-muted-foreground mt-0.5">{description}</span>
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
    </button>
  );
}

// ─── Shared Skill Row ─────────────────────────────────────────────────────────

function SharedSkillRow({
  state,
  alreadyLinked,
  onLink,
}: {
  state: SharedSkillState;
  alreadyLinked: boolean;
  onLink: () => void;
}) {
  const { skill, status, errorMsg } = state;
  const isLinked = status === 'linked' || alreadyLinked;

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-background/40 px-3 py-2.5 transition-colors hover:bg-accent/20">
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-foreground truncate">{skill.name}</span>
          {(isLinked) && (
            <Badge variant="outline" className="shrink-0 text-[9px] px-1.5 py-0 font-mono border-emerald-500/40 text-emerald-500">
              linked
            </Badge>
          )}
          {skill.version && !isLinked && (
            <Badge variant="outline" className="shrink-0 text-[9px] px-1.5 py-0 font-mono border-muted-foreground/20 text-muted-foreground">
              v{skill.version}
            </Badge>
          )}
        </div>
        {skill.description && (
          <span className="block text-[11px] text-muted-foreground truncate mt-0.5">{skill.description}</span>
        )}
        {status === 'error' && errorMsg && (
          <span className="flex items-center gap-1 mt-1 text-[11px] text-destructive">
            <AlertCircle className="h-3 w-3" />
            {errorMsg}
          </span>
        )}
      </div>

      {/* Action */}
      <Button
        variant={isLinked ? 'ghost' : 'outline'}
        size="sm"
        className="h-7 shrink-0 px-3 text-xs font-mono"
        disabled={isLinked || status === 'linking'}
        onClick={onLink}
      >
        {status === 'linking' ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isLinked ? (
          <><Check className="h-3 w-3 mr-1 text-emerald-500" /><span className="text-emerald-500">Linked</span></>
        ) : (
          <><Link2 className="h-3 w-3 mr-1" />Link</>
        )}
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AddSkillDialog({
  open,
  onOpenChange,
  agentName,
  isShared,
  installedSkillIds,
  linkSharedSkill,
  installSkillFromZip,
  onCreateNew,
}: AddSkillDialogProps) {
  const [view, setView] = useState<DialogView>('main');
  const [sharedSkills, setSharedSkills] = useState<SharedSkillState[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  // ── Reset on close ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react/set-state-in-effect -- intentional reset on dialog close
      setView('main');
      // eslint-disable-next-line react/set-state-in-effect -- intentional reset on dialog close
      setSharedSkills([]);
      // eslint-disable-next-line react/set-state-in-effect -- intentional reset on dialog close
      setSharedError(null);
      // eslint-disable-next-line react/set-state-in-effect -- intentional reset on dialog close
      setZipError(null);
    }
  }, [open]);

  // ── Load shared skills ───────────────────────────────────────────────────
  const loadSharedSkills = useCallback(async () => {
    setLoadingShared(true);
    setSharedError(null);
    try {
      const agents = await callElectron(() => electronAPI().config.getAgents());
      const sharedAgent = agents.find((a) => a.type === 'shared');
      if (!sharedAgent) {
        setSharedError('Shared skills agent not found');
        return;
      }
      const skills = await callElectron(() =>
        electronAPI().config.getSkills(sharedAgent.configDir)
      );
      setSharedSkills(
        skills.map((s) => ({
          skill: { ...s, dirPath: s.dirPath ?? `${sharedAgent.configDir}/skills/${s.id}` },
          status: 'idle',
        }))
      );
    } catch (err) {
      setSharedError(err instanceof Error ? err.message : 'Failed to load shared skills');
    } finally {
      setLoadingShared(false);
    }
  }, []);

  function handleOpenLinkShared() {
    setView('link-shared');
    void loadSharedSkills();
  }

  // ── Link a single shared skill ───────────────────────────────────────────
  async function handleLinkSkill(idx: number) {
    const entry = sharedSkills[idx];
    if (!entry) return;
    const { skill } = entry;
    const sharedSkillPath = skill.dirPath ?? '';
    if (!sharedSkillPath) return;

    setSharedSkills((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, status: 'linking', errorMsg: undefined } : s))
    );
    try {
      await linkSharedSkill(sharedSkillPath, skill.id);
      setSharedSkills((prev) =>
        prev.map((s, i) => (i === idx ? { ...s, status: 'linked' } : s))
      );
    } catch (err) {
      setSharedSkills((prev) =>
        prev.map((s, i) =>
          i === idx
            ? { ...s, status: 'error', errorMsg: err instanceof Error ? err.message : 'Link failed' }
            : s
        )
      );
    }
  }

  // ── Install from ZIP ─────────────────────────────────────────────────────
  async function handleInstallZip() {
    setZipBusy(true);
    setZipError(null);
    try {
      const picked = await callElectron(() =>
        electronAPI().dialog.openFile(
          [{ name: 'ZIP Archive', extensions: ['zip'] }]
        )
      );
      if (!picked) {
        setZipBusy(false);
        return;
      }
      await installSkillFromZip(picked);
      onOpenChange(false);
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Failed to install from ZIP');
    } finally {
      setZipBusy(false);
    }
  }

  // ── Create new ────────────────────────────────────────────────────────────
  function handleCreateNew() {
    onOpenChange(false);
    onCreateNew();
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md gap-0 p-0 overflow-hidden"
        showCloseButton={view === 'main'}
      >
        {/* ── Main view ─────────────────────────────────────────────────── */}
        {view === 'main' && (
          <>
            <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/60">
              <DialogTitle className="font-mono text-sm font-semibold tracking-wide text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                Add Skill
                <span className="text-muted-foreground font-normal">— {agentName}</span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Choose how to add a skill to this agent.
              </p>
            </DialogHeader>

            <div className="flex flex-col gap-2 p-4">
              {/* Option 1: Create new */}
              <OptionCard
                icon={<Zap className="h-4 w-4 text-amber-500" />}
                label="New Skill"
                description="Scaffold a new skill from the default template"
                accent="#d97706"
                onClick={handleCreateNew}
              />

              {/* Option 2: Link from shared (hidden for shared agent itself) */}
              {!isShared && (
                <OptionCard
                  icon={<Link2 className="h-4 w-4 text-violet-400" />}
                  label="Link from Shared Skills"
                  description="Create a symbolic link to a skill in ~/.agents/skills"
                  accent="#7c6ef5"
                  onClick={handleOpenLinkShared}
                />
              )}

              {/* Option 3: Install from ZIP */}
              <OptionCard
                icon={<Package className="h-4 w-4 text-emerald-400" />}
                label="Install from ZIP"
                description="Extract a .zip archive into this agent's skills folder"
                badge={zipBusy ? 'installing…' : undefined}
                accent="#2eb88a"
                onClick={() => { void handleInstallZip(); }}
                disabled={zipBusy}
              />

              {zipError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {zipError}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Link from Shared view ─────────────────────────────────────── */}
        {view === 'link-shared' && (
          <>
            <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 -ml-1 shrink-0"
                  onClick={() => setView('main')}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Back</span>
                </Button>
                <DialogTitle className="font-mono text-sm font-semibold tracking-wide text-foreground flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-violet-400" />
                  Shared Skills
                </DialogTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-1 pl-7">
                Select skills to link from <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">~/.agents/skills</code>
              </p>
            </DialogHeader>

            <div className="flex flex-col overflow-hidden" style={{ height: 300 }}>
              {loadingShared ? (
                <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading shared skills…
                </div>
              ) : sharedError ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  {sharedError}
                  <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => { void loadSharedSkills(); }}>
                    Retry
                  </Button>
                </div>
              ) : sharedSkills.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                  <FolderOpen className="h-7 w-7 opacity-30" />
                  <span>No shared skills found in <code className="font-mono text-[10px]">~/.agents/skills</code></span>
                </div>
              ) : (
                <ScrollArea className="flex-1 px-4 py-3">
                  <div className="flex flex-col gap-1.5 pb-1">
                    {sharedSkills.map((entry, idx) => (
                      <SharedSkillRow
                        key={entry.skill.id}
                        state={entry}
                        alreadyLinked={installedSkillIds.includes(entry.skill.id)}
                        onLink={() => { void handleLinkSkill(idx); }}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            <div className="px-4 pb-4 flex justify-end border-t border-border/60 pt-3">
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
