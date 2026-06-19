# Project Rubric — agent-profile

This is the single rule file for gen-eval-pair Planner + Evaluator. It is the **only** rule source any phase reads. Mutates in place; git history is the audit trail.

Project type: Electron + React 19 + TypeScript desktop app (Vite + `vite-plugin-electron`).
Reference docs the evaluator MUST cross-check:

- `AGENTS.md` — load-bearing rules (IPC envelope, security guards, working rules, definition of done)
- `DESIGN.md` — design system (warm neutrals, typography, components, color tokens)
- `docs/ARCHITECTURE.md` — layer boundaries, IPC pattern, security guards, component map

---

## Design References

| Source | Purpose |
|---|---|
| `DESIGN.md` | Notion-inspired warm neutrals palette, whisper borders, typography scale, agent accent colors |
| `src/renderer/styles/` | CSS variable tokens for spacing, color, radius |
| Screenshot baseline | `/Users/madao/Downloads/HICt3oGa0AAnzOg.jpg` (Skills 管理介面 reference) — used by evaluator for visual comparison |

---

## Forbidden Patterns

| ID | Rule | Detection |
|---|---|---|
| FP-01 | NEVER throw across the IPC boundary; main-process handlers must return `{ success, data? }` or `{ success: false, error }` | `grep` for `throw` inside `src/main/ipc/handlers/*.ts` outside try/catch wrappers |
| FP-02 | NEVER touch FS without `assertSafePath` / `assertSafeName` on renderer-supplied inputs | `grep` for `fs.` calls in handlers; verify each is preceded by a guard call |
| FP-03 | NEVER call Node APIs (`fs`, `os`, `child_process`, `path`) directly from renderer | `grep` `import.*from\s+['"]\(fs\|os\|child_process\|path\)['"]` in `src/renderer/` |
| FP-04 | NEVER mutate objects in place; always spread / `structuredClone` | `grep` for `<obj>.<key> =` outside class constructors |
| FP-05 | NEVER use raw `exec()` for child_process; use `execFile(binary, [args])` to prevent shell injection | `grep` for `exec(` in main/ |
| FP-06 | NEVER hardcode colors outside DESIGN.md palette (no rogue hex like `#3b82f6`); use CSS vars / Tailwind tokens defined in styles | `grep` Tailwind arbitrary-value classes `\[#[0-9a-fA-F]{3,6}\]` in new TSX |
| FP-07 | NEVER use `console.log` in production code | `grep` `console\.log` in new files |
| FP-08 | NEVER add new dialogs to `AddSkillDialog` for shared-page actions — the shared page MUST drive its own dialogs/Modals | grep new `AddSkillDialog` usages added for shared flow |
| FP-09 | NEVER hardcode hex colors in new TSX files — three orthogonal greps MUST all return zero hits over the target directory: (1) Tailwind arbitrary-value `\[#[0-9a-fA-F]{3,6}\]`, (2) inline style hex `style=\{\{[^}]*#[0-9a-fA-F]{3,6}`, (3) string-literal hex `'#[0-9a-fA-F]{3,6}'\|"#[0-9a-fA-F]{3,6}"`. Extends FP-06 which only catches the Tailwind-arbitrary form. Any non-zero hit outside `// ` comments is a defect. | three greps as above |

---

## Composition Assertions

