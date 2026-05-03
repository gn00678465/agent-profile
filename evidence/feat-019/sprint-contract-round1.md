# Sprint Contract

**Topic**: feat-019 — Claude 外掛頁面重構（對齊官方 plugin 模型 + CLI 整合 + Notion 設計系統）
**Date**: 2026-05-03
**Negotiation Round**: 2 / 3
**Status**: ACCEPTED

> 註：feat-018 合約已歸檔至 `evidence/feat-018/sprint-contract.md`，本檔重寫為 feat-019 內容。

## Requirement Sources

- `feature_list.json` feat-019 — 本任務唯一規格來源（研究前置 + [A] 4-tab 模型 + [B] CLI 整合 + [C] Notion 設計合規）
- https://code.claude.com/docs/zh-TW/plugins — plugin manifest schema：`.claude-plugin/plugin.json` 的 `name / version / description / author / homepage / repository / license`、components（skills/agents/hooks/.mcp.json/.lsp.json/monitors/bin/settings.json）目錄佈局
- https://code.claude.com/docs/zh-TW/discover-plugins — `/plugin` 互動式四分頁（Discover / Installed / Marketplaces / Errors）；`/plugin marketplace add|list|remove|update`、`/plugin install|uninstall|enable|disable`、`/reload-plugins`、`--scope user|project|local`、auto-update、官方市場 `claude-plugins-official` 為內建不可移除；錯誤類型（市場未載入 / 找不到檔案 / Executable not found in $PATH）
- `~/.claude/plugins/installed_plugins.json` 真實樣本（`version: 2`；`plugins["<name>@<marketplace>"]: Array<{ scope, installPath, version, installedAt, lastUpdated, gitCommitSha? }>`）
- `~/.claude/plugins/known_marketplaces.json` 真實樣本（`{ [name]: { source: { source: "github"|"directory"|"git"|"url", repo?, path?, url?, ref?, sha? }, installLocation, lastUpdated, autoUpdate? } }`）
- `~/.claude/settings.json` 真實鍵：`enabledPlugins: { "<id>@<marketplace>": boolean }`、`extraKnownMarketplaces: { [name]: { source, autoUpdate? } }`
- `~/.claude/plugins/marketplaces/<name>/.claude-plugin/marketplace.json` 真實樣本（`name / description / owner / plugins[]: { name, description, author?, category, source: { source, url?, repo?, path?, ref?, sha? }, homepage? }`）
- `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/.claude-plugin/plugin.json` 真實樣本（`name / version / description / author`）
- `DESIGN.md` — 視覺準繩（feat-018 已執行）：暖中性色盤、whisper border、Notion Blue `#0075de`、4-layer shadow、pill badge `9999px`、`shadow-notion-card`、`badge-notion`、`border-whisper`
- `AGENTS.md` — IPC envelope `{ success, data? } | { success: false, error }` 不可拋出；`assertSafePath` / `assertSafeName` 必須在所有 renderer-supplied input 落地；renderer 不得直接呼叫 Node API；測試以 `bun run test` 執行
- `src/renderer/components/agents/ClaudePlugins.tsx`（現況 243 行）— 單一清單 + 側邊 detail panel；硬寫 `bg-blue-500/20 / text-blue-400 / bg-amber-500/20`、inline `minWidth: 320, maxWidth: 360`、scope 僅 `user|project`
- `src/main/ipc/handlers/claudeHandler.ts` — 既有 `CONFIG_GET_CLAUDE_PLUGINS / CONFIG_SET_PLUGIN_ENABLED / CONFIG_DELETE_PLUGIN` 邏輯（讀 `installed_plugins.json` 合併 `enabledPlugins`）

## Scope

### S0. 研究文件（前置交付物）

- **S0-1**：新增 `docs/CLAUDE_PLUGIN_LAYOUT.md`，包含七個必備章節：
  1. `~/.claude/settings.json` plugin 鍵 schema（`enabledPlugins`、`extraKnownMarketplaces`）含實際範例
  2. `~/.claude/plugins/installed_plugins.json` v2 schema（plugin id 命名 `<name>@<marketplace>`、installs 陣列各欄位、與 enabledPlugins 的對應關係）
  3. `~/.claude/plugins/known_marketplaces.json` schema（5 種 source.source 列舉：`github` / `git` / `url` / `directory` / `git-subdir`、各自必要鍵、`installLocation` 用途、`autoUpdate` 預設規則）
  4. `~/.claude/plugins/marketplaces/<name>/.claude-plugin/marketplace.json` schema（`plugins[]` 陣列各欄位、與 cache 的關係）
  5. `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` 佈局（`.claude-plugin/plugin.json` 必有；`skills/`、`agents/`、`hooks/hooks.json`、`.mcp.json`、`.lsp.json`、`monitors/monitors.json`、`bin/`、`settings.json` 為選用）
  6. `~/.claude/plugins/{cache,marketplaces,repos,data,blocklist.json,config.json,install-counts-cache.json}` 各路徑用途（讀寫權限：`installed_plugins.json` 與 `known_marketplaces.json` 由 CLI 寫；UI 純讀）
  7. 邊界情況清單：缺檔（檔案不存在 → 視為空集合）、JSON 損毀（`SyntaxError` → 回 envelope error）、symlink（`installPath` 可為 symlink → 解析後再 `assertSafePath`）、未知 `source.source`（gracefully fallback 顯示 `unknown`）

