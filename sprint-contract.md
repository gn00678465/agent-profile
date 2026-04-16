# Sprint Contract — feat-018: UI 重構為 Notion 風格設計系統

| 欄位 | 值 |
|------|-----|
| Feature ID | `feat-018` |
| 建立日期 | 2026-04-15 |
| 合約狀態 | **ACTIVE (EFFECTIVE)** — 2026-04-15 經 Planner + Evaluator Round 2 共識通過並簽署 |
| Planner | Claude (主對話) |
| Evaluator | Sub-agent（`general-purpose`，獨立角色） |
| 生效條件 | `Planner + Evaluator 共識紀錄 §5 雙方皆標註 "APPROVED"` |
| 設計準繩 | `DESIGN.md`（唯一視覺來源，與 AGENTS.md 衝突時以此為準）|

---

## 1. 任務範圍 (Scope)

以下為**本次衝刺唯一允許修改的檔案與變更重點**。任何範圍外改動必須重新議合約。

### 1.1 設計 Tokens 與 Tailwind 設定

| 檔案 | 具體變更 |
|------|----------|
| `src/renderer/index.css` | 重寫 CSS variables：`--bg-base/-surface/-raised/-overlay` 改為 Notion 暖白/暖灰；`--text-primary` 改為 `rgba(0,0,0,0.95)` (light) / `rgba(255,255,255,0.95)` (dark)；`--border-subtle` 改為 `rgba(0,0,0,0.1)`；新增 `--notion-blue: #0075de`、`--notion-blue-active/-focus`、`--badge-blue-bg/-text`；新增 `--shadow-card`（4-layer）與 `--shadow-deep`（5-layer）；body font-family 改 Inter-first 並加 `font-feature-settings: 'lnum' 1, 'locl' 1`；新增 `.border-whisper`、`.shadow-notion-card/-deep`、`.badge-notion` utility classes；新增 `h1-h4` typography scale（64/48/26/22px 含 letter-spacing）。 |
| `tailwind.config.js` | `theme.extend.colors` 新增 `notion: { blue, blueActive, blueFocus, badgeBg, badgeText }` 與 `warm: { white, dark, gray500, gray300 }`；`borderRadius` 新增 `pill: '9999px'`、`card: '12px'`、`hero: '16px'`；`boxShadow` 新增 `notion-card`、`notion-deep`；`fontFamily.sans` 改為 Inter-first。 |

### 1.2 App 主框架

| 檔案 | 具體變更 |
|------|----------|
| `src/renderer/App.tsx` | Title bar 改用 `border-b-whisper` + `bg-base`；Agent header band 維持 per-agent accent 但邊框改 whisper、字體依 DESIGN.md §3 card-title；Tabs 改為底部 `2px` underline（active 顯示 agent accent 色，inactive 透明，文字用 `--text-secondary`）；Status bar 使用 warm gray 暖灰字、保存狀態改為 `.badge-notion` pill；所有 inline color `#f59e0b/#22c55e` 改為 tokens。 |

### 1.3 Sidebar 與 UI Primitives

| 檔案 | 具體變更 |
|------|----------|
| `src/renderer/components/layout/Sidebar.tsx` | 背景改 `--bg-surface`（Notion warm-white `#f6f5f4`）；右邊框改 `border-r-whisper`；Agent tile active 樣式改 `2px solid accent` + `rounded-[8px]`；theme toggle button 改用 `ghost` variant。 |
| `src/renderer/components/ui/button.tsx` | 新增 `variant: 'notion'`（bg `--notion-blue`、text white、`rounded-[4px]`、`px-4 py-2`、hover 轉 `--notion-blue-active`）；`default` variant 改為使用 `--notion-blue`；`outline` variant border 改 whisper。 |
| `src/renderer/components/ui/card.tsx` | `Card` root className 改為 `rounded-card border-whisper shadow-notion-card bg-card`；padding 維持不變。 |
| `src/renderer/components/ui/tabs.tsx` | `TabsList` 移除灰底圓角背景改透明 + `border-b-whisper`；`TabsTrigger` 改為底部 `2px` underline（active state）、文字 `--text-secondary`/`active 用 --text-primary`、移除 `shadow`。 |

### 1.4 共用列表元件

