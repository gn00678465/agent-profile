# Architecture

## System Overview

Agent Profile is an Electron + React 19 + TypeScript desktop app that provides a GUI for managing AI agent configuration files. The app never talks to any cloud service directly — it reads and writes local config files in `~/.claude/`, `~/.gemini/`, `~/.copilot/`, etc.

---

<electron-layers>
## Electron Layers

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

**Layer rules:**
- **Renderer** — Never imports Node.js APIs directly. All OS/FS calls go through `callElectron()`.
- **Preload** — Exposes `window.electronAPI` via `contextBridge`. This is the sole interface between renderer and main.
- **Main** — All file system, OS dialog, and shell operations happen here.
- **Shared** — `src/shared/types.ts` is the single source of truth for all types and `IPC_CHANNELS`. Both renderer and main import from `@shared/types`.
</electron-layers>

---

<ipc-pattern>
## IPC Pattern

Every renderer call follows the same envelope:

```typescript
// Renderer side — always use callElectron wrapper
const result = await callElectron(() => electronAPI().config.getSkills(configDir));

// Main side — always return IpcResponse<T>
ipcMain.handle(IPC_CHANNELS.CONFIG_GET_SKILLS, async (_, configDir) => {
  try {
    const skills = await loadSkills(configDir);
    return { success: true, data: skills };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// Response envelope
interface IpcResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

**Rule:** Never throw across the IPC boundary. All errors are wrapped in `{ success: false, error }`.
</ipc-pattern>

---

<security-guards>
## Security Guards

All renderer-supplied paths and names go through two guards in `configHandlers.ts`:

```typescript
// Prevents path traversal (e.g. "../../etc/passwd")
assertSafePath(inputPath, os.homedir());

// Prevents directory escape via name (e.g. "../evil")
assertSafeName(name); // rejects strings containing / \ ..
```

PowerShell invocations use `$env:VAR` instead of string interpolation to prevent command injection.
</security-guards>

---

## Agent Types & Config Paths

| Agent | Type key | Config root |
|-------|----------|-------------|
| Claude Code | `claude-code` | `~/.claude/` |
| GitHub Copilot CLI | `copilot` | `~/.copilot/` |
| Gemini CLI | `gemini` | `~/.gemini/` |
| Shared (skills) | `shared` | `~/.claude/` |

---

<agent-tabs>
## Tab Configuration (per agent)

Defined in `App.tsx` → `AGENT_TABS`. Each tab id maps to a component rendered by `ContentView`. The active agent color propagates as `agentColor` prop throughout the tab content tree.

| Agent | Tabs |
|-------|------|
| claude-code | Settings, CLAUDE.md, Sessions, Skills, Plugins, MCP Servers, Rules |
| copilot | Settings, Instructions, Subagents, Sessions, Skills, MCP Servers |
| gemini | Settings, GEMINI.md, Sessions, Skills, Extensions, MCP Servers |
| shared | Shared Skills |
</agent-tabs>

---

<component-map>
## Component Map

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
</component-map>

---

## Design System

The app follows a **Notion-inspired** design system documented in `DESIGN.md` (project root).

Key tokens used in components:

| Token | Value | Usage |
|-------|-------|-------|
| Warm White | `#f6f5f4` | Alt background surface |
| Near-Black | `rgba(0,0,0,0.95)` | Primary text |
| Warm Gray | `#615d59` | Secondary / muted text |
| Whisper Border | `1px solid rgba(0,0,0,0.1)` | All dividers and card outlines |
| Notion Blue | `#0075de` | Primary CTA |
| Agent accent | per-agent color | Tab highlights, toggles, selected states |

**Always read `DESIGN.md` before writing new UI components or modifying existing ones.**

---

## Main Process IPC Files

| File | Responsibility |
|------|---------------|
| `configHandlers.ts` | All config/session/rules/skills/plugin operations (~1 000 lines — split candidate) |
| `fileHandlers.ts` | Generic file/directory/JSON read-write |
| `dialogHandlers.ts` | Native file dialog wrappers (open/save) |

---

## Build System

Uses `vite-plugin-electron` for a unified Vite build. A single `vite build` produces both the renderer bundle and the Electron main/preload bundles.

```
bun run build       → dist/ (renderer) + dist-electron/ (main + preload)
bun run electron:win → electron-builder Windows package
```

---

<testing-strategy>
## Testing Strategy

- **Unit tests** — main process IPC handlers in `src/main/ipc/__tests__/`, mocked `fs` + `electron`.
- **Component tests** — renderer tests in `src/renderer/**/__tests__/`, jsdom environment (auto-detected by glob in `vitest.config.ts`), vitest + React Testing Library.
- **Setup file** — `src/test/setup.ts`.
- **Coverage** — collected from `src/main/**`, `src/shared/**`, and `src/renderer/**`.
- **No E2E tests yet** — manual verification via `bun run dev`.

Test files live colocated in `__tests__/` subdirectories.

**Important:** use `bun run test`, not `bun test` (Bun native runner does not understand `vi.mock()`).
</testing-strategy>
