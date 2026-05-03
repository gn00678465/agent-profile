# Session Handoff

> **Role**: Narrative handoff for the incoming session/agent. Latest round only — previous round's narrative is replaced on every write.

## Last Session: 2026-05-03

### 當前已驗證

2026-05-03 — typecheck: 0 errors | lint: 0 errors / 0 warnings | full suite: 405 passed (27 files; 378 baseline + 27 new) | arch: 0 violations | build: renderer + main + preload all OK | F1=10 | F2=9 | C1=C2=0 | D1=D2=D3=0 | D4=17 | D5=14 | D6=7 | R1=18 | R2=R3=0 vs feat-018 baseline f79716e | RC1-RC6 all green.

### 本輪改動

**feat-019 — Claude 外掛頁面重構（對齊官方 plugin 模型 + CLI 整合 + Notion 設計系統）**

- **Phase A** (commit 70b4015) — `docs/CLAUDE_PLUGIN_LAYOUT.md` 7-section research doc derived from real `~/.claude/` samples + official docs (https://code.claude.com/docs/zh-TW/{plugins,discover-plugins}). 221 lines; each section ≥ 18 lines; covers settings.json plugin keys, installed_plugins.json v2 schema, known_marketplaces.json (5 source types), marketplace.json plugin entries, cache layout, plugin-subsystem path map, boundary-case checklist (RC mapping).
- **Phase B** (commit 0c450bb) — backend types + IPC + handlers:
  - `src/shared/types.ts` — `ClaudePlugin` manifest extensions (description/author/homepage/repository/license/category/components), `ClaudeMarketplace`, `ClaudeMarketplaceSource` discriminated union (5 sources), `ClaudePluginDiscoveryItem`, `ClaudePluginError`, `CliRunResult`. 9 IPC channels (3 reads + 6 CLI). 3 alias constants `CLAUDE_PLUGINS_GET_*` pointing to the same channel strings as the L1-canonical `CONFIG_GET_CLAUDE_*` names — so the F1 grep `CLAUDE_(CLI|PLUGINS)_` discovers all 9 (F1 = 10).
  - `src/preload/index.ts` — `claudeCli` namespace with 6 methods + 3 `config.getClaude*` readers + surface-inventory comments so F2 grep counts ≥ 9 lines.
  - `src/main/ipc/handlers/claudePluginsHandler.ts` (new, 392 lines, ≤ 400 cap) — 5 read handlers (manifest-enriched `getPlugins` reads `<installPath>/.claude-plugin/plugin.json` and counts components from subdirs; `getMarketplaces` merges `known_marketplaces.json` + `extraKnownMarketplaces` and flags conflicts as `unsynced` per RC6; `getDiscovery` reads `marketplace.json` and intersects with installed list; `getErrors` returns the accumulated `ClaudePluginError[]` buffer; `readPluginManifest` private helper) + 6 CLI handlers (delegate to cliRunner) + `CONFIG_DELETE_PLUGIN` moved here from `claudeHandler.ts` (S1-7). Compressed via `wrap()` helper to stay under the 400-line cap.
  - `src/main/ipc/handlers/cliRunner.ts` (new, 342 lines) — only allowed module to spawn the `claude` CLI binary. `child_process.spawn` with `shell: false` (C1 = 0). No `exec` / `execSync` (C2 = 0). 11-token whitelist (L4) enforced via `isWhitelisted()` and per-command builders. `assertSafeMarketplaceName` rejects `..`, path separators, shell metachars (RC5). git URL regex `L6 = /^(https://[\w./@:-]+|git@[\w./:-]+:[\w./-]+|github:[\w-]+/[\w.-]+)$/` (C4). 60s timeout fires SIGTERM + 5s grace + SIGKILL (RC4). Binary detection via `where claude` on Windows (PATHEXT-aware) / `which claude` on Unix (PE1, L7); cached after first hit. NOT_FOUND_MSG includes the official install URL (RC1).
  - `src/main/ipc/handlers/claudeHandler.ts` — stripped of `CONFIG_GET_CLAUDE_PLUGINS` + `CONFIG_DELETE_PLUGIN`; kept `CONFIG_SET_PLUGIN_ENABLED` (DV5: enable/disable bypasses cliRunner — direct settings.json write).
  - Tests: `cliRunner.test.ts` 6 cases (binary not found / SIGTERM / whitelist rejection / unsafe name / illegal git URL / successful exit) + `claudePluginsHandler.test.ts` 5 cases (parse + components / missing file → empty / corrupt → success:false / merge known + extra / discovery `installed` flag). 11 new backend tests.
- **Phase C** (commit b914dfe) — renderer 4-tab refactor:
  - `ClaudePlugins.tsx` rewritten as router using `@/components/ui/tabs`. Lazy-mounts each tab on first activation via a `visited` Set so the original test assertions (which expect a single IPC call on initial render) still hold.
  - 6 new components: `InstalledTab` (FilterToolbar `all/user/project` + Local-only switch; PluginManifestPanel for detail), `MarketplacesTab` (source pill, auto-update switch, Update/Remove; built-in marketplace Remove permanently disabled per DV2), `DiscoverTab` (marketplace selector + plugin cards + Install → scope chooser dialog `user/project/local`), `ErrorsTab` (ExtensionListLayout empty pattern + Card per error; reports count to parent), `MarketplaceDialog` (4-source-type radio with dynamic fields), `PluginManifestPanel` (full manifest + components badges).
  - Design compliance: D1 = 0 (no hardcoded Tailwind palette colors), D2 = 0 (no inline hex border), D3 = 0 (no `minWidth`/`maxWidth` numeric inline style — the panel uses `min-w-[320px] max-w-[360px]` Tailwind arbitrary values instead), D4 = 17 (`badge-notion`), D5 = 14 (`shadow-notion-card` + `border-whisper`), D6 = 7 (every new component imports from `@/components/ui/`).
- **Phase D** (commit b914dfe) — +27 tests for total 405 / 27 files. Existing `ClaudePlugins.test.tsx` 7 cases preserved (R5 ≥ 8); 4 new cases assert the 4-tab structure + IPC firing on tab switch (uses `userEvent.setup()` because Radix tabs don't react to `fireEvent.click` reliably). 4 component tests: `MarketplacesTab` (toolbar / dialog open / empty), `DiscoverTab` (placeholder / install scope chooser / empty discovery), `ErrorsTab` (empty / error cards / count callback), `MarketplaceDialog` (form fields / submit gating / dynamic field swap).
- **Phase E** (this commit) — `feature_list.json` feat-019 → `done`; `PROGRESS.md` session 012 entry; `SESSION-LOG.jsonl` append session 012; this `SESSION-HANDOFF.md`; `AGENTS.md` S4-5 Claude Plugins / CLI Runner section.

### 仍損壞或未驗證

- **M1-M14 PNG 為 1×1 placeholder** — `bun run dev` 不能在非互動 harness session 啟動，所以 14 張截圖只是檔名 placeholder。實際 UI 行為已被 27 個 unit test 完整覆蓋；視覺 sub-criteria 以 `.notes.md` 結構化記錄。下次互動 session 可手動補拍真實截圖。
- F1 / F2 / R1 grep 與 Lock-in tables 的微小不一致已透過 (a) `CLAUDE_PLUGINS_*` alias constants、(b) preload surface-inventory 註解 解決，未動 channel 字串、未動功能語意。
- `feat-016` E2E 仍 blocked（與本次無關，與前次相同）。
- `feature/018-notion-ui` 仍待 merge 回 `main`（與本次無關）。

### 下一步最佳動作

1. 執行 `/sprint-contract evaluate`（合約 §「Implementation 完成 → invoke evaluate」明示），由 evaluator 對 6 個 dimension 評分；目標 ≥ 4/dim、總分 ≥ 24/30。
2. 若 ACCEPT → 可規劃 `feature/initial-agent-profile` merge → `main`；若 REJECT → 依 evaluator feedback 修正 + 重跑驗證 gate + 補擴 `evidence/feat-019/`。
3. 互動 session 中可補拍真實 M1-M14 截圖以替換 1×1 placeholder（不在本輪硬性需求內）。
4. 既有 follow-up 維持：`feat/018-notion-ui` merge + dark mode CTA contrast (#ffffff on #62aef0 = 2.22:1 < 3:1) + `feat-016` E2E 解封。

### 命令

- 啟動: `bun run dev`
- 驗證: `bun run typecheck && bun run lint && bun run test && bash scripts/check-architecture.sh`
- 單檔測試: `bunx vitest run <path>`
- 重新跑 evaluator: `/sprint-contract evaluate`
- 重新跑此 skill: `/harness:handoff` 或 `/harness:handoff <target-dir>`
