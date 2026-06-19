# Legacy Harness（凍結封存）

> **這些檔案已凍結，不再維護。** 2026-06-19，本專案的狀態追蹤與 session handoff 從這套自訂 root harness **完整切換**到 Trellis（`.trellis/`）。此目錄僅供查閱歷史。

## 為什麼遷移

自訂 harness 與 Trellis 兩套狀態系統並存，造成重複維護與漂移風險。Trellis 對每個元件都有原生對應，因此完整切換到 Trellis 作為唯一狀態來源。

## 對應關係（舊 → 新）

| 舊（本目錄，凍結） | 新（Trellis，現役） |
|---|---|
| `feature_list.json` | 每個 task 的 `task.json`（status/evidence）+ `task.py list`。歷史 feat-001~019 整併於 archive task `06-19-legacy-feat-001-019`；feat-020 為現役 `06-19-feat-020-auto-update` |
| `PROGRESS.md` / `SESSION-HANDOFF.md` | `.trellis/workspace/<dev>/journal-N.md` + active-task pointer + task 的 `prd.md` / `implement.md` |
| `SESSION-LOG.jsonl` | `.trellis/workspace/Madao/journal-1.md`（001–014 已整併回填；`add_session.py` 續寫） |
| End of Session 4-檔儀式 | Trellis Phase 3（驗證 → spec update → commit → `add_session.py` → `task.py archive`），見 `AGENTS.md` |
| `clean-state-checklist.md` | Trellis 品質閘 / `trellis-check` skill |
| `init.sh` | 起手式見 `AGENTS.md` Startup Workflow；建置驗證指令見 `AGENTS.md` Commands 區（`scripts/check-architecture.sh` 仍為現役腳本，**未**凍結） |

## 內容

- `feature_list.json` — 20 個 feature 的最終快照（遷移時保存）
- `PROGRESS.md` — 工作記憶 dashboard + 最近 session 區塊
- `SESSION-HANDOFF.md` — 最後一輪 handoff 敘事
- `SESSION-LOG.jsonl` — 14 筆 append-only session 紀錄
- `clean-state-checklist.md` — 舊的 end-of-session 二元閘清單
- `init.sh` — 舊的啟動驗證腳本（含過時的 `[0/6]` harness state check）

> 完整原始版本另存於 git 歷史。
