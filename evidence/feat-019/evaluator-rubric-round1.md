# Evaluator Rubric

**ContractBaselineHash**: ea2865250a67ecc1c93d9ebd7dca212638717e34c24b0bd59a3bad74cadbbb29
**Topic**: feat-019 — Claude 外掛頁面重構（對齊官方 plugin 模型 + CLI 整合 + Notion 設計系統）
**Phase**: TEMPLATE
**Date**: 2026-05-03

---

## Verdict Thresholds (FIXED — do not edit)

- **APPROVED**: All dimensions ≥ 4 / 5 AND no dimension < 3 / 5 AND zero CRITICAL findings
- **CHANGES_REQUESTED**: Any dimension at 3 / 5, OR exactly one dimension < 3 / 5, OR HIGH findings exist
- **REJECTED**: Two or more dimensions < 3 / 5, OR any CRITICAL finding, OR Commitment Gates ordering violated

---

## Dimension 1 — Correctness

**Score**: ___ / 5

**Derivation**: Scope (S0–S4) + Verification Standards V/F/C/D + Lock-in Tables L1–L6.

### Criteria

#### Backend (S0, S1)

- [ ] **C-S0-1 Research doc completeness** — `docs/CLAUDE_PLUGIN_LAYOUT.md` exists with all 7 sections (settings.json keys / installed_plugins.json v2 / known_marketplaces.json with 5 source.source enum / marketplace.json schema / cache layout / `~/.claude/plugins/*` path map / boundary cases incl. missing file, JSON corruption, symlink, unknown source.source). Each section ≥ 12 lines (anti-stub). [Scope S0-1]
- [ ] **C-S1-1 Type extensions** — `src/shared/types.ts` contains: extended `ClaudePlugin` (description / author / homepage / repository / license / category / components{skills,agents,hooks,mcp,lsp,monitors}); new `ClaudeMarketplace`; new `ClaudeMarketplaceSource` discriminated union covering exactly the L5 enum (github / git / git-subdir / url / directory); new `ClaudePluginDiscoveryItem`; new `ClaudePluginError`; new `CliRunResult`. [Scope S1-1, Lock-in L5]
- [ ] **C-S1-2 IPC channels — full L1 enum** — `IPC_CHANNELS` defines exactly the 9 constants in L1 with the channel strings as listed: `CONFIG_GET_CLAUDE_MARKETPLACES`, `CONFIG_GET_CLAUDE_PLUGIN_DISCOVERY`, `CONFIG_GET_CLAUDE_PLUGIN_ERRORS`, `CLAUDE_CLI_MARKETPLACE_ADD`, `CLAUDE_CLI_MARKETPLACE_REMOVE`, `CLAUDE_CLI_MARKETPLACE_UPDATE`, `CLAUDE_CLI_PLUGIN_INSTALL`, `CLAUDE_CLI_PLUGIN_UNINSTALL`, `CLAUDE_CLI_RELOAD`. [Scope S1-2, Lock-in L1]
- [ ] **C-S1-3 Preload bindings** — `src/preload/index.ts` binds all 9 methods under the documented namespaces: 6 under `electronAPI.claudeCli.*` and 3 under `electronAPI.config.*` (`getClaudeMarketplaces`, `getClaudePluginDiscovery`, `getClaudePluginErrors`). One-to-one with L1. [Scope S1-3]
- [ ] **C-S1-4 Plugins handler** — `src/main/ipc/handlers/claudePluginsHandler.ts` exists with the 5 read handlers (getPlugins / getMarketplaces / getDiscovery / getErrors / readPluginManifest) and 6 CLI delegating handlers (marketplaceAdd / marketplaceRemove / marketplaceUpdate / pluginInstall / pluginUninstall / reload). Plugin-specific handlers removed from `claudeHandler.ts`; other Claude handlers (settings/agents/sessions/rules/skills) preserved. [Scope S1-4, S1-6, S1-7]
- [ ] **C-S1-5 cliRunner safety implementation** — `src/main/ipc/handlers/cliRunner.ts` is the sole spawn site for `claude`; uses `child_process.spawn` with array args and `shell: false` (no `exec` / `execSync`); enforces L4 11-command whitelist; runs `assertSafeName` on marketplace name / plugin id / scope; validates custom git URL with L6 regex; 60 s timeout → SIGTERM → 5 s → SIGKILL; binary detection via `where` (Windows) / `which` (others) with the exact failure string `claude CLI not found in PATH; install via instructions at https://code.claude.com/docs/zh-TW/setup`. [Scope S1-5, Verification C1–C5, Lock-in L4, L6, Platform PE1, PE3]
- [ ] **C-S1-6 IPC envelope** — Every handler returns `{ success, data? } | { success: false, error }`; no thrown exceptions cross the IPC boundary. [Scope S1-6, AGENTS.md rules]