### S1. 後端 IPC 與型別（main/preload/shared）

- **S1-1**：`src/shared/types.ts` 新增/擴充
  - 擴充 `ClaudePlugin`：`description?: string`、`author?: { name: string; email?: string; url?: string }`、`homepage?: string`、`repository?: string`、`license?: string`、`category?: string`、`components?: { skills: number; agents: number; hooks: number; mcp: boolean; lsp: boolean; monitors: number }`
  - 新增 `ClaudeMarketplace`：`{ name: string; source: ClaudeMarketplaceSource; installLocation: string; lastUpdated?: string; autoUpdate: boolean; isOfficial: boolean; pluginCount: number }`
  - 新增 `ClaudeMarketplaceSource` discriminated union：`{ source: 'github'; repo: string }` / `{ source: 'git' | 'git-subdir' | 'url'; url: string; path?: string; ref?: string; sha?: string }` / `{ source: 'directory'; path: string }`
  - 新增 `ClaudePluginDiscoveryItem`：`{ name: string; marketplace: string; description?: string; author?: { name: string; email?: string }; category?: string; homepage?: string; installed: boolean }`
  - 新增 `ClaudePluginError`：`{ scope: 'plugin' | 'marketplace' | 'cli'; targetId: string; severity: 'error' | 'warn'; message: string; raisedAt: string }`
  - 新增 `CliRunResult`：`{ success: boolean; exitCode?: number; stdout?: string; stderr?: string; error?: string }`
- **S1-2**：`IPC_CHANNELS` 新增 9 個常數（完整列舉於 Lock-in Tables L1）
- **S1-3**：`src/preload/index.ts` 在 `electronAPI.config` 與新增 `electronAPI.claudeCli` 命名空間下綁定 9 個方法（一對一對應 L1）
- **S1-4**：新增 `src/main/ipc/handlers/claudePluginsHandler.ts`（從 `claudeHandler.ts` 抽出 plugin 相關 handler 並擴充）— 共 5 個讀取 handler：getPlugins（回傳擴充 manifest）/ getMarketplaces / getDiscovery / getErrors / readPluginManifest
- **S1-5**：新增 `src/main/ipc/handlers/cliRunner.ts` — 唯一允許 spawn `claude` binary 之模組；以 array args 呼叫 `child_process.spawn`、不經 shell；明文白名單只接受 L4 列舉之 11 個指令；對所有使用者輸入跑 `assertSafeName`（marketplace 名 / plugin id / scope）或自訂 git URL 驗證（必須 `^https://` 或 `^git@` 或 `^github:owner/repo$`）；timeout 60s 觸發 `SIGTERM`，5s 後 `SIGKILL`；binary 偵測：Windows 用 `where claude`、其他平台用 `which claude`，未找到回 `success:false` + 錯誤訊息「claude CLI not found in PATH; install via instructions at https://code.claude.com/docs/zh-TW/setup」
- **S1-6**：`claudePluginsHandler.ts` 註冊 6 個 CLI handler：marketplaceAdd / marketplaceRemove / marketplaceUpdate / pluginInstall / pluginUninstall / reload — 全部委派至 `cliRunner`，回傳 `IpcResponse<CliRunResult>`
- **S1-7**：`src/main/ipc/configHandlers.ts` orchestrator 註冊新 handler；`src/main/ipc/handlers/claudeHandler.ts` 移除被搬走的 plugin handler 區塊（保留 settings / agents / sessions / rules / skills 等其他 Claude handler）

### S2. Renderer UI 重構

- **S2-1**：`src/renderer/components/agents/ClaudePlugins.tsx` 重構為 router 元件，內含 `<Tabs>`（採用既有 `src/renderer/components/ui/tabs.tsx` primitive）四個 trigger：`installed` / `marketplaces` / `discover` / `errors`；移除原 SCOPE_COLORS 硬寫色與 inline `minWidth/maxWidth`
- **S2-2**：新增 `src/renderer/components/agents/ClaudePlugins/InstalledTab.tsx`（重構自原本 list+detail）；保留 filter（all/user/project + 新增 local），新增 `PluginManifestPanel` 顯示 author/homepage/repository/license/components 計數
- **S2-3**：新增 `src/renderer/components/agents/ClaudePlugins/MarketplacesTab.tsx`：列出 `ClaudeMarketplace[]`、顯示 source 類型 pill badge、auto-update Switch、Update 與 Remove 按鈕（官方市場 Remove 按鈕 disabled 並顯示 tooltip「Built-in marketplace cannot be removed」）；右上角 `+ Add Marketplace` 按鈕觸發 dialog
- **S2-4**：新增 `src/renderer/components/agents/ClaudePlugins/DiscoverTab.tsx`：上方 marketplace selector（沿用 ui/select 或 tabs），下方列出 `ClaudePluginDiscoveryItem[]`；每項顯示 name / description / author / category badge / Install 按鈕；Install 按鈕點擊後彈出 scope chooser dialog（user/project/local），確認後呼叫 `pluginInstall` 並顯示 toast progress + stdout tail（最後 4 行）
- **S2-5**：新增 `src/renderer/components/agents/ClaudePlugins/ErrorsTab.tsx`：列出 `ClaudePluginError[]`；空狀態套用 `ExtensionListLayout` empty pattern
- **S2-6**：新增 `src/renderer/components/agents/ClaudePlugins/MarketplaceDialog.tsx`（採用既有 `src/renderer/components/ui/dialog.tsx`）：表單欄位 `marketplace name`（必填）+ `source type` radio 四選一（github / git / url / directory）+ 對應動態欄位（repo / url+path?+ref? / url / path）+ `auto-update` 開關；提交呼叫 `marketplaceAdd`
- **S2-7**：新增 `src/renderer/components/agents/ClaudePlugins/PluginManifestPanel.tsx`：顯示完整 manifest 欄位 + components 計數；採用 feat-018 token（`badge-notion`、`border-whisper`、`shadow-notion-card`、`bg-card`）
- **S2-8**：所有新檔案不得包含硬寫 Tailwind 顏色 class `bg-(blue|amber|green|red|orange|purple|pink|yellow|emerald|cyan|sky|indigo|violet|fuchsia|rose|teal|lime)-(50|100|200|300|400|500|600|700|800|900)(?:/\d+)?`；scope/category badge 一律使用 `.badge-notion` pill；borders 一律使用 `.border-whisper` 或 `border-border`

