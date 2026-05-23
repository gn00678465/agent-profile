# Sprint Contract — feat-019 Shared Skills page refactor

## Version
- Current: v1
- Supersedes: (none)

## Summary

Replace the current Shared agent's `SkillsEditor` usage with a dedicated `SharedSkillsPage` component tree under `src/renderer/components/shared-skills/`. The new layout mirrors the reference image (`/Users/madao/Downloads/HICt3oGa0AAnzOg.jpg`): a header row (back affordance + page title + three import action buttons), a filter bar with informational agent-count chips (Claude / Gemini / Copilot) plus a Refresh button, a full-width list of shared skills, and a page-swap (not modal) detail/edit view. New IPC capabilities support registry install (`npx skills add`), folder import, reverse symlink scan for agent compatibility, and child-process cancellation. The existing `src/renderer/components/editors/SkillsEditor.tsx` (used by the four non-shared agents) is NOT touched. Only `App.tsx`'s `type === 'shared'` branch is swapped.

## Scope

- New component tree at `src/renderer/components/shared-skills/` with four files (Page, Row, Detail, InstallFromRegistryDialog).
- New IPC channels and main-process handlers: `skill:get-linked-by`, `skill:install-registry`, `skill:install-registry:cancel`, `skill:import-folder`. Reuse the existing `skill:install-zip` channel for the ZIP action.
- Extend `src/shared/types.ts` with the new channel constants and the `SkillLinkedBy` type (and any params/result types for the new IPC calls).
- Wire new IPC methods in `src/preload/index.ts` and `src/renderer/lib/electron.ts` (preload exposure on the existing `electronAPI()`).
- Modify exactly one branch in `src/renderer/App.tsx` (`type === 'shared'`) to render `<SharedSkillsPage />` and to accept a sidebar-selection setter so an agent-icon click in a row can navigate to that agent's Skills tab.
- Reuse `DEFAULT_SKILL_TEMPLATE` from `SkillsEditor.tsx` by exporting it from a shared module (move only the constant; do not refactor logic) OR by duplicating it as a const in `SharedSkillDetail.tsx`. Implementer chooses whichever requires zero behavior change to existing `SkillsEditor`.
- Tests for every new component + extended handler tests for new IPC channels.
- `feature_list.json` adds `feat-019` entry with status `done` + evidence on completion.

## Out of Scope

- Any change to `src/renderer/components/editors/SkillsEditor.tsx` beyond a possible `export` keyword added to the existing `DEFAULT_SKILL_TEMPLATE` declaration (no logic changes).
- Any change to the Skills page of the four non-shared agents (Claude Code / Claude Desktop / Gemini / Copilot).
- Introducing a router (react-router, etc.) — view state is local `useState`.
- Streaming stdout of `npx skills add` (one-shot post-completion output is sufficient).
- Editing `.gen-eval/rubric.md` (orchestrator-only).
- Dark mode CTA contrast follow-up (separate work).
- E2E tests (feat-016 blocker still applies).
- Backup/restore and discover/marketplace header buttons from the reference image (separate future features).

## Acceptance Criteria

Each AC is numbered, falsifiable, measurable, and traceable to a Scoring Dimension.

- [ ] **AC-1** `src/renderer/components/shared-skills/SharedSkillsPage.tsx` exists, is the only component rendered for `App.tsx`'s `type === 'shared'` branch, and renders three regions in document order: (a) header with title + 3 primary action buttons (Install from registry, Import existing folder, Install from ZIP), (b) filter bar with exactly 3 chips (Claude / Gemini / Copilot) and a Refresh button on the right, and a secondary "Create blank skill" link/button, (c) list region. Verifiable via `SharedSkillsPage.test.tsx` querying the three regions. *(SD-01, SD-04)*

