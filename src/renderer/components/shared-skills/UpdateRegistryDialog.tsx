import { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, AlertCircle, RefreshCw, Check, ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { callElectron, electronAPI } from '@/lib/electron';
import type { InstallRegistryResult } from '@shared/types';

// ─── Output parsing ──────────────────────────────────────────────────────────

type SkillUpdateResult = 'up-to-date' | 'updated' | 'failed' | 'pending';

interface UpdateSummary {
  status: 'up-to-date' | 'updated' | 'partial' | 'error' | 'unknown';
  message: string;
  checked: { id: string; result: SkillUpdateResult; reason?: string }[];
}

/** Parses the `npx skills update` stdout into a structured summary.
 *  Patterns observed:
 *    "Updating <name>..."
 *    "Checking global skill <x>/<y>: <name>"
 *    "✓ All global skills are up to date"
 *    "✓ Updated <name>" / "✓ <name> updated"
 *    "✗ <reason>" / "Failed: <reason>" / "Error: <reason>"
 *  Patterns are matched line-by-line; unknown lines are ignored for the
 *  structured view (still shown in the raw log toggle). */
// eslint-disable-next-line react-refresh/only-export-components -- pure helper exported for tests
export function parseUpdateOutput(stdout: string): UpdateSummary {
  const checked: UpdateSummary['checked'] = [];
  const seen = new Set<string>();
  let status: UpdateSummary['status'] = 'unknown';
  let message = '';

  for (const raw of stdout.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    let m: RegExpExecArray | null;

    m = /^Updating (.+?)\.\.\.?$/.exec(line);
    if (m && !seen.has(m[1])) { checked.push({ id: m[1], result: 'pending' }); seen.add(m[1]); continue; }

    m = /^Checking (?:global )?skill \d+\/\d+:\s*(.+)$/.exec(line);
    if (m && !seen.has(m[1])) { checked.push({ id: m[1], result: 'pending' }); seen.add(m[1]); continue; }

    if (/^✓\s*All (?:global )?skills are up to date/.test(line)) {
      status = 'up-to-date';
      message = 'All skills are up to date';
      for (const c of checked) c.result = 'up-to-date';
      continue;
    }

    m = /^✓\s*(?:Updated\s+(.+)|(.+?)\s+updated)$/.exec(line);
    if (m) {
      const name = m[1] ?? m[2];
      const target = checked.find((c) => c.id === name);
      if (target) target.result = 'updated';
      else { checked.push({ id: name, result: 'updated' }); seen.add(name); }
      if (status === 'unknown' || status === 'up-to-date') status = 'updated';
      continue;
    }

    // Per-skill failure with named target — capture into the corresponding row.
    // Patterns: "Failed to update <name>: <reason>" / "✗ <name> failed: <reason>"
    m = /^Failed to update ([^:\s]+)(?::\s*(.+))?$/i.exec(line)
      ?? /^(?:✗|✘)\s*([^:\s]+)\s+failed(?::\s*(.+))?$/i.exec(line);
    if (m) {
      const name = m[1];
      const reason = m[2]?.trim();
      const target = checked.find((c) => c.id === name);
      if (target) {
        target.result = 'failed';
        if (reason) target.reason = reason;
      } else {
        checked.push({ id: name, result: 'failed', reason });
        seen.add(name);
      }
      message = reason ? `${name}: ${reason}` : `${name} failed`;
      status = status === 'updated' ? 'partial' : 'error';
      continue;
    }

    // Generic failure line (not bound to a specific skill).
    m = /^(?:✗|✘)\s*(.+)$/.exec(line) ?? /^(?:Failed|Error):\s*(.+)$/i.exec(line);
    if (m) {
      message = m[1];
      status = status === 'updated' ? 'partial' : 'error';
    }
  }

  if (status === 'unknown' && checked.length > 0) {
    // We saw "Updating X" or "Checking X" but no terminal status line — fallback.
    status = 'updated';
  }
  return { status, message, checked };
}

interface UpdateRegistryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sharedConfigDir: string;
  /** Skill IDs to update; empty array = update all (CLI default). */
  skillIds: string[];
  /** Display label (e.g. "all skills" or "kami"). */
  targetLabel: string;
  onUpdateComplete: (result: InstallRegistryResult) => void | Promise<void>;
}