### S3. 測試（vitest + RTL）

- **S3-1**：新增 `src/main/ipc/__tests__/cliRunner.test.ts`：mock `child_process.spawn`，覆蓋 — (a) binary not found path、(b) timeout 後 SIGTERM、(c) 非白名單指令拒絕、(d) marketplace name 含 `..` / `;` 觸發 assertSafeName 拒絕、(e) git URL 不合法拒絕、(f) 成功 exit 0 回傳 stdout
- **S3-2**：新增 `src/main/ipc/__tests__/claudePluginsHandler.test.ts`：覆蓋 — (a) installed_plugins.json 正常解析（含 components 計數讀 plugin.json）、(b) installed_plugins.json 不存在 → 回空陣列、(c) installed_plugins.json 損毀 → 回 success:false、(d) getMarketplaces 合併 known_marketplaces.json + extraKnownMarketplaces.json、(e) getDiscovery 讀指定市場 marketplace.json 並標記 installed flag
- **S3-3**：更新 `src/renderer/components/agents/__tests__/ClaudePlugins.test.tsx`：覆蓋四個 tab 切換 + 既有 toggle/delete 行為仍可運作（保留原 4 個 test case 不刪除）
- **S3-4**：新增 `src/renderer/components/agents/__tests__/MarketplacesTab.test.tsx`、`DiscoverTab.test.tsx`、`ErrorsTab.test.tsx`、`MarketplaceDialog.test.tsx` — 各檔最少 3 case（render / 主要互動 / 邊界）

### S4. 狀態檔案更新（Commitment）

- **S4-1**：`feature_list.json` feat-019 由 `planned` 改為 `done`，`evidence` 填具體驗證輸出位置
- **S4-2**：`progress.md` 新增 feat-019 列；「上次 Session 結束點」改為本次完成
- **S4-3**：`session-log.jsonl` append 一行（執行日期）
- **S4-4**：`session-handoff.md` ▶ 下次 Session 區塊四欄全填

## Verification Standards

### V. 自動化（硬性）

- S1-S3 全部：`bun run typecheck` → exit 0 / 0 errors
- S1-S3 全部：`bun run lint` → exit 0 / **0 errors / 0 warnings**
- S1-S3 全部：`bun run test` → 較基線（feat-018 完成時 378 pass）僅可增加，不得新增失敗；新測試（S3-1~S3-4）合計 ≥ 25 case
- S1-S2 全部：`bash scripts/check-architecture.sh` → 0 boundary violations
- S1-S2 全部：`bun run build` → renderer + main + preload 三段全成功（mtime 對齊；evidence 不得截斷）

### F. 後端功能（每一條 IPC 必須證明可用）

- S1-2：`grep -nE "CLAUDE_(CLI|PLUGINS)_" src/shared/types.ts | wc -l` → ≥ 9
- S1-3：`grep -nE "claudeCli\.|config\.(getClaudeMarketplaces|getClaudePluginDiscovery|getClaudePluginErrors)" src/preload/index.ts` → 全部 9 個方法存在（`claudeCli.*` ≥ 6 行 + `config.getClaude(Marketplaces|PluginDiscovery|PluginErrors)` 共 3 行）
- S1-4：`bunx vitest run src/main/ipc/__tests__/claudePluginsHandler.test.ts` → 全綠；evidence 完整輸出
- S1-5：`bunx vitest run src/main/ipc/__tests__/cliRunner.test.ts` → 全綠；evidence 完整輸出

### C. CLI 整合安全性（針對 S1-5）

