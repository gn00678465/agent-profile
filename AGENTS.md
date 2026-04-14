# AGENTS.md

Agent Profile — Electron desktop app for managing AI agent settings (Claude Code, Gemini CLI, GitHub Copilot CLI).

## Startup Workflow

Before writing any code:

1. Read this file
2. Run `./init.sh` to verify the project builds and tests pass
3. Read `feature_list.json` to see what is done / in-progress
4. Read `progress.md` to see blockers, risks, and last session's endpoint
5. **For any UI/UX work**: read `DESIGN.md` — the project's design system (Notion-inspired warm neutrals, typography, components, color tokens)

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

This is an **Electron + React 19 + TypeScript** desktop app using `vite-plugin-electron` for unified Vite builds.

### Electron Layers

```
┌─────────────────────┐        ┌──────────────────┐        ┌─────────────────────┐
│  Renderer (React)   │◄──────►│  Preload         │◄──────►│  Main (Node.js)     │
│  src/renderer/      │  IPC   │  src/preload/    │  IPC   │  src/main/          │
│  Alias: @/          │        │  index.ts        │        │  No alias           │
└─────────────────────┘        └──────────────────┘        └─────────────────────┘
                                        │
                               src/shared/types.ts
                               (Alias: @shared/)
```

| Layer | Root | Alias | Allowed APIs |
|-------|------|-------|-------------|
| Renderer | `src/renderer/` | `@/` | DOM, React, `window.electronAPI` only |
| Preload | `src/preload/index.ts` | — | `contextBridge`, `ipcRenderer` |
| Main | `src/main/` | — | All Node.js + Electron APIs |
| Shared | `src/shared/` | `@shared/` | Pure TypeScript — no runtime APIs |

**Entry points:**

| What | File |
|------|------|
| Renderer HTML shell | `index.html` → `/src/renderer/main.tsx` |
| Renderer React root | `src/renderer/main.tsx` |
| Main process | `src/main/index.ts` |
| Preload bridge | `src/preload/index.ts` |

### IPC Pattern

Every renderer-to-main call goes through a consistent wrapper:

```typescript
// Renderer side
import { callElectron, electronAPI } from '@/lib/electron';
const result = await callElectron(() => electronAPI().config.getSkills(configDir));

// IpcResponse<T> envelope: { success: boolean; data?: T; error?: string }
```

All IPC handlers in `src/main/ipc/configHandlers.ts` respond with `{ success, data }` or `{ success: false, error }`.

**Rule:** Never throw across the IPC boundary. All errors are wrapped in `{ success: false, error }`.

### Path Aliases

- `@/` → `src/renderer/`
- `@shared/` → `src/shared/`

### Main Process IPC Files

- `src/main/ipc/configHandlers.ts` — All config/session/rules/skills/plugin operations (~1,000 lines, split candidate)
- `src/main/ipc/fileHandlers.ts` — Generic file/directory/JSON read-write
- `src/main/ipc/dialogHandlers.ts` — Native file dialog wrappers

### Security Guards in configHandlers.ts

Two utility functions at the top of the file enforce path safety for all renderer-supplied inputs:

