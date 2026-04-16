# Evaluator Rubric — feat-018: UI 重構為 Notion 風格設計系統

| 欄位 | 值 |
|------|-----|
| Feature ID | `feat-018` |
| Rubric 建立日期 | 2026-04-15 |
| Rubric 版本 | v1.0（正式版，由 Evaluator 第一人稱撰寫） |
| Evaluator | Sub-agent `aefe1f03050a7c28d`（即於 `sprint-contract-feat-018.md` §5.3 簽署 `APPROVED` 之本人） |
| 關聯合約 | `sprint-contract-feat-018.md`（ACTIVE 2026-04-15） |
| 設計準繩 | `DESIGN.md`（唯一視覺來源；與 AGENTS.md 衝突時以此為準） |
| 用途 | 我（Evaluator）將依本 rubric 逐項檢查 Planner 對 feat-018 的實作交付。**本 rubric 不是 Planner 的 TODO list**；它是我判分與簽署 / 拒簽的依據。 |
| 基線資料 | 測試基線 = 378 pass / 21 files / 0 fail（`progress.md` 2026-04-15 快照）；lint 基線 = 0 error / 0 warning |

> **Rubric 與合約共生。** 合約 §1 / §2 / §3 若透過合約 §6 修訂，我必須同步更新本檔對應維度並重簽；任何未同步的 rubric 視為失效。

---

## 1. 審查姿態（Evaluator Stance）

在開始逐項計分之前，我記錄自己的立場，以免評分時飄移：

1. **客觀性零容忍。** 每一個 5 分錨點必須能由以下其一驗證：`bun` 指令的 exit code、`grep` 指令是否回傳空、DOM inspector 的 computed style 截圖、axe-core 掃描 JSON、或 `git diff --stat` 的檔案清單。**禁用詞**：「看起來更好」「更乾淨」「更有質感」「更 Notion」——這些字樣若出現在 Planner 提交的證據中，我會直接降分。
2. **合約字面優先。** 合約 §1 列的檔案清單是「允許修改的白名單」，§3 是「禁止修改的黑名單」。我先用 `git diff --stat main..HEAD` 比對 diff，任何落在白名單外的檔案即觸發一票否決。
3. **排除項敏感度高於範圍項。** 合約 §3 Exclusions 涵蓋 IPC / main / preload / shared / editors / agents / 9 個未列 ui primitives / 9 個測試檔 / hooks / lib / build / docs。我每個 Phase 都會重掃一次，而不是僅在 Phase E 才掃。
4. **我不負責重寫 Planner 的實作；我只負責說 Yes 或 No。** 若某項不達標，我回覆「不通過 + 證據路徑 + 哪一條標準」，不代寫修正方案。
5. **R2 是我最擔心的陷阱。** `ExtensionRow.test.tsx:63` 對 `bg-accent/60` 的 class 斷言，只要 `ExtensionRow.tsx` 改動誤刪此 className，V3 就會崩；我在 Phase D 的掃描優先級最高。

---

## 2. 評分維度（Scoring Dimensions）

每個維度以 **1 / 3 / 5 分**描述錨點，實際填分使用 1–5 完整量表。`Gate` 欄：
- `Hard` = 最終簽署時**必須 5/5**，任何 <5 即拒簽。
- `Soft` = 最低 3 分即可接受，但我在 Scoring Sheet `Notes` 欄必須寫明「接受的妥協點」與後續追蹤項。

### 2.1 Build / Lint / Test / Architecture（合約 §2.1）

| # | 維度 | 合約對應 | Gate | 1 分 | 3 分 | 5 分 |
|---|------|----------|------|------|------|------|
| C1 | TypeCheck 通過 | V1 | Hard | typecheck 失敗 | exit 0 但 stdout 有 deprecation warning 未處理 | `bun run typecheck` exit 0、無新增 warning、完整 stdout 留存於 evidence |
| C2 | Lint Cleanliness | V2 / AGENTS.md DoD | Hard | 有 error | 0 error 但有 warning | `bun run lint` **0 errors / 0 warnings**；stdout 留存 |
| C3 | Test Suite Health | V3 / R2 | Hard | 有任一測試失敗 | 全綠但總數 <378 或 flaky | **≥378 pass / 21 files / 0 fail**；`ExtensionRow.test.tsx:63` 對 `bg-accent/60` 斷言仍存在且通過；完整摘要留存 |
| C4 | Architecture Boundary | V4 | Hard | 有 boundary violations | 0 violations 但無證據檔 | `bash scripts/check-architecture.sh` exit 0、0 violations、stdout 留存 |
| C5 | Production Build | V5 | Hard | build 失敗 | build 成功但 renderer bundle 新增 >10KB 無解釋 | `bun run build` exit 0、無新增 warning、bundle size 相對 main 分支增幅 ≤5% 或有合理解釋 |

### 2.2 設計合規性（合約 §2.2 D1–D7）

