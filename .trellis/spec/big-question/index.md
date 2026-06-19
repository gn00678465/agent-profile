# Big Questions / Pitfalls

> Recurring traps in this Electron + React + Vite codebase. Read the relevant entry when the symptom
> matches; add a new entry (and link it here) after debugging a non-trivial, repeatable issue.

## Entries

| Document | Severity | Summary |
|----------|----------|---------|
| [ipc-handler-registration.md](./ipc-handler-registration.md) | P1 | New IPC handler doesn't fire — not wired into `registerHandlers()` or channel name drift |
| [react-usestate-function.md](./react-usestate-function.md) | P2 | Storing a function in `useState` executes it immediately |
| [css-flex-centering.md](./css-flex-centering.md) | P2 | Visual vs. mathematical centering in flex layouts |

## Quick debugging checklist

**IPC call does nothing / "no handler registered"**
1. Is the channel constant the same in `shared/types.ts`, the main handler, and `preload/index.ts`? → [ipc-handler-registration.md](./ipc-handler-registration.md)
2. Is the handler reachable from `registerHandlers()` in `src/main/index.ts`?
3. Is the method exposed on `window.electronAPI` in `preload/index.ts` and typed in `renderer/lib/electron.ts`?

**Renderer throws `Module not found: fs/path/electron`**
- The renderer cannot import Node/Electron. Route through `callElectron()` + an IPC handler. See [`../frontend/ipc-electron.md`](../frontend/ipc-electron.md) and [`../shared/architecture.md`](../shared/architecture.md).

**Infinite re-render / endless IPC calls**
- An object/array/`Date` is recreated each render and passed to a hook dependency. Stabilize with `useMemo`. See [`../frontend/react-pitfalls.md`](../frontend/react-pitfalls.md).

**State resets right after you set it**
- A function stored in `useState` without an arrow wrapper. → [react-usestate-function.md](./react-usestate-function.md)

---

> This codebase has **no database and no native modules** — pitfalls about SQLite, Drizzle
> transactions, native-module packaging, or network-stack/HID/keyboard issues do not apply here.

**Language**: all documentation is written in **English**.
