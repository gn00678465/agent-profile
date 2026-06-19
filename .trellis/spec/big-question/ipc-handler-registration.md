# IPC Handler Registration

> **Severity**: P1 — the feature is completely dead at runtime.
> **Key insight**: file existence ≠ registration. Writing a handler does not wire it up.

## Symptom

You added a handler, updated types, the build is green — but the renderer call fails or hangs:

```
Error: No handler registered for 'config:getFoo'
```

## Root cause

Two independent things must both be true, and either can silently break:

1. **The handler must be reachable from `registerHandlers()`** in `src/main/index.ts`.
2. **The channel constant must be identical** in all three places that reference it.

## 1 — The registration chain

```
app.whenReady()                          // src/main/index.ts
  └─ registerHandlers()
       ├─ registerFileHandlers(ipcMain)      // src/main/ipc/fileHandlers.ts
       ├─ registerConfigHandlers(ipcMain)    // src/main/ipc/configHandlers.ts  ← composes handlers/*.ts
       ├─ registerDialogHandlers(ipcMain)    // src/main/ipc/dialogHandlers.ts
       └─ ipcMain.handle(APP_*, …)           // a few inline app-level handlers
```

A new `ipcMain.handle(...)` only fires if it is added to one of these `register*` functions (most
config/agent handlers live under `src/main/ipc/handlers/*.ts` and are composed by
`registerConfigHandlers`). A handler written in a new file that nothing imports is never registered.

**Fix:** add your `ipcMain.handle` inside an existing `register*Handlers` function (or, if you create
a new module, import and call its register function from `registerHandlers()`).

## 2 — Channel name consistency

Channel names are constants in `src/shared/types.ts` (`IPC_CHANNELS.*`). The same constant must be
used in **all** of:

```typescript
// src/shared/types.ts        — the single definition
export const IPC_CHANNELS = { CONFIG_GET_FOO: 'config:getFoo', /* ... */ } as const;

// src/main/ipc/handlers/...  — registration
ipcMain.handle(IPC_CHANNELS.CONFIG_GET_FOO, handler);

// src/preload/index.ts       — exposure
getFoo: (dir: string) => invoke(IPC_CHANNELS.CONFIG_GET_FOO, dir),
```

Never type the raw string `'config:getFoo'` in more than one place — import the constant so the two
ends cannot drift.

## The full checklist for adding a channel

A new renderer→main capability touches **four** files in lockstep:

1. `src/shared/types.ts` — add `IPC_CHANNELS.X` + the payload/return types.
2. `src/main/ipc/**` — register the handler in a `register*` function; return `IpcResponse<T>`.
3. `src/preload/index.ts` — expose it on `electronAPI` via `invoke(IPC_CHANNELS.X, …)`.
4. `src/renderer/lib/electron.ts` — add the method to the `window.electronAPI` type.

Then call it from the renderer with `callElectron(() => electronAPI().<group>.<method>(...))`.

## Quick tools

```bash
grep -rn "registerHandlers\|register.*Handlers" src/main/index.ts
grep -rn "CONFIG_GET_FOO" src/shared/types.ts src/main src/preload src/renderer
```

## Why this generalizes

Any registration-based system — Electron IPC, route handlers, event listeners, plugin systems —
shares this trap. Always trace the chain from startup to your code; don't assume the file being present
means it runs.