| 檔案 | 具體變更 |
|------|----------|
| `src/renderer/components/shared/ExtensionRow.tsx` | `border-b border-border/50` 改為 `border-b-whisper`；enabled 圓點改為靠 `--notion-blue` 或 agent accent；subtitle 文字色改 `--text-secondary`；如果有 badge，統一改用 `.badge-notion` pill。**明確不改動：selected 狀態仍使用 `bg-accent/60` className**（配合現有測試 `ExtensionRow.test.tsx:63` 斷言，避免 R2 風險），只靠 `--accent` token 連動換色。 |
| `src/renderer/components/shared/ExtensionListLayout.tsx` | Empty state 排版對齊 DESIGN.md §5 whitespace philosophy：`py-16` → `py-24`、icon 尺寸統一、titles 改 `text-card-title`、description 改 `text-[14px]` + `text-muted-foreground`。 |

---

## 2. 驗證標準 (Verification Standards)

所有標準**必須全部通過**才能宣稱合約履行完畢。

### 2.1 自動驗證（硬性門檻）

| # | 指令 | 通過條件 |
|---|------|----------|
| V1 | `bun run typecheck` | Exit code 0；0 errors |
| V2 | `bun run lint` | Exit code 0；**0 errors / 0 warnings**（AGENTS.md DoD 要求） |
| V3 | `bun run test` | 全數通過；與基線（378 pass / 0 fail / 21 files）相比不得有新增失敗 |
| V4 | `bash scripts/check-architecture.sh` | 0 boundary violations |
| V5 | `bun run build` | 生產 build 成功，無錯誤 |

### 2.2 設計合規性檢查（對照 `DESIGN.md`）

| # | 檢查項 | 通過條件 |
|---|--------|----------|
| D1 | `DESIGN.md §9 Quick Color Reference` 的 10 個 token | 每一個都有對應 CSS variable 或 Tailwind token |
| D2 | Border 實作 | Renderer 原始碼（`src/renderer/**/*.tsx` 與 `index.css` 之外）中所有 border 顏色**必須**使用以下其中之一：`--border-subtle` / `border-border` / `.border-whisper` / `.border-b-whisper`；**禁止**出現 `border-[#...]`、inline `borderColor: '#...'`、或任何 Tailwind arbitrary color border class（grep 驗證：`grep -rE "border-\[#\|borderColor: *'#" src/renderer` 回傳空） |
| D3 | Shadow 實作 | `shadow-notion-card` 或 `shadow-notion-deep` 套用於所有 Card 元件；無其他單層 shadow hack |
| D4 | Primary CTA 色 | `Button variant="notion"` 或 `variant="default"` 輸出 `#0075de` (light) / `#62aef0` (dark)；不再使用舊的 `220 90% 60%` HSL |
| D5 | Typography scale | `h1-h4` 或 `.text-display/-section/-subhead/-card-title` 具備 DESIGN.md §3 的字級、letter-spacing、line-height |
| D6 | Pill badge | 至少一處使用 `.badge-notion`（status bar "Saving / Unsaved / Saved" 三態） |
| D7 | 對比度自動量測 | 以 `npx @axe-core/cli` 或於 Chromium DevTools Lighthouse 執行一次「Accessibility」掃描目標 App 首頁（雙主題各一次），**Contrast 類別無 fail item**；結果截圖或 JSON 附於 commit message 或 `evidence/` 目錄（新建此目錄屬本次 Scope 例外允許）。若無法離線執行 axe，則退回手動計算主文字對比（公式：WCAG 2.1 §1.4.3），記錄在 §5.2 Round 對應欄位。 |

### 2.3 手動視覺驗證（Spot-check）

執行 `bun run dev` 後依以下 checklist 逐項確認：

| # | 驗證步驟 | 通過條件 |
|---|----------|----------|
| M1 | 啟動 app，預設 system theme | 背景為 Notion warm white（或 warm dark），無冷藍灰 |
| M2 | 切 light / dark（點 Sidebar theme toggle） | 兩種主題皆能正常顯示；WCAG 對比度交由 **D7 自動檢查**，此處僅目視確認「無白字在白底 / 黑字在黑底」極端 regression |
| M3 | 切三個 agent tab（claude-code / copilot / gemini） | Header band 保留各 agent accent 色、邊框仍為 whisper |
| M4 | 切 agent 內的所有 section tabs | Underline 顯示於 active tab 底部，顏色為 agent accent |
| M5 | Sidebar collapse / expand | Agent tile active 樣式正確（2px accent 邊框） |
| M6 | 在 Skills / Plugins / Extensions 頁面觸發 Empty state | Empty state 容器 `py-24`、icon 尺寸 `h-10 w-10`、title 字級對應 DESIGN.md §3「Card Title」(22px/700/-0.25px)、description 字級 `text-[14px]` + `text-muted-foreground`；以 DOM inspector 目視確認每一項 |
| M7 | 觸發 Save 狀態（編輯任一 JSON 後 Ctrl+S） | Status bar 顯示 pill badge 樣式，三態（saving/unsaved/saved）皆為 pill |