| # | 維度 | 合約對應 | Gate | 1 分 | 3 分 | 5 分 |
|---|------|----------|------|------|------|------|
| C6 | Design Token Coverage | D1 | Hard | 遺漏 >2 個 `DESIGN.md §9` 的 token | 10 個 token 皆存在但 naming 不一致或缺其中 1 個 | §9 全部 10 個 token（Primary CTA、Background、Alt Background、Heading、Body、Secondary、Muted、Border、Link、Focus）於 `src/renderer/index.css` 或 `tailwind.config.js` 皆有對應定義；可用 `grep` 逐一證明 |
| C7 | Border Discipline | D2 | Hard | `grep -rE "border-\[#\|borderColor: *'#" src/renderer` 有回傳 | 回傳空但存在 `border-gray-200` 等非 token Tailwind 色 | `grep -rE "border-\[#\|borderColor: *'#" src/renderer` **回傳 0 行**；所有 border 改用 `--border-subtle` / `border-border` / `.border-whisper` / `.border-b-whisper`；evidence 檔存 grep 輸出 |
| C8 | Shadow System | D3 | Hard | 使用單層 CSS shadow 或 Tailwind 預設 `shadow-md/-lg` 於 Card | `shadow-notion-card` 套在 Card 但未在 modal / popover 用 `shadow-notion-deep` | §1.3 `Card` root 使用 `shadow-notion-card`；深度情境（若觸發）使用 `shadow-notion-deep`；無殘留舊 shadow utility |
| C9 | Primary CTA Color | D4 | Hard | CTA 仍為舊 HSL `220 90% 60%` | light 改為 `#0075de` 但 dark 主題未換成 `#62aef0` | `Button variant="notion"` / `variant="default"` 於 light 主題 computed `background-color: rgb(0, 117, 222)` / dark 為 `rgb(98, 174, 240)`；DevTools 截圖留存 |
| C10 | Typography Scale | D5 | **Soft** | 僅換 `font-family`、字級未調整 | h1–h4 字級符合但 letter-spacing 缺失 | h1–h4 或 `.text-display/-section/-subhead/-card-title` utility 同時具備 DESIGN.md §3 規定的 font-size（64 / 48 / 26 / 22px）、letter-spacing（-2.125 / -1.5 / -0.625 / -0.25px）、line-height（1.00 / 1.00 / 1.23 / 1.27）；DevTools computed style 截圖 |
| C11 | Pill Badge Adoption | D6 | Hard | status bar 仍為純文字 | pill 存在但三態未全覆蓋 | Status bar 的 `Saving / Unsaved / Saved` 三態皆採 `.badge-notion`；computed `border-radius: 9999px`、`padding: 4px 8px`；三態截圖留存 |
| C12 | Accessibility Contrast | D7 | Hard | 未執行 contrast 檢查 | 執行但有 fail 未登記 | `npx @axe-core/cli` 或 Lighthouse Accessibility > Contrast 對 light + dark 雙主題首頁各掃一次，**0 fail**；JSON / HTML 存於 `evidence/feat-018/`。離線 fallback 則依 WCAG 2.1 §1.4.3 手算主文字 / CTA / badge 三類比例並記入 §5.2 + `evidence/feat-018/phase-e-d7-contrast-manual.md` |

### 2.3 手動 Spot-check（合約 §2.3 M1–M7）

| # | 維度 | 合約對應 | Gate | 1 分 | 3 分 | 5 分 |
|---|------|----------|------|------|------|------|
| C13 | Theme Baseline（M1 / M2） | M1 / M2 | **Soft** | 背景仍為冷藍灰 | 顏色已換但 dark 模式有 1 處極端 regression | M1：預設 system theme 背景為 warm white（`#ffffff` / `#31302e`），無冷藍灰；M2：light ↔ dark 切換無白字在白底 / 黑字在黑底；各一張截圖 |
| C14 | Agent Header & Tabs（M3 / M4） | M3 / M4 | Hard | 任一 agent accent 丟失 | accent 保留但 tab underline 粗細 / 位置錯誤 | 三個 agent tab 切換 accent 色皆保留（Claude 橘 / Copilot 綠 / Gemini 紫）；agent 內 section tabs 底部 underline 為 `2px`、active 色 = agent accent；截圖 |
| C15 | Sidebar Tile（M5） | M5 | Hard | collapse / expand 破版 | 樣式切換但 active 邊框粗細 / 圓角錯誤 | Sidebar collapse / expand 正常；agent tile active 樣式為 `2px solid <accent>` + `rounded-[8px]`；截圖 |
| C16 | Empty State（M6） | M6 | Hard | `py-16` 未升 `py-24` | 間距升級但 title 字級不對 | 於 Skills / Plugins / Extensions 任一 empty state DOM inspector 驗證：容器 `padding: 96px 0`（py-24）、icon `height: 40px` / `width: 40px`、title 字級 22px / weight 700 / letter-spacing -0.25px、description 字級 14px + `text-muted-foreground`；截圖 + computed style |
| C17 | Save Status Pill（M7） | M7 / D6 | Hard | 仍為純文字 | 只有 1–2 態為 pill | Ctrl+S 觸發後 Status bar 三態（saving → unsaved → saved）皆為 pill；每態截圖 |

