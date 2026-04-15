# E2E Tests — Blocked

**Feature**: feat-016 — Playwright E2E tests for critical user flows  
**Status**: BLOCKED  
**Blocked since**: 2025-07

---

## What Was Built

Infrastructure is complete and ready for when the blocker is resolved:

| File | Purpose |
|------|---------|
| `e2e/app.spec.ts` | 3 test scenarios (sidebar, navigation, save-to-disk) |
| `e2e/fixtures.ts` | Per-test isolated `tempHome`, `electronApp`, `page` fixtures |
| `e2e/electron-entry.cjs` | CJS bridge that `require()`s the ESM main entry |
| `e2e/tsconfig.json` | TypeScript support for e2e files |
| `playwright.config.ts` | Root Playwright config (1 worker, 30 s timeout) |
| `package.json` | `test:e2e` script added |

## Root Cause

Playwright's `electron.launch()` crashes the Electron process with Windows exit code
`0x80000003` (`STATUS_BREAKPOINT`) immediately after the Node.js inspector attaches.

**Crash sequence:**
```
Debugger listening on ws://127.0.0.1:<port>/<uuid>
Debugger attached.
<ws disconnected> code=1006
<process did exit: exitCode=2147483651>
```

**Diagnosis findings:**

1. Crash happens in **C++ / V8 layer** — no JavaScript error is printed.
2. Crash is **triggered by Playwright's CDP messages** (`Runtime.enable` +
   `Runtime.evaluate` with `require('electron')` / `__playwright_run()`) sent after
   the WebSocket upgrade to the Node.js inspector.
3. Plain TCP connection — no crash.  
   WebSocket upgrade alone — no crash.  
   CDP `Runtime.enable` sent — no crash *(manually verified with raw frames)*.  
   **Playwright's full initialization sequence — always crashes.**
4. Reproducible on **both Electron 35.7.5 and Electron 41.2.0** with
   Playwright 1.59.1 on Windows.
5. Running the app **without** `--inspect=0` works perfectly.
6. Same crash with every entry-point strategy tried:
   - `.mjs` directly
   - CJS wrapper with dynamic `import(pathToFileURL(...))`
   - CJS wrapper with synchronous `require('./index.mjs')` (Node ≥ v22.12)

**Upstream issue**: [electron/electron #47419](https://github.com/electron/electron/issues/47419) —
confirms `electron.launch` breaks starting with Electron 36.x on some platforms.
Electron 37 reportedly fixed it *locally* on Linux/macOS but CI and Windows remain
unreliable. No confirmed fix for Electron 41 + Windows + Playwright 1.59.1.

## What Was Tried

| Attempt | Result |
|---------|--------|
| `.mjs` entry directly | STATUS_BREAKPOINT |
| CJS wrapper + `import(pathToFileURL(...))` | STATUS_BREAKPOINT |
| CJS wrapper + `require('./index.mjs')` | STATUS_BREAKPOINT |
| Downgrade to Electron 35.7.5 | STATUS_BREAKPOINT (same) |
| Electron binary check: fuse `EnableNodeCliInspectArguments` | Enabled — not the cause |
| Running app without `--inspect` flag | Works fine |
| Simple TCP/WS connection without CDP messages | Works fine |
| CDP `Runtime.enable` via raw WS frame | Works fine |

## Unblocking Paths (Future Work)

### Option A — Wait for official Playwright fix
Monitor [microsoft/playwright](https://github.com/microsoft/playwright) and
[electron/electron #47419](https://github.com/electron/electron/issues/47419) for
a confirmed fix. When `electron.launch()` works on Windows with Electron 41+, the
existing `e2e/` tests should pass with minimal changes.

### Option B — CDP bridge (no `electron.launch`)
Bypass Playwright's `_electron` API entirely. Launch Electron as a subprocess with
`--remote-debugging-port=<port>` (no `--inspect`), then connect via
`chromium.connectOverCDP()`. This avoids the Node.js inspector protocol entirely.

Prototype sketch:
```ts
// fixtures.ts — alternative launcher
const proc = spawn(ELECTRON_BIN, [
  MAIN, `--remote-debugging-port=9222`
], { env: { ...process.env, USERPROFILE: tempHome } });
// wait for "DevTools listening" on stdout
const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts()[0].pages()[0];
```

Trade-off: loses `app.evaluate()` / main-process access; renderer tests still work.

### Option C — Mock IPC renderer tests
Keep the Playwright E2E tests for renderer-only flows (UI navigation, interactions)
using Playwright's standard browser mode with a mocked `window.electronAPI`.
Unit tests already cover the IPC handlers thoroughly.

### Option D — electron-playwright-helpers
Try [`electron-playwright-helpers`](https://www.npmjs.com/package/electron-playwright-helpers)
which provides compatibility shims and `findLatestBuild` / `parseElectronApp` helpers.
May include workarounds for this specific CDP crash.

## Current State

- Unit tests: **378 passing** — unaffected.
- Lint: **0 errors** — unaffected.
- E2E infrastructure: **complete** — waiting for launcher fix.
- `feature_list.json` feat-016: **blocked**.
