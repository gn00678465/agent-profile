# Design — Migrate harness to Trellis

## 對應關係（遷移依據）

| 自訂 harness | Trellis 原生對應 | 遷移動作 |
|---|---|---|
| `feature_list.json` | 每個 task 的 `task.json` + `task.py list` | feat-001~019 → legacy task prd 附錄；feat-020 → 新 planned task |
| `PROGRESS.md` / `SESSION-HANDOFF.md` | workspace journal + active-task pointer + task prd/implement | 內容併入 journal + 凍結原檔 |
| `SESSION-LOG.jsonl` | `.trellis/workspace/Madao/journal-N.md`（`add_session.py`） | 14 筆整併成一個 journal 區塊 |
| End of Session 4-檔儀式 | Trellis Phase 3（驗證 → spec update → commit → add_session） | 改寫 AGENTS.md |
| `clean-state-checklist.md` | Trellis 品質閘 / `trellis-check` | 凍結，內容由 spec 承擔 |
| 專案慣例（IPC / guards / cliRunner / layer） | `.trellis/spec/`（backend / shared / big-question） | 下放至 spec，AGENTS.md 留薄指標 |

## 切換邊界（保留 vs 退役）

**退役（凍結到 `docs/legacy-harness/`）**
- `feature_list.json`、`PROGRESS.md`、`SESSION-HANDOFF.md`、`SESSION-LOG.jsonl`、`clean-state-checklist.md`、`init.sh`
- `init.sh` 的 `[0/6]` harness 狀態檢查邏輯過時 → 隨檔凍結。其建置驗證指令序列（bun install/typecheck/build/test/lint + arch）價值已存在於 `AGENTS.md` Commands 區與 Trellis 品質閘。

**保留現役**
- `scripts/check-architecture.sh`（real 腳本，被 Trellis 品質閘引用，**不在凍結清單**）
- `AGENTS.md` 的專案技術內容（IPC pattern、security guards、cliRunner 規則）→ 下放 `.trellis/spec/`，AGENTS.md 留薄指標 + 指向 `.trellis/workflow.md`
- `AGENTS.md` 末端 Trellis managed block → 不動

## 忠實性保證

- `feature_list.json` 原始 JSON → 完整貼入 legacy task prd 附錄（不改寫）
- `SESSION-LOG.jsonl` 14 筆 → journal 區塊保留每筆 date/goals/completed/verify/next（精煉但不丟資訊）
- git 歷史另存完整原始版本

## 風險

- 純狀態/文件遷移，不動產品碼；驗證閘只確認沒誤改。
- `task.py start` 需 session identity；Claude Code 提供 `CLAUDE_SESSION_ID`。若失敗依 workflow.md 用 `TRELLIS_CONTEXT_ID`。
