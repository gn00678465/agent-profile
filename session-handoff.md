# Session Handoff Template

Copy this template at the end of each session and paste it into `progress.md` under the **Session 歷史** table, then fill it in.

---

## Handoff Checklist

Before closing the session, verify each item:

- [ ] `bun run test` — 0 failures (expected: 391 pass / 24 files)
- [ ] `bun run lint` — 0 errors
- [ ] `bun run typecheck` — 0 errors
- [ ] `feature_list.json` updated — completed features set to `"done"` with evidence
- [ ] `progress.md` updated — new session entry added to Session 歷史 table
- [ ] Commit created with conventional-commit message

---

## Session Entry Template

Add to the **Session 歷史** table in `progress.md`:

```markdown
| YYYY-MM-DD | <one-line summary of what was done> |
```

---

## Progress Update Template

Replace / update the **進行中工作** section in `progress.md` with:

```markdown
### <feat-id>：<feature name>

**狀態：** <🔴 in-progress | ✅ done>

**本 session 完成：**
- <specific thing done>
- <specific thing done>

**待完成：**
- [ ] <next concrete step>

**阻礙：**
- <blocker or "none">
```

---

## Restart Path

The next session agent should:

1. Read `AGENTS.md`
2. Read `CLAUDE.md`
3. Run `./init.sh`
4. Read `feature_list.json` — find first `in-progress` item
5. Read `progress.md` — read last session entry and current blockers
6. Continue from the **待完成** list of the active feature

---

## Quick Verification Commands

```bash
bun run test        # 391 pass expected
bun run lint        # 0 errors expected
bun run typecheck   # 0 errors expected
bun run build       # clean build expected
```