### 2.4 回歸保護（Regression Gate）

| # | 項目 | 通過條件 |
|---|------|----------|
| R1 | IPC 行為 | 無任何 `src/main/`、`src/preload/`、`src/shared/` 檔案變更 |
| R2 | 測試斷言耦合（已盤點） | 已確認現有測試 class 斷言三處：（a）`ExtensionRow.test.tsx:63` `bg-accent/60` — §1.4 已明列**保留**此 className；（b）`SkillsEditor.test.tsx:~339` `h-6 w-6` — SkillsEditor 屬 Exclusion，不影響；（c）`GeminiSessionsView.test.tsx:~179` `italic` — GeminiSessionsView 屬 Exclusion，不影響。**強制要求**：若 §1.4 ExtensionRow 改動意外去除 `bg-accent/60` class，V3 將失敗並觸發合約變更流程（§6）。 |
| R3 | Radix primitives 無降級 | Dialog / Switch / ScrollArea 等未列入 Scope 的元件視覺異常視為失敗 |

---

## 3. 排除事項 (Exclusions)

以下明確**不在本次衝刺處理範圍內**。若實作時發現必須改動，**必須暫停並重新議合約**。

### 3.1 不改動的檔案與領域

- ❌ **Renderer entry** — `src/renderer/main.tsx` 不動
- ❌ **所有 editors**（`src/renderer/components/editors/`）— `JsonFileEditor.tsx`、`MarkdownEditor.tsx`、`McpCommandEditor.tsx`、`SkillsEditor.tsx`、`RulesEditor.tsx`、`SubagentsEditor.tsx`、`ClaudeSessionsView.tsx`、`GeminiSessionsView.tsx`、`CopilotSessionsView.tsx`、`SessionsView.tsx`、`AddSkillDialog.tsx`
- ❌ **Agent-specific views**（`src/renderer/components/agents/`）— `ClaudePlugins.tsx`、`ClaudePlugins/FilterToolbar.tsx`、`GeminiExtensions.tsx`
- ❌ **UI primitives 未列入 §1.3**（`src/renderer/components/ui/`）— `dialog.tsx`、`input.tsx`、`label.tsx`、`scroll-area.tsx`、`separator.tsx`、`switch.tsx`、`textarea.tsx`、`remove-button.tsx`、`JsonEditor.tsx`（注意：此為 `src/renderer/components/ui/JsonEditor.tsx`，非 editors 目錄下的 `JsonFileEditor.tsx`，兩者皆排除）、`badge.tsx`
- ❌ **測試檔** — `src/renderer/**/__tests__/**/*.test.tsx` 全部 9 個檔案一律不動；僅當 §2.4 R2 被觸發（即合約違反）時，才**被動**更新；禁止新增測試（E2E 由 feat-016 專責）
- ❌ **Main / Preload / Shared** — `src/main/**`、`src/preload/**`、`src/shared/**` 一律不動
- ❌ **Hooks** — `useAgents.ts`、`useConfig.ts`、`useItemLoader.ts`、`useTheme.ts` 邏輯不改
- ❌ **Lib** — `electron.ts`、`parseMcpCommand.ts`、`utils.ts` 不改
- ❌ **Build / Scripts / Docs** — `scripts/check-architecture.sh`、`docs/ARCHITECTURE.md`、`vite.config.ts`、`tsconfig*.json`、`package.json` 不動

> 例外：若 §1 列出的檔案對這些檔案有 import 連動（例：`Card` 被 editor 使用），**只接受 token 層的視覺連動**，不得新增或改動 editor 邏輯。

### 3.2 不做的功能

- ❌ 新增 / 刪除 feature（feat-015/016/017 仍為 planned）
- ❌ 改動 IPC channel、IpcResponse envelope、security guards
- ❌ 改動 `feature_list.json` 的 feature 結構（只改 feat-018 的 status/evidence）
- ❌ 改動 `AGENTS.md`、`CLAUDE.md`、`docs/ARCHITECTURE.md`（DESIGN.md 已是唯一準繩，無需連動）。例外：若實作時發現 AGENTS.md「Design system compliance」段落需要修訂，必須走 §6 合約變更流程，不得私自更新
- ❌ 新增 E2E 測試（feat-016 planned，不在此次）
- ❌ 新增視覺迴歸測試基礎設施（如 Percy / Chromatic / Playwright screenshot）
- ❌ 引入新 npm 套件（不裝 NotionInter webfont、不裝新 UI lib）