- C1：`grep -nE "spawn\\(.*shell\\s*:\\s*true" src/main/ipc/handlers/cliRunner.ts` → 空（禁止 `shell: true`）
- C2：`grep -nE "exec\\(|execSync\\(" src/main/ipc/handlers/cliRunner.ts` → 空（禁止 `exec`）
- C3：cliRunner.test.ts case (c) 證明非白名單指令被拒絕
- C4：cliRunner.test.ts case (d)+(e) 證明使用者輸入經 `assertSafeName` 與 git URL regex 驗證
- C5：cliRunner.test.ts case (a) 證明 binary 不存在時回 `success:false` + 含 `claude CLI not found` 訊息

### D. 設計合規（針對 S2，沿用 feat-018 token）

- D1：`grep -rnE "(bg|text|border)-(blue|amber|green|red|orange|purple|pink|yellow|emerald|cyan|sky|indigo|violet|fuchsia|rose|teal|lime)-(50|100|200|300|400|500|600|700|800|900)(/[0-9]+)?" src/renderer/components/agents/ClaudePlugins src/renderer/components/agents/ClaudePlugins.tsx` → 0 matches（覆蓋 `bg-` / `text-` / `border-` 三組前綴，含 `/數字` opacity 變體；現有原始碼 `bg-blue-500/20`、`text-blue-400`、`border-blue-500/30` 均屬本指令攔截範圍）
- D2：`grep -rnE "border-\[#|borderColor:\s*['\"]#" src/renderer/components/agents/ClaudePlugins src/renderer/components/agents/ClaudePlugins.tsx` → 0 matches
- D3：`grep -rnE "minWidth:\s*[0-9]|maxWidth:\s*[0-9]" src/renderer/components/agents/ClaudePlugins src/renderer/components/agents/ClaudePlugins.tsx` → 0 matches（detail panel 改用 token class）
- D4：所有 scope/category/source-type badge 套用 `.badge-notion` 類；`grep -rn "badge-notion" src/renderer/components/agents/ClaudePlugins` → ≥ 5 matches
- D5：所有 Card 套用 `shadow-notion-card`、`border-whisper`；`grep -rnE "shadow-notion-card|border-whisper" src/renderer/components/agents/ClaudePlugins` → ≥ 4 matches

### M. 手動 UI Spot-check（`bun run dev`，**Electron 桌面 1280×800 為唯一目標解析度；mobile / tablet 視口不在本次 scope，無響應式驗證**）

每張截圖（M1–M14）必須附 `evidence/feat-019/m{N}.notes.md`，內含**六個視覺 sub-criterion** 的 PASS/FAIL/N/A 與一句說明：(a) text alignment / typography 對齊 DESIGN.md §3、(b) element hierarchy 採 feat-018 token、(c) spacing & padding 採 8px 系列、(d) interactive states 行為符合本檢查項描述、(e) empty/loading/error states 符合本檢查項描述、(f) responsive behavior = N/A（已鎖定桌面）。

**主要流程**：

- M1：開啟 Claude → Plugins 頁面，看到四個 tab `Installed / Marketplaces / Discover / Errors`，預設 Installed 顯示已安裝清單
- M2：切到 Marketplaces，看到目前已註冊市場（樣本：`claude-plugins-official` 標 Built-in；其他市場顯示 source pill）
- M3：點 `+ Add Marketplace`，dialog 開啟；選 `directory` 類型，輸入合法路徑 `D:\Projects\harness-helper`；提交；toast 顯示成功；列表刷新出現新項
- M4：切到 Discover，選一個市場（任一）；看到 `ClaudePluginDiscoveryItem[]` 清單；點任一 Install；scope chooser 出現 user/project/local 三選；選 user → CLI 跑起來 → 結束後 toast 成功（若機器無 claude binary，則顯示「claude CLI not found」並不影響其他 tab）
- M5：切到 Errors，無錯誤時顯示 empty state（套用 `ExtensionListLayout` empty pattern）
- M6：對 Installed tab 隨意一個外掛點 toggle（disable）→ enabledPlugins JSON 寫入；重啟 dev 後狀態保留

**互動狀態（每項皆需在同一截圖內以 hover/focus 註記，或附 `m{N}-states.png` 第二張）**：

- M7：`+ Add Marketplace` 按鈕的 default / hover / focus / active / disabled（disabled = MarketplaceDialog 開啟期間）皆呈 feat-018 button variant 規格
- M8：MarketplaceDialog 內 source-type radio group 切換（github → git → url → directory），動態欄位正確顯示/隱藏；submit 按鈕在表單未通過驗證時呈 disabled
- M9：DiscoverTab Install 按鈕在 CLI 執行中切為 loading（spinner + 文字「Installing…」）；scope chooser dialog 的三個 radio default / hover / focus 皆有 visible focus ring
- M10：MarketplacesTab `claude-plugins-official` Remove 按鈕固定 disabled，hover 顯示 tooltip「Built-in marketplace cannot be removed」；其他市場 Remove 按鈕的 default / hover / focus / active 正常
- M11：InstalledTab plugin toggle 的 default / hover / focus / active；toggling 期間 Switch 進入 disabled

**空 / 載入 / 錯誤狀態**：