#### Renderer (S2) — UI Visual Sub-criteria (per ui-detection.md Phase 2 addendum)

For EACH of the 4 tabs (Installed / Marketplaces / Discover / Errors), the dialog (MarketplaceDialog), and PluginManifestPanel, ALL six visual sub-criteria below must be satisfied. Mark per-tab/component PASS / FAIL / N/A.

- [ ] **C-S2-1 Tabs router** — `ClaudePlugins.tsx` is a router using `src/renderer/components/ui/tabs.tsx` with exactly the L2 enum of 4 triggers (`installed` / `marketplaces` / `discover` / `errors`); SCOPE_COLORS hard-coded colours and inline `minWidth/maxWidth` removed. [Scope S2-1, Lock-in L2]
- [ ] **C-S2-2 InstalledTab** — `ClaudePlugins/InstalledTab.tsx` exists; filter retains all/user/project and adds `local`; `PluginManifestPanel` shows author/homepage/repository/license/components counts. [Scope S2-2, Lock-in L3]
- [ ] **C-S2-3 MarketplacesTab** — `ClaudePlugins/MarketplacesTab.tsx` lists `ClaudeMarketplace[]`; renders source-type pill, auto-update Switch, Update + Remove; `claude-plugins-official` Remove disabled with tooltip `Built-in marketplace cannot be removed`; `+ Add Marketplace` button opens dialog. [Scope S2-3, Known Divergence DV2]
- [ ] **C-S2-4 DiscoverTab** — `ClaudePlugins/DiscoverTab.tsx` exists with marketplace selector + `ClaudePluginDiscoveryItem[]` list; per-item name / description / author / category badge / Install; Install opens scope chooser (user/project/local — managed excluded per L3); displays toast progress + last 4 lines of stdout. [Scope S2-4, Lock-in L3, Known Divergence DV1]
- [ ] **C-S2-5 ErrorsTab** — `ClaudePlugins/ErrorsTab.tsx` exists; lists `ClaudePluginError[]`; empty state uses `ExtensionListLayout` empty pattern. [Scope S2-5]
- [ ] **C-S2-6 MarketplaceDialog** — `ClaudePlugins/MarketplaceDialog.tsx` uses `ui/dialog.tsx`; form has marketplace name (required), source-type radio with exactly 4 visible choices (github / git / url / directory), dynamic per-source fields, auto-update Switch; submit calls `marketplaceAdd`. [Scope S2-6]
- [ ] **C-S2-7 PluginManifestPanel** — `ClaudePlugins/PluginManifestPanel.tsx` exists; uses `badge-notion`, `border-whisper`, `shadow-notion-card`, `bg-card`. [Scope S2-7]
- [ ] **C-S2-8 Hard-coded colour ban** — No matches for the disallowed Tailwind colour regex anywhere in the new ClaudePlugins directory or `ClaudePlugins.tsx`. [Scope S2-8, Verification D1–D3]

##### Visual Sub-criteria Checklist (applied per UI surface, 6 surfaces × 6 = 36 checks)

For each surface (Installed, Marketplaces, Discover, Errors, MarketplaceDialog, PluginManifestPanel) record PASS / FAIL / N/A:

- [ ] **(a) Text alignment / typography** — matches DESIGN.md §3
- [ ] **(b) Element hierarchy** — uses feat-018 tokens; correct z-index; no unintended overlap
- [ ] **(c) Spacing & padding** — consistent with sibling components on 8 px scale
- [ ] **(d) Interactive states** — default / hover / focus / active / disabled all present and visually distinct (covers M7 / M8 / M9 / M10 / M11)
- [ ] **(e) Empty / loading / error states** — each rendered and visually distinguishable from happy path (covers M5, M12, M13, M14)
- [ ] **(f) Responsive behavior** — N/A by contract (Electron 1280×800 only); record N/A explicitly for each screenshot

### Evidence Required

(filled during Phase 3)