### 3.3 不調整的視覺細節

- ❌ Hover `scale(1.05)` / Active `scale(0.9)` 動畫（DESIGN.md §8 列出但非必要，延後）
- ❌ Focus ring 的 2-layer shadow 細節（保留目前 Radix / shadcn 預設即可）
- ❌ 響應式 breakpoints（桌面 Electron app，max-width 一律延用目前值）
- ❌ 自訂字型 webfont（使用系統 Inter fallback）
- ❌ Agent identity 色盤（Claude 橘 / Copilot 綠 / Gemini 紫 保留，不改為 Notion Blue）
- ❌ Decorative illustrations / hero artwork / trust bar 等 DESIGN.md 的 marketing 元素（app 本體無此區塊）

### 3.4 不改動的狀態檔案

- ❌ `progress.md` 除了「上次 Session 結束點」段落之外不改
- ❌ `session-handoff.md`、`clean-state-checklist.md`、`init.sh` 不改
- ❌ `session-log.jsonl` 只允許 append 一行

---

## 4. 支援資訊（Supporting Context）

### 4.1 Goal（任務目標）

將 Agent Profile desktop app 視覺層從「冷藍灰深色」統一遷移到 `DESIGN.md` 規範的 Notion 暖中性美學；**不改變任何功能語義、IPC 行為、檔案系統行為**。

### 4.2 Phases（分期交付）

每個 Phase 完成後 local commit，方便局部 rollback。

| Phase | 交付內容 | 估時 | 驗證點 |
|-------|----------|------|--------|
| A | §1.1 tokens + tailwind | 30m | V1, V2, **V3**（token 換值時驗 snapshot/class 斷言不擊碎）, dev server 可啟動 |
| B | §1.2 App.tsx | 45m | V1, V2, M1–M4 |
| C | §1.3 Sidebar + ui primitives | 30m | V1, V2, V3, M5 |
| D | §1.4 shared list components | 30m | V1, V2, V3, M6, M7 |
| E | 收尾：全套 V1–V5、D1–D6、R1–R3；state file 更新；commit squash（或保留五個 commit，於 §5 共識階段由 evaluator 決定） | 15m | All Verification Standards |

**總估時**：~2.5 小時，單一 session 內完成。

### 4.3 風險與緩解

| 風險 | 緩解 |
|------|------|
| shadcn token 改值導致未重繪元件顏色怪異 | 保留語義（`--primary` 仍為 CTA、`--muted` 仍為次要）；只換 HSL 數值 |
| 測試對 class 名稱硬編碼 | Phase C 開始前先 `grep` 測試檔 class 斷言；有衝突則列入 R2 處理 |
| 暗色模式可讀性不足 | Phase A 結束即跑 M1–M2；不達 WCAG AA 則調整 tokens |
| Radix 內部樣式不符新風格 | §1.3 只動 `components/ui/` 包裝層，不改 Radix 本身 |
| 文件與實作脫節 | §5 共識必須引用具體檔案與行號 |

### 4.4 Rollback 策略

- 每個 Phase 單獨 commit，任一 Phase 發現 regression 可 `git revert <phase-commit>` 後繼續下一輪
- 最終可選擇 squash 成單一 `refactor(ui): 套用 Notion 設計系統 (feat-018)` commit 或保留 5-commit 粒度（§5 共識階段決定）
- 極端情況：`git checkout main -- src/renderer/index.css tailwind.config.js <...>` 直接撤回全部，不影響其他 branch 工作

### 4.5 假設

- A1：使用者同意 light theme 為 DESIGN.md 主色盤、dark theme 為「暖色深色變體」
- A2：DESIGN.md 是唯一視覺來源；AGENTS.md 內衝突處以 DESIGN.md 為準
- A3：不引入新套件；NotionInter 透過 CSS font-family 聲明 + Inter fallback 即達視覺近似。**視覺偏差由 M1 判定**：若使用者於 Phase B 結束後目視認定字型差距過大，則回到 §5.2 共識階段重議（是否加裝 `@fontsource/inter` 或同等 webfont）
- A4：Agent identity 色（Claude 橘 / Copilot 綠 / Gemini 紫）為功能語意的一部分，保留
- A5：無視覺迴歸測試基礎設施，M1–M7 手動 spot-check 為合法替代

---

## 5. 共識紀錄 (Consensus Log)

> 合約需 **Planner + Evaluator 皆標註 "APPROVED"** 才正式生效。

