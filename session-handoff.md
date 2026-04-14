# Session Handoff

三個獨立的動作，依序執行：

---

## 1. Checklist（離開前確認）

- [ ] `bun run test` — 0 failures（預期：391 pass / 24 files）
- [ ] `bun run lint` — 0 errors
- [ ] `bun run typecheck` — 0 errors
- [ ] `feature_list.json` — 完成的 feature 已改為 `"status": "done"`，附上 evidence
- [ ] `progress.md` — 已加入本次 session 的歷史記錄（見下方範本）
- [ ] Commit 已建立，message 符合 Conventional Commits

---

## 2. 在 progress.md 新增歷史記錄（一行）

在「Session 歷史」表格最後加一行：

```
| YYYY-MM-DD | <一句話描述本次做了什麼> |
```

範例：

```
| 2026-04-14 | 修正 ESLint 遷移（0 errors）；對齊狀態文件 |
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
2. 讀 `CLAUDE.md`
3. 執行 `./init.sh`
4. 讀 `feature_list.json` — 找第一個 `in-progress` 或 `planned` 的 feature
5. 讀 `progress.md` — 找「待完成」清單
