# Agent Profile — Development Spec

Project-specific coding guidelines for **Agent Profile**, an Electron + React 19 + TypeScript desktop
app that manages local AI-agent configuration files (Claude Code, Gemini CLI, GitHub Copilot CLI). The
app never talks to a cloud service — it reads and writes config files under `~/.claude/`, `~/.gemini/`,
`~/.copilot/`, etc.

These docs are the source of truth for how code is written in this repo. The Trellis runtime injects
the relevant files into `trellis-implement` / `trellis-check` sub-agents per task, so keeping them
accurate keeps generated code on-pattern. The human-facing architecture overview lives in
`docs/ARCHITECTURE.md`; the design system lives in `DESIGN.md`.

## Tech stack (reality)

- **Shell/build**: Electron 41, Vite 7 + `vite-plugin-electron`, TypeScript 5.8 (ESM)
- **Renderer**: React 19, Radix UI + `@base-ui/react`, `class-variance-authority` + Tailwind CSS,
  `lucide-react`, `sonner`, CodeMirror
- **State**: `useState` + custom hooks (no Redux/Zustand/TanStack Query)
- **Main**: Node.js, child_process for the `claude` CLI
- **Persistence**: plain JSON / Markdown / JSONL files — **no database, no ORM, no Zod**
- **Tooling**: **bun**, **Vitest 4**, ESLint (`@antfu/eslint-config`), `scripts/check-architecture.sh`

## Structure

### [Shared](./shared/index.md) — cross-cutting
- [Layer Boundaries & Import Aliases](./shared/architecture.md) — start here
- [TypeScript Conventions](./shared/typescript.md)
- [Code Quality](./shared/code-quality.md)
- [Git Conventions](./shared/git-conventions.md)

### [Backend](./backend/index.md) — Electron main process
- [IPC Handlers (the envelope)](./backend/ipc-handlers.md)
- [Security Guards](./backend/security-guards.md)
- [CLI Runner](./backend/cli-runner.md)
- [Config Persistence](./backend/config-persistence.md)

### [Frontend](./frontend/index.md) — React 19 renderer
- [IPC from the Renderer](./frontend/ipc-electron.md)
- [State Management](./frontend/state-management.md)
- [Components & Styling](./frontend/components.md)
- [React Pitfalls](./frontend/react-pitfalls.md)

### [Guides](./guides/index.md) — thinking flows (stack-agnostic)
Pre-implementation, cross-layer, code-reuse, bug-root-cause, semantic-change.

### [Big Questions](./big-question/index.md) — pitfalls
IPC handler registration, `useState`-stored functions, flex centering.

## The load-bearing rules

1. **Never throw across IPC** — return `IpcResponse<T>`. ([backend/ipc-handlers.md](./backend/ipc-handlers.md))
2. **Guard renderer input** with `assertSafePath` / `assertSafeName` before FS access. ([backend/security-guards.md](./backend/security-guards.md))
3. **Spawn `claude` only via the whitelisted `cliRunner`**, `shell: false`. ([backend/cli-runner.md](./backend/cli-runner.md))
4. **Respect the 4-layer boundaries** (enforced by `check-architecture.sh`); renderer goes through `callElectron`. ([shared/architecture.md](./shared/architecture.md))

---

**Language**: all documentation is written in **English**.
