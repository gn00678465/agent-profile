# Evaluator Rubric

**ContractBaselineHash**: 3887f7ce8f1416074f6b0a1228fe94a4a612e3e8713d0a57b9d555f860c79253
**Topic**: feat-019 — Claude 外掛頁面重構（對齊官方 plugin 模型 + CLI 整合 + Notion 設計系統）
**Phase**: TEMPLATE
**Negotiation Round**: 1 / 3
**Generated**: 2026-05-03

> 本 rubric 由 Sprint Contract（ACCEPTED, Round 1, regenerated v0）派生。
> 上一輪（feat-019 第一輪）rubric 歸檔於 `evidence/feat-019/evaluator-rubric-round1.md`，與本檔無關。
> 6 dimensions × 5 verdict thresholds × concrete contract-anchored criteria。
> 本任務 Scope 含 `.tsx` UI 重構（S2-1~S2-8）→ 已套用 ui-detection.md Phase 2 addendum：Correctness 含 6 視覺 sub-criteria + screenshot 證據要求。

---

## Verdict Thresholds（固定，照抄）

每個 dimension 評 0–5 分整數：

| Score | 含義 |
|-------|------|
| 5 | 全部 criteria PASS，evidence 完整且可驗證 |
| 4 | 全部 criteria PASS，但 evidence 有 1 項格式問題（不影響結論） |
| 3 | criteria 大致 PASS，但 1 項 minor FAIL 或 evidence 不完整 |
| 2 | criteria 部分 PASS，evidence 證明 partial implementation |
| 1 | criteria 大多 FAIL 或 evidence 缺失嚴重 |
| 0 | criteria 全 FAIL 或無 evidence |

**Overall verdict thresholds**：

| 平均分 | Overall |
|--------|---------|
| ≥ 4.0 且每 dimension ≥ 3 | APPROVED |
| ≥ 3.0 且 0 dimension ≤ 1 | APPROVED_WITH_FIXES |
| 其他 | REJECTED |

---

## Dimension 1：Correctness

**Source**: Sprint Contract Scope (S0–S4) + Verification Standards (V/F/C/D) + Lock-in Tables (L1–L7)

### Criteria

#### 行為 / 後端 / 文件（從 Scope + V/F/C 派生）

1. **S0-1 研究文件齊備**：`docs/CLAUDE_PLUGIN_LAYOUT.md` 存在且含 7 章節，每章節 ≥ 12 行非空內容；`wc -l docs/CLAUDE_PLUGIN_LAYOUT.md` ≥ 84
2. **S1-1 型別擴充**：`src/shared/types.ts` 含 `ClaudePlugin`（擴充 description/author/homepage/repository/license/category/components）、`ClaudeMarketplace`、`ClaudeMarketplaceSource`（discriminated union 涵蓋 L5 全 5 種 source）、`ClaudePluginDiscoveryItem`、`ClaudePluginError`、`CliRunResult` 全部存在
3. **S1-2 IPC channels 9 個常數齊全**：F1 = `grep -nE "CLAUDE_(CLI|PLUGINS)_" src/shared/types.ts | wc -l` ≥ 9，且通道字串與 L1 表格一一對應（`CONFIG_GET_CLAUDE_MARKETPLACES` / `CONFIG_GET_CLAUDE_PLUGIN_DISCOVERY` / `CONFIG_GET_CLAUDE_PLUGIN_ERRORS` / `CLAUDE_CLI_MARKETPLACE_ADD` / `CLAUDE_CLI_MARKETPLACE_REMOVE` / `CLAUDE_CLI_MARKETPLACE_UPDATE` / `CLAUDE_CLI_PLUGIN_INSTALL` / `CLAUDE_CLI_PLUGIN_UNINSTALL` / `CLAUDE_CLI_RELOAD`）
4. **S1-3 preload binding 完整**：F2 = `grep -nE "claudeCli\.|config\.(getClaudeMarketplaces|getClaudePluginDiscovery|getClaudePluginErrors)" src/preload/index.ts` ≥ 9 行（claudeCli 命名空間 ≥ 6 + config 命名空間 ≥ 3）
5. **S1-4 claudePluginsHandler 5 讀 handler**：含 `getPlugins / getMarketplaces / getDiscovery / getErrors / readPluginManifest`；`claudePluginsHandler.test.ts` 5 case 全綠（F3）
6. **S1-5 cliRunner 安全約束**：`shell: false`（C1 = 0 matches）、無 `exec/execSync`（C2 = 0 matches）、白名單 11 條 token 模式（L4）、git URL regex（L6）、`assertSafeName` for marketplace 名 / plugin id / scope、timeout 60s + SIGTERM/SIGKILL、binary 偵測 PE1 + L7（Windows `where claude` / macOS Linux `which claude`）
7. **S1-6 cliRunner 6 個 CLI handler**：`marketplaceAdd / marketplaceRemove / marketplaceUpdate / pluginInstall / pluginUninstall / reload` 全部委派至 cliRunner 並回 `IpcResponse<CliRunResult>`；C3+C4+C5 全綠（cliRunner.test.ts 6 case 全綠，F4）
8. **S1-7 orchestrator 註冊正確**：`configHandlers.ts` 註冊新 handler；`claudeHandler.ts` 移除被搬走的 plugin handler 區塊（保留 settings / agents / sessions / rules / skills）