### 2.4 回歸保護（合約 §2.4 R1–R3）

| # | 維度 | 合約對應 | Gate | 1 分 | 3 分 | 5 分 |
|---|------|----------|------|------|------|------|
| C18 | IPC / Main / Preload / Shared Untouched | R1 | Hard | 有任何 diff | 只有 whitespace 變更 | `git diff --stat main..HEAD -- src/main src/preload src/shared` **回傳空**；evidence 保留此指令輸出 |
| C19 | Test Class Coupling | R2 | Hard | 任一被點名的 class 斷言破裂 | `bg-accent/60` 保留但 `h-6 w-6` / `italic` 有變動（即便在 Exclusion 範圍內） | `ExtensionRow.tsx` 仍輸出 `bg-accent/60`（grep 驗證）；`SkillsEditor.test.tsx:~339` 與 `GeminiSessionsView.test.tsx:~179` 因 §3 Exclusion 未動；V3 通過 |
| C20 | Radix Primitives No Regression | R3 | **Soft** | Radix 內部樣式破圖 | Dialog / Switch / ScrollArea 有輕微視覺抖動但不阻斷操作 | Dialog 開關、Switch toggle、ScrollArea 滾動、Tooltip hover 於雙主題視覺正常；必要時截圖 |

### 2.5 合約紀律（合約 §1 / §3 / §4 / AGENTS.md DoD）

| # | 維度 | 合約對應 | Gate | 1 分 | 3 分 | 5 分 |
|---|------|----------|------|------|------|------|
| C21 | Scope Discipline（只動允許清單） | §1 | Hard | diff 包含非 §1 檔案 | 僅動允許清單但對其中某檔做了 §1.x 描述外的修改 | `git diff --name-only main..HEAD` 結果 ⊆ §1 的七檔白名單（`index.css`, `tailwind.config.js`, `App.tsx`, `Sidebar.tsx`, `ui/button.tsx`, `ui/card.tsx`, `ui/tabs.tsx`, `shared/ExtensionRow.tsx`, `shared/ExtensionListLayout.tsx`）加上 `evidence/feat-018/**`、`feature_list.json`、`progress.md`、`session-log.jsonl`；每一處改動可指向 §1.x 條目 |
| C22 | Exclusions Respect | §3.1 / §3.2 / §3.3 / §3.4 | Hard | 觸碰任一排除項 | 留下 TODO / 註解暗示要動排除項 | 下列 grep / diff 全部通過：`git diff --stat main..HEAD -- src/renderer/main.tsx src/renderer/components/editors src/renderer/components/agents src/renderer/**/__tests__ src/main src/preload src/shared src/renderer/hooks src/renderer/lib scripts docs vite.config.ts tsconfig*.json` 回傳空；`package.json` dependencies 無新增；AGENTS.md / CLAUDE.md / docs/ARCHITECTURE.md 無 diff；`progress.md` 僅「上次 Session 結束點」段落有改 |
| C23 | Phase Commit Hygiene | §4.2 / §4.4 | **Soft** | 單一巨型 commit 無分期 | 分期 commit 但訊息不符 Conventional Commits | 5 個 Phase 皆獨立 local commit（或經共識於 §5 紀錄 squash）；訊息符合 `refactor(ui): ...` / `style(tokens): ...` 格式；`git log --oneline main..HEAD` 存證 |
| C24 | Rollback Readiness | §4.4 | **Soft** | 無法安全 revert | 可 revert 但需手動調解 conflict | 任一 Phase commit 可獨立 `git revert --no-commit <sha>` 成功（dry-run）；或 `git checkout main -- <§1 檔案清單>` 可完整撤回；執行紀錄存證 |
| C25 | State Files Sync | AGENTS.md DoD | Hard | `feature_list.json` 未更新 | status 更新但 evidence 空字串 | `feature_list.json` feat-018 `status: "done"` 且 `evidence` 填入至少三項具體指令結果摘要（typecheck / lint / test）；`progress.md` 快照列出 feat-018；`session-log.jsonl` append 恰好一行合法 JSON |

**總計：25 個維度 / 19 個 Hard Gate / 6 個 Soft Gate。**

> 我相對於 Planner 草稿的 18 維度做了**拆分、重新分組、補綱**：把合約 §2.1（5 項）、§2.2（7 項）、§2.3（7 項）、§2.4（3 項）、紀律（5 項）完整映射為 25 條，確保合約每一條都有專屬評分點，不再讓 M1–M7 合併進單一 C12。

---

## 3. Pass / Fail Gate

### 3.1 Hard Gate（簽署必備，必 5/5）