- [ ] **AC-2** `SharedSkillRow.tsx` renders, for each shared skill: name, 1-line truncated description, a `本地` badge, an agent-compat icon group containing only the agents returned by `skill:get-linked-by` for that skill, and a delete control. Clicking the row enters detail view; clicking an agent icon does NOT enter detail view but instead invokes the sidebar-selection setter for that agent. Verifiable via `SharedSkillRow.test.tsx` with `vi.fn()` stubs. *(SD-01, SD-04)*

- [ ] **AC-3** Detail view is a full page-swap: when `view === 'detail'`, the list region is unmounted and `SharedSkillDetail.tsx` is rendered with a back-to-list button in its header. Pressing `Esc` in detail view returns to list. Verifiable via DOM presence assertions + `fireEvent.keyDown({ key: 'Escape' })`. *(SD-01, SD-04)*

- [ ] **AC-4** "Create blank skill" enters detail view in new-mode and seeds the editor textarea with the value of `DEFAULT_SKILL_TEMPLATE` (the same constant currently used by `SkillsEditor.tsx`); Save invokes `config:save-skill` with a non-empty `id`/`name`. Verifiable via `SharedSkillDetail.test.tsx`. *(SD-01, SD-07)*

- [ ] **AC-5** `InstallFromRegistryDialog.tsx` renders an input + Install + Cancel buttons. Renderer-side validation rejects input that (a) is empty after `.trim()`, (b) has `.length > 500` (so length 500 is the last accepted value; length 501+ rejected), (c) contains any of the chars `;` `|` `&` `$` `` ` `` or any whitespace (regex: `/[;|&$`\s]/`), with an inline error message. Accepted formats include GitHub shorthand `owner/repo`, `https?://...`, `git@host:owner/repo.git`, and local paths starting with `./`, `~/`, or `/`. Verifiable via `InstallFromRegistryDialog.test.tsx` with table-driven cases including boundary at exactly 500 and 501 chars. *(SD-01, SD-03)*

- [ ] **AC-6** Main-process handler for `skill:install-registry` re-validates the same rules as AC-5 (defence-in-depth) and rejects with `{ success: false, error }` before spawning a child process. Local-path branch additionally calls `assertSafePath` on the resolved input. Verifiable via `skillsHandler.test.ts` covering invalid input → no spawn. *(SD-02, SD-03)*

- [ ] **AC-7** `skill:install-registry` handler uses `execFile('npx', ['skills', 'add', input, ...flags], { cwd: sharedConfigDir, timeout: 90000 })`; never `exec()`. The handler:
  1. Generates `requestId = crypto.randomUUID()` BEFORE spawning the child.
  2. **Emits an early event** via `event.sender.send('skill:install-registry:started', { requestId })` immediately after spawning the `ChildProcess`, so the renderer can capture the requestId BEFORE the long-running install completes (this is what makes Cancel reachable).
  3. Tracks the `ChildProcess` in a module-level `Map<string, ChildProcess>` keyed by the same `requestId`.
  4. Removes the entry on `close` event regardless of exit status.
  Returns the final `{ requestId, stdout, stderr, exitCode }` only when the child exits.
  Verifiable via: grep (`exec(` count in new code = 0); handler test asserting `event.sender.send` is called with the started-event channel and a uuid BEFORE the awaited execFile resolves; map size === 1 mid-flight, 0 after close. *(SD-02, SD-03, CA-06)*

- [ ] **AC-8** `skill:install-registry:cancel` accepts a `requestId`, looks up the child process, sends `SIGTERM`, and if the process has not exited after 1500 ms sends `SIGKILL`. Returns `{ success: true, data: { killed: true } }` if a process was killed, `{ success: false, error: 'unknown requestId' }` if the requestId is unknown. Verifiable via handler test using `vi.useFakeTimers()` + a stub `ChildProcess`. *(SD-02, SD-03, CA-06)*

- [ ] **AC-9** On successful `skill:install-registry` completion, the dialog displays stdout and stderr in a scrollable read-only output area (post-completion, not streamed). The Page closes the dialog automatically after a subsequent `getSkills()` refresh shows the new skill ID; if the new skill ID is NOT present, the dialog remains open with an inline error banner. Verifiable via `InstallFromRegistryDialog.test.tsx` mocking IPC. *(SD-01, SD-04)*

