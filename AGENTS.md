# AGENTS.md

Agent Profile — Electron desktop app for managing AI agent settings (Claude Code, Gemini CLI, GitHub Copilot CLI).

## Startup Workflow

Before writing any code:

1. Read this file
2. Run `./init.sh` to verify the project builds and tests pass
3. Read `feature_list.json` to see what is done / in-progress
4. Read `progress.md` to see blockers, risks, and last session's endpoint
5. **For any UI/UX work**: read `DESIGN.md` — the project's design system (Notion-inspired warm neutrals, typography, components, color tokens)

> `CLAUDE.md` is a pointer to this file — no need to read it separately.

## Commands

```bash
bun run dev          # Vite dev server + Electron (hot-reload)
bun run test         # Run all tests once via Vitest  ← always use `bun run test`, NOT `bun test`
bun run test:watch   # Watch mode
bun run lint         # ESLint check
bun run lint:fix     # ESLint autofix
bun run build        # Production build
bun run typecheck    # Type-check only
bun run electron:win # Build + package for Windows
```

Run a single test file:
```bash
bunx vitest run src/main/ipc/__tests__/configHandlers.test.ts
```

## Architecture

Electron + React 19 + TypeScript desktop app built with `vite-plugin-electron`. Full details in `docs/ARCHITECTURE.md`:

| Need… | Read the tagged section |
|-------|-------------------------|
| Layer boundaries, aliases, entry points | `<electron-layers>` |
| IPC envelope & wrapper | `<ipc-pattern>` |
| `assertSafePath` / `assertSafeName` usage | `<security-guards>` |
| Renderer file tree | `<component-map>` |
| Per-agent tab list | `<agent-tabs>` |
| Test layout, setup, coverage paths | `<testing-strategy>` |

**Load-bearing rules** (keep in mind at all times — enforced in Working Rules below):
- Never throw across the IPC boundary — always return `{ success, data? }` or `{ success: false, error }`.
- Always call `assertSafePath` / `assertSafeName` for renderer-supplied inputs.
- Renderer never imports Node APIs directly — all FS/OS calls go through `callElectron()`.

## Working Rules

- **One feature at a time.** Pick the first `in-progress` or `planned` item from `feature_list.json` and complete it before moving on.
- **Verification before done.** A feature is not done until `bun run test` + `bun run lint` both pass.
- **Never mutate objects.** Use spread/`structuredClone`.
- **IPC envelope.** Every IPC handler returns `{ success, data? }` or `{ success: false, error }`. Never throw across the IPC boundary.
- **Security guards.** Always call `assertSafePath` / `assertSafeName` for renderer-supplied inputs before touching the file system.
- **Design system compliance.** All UI changes must follow `DESIGN.md`: warm neutral palette, whisper borders (`1px solid rgba(0,0,0,0.1)`), Notion Blue (`#0075de`) for primary CTA, agent accent colors for interactive highlights.
- **Update state before ending.** Update `feature_list.json` + `progress.md` (snapshot) + `session-log.jsonl` (append history) at the end of every session.

## Definition of Done

A feature is complete when:

- [ ] Implementation matches the description in `feature_list.json`
- [ ] `bun run test` passes (378 tests, 21 files, 0 failures)
- [ ] `bun run lint` passes (0 errors, 0 warnings)
- [ ] `bun run typecheck` passes
- [ ] `feature_list.json` entry updated to `"status": "done"` with evidence
- [ ] `progress.md` 快照已更新（上次結束點）
- [ ] `session-log.jsonl` 已追加本次紀錄（一行 JSON）

## End of Session

Run the full gate in `clean-state-checklist.md` before handing off. TL;DR:

1. `bun run typecheck && bun run lint && bun run test` — all green
2. `bash scripts/check-architecture.sh` — 0 boundary violations
3. Update `feature_list.json` (status + evidence), `progress.md` (snapshot), `session-log.jsonl` (append one line)
4. Commit with a Conventional Commits message

See `session-handoff.md` for the narrative steps (progress update, restart path).

## Current Focus

All 14 features are **done**. See `feature_list.json` for the full list with evidence.

**Next work candidates (add new features to `feature_list.json` as `planned` before starting):**
- Splitting `configHandlers.ts` (~1,000 lines) into per-domain files
- E2E tests for critical user flows (Playwright)
- `session-handoff.md` checklist integration into `init.sh`
