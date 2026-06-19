# Git Conventions

> Conventional Commits, atomic commits, explicit staging. State tracking and the end-of-session flow
> are managed by Trellis (`.trellis/`), not by hand-maintained root files.

## Commit message format

```
<type>(<scope>): <description>

[optional body]
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

**Scopes** (use the affected area; optional but encouraged):

| Scope | Area |
|-------|------|
| `ipc` | IPC handlers / envelope |
| `cli` | `cliRunner` / `claude` CLI integration |
| `plugins` | Claude plugins / marketplaces |
| `skills` | skills editor / install |
| `rules` | `~/.claude/rules` CRUD |
| `mcp` | MCP server config |
| `config` | agent settings read/write |
| `ui` | renderer components / design |
| `harness` / `task` / `journal` / `spec` | Trellis workflow & docs |

Examples (from this repo's history):

```bash
feat(plugins): add marketplace auto-update switch
fix(ipc): wrap readJsonFile errors in failure()
chore(task): archive 06-19-harness-migration
docs(journal): record session 15
```

## Branch naming

```
feature/<slug>      e.g. feature/initial-agent-profile
fix/<slug>          e.g. fix/plugin-delete-flaky
```

## Staging & commits

- **Never `git add .`** — stage files explicitly (`git add <path> ...`) so unrelated untracked trees
  (e.g. the `.trellis` / `.claude` vendoring) are not swept into a commit by accident.
- **Atomic commits** — one logical change per commit; separate code, tests, and docs when practical.
- **Attribution is disabled globally** (`~/.claude/settings.json`). Do not add co-author / "Generated
  with" trailers.

## Pre-commit gate (all must pass)

```bash
bun run typecheck && bun run lint && bun run test
bash scripts/check-architecture.sh
```

## End of session = Trellis Phase 3

After the gate is green: update spec if you learned a convention → commit (explicit `git add`) →
`python3 ./.trellis/scripts/add_session.py --title ... --commit <hash> --summary ...` → archive the
finished task (`task.py archive <dir>`) or clear the pointer (`task.py finish`). Prefer
`/trellis:finish-work` if the platform exposes it. See the root `AGENTS.md` "End of Session".

---

**Language**: all documentation is written in **English**.
