# TypeScript Conventions

> Plain TypeScript, strict mode. This project does **not** use Zod or any runtime schema validator.
> Cross-layer types are hand-written interfaces in `src/shared/types.ts`; input validation at the IPC
> boundary uses the `assertSafe*` guards (see
> [`../backend/security-guards.md`](../backend/security-guards.md)), not schema parsing.

## No non-null assertions (`!`)

```typescript
// WRONG
const data = response.data!;

// CORRECT — narrow first
if (!response.success || response.data == null) {
  throw new Error(response.error ?? 'Unknown error');
}
const data = response.data;
```

In renderer code, prefer `callElectron()` (`src/renderer/lib/electron.ts`) which performs this
narrowing for you, over manual `!`.

## Avoid `any`; use `unknown` at boundaries

```typescript
// WRONG
function handle(input: any) { ... }

// CORRECT
export function failure(error: unknown): IpcResponse<never> { ... }   // real pattern in configUtils.ts
function handle(input: unknown) { /* narrow before use */ }
```

## Discriminated unions: narrow on the discriminant

The IPC envelope and `ConfigFile<T>` are discriminated unions — branch before reading the payload:

```typescript
const res = await electronAPI().config.getClaudeSettings(dir);
if (res.success) {
  use(res.data);    // present in this branch
} else {
  show(res.error);  // present in this branch
}
```

For `ConfigFile<T>`, check `exists` / `data == null` before using `data` (it is `T | null`).

## `import type` for type-only imports, chosen by layer

```typescript
import type { IpcResponse, ConfigFile } from '../../../shared/types'; // main/preload: relative
import type { ClaudeSettings } from '@shared/types';                  // renderer: alias
```

Keeps types out of the runtime bundle. Pick the import style per layer (see
[architecture.md](./architecture.md)).

## Explicit return types on exported / IPC-facing functions

```typescript
export function success<T>(data: T): IpcResponse<T> { return { success: true, data }; }
export async function readJsonFile<T>(filePath: string): Promise<ConfigFile<T>> { ... }
```

## Other rules

- **`interface` for object shapes, `type` for unions/aliases.** Matches `src/shared/types.ts`
  (`interface IpcResponse<T>`, union types for agent/session variants).
- **Type guards over casts** when narrowing `unknown` (e.g. parsed JSON) — write
  `function isX(v: unknown): v is X`.
- **No `@ts-ignore` / `@ts-expect-error`** to silence real errors — fix the type.
- **Shared types live in `src/shared/types.ts`** and are imported, never redefined locally.

## Summary

| Rule | Reason |
|------|--------|
| No `!` assertions | Runtime safety; use checks / `callElectron` |
| No `any`; use `unknown` + narrowing | Type safety at boundaries |
| Narrow unions before reading payload | `IpcResponse` / `ConfigFile` correctness |
| `import type`, layer-correct path | Clear intent, correct resolution |
| Explicit return types on exports | Documented contracts |
| Shared types in `shared/types.ts` | Single source of truth |
