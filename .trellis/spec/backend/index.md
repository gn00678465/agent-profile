# Backend (Electron Main Process) Guidelines

> **Tech stack**: Electron 41 main process · Node.js · TypeScript (ESM). **No database** —
> persistence is plain JSON/Markdown files under `~/.claude`, `~/.gemini`, `~/.copilot`, etc.

The main process is the only layer allowed to touch the file system, OS dialogs, and child
processes. The renderer reaches it exclusively through the typed IPC bridge (see
[`../frontend/ipc-electron.md`](../frontend/ipc-electron.md)). Layer boundaries are enforced by
`scripts/check-architecture.sh` and documented in [`../shared/architecture.md`](../shared/architecture.md).

---

## Directory layout

```
src/main/
├── index.ts                       # Entry: BrowserWindow + registerHandlers() + app.* handlers
└── ipc/
    ├── fileHandlers.ts            # Generic file/dir/json read-write   (registerFileHandlers)
    ├── configHandlers.ts          # Aggregates per-agent handlers       (registerConfigHandlers)
    ├── dialogHandlers.ts          # Native open/save dialogs            (registerDialogHandlers)
    └── handlers/
        ├── configUtils.ts         # success()/failure(), assertSafePath/assertSafeName,
        │                          #   readJsonFile()/writeJsonFile()  ← shared building blocks
        ├── agentsHandler.ts       # AgentProfile discovery
        ├── claudeHandler.ts       # ~/.claude settings
        ├── claudePluginsHandler.ts / claudePluginsDelete.ts
        ├── cliRunner.ts           # ONLY module that spawns the `claude` binary
        ├── copilotHandler.ts      # ~/.copilot config
        ├── geminiHandler.ts       # ~/.gemini settings + extensions
        ├── markdownHandler.ts     # CLAUDE.md / GEMINI.md read-write
        ├── mcpHandler.ts          # MCP server config
        ├── rulesHandler.ts        # ~/.claude/rules CRUD
        └── skillsHandler.ts       # skills + ZIP/registry install
```

Each `handlers/*.ts` exposes a `register*Handlers(ipcMain)` (or is composed by `configHandlers.ts`).
All `register*` functions are wired once in `src/main/index.ts → registerHandlers()`.

---

## Non-negotiable rules

1. **IPC envelope.** Every `ipcMain.handle` returns `IpcResponse<T>` (`{ success, data? }` or
   `{ success: false, error }`). **Never throw across the IPC boundary.** → [ipc-handlers.md](./ipc-handlers.md)
2. **Validate renderer input.** Any renderer-supplied path/name/id passes `assertSafePath` /
   `assertSafeName` (or the cliRunner-specific guards) **before** any FS or `spawn` call.
   → [security-guards.md](./security-guards.md)
3. **CLI isolation.** The `claude` binary is spawned only from `cliRunner.ts`, only with
   whitelisted args, only with `shell: false`. → [cli-runner.md](./cli-runner.md)
4. **JSON-file persistence.** Read/write config through `readJsonFile` / `writeJsonFile`; tolerate
   missing files (`ConfigFile.exists`). No database, no ORM. → [config-persistence.md](./config-persistence.md)
5. **Relative imports for shared.** Main process imports `src/shared/` via **relative paths**
   (`../../../shared/types`), never the `@shared` alias — the alias only exists for the
   Vite-bundled renderer. → [`../shared/architecture.md`](../shared/architecture.md)
6. **No React, no DOM.** Main is a Node.js process; importing `react`/`react-dom` or reaching into
   `src/renderer/` fails `check-architecture.sh`.

---

## Documentation files

| File | When to read |
|------|--------------|
| [ipc-handlers.md](./ipc-handlers.md) | Adding/modifying any `ipcMain.handle` |
| [security-guards.md](./security-guards.md) | Touching the file system with renderer-supplied input |
| [cli-runner.md](./cli-runner.md) | Any `claude` CLI interaction or new spawn |
| [config-persistence.md](./config-persistence.md) | Reading/writing agent config files |

---

## Core rules summary

| Rule | Reference |
|------|-----------|
| Handlers return `IpcResponse<T>`, never throw across IPC | [ipc-handlers.md](./ipc-handlers.md) |
| Wrap success with `success(data)`, errors with `failure(err)` | [ipc-handlers.md](./ipc-handlers.md) |
| `assertSafePath(input, ...roots)` before FS access | [security-guards.md](./security-guards.md) |
| `assertSafeName(name)` for renderer-supplied path components | [security-guards.md](./security-guards.md) |
| Spawn `claude` only via `cliRunner.runWith(args)` with `shell: false` | [cli-runner.md](./cli-runner.md) |
| New CLI command ⇒ extend the L4 whitelist first | [cli-runner.md](./cli-runner.md) |
| Read config via `readJsonFile<T>()`; tolerate `exists: false` | [config-persistence.md](./config-persistence.md) |
| Main imports shared with relative paths, not `@shared` | [`../shared/architecture.md`](../shared/architecture.md) |

---

**Language**: all spec documentation is written in **English**.