- [ ] **AC-10** `skill:import-folder` handler: receives a source folder path (from the renderer-invoked file dialog), validates with `assertSafePath`, requires a `SKILL.md` to exist directly inside it, then copies the folder to `~/.agents/skills/<basename>` (refuses if destination already exists, returning `{ success: false, error }`). Verifiable via handler test using a temp dir. *(SD-02, SD-03)*

- [ ] **AC-11** `skill:get-linked-by` handler: enumerates all non-shared agent skill directories, `readlink()`s each entry, resolves to an absolute target path, and returns a `SkillLinkedBy[]` mapping each shared skill ID to the list of agents whose skills/ contains a symlink resolving to that shared skill's absolute path. Verifiable via handler test that creates a temp filesystem with symlinks and asserts aggregation. *(SD-02, SD-06)*

- [ ] **AC-12** Filter-bar chips: each chip displays the agent's name and a count equal to:
  ```
  count(agent) = (skills returned by skill:get-linked-by whose `agents` includes <agent>)
               + (skills returned by getSkills(<agent>.configDir) where `isSymbolicLink !== true`)
  ```
  The `isSymbolicLink` filter in the second term prevents double-counting: a shared skill that is symlinked into agent X's `skills/` is already counted in the first term and MUST NOT be counted again. Chips are NOT clickable (no `onClick`, no `cursor: pointer`, no `role="button"`, no `tabIndex >= 0`). Verifiable via `SharedSkillsPage.test.tsx` including a dedup test case (one shared skill linked by Claude → Claude chip count = 1, not 2). *(SD-01, SD-04)*

- [ ] **AC-13** Empty state: when `getSkills('shared')` returns `[]`, the list region shows a single block of warm-gray text referencing the header actions (no extra CTA buttons). Error state: when an IPC call fails, an inline banner appears above the list with a red left border, an `AlertCircle` icon, the error message, and a Retry button — visual parity with the existing `AddSkillDialog` `zipError` block. Loading state: text "Loading skills…" matching the existing pattern. All three states verifiable via tests. *(SD-01, SD-04)*

- [ ] **AC-14** Design system compliance — no hardcoded hex anywhere in new files. Three orthogonal greps must all return zero hits under `src/renderer/components/shared-skills/`:
  1. Tailwind arbitrary-value hex: `\[#[0-9a-fA-F]{3,6}\]`
  2. Inline `style={{ ... }}` hex literals: `style=\{\{[^}]*#[0-9a-fA-F]{3,6}`
  3. Any other hex literal in `.tsx` source (broad sweep, allow only inside `// ` comments): `'#[0-9a-fA-F]{3,6}'|"#[0-9a-fA-F]{3,6}"|\`#[0-9a-fA-F]{3,6}\``
  Primary action buttons MUST use the existing Notion Blue Tailwind token / CSS var; whisper border MUST be `1px solid rgba(0,0,0,0.1)` via the existing utility class; chip backgrounds MUST use the existing agent accent tokens (Claude / Gemini / Copilot). Verifiable via the three greps + reviewer cross-check against `DESIGN.md`. *(SD-05, FP-06)*