- M12：InstalledTab — 將 `installed_plugins.json` 暫時改名（或在 dev mock 設定空陣列）→ empty state 顯示 `ExtensionListLayout` empty pattern（icon + title + description）
- M13：MarketplacesTab — 全部市場移除後 → empty state；DiscoverTab — 進入時 marketplace selector 未選 → 顯示「Select a marketplace to discover plugins」placeholder；DiscoverTab loading — 切換市場時 ≥ 200ms 顯示 spinner 區塊
- M14：ErrorsTab 有錯誤時 — 故意把 `installed_plugins.json` 寫入 `{not valid json` → 切回 Errors 看到一筆 error item（severity badge 為 `.badge-notion` 紅變體 token）；errors 數同步反映於 tab 標籤右側計數 badge

### R. 回歸保護

- R1：`feature_list.json` feat-001~018 status 不被改動；`grep -nE "\"status\":\\s*\"done\"" feature_list.json | wc -l` ≥ 18（feat-001~018 全部 done）
- R2：feat-018 設計 tokens（`--notion-blue`、`--bg-base`、`shadow-notion-card`、`border-whisper`、`badge-notion`）數值不被改動；`git diff feat-018-baseline -- src/renderer/index.css tailwind.config.js` → 0 lines diff
- R3：feat-016 E2E 仍 blocked，`docs/E2E_BLOCKED.md` 未被改動
- R4：既有 `ExtensionRow.test.tsx:63` `bg-accent/60` 斷言仍通過（不被本次新元件破壞）

## Evidence Plan

| Dimension | Evidence to Collect |
|-----------|---------------------|
| Correctness | 完整 V1–V5 輸出存於 `evidence/feat-019/v1-typecheck.txt` ~ `v5-build.txt`；F1–F4 grep 結果存 `evidence/feat-019/f-ipc-grep.txt`；S0-1 `docs/CLAUDE_PLUGIN_LAYOUT.md` 7 章節用 `wc -l` 證明各章節 ≥ 12 行（避免空殼） |
| Verification | V1–V5 + F1–F4 + C1–C5 + D1–D5 全部以 Bash 跑過、stdout/stderr 完整存檔；M1–M6 各一張截圖存 `evidence/feat-019/m{1..6}.png`；M4 在無 claude binary 機器上必須額外存「claude CLI not found」toast 截圖 `evidence/feat-019/m4-no-binary.png` |
| Scope Discipline | `git diff main...feat-019-impl --stat` 結果存於 `evidence/feat-019/scope-diff.txt`；目錄白名單僅含：`docs/CLAUDE_PLUGIN_LAYOUT.md`、`src/shared/types.ts`、`src/preload/index.ts`、`src/main/ipc/configHandlers.ts`、`src/main/ipc/handlers/claudeHandler.ts`、`src/main/ipc/handlers/claudePluginsHandler.ts`（新）、`src/main/ipc/handlers/cliRunner.ts`（新）、`src/main/ipc/__tests__/cliRunner.test.ts`（新）、`src/main/ipc/__tests__/claudePluginsHandler.test.ts`（新）、`src/renderer/components/agents/ClaudePlugins.tsx`、`src/renderer/components/agents/ClaudePlugins/*`（新目錄整批）、`src/renderer/components/agents/__tests__/ClaudePlugins.test.tsx`、`src/renderer/components/agents/__tests__/MarketplacesTab.test.tsx`（新）等 4 個新測試檔、`feature_list.json`、`progress.md`、`session-log.jsonl`、`session-handoff.md`、`evidence/feat-019/**`；任何不在此名單中的修改視為違反 Exclusions |
| Reliability | R1–R4 各跑一次並存 evidence；S1-5 cliRunner 失敗路徑（binary missing / timeout / 非白名單 / unsafe name / unsafe URL）測試輸出存 `evidence/feat-019/c-cli-failures.txt` |
| Maintainability | `docs/CLAUDE_PLUGIN_LAYOUT.md` 完整七章節；`src/main/ipc/handlers/claudePluginsHandler.ts` 與 `cliRunner.ts` 各檔 ≤ 400 行；新增 `AGENTS.md` 章節「Claude Plugins / CLI Runner — 規則」說明 cliRunner 白名單、git URL regex、binary 偵測機制 |
| Handoff Readiness | **僅查交付物存在性與定位**（不評文件內文品質，依 ADR-0005）：(a) `evidence/feat-019/` 目錄存在且包含 V/F/C/D/M/R/RC 各項對應檔；(b) `feature_list.json` feat-019 `status` 字串為 `done` 且 `evidence` 字串非空；(c) `progress.md`、`session-log.jsonl`、`session-handoff.md` 三檔皆已被 git 追蹤；(d) `git status` 除 4 個 handoff 檔 + commit 外為 clean；(e) `AGENTS.md` 與 `docs/CLAUDE_PLUGIN_LAYOUT.md` 路徑可被 `Glob` 找到。**不檢查**：handoff 檔內文措辭、四欄內容是否「精準」、commit message 是否優雅 — 該等品質審查屬 handoff skill 範疇 |

## Exclusions