- `assertSafePath(inputPath, ...allowedRoots)` — Rejects paths that resolve outside the given roots (prevents path traversal). All session/rule/plugin paths are checked against `os.homedir()`.
- `assertSafeName(name)` — Rejects strings containing `/`, `\`, or `..` (prevents directory escape via names).

PowerShell invocations use environment variables (`$env:ZIP_SRC`, `$env:ZIP_DST`) rather than string interpolation to prevent command injection.

### Renderer Component Structure

```
src/renderer/
  main.tsx                         # Vite entry — mounts React into DOM
  App.tsx                          # Root: AGENT_TABS + ContentView router
  components/
    layout/
      Sidebar.tsx                  # Agent list, theme toggle, collapsible
    agents/
      ClaudePlugins.tsx            # installed_plugins.json viewer + toggle/delete
      ClaudePlugins/
        FilterToolbar.tsx          # Filter bar for plugin list
      GeminiExtensions.tsx         # ~/.gemini/extensions/ viewer
    editors/
      JsonFileEditor.tsx           # Generic JSON read/write (Settings pages)
      MarkdownEditor.tsx           # Generic .md read/write (CLAUDE.md, GEMINI.md)
      McpCommandEditor.tsx         # MCP server editor with command parsing
      SkillsEditor.tsx             # Skill list + editor + ZIP install
      AddSkillDialog.tsx           # ZIP install / symlink dialog
      RulesEditor.tsx              # ~/.claude/rules/**/*.md CRUD
      SubagentsEditor.tsx          # ~/.copilot/subagents/*.agent.md CRUD
      ClaudeSessionsView.tsx       # JSONL session reader
      GeminiSessionsView.tsx       # Gemini session reader
      CopilotSessionsView.tsx      # Copilot session reader
      SessionsView.tsx             # Generic session list (base / fallback)
    shared/
      ExtensionListLayout.tsx      # Reusable list panel (loading/empty/content states)
      ExtensionRow.tsx             # Single row with toggle, badge, delete
    ui/                            # shadcn/ui primitives (button, dialog, tabs…)
  hooks/
    useAgents.ts                   # Loads AgentProfile[] via IPC
    useConfig.ts                   # useSkills, useMarkdown (IPC + state)
    useItemLoader.ts               # Generic async data loader hook
    useTheme.ts                    # Dark/light theme toggle + persistence
  lib/
    electron.ts                    # callElectron() + electronAPI() wrapper
    parseMcpCommand.ts             # Parses "command args" string into McpServer
```

### Agent Types and Tabs

`App.tsx` maintains `AGENT_TABS` — a map from `AgentType` to the tab list shown for that agent. Each tab id maps to a rendered component. The active agent color propagates as `agentColor` prop throughout the tab content tree.

| Agent | Tabs |
|-------|------|
| claude-code | Settings, CLAUDE.md, Sessions, Skills, Plugins, MCP Servers, Rules |
| copilot | Settings, Instructions, Subagents, Sessions, Skills, MCP Servers |
| gemini | Settings, GEMINI.md, Sessions, Skills, Extensions, MCP Servers |
| shared | Shared Skills |

### Testing

- Tests live colocated in `__tests__/` subdirectories.
- Main process tests: `src/main/ipc/__tests__/` — unit tests with mocked `fs` and `electron`.
- Renderer tests: `src/renderer/**/__tests__/` — jsdom environment (auto-detected by glob in `vitest.config.ts`).
- Setup file: `src/test/setup.ts`.
- Coverage is collected from `src/main/**`, `src/shared/**`, and `src/renderer/**`.

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
- [ ] `bun run lint` passes (0 errors)
- [ ] `bun run typecheck` passes
- [ ] `feature_list.json` entry updated to `"status": "done"` with evidence
- [ ] `progress.md` 快照已更新（上次結束點）
- [ ] `session-log.jsonl` 已追加本次紀錄（一行 JSON）

## End of Session

Before ending a session:

1. Run `bun run test` — confirm 0 failures
2. Run `bun run lint` — confirm 0 errors
3. Update `feature_list.json` — set completed items to `"done"`, add evidence
4. Update `progress.md` — update snapshot (last action, verify status)
5. Append to `session-log.jsonl` — one JSON line with date, summary, test/lint counts
6. Commit with a descriptive conventional-commit message

## Current Focus

All 14 features are **done**. See `feature_list.json` for the full list with evidence.

**Next work candidates (add new features to `feature_list.json` as `planned` before starting):**
- Splitting `configHandlers.ts` (~1,000 lines) into per-domain files
- E2E tests for critical user flows (Playwright)
- `session-handoff.md` checklist integration into `init.sh`