- [ ] **AC-15** IPC envelope integrity: every new handler returns its result via the existing `success(data)` / `failure(err)` helpers from `src/main/ipc/handlers/configUtils.ts` (the codebase's existing convention — verified at `skillsHandler.ts:9` import). No `throw` statement may reach outside a try/catch in any new handler body. No bare `return { success: ... }` object literal is permitted; envelopes MUST go through the helpers. Verifiable via:
  ```bash
  # Count of new ipcMain.handle blocks (added by this sprint)
  NEW_HANDLES=4   # skill:install-registry + :cancel + skill:import-folder + skill:get-linked-by
  # Each must contain its own try/catch returning failure(err) — handler tests cover both branches
  grep -nE 'return\s+\{\s*success:' src/main/ipc/handlers/skillsHandler.ts   # expect zero NEW matches (existing baseline allowed)
  ```
  Handler tests cover both success and error branches per channel. *(SD-02, FP-01, CA-01)*

- [ ] **AC-16** Renderer never imports Node APIs: grep `from ['"](fs|os|child_process|path)['"]` over `src/renderer/components/shared-skills/**` returns zero matches. All FS/OS access goes through `callElectron()` / `electronAPI()`. Verifiable via grep + `SharedSkillsPage.test.tsx`. *(SD-02, FP-03, CA-02)*

- [ ] **AC-17** New types and channel constants live in `src/shared/types.ts`: `IPC_CHANNELS.SKILL_INSTALL_REGISTRY`, `IPC_CHANNELS.SKILL_INSTALL_REGISTRY_STARTED` (event), `IPC_CHANNELS.SKILL_INSTALL_REGISTRY_CANCEL`, `IPC_CHANNELS.SKILL_IMPORT_FOLDER`, `IPC_CHANNELS.SKILL_GET_LINKED_BY`. The `SkillLinkedBy` type reuses the existing `AgentType` union from `src/shared/types.ts`:
  ```ts
  export interface SkillLinkedBy {
    skillId: string;            // basename of the shared skill
    agents: Exclude<AgentType, 'shared' | 'custom'>[];  // i.e. 'claude-code' | 'claude-desktop' | 'gemini' | 'copilot'
  }
  ```
  Verifiable via grep + `bun run typecheck`. *(SD-02, CA-03, CA-04)*

- [ ] **AC-18** Existing `SkillsEditor.tsx` is unchanged in behavior. The only permitted edit is adding `export` to the existing `DEFAULT_SKILL_TEMPLATE` declaration (or, alternatively, no edit at all if the implementer chose to duplicate the constant). `git diff main -- src/renderer/components/editors/SkillsEditor.tsx` shows either zero lines or only the `export` keyword added. Verifiable via `git diff`. *(SD-07)*

- [ ] **AC-19** Test files added: `SharedSkillsPage.test.tsx`, `SharedSkillRow.test.tsx`, `SharedSkillDetail.test.tsx`, `InstallFromRegistryDialog.test.tsx`; `skillsHandler.test.ts` extended. Test count constraints (BOTH must hold; `test.each` rows count individually):
  1. **Per-row floor:** every row in the Test Plan §Cases column MUST correspond to at least one distinct `it()` / `test()` block (or `test.each` with at least N rows matching N enumerated cases in the description). Reviewer counts via `bun run test --reporter=verbose` line listing.
  2. **Absolute floor:** `bun run test` total count ≥ 393 (baseline 378 + 15). 0 failures.
  Verifiable via `bun run test` output. *(SD-06)*

- [ ] **AC-20** Verification gates pass: `bun run typecheck`, `bun run lint` (0 errors, 0 warnings), `bun run test` (0 failures, total ≥ baseline + 15). Verifiable by running the three commands. *(SD-01, PR-05)*

- [ ] **AC-21** End-of-session handoff complete per `AGENTS.md`: `feature_list.json` has new `feat-019` entry with `status: "done"` and evidence; `progress.md` snapshot updated; one new line appended to `session-log.jsonl` with today's date; `session-handoff.md` `▶ 下次 Session 從這裡開始` block updated with today's date, gate results, last action, and next starting point. Verifiable via `git diff` on those four files. *(SD-08)*

- [ ] **AC-22** No `console.log` in any new file under `src/renderer/components/shared-skills/` or in the new handler code. Verifiable via grep. *(FP-07)*

- [ ] **AC-23** Visual parity with reference image (`/Users/madao/Downloads/HICt3oGa0AAnzOg.jpg`). Concrete oracle (NOT human screenshot judgment):
  1. `SharedSkillsPage.tsx` renders three DOM regions with `data-testid` in this DOM order: `"shared-skills-header"` → `"shared-skills-filter"` → `"shared-skills-list"`. Verified by `screen.getAllByTestId(/shared-skills-/)` returning the IDs in document order.
  2. Filter bar inner DOM order: chip group has `data-testid="filter-chip-group"` and appears before Refresh button `data-testid="filter-refresh"` in the DOM (left-aligned + right-aligned by Tailwind `flex justify-between`).
  3. Each row's outer container has class `w-full` (full-width within parent).
  Human screenshot review against the reference image is for spot-check only and does NOT block Accept on its own — the data-testid checks are the binding gate. *(SD-04)*

- [ ] **AC-24** No object mutation in new components or handlers. Updates use spread `{...prev}` or `structuredClone`. Verifiable via review-side grep: `grep -RnE '\b[a-zA-Z_]+\.[a-zA-Z_]+\s*=\s*' src/renderer/components/shared-skills/ src/main/ipc/handlers/skillsHandler.ts` — every match must either (a) be a setState call `setX(...)`, (b) be inside a class/constructor (none in this scope), or (c) operate on a freshly-created local object before return. Reviewer cross-checks. *(FP-04)*

- [ ] **AC-25** React component pattern: each of the 4 new components MUST be a function declaration with a named export and the `Props` interface declared immediately above the component. Verifiable via `grep -nE '^(export function|interface .*Props)' src/renderer/components/shared-skills/*.tsx` showing the interface line precedes the `export function` line for each file. *(CA-05)*

### Expected files touched

```
src/renderer/components/shared-skills/SharedSkillsPage.tsx                          (new)
src/renderer/components/shared-skills/SharedSkillRow.tsx                            (new)
src/renderer/components/shared-skills/SharedSkillDetail.tsx                         (new)
src/renderer/components/shared-skills/InstallFromRegistryDialog.tsx                 (new)
src/renderer/components/shared-skills/__tests__/SharedSkillsPage.test.tsx           (new)
src/renderer/components/shared-skills/__tests__/SharedSkillRow.test.tsx             (new)
src/renderer/components/shared-skills/__tests__/SharedSkillDetail.test.tsx          (new)
src/renderer/components/shared-skills/__tests__/InstallFromRegistryDialog.test.tsx  (new)
src/shared/types.ts                                                                  (extend: channels + SkillLinkedBy type + IPC param/result types)
src/main/ipc/handlers/skillsHandler.ts                                              (extend: 4 new handlers + process map)
src/main/ipc/handlers/__tests__/skillsHandler.test.ts                               (extend: new handler cases)
src/preload/index.ts                                                                 (expose new channels on electronAPI())
src/renderer/lib/electron.ts                                                         (expose new methods + thin call wrappers)
src/renderer/App.tsx                                                                 (swap type === 'shared' branch + pass sidebar setter)
src/renderer/components/editors/SkillsEditor.tsx                                    (OPTIONAL: add `export` keyword to DEFAULT_SKILL_TEMPLATE only)
feature_list.json                                                                    (add feat-019 entry)
progress.md                                                                          (snapshot)
session-log.jsonl                                                                    (append one line)
session-handoff.md                                                                   (▶ block)
```

Files explicitly NOT in the touch set (any change here is a scope-discipline defect):
- `src/renderer/components/editors/SkillsEditor.tsx` beyond the optional single-keyword `export` change
- `src/renderer/components/editors/AddSkillDialog.tsx` (FP-08)
- `.gen-eval/rubric.md` (PR-02)

## Verification Plan

```bash
# 1. Gates (all must be green)
bun run typecheck
bun run lint
bun run test

# 2. Architecture / forbidden-pattern grep checks
bash scripts/check-architecture.sh

# 3. Scope-discipline check: existing SkillsEditor untouched (allow at most an `export` keyword diff)
git diff main -- src/renderer/components/editors/SkillsEditor.tsx | grep -E '^\+' | grep -vE '^\+\+\+' | grep -vE '^\+export ' | wc -l   # expect 0

# 4. No raw exec() in new handler code
grep -nE '\bexec\(' src/main/ipc/handlers/skillsHandler.ts   # expect no new matches; only execFile permitted

# 5. No Node imports in renderer shared-skills tree
grep -RnE "from ['\"](fs|os|child_process|path)['\"]" src/renderer/components/shared-skills/   # expect zero hits

# 6. No rogue hex in new TSX
grep -RnE '\[#[0-9a-fA-F]{3,6}\]' src/renderer/components/shared-skills/   # expect zero hits

# 7. No console.log in new code
grep -RnE 'console\.log' src/renderer/components/shared-skills/ src/main/ipc/handlers/skillsHandler.ts   # expect zero new hits

# 8. New IPC channels declared in registry (5 channels: 4 invoke + 1 event)
grep -nE 'SKILL_INSTALL_REGISTRY|SKILL_INSTALL_REGISTRY_STARTED|SKILL_INSTALL_REGISTRY_CANCEL|SKILL_IMPORT_FOLDER|SKILL_GET_LINKED_BY' src/shared/types.ts   # expect ≥ 5 matches

# 8b. Broad hex sweep (AC-14 — three orthogonal greps must all be empty)
grep -RnE '\[#[0-9a-fA-F]{3,6}\]' src/renderer/components/shared-skills/   # tailwind arbitrary-value
grep -RnE 'style=\{\{[^}]*#[0-9a-fA-F]{3,6}' src/renderer/components/shared-skills/   # inline style hex
grep -RnE "'#[0-9a-fA-F]{3,6}'|\"#[0-9a-fA-F]{3,6}\"" src/renderer/components/shared-skills/   # string literal hex

# 9. Test count delta
bun run test 2>&1 | tail -20   # expect total ≥ 378 + 15, 0 failures

# 10. End-of-session handoff files modified
git diff --name-only main -- feature_list.json progress.md session-log.jsonl session-handoff.md   # expect all four
```

## IPC Contract

All channel string constants live in `src/shared/types.ts` under `IPC_CHANNELS`. `AgentType` is the existing union: `'claude-code' | 'claude-desktop' | 'gemini' | 'copilot' | 'shared' | 'custom'`.

### `skill:get-linked-by`
- Request params: `void` (or `{ }`)
- Response: `{ success: true; data: SkillLinkedBy[] } | { success: false; error: string }`
- Type:
  ```ts
  export interface SkillLinkedBy {
    skillId: string;            // basename of the shared skill
    agents: Exclude<AgentType, 'shared' | 'custom'>[];
  }
  ```
- Main-side behavior: enumerate non-shared agent directories from the configured agents list; for each, list `skills/` entries; `fs.readlink()` each; resolve to absolute path; if target equals a known shared-skill absolute path, append the agent's type to that skill's `agents` array.

### `skill:install-registry`
- Request params: `{ input: string }`
- Response (final): `{ success: true; data: { requestId: string; stdout: string; stderr: string; exitCode: number } } | { success: false; error: string; requestId?: string }`
- Main-side flow:
  1. Validate `input` (same rules as renderer, identical regex).
  2. Generate `requestId = crypto.randomUUID()`.
  3. Spawn `execFile('npx', ['skills', 'add', input, ...flags], { cwd: sharedConfigDir, timeout: 90_000 })`.
  4. **Immediately** `event.sender.send('skill:install-registry:started', { requestId })` so the renderer can capture the requestId for a possible Cancel before the install completes.
  5. Store the `ChildProcess` in the module-level `Map<string, ChildProcess>` keyed by `requestId`.
  6. On child `close`, remove the map entry regardless of exit code.
  7. Return `{ requestId, stdout, stderr, exitCode }` (envelope wrapped via `success(...)`).
- The exact `flags` array is left to the implementer; the success oracle is that a subsequent `getSkills('shared')` MUST contain the newly-installed skill ID — not specific flag values.

### `skill:install-registry:started` (event, main → renderer)
- One-way `webContents.send` event emitted by `skill:install-registry` immediately after spawn.
- Payload: `{ requestId: string }`
- Renderer subscribes via `electronAPI().onInstallRegistryStarted(handler)` (preload exposes the IPC event subscription).

### `skill:install-registry:cancel`
- Request params: `{ requestId: string }`
- Response: `{ success: true; data: { killed: boolean } } | { success: false; error: string }`
- Main-side: look up `requestId` in map; if missing → `{ success: false, error: 'unknown requestId' }`; else `proc.kill('SIGTERM')`; `setTimeout` 1500 ms → if still alive `proc.kill('SIGKILL')`; remove from map either way.

### `skill:import-folder`
- Request params: `{ sourcePath: string }`
- Response: `{ success: true; data: { skillId: string } } | { success: false; error: string }`
- Main-side: `assertSafePath(sourcePath, os.homedir())`; verify `sourcePath/SKILL.md` exists; compute `dest = path.join(sharedSkillsDir, path.basename(sourcePath))`; refuse if dest exists; `fs.cp(sourcePath, dest, { recursive: true })`; return `skillId = basename`.

### `skill:install-zip` (reused, unchanged)

## UI Specification

### List state
- **Header**: page title "Shared Skills" left; three primary buttons right, in order: `Install from registry`, `Import existing folder`, `Install from ZIP`. Buttons use the existing primary token (Notion Blue background, white text, 4 px radius, 8/16 px padding).
- **Filter bar**: three chips left-aligned (Claude / Gemini / Copilot) using agent accent tokens; chip text `"<Agent> · <count>"`; chips have no hover lift, no `cursor: pointer`, no `role="button"`. Refresh icon button on the right. Below the filter bar (or left-aligned at the top of the list area), a secondary ghost link `+ Create blank skill`.
- **List**: vertical stack of `SharedSkillRow`. Each row: 12 px radius, white background, whisper border, soft Level-2 shadow on hover only. Row content from left: skill name (Body Semibold), `本地` pill badge, 1-line truncated description (Caption Light, warm-gray), spacer, agent-icon group (small circles using agent accent backgrounds — only the agents from `skill:get-linked-by` for that skill), delete icon (trash). Clicking anywhere in the row except the agent-icon group enters detail. Clicking an agent icon calls the sidebar-setter prop with that agent name.

### Detail state
- Detail replaces list (`view === 'detail'`). Back button top-left (chevron + "Back to list"). Markdown editor (textarea or existing editor primitive — implementer choice, must reuse styling) seeded with current skill content, or with `DEFAULT_SKILL_TEMPLATE` when in new-mode. Save (primary blue) + Cancel (secondary ghost) bottom-right. Pressing `Esc` returns to list.

### Install-from-registry modal
- Centered Deep-Card (Level 3) modal, 12 px radius, whisper border. Title "Install from registry". Input field with placeholder `owner/repo, URL, or local path`. Below input: inline validation error in red on bad input. Install button (primary blue) + Cancel button (secondary ghost). While the IPC call is in flight, Install button shows a spinner and is disabled; Cancel button remains enabled and triggers `skill:install-registry:cancel`. After completion, a read-only output area appears below the buttons showing stdout (mono font) and stderr (mono font, warm-orange tint). Modal closes automatically only after the refreshed skill list contains the new ID; otherwise stays open with an inline error banner.

### Empty state
- Single warm-gray paragraph (Caption Light): "No shared skills yet. Use the buttons above to install from registry, import a folder, or install from ZIP." No extra CTA buttons.

### Error state
- Inline banner above list: white background, 1 px red left border (use existing semantic error token), `AlertCircle` icon (lucide), message text, Retry button on the right. Visual parity with `AddSkillDialog` `zipError` block.

### Loading state
- Text "Loading skills…" centered, same pattern as the existing implementation.

## Security Considerations

1. **No shell injection**: only `execFile`, never `exec`. Args passed as array. (FP-05, AC-7)
2. **Two-sided validation**: renderer rejects invalid input for UX; main re-validates identically before any FS or process operation. (CA-07, AC-5/AC-6)
3. **Path safety**: `assertSafePath` on every renderer-supplied path. Local-path branch of registry install also calls `assertSafePath`. Folder import calls `assertSafePath` on the source. (FP-02, AC-6/AC-10)
4. **No Node in renderer**: grep gate (AC-16). (FP-03)
5. **Child-process lifecycle**: every spawned `ChildProcess` is tracked in a map and explicitly removed on exit; cancel escalates SIGTERM→SIGKILL with a 1500 ms timer. No orphaned processes after cancellation. (CA-06, AC-7/AC-8)
6. **Envelope integrity**: no `throw` crosses the IPC boundary. (FP-01, AC-15)
7. **No console.log in production code**: grep gate. (FP-07, AC-22)
8. **Destination collision**: `skill:import-folder` refuses to overwrite an existing destination directory. (AC-10)

## Test Plan

| File | Cases |
|---|---|
| `SharedSkillsPage.test.tsx` | (a) renders header + 3 action buttons + 3 chips + Refresh + Create-blank link + list; (b) chips are not interactive (no onClick fires); (c) chip count = linkedBy count + own-dir count for each agent (mocked IPC); (d) row click → detail view rendered, list unmounted; (e) `Esc` in detail → list re-rendered; (f) agent-icon click in a row calls the sidebar-setter prop with that agent name, does NOT enter detail; (g) loading text shown while IPC pending; (h) error banner shown on IPC failure with Retry button that re-invokes the IPC; (i) empty-state text shown when getSkills returns []. |
| `SharedSkillRow.test.tsx` | name/description/badge rendering; description truncation (1 line + title attr or tooltip); agent-icon group renders only the linked agents; delete confirm flow. |
| `SharedSkillDetail.test.tsx` | Save → calls `config:save-skill` with current content; Cancel → returns to list (props `onBack` called); new-mode seeds textarea with `DEFAULT_SKILL_TEMPLATE`; `Esc` calls onBack. |
| `InstallFromRegistryDialog.test.tsx` | table-driven validation (valid: `owner/repo`, `https://...`, `git@host:...`, `./x`, `/abs/x`, `~/x`; invalid: empty, >500 chars, contains `;`, `|`, `&`, `$`, backtick, whitespace); success path mocks `skill:install-registry` → expects stdout displayed; failure path → expects inline error; cancel path during pending IPC → expects `skill:install-registry:cancel` invoked with the requestId. |
| `skillsHandler.test.ts` (extend) | for each new channel: envelope shape on success and on error; `skill:get-linked-by` aggregation with a temp dir of symlinks; `skill:install-registry` invalid-input rejection without spawning; `skill:install-registry:cancel` SIGTERM then SIGKILL after 1500 ms using `vi.useFakeTimers()` + stub ChildProcess; `skill:import-folder` happy path with temp dir + SKILL.md + refuses when SKILL.md missing + refuses on destination collision. |

Baseline 378 tests must not regress. Expected delta: ≥ +15 tests.

## Definition of Done

- [ ] All 25 ACs above checked off
- [ ] `bun run typecheck` clean
- [ ] `bun run lint` 0 errors / 0 warnings
- [ ] `bun run test` 0 failures, total ≥ 393
- [ ] `bash scripts/check-architecture.sh` clean
- [ ] `feature_list.json` has new `feat-019` entry with `status: "done"` and evidence (test count, file list)
- [ ] `progress.md` snapshot + 上次 Session 結束點 updated
- [ ] one new line appended to `session-log.jsonl` with today's date (2026-05-23 or later if session spans days)
- [ ] `session-handoff.md` `▶ 下次 Session 從這裡開始` block updated
- [ ] handoff commit `chore: end-of-session handoff YYYY-MM-DD` includes exactly the 4 state files