export function UpdateRegistryDialog({
  open,
  onOpenChange,
  sharedConfigDir,
  skillIds,
  targetLabel,
  onUpdateComplete,
}: UpdateRegistryDialogProps) {
  const [busy, setBusy] = useState(false);
  const [stdout, setStdout] = useState<string | null>(null);
  const [stderr, setStderr] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  const summary = useMemo<UpdateSummary | null>(
    () => (stdout ? parseUpdateOutput(stdout) : null),
    [stdout]
  );

  useEffect(() => {
    if (!open) return undefined;
    const unsubscribe = electronAPI().config.onUpdateSkillFromRegistryStarted((payload) => {
      requestIdRef.current = payload.requestId;
      setRequestId(payload.requestId);
    });
    return () => unsubscribe();
  }, [open]);

  useEffect(() => {
    if (!open) {
      /* eslint-disable react/set-state-in-effect -- intentional reset on dialog close */
      setBusy(false);
      setStdout(null);
      setStderr(null);
      setServerError(null);
      setShowRaw(false);
      setRequestId(null);
      requestIdRef.current = null;
      startedRef.current = false;
      /* eslint-enable react/set-state-in-effect */
    }
  }, [open]);

  // Auto-start the update when the dialog opens.
  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      setBusy(true);
      try {
        const result = await callElectron(() =>
          electronAPI().config.updateSkillFromRegistry(sharedConfigDir, skillIds)
        );
        setStdout(result.stdout);
        setStderr(result.stderr);
        if (result.exitCode !== 0) {
          setServerError(`npx skills update exited with code ${result.exitCode}`);
          setBusy(false);
          return;
        }
        await onUpdateComplete(result);
        setBusy(false);
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Update failed');
        setBusy(false);
      }
    })();
  }, [open, sharedConfigDir, skillIds, onUpdateComplete]);

  async function handleCancel() {
    const id = requestIdRef.current ?? requestId;
    if (id) {
      try {
        await callElectron(() => electronAPI().config.cancelUpdateSkillFromRegistry(id));
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Cancel failed');
      }
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent
        data-testid="update-registry-dialog"
        className="sm:max-w-md gap-0 p-0 overflow-hidden"
      >
        <DialogHeader className="px-5 pt-5 pb-4 border-b-whisper">
          <DialogTitle className="font-mono text-sm font-semibold tracking-wide text-foreground flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${busy ? 'animate-spin' : ''}`} />
            Update skills
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Running <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">npx skills update</code> for{' '}
            <span className="font-mono text-foreground">{targetLabel}</span>.
          </p>
        </DialogHeader>

        <div className="px-5 py-4 flex flex-col gap-3">
          {busy && !stdout && !stderr && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Working…
            </div>
          )}

          {serverError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {summary && !busy && (
            <div data-testid="update-summary" className="flex flex-col gap-2">
              {/* Top-level status banner */}
              {summary.status === 'up-to-date' && (
                <div className="flex items-center gap-2 rounded-md border-whisper bg-emerald-500/5 px-3 py-2 text-xs">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="font-medium text-emerald-600">All skills are up to date</span>
                </div>
              )}
              {summary.status === 'updated' && (
                <div className="flex items-center gap-2 rounded-md border-whisper bg-emerald-500/5 px-3 py-2 text-xs">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="font-medium text-emerald-600">
                    {summary.checked.filter((c) => c.result === 'updated').length} skill(s) updated
                  </span>
                </div>
              )}
              {summary.status === 'partial' && (
                <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span className="font-medium text-amber-600">
                    Partially completed{summary.message ? `: ${summary.message}` : ''}
                  </span>
                </div>
              )}
              {summary.status === 'error' && summary.message && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{summary.message}</span>
                </div>
              )}

              {/* Per-skill list */}
              {summary.checked.length > 0 && (
                <ul className="flex flex-col gap-0.5 text-xs">
                  {summary.checked.map((c) => (
                    <li key={c.id} data-testid={`update-row-${c.id}`} className="flex items-center gap-2 py-0.5">
                      {c.result === 'up-to-date' && <Check className="h-3 w-3 text-muted-foreground" />}
                      {c.result === 'updated' && <Check className="h-3 w-3 text-emerald-600" />}
                      {c.result === 'failed' && <AlertCircle className="h-3 w-3 text-destructive" />}
                      {c.result === 'pending' && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      <span className="font-mono">{c.id}</span>
                      <span className="text-muted-foreground text-[10px]">
                        {c.result === 'up-to-date' && '(no changes)'}
                        {c.result === 'updated' && '(updated)'}
                        {c.result === 'failed' && c.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Raw log toggle */}
              <button
                type="button"
                data-testid="toggle-raw-log"
                className="self-start mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowRaw((v) => !v)}
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${showRaw ? 'rotate-180' : ''}`} />
                {showRaw ? 'Hide' : 'Show'} raw log
              </button>
            </div>
          )}

          {(showRaw || (busy && (stdout || stderr))) && (stdout || stderr) && (
            <div
              data-testid="update-registry-output"
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
            {busy ? 'Cancel' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