- `evidence/feat-019/v1-typecheck.txt` — `bun run typecheck` exit 0
- `evidence/feat-019/v2-lint.txt` — `bun run lint` 0 errors / 0 warnings
- `evidence/feat-019/v3-test.txt` — `bun run test` ≥ baseline + 25 new cases
- `evidence/feat-019/v4-arch.txt` — `bash scripts/check-architecture.sh` 0 violations
- `evidence/feat-019/v5-build.txt` — `bun run build` renderer + main + preload all green, mtime aligned, untruncated
- `evidence/feat-019/f-ipc-grep.txt` — F1–F4 grep outputs (channel count ≥ 9, preload bindings, handler tests green)
- `evidence/feat-019/c-cli-failures.txt` — C1–C5 grep + cliRunner failure-path test outputs
- `evidence/feat-019/d-design-grep.txt` — D1–D5 grep outputs (0 colour matches, ≥ 5 badge-notion, ≥ 4 shadow/border tokens)
- Screenshot evidence per ui-detection.md: `evidence/feat-019/m{1..14}.png` plus `evidence/feat-019/m4-no-binary.png`; each accompanied by `m{N}.notes.md` with PASS/FAIL/N/A for the six visual sub-criteria
- `wc -l` of each section in `docs/CLAUDE_PLUGIN_LAYOUT.md` showing ≥ 12 lines per section

---

## Dimension 2 — Verification

**Score**: ___ / 5

**Derivation**: Verification Standards (V / F / C / D / M / R) + Evidence Plan.

### Criteria

- [ ] **V-AUTOMATED Gates V1–V5 actually executed and green** — `v1-typecheck.txt` shows `bun run typecheck` exit 0; `v2-lint.txt` shows `bun run lint` 0 errors AND 0 warnings; `v3-test.txt` shows `bun run test` with delta ≥ +25 cases over the 378 baseline and zero new failures; `v4-arch.txt` shows 0 boundary violations; `v5-build.txt` shows three-stage build success with mtime aligned and untruncated stdout. [Verification V1–V5]
- [ ] **V-FUNC Backend functional checks F1–F4** — `f-ipc-grep.txt` evidences: F1 ≥ 9 IPC channel constants; F2 9 preload bindings (≥ 6 `claudeCli.*` + 3 `config.getClaude(Marketplaces|PluginDiscovery|PluginErrors)`); F3 `bunx vitest run claudePluginsHandler.test.ts` green; F4 `bunx vitest run cliRunner.test.ts` green. Outputs untruncated. [Verification F1–F4]
- [ ] **V-CLI-SAFETY C1–C5 evidenced** — `c-cli-failures.txt` shows: C1 0 matches for `shell: true`; C2 0 matches for `exec(` / `execSync(`; C3 cliRunner test (c) proves non-whitelisted command rejection; C4 tests (d)+(e) prove `assertSafeName` + git-URL regex enforcement; C5 test (a) proves `claude CLI not found` error message returned. [Verification C1–C5]
- [ ] **V-DESIGN D1–D5 evidenced** — `d-design-grep.txt` shows: D1 0 hard-coded Tailwind colour matches across `ClaudePlugins/` + `ClaudePlugins.tsx`; D2 0 ad-hoc hex border matches; D3 0 inline `minWidth:/maxWidth:` numeric matches; D4 ≥ 5 `badge-notion` matches; D5 ≥ 4 `shadow-notion-card` / `border-whisper` matches. [Verification D1–D5]
- [ ] **V-MANUAL UI spot-check M1–M14** — All 14 screenshots present in `evidence/feat-019/m{N}.png`; each has companion `m{N}.notes.md` with the six visual sub-criteria recorded; M4 includes the `m4-no-binary.png` variant covering the no-binary toast; manual flows match the contract narrative for each item (M1 default tab, M2 Built-in pill, M3 directory marketplace add, M4 install scope chooser + binary fallback, M5 Errors empty state, M6 toggle persistence, M7–M11 interactive states, M12–M14 empty / loading / error states). [Verification M1–M14]
- [ ] **V-REGRESSION R1–R4 evidenced** — Outputs prove: R1 ≥ 18 `"status": "done"` entries unchanged for feat-001~018; R2 `git diff feat-018-baseline -- src/renderer/index.css tailwind.config.js` produces 0 lines; R3 `docs/E2E_BLOCKED.md` byte-identical to baseline; R4 `ExtensionRow.test.tsx:63` `bg-accent/60` assertion still passes. [Verification R1–R4]
- [ ] **V-EVIDENCE-PLAN Coverage** — Every Evidence Plan row collected: Correctness (v1–v5, f-ipc-grep, layout-doc wc -l) / Verification (V+F+C+D+M screenshots) / Scope Discipline (scope-diff.txt) / Reliability (R1–R4 + c-cli-failures.txt) / Maintainability (layout doc + file-line counts + AGENTS.md addition) / Handoff Readiness (presence checks). No row missing. [Evidence Plan table]