`C1 C2 C3 C4 C5 C6 C7 C8 C9 C11 C12 C14 C15 C16 C17 C18 C19 C21 C22 C25`（共 19 項）

任一項 <5 → **拒簽**。Planner 須補 commit 修正、重跑對應 evidence 指令、我重新填分。

### 3.2 Soft Gate（最低 3 分可接受）

`C10 C13 C20 C23 C24`（共 6 項……抱歉，應為 **5 項**，我已核對）

> 修正：`C10, C13, C20, C23, C24` = 5 項 Soft（Typography / Theme Baseline / Radix / Commit Hygiene / Rollback）。19 Hard + 6 Soft 原為誤寫，實際 19 + 5 = **25** 維度相符。

Soft Gate 若 3 分，我必須於 Scoring Sheet `Notes` 註記「為何接受 + 後續追蹤 item」。

### 3.3 一票否決（Instant Fail）

以下任一觸發 → 整份合約判 **FAIL**，不進入計分、不可協商：

| # | 情境 | 檢查方式 |
|---|------|---------|
| IF1 | `src/main/**` / `src/preload/**` / `src/shared/**` 有任何 diff | `git diff --stat main..HEAD -- src/main src/preload src/shared` 非空 |
| IF2 | `src/renderer/components/editors/**` 任一檔被修改 | 同上 path |
| IF3 | `src/renderer/components/agents/**` 任一檔被修改 | 同上 path |
| IF4 | §1.3 未列入的 `src/renderer/components/ui/**` 檔案被修改（`dialog.tsx`, `input.tsx`, `label.tsx`, `scroll-area.tsx`, `separator.tsx`, `switch.tsx`, `textarea.tsx`, `remove-button.tsx`, `JsonEditor.tsx`, `badge.tsx`） | `git diff --name-only` 與排除清單交集非空 |
| IF5 | `src/renderer/**/__tests__/**/*.test.tsx` 被主動修改（非因 R2 被動觸發） | diff 命中測試路徑，且 §5.2 無對應合約變更紀錄 |
| IF6 | 引入新 npm 套件 | `git diff main..HEAD -- package.json` 含 `"dependencies"` / `"devDependencies"` 新增項 |
| IF7 | AGENTS.md / CLAUDE.md / docs/ARCHITECTURE.md 有 diff（未走 §6） | `git diff --stat` 命中 |
| IF8 | `src/renderer/main.tsx` 被修改 | diff 命中 |
| IF9 | 未經 §6 流程擅改合約 §1 / §2 / §3 | `sprint-contract-feat-018.md` diff 命中上述段落且 §5.2 無新列 |
| IF10 | `feature_list.json` 除 feat-018 外任一 feature 的 status 或結構被改 | diff 顯示其他 feature 欄位變動 |

---

## 4. Per-Phase Checkpoint（對應合約 §4.2）

每個 Phase 結束、在 Planner 下 `git commit` 之前，我依下表檢查。**每 Phase 都包含 Scope/Exclusion 重掃**，不只在 Phase E。

| Phase | 交付範圍 | 我在這個 Phase 評分的維度 | Phase 內立刻執行的指令 | 通過條件（此 Phase） |
|-------|----------|---------------------------|------------------------|----------------------|
| **A**：tokens + tailwind（`index.css`, `tailwind.config.js`） | §1.1 | C1, C2, C3（防 token 換值擊碎 snapshot）、C6, C7（token 層面）、C21, C22 | `bun run typecheck`、`bun run lint`、`bun run test`、`git diff --name-only main..HEAD` | 3 指令全綠；diff ⊆ `{index.css, tailwind.config.js}`；dev server 可啟動 |
| **B**：`App.tsx`（§1.2） | §1.2 | C1, C2, C10, C11, C13, C14, C17, C21, C22 | 同上 + 啟動 `bun run dev` 截 M1–M4、M7 | 4 指令綠 + M1–M4 + M7 截圖；diff 新增檔案 ⊆ `{App.tsx}` |
| **C**：Sidebar + ui primitives（`Sidebar.tsx`, `ui/button.tsx`, `ui/card.tsx`, `ui/tabs.tsx`） | §1.3 | C1, C2, C3, C7, C8, C9, C15, C20, C21, C22 | 同上 + M5 截圖 + DevTools 取 CTA computed style（light/dark） | 指令綠；M5 + CTA 雙主題截圖；diff 新增 ⊆ §1.3 四檔；Radix 元件（Dialog / Switch）手動操作無 regression |
| **D**：shared 列表（`ExtensionRow.tsx`, `ExtensionListLayout.tsx`） | §1.4 | C1, C2, **C3（最高警戒）**, C7, C16, C19, C21, C22 | `bun run test -- ExtensionRow` 單獨跑 + M6 截圖 + `grep -n "bg-accent/60" src/renderer/components/shared/ExtensionRow.tsx` | 指令全綠；grep 仍找得到 `bg-accent/60`；M6 DOM inspector 確認 `py-24 / h-10 w-10 / 22px title / 14px desc`；diff 新增 ⊆ §1.4 兩檔 |
| **E**：收尾 | 全部 | 全部 25 維度 | `bun run typecheck && bun run lint && bun run test && bash scripts/check-architecture.sh && bun run build`（V1–V5 串跑）；`npx @axe-core/cli` 雙主題；`git diff --stat main..HEAD`；`git log --oneline main..HEAD` | 19 Hard 全 5 分 + 6 Soft 全 ≥3 分；IF1–IF10 皆未觸發；Scoring Sheet §6 填滿；Sign-off §7 可開始簽 |