| # | 時間 | 角色 | 審查結論 | 備註 |
|---|------|------|----------|------|
| 1 | 2026-04-15 | Planner (Claude 主對話) | `DRAFT SUBMITTED` | 送交 Evaluator 審查 |
| 2 | 2026-04-15 | Evaluator (sub-agent `aefe1f03050a7c28d`) | `CHANGES REQUESTED` | 提出 9 項 findings（M6/M2/R2/JsonEditor 混淆/排除缺口/D2 雙重否定/Phase A 缺 V3/A3 隱性假設/AGENTS.md 修訂權限）|
| 3 | 2026-04-15 | Planner (Round 2 修訂) | `RESUBMITTED` | 採納全部 9 項 findings；補 D7 axe-core 對比度自動量測；升級 R2 為強制 |
| 4 | 2026-04-15 | Evaluator (sub-agent `aefe1f03050a7c28d`) | **`APPROVED`** | 三核心欄位全部通過；Scope/Exclusions/Verification 皆窮盡客觀；僅留 2 項 minor 觀察（§4.3 風險表用詞同步 / §5.2 列高度），不阻斷生效 |

### 5.1 Evaluator 審查要點

Evaluator **必須逐項檢查**以下問題，並在第 2 列填入結論：

1. §1 Scope 是否具體到「檔案路徑 + 變更重點」兩層？是否有模糊陳述（如「優化」「改善」「美化」）未明確到 token 值？
2. §2 Verification Standards 是否全部**客觀可驗證**？是否有主觀描述（如「看起來更好」）？
3. §3 Exclusions 是否完整列出高風險邊界（如 IPC / main / preload / shared）？是否遺漏會被「連動修改」誤改的檔案？
4. §1 與 §3 是否互斥且窮盡（無重疊、無遺漏）？
5. §4.2 Phases 的驗證點是否映射到 §2 的 V/D/M/R 編號？
6. §4.5 假設是否合理？有沒有未敘明的隱性假設？
7. 整體合約是否足以防止 Agent 在執行時「過度發散」？

### 5.2 意見回合（Iteration Rounds）

若 Evaluator 回覆 `CHANGES REQUESTED`，Planner 必須修正後再提交，最多 3 輪。第 3 輪仍無共識則上報使用者裁決。

| Round | Planner 更新 | Evaluator 回覆 |
|-------|-------------|---------------|
| 1 | 初稿 | `CHANGES REQUESTED`（見上表 row 2） |
| 2 | 採納所有 9 項 findings：①M6 改為具體 `py-24/h-10 w-10/22px title/14px desc` 客觀描述；②M2 對比度交由 D7 自動量測，M2 僅檢查 regression；③新增 D7（axe-core / Lighthouse + Contrast 零 fail）；④R2 從「建議」升級為「強制要求」，明列 `bg-accent/60` 保留；⑤D2 改為正向表述（禁止 `border-[#...]` / inline borderColor）；⑥§3.1 新增 `main.tsx` 與 `**/__tests__/**` 排除；⑦§3.1 釐清 `JsonEditor.tsx` (ui/) vs `JsonFileEditor.tsx` (editors/) 路徑混淆；⑧Phase A 驗證點加入 V3；⑨A3 註明 M1 判定偏差與 fallback 加裝路徑；⑩§3.2 新增「AGENTS.md 若需修訂須走 §6」註解。|
| 3 | — | — |

### 5.3 最終簽署

- [x] **Planner (Claude 主對話)**: `APPROVED` — 簽署時間: **2026-04-15**
- [x] **Evaluator (sub-agent `aefe1f03050a7c28d`)**: `APPROVED` — 簽署時間: **2026-04-15**

**合約正式生效時間：2026-04-15**

### 5.4 Evaluator 留置觀察（minor，不阻斷）

1. §4.3 風險表仍有「不達 WCAG AA 則調整 tokens」字樣，下次觸碰時同步改為「D7 Contrast fail 則回到 Phase A 調 token」。
2. §5.2 Round 2 列中文字過長；未來 Round 3（若發生）改用新列。
3. D7 若離線環境無法執行 `@axe-core/cli`，依 D7 fallback 手動計算 WCAG 2.1 §1.4.3 對比度並記錄於 §5.2；此路徑已預留。

---

## 6. 合約變更協議

合約生效後，若執行過程中需要修改 Scope / Verification / Exclusions，**必須**：

1. 暫停實作
2. 在 §5.2 追加一列說明變更原因與內容
3. 重新走 Evaluator 審查流程
4. 雙方再度 `APPROVED` 後才能繼續

**任何未經此流程的範圍逸脫視為合約違反，必須 rollback。**
