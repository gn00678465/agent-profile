# Layer Boundaries & Import Aliases

> The single most load-bearing rule in this codebase. Boundaries are enforced automatically by
> `scripts/check-architecture.sh` (part of the verification gate); a violation fails the build.
> The full human-facing map is `docs/ARCHITECTURE.md` — this file is the actionable contract.

## The four layers

```
┌──────────────────┐      ┌────────────────┐      ┌────────────────────┐
│ Renderer (React) │◄────►│ Preload        │◄────►│ Main (Node.js)     │
│ src/renderer/    │ IPC  │ src/preload/   │ IPC  │ src/main/          │
│ alias: @/        │      │ index.ts       │      │ (no alias)         │
└──────────────────┘      └────────────────┘      └────────────────────┘
                                  │
                          src/shared/types.ts  (alias: @shared/)
```

| Layer | Root | May import | Must NOT import |
|-------|------|-----------|-----------------|
| **Renderer** | `src/renderer/` | React, DOM, `@/`, `@shared/types`, `window.electronAPI` | `fs`/`path`/`os`/`child_process`/`node:*`, `electron`, anything in `main/` or `preload/` |
| **Preload** | `src/preload/index.ts` | `electron`, relative `../shared/*` | Node core, React |
| **Main** | `src/main/` | all Node + Electron APIs, relative `../shared/*` | `react`/`react-dom`, anything in `renderer/` |
| **Shared** | `src/shared/` | pure TypeScript only | Node, Electron, React, **any** sibling layer |

## Import aliases

| From | Import shared types as | Import own-layer files as |
|------|------------------------|---------------------------|
| Renderer (`src/renderer/`) | `@shared/types` | `@/...` |
| Main (`src/main/`) | **relative** `../../../shared/types` | relative |
| Preload (`src/preload/`) | **relative** `../shared/types` | relative |
| Shared (`src/shared/`) | relative `./...` | relative |

**Why main uses relative paths:** the `@shared` / `@` aliases are configured only for the Vite-bundled
renderer (`vite.config.ts` / `tsconfig.app.json`). The main and preload bundles do not resolve them —
using `@shared` there breaks the build. This is a frequent mistake; always check the layer before
choosing an import style.

## `src/shared/types.ts` is the single source of truth

- **All** cross-layer types live here: `IpcResponse<T>`, `ConfigFile<T>`, `AgentProfile`,
  `ClaudeSettings`, `GeminiSettings`, `CopilotConfig`, `McpSettings`, session types, etc.
- **All** IPC channel names live here as `IPC_CHANNELS.*` constants. Both the main handler and the
  preload exposure import the same constant — never type a channel string literally in two places.
- It must stay pure TypeScript: no `fs`, no `electron`, no `react`. The arch check enforces this.

## The only cross-layer channel is IPC

The renderer never reaches into main or preload directly. Every OS/FS/dialog/CLI operation goes:

```
renderer  →  callElectron(() => electronAPI().<group>.<method>(...))   [src/renderer/lib/electron.ts]
preload   →  contextBridge.exposeInMainWorld('electronAPI', { ... })   [src/preload/index.ts]
main      →  ipcMain.handle(IPC_CHANNELS.X, handler)                    [src/main/ipc/**]
```

Adding a capability touches all four files in lockstep (see
[`../backend/ipc-handlers.md`](../backend/ipc-handlers.md) and
[`../frontend/ipc-electron.md`](../frontend/ipc-electron.md)).

## Verify

```bash
bash scripts/check-architecture.sh   # 0 violations required before commit
```
