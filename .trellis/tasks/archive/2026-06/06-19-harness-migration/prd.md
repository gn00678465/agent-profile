# Migrate harness to Trellis

## Goal

本專案目前**兩套狀態系統並存**：自訂 root harness（`feature_list.json`、`PROGRESS.md`、`SESSION-HANDOFF.md`、`SESSION-LOG.jsonl`、`clean-state-checklist.md`、`init.sh` + `AGENTS.md` 的 Startup / Definition of Done / End of Session 儀式）與 Trellis（`.trellis/`）。Trellis 對 root harness 的每個元件都有原生對應，雙系統並存造成重複維護與漂移風險。

目標：**完整切換到 Trellis 作為唯一狀態來源**，把歷史整併進 Trellis，凍結封存舊檔。

## Requirements

- **R1 完整切換**：Trellis 成為唯一狀態來源；`AGENTS.md` 的 Startup / Definition of Done / End of Session 改走 Trellis 流程。
- **R2 歷史整併**：feat-001~019 整併為**一個已封存 legacy task**（忠實保留 `feature_list.json` 快照）；feat-020 另開為 planned Trellis task。
- **R3 session 回填**：`SESSION-LOG.jsonl` 14 筆（001–014）整併寫入 `.trellis/workspace/Madao/journal-1.md`，更新 index。
- **R4 凍結舊檔**：6 個 root 狀態檔移至 `docs/legacy-harness/` + deprecation README；清掉現役引用。
- **R5 慣例下放**：專案載入性規則（IPC envelope、`assertSafePath/assertSafeName`、cliRunner 白名單、layer 邊界）保留並下放至 `.trellis/spec/`，`AGENTS.md` 僅留薄指標。
- **約束**：純文件/狀態遷移，**不動產品程式碼**；`scripts/check-architecture.sh` 維持現役（被 Trellis 品質閘引用）。

## Acceptance Criteria

- [ ] `task.py list` → feat-020 為 planned；`list-archive` → legacy + migration task 已封存
- [ ] root 目錄不再有 6 個舊狀態檔；`docs/legacy-harness/` 內可查歷史
- [ ] `grep` 現役引用（除 `docs/legacy-harness/`）回傳 0 筆
- [ ] `AGENTS.md` Startup / DoD / End of Session 僅引用 Trellis 流程
- [ ] `.trellis/workspace/Madao/journal-1.md` 含 001–014 歷史區塊
- [ ] `bun run typecheck && bun run lint && bun run test && bash scripts/check-architecture.sh` 全綠（基線：378 tests、lint 0/0、arch 0 violations）

## Notes

- 決策已與使用者確認：完整切換 / 整併 legacy 紀錄 / 凍結封存 / 建立 Trellis task 執行。
- `00-bootstrap-guidelines` task（in_progress）為 trellis init bootstrap，與本次無關，維持不動。