- ❌ **不執行**：實際 `claude plugin install <網路上的> --scope user` 對 production `~/.claude/` 的破壞性測試。整合測試以 mock spawn 為主；M4 真實 CLI 呼叫只測 binary detection 與 dry-run 等同的 `claude plugin marketplace list`，**不**真的安裝外掛
- ❌ **不改動**：`src/main/ipc/handlers/{geminiHandler,copilotHandler,mcpHandler,skillsHandler,rulesHandler,markdownHandler,agentsHandler,configUtils}.ts`
- ❌ **不改動**：`src/renderer/components/agents/{GeminiExtensions.tsx,SubagentsEditor.tsx,ClaudeSessionsView.tsx,GeminiSessionsView.tsx,CopilotSessionsView.tsx,SessionsView.tsx,ClaudePlugins/FilterToolbar.tsx}`（FilterToolbar 維持原樣供 InstalledTab 沿用）
- ❌ **不改動**：`src/renderer/components/{layout,editors,shared,ui}/**`、`src/renderer/{App.tsx,main.tsx,index.css}`、`src/renderer/{hooks,lib}/**`、`tailwind.config.js`、`src/test/setup.ts`
- ❌ **不改動**：`docs/{ARCHITECTURE.md,DESIGN.md,E2E_BLOCKED.md,PRODUCT.md}`、`scripts/check-architecture.sh`、`init.sh`、`package.json`、`tsconfig*.json`、`vite.config.ts`、`playwright.config.ts`、`e2e/**`
- ❌ **不引入**：新 npm 套件（不裝 Octokit、git client、yaml parser；marketplace.json 是 JSON）
- ❌ **不實作**：LSP code-intelligence 自動 diagnostics、`/plugin developer mode (--plugin-dir)`、Plugin 提交至官方 marketplace 的 UI、managed scope 編輯、background monitor 觸發
- ❌ **不新增 E2E**：feat-016 Playwright E2E 仍 blocked，本次只做單元/元件測試
- ❌ **不改動其他 feature**：feat-001~018 status / evidence 維持不變；feat-019 為唯一變動 entry

## Reliability Checks

- **RC1：claude binary 不在 PATH** → cliRunner 偵測階段直接 return `{ success: false, error: "claude CLI not found in PATH; install via instructions at https://code.claude.com/docs/zh-TW/setup" }`；Errors tab 顯示同訊息；其他 tab 仍可顯示已快取資料。
  **Source**：https://code.claude.com/docs/zh-TW/discover-plugins § Troubleshooting「`/plugin` 命令無法識別」段落明列「Executable not found in $PATH」屬常見錯誤類別

- **RC2：`installed_plugins.json` 不存在** → handler 回 `{ success: true, data: [] }`（檔案視為空集合，不算錯誤）。
  **Source**：[inferred] — 文件未明說，但 `~/.claude/plugins/` 為使用者本機快取，全新環境無此檔屬正常

- **RC3：`installed_plugins.json` JSON 損毀** → handler 捕捉 `SyntaxError` → 回 `{ success: false, error: "<message>" }`；Errors tab 顯示一筆 `{ scope: 'plugin', severity: 'error', message: <SyntaxError.message>, raisedAt: <ISO> }`；其他 tab 不阻塞。
  **Source**：`AGENTS.md` IPC envelope 規則「Never throw across the IPC boundary — always return { success, data? } or { success: false, error }」

- **RC4：CLI 執行 timeout（60s）** → cliRunner 對 child process 發送 `SIGTERM`，等待 5s 仍存活則 `SIGKILL`；回 `{ success: false, error: "claude CLI timeout (60s)", stdout: <accumulated>, stderr: <accumulated> }`；UI toast 顯示「CLI timed out」。
  **Source**：[inferred] — 防禦性，避免 `child_process.spawn` 永久 hang 阻塞 main process

- **RC5：使用者於 MarketplaceDialog 輸入含 `..` 或 `;` 的 marketplace 名** → `assertSafeName` throw → cliRunner catch 後回 `{ success: false, error: "invalid marketplace name: <reason>" }`；CLI 不被 spawn；Errors tab 不寫入（屬使用者輸入錯誤，僅顯示 toast）。
  **Source**：`AGENTS.md` Working Rules「Always call `assertSafePath` / `assertSafeName` for renderer-supplied inputs」

- **RC6：`known_marketplaces.json` 與 settings.json `extraKnownMarketplaces` 衝突**（同名但 source 不同） → handler 以 `installed_plugins.json` / `known_marketplaces.json` 為準（CLI 寫入優先），`extraKnownMarketplaces` 視為待註冊；UI 在衝突項顯示 warn pill「unsynced」。
  **Source**：https://code.claude.com/docs/zh-TW/discover-plugins § 配置團隊市場 — `extraKnownMarketplaces` 屬待安裝建議，需使用者信任資料夾後才被 CLI 寫入 `known_marketplaces.json`

## Commitment Gates