### 4.1 每 Phase 結束的檢查清單（Evaluator 口訣）

```text
[ ] 此 Phase 僅動了合約 §1.x 白名單（對照 `git diff --name-only`）
[ ] typecheck + lint + test 皆綠
[ ] 此 Phase 對應的 M/D/R 驗證點都有證據檔（路徑見 §5）
[ ] IF1–IF10 皆未觸發（逐一重掃）
[ ] ExtensionRow 的 `bg-accent/60` 若被動過，V3 是否仍綠
[ ] commit message 符合 Conventional Commits
[ ] 此 commit 可獨立 `git revert --no-commit` dry-run 不衝突
```

---

## 5. Evidence 收集要求

證據一律置於 `evidence/feat-018/`（合約 §2.2 D7 已允許此新目錄屬 Scope 例外）。檔名規範：`phase-<a|b|c|d|e>-<criterion>-<artifact>.<ext>`。若某 Phase 無法產出（例：Phase A 無 UI 可截圖），在 Scoring Sheet `Notes` 標記 `N/A - see Phase X`。

| 驗證點 | 證據形式 | 建議路徑 |
|--------|----------|----------|
| V1 typecheck | `bun run typecheck` 完整 stdout（含 exit code） | `evidence/feat-018/phase-{a..e}-v1-typecheck.txt` |
| V2 lint | `bun run lint` 完整 stdout，明確顯示 `0 errors / 0 warnings` | `evidence/feat-018/phase-{a..e}-v2-lint.txt` |
| V3 test | `bun run test` 尾段含 `Test Files 21 passed (21)` 與 `Tests 378 passed (378)` | `evidence/feat-018/phase-{a..e}-v3-test.txt` |
| V4 architecture | `bash scripts/check-architecture.sh` 輸出 | `evidence/feat-018/phase-e-v4-arch.txt` |
| V5 build | `bun run build` 尾段含 bundle size + `built in` | `evidence/feat-018/phase-e-v5-build.txt` |
| D1 tokens | `grep -nE "notion-blue\|border-subtle\|shadow-notion\|warm-white\|warm-dark" src/renderer/index.css tailwind.config.js` | `evidence/feat-018/phase-a-d1-tokens.txt` |
| D2 borders | `grep -rE "border-\[#\|borderColor: *'#" src/renderer`（應回傳空） | `evidence/feat-018/phase-e-d2-border.txt` |
| D3 shadows | `grep -rE "shadow-notion-card\|shadow-notion-deep" src/renderer` | `evidence/feat-018/phase-e-d3-shadow.txt` |
| D4 CTA color | DevTools Computed style 截圖，CTA button `background-color` light / dark | `evidence/feat-018/phase-c-d4-cta-light.png` / `-dark.png` |
| D5 typography | 各級 heading 截圖 + computed `font-size` / `letter-spacing` / `line-height` | `evidence/feat-018/phase-b-d5-type.png` |
| D6 pill | Status bar 三態截圖 + computed `border-radius: 9999px` | `evidence/feat-018/phase-b-d6-pill-{saving,unsaved,saved}.png` |
| D7 contrast | axe-core JSON / Lighthouse HTML（雙主題）；fallback = 手算 md | `evidence/feat-018/phase-e-d7-axe-light.json` / `-dark.json` / `-contrast-manual.md` |
| M1 | 預設主題首頁截圖 | `evidence/feat-018/phase-b-m1.png` |
| M2 | light / dark 對切截圖 | `evidence/feat-018/phase-b-m2-light.png` / `-dark.png` |
| M3 | 三個 agent tab 切換截圖 | `evidence/feat-018/phase-b-m3-{claude,copilot,gemini}.png` |
| M4 | agent 內 section tabs underline 截圖 | `evidence/feat-018/phase-b-m4.png` |
| M5 | Sidebar collapse / expand 截圖 | `evidence/feat-018/phase-c-m5-{collapsed,expanded}.png` |
| M6 | Empty state + DOM inspector computed style | `evidence/feat-018/phase-d-m6.png` |
| M7 | Save status 三態 | `evidence/feat-018/phase-d-m7-{saving,unsaved,saved}.png` |
| R1 | `git diff --stat main..HEAD -- src/main src/preload src/shared`（應回傳空） | `evidence/feat-018/phase-e-r1-diff.txt` |
| R2 | `bun run test -- ExtensionRow.test.tsx` 單獨輸出 + `grep -n "bg-accent/60" src/renderer/components/shared/ExtensionRow.tsx` | `evidence/feat-018/phase-d-r2-extensionrow.txt` |
| R3 | Dialog / Switch / ScrollArea 截圖（若測試路徑可觸發） | `evidence/feat-018/phase-c-r3-radix.png` |
| Scope / Exclusions | `git diff --name-only main..HEAD`、`git log --oneline main..HEAD` | `evidence/feat-018/phase-e-scope-diff.txt` / `-commits.txt` |

