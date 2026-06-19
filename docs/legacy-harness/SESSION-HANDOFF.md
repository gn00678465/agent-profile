# Session Handoff

> **Role**: Narrative handoff for the incoming session/agent. Latest round only — previous round's narrative is replaced on every write.

## Last Session: 2026-05-03

### 當前已驗證

2026-05-03 — typecheck: 0 errors | lint: 0 errors / 0 warnings | full suite: 409 passed (27 files; 378 baseline + 31 new) | arch: 0 violations | build: renderer + main + preload all OK | F1=10 | F2=9 | C1=C2=0 | D1=D2=D3=0 | D4=17 | D5=14 | D6=7 | R1=18 | R2=R3=0 vs feat-018 baseline f79716e | RC1-RC7 all green | M1-M14 + m4-no-binary auto-captured PNGs (27-94 KB).

**Evaluator verdict (round-3)**: ACCEPT 27/30 — Correctness 5/5, Verification 5/5, Scope Discipline 3/5, Reliability 5/5, Maintainability 5/5, Handoff Readiness 4/5.

### 本輪改動

**feat-019 round-3 patch — DV5/L4/RC7/S1-8 sprint contract 修正 + delete via cliRunner CLI uninstall**

#### 動因
- 使用者問「marketplace 的 auto-update Switch 沒反應」→ 確認是 controlled prop 沒接 onChange，feat-019 scope 沒涵蓋 CLI 寫入路徑 (DV4/FC3 forward-compat) → 改全部 read-only + 標籤 + tooltip + 加 feat-020 placeholder。
- 使用者問「delete plugin 是直接刪資料夾還是走 CLI」→ 確認原本是 fs.rm + JSON cleanup，bypass CLI cache + uninstall hook + multi-scope registry，又會誤刪 directory-source plugin 的源頭專案根目錄。決定 mid-flight patch sprint contract 改走 CLI。

#### 核心改動 (commit `3f51465`)
1. **claudePluginsDelete.ts (新, 77 行)** — 獨立模組，避免 claudePluginsHandler 超過 400-line maintainability cap。`deletePlugin(configDir, pluginId, installPath, opts)` 預設 spawn `claude plugin uninstall <id> --scope <scope>` (走 cliRunner 既有 L4 token)；CLI 失敗或 `opts.fileFallback:true` 走 `deletePluginFile` fallback。Fallback 加 share-check：若另一筆 install record 還 reference 同一 installPath（sentry-skills/harness 跨 project 共用 cache 場景）→ 不做 `fs.rm`，避免 dangle sibling install。
2. **claudePluginsHandler.ts** — 從 456 → 380 行：刪除 inline deletePlugin/deletePluginFile，import from `claudePluginsDelete`。
3. **preload `config.deletePlugin`** — 簽章加 `opts: { scope?, fileFallback? }`，回 `{ via: 'cli'|'file', cli?: { stdout?, stderr? } }` envelope。
4. **InstalledTab.handleDelete** — 加 directory-source heuristic（installPath 不含 `plugins/cache/` 片段 → 視為 directory-source）；對 directory-source 顯示警告 confirm（"installPath 是你的源頭專案，CLI 只 unregister 不刪實體目錄"）+ 自動 `fileFallback:true`；toast 顯示 `via CLI` 或 `via local file delete`。
5. **Tests +3 → 409 total**：
   - cliRunner.test.ts (c2): whitelist `plugin uninstall <id> --scope <scope>`
   - claudePluginsHandler.test.ts (f): DELETE_PLUGIN 預設 delegate cliRunner.runPluginUninstall
   - claudePluginsHandler.test.ts (g): fileFallback:true 跳過 CLI 走 file-delete

#### Sprint contract patch (commit `3f51465`)
- DV5 縮限為 enable/disable **only**（delete 移出）
- 新增 DV6：delete 預設走 CLI；file fallback 條件
- 新增 RC7：3-branch 行為 (CLI success / fallback with share-check / directory-source assertSafePath protection)
- 新增 S1-8：deletePlugin handler scope 描述
- L4 token `plugin uninstall` 註解為實際使用 (was "S1-6 only")
- S3 test count 27 → 30；V3 threshold 405 → 408
- Phase D gate 同步

