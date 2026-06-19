# IPC Handlers — The Envelope Contract

> Every renderer ↔ main call uses one response shape and one rule: **never throw across the IPC
> boundary.** All failures come back as data.

## The envelope type

Defined once in `src/shared/types.ts` (the single source of truth for both layers):

```typescript
export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Used for file-backed config so callers can distinguish "missing" from "error":
export interface ConfigFile<T> {
  path: string;
  exists: boolean;
  data: T | null;
  error?: string;
}
```

## Build responses with the helpers

`src/main/ipc/handlers/configUtils.ts` exposes the only two constructors you should use:

```typescript
export function success<T>(data: T): IpcResponse<T> {
  return { success: true, data };
}

export function failure(error: unknown): IpcResponse<never> {
  const message = error instanceof Error ? error.message : String(error);
  return { success: false, error: message };
}
```

`failure()` normalizes anything thrown into a string `error` — never let an `Error`, stack trace, or
raw object escape to the renderer.

## Handler shape

```typescript
// src/main/ipc/handlers/claudeHandler.ts (representative)
ipcMain.handle(IPC_CHANNELS.CONFIG_GET_CLAUDE_SETTINGS, async (_event, configDir: string) => {
  try {
    const settingsPath = path.join(configDir, 'settings.json');
    const result = await readJsonFile<ClaudeSettings>(settingsPath);
    return success(result);
  } catch (err) {
    return failure(err);
  }
});
```

Rules:
- **Wrap the whole body in `try/catch`** and return `failure(err)` from the catch. A handler must
  never reject — the renderer's `callElectron()` turns `{ success: false }` into a thrown error on
  the renderer side, which is where errors belong.
- **Validate first.** Guard renderer-supplied paths/names/ids *before* any FS or `spawn` call (see
  [security-guards.md](./security-guards.md)). A guard that throws is caught and returned as `failure`.
- **Keep handlers thin.** Parse args → guard → call a helper/`readJsonFile`/`writeJsonFile` → wrap.
  Domain logic lives in `handlers/*.ts` helpers, not inline in the `ipcMain.handle` callback.

## Channels and registration

- **Channel names** are constants in `src/shared/types.ts` (`IPC_CHANNELS.*`). Never hardcode a
  channel string in a handler or in the preload — import the constant in both places so they cannot
  drift. → [`../big-question/ipc-handler-registration.md`](../big-question/ipc-handler-registration.md)
- **Registration** happens in `src/main/index.ts → registerHandlers()`, which calls
  `registerFileHandlers(ipcMain)`, `registerConfigHandlers(ipcMain)`, `registerDialogHandlers(ipcMain)`
  plus a few inline `app.*` handlers. A handler that is written but not reachable from one of those
  `register*` functions will silently never fire.
- The renderer-facing type of every channel is declared on `window.electronAPI` in
  `src/renderer/lib/electron.ts`. Adding a handler means updating: (1) `IPC_CHANNELS` + payload types
  in `shared/types.ts`, (2) the `register*` function in main, (3) the `electronAPI` exposure in
  `src/preload/index.ts`, (4) the `window.electronAPI` type in `renderer/lib/electron.ts`.

## Anti-patterns

```typescript
// WRONG — throws across the boundary; renderer gets an unhandled rejection
ipcMain.handle(CH, async (_e, p) => {
  const data = await fs.readFile(p, 'utf-8'); // may throw, never caught
  return data;                                 // bare value, not an envelope
});

// WRONG — leaks internals
return { success: false, error: err };         // err is an object/stack, not a string

// CORRECT
ipcMain.handle(CH, async (_e, p: string) => {
  try {
    assertSafePath(p, os.homedir());
    return success(await fs.readFile(p, 'utf-8'));
  } catch (err) {
    return failure(err);
  }
});
```
