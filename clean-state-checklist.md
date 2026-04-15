# Clean-State Checklist

Run this checklist before ending a session. Every box must be green — if one fails, fix it before handing off.

The checklist is the **binary gate**. Handoff narrative (commit messages, progress notes, restart hints) lives in `session-handoff.md`.

---

## 1. Verification gates

```bash
bun run typecheck               # 0 errors
bun run lint                    # 0 errors, 0 warnings
bun run test                    # 0 failures (baseline: 378 pass / 21 files)
bash scripts/check-architecture.sh   # 0 boundary violations
```

- [ ] `bun run typecheck` — 0 errors
- [ ] `bun run lint` — 0 errors, 0 warnings
- [ ] `bun run test` — 0 failures
- [ ] `bash scripts/check-architecture.sh` — PASS (renderer/main/shared/preload boundaries intact)

> Tip: `./init.sh` runs harness check → typecheck → build → test → lint → architecture check.

---

## 2. State artifacts

Use `session-handoff.md` sections 2–3 for templates (jsonl format + progress snippet).

- [ ] `session-handoff.md` — sections 1–4 填寫完畢（verification results、jsonl 追加、progress 快照、next step）
- [ ] `feature_list.json` — completed items set to `"status": "done"` with evidence; no stale `in-progress` carry-overs
- [ ] `progress.md` — 快照反映當前「上次結束點」；in-progress feature 有明確「待完成」清單
- [ ] `session-log.jsonl` — appended exactly one JSON line for this session (date, summary, tests, lint_errors, lint_warnings)

---

## 3. Repository hygiene

- [ ] `git status` — no uncommitted changes beyond the intentional session work
- [ ] `git log -1` — commit message follows Conventional Commits (`feat`, `fix`, `chore`, `docs`, `refactor`, …)
- [ ] No secrets, personal paths, or `console.log` debug noise leaked into tracked files
- [ ] No unreviewed files inside `dist/`, `dist-electron/`, or `build/` staged by accident

---

## 4. Restart path (next agent's first 60 seconds)

- [ ] Next agent can run `./init.sh` and get a clean build
- [ ] The first `planned`/`in-progress` entry in `feature_list.json` is the true starting point
- [ ] `progress.md` names a concrete next action (not a vague "continue refactor")

---

## 5. (Optional) Architecture contract reminders

If this session touched layer code, double-check the rules — the script enforces them automatically, but humans should still know them:

- Renderer never imports Node core, `electron`, `src/main/`, or `src/preload/` — all OS/FS goes through `callElectron()`.
- Main never imports React or `src/renderer/`.
- Shared (`src/shared/`) stays pure TypeScript — no runtime libraries, no sibling layers.
- Preload only imports from `electron` plus relative paths into `../shared/`.

Full contract: `docs/ARCHITECTURE.md` → `<electron-layers>`, `<ipc-pattern>`, `<security-guards>`.