| Commitment | Gate | Failure Handling |
|------------|------|------------------|
| `feature_list.json` feat-019 `status` 由 `planned` 翻成 `done` 並回填 `evidence` | **All of** V1 + V2 + V3 + V4 + V5 + F1 + F2 + F3 + F4 + C1 + C2 + C3 + C4 + C5 + D1 + D2 + D3 + D4 + D5 + M1 + M2 + M3 + M4 + M5 + M6 + M7 + M8 + M9 + M10 + M11 + M12 + M13 + M14 + R1 + R2 + R3 + R4 + RC1 + RC2 + RC3 + RC4 + RC5 + RC6 必須產出 evidence file 於 `evidence/feat-019/`，且每個 evidence file 的 mtime 嚴格早於 `feature_list.json` 中 feat-019 status 字元變更的 commit time（或未 commit 時嚴格早於 `feature_list.json` 的 mtime） | 任一驗證項在 status flip 後失敗 → revert flip 於同一 session（將 feat-019 改回 `planned` 並清空 evidence 字串），於 `progress.md`「上次 Session 結束點」追加一行 `feat-019 commitment reverted: <failing item>`；不得在 V/F/C/D/M/R/RC 全部 PASS 之前再次 fire 此 commitment |
| `progress.md` 新增 feat-019 列且「上次 Session 結束點」改寫 | **Inherits 上一列 Gate 全集（V1–V5 + F1–F4 + C1–C5 + D1–D5 + M1–M14 + R1–R4 + RC1–RC6 全部 PASS evidence 已落地）**，且 `progress.md` mtime 嚴格晚於最新 evidence file mtime | 若 feat-019 status flip 被 revert（上一列失敗）→ 同一 session 內 revert progress.md 對應段落，回退到 flip 前內容 |
| `session-log.jsonl` 追加一行（含 today's date、summary、tests 數、lint errors/warnings） | **Inherits 第一列 Gate 全集**，且額外要求：`bun run test` 通過、測試數 ≥ 基線 + 25、`bun run lint` 0 errors / 0 warnings、追加行的 mtime 嚴格晚於 `progress.md` mtime | 若測試數不達標 或 lint 非零 或 上層 gate 任一失敗 → 不寫入 session-log.jsonl；若已寫入後才偵測到失敗 → 同一 session 內以 `git checkout HEAD -- session-log.jsonl` 復原該行 |
| `session-handoff.md` ▶ 下次 Session 區塊四欄（最後更新 / 驗證狀態 / 上次動作 / 下次起點）全部填寫 | **Inherits 第一列 Gate 全集**，且要求 `session-handoff.md` 的 mtime 嚴格晚於 `evidence/feat-019/` 目錄中所有 evidence file 的 mtime；四欄內容皆為非空且不含預設樣板字串（`<TBD>` / `<待填>` / 空字串） | 若上層 gate 任一失敗 → revert handoff 區塊到 flip 前內容（`git checkout HEAD -- session-handoff.md`），於 `progress.md` 追加一行記錄此 revert |

## Lock-in Tables

### L1：新增 IPC Channels（共 9 個，全部必須）

| 常數 | 通道字串 | preload 方法 | 用途 |
|------|---------|-------------|------|
| `CONFIG_GET_CLAUDE_MARKETPLACES` | `config:get-claude-marketplaces` | `config.getClaudeMarketplaces(configDir)` | 讀 known_marketplaces.json + extraKnownMarketplaces 合併 |
| `CONFIG_GET_CLAUDE_PLUGIN_DISCOVERY` | `config:get-claude-plugin-discovery` | `config.getClaudePluginDiscovery(configDir, marketplaceName)` | 讀指定市場 marketplace.json |
| `CONFIG_GET_CLAUDE_PLUGIN_ERRORS` | `config:get-claude-plugin-errors` | `config.getClaudePluginErrors(configDir)` | 聚合上述讀取階段累積之 ClaudePluginError |
| `CLAUDE_CLI_MARKETPLACE_ADD` | `claude-cli:marketplace-add` | `claudeCli.marketplaceAdd(name, source)` | `claude plugin marketplace add <source-arg>` |
| `CLAUDE_CLI_MARKETPLACE_REMOVE` | `claude-cli:marketplace-remove` | `claudeCli.marketplaceRemove(name)` | `claude plugin marketplace remove <name>` |
| `CLAUDE_CLI_MARKETPLACE_UPDATE` | `claude-cli:marketplace-update` | `claudeCli.marketplaceUpdate(name)` | `claude plugin marketplace update <name>` |
| `CLAUDE_CLI_PLUGIN_INSTALL` | `claude-cli:plugin-install` | `claudeCli.pluginInstall(pluginId, scope)` | `claude plugin install <id> --scope <scope>` |
| `CLAUDE_CLI_PLUGIN_UNINSTALL` | `claude-cli:plugin-uninstall` | `claudeCli.pluginUninstall(pluginId, scope)` | `claude plugin uninstall <id> --scope <scope>` |
| `CLAUDE_CLI_RELOAD` | `claude-cli:reload` | `claudeCli.reload()` | `claude plugin reload`（等同 `/reload-plugins`） |

### L2：4 Tabs 列舉（不可增減）

`installed` / `marketplaces` / `discover` / `errors`

### L3：3 Install Scopes（外加 managed 為唯讀展示）

`user` / `project` / `local` — 可寫；`managed` — 唯讀展示，不出現於 scope chooser

### L4：cliRunner 指令白名單（共 11 條）