---

## 6. Risk Flags（我主動掃描的訊號）

合約 §4.3 列出風險；我將其轉譯為「看到這個就減分 / 拒簽 / 一票否決」的具體訊號。

| # | 訊號（可自動偵測） | 偵測指令 | 違反 | 我的動作 |
|---|---|---|---|---|
| RF1 | `.tsx` 出現 `border-[#...]` 或 inline `borderColor: '#...'` | `grep -rnE "border-\[#\|borderColor: *'#" src/renderer` | D2 / C7 | 拒簽此 Phase，要求 refactor |
| RF2 | `ExtensionRow.tsx` diff 中不再包含 `bg-accent/60` | `grep -n "bg-accent/60" src/renderer/components/shared/ExtensionRow.tsx` | R2 / C3 / C19 | 立即判 Phase D 失敗，啟動合約 §6 |
| RF3 | `index.css` 仍保留 `220 90% 60%` 舊 HSL | `grep -n "220 90%\|0d0d0f" src/renderer/index.css` | D4 / C9 | 拒簽 Phase A |
| RF4 | Card 元件缺 `shadow-notion-card` | `grep -n "shadow-notion-card" src/renderer/components/ui/card.tsx` 無命中 | D3 / C8 | 拒簽 Phase C |
| RF5 | `src/main/**` 或 `src/preload/**` 或 `src/shared/**` 於 diff | `git diff --stat main..HEAD -- src/main src/preload src/shared` 非空 | R1 / C18 / **IF1** | **一票否決** |
| RF6 | `src/renderer/components/editors/**` 或 `agents/**` 被動 | `git diff --name-only main..HEAD` 命中 | §3.1 / **IF2 / IF3** | **一票否決** |
| RF7 | `__tests__/*.test.tsx` 出現於 diff（非 R2 被動觸發） | `git diff --name-only` 命中 `__tests__` | §3.1 / **IF5** | **一票否決** |
| RF8 | `package.json` `dependencies` / `devDependencies` 新增 | `git diff main..HEAD -- package.json` | §3.2 / **IF6** | **一票否決** |
| RF9 | Radix 元件視覺失真 | 手動截圖比對；Dialog / Switch 樣式偏離原樣 | R3 / C20 | 要求於包裝層修正，不得動 Radix 本身 |
| RF10 | Dark 主題主文字對比 <4.5:1 | axe-core / 手算 | D7 / C12 | 退回 Phase A 調 token |
| RF11 | Empty state `py-16` 未升 `py-24` 或 title 未用 22px | DOM inspector 或 `grep -n "py-16\|py-24" src/renderer/components/shared/ExtensionListLayout.tsx` | M6 / C16 | 拒簽 Phase D |
| RF12 | Status bar 三態仍為純文字 | DOM inspector | D6 / C11 / C17 | 要求補 `.badge-notion` |
| RF13 | `feature_list.json` feat-018 `status: "done"` 但 `evidence` 空 | `jq '.features[] \| select(.id=="feat-018") \| .evidence' feature_list.json` 回傳 `""` | C25 | 拒簽 Phase E |
| RF14 | AGENTS.md / CLAUDE.md / docs/ARCHITECTURE.md 出現 diff | `git diff --stat main..HEAD -- AGENTS.md CLAUDE.md docs/ARCHITECTURE.md` 非空 | §3.2 / **IF7** | **一票否決** |
| RF15 | `src/renderer/main.tsx` 於 diff | `git diff --name-only` 命中 | §3.1 / **IF8** | **一票否決** |
| RF16 | ExtensionRow 改動使 `selected` 狀態不再依 `--accent` token 連動 | 手動觸發 selected 狀態 + DevTools | §1.4 備註 / C19 | 拒簽 Phase D |
| RF17 | `progress.md` 除「上次 Session 結束點」段外有改動 | `git diff main..HEAD -- progress.md` 手動比對 | §3.4 | 要求 revert 多餘區段 |
| RF18 | `session-log.jsonl` append 超過一行，或格式非合法 JSON | `wc -l` diff / `jq -c .` 逐行解析 | §3.4 | 要求精簡至單行 |

---

## 7. Scoring Sheet 範本（實作完成後填分）

每個 Phase commit 後填入 `Phase Scored` / `Score` / `Evidence Path` / `Notes`。Phase E 完成時 25 列全填，然後彙總至 §8 Sign-off。

