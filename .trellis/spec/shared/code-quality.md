# Code Quality

> Mandatory quality rules across all layers. See [typescript.md](./typescript.md) for type-specific
> rules and [`../backend/ipc-handlers.md`](../backend/ipc-handlers.md) for the error-envelope contract.

## Immutability (critical)

Never mutate an existing object — build a new one. This matters especially when editing parsed config
before writing it back to disk.

```typescript
// WRONG — mutates the parsed config in place
settings.model = 'opus';
await writeJsonFile(p, settings);

// CORRECT — new object, unknown keys preserved by the spread
await writeJsonFile(p, { ...settings, model: 'opus' });
```

Use spread / `structuredClone` for nested updates. (See
[`../backend/config-persistence.md`](../backend/config-persistence.md) on preserving unknown keys.)

## File organization

- **Many small files over few large ones.** ~200–400 lines is typical; treat ~800 as a hard ceiling.
  `src/main/ipc/configHandlers.ts` (~1000 lines) is a known split candidate, not a model to copy.
- Organize by feature/domain. Renderer: `components/{ui,editors,agents,layout,shared}` + `hooks/` +
  `lib/`. Main: `ipc/handlers/{agent}Handler.ts`.

## Error handling

- **Never swallow errors.** No empty `catch`. In the main process, return `failure(err)`; in the
  renderer, let `callElectron()` throw and surface it (a `sonner` toast).
- **Never leak internals across IPC.** `failure()` already normalizes to a string `error` — don't
  return raw `Error` objects or stack traces to the renderer.
- **Validate at boundaries.** Renderer-supplied input is untrusted: guard it (`assertSafe*`) before
  use; tolerate missing/corrupt config files rather than throwing.

## Naming

| Kind | Convention | Example |
|------|-----------|---------|
| React component / file | PascalCase | `JsonFileEditor.tsx` |
| Hook | `use` + camelCase | `useConfig.ts`, `useItemLoader.ts` |
| Util / lib file | camelCase | `parseMcpCommand.ts`, `agentColors.ts` |
| IPC handler module | `{domain}Handler.ts` | `claudeHandler.ts`, `rulesHandler.ts` |
| Variable / function | camelCase | `configDir`, `readJsonFile` |
| Constant | SCREAMING_SNAKE_CASE | `IPC_CHANNELS`, `AGENT_TABS` |
| Type / interface | PascalCase | `IpcResponse`, `ClaudeSettings` |
| Boolean | `is`/`has`/`should`/`can` prefix | `isElectron`, `hasPermission` |

## No stray `console.log`

Remove debug `console.log` before committing. Surfacing errors to the user is the renderer's job
(toasts via `sonner`); diagnostics in the main process can use `console.error` sparingly.

## Before marking work done

- [ ] Functions small (< ~50 lines), files focused (< 800)
- [ ] No mutation — immutable updates only
- [ ] Errors handled (no empty catch, no leaked internals)
- [ ] No `!`, no `any`, no stray `console.log`
- [ ] `bun run typecheck && bun run lint && bun run test` green; `check-architecture.sh` clean

---

**Language**: all documentation is written in **English**.
