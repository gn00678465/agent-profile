# Progress Log

## 專案狀態快照（2026-04-15）

**Branch:** `chore/harness-setup`
**Base:** `main`

### 已完成功能（feat-001 ～ feat-014）

| ID | 功能 | 狀態 |
|----|------|------|
| feat-001 | 專案基礎架構（Electron + React 19 + Vite） | ✅ done |
| feat-002 | 側邊欄 UI 與主題切換 | ✅ done |
| feat-003 | Agent 設定 JSON 編輯器 | ✅ done |
| feat-004 | MCP 伺服器管理 | ✅ done |
| feat-005 | Skills 管理（ZIP 安裝 / 符號連結） | ✅ done |
| feat-006 | Claude 外掛管理 | ✅ done |
| feat-007 | Gemini 擴充套件管理 | ✅ done |
| feat-008 | Session 查看（Claude / Gemini / Copilot） | ✅ done |
| feat-009 | Rules 編輯器 | ✅ done |
| feat-010 | 共用 UI 元件層（ExtensionRow / useItemLoader） | ✅ done |
| feat-011 | Copilot Subagents 管理 | ✅ done |
| feat-012 | 安全性強化（路徑遍歷防護） | ✅ done |
| feat-013 | 測試套件修復（bun run test vs bun test） | ✅ done |
| feat-014 | Harness 設定完善 | ✅ done |

---

## 阻礙與風險

| 風險 | 說明 |
|------|------|
| configHandlers.ts 過大 | ~1,000 行，`AGENTS.md` 已標注為 split candidate |

---

## 上次 Session 結束點

- **最後動作：** src 分層清理（`src/main.tsx` → `src/renderer/main.tsx`、刪除 Vite 範本死碼、移除 `src/test/` 重複測試）；合併 `CLAUDE.md` 內容至 `AGENTS.md`；更新 `docs/ARCHITECTURE.md`（新增 Electron Layers 區塊）
- **所有 14 個 feature 均已完成**
- **驗證狀態：** `bun run test` 378 pass / 0 fail（21 files）；`bun run lint` 0 errors / 40 warnings

> Session 歷史已移至 `session-log.jsonl`（append-only）。
