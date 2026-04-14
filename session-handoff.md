# Session Handoff

三個獨立的動作，依序執行：

---

## 1. Checklist（離開前確認）

- [ ] `bun run test` — 0 failures（預期：378 pass / 21 files）
- [ ] `bun run lint` — 0 errors
- [ ] `bun run typecheck` — 0 errors
- [ ] `feature_list.json` — 完成的 feature 已改為 `"status": "done"`，附上 evidence
- [ ] `progress.md` — 已加入本次 session 的歷史記錄（見下方範本）
- [ ] Commit 已建立，message 符合 Conventional Commits

---

## 2. 在 session-log.jsonl 追加一行

在 `session-log.jsonl` 末尾**另起一行**加入：

```
{"date":"YYYY-MM-DD","summary":"<一句話描述>","tests":<pass count>,"lint_errors":<count>,"lint_warnings":<count>}
```

範例：

```
{"date":"2026-04-15","summary":"對齊 feat-014 狀態文件；刪除測試死碼","tests":391,"lint_errors":0,"lint_warnings":40}
```

---

## 3. 在 progress.md 更新進行中工作（若有）

若某個 feature 仍 in-progress，在「已完成功能」表格下方補一段：

```markdown
### <feat-id>：<feature 名稱>

**狀態：** 🟡 in-progress

**已完成：**
- <具體完成項目>

**待完成：**
- [ ] <下次 session 的明確起點>

**阻礙：**
- <阻礙描述，或填「無」>
```

---

## 4. 下次 Session 的 Restart Path

新的 session agent 應依序：

1. 讀 `AGENTS.md`
2. 執行 `./init.sh`
3. 讀 `feature_list.json` — 找第一個 `in-progress` 或 `planned` 的 feature
4. 讀 `progress.md` — 找「待完成」清單