| ID | Rule |
|---|---|
| CA-01 | Every new IPC handler MUST return the envelope `{ success: boolean; data?: T; error?: string }`. Wrapper `safeHandle` in `src/main/ipc/utils/safeHandle.ts` (or equivalent) MUST be used. |
| CA-02 | Every renderer call to an IPC channel MUST go through `callElectron()` / `electronAPI()` from `src/renderer/lib/electron.ts`. No direct `window.electron.*` ad-hoc usage. |
| CA-03 | New types (Skill linked-by relation, install-registry params) MUST live in `src/shared/types.ts`, exported via the `IPC_CHANNELS` constant. |
| CA-04 | New IPC channels MUST be added to `IPC_CHANNELS` registry in `src/shared/types.ts`. |
| CA-05 | New React components MUST follow the existing pattern: function component + named export + props interface above the component. |
| CA-06 | Long-lived child processes (e.g., `npx skills add`) MUST be tracked in a `Map<requestId, ChildProcess>` and exposed via a paired `cancel` IPC channel. |
| CA-07 | Input validation MUST occur at BOTH (a) renderer side (UI feedback) AND (b) main side (defence-in-depth). |
| CA-08 | Long-running IPC handlers that support cancellation MUST emit an early `<channel>:started` event via `event.sender.send` immediately after spawning the child process (BEFORE awaiting completion), carrying the `requestId`. Without the early-emit, Cancel is unreachable until the operation finishes — defeating the cancel pattern. Any handler that tracks a ChildProcess in the CA-06 map AND has a paired `:cancel` channel MUST also declare a `:started` event channel. |
| CA-09 | Aggregate counts that combine a reverse-link query (e.g., `skill:get-linked-by`) with per-agent own-directory listings MUST filter out symlink entries (`isSymbolicLink !== true`) in the own-directory term. A shared resource symlinked into an agent's directory is already represented in the reverse-link term; counting it again double-counts. |
| CA-10 | All IPC handler returns MUST go through the `success(data)` / `failure(err)` helpers from `src/main/ipc/handlers/configUtils.ts` — bare object literals `return { success: ... }` are forbidden in new handler code. Strengthens CA-01 with an enforcement mechanism (helper usage) that prevents envelope drift and centralises error serialisation. |
| CA-11 | Child-process cancellation handlers MUST escalate `SIGTERM` → `SIGKILL` with a 1500 ms timer: send `SIGTERM` immediately, set a `setTimeout` of 1500 ms, and if the process has not exited on the `close` event, send `SIGKILL`. Remove from the process map on `close` regardless of exit status. Bare `proc.kill()` without escalation is a defect (graceful processes may never exit). Complements CA-06. |

---

## Required Components / Files

For the Shared Skills page refactor (single source of truth this sprint):

| Path | Purpose |
|---|---|
| `src/renderer/components/shared-skills/SharedSkillsPage.tsx` | Main page — header (back + 3 import actions + secondary "Create blank") + filter bar (agent count chips informational) + list view; manages `view: 'list' \| 'detail'` state |
| `src/renderer/components/shared-skills/SharedSkillRow.tsx` | Single row — name + `本地` badge + description (1-line truncate) + agent-compat icon group (Claude/Gemini/Copilot) + delete |
| `src/renderer/components/shared-skills/SharedSkillDetail.tsx` | Detail/edit view — markdown editor + Save/Cancel + back-to-list |
| `src/renderer/components/shared-skills/InstallFromRegistryDialog.tsx` | Modal for `npx skills add` flow — input + Install/Cancel buttons + stdout/stderr output area |
| `src/shared/types.ts` | Add channels: `SKILL_INSTALL_REGISTRY`, `SKILL_INSTALL_REGISTRY_CANCEL`, `SKILL_IMPORT_FOLDER`, `SKILL_GET_LINKED_BY`; add types: `SkillLinkedBy = { skillId: string; agents: AgentType[] }` |
| `src/main/ipc/handlers/skillsHandler.ts` | Extend with handlers for the 4 new channels; reuse `execFileAsync` pattern |
| `src/renderer/lib/electron.ts` | Expose new IPC methods on `electronAPI()` |
| `src/renderer/App.tsx` | Change `type === 'shared'` branch to render `<SharedSkillsPage />` instead of `<SkillsEditor agentName="Shared" agentType="shared" />` |

---

## Scoring Dimensions

The evaluator scores P6 along these dimensions. Each scored 0–10. Lower scores require defects[] entries.