#### 重評流程
- ContractBaselineHash mismatch (`3887f7ce…` → `11d018e6…`) → `/sprint-contract evaluate` 自動跳回 Phase 2 regenerate rubric → Phase 3 評分 → ACCEPT 27/30
- feat-019 status flip planned → done with 完整 evidence string

#### 旁支
- **dee0a15** — auto-update Switch 改 read-only + feat-020 placeholder
- **6cd60b4** — `docs/claude/claude-plugin.md` 11-section 開發者指南（系統概觀 / 型別速查 / IPC channels / cliRunner SOP / 邊界情況 / 截圖自動化 / 官方功能對照）
- **de961a8** — round-2 end-of-session handoff
- 分支正名：原本 feat-019 不小心做在 `feature/initial-agent-profile`，從 round-2 開始遷到 `feature/feat-019` (strict superset)；`feature/initial-agent-profile` 待 PR merge 後刪除
- **PR #2 開於 feature/feat-019 → main** (https://github.com/gn00678465/agent-profile/pull/2)

### 仍損壞或未驗證

- **Scope Discipline 3/5** — `scripts/capture-evidence.cjs` (379 行 CDP 截圖驅動)、`docs/claude/claude-plugin.md` (406 行開發者指南)、`eslint.config.mjs` +2 行 ignore — 三者皆 documented out-of-whitelist。要拿 5/5 需擴 sprint contract Exclusions 白名單或寫 ADR formal exception。capture script 兼有「feat-016 E2E 解封」副作用 (`connectOverCDP` 取代 `_electron.launch()`)，值得保留。
- **feat-020** (auto-update CLI write path) — `planned`，等 feat-019 PR merge 後排程。
- **feat-016 E2E** — 仍正式 blocked，但 `connectOverCDP` 在 capture-evidence.cjs 證明可行；`e2e/fixtures.ts` 可 refactor 解封。
- **feat/018-notion-ui branch** — 仍待 merge 回 main（從 round-2 沿用）。
- **Dark mode CTA contrast** — `#62aef0` 對 `#ffffff` = 2.22:1 < 3:1（從 round-2 沿用）。

### 下一步最佳動作

1. **Merge PR #2** (`feature/feat-019` → `main`) — feat-019 ACCEPT 27/30 + handoff 同步完成 + 所有 gate 綠。
2. **Merge 後刪舊分支** — `git push origin --delete feature/initial-agent-profile` + `git branch -D feature/initial-agent-profile`（內容已是 feat/feat-019 的子集）。
3. **後續 feature 排程**：
   - feat-020 — auto-update flag CLI write path + L4 patch + 重評
   - feat-021（提案）— 把 capture-evidence.cjs CDP 模式正式化為 e2e/fixtures.ts，解封 feat-016
   - dark mode CTA contrast (`#62aef0` → 更深變體達 3:1)
   - feat/018-notion-ui merge 回 main
   - Optional：寫 ADR-0008 formal-exception 給 evidence-capture infra，把 Scope Discipline 推到 5/5

**不要動**：
- 已 ACCEPT 的 evidence 凍結；不再修 evidence/feat-019/ 內容
- sprint-contract.md / evaluator-rubric.md round-3 版本是 canonical
- 31 new tests + 27 test files

### 命令

- 啟動: `bun run dev`
- 驗證: `bun run typecheck && bun run lint && bun run test && bash scripts/check-architecture.sh`
- 截圖重抓: `bun run build && node scripts/capture-evidence.cjs`
- 重評: `/sprint-contract evaluate` (ContractBaselineHash 驅動 stale 偵測)
- PR 狀態: `gh pr view 2`
- Merge: `gh pr merge 2 --squash` (PR #2)