#### UI / 視覺（從 S2 + D + ui-detection.md Phase 2 addendum 派生）

9. **S2-1 4-tab router 落地**：`ClaudePlugins.tsx` 重構為 router；採用 `@/components/ui/tabs`；4 個 trigger（L2）`installed` / `marketplaces` / `discover` / `errors` 全部存在；無 `SCOPE_COLORS` 硬寫色與 inline `minWidth/maxWidth`（D3 = 0 matches）
10. **S2-2 ~ S2-7 6 個新元件齊備**：`ClaudePlugins/{InstalledTab,MarketplacesTab,DiscoverTab,ErrorsTab,MarketplaceDialog,PluginManifestPanel}.tsx` 6 檔皆存在
11. **S2-8 設計系統合規（D1–D6 全綠）**：
    - D1 = 0 matches（無硬寫 Tailwind 顏色 class）
    - D2 = 0 matches（無 `border-[#…]` 或 `borderColor: '#…'`）
    - D3 = 0 matches（無 inline minWidth/maxWidth 數字）
    - D4 ≥ 5（`badge-notion` 出現 ≥ 5 次）
    - D5 ≥ 4（`shadow-notion-card` 或 `border-whisper` 合計 ≥ 4 次）
    - D6 ≥ 6（每個新元件 ≥ 1 個 import 自 `@/components/ui/`，6 檔皆 match）
12. **視覺 sub-criteria（每張 M1–M14 截圖必附 `m{N}.notes.md`）**：
    - (a) Text alignment / typography 對齊 DESIGN.md §3：每張 PASS/FAIL/N/A
    - (b) Element hierarchy / z-index 採 feat-018 token：每張 PASS/FAIL/N/A
    - (c) Spacing & padding（8px 系列）：每張 PASS/FAIL/N/A
    - (d) Interactive states（default/hover/focus/active/disabled）：M7–M11 必含 PASS/FAIL，其他 N/A 可
    - (e) Empty / loading / error states：M12–M14 必含 PASS/FAIL
    - (f) Responsive behavior：合約鎖定 1280×800 桌面，全部 N/A
13. **截圖 evidence 完整**：M1–M14 各一張 PNG + `.notes.md`；M4 額外含 `m4-no-binary.png`；存於 `evidence/feat-019/`

### Evidence Required