| ID | Dimension | What it measures | Sample evidence to demand |
|---|---|---|---|
| SD-01 | **Functional correctness** | Every AC in contract verifiable; tests pass; lint pass; typecheck pass | `bun run test` output count + 0 failures; `bun run lint` 0/0; `bun run typecheck` clean |
| SD-02 | **IPC contract integrity** | New handlers obey envelope, no thrown errors crossing boundary, `assertSafePath`/`assertSafeName` applied on renderer-supplied inputs | Grep transcript; reviewer reads new handler source |
| SD-03 | **Security posture** | `execFile` (not `exec`); input validation present + main-side re-validation; child-process cleanup on cancel; no path traversal | Reviewer reads new handler source; verifies `kill()` path |
| SD-04 | **UI/UX quality** ⭐ | Layout matches reference image (header + filter + list); back/Save/Cancel navigation clean; loading + error + empty states all present; cancel button works during long install; tab order + keyboard `Esc` returns from detail; truncation + tooltip on long names/descriptions | Screenshot of each state (list / detail / empty / error / install-running / install-error); manual interaction trace |
| SD-05 | **Design system compliance** | Warm neutral palette, whisper border `1px solid rgba(0,0,0,0.1)`, Notion Blue `#0075de` for primary CTA, agent accent colors for chips, rounded card shell, typography from DESIGN.md | Reviewer cross-checks against DESIGN.md; no rogue hex; chip colors map to agent accents |
| SD-06 | **Test coverage** | Unit + integration covering: page render, row interactions, detail save flow, install-registry success/failure/cancel, getLinkedBy aggregation, IPC handler envelopes | Count new test files; total tests up from baseline 378; coverage not regressed |
| SD-07 | **Scope discipline** | No edits to unrelated files; existing `SkillsEditor` untouched; no incidental refactors; no removed features for other agents | `git diff main --stat` matches Expected files touched |
| SD-08 | **Documentation** | `feature_list.json` updated with feat-019; `progress.md` snapshot + 上次 Session 結束點; `session-log.jsonl` appended; AGENTS.md addition for new IPC patterns if reusable | All four state files present and consistent at end of session |

---

## Verdict Rules

| Verdict | Condition |
|---|---|
| **Accept** | All SD-01 through SD-08 ≥ 7; no defects of severity `Block` in defects[] |
| **Revise** | Any SD score 4–6, or defects of severity `Minor`/`Major` present but no `Block`; orchestrator surfaces defects to writer, writer fixes, re-score |
| **Block** | Any SD score 0–3, OR any defect with `severity: Block` (e.g., IPC throws across boundary; security guard missing; UI completely broken vs reference) |
| **Incomplete** | Implementation partial (e.g., some files in Expected files touched not created); writer must finish before scoring |

**Hard blockers (any of these → Block regardless of other scores):**
- Lint fails or typecheck fails
- Any test in suite regressed (count drops below baseline)
- IPC handler throws across boundary
- `assertSafePath` / `assertSafeName` missing on any new FS-touching handler
- `exec()` used (must be `execFile`)
- Any rogue hex color in new TSX (must use DESIGN.md tokens)
- Existing `SkillsEditor` modified for scope leak

---

## Process Rules

| ID | Rule |
|---|---|
| PR-01 | Planner MUST NOT write code, only contract markdown. Read-only tools. |
| PR-02 | Writer MUST NOT modify `.gen-eval/rubric.md`. Only orchestrator applies `suggestedRubricAdditions`. |
| PR-03 | Evaluator MUST NOT write any file. Read-only tools. Returns JSON verdict only. |
| PR-04 | All new IPC channels added in ONE commit; handler implementations in subsequent commits per logical group (handler + types + preload + renderer wiring). |
| PR-05 | Definition of Done from `AGENTS.md` MUST hold at P6 Accept: `bun run test` + `bun run lint` + `bun run typecheck` + 4-file end-of-session handoff. |

---

## Evolution Log

| Date | Change | Reason |
|---|---|---|
| 2026-05-23 | Initial rubric seeded for feat-019 (Shared Skills page refactor) | Grilling session resolved Q1–Q8 decisions; UI/UX dimension (SD-04) added per user request |
| 2026-05-23 | Added CA-08 (early-emit `:started` event for cancellable IPC) | P4 evaluator gap: AC-7's early-emit pattern not in rubric; generalizes to any cancellable child-process IPC |
| 2026-05-23 | Added CA-09 (symlink dedup in aggregate counts) | P4 evaluator gap: AC-12 dedup formula; same pitfall recurs whenever reverse-link queries combine with own-dir listings |
| 2026-05-23 | Added FP-09 (three-orthogonal hex grep) | P4 evaluator gap: AC-14 extends FP-06 — inline style + string-literal hex were uncaught |
| 2026-05-23 | Added CA-10 (envelope via `success()`/`failure()` helpers) | P4 evaluator gap: AC-15 strengthens CA-01 with enforcement mechanism (helper usage) to prevent envelope drift |
| 2026-05-23 | Added CA-11 (SIGTERM → 1500ms → SIGKILL escalation) | P4 evaluator gap: AC-8 — bare `proc.kill()` is insufficient; escalation timing complements CA-06 |
