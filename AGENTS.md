# AGENTS.md

Agent Profile — Electron desktop app for managing AI agent settings (Claude Code, Gemini CLI, GitHub Copilot CLI).

## Startup Workflow

Before writing any code:

1. Read this file
2. Read `CLAUDE.md` (commands, architecture, IPC pattern, security guards)
3. Run `./init.sh` to verify the project builds and tests pass
4. Read `feature_list.json` to see what is done / in-progress
5. Read `progress.md` to see blockers, risks, and last session's endpoint
6. **For any UI/UX work**: read `DESIGN.md` — the project's design system (Notion-inspired warm neutrals, typography, components, color tokens)

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

## Working Rules

- **One feature at a time.** Pick the first `in-progress` or `planned` item from `feature_list.json` and complete it before moving on.
- **Verification before done.** A feature is not done until `bun run test` + `bun run lint` both pass.
- **Never mutate objects.** Use spread/`structuredClone`; see `CLAUDE.md` § Coding Style.
- **IPC envelope.** Every IPC handler returns `{ success, data? }` or `{ success: false, error }`. Never throw across the IPC boundary.
- **Security guards.** Always call `assertSafePath` / `assertSafeName` for renderer-supplied inputs before touching the file system.
- **Design system compliance.** All UI changes must follow `DESIGN.md`: warm neutral palette, whisper borders (`1px solid rgba(0,0,0,0.1)`), Notion Blue (`#0075de`) for primary CTA, agent accent colors for interactive highlights.
- **Update state before ending.** Update `feature_list.json` + `progress.md` at the end of every session.

## Architecture Quick-Reference

```
Renderer (React)  ←→  Preload (contextBridge)  ←→  Main (Node.js)
    @/                    window.electronAPI           @shared/
```

Key files:
- `src/shared/types.ts` — all shared types + `IPC_CHANNELS`
- `src/preload/index.ts` — typed `window.electronAPI`
- `src/main/ipc/configHandlers.ts` — all config IPC (~1 000 lines, split candidate)
- `src/renderer/App.tsx` — agent sidebar + tab routing

Path aliases: `@/` → `src/renderer/`  |  `@shared/` → `src/shared/`

## Definition of Done

A feature is complete when:

- [ ] Implementation matches the description in `feature_list.json`
- [ ] `bun run test` passes (391 tests, 24 files, 0 failures)
- [ ] `bun run lint` passes (0 errors)
- [ ] `bun run typecheck` passes
- [ ] `feature_list.json` entry updated to `"status": "done"` with evidence
- [ ] `progress.md` updated with what was done and next session entry point

## End of Session

Before ending a session:

1. Run `bun run test` — confirm 0 failures
2. Run `bun run lint` — confirm 0 errors
3. Update `feature_list.json` — set completed items to `"done"`, add evidence
4. Update `progress.md` — log what was done, blockers, next session entry
5. Commit with a descriptive conventional-commit message

## Current Focus

All 14 features are **done**. See `feature_list.json` for the full list with evidence.

**Next work candidates (add new features to `feature_list.json` as `planned` before starting):**
- Splitting `configHandlers.ts` (~1 000 lines) into per-domain files
- E2E tests for critical user flows (Playwright)
- `session-handoff.md` checklist integration into init.sh