- `evidence/feat-019/v1-typecheck.txt` — V1 stdout（`bun run typecheck`，exit 0）
- `evidence/feat-019/v2-lint.txt` — V2 stdout（`bun run lint`，0 errors / 0 warnings）
- `evidence/feat-019/v3-test.txt` — V3 stdout（`bun run test`，≥ 405 tests，新增 ≥ 27）
- `evidence/feat-019/v4-arch.txt` — V4 stdout（`bash scripts/check-architecture.sh`，0 violations）
- `evidence/feat-019/v5-build.txt` — V5 stdout（renderer + main + preload 全成功，未截斷）
- `evidence/feat-019/f-ipc-grep.txt` — F1–F4 grep 輸出
- `evidence/feat-019/c-cli-failures.txt` — C1–C5 + cliRunner 6 case 完整輸出
- `evidence/feat-019/d-design-grep.txt` — D1–D6 grep 輸出
- `evidence/feat-019/s0-doc-wc.txt` — 七章節 wc -l 結果（每章節 ≥ 12 行）
- `evidence/feat-019/m{1..14}.png` + `evidence/feat-019/m{1..14}.notes.md` — 視覺 sub-criteria 完整 PASS/FAIL/N/A
- `evidence/feat-019/m4-no-binary.png` — 無 claude binary 場景

(filled during Phase 3)

### Score: ___ / 5

---

## Dimension 2：Verification

**Source**: Sprint Contract Verification Standards（V/F/C/D/M/R）+ Evidence Plan

### Checks