### Evidence Required

(filled during Phase 3)

- All files listed under Correctness Evidence Required above
- Manual screenshot evidence M1–M14 plus M4-no-binary
- `evidence/feat-019/scope-diff.txt`, `r-regression-*.txt`, AGENTS.md diff hunk

---

## Dimension 3 — Scope Discipline

**Score**: ___ / 5

**Derivation**: Scope (whitelist) + Exclusions (blacklist) + Evidence Plan scope-diff requirement.

### Criteria

- [ ] **SD-WHITELIST Modified files all in allowlist** — `git diff main...feat-019-impl --stat` (saved at `evidence/feat-019/scope-diff.txt`) only contains paths from the contract Evidence Plan whitelist: `docs/CLAUDE_PLUGIN_LAYOUT.md`; `src/shared/types.ts`; `src/preload/index.ts`; `src/main/ipc/configHandlers.ts`; `src/main/ipc/handlers/claudeHandler.ts`; `src/main/ipc/handlers/claudePluginsHandler.ts` (new); `src/main/ipc/handlers/cliRunner.ts` (new); `src/main/ipc/__tests__/cliRunner.test.ts` (new); `src/main/ipc/__tests__/claudePluginsHandler.test.ts` (new); `src/renderer/components/agents/ClaudePlugins.tsx`; `src/renderer/components/agents/ClaudePlugins/*` (new dir); `src/renderer/components/agents/__tests__/ClaudePlugins.test.tsx` + 4 new test files; `feature_list.json`; `progress.md`; `session-log.jsonl`; `session-handoff.md`; `evidence/feat-019/**`. Anything else = violation. [Evidence Plan, Scope Discipline row]
- [ ] **SD-EXCL-1 Untouched handlers** — `src/main/ipc/handlers/{geminiHandler,copilotHandler,mcpHandler,skillsHandler,rulesHandler,markdownHandler,agentsHandler,configUtils}.ts` all unchanged in the diff. [Exclusions ❌ #1]
- [ ] **SD-EXCL-2 Untouched renderer files** — `GeminiExtensions.tsx`, `SubagentsEditor.tsx`, `ClaudeSessionsView.tsx`, `GeminiSessionsView.tsx`, `CopilotSessionsView.tsx`, `SessionsView.tsx`, `ClaudePlugins/FilterToolbar.tsx` all unchanged. [Exclusions ❌ #2]
- [ ] **SD-EXCL-3 Shared / app shell untouched** — `src/renderer/components/{layout,editors,shared,ui}/**`, `src/renderer/{App.tsx,main.tsx,index.css}`, `src/renderer/{hooks,lib}/**`, `tailwind.config.js`, `src/test/setup.ts` byte-identical to baseline. [Exclusions ❌ #3]
- [ ] **SD-EXCL-4 Docs / build config untouched** — `docs/{ARCHITECTURE.md,DESIGN.md,E2E_BLOCKED.md,PRODUCT.md}`, `scripts/check-architecture.sh`, `init.sh`, `package.json`, `tsconfig*.json`, `vite.config.ts`, `playwright.config.ts`, `e2e/**` all unchanged. [Exclusions ❌ #4]
- [ ] **SD-EXCL-5 No new npm dependencies** — `package.json` and `bun.lock` show no new dependency entries. [Exclusions ❌ #5]
- [ ] **SD-EXCL-6 No out-of-scope features** — Implementation does NOT include LSP diagnostics, plugin developer mode, marketplace submission UI, managed-scope edits, or background monitor triggers. [Exclusions ❌ #6]
- [ ] **SD-EXCL-7 No E2E added** — `e2e/**` unchanged; feat-016 status untouched. [Exclusions ❌ #7]
- [ ] **SD-EXCL-8 Other features untouched** — `feature_list.json` has only feat-019 modified; feat-001~018 status / evidence byte-identical. [Exclusions ❌ #8]

### Evidence Required

(filled during Phase 3)

- `evidence/feat-019/scope-diff.txt` (full `--stat`)
- `git diff feat-018-baseline -- <each excluded file>` outputs aggregated in `evidence/feat-019/r-regression-*.txt`

---

## Dimension 4 — Reliability

**Score**: ___ / 5

**Derivation**: Reliability Checks RC1–RC6 (with Sources) + Verification Standards + Commitment Gates ordering criterion.

### Criteria

- [ ] **REL-RC1 Binary missing path** — Trigger: `claude` not in PATH. Expected: cliRunner returns the exact error string `claude CLI not found in PATH; install via instructions at https://code.claude.com/docs/zh-TW/setup`; Errors tab surfaces same message; other tabs continue to render cached data. [RC1, Source: discover-plugins § Troubleshooting]
- [ ] **REL-RC2 installed_plugins.json missing** — Handler returns `{ success: true, data: [] }` (treated as empty, not error). [RC2, Source: inferred — fresh-install machine has no file]
- [ ] **REL-RC3 installed_plugins.json corrupt** — Handler catches `SyntaxError`, returns `{ success: false, error: <message> }`; Errors tab shows entry with `severity: 'error'`, `raisedAt: <ISO>`; other tabs not blocked. [RC3, Source: AGENTS.md IPC envelope rule]
- [ ] **REL-RC4 60 s timeout** — Spawned process receives SIGTERM at 60 s; if alive after 5 s, SIGKILL; envelope returns `{ success: false, error: "claude CLI timeout (60s)", stdout: <partial>, stderr: <partial> }`; UI shows toast `CLI timed out`. [RC4, Source: inferred — defensive against hang]
- [ ] **REL-RC5 Unsafe marketplace name** — Input `..` or `;` → `assertSafeName` throws → cliRunner catches → returns `{ success: false, error: "invalid marketplace name: <reason>" }`; CLI never spawned; Errors tab not written (toast only). [RC5, Source: AGENTS.md `assertSafeName` rule]
- [ ] **REL-RC6 known_marketplaces vs extraKnownMarketplaces conflict** — Same name, different source: handler treats `known_marketplaces.json` as canonical, marks `extraKnownMarketplaces` entry as `unsynced` warn pill in UI; no automatic CLI side effect at startup. [RC6, Source: discover-plugins § 配置團隊市場]
- [ ] **Commitment ordering** — For EACH of the 4 non-N/A Commitment Gates rows (`feature_list.json` status flip / `progress.md` update / `session-log.jsonl` append / `session-handoff.md` update), the commitment edit's mtime (or commit time when committed) is STRICTLY LATER than the latest mtime among ALL Gate evidence files (V1–V5, F1–F4, C1–C5, D1–D5, M1–M14, R1–R4, RC1–RC6 evidence under `evidence/feat-019/`). Verify with `stat`/`git log --format=%cI`. ANY out-of-order edit = CRITICAL finding. [Commitment Gates rows 1–4]
- [ ] **REL-CMT-CASCADE Failure handling honored** — If any underlying Gate evidence is missing or failing, no downstream commitment was fired; if a fire occurred prematurely, the contract's revert path was executed (status reverted to `planned`, evidence cleared, `progress.md` revert line appended). [Commitment Gates Failure Handling columns]

### Evidence Required

(filled during Phase 3)

- `evidence/feat-019/c-cli-failures.txt` — RC1, RC4, RC5 output paths
- `evidence/feat-019/r-regression-*.txt` — R1–R4 confirming no cross-feature drift
- Output of `stat -c '%Y %n' evidence/feat-019/* feature_list.json progress.md session-log.jsonl session-handoff.md` (or PowerShell equivalent) demonstrating chronological ordering
- `git log --format='%cI %H %s' -- feature_list.json progress.md session-log.jsonl session-handoff.md` (when committed)

---

## Dimension 5 — Maintainability

**Score**: ___ / 5

**Derivation**: Evidence Plan Maintainability row + Requirement Sources.

### Criteria

- [ ] **M-DOC-LAYOUT Research doc complete** — `docs/CLAUDE_PLUGIN_LAYOUT.md` contains all 7 contract sections; `wc -l` per section ≥ 12 (no stubs); references official Anthropic docs URLs from Requirement Sources. [Evidence Plan Maintainability, Requirement Sources]
- [ ] **M-FILE-SIZE-1** — `src/main/ipc/handlers/claudePluginsHandler.ts` ≤ 400 lines. [Evidence Plan Maintainability]
- [ ] **M-FILE-SIZE-2** — `src/main/ipc/handlers/cliRunner.ts` ≤ 400 lines. [Evidence Plan Maintainability]
- [ ] **M-AGENTS-ADDITION** — `AGENTS.md` adds a new section (e.g. `Claude Plugins / CLI Runner — 規則`) covering: cliRunner whitelist (L4 11 commands), git URL regex (L6), binary detection (PE1). Section is concrete, references the actual file paths, and would help a future agent navigate the new module without rediscovery. [Evidence Plan Maintainability, AGENTS.md update rule]
- [ ] **M-REQ-SOURCES Source coverage** — Implementation references and respects the Requirement Sources: official plugin manifest schema (code.claude.com/docs/zh-TW/plugins), `/plugin` 4-tab UX (discover-plugins), real samples from `~/.claude/plugins/installed_plugins.json` v2 + `known_marketplaces.json` + `marketplace.json` + cache `plugin.json`, DESIGN.md, AGENTS.md. Type definitions and handler logic align with these source schemas (no drift). [Requirement Sources block]

### Evidence Required

(filled during Phase 3)

- `wc -l docs/CLAUDE_PLUGIN_LAYOUT.md` overall + per-section counts
- `wc -l src/main/ipc/handlers/claudePluginsHandler.ts src/main/ipc/handlers/cliRunner.ts`
- `git diff -- AGENTS.md` showing the new section
- Cross-reference notes mapping types in `src/shared/types.ts` to fields in the cited real samples

---

## Dimension 6 — Handoff Readiness

**Score**: ___ / 5

**Derivation**: Scope deliverables (S0, S4) + git/context locator. Per ADR-0005, criteria check ONLY artifact existence, git working tree state, and key context locators — NOT prose quality of handoff documents.

### Criteria

- [ ] **HR-EVIDENCE-DIR** — `evidence/feat-019/` directory exists and contains files matching each evidence category: `v{1..5}-*.txt`, `f-*.txt`, `c-*.txt`, `d-*.txt`, `m{1..14}.png` + `m{N}.notes.md`, `m4-no-binary.png`, `r-regression-*.txt`, `scope-diff.txt`. Verify with `Glob`. [Evidence Plan, Handoff Readiness row]
- [ ] **HR-FEATURE-LIST** — `feature_list.json` feat-019 entry has `"status": "done"` (string match, exact value) AND `"evidence"` field is a non-empty string. (Do NOT grade evidence string wording.) [S4-1, Commitment Gates row 1]
- [ ] **HR-FILES-TRACKED** — `progress.md`, `session-log.jsonl`, `session-handoff.md` are all tracked by git (`git ls-files` returns each). (Do NOT grade prose / 四欄措辭.) [S4-2, S4-3, S4-4]
- [ ] **HR-GIT-CLEAN** — `git status --porcelain` shows the working tree is clean except for the 4 designated handoff files (`feature_list.json`, `progress.md`, `session-log.jsonl`, `session-handoff.md`) and the handoff commit; no stray untracked files outside `evidence/feat-019/`. [End-of-session step 5 in AGENTS.md]
- [ ] **HR-CONTEXT-LOCATORS** — `Glob` finds: (a) `AGENTS.md` at repo root; (b) `docs/CLAUDE_PLUGIN_LAYOUT.md` at the contracted path; (c) `CLAUDE.md` (pointer) at repo root. Each locator is reachable from a fresh checkout without prior context. [Scope deliverables, AGENTS.md self-reference]

### Evidence Required

(filled during Phase 3)

- `Glob evidence/feat-019/**` showing the populated directory listing
- `grep` extract of `feature_list.json` feat-019 entry showing status + evidence fields
- `git ls-files progress.md session-log.jsonl session-handoff.md`
- `git status --porcelain` post-handoff
- `Glob` results for `AGENTS.md`, `CLAUDE.md`, `docs/CLAUDE_PLUGIN_LAYOUT.md`

---

## Findings (filled during Phase 3)

(filled during Phase 3)

| ID | Severity | Dimension | Description | Required Fix |
|----|----------|-----------|-------------|--------------|

Severity legend: CRITICAL (blocks merge), HIGH (must fix before APPROVED), MEDIUM (should fix), LOW (nice to have).

---

## Verdict (filled during Phase 3)

**Result**: ___ (APPROVED / CHANGES_REQUESTED / REJECTED)

**Summary**: (filled during Phase 3)