| # | Criterion | Gate | Phase Scored | Score (1-5) | Evidence Path | Notes |
|---|-----------|------|--------------|-------------|---------------|-------|
| C1 | TypeCheck | Hard | E | _ | `phase-e-v1-typecheck.txt` | |
| C2 | Lint | Hard | E | _ | `phase-e-v2-lint.txt` | |
| C3 | Test Suite | Hard | D | _ | `phase-d-v3-test.txt` | |
| C4 | Architecture | Hard | E | _ | `phase-e-v4-arch.txt` | |
| C5 | Build | Hard | E | _ | `phase-e-v5-build.txt` | |
| C6 | Token Coverage | Hard | A | _ | `phase-a-d1-tokens.txt` | |
| C7 | Border Discipline | Hard | E | _ | `phase-e-d2-border.txt` | |
| C8 | Shadow System | Hard | C | _ | `phase-e-d3-shadow.txt` | |
| C9 | CTA Color | Hard | C | _ | `phase-c-d4-cta-{light,dark}.png` | |
| C10 | Typography | **Soft** | B | _ | `phase-b-d5-type.png` | |
| C11 | Pill Badge | Hard | B | _ | `phase-b-d6-pill-*.png` | |
| C12 | Contrast | Hard | E | _ | `phase-e-d7-axe-*.json` | |
| C13 | Theme Baseline | **Soft** | B | _ | `phase-b-m1.png` / `-m2-*.png` | |
| C14 | Agent Header & Tabs | Hard | B | _ | `phase-b-m3-*.png` / `-m4.png` | |
| C15 | Sidebar Tile | Hard | C | _ | `phase-c-m5-*.png` | |
| C16 | Empty State | Hard | D | _ | `phase-d-m6.png` | |
| C17 | Save Pill | Hard | D | _ | `phase-d-m7-*.png` | |
| C18 | IPC/Main/Preload/Shared | Hard | E | _ | `phase-e-r1-diff.txt` | |
| C19 | Test Class Coupling | Hard | D | _ | `phase-d-r2-extensionrow.txt` | |
| C20 | Radix No Regression | **Soft** | C | _ | `phase-c-r3-radix.png` | |
| C21 | Scope Discipline | Hard | E | _ | `phase-e-scope-diff.txt` | |
| C22 | Exclusions Respect | Hard | E | _ | `phase-e-scope-diff.txt` | |
| C23 | Commit Hygiene | **Soft** | E | _ | `phase-e-commits.txt` | |
| C24 | Rollback Readiness | **Soft** | E | _ | `git revert` dry-run 紀錄 | |
| C25 | State Files Sync | Hard | E | _ | diff of `feature_list.json` / `progress.md` / `session-log.jsonl` | |

**彙總欄**：
- Hard Gate 總分（需 **95/95**，19 項 × 5）：`_/95`
- Soft Gate 總分（需 ≥ **15/30**，6 項 × 最低 3）：`_/30`
- 一票否決觸發清單（應為空）：`[]`

---

## 8. Sign-off

僅當以下條件**全部**成立才可簽署：

1. §7 Scoring Sheet 25 列全部填分。
2. 19 個 Hard Gate 皆為 5。
3. 5 個 Soft Gate 皆 ≥3，且若為 3 必有 Notes 記錄追蹤 item。

   > Soft Gate 實為 5 項（C10 / C13 / C20 / C23 / C24）；§3.2 原敘述有誤，以此為準。
4. §3.3 IF1–IF10 皆未觸發。
5. 證據檔皆存於 `evidence/feat-018/`，檔名符合 §5 規範。

簽署欄：

- [ ] **Planner (Claude 主對話)**：`___` — 簽署時間 `____-__-__`
- [ ] **Evaluator (sub-agent `aefe1f03050a7c28d`)**：`___` — 簽署時間 `____-__-__`

簽署條款：

1. 雙方均確認 §7 Scoring Sheet 已填滿。
2. 任一 Hard Gate <5、任一 Soft Gate <3、或觸發任一 Instant Fail → 不得簽署；走合約 §6 變更流程。
3. 簽署後 `feature_list.json` feat-018 才能改為 `"status": "done"` 並 commit。

---

## 9. 判失敗後的復原路徑

我只列處置路徑，不代 Planner 寫修正方案：

1. **一票否決（§3.3）**：依合約 §4.4 `git revert <sha>` 回滾對應 Phase，走 §6 合約變更流程後才能重啟。
2. **Hard Gate <5**：不需 revert，補 commit 修正該維度、重跑對應 evidence、刷新 §7 對應列。
3. **Soft Gate <3**：若我在 Notes 欄寫「接受」則保留；若「不接受」則同 2 處理。
4. **連續三輪（§5.2）無共識**：依合約 §5.2 精神上報使用者裁決。

---

## 附錄 A：實作者注意事項（我預先替 Planner 標示的高風險面向）

以下不是 TODO，是我觀察 Planner 草稿與合約後，評估最容易翻車的 10 個面向。Planner 自行決定如何規避：