1. **V1 typecheck**：`bun run typecheck` exit 0 / 0 errors；evidence `v1-typecheck.txt` 含完整 stdout
2. **V2 lint**：`bun run lint` exit 0 / **0 errors / 0 warnings**；evidence `v2-lint.txt`
3. **V3 test**：`bun run test` 通過；測試總數 ≥ 405；新增測試合計 ≥ 27 case；不得新增失敗；evidence `v3-test.txt` 含逐檔 case 數
4. **V4 architecture**：`bash scripts/check-architecture.sh` 0 boundary violations；evidence `v4-arch.txt`
5. **V5 build**：`bun run build` 三段（renderer + main + preload）全成功；mtime 對齊；evidence `v5-build.txt` 不得截斷
6. **F1 IPC channels**：`grep -nE "CLAUDE_(CLI|PLUGINS)_" src/shared/types.ts | wc -l` ≥ 9；evidence `f-ipc-grep.txt`
7. **F2 preload binding**：`grep -nE "claudeCli\.|config\.(getClaudeMarketplaces|getClaudePluginDiscovery|getClaudePluginErrors)" src/preload/index.ts` ≥ 9 行
8. **F3 claudePluginsHandler test**：`bunx vitest run src/main/ipc/__tests__/claudePluginsHandler.test.ts` 全綠；含 5 case 完整輸出
9. **F4 cliRunner test**：`bunx vitest run src/main/ipc/__tests__/cliRunner.test.ts` 全綠；含 6 case 完整輸出
10. **C1 no shell:true**：`grep -nE "spawn\(.*shell\s*:\s*true" src/main/ipc/handlers/cliRunner.ts` = 0 matches
11. **C2 no exec/execSync**：`grep -nE "(^|[^a-zA-Z_])(exec|execSync)\(" src/main/ipc/handlers/cliRunner.ts` = 0 matches
12. **C3 whitelist enforcement**：cliRunner.test.ts case (c) 證明非白名單指令拒絕
13. **C4 unsafe input rejection**：cliRunner.test.ts case (d)+(e) 證明 `assertSafeName` + git URL regex 攔截
14. **C5 binary detection**：cliRunner.test.ts case (a) 證明 binary 不存在時回 `success:false` + 含 `claude CLI not found`
15. **D1 no Tailwind palette**：D1 grep = 0 matches（涵蓋 17 色 × 9 階 × `bg/text/border` × opacity 變體）
16. **D2 no inline hex border**：D2 grep = 0 matches
17. **D3 no inline width**：D3 grep = 0 matches
18. **D4 badge-notion ≥ 5**：D4 grep ≥ 5 matches
19. **D5 shadow/border tokens ≥ 4**：D5 grep ≥ 4 matches
20. **D6 ui/* import ≥ 6**：每個新元件 ≥ 1 個 import 自 `@/components/ui/{button,card,tabs,switch,dialog,select,scroll-area}`
21. **M1–M14 14 張截圖 + 14 個 .notes.md**：每個 .notes.md 含 6 視覺 sub-criteria PASS/FAIL/N/A（responsive = N/A 已鎖定）
22. **M4 無 binary 場景補充截圖**：`m4-no-binary.png` 存在
23. **R1–R5 回歸保護全綠**：(R1) feat-001~018 status 不被改動 / (R2) feat-018 token 數值不被改動 / (R3) E2E_BLOCKED.md 不被改動 / (R4) ExtensionRow.test.tsx `bg-accent/60` 斷言通過 / (R5) ClaudePlugins.test.tsx 既有 4 case 不刪不改

### Evidence Required

- `evidence/feat-019/v{1..5}-*.txt` — V1–V5 stdout
- `evidence/feat-019/f-ipc-grep.txt` — F1–F4
- `evidence/feat-019/c-cli-failures.txt` — C1–C5 + cliRunner 6 case 完整輸出
- `evidence/feat-019/d-design-grep.txt` — D1–D6
- `evidence/feat-019/m{1..14}.png` + `m{1..14}.notes.md` — 含 6 sub-criteria PASS/FAIL/N/A
- `evidence/feat-019/m4-no-binary.png`
- `evidence/feat-019/r{1..5}-*.txt` — R1–R5 stdout

(filled during Phase 3)

### Score: ___ / 5

---

## Dimension 3：Scope Discipline

**Source**: Sprint Contract Scope（S0–S4 白名單）+ Exclusions

### Boundary Rules

1. **白名單檔案範圍**：`git diff main...feat-019-impl --stat` 只觸及以下白名單目錄/檔案：
   - `docs/CLAUDE_PLUGIN_LAYOUT.md`（新）
   - `src/shared/types.ts`
   - `src/preload/index.ts`
   - `src/main/ipc/configHandlers.ts`
   - `src/main/ipc/handlers/claudeHandler.ts`
   - `src/main/ipc/handlers/claudePluginsHandler.ts`（新）
   - `src/main/ipc/handlers/cliRunner.ts`（新）
   - `src/main/ipc/__tests__/cliRunner.test.ts`（新）
   - `src/main/ipc/__tests__/claudePluginsHandler.test.ts`（新）
   - `src/renderer/components/agents/ClaudePlugins.tsx`
   - `src/renderer/components/agents/ClaudePlugins/{InstalledTab,MarketplacesTab,DiscoverTab,ErrorsTab,MarketplaceDialog,PluginManifestPanel}.tsx`（新 6 檔）
   - `src/renderer/components/agents/__tests__/{ClaudePlugins,MarketplacesTab,DiscoverTab,ErrorsTab,MarketplaceDialog}.test.tsx`
   - `feature_list.json` / `progress.md` / `session-log.jsonl` / `session-handoff.md`
   - `AGENTS.md`（S4-5 新段落）
   - `evidence/feat-019/**`
2. **不改動其他 handler**：`{geminiHandler,copilotHandler,mcpHandler,skillsHandler,rulesHandler,markdownHandler,agentsHandler,configUtils}.ts` 全部 0 改動
3. **不改動其他 agent UI**：`{GeminiExtensions.tsx,SubagentsEditor.tsx,ClaudeSessionsView.tsx,GeminiSessionsView.tsx,CopilotSessionsView.tsx,SessionsView.tsx,ClaudePlugins/FilterToolbar.tsx}` 全部 0 改動
4. **不改動共用 UI 與設定**：`src/renderer/components/{layout,editors,shared,ui}/**`、`src/renderer/{App.tsx,main.tsx,index.css}`、`src/renderer/{hooks,lib}/**`、`tailwind.config.js`、`src/test/setup.ts` 全部 0 改動
5. **不改動其他文件 / 設定 / E2E**：`docs/{ARCHITECTURE.md,DESIGN.md,E2E_BLOCKED.md,PRODUCT.md}`、`scripts/check-architecture.sh`、`init.sh`、`package.json`、`tsconfig*.json`、`vite.config.ts`、`playwright.config.ts`、`e2e/**` 全部 0 改動
6. **無新 npm 套件**：`package.json` 與 `bun.lock` 不被改動（marketplace.json = JSON，無需 Octokit / git client / yaml parser）
7. **不擴 scope**：未實作 LSP code-intelligence diagnostics、Plugin developer mode、Plugin 提交 UI、managed scope 編輯、background monitor 觸發
8. **不新增 E2E**：`e2e/**` 0 改動；feat-016 仍 blocked
9. **單一 feature**：feat-001~018 status / evidence 維持不變；feat-019 為唯一變動 entry（R1）

### Evidence Required

- `evidence/feat-019/scope-diff.txt` — `git diff main...feat-019-impl --stat` 完整輸出
- `evidence/feat-019/r1-feature-list-status.txt` — feat-001~018 status 全為 done（≥ 18）
- `evidence/feat-019/r2-design-tokens.txt` — `git diff <feat-018-baseline-sha> -- src/renderer/index.css tailwind.config.js | wc -l` = 0
- `evidence/feat-019/r3-e2e-blocked.txt` — `git diff main -- docs/E2E_BLOCKED.md | wc -l` = 0

(filled during Phase 3)

### Score: ___ / 5

---

## Dimension 4：Reliability

**Source**: Sprint Contract Reliability Checks（RC1–RC6, with Sources）+ Verification Standards + Commitment Gates（ordering criterion）

### Restart / Re-run Scenarios

1. **RC1：claude binary 不在 PATH** — cliRunner 偵測階段直接 return `{ success: false, error: "claude CLI not found in PATH; install via instructions at https://code.claude.com/docs/zh-TW/setup" }`；Errors tab 顯示同訊息；其他 tab 仍可顯示已快取資料。
   **Source**: https://code.claude.com/docs/zh-TW/discover-plugins § Troubleshooting
2. **RC2：`installed_plugins.json` 不存在** — handler 回 `{ success: true, data: [] }`（缺檔視為空集合，不拋）。
   **Source**: `AGENTS.md` IPC envelope 規則「Never throw across the IPC boundary」
3. **RC3：`installed_plugins.json` JSON 損毀** — handler 捕 `SyntaxError` → 回 `{ success: false, error }`；Errors tab 顯示一筆 `{ scope: 'plugin', severity: 'error', message: <SyntaxError.message>, raisedAt: <ISO> }`；其他 tab 不阻塞。
   **Source**: `AGENTS.md` IPC envelope 規則
4. **RC4：CLI 執行 timeout（60s）** — cliRunner 對 child process 發 `SIGTERM`，等 5s 仍存活則 `SIGKILL`；回 `{ success: false, error: "claude CLI timeout (60s)", stdout, stderr }`；UI toast 顯示「CLI timed out」。
   **Source**: `AGENTS.md` Working Rules「IPC envelope. Every IPC handler returns ... Never throw across the IPC boundary」
5. **RC5：MarketplaceDialog 輸入 unsafe 名稱（`..` / `;`）** — `assertSafeName` throw → cliRunner catch 回 `{ success: false, error: "invalid marketplace name: <reason>" }`；CLI 不 spawn；Errors tab 不寫入；toast 顯示。
   **Source**: `AGENTS.md` Working Rules「Always call assertSafePath / assertSafeName for renderer-supplied inputs」
6. **RC6：known_marketplaces.json 與 settings.json#extraKnownMarketplaces 衝突** — handler 以 `known_marketplaces.json` 為準（CLI 寫優先），`extraKnownMarketplaces` 視為待註冊；UI 顯示 warn pill「unsynced」+「Sync」按鈕。
   **Source**: https://code.claude.com/docs/zh-TW/discover-plugins § 配置團隊市場

#### Cross-cutting check：**Commitment ordering**

7. **Commitment ordering（強制）**：
   - **Phase A→B→C→D→E ordering**：依 Phase 排序表，A（S0-1 文件）→ B（S1-* 後端）→ C（S2-* 渲染器 UI）→ D（S3-* 測試）→ E（S4-* commitment + AGENTS.md）每 Phase commit time 必須遞增；以 `git log` 檢查每 Phase 對應 commit 的 timestamp 順序
   - **Commitment edit time > Gate evidence time**：4 個 commitment 檔（`feature_list.json` feat-019 status flip + `progress.md` + `session-log.jsonl` + `session-handoff.md`）的編輯 timestamp（mtime 或 commit time）必須**嚴格晚於**所有對應 Gate evidence file（V1–V5 + F1–F4 + C1–C5 + D1–D6 + M1–M14 + R1–R5 + RC1–RC6）的 mtime
   - **Inheritance**：第 2/3/4 列 commitment 各自 inherit 第一列 Gate 全集；mtime 嚴格遞增（Gate evidence < `feature_list.json` < `progress.md` < `session-log.jsonl` < `session-handoff.md`）
   - **Failure handling**：任一驗證項在 status flip 後失敗 → 同一 session 內 revert flip 並 `git checkout HEAD -- session-handoff.md`，於 `progress.md` 追加一行記錄

### Evidence Required

- `evidence/feat-019/rc-1.txt` — RC1 reproduce log（cliRunner.test.ts case (a) 子集 OR 手動 reproduce）
- `evidence/feat-019/rc-2.txt` — RC2（claudePluginsHandler.test.ts case (b)）
- `evidence/feat-019/rc-3.txt` — RC3（claudePluginsHandler.test.ts case (c)）
- `evidence/feat-019/rc-4.txt` — RC4（cliRunner.test.ts case (b) timeout 子集）
- `evidence/feat-019/rc-5.txt` — RC5（cliRunner.test.ts case (d)）
- `evidence/feat-019/rc-6.txt` — RC6 reproduce log
- `evidence/feat-019/commitment-ordering.txt` — `git log --pretty=format:"%h %cI %s"` + Phase A→E commit 對應表 + evidence file mtime 排序表
- `evidence/feat-019/c-cli-failures.txt` — cliRunner 失敗路徑 6 case 全綠

(filled during Phase 3)

### Score: ___ / 5

---

## Dimension 5：Maintainability

**Source**: Sprint Contract Evidence Plan + Requirement Sources

### Criteria

1. **研究文件完整且可追溯**：`docs/CLAUDE_PLUGIN_LAYOUT.md` 七章節皆 ≥ 12 行；每章節對應 Requirement Sources 中的 URL / 路徑；`evidence/feat-019/s0-doc-wc.txt` 含 wc -l 證據
2. **檔案規模控制**：`wc -l src/main/ipc/handlers/{claudePluginsHandler,cliRunner}.ts` 各檔 ≤ 400 行（符合 coding-style「200-400 lines typical, 800 max」）
3. **AGENTS.md 新段落控制**：S4-5 新增段落「Claude Plugins / CLI Runner — 規則」≤ 30 行；說明 cliRunner 白名單、git URL regex、binary 偵測機制
4. **Requirement Sources 永續性**：合約 Requirement Sources 中所有 URL（https://code.claude.com/...）與檔案路徑（`~/.claude/...`、`feature_list.json`、`AGENTS.md`、`DESIGN.md`、`evidence/feat-019/sprint-contract-round1.md`）於 implementation 階段不被刪除或遷移
5. **Evidence Plan 完整佈署**：`evidence/feat-019/` 目錄包含 V/F/C/D/M/R/RC + commitment ordering 全部對應檔；命名規律一致（`v1-typecheck.txt` / `f-ipc-grep.txt` / `m{N}.png` / `m{N}.notes.md` / `rc-{N}.txt`）
6. **沿用既有 token / primitive，無重新發明**：所有新元件 import `@/components/ui/{button,card,tabs,switch,dialog,select,scroll-area}`（D6）；採用 `badge-notion` / `border-whisper` / `shadow-notion-card` / `bg-card`（D4–D5），不引入新色或新元件 primitive
7. **Forward-compat 鋪墊存在**：FC1–FC4（LSP diagnostics / plugin developer mode / json 解析 / enable-disable CLI）的單點變更位置在實作中可辨識（例：`parseCliOutput()` 函式集中於 cliRunner，FC3 切換點明確）

### Evidence Required

- `evidence/feat-019/s0-doc-wc.txt` — 七章節 wc -l 結果
- `evidence/feat-019/file-size.txt` — `wc -l src/main/ipc/handlers/{claudePluginsHandler,cliRunner}.ts`
- `evidence/feat-019/agents-md-section.txt` — `AGENTS.md` 新段落行數（≤ 30）
- `evidence/feat-019/evidence-tree.txt` — `ls -la evidence/feat-019/` 完整列舉

(filled during Phase 3)

### Score: ___ / 5

---

## Dimension 6：Handoff Readiness

**Source**: Sprint Contract Scope deliverables + git/context locator
**重要**：依 ADR-0005，本 dimension 只查交付物存在性與定位，**不評**文件內文品質。

### Deliverable Checks（5 條，無 prose-quality 條目）

1. **`evidence/feat-019/` 目錄存在且包含 V/F/C/D/M/R/RC 各項對應檔**：以 Glob `evidence/feat-019/**` 列舉，至少含：
   - `v{1..5}-*.txt`（V1–V5）
   - `f-ipc-grep.txt`（F1–F4）
   - `c-cli-failures.txt`（C1–C5）
   - `d-design-grep.txt`（D1–D6）
   - `m{1..14}.png` + `m{1..14}.notes.md`、`m4-no-binary.png`
   - `r{1..5}-*.txt`（R1–R5）
   - `rc-{1..6}.txt`（RC1–RC6）
   - `s0-doc-wc.txt`、`scope-diff.txt`、`commitment-ordering.txt`
2. **`feature_list.json` feat-019 狀態翻轉**：feat-019 entry 的 `"status": "done"` 字串非空；`"evidence"` 字串非空（具體驗證輸出位置）；feat-001~018 status 維持 `done`
3. **三個 handoff 檔皆已被 git 追蹤**：`progress.md` / `session-log.jsonl` / `session-handoff.md` 三檔皆於 `git ls-files` 列出，且本 session 都有 commit 記錄
4. **git working tree state**：`git status` 除 4 個 handoff 檔（`feature_list.json` / `progress.md` / `session-log.jsonl` / `session-handoff.md`）+ 對應 commit 外為 clean；無 untracked 雜項；無 stash 殘留
5. **關鍵 context locator 可被找到**：`AGENTS.md`（S4-5 新段落）與 `docs/CLAUDE_PLUGIN_LAYOUT.md` 兩個檔案路徑皆可被 `Glob` 找到（`Glob "AGENTS.md"`、`Glob "docs/CLAUDE_PLUGIN_LAYOUT.md"` 各回 1 結果）

### Evidence Required

- `evidence/feat-019/handoff-tree.txt` — `ls -la evidence/feat-019/` + `Glob "evidence/feat-019/**"` 列舉
- `evidence/feat-019/handoff-feature-list.txt` — `grep -A2 "feat-019" feature_list.json` 顯示 status=done + evidence 非空
- `evidence/feat-019/handoff-git-status.txt` — `git status --porcelain` 證明 clean（除 4 檔 commit 外）
- `evidence/feat-019/handoff-tracked.txt` — `git ls-files progress.md session-log.jsonl session-handoff.md AGENTS.md docs/CLAUDE_PLUGIN_LAYOUT.md`

(filled during Phase 3)

### Score: ___ / 5

---

## Final Verdict（filled during Phase 3）

| Dimension | Score |
|-----------|-------|
| Correctness | ___ / 5 |
| Verification | ___ / 5 |
| Scope Discipline | ___ / 5 |
| Reliability | ___ / 5 |
| Maintainability | ___ / 5 |
| Handoff Readiness | ___ / 5 |
| **Average** | ___ / 5 |
| **Overall** | APPROVED / APPROVED_WITH_FIXES / REJECTED |

### Required Fixes（if any）

(filled during Phase 3)

### Notes

(filled during Phase 3)
