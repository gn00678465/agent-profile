import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { callElectron, electronAPI } from '@/lib/electron';
import type { InstallRegistryResult, SkillsCliAgent } from '@shared/types';

interface InstallFromRegistryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sharedConfigDir: string;
  /** Called on successful install; parent should refresh skill list. */
  onInstallComplete: (result: InstallRegistryResult) => void | Promise<void>;
}

const FORBIDDEN_CHARS = /[;|&$`\s]/;
const SKILL_FILTER_PATTERN = /^[\w.,*-]+$/;

/** Agents the `skills` CLI accepts via `-a <name>`. Skill files always land in
 *  ~/.agents/skills/<name>; checked agents additionally receive a symlink from
 *  their own skills/ dir back to the universal location.
 *  `gemini-cli` intentionally omitted — deprecated in favor of `antigravity` 2.0. */
const SUPPORTED_AGENTS: readonly { value: SkillsCliAgent; label: string }[] = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'github-copilot', label: 'GitHub Copilot' },
  { value: 'antigravity', label: 'Antigravity' },
];

/** Renderer-side validator. Identical logic lives in skillsHandler.ts. */
// eslint-disable-next-line react-refresh/only-export-components -- pure helper exported for tests
export function validateRegistryInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return 'Input is required';
  if (input.length > 500) return 'Input exceeds 500 chars';
  if (FORBIDDEN_CHARS.test(input)) return 'Input cannot contain whitespace or shell metacharacters (; | & $ `)';
  return null;
}

export function InstallFromRegistryDialog({
  open,
  onOpenChange,
  sharedConfigDir,
  onInstallComplete,
}: InstallFromRegistryDialogProps) {
  const [input, setInput] = useState('');
  const [agents, setAgents] = useState<SkillsCliAgent[]>(['claude-code']);
  const [skillFilter, setSkillFilter] = useState('*');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [stdout, setStdout] = useState<string | null>(null);
  const [stderr, setStderr] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

  // Subscribe to the early `:started` event so we can capture the requestId
  // before the install completes. Without this, Cancel is unreachable.
  useEffect(() => {
    if (!open) return undefined;
    const unsubscribe = electronAPI().config.onInstallSkillFromRegistryStarted((payload) => {
      requestIdRef.current = payload.requestId;
      setRequestId(payload.requestId);
    });
    return () => unsubscribe();
  }, [open]);

  useEffect(() => {
    if (!open) {
      // Reset on close
      /* eslint-disable react/set-state-in-effect -- intentional reset on dialog close */
      setInput('');
      setAgents(['claude-code']);
      setSkillFilter('*');
      setValidationError(null);
      setBusy(false);
      setRequestId(null);
      requestIdRef.current = null;
      setStdout(null);
      setStderr(null);
      setServerError(null);
      /* eslint-enable react/set-state-in-effect */
    }
  }, [open]);

  function handleInputChange(v: string) {
    setInput(v);
    setValidationError(null);
    setServerError(null);
  }

  async function handleInstall() {
    const err = validateRegistryInput(input);
    if (err) {
      setValidationError(err);
      return;
    }
    // Skill filter validation: empty or `*` means "all"; otherwise must be safe.
    const trimmedFilter = skillFilter.trim();
    if (trimmedFilter && trimmedFilter !== '*' && !SKILL_FILTER_PATTERN.test(trimmedFilter)) {
      setValidationError('Skill filter: only alphanumerics, dot, hyphen, underscore, comma, or "*"');
      return;
    }
    setBusy(true);
    setStdout(null);
    setStderr(null);
    setServerError(null);
    try {
      const result = await callElectron(() =>
        electronAPI().config.installSkillFromRegistry(sharedConfigDir, input, {
          agents,
          skill: trimmedFilter,
        })
      );
      setStdout(result.stdout);
      setStderr(result.stderr);
      if (result.exitCode !== 0) {
        setServerError(`npx skills add exited with code ${result.exitCode}`);
        setBusy(false);
        return;
      }
      await onInstallComplete(result);
      setBusy(false);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Install failed');
      setBusy(false);
    }
  }

  async function handleCancel() {
    const id = requestIdRef.current ?? requestId;
    if (id) {
      try {
        await callElectron(() => electronAPI().config.cancelInstallSkillFromRegistry(id));
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Cancel failed');
      }
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent
        data-testid="install-registry-dialog"
        className="sm:max-w-md gap-0 p-0 overflow-hidden"
      >
        <DialogHeader className="px-5 pt-5 pb-4 border-b-whisper">
          <DialogTitle className="font-mono text-sm font-semibold tracking-wide text-foreground flex items-center gap-2">
            <Download className="h-4 w-4 text-muted-foreground" />
            Install from registry
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Pull a skill via <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">npx skills add</code>.
            Accepts <span className="font-mono text-[10px]">owner/repo</span>, URLs, or local paths.
          </p>
        </DialogHeader>

        <div className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Source</label>
            <Input
              data-testid="registry-input"
              placeholder="owner/repo, URL, or local path"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={busy}
              maxLength={600}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
              Symlink for (-a)
            </label>
            <div data-testid="registry-agents-checkboxes" className="flex flex-col gap-1.5">
              {SUPPORTED_AGENTS.map((a) => {
                const checked = agents.includes(a.value);
                return (
                  <label key={a.value} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      data-testid={`registry-agent-${a.value}`}
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setAgents([...agents, a.value]);
                        else setAgents(agents.filter((x) => x !== a.value));
                      }}
                      disabled={busy}
                      className="h-4 w-4 rounded border-[var(--border-subtle)]"
                    />
                    <span>{a.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">-a {a.value}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Files always land in <code className="font-mono">~/.agents/skills/</code>; checked agents get a symlink from their own skills dir.
            </p>
          </div>

          <div>
            <label htmlFor="registry-skill-filter" className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
              Skill filter (--skill)
            </label>
            <Input
              id="registry-skill-filter"
              data-testid="registry-skill-filter"
              placeholder='* (all) or skill name'
              value={skillFilter}
              onChange={(e) => { setSkillFilter(e.target.value); setValidationError(null); }}
              disabled={busy}
              maxLength={120}
            />
          </div>

          {validationError && (
            <div
              data-testid="validation-error"
              className="text-xs text-destructive"
            >
              {validationError}
            </div>
          )}
          {serverError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {(stdout || stderr) && (
            <div
              data-testid="registry-output"
              className="max-h-48 overflow-auto rounded-md border-whisper bg-muted/40 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
            >
              {stdout && <div>{stdout}</div>}
              {stderr && (
                <div className="text-amber-600">{stderr}</div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5 pt-2 border-t-whisper">
          <Button variant="outline" size="sm" onClick={() => { void handleCancel(); }}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={busy || !input.trim()}
            onClick={() => { void handleInstall(); }}
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" />}
            {busy ? 'Installing…' : 'Install'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
