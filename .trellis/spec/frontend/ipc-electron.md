# IPC from the Renderer

> The renderer reaches the main process through exactly one wrapper: `callElectron()` over the typed
> `window.electronAPI`. Both live in `src/renderer/lib/electron.ts`. Never use `ipcRenderer` directly
> (it isn't available under `contextIsolation: true`).

## The wrapper

```typescript
// src/renderer/lib/electron.ts
export const electronAPI = () => {
  if (!isElectron()) throw new Error('Not running in Electron');
  return window.electronAPI;            // fully typed surface (config.*, file.*, dialog.*, app.*)
};

export async function callElectron<T>(fn: () => Promise<IpcResponse<T>>): Promise<T> {
  const response = await fn();
  if (!response.success) {
    throw new Error(response.error ?? 'Unknown error');  // unwrap the envelope here
  }
  return response.data as T;
}
```

`callElectron` is where the `IpcResponse<T>` envelope is unwrapped: a `{ success: false }` from the
main process becomes a thrown `Error` in the renderer, so call sites can use ordinary `try/catch`.

## Calling pattern

```typescript
// In a hook or event handler — always wrap with callElectron
try {
  const settings = await callElectron(() => electronAPI().config.getClaudeSettings(configDir));
  setSettings(settings);
} catch (err) {
  toast.error(err instanceof Error ? err.message : String(err));  // sonner
}
```

- **Don't** read `response.success` / `response.data` yourself in components — let `callElectron`
  do it and `throw`.
- **Do** catch at the call site and surface failures to the user (a `sonner` toast), since
  `callElectron` throws on `{ success: false }`.

## What the renderer cannot do (contextIsolation)

```typescript
import fs from 'fs';            // ✗ Module not found — renderer is a browser context
import { dialog } from 'electron'; // ✗ not available
e.dataTransfer.files[0].path;   // ✗ undefined under contextIsolation
```

Anything OS/FS/dialog/CLI must already exist on `electronAPI`. If it doesn't, add it — see the
four-file flow in [`../big-question/ipc-handler-registration.md`](../big-question/ipc-handler-registration.md):
`shared/types.ts` (channel + types) → main handler → `preload/index.ts` exposure →
`renderer/lib/electron.ts` type. Then call it via `callElectron`.

## App-level helpers instead of Node

The renderer gets environment info through IPC, never Node:

```typescript
const home = await callElectron(() => electronAPI().app.getHomePath());
await callElectron(() => electronAPI().app.openExternal(url));   // not window.open for external links
```

## Subscriptions (main → renderer events)

A few flows stream progress (e.g. registry skill install). The preload exposes
`onInstallSkillFromRegistryStarted(handler)` that **returns an unsubscribe function**. Always
subscribe inside `useEffect` and return that unsubscribe to clean up:

```typescript
useEffect(() => {
  const off = electronAPI().config.onInstallSkillFromRegistryStarted((p) => setRequestId(p.requestId));
  return off;   // unsubscribe on unmount
}, []);
```