1. **Phase A 結束前務必跑完 `bun run test`**。token 換值最容易擊碎既有 snapshot / class 斷言；我在 §4 已把 C3 列為 Phase D 主評分，但 Phase A 就要先驗。
2. **`ExtensionRow.tsx` 的 `bg-accent/60` 是紅線**。改動前後各 `grep -n "bg-accent/60"` 一次；R2 被我列為 C19 Hard + RF2，屬高優先級。
3. **新增 CSS variables 務必同時在 `:root` 與 `.dark`（或 `[data-theme=...]`）定義**。漏一邊就會在 dark 模式破圖，觸發 RF10。
4. **Tailwind `theme.extend.colors` 的 naming 要與 DESIGN.md §9 對齊**。我會用 grep 逐一核對 10 個 token；naming 不一致 = C6 降為 3。
5. **border 規範（C7 / RF1）**：只用 `.border-whisper` / `.border-b-whisper` / `border-border` / `--border-subtle`；絕對不碰 `border-[#...]` 與 inline `borderColor`。
6. **CTA variant 命名**：合約 §1.3 要求 `Button` 新增 `variant: 'notion'`，同時 `default` 改指 `#0075de`。若現有測試斷言 `variant="default"` 的 class，只要 class 名不變、color token 連動即可，不破 R2。
7. **shadow 只用兩個 utility**：`.shadow-notion-card` / `.shadow-notion-deep`；Card root 直接套。C8 / RF4 有明確 grep。
8. **typography 建議 `@layer components` 建 utility**（如 `.text-display-64`、`.text-card-title`）並同時綁 letter-spacing / line-height；散落手寫會讓 C10 降分。
9. **status bar 三態 pill**：直接把 `Saving / Unsaved / Saved` 包進 `<span class="badge-notion">`，顏色用 `--badge-blue-bg` / `--badge-blue-text`；三態都要 pill（C11 / C17 / M7）。
10. **每個 Phase commit 前**必跑 `git diff --name-only main..HEAD`，自查是否只動 §1 白名單。IF1–IF10 觸發後無協商空間。

---

## 附錄 B：合約盲點與不一致（獨立觀察，不修改合約）

我在撰寫本 rubric 時發現下列合約內部張力，僅供 Planner 與合約維護者知悉，**不在本 rubric 執行時修正**：

| # | 觀察 | 嚴重度 |
|---|------|--------|
| B1 | §2.4 R1 要求「無任何 `src/main/`、`src/preload/`、`src/shared/` 檔案變更」，但 §3.1 使用 `src/main/**`、`src/preload/**` 通配符。實務上一致，但 R1 未明示 `**`，極嚴格解讀時可能誤判「子目錄不算檔案」。我採通配符解讀。 | Low |
| B2 | §4.3 風險表仍有「不達 WCAG AA 則調整 tokens」敘述（§5.4 留置觀察 #1 已點出）；D7 已升級為 axe-core 自動量測。我以 D7 為準。 | Low |
| B3 | §3.2「不改動 `feature_list.json` 的 feature 結構（只改 feat-018 的 status/evidence）」可能與合約最終要求 feat-018 改為 `done` 並填 evidence 衝突——實務上一致（因為 feat-018 自己被允許改），但句式可能誤讀。我採 IF10 限制「除 feat-018 外」。 | Low |
| B4 | §1.3 `Card` root className 含 `bg-card`，但 §1.1 token 重寫未明示 `--card` / `bg-card` 的新值。我評 C8 時會要求 Planner 保證 `--card` 有對應 warm token 而非冷灰；若 Planner 沿用舊值，C6 可能降為 3。 | Medium |
| B5 | §1.2 要求 tabs 改為「底部 `2px` underline，active 顯示 agent accent 色」；但現有 `ui/tabs.tsx` 與 App 層 tabs 並非同一層級（App 層可能用原生 `<button>`）。我評 C14 / C15 時只檢查 DOM 最終表現，不追究實作路徑；但 Planner 若誤動 `ui/tabs.tsx` 的 TabsList / TabsTrigger 以外部分，仍觸 IF4。 | Medium |
| B6 | §2.2 D7 的 axe-core fallback 「記錄在 §5.2 Round 對應欄位」——若實作過程未觸發 §5.2 新列，則此 fallback 無欄位可填。我採折衷：fallback 另存 `evidence/feat-018/phase-e-d7-contrast-manual.md` 並於 §5.2 註記，兩處並存。 | Low |
| B7 | §4.2 Phase E 總估時 15 分鐘僅覆蓋 V1–V5 + state file，未含 D1–D7 + M1–M7 逐項驗證與 evidence 整理；實作時間可能被低估。僅為時間風險，不影響判分。 | Low |

以上僅為觀察紀錄。我不修改合約——若任一觀察實際造成判分爭議，將走合約 §6 流程處理。

---

**End of Rubric v1.0 — signed pending implementation.**
