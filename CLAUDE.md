# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Start Vite dev server + Electron (hot-reload)
bun test             # Run all tests once (Vitest)
bun run test:watch   # Run tests in watch mode
bun run lint         # ESLint check
bun run lint:fix     # ESLint autofix
bun run build        # Vite production build
bun run electron:win # Build + package for Windows
```

Run a single test file:
```bash
bunx vitest run src/main/ipc/__tests__/configHandlers.test.ts
```

## Architecture

This is an **Electron + React 19 + TypeScript** desktop app using `vite-plugin-electron` for unified Vite builds.

### Process Boundary

```
Renderer (React)  ←→  Preload (contextBridge)  ←→  Main (Node.js)
```

- **`src/renderer/`** — React UI. Never imports Node.js APIs directly.
- **`src/preload/index.ts`** — Exposes `window.electronAPI` via `contextBridge`. All IPC channels are typed here.
- **`src/main/`** — Electron main process. All file system and OS operations happen here.
- **`src/shared/types.ts`** — Single source of truth for all types and `IPC_CHANNELS` constants shared between processes.

### IPC Pattern

Every renderer-to-main call goes through a consistent wrapper:

```typescript
// Renderer side
import { callElectron, electronAPI } from '@/lib/electron';
const result = await callElectron(() => electronAPI().config.getSkills(configDir));

// IpcResponse<T> envelope: { success: boolean; data?: T; error?: string }
```

All IPC handlers in `src/main/ipc/configHandlers.ts` respond with `{ success, data }` or `{ success: false, error }`.

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
  App.tsx                        # Root: agent list sidebar + tab routing
  components/
    agents/                      # Per-agent-type setting panels
      ClaudeSettings.tsx
      ClaudePlugins.tsx
      GeminiSettings.tsx
      GeminiExtensions.tsx
      CopilotSettings.tsx
    editors/                     # Reusable editor panels (tab content)
      MarkdownEditor.tsx          # Shared markdown editing with save state
      McpEditor.tsx
      SkillsEditor.tsx
      SessionsView.tsx            # Generic sessions for Gemini/Copilot
      ClaudeSessionsView.tsx      # Claude-specific JSONL session viewer
      RulesEditor.tsx             # ~/.claude/rules/**/*.md editor
      AddSkillDialog.tsx
```

### Agent Types and Tabs

`App.tsx` maintains `AGENT_TABS` — a map from `AgentType` to the tab list shown for that agent. Each tab id maps to a rendered component. The active agent color propagates as `agentColor` prop throughout the tab content tree.

### Testing

- Tests live colocated in `__tests__/` subdirectories.
- Main process tests: `src/main/ipc/__tests__/` — unit tests with mocked `fs` and `electron`.
- Renderer tests: `src/renderer/components/**/__tests__/` — use jsdom environment (auto-detected by glob in vitest.config.ts).
- Setup file: `src/test/setup.ts`.
- Coverage is collected from `src/main/**`, `src/shared/**`, and `src/renderer/**`.