| Command Tokens | 對應功能 |
|----------------|---------|
| `["plugin","marketplace","add",<source-arg>]` | S1-6 marketplaceAdd |
| `["plugin","marketplace","remove",<name>]` | S1-6 marketplaceRemove |
| `["plugin","marketplace","update",<name>]` | S1-6 marketplaceUpdate |
| `["plugin","marketplace","list","--json"]` | M2 安全列舉 |
| `["plugin","install",<id>,"--scope",<scope>]` | S1-6 pluginInstall |
| `["plugin","uninstall",<id>,"--scope",<scope>]` | S1-6 pluginUninstall |
| `["plugin","enable",<id>]` | 預留、本次未透過 CLI（仍走 settings.json） |
| `["plugin","disable",<id>]` | 同上預留 |
| `["plugin","reload"]` | S1-6 reload |
| `["--version"]` | binary 偵測探針 |
| `["plugin","--help"]` | binary 能力探針 |

任何不在此 11 條 token 模式內的 args 組合 → cliRunner 拒絕 spawn 並回 `{ success: false, error: "command not whitelisted" }`。

### L5：Marketplace Source Type 列舉（共 5 種）

`github` / `git` / `git-subdir` / `url` / `directory`

### L6：合法 Git URL 正則（cliRunner S1-5）

`^(https://[\w./@:-]+|git@[\w./:-]+:[\w./-]+|github:[\w-]+/[\w.-]+)$`

## Known Divergences

- **DV1**：managed scope 外掛在 Installed tab 顯示但所有編輯動作 disabled（含 toggle、delete）。理由：官方文件（discover-plugins § 安裝外掛程式）明列 managed scope 由管理員透過受管設定安裝，無法修改。本次不嘗試繞道。
- **DV2**：`claude-plugins-official` 內建市場在 Marketplaces tab 顯示但 Remove 按鈕永久 disabled（顯示 tooltip）。理由：官方文件「官方 Anthropic 市場在您啟動 Claude Code 時自動可用」。
- **DV3**：cliRunner 不解析 stdout/stderr 為結構化資料 — 全部以 raw 字串傳回 renderer。理由：CLI 輸出格式未公開穩定 schema；若官方提供 `--json` 則使用之（L4 中 `marketplace list --json` 已採用），否則純文字 tail 4 行顯示於 toast。
- **DV4**：當 `extraKnownMarketplaces` 條目尚未被 CLI 寫入 `known_marketplaces.json`（使用者尚未信任專案資料夾），UI 在 Marketplaces tab 顯示 warn pill「unsynced」但不主動觸發 CLI add — 由使用者手動點擊「Sync」按鈕觸發 marketplaceAdd。理由：避免在 IPC 啟動階段執行有副作用的 git clone。

## Forward-compat Notes

- **FC1**：未來若新增 LSP code-intelligence diagnostics → 在 `ClaudePlugin.components` 增加 `lspDiagnostics: boolean` 欄位（schema 已有 `lsp: boolean`，將升級為 union 結構）；單點變更位於 `src/shared/types.ts` 與 `claudePluginsHandler.readPluginManifest`。
- **FC2**：未來若實作 plugin developer mode (`--plugin-dir`) UI → 新增 `CLAUDE_CLI_PLUGIN_DEV` channel + 一個 DevTab；不影響本次 4-tab 架構。
- **FC3**：未來若官方 CLI 提供更多 `--json` 輸出 → cliRunner 內 stdout 解析切換點集中於 `parseCliOutput()` 函式。

## Platform Exceptions

- **PE1**：claude binary 偵測 — Windows 使用 `where claude`（並讀取 `%PATHEXT%` 比對 `.exe`/`.cmd`）；macOS / Linux 使用 `which claude`。失敗訊息一致：「claude CLI not found in PATH; install via instructions at https://code.claude.com/docs/zh-TW/setup」。
- **PE2**：Windows `installPath` 顯示保留 backslash（如 `C:\Users\gn006\.claude\plugins\cache\...`）；不做 forward-slash normalization。理由：使用者於 Windows Explorer 複製貼上時保持可用。
- **PE3**：Windows PowerShell 不被 cliRunner 使用（永遠 spawn `claude.cmd` 或 `claude.exe` 直接、`shell: false`）；理由：規避 PowerShell 引號展開造成的注入風險。
- **PE4**：macOS / Linux symlink 在 `installPath` 解析後仍跑 `assertSafePath`；Windows reparse point 視為一般檔案系統項，同樣經 `assertSafePath`。

---

## Generator Self-Check（v0 提交前自驗）

- [x] 5 個 always-present sections 全部存在且非空（Commitment Gates / Lock-in Tables / Known Divergences / Forward-compat Notes / Platform Exceptions）
- [x] S4-1 commitment 對應 Commitment Gates 第一列；Gate 列舉 V1–V5 + F1–F4 + C1–C5 + D1–D5 + M1–M6 + R1–R4 + RC1–RC6 全部 evidence file，非單一指令
- [x] 每個列舉集合有完整列舉：4 tabs（L2）/ 3 scopes + 1 唯讀（L3）/ 11 CLI 指令（L4）/ 5 source types（L5）/ 9 IPC channels（L1）
- [x] 每個 Reliability Check（RC1–RC6）皆有非空 `**Source**:` 行（4 條 doc 引用、2 條 `[inferred]`）
- [x] 無 wiggle-room 詞（無「視評估而定」「X 或 Y」「implementer's choice」未標 [implementer-choice]）
- [x] Commitment Gates Failure Handling 為 outcome-oriented；無 hedge words（「best effort / if feasible / where possible / as appropriate / tbd / tba / later / eventually」）
