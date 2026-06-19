# Shared Development Guidelines

> Cross-cutting conventions that apply to every layer of Agent Profile. Read these alongside the
> layer-specific specs in [`../backend/`](../backend/index.md) and [`../frontend/`](../frontend/index.md).

---

## Documentation files

| File | Description | When to read |
|------|-------------|--------------|
| [architecture.md](./architecture.md) | 4-layer boundaries, import aliases, `shared/types.ts` | **Always** — before importing across layers |
| [typescript.md](./typescript.md) | TypeScript conventions (no Zod; plain types) | Type-related decisions |
| [code-quality.md](./code-quality.md) | Immutability, file size, error handling | Always |
| [git-conventions.md](./git-conventions.md) | Conventional commits, branch naming, finish flow | Before committing |

---

## Core rules (mandatory)

| Rule | Reference |
|------|-----------|
| Respect layer boundaries; pick the right import alias per layer | [architecture.md](./architecture.md) |
| All cross-layer types & `IPC_CHANNELS` live in `src/shared/types.ts` | [architecture.md](./architecture.md) |
| Never throw across IPC — return `IpcResponse<T>` | [`../backend/ipc-handlers.md`](../backend/ipc-handlers.md) |
| Guard renderer-supplied paths/names before FS access | [`../backend/security-guards.md`](../backend/security-guards.md) |
| Never mutate objects — build new ones (`{ ...obj }` / `structuredClone`) | [code-quality.md](./code-quality.md) |
| No non-null assertions (`!`); no `any` | [typescript.md](./typescript.md) |
| Conventional commits; stage files explicitly (no `git add .`) | [git-conventions.md](./git-conventions.md) |

---

## Tech stack (reality check)

- **Runtime/build:** Electron 41, React 19, TypeScript 5.8 (ESM), Vite 7 + `vite-plugin-electron`.
- **Package manager / test runner:** **bun** (`bun run <script>`), **Vitest 4** (`bun run test`, *not*
  `bun test`).
- **UI:** Radix UI + `@base-ui/react` primitives, `class-variance-authority`, `clsx`, `tailwind-merge`,
  Tailwind CSS, `lucide-react`, `sonner` (toasts), CodeMirror (editors).
- **Persistence:** plain JSON / Markdown / JSONL files on disk. **No database, no ORM, no Zod, no
  TanStack Query, no Redux/Zustand.** If a spec or example mentions those, it does not apply here.

---

## Before every commit

```bash
bun run typecheck && bun run lint && bun run test
bash scripts/check-architecture.sh
```

- [ ] `bun run typecheck` — 0 errors
- [ ] `bun run lint` — 0 errors, 0 warnings
- [ ] `bun run test` — all pass (baseline ≥ 409)
- [ ] `bash scripts/check-architecture.sh` — 0 violations
- [ ] No non-null assertions (`!`), no `any`
- [ ] Commit message follows the conventional format

---

**Language**: all documentation is written in **English**.
