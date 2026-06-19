# Implement — Migrate harness to Trellis

## 有序 checklist

### 步驟 1 — 歷史匯入 Trellis
- [ ] 建立 legacy task：`task.py create "Legacy features feat-001~019 (imported)" --slug legacy-feat-001-019`
- [ ] 寫 legacy `prd.md`：19 feature 摘要表（id/name/status/evidence）+ `feature_list.json` 原始 JSON 附錄
- [ ] 封存：`task.py archive legacy-feat-001-019` → `.trellis/tasks/archive/2026-06/`
- [ ] backfill journal：`SESSION-LOG.jsonl` 001–014 整併區塊 → `.trellis/workspace/Madao/journal-1.md`
- [ ] 更新 `.trellis/workspace/Madao/index.md`（session 計數 + history 表）
- [ ] 建立 feat-020 planned task：`task.py create "feat-020 Marketplace auto-update Switch write path" --slug feat-020-auto-update`；prd 帶入 feature_list feat-020 description；保持 planning

### 步驟 2 — 改寫 AGENTS.md
- [ ] Startup Workflow → Trellis 起手式（讀 AGENTS.md + workflow.md、`task.py current --source`、`get_context.py`）
- [ ] Definition of Done → Trellis 版（prd 符合 + 品質閘全綠 + task.json completed + journal 記錄）
- [ ] End of Session → Trellis Phase 3 / `trellis:finish-work`
- [ ] 專案慣例下放 `.trellis/spec/`（backend/shared/big-question），AGENTS.md 留薄指標
- [ ] 保留 `scripts/check-architecture.sh` 引用；保留末端 Trellis managed block

### 步驟 3 — 凍結舊檔
- [ ] `mkdir -p docs/legacy-harness`
- [ ] `git mv feature_list.json PROGRESS.md SESSION-HANDOFF.md SESSION-LOG.jsonl clean-state-checklist.md init.sh docs/legacy-harness/`
- [ ] 新增 `docs/legacy-harness/README.md`（凍結聲明 + 對應表）
- [ ] grep 殘留引用並修正（重點：`.claude/`、`CLAUDE.md`、`eslint.config.mjs`、`package.json`）

### 步驟 4 — 收尾（Trellis Phase 3）
- [ ] `bun run typecheck && bun run lint && bun run test && bash scripts/check-architecture.sh` 全綠
- [ ] spec update（若適用）
- [ ] commit（conventional commits；逐項列出，勿 `git add .`）
- [ ] `add_session.py` 記錄本次 session
- [ ] `task.py archive 06-19-harness-migration`

## 驗證指令
```bash
python3 ./.trellis/scripts/task.py list
python3 ./.trellis/scripts/task.py list-archive
ls docs/legacy-harness/
grep -rn -e feature_list.json -e PROGRESS.md -e SESSION-HANDOFF.md -e SESSION-LOG.jsonl -e clean-state-checklist -e init.sh \
  --include='*.md' --include='*.json' --include='*.sh' --include='*.mjs' . | grep -v docs/legacy-harness
bun run typecheck && bun run lint && bun run test && bash scripts/check-architecture.sh
```

## Rollback
- 每步獨立 commit；任一步出錯可 `git revert` 該 commit。
- legacy/feat-020 task 建錯可 `task.py archive` 或手動刪目錄。
