# Frontend (React 19 Renderer) Guidelines

> **Tech stack**: React 19 · TypeScript · Vite 7. UI built on **Radix UI** + `@base-ui/react`
> primitives with `class-variance-authority`, `clsx`, `tailwind-merge`, **Tailwind CSS**,
> `lucide-react` icons, `sonner` toasts, and CodeMirror editors. **No** Redux/Zustand/TanStack Query —
> state is `useState` + custom hooks.

The renderer is a sandboxed browser context (`contextIsolation: true`). It never touches Node,
Electron, or the file system directly — every such operation goes through `callElectron()` and the
IPC bridge. See [`../shared/architecture.md`](../shared/architecture.md).

> **For any UI/UX change, read `DESIGN.md` (project root)** — the Notion-inspired design system (warm
> neutrals, whisper borders, Notion Blue CTA, per-agent accent colors). It is the source of truth for
> visual decisions.

---

## Directory layout

```
src/renderer/
├── main.tsx                  # Vite entry — mounts React
├── App.tsx                   # Root: AGENT_TABS + ContentView router; propagates agentColor
├── components/
│   ├── ui/                   # Radix-based primitives (button, dialog, tabs, switch, …) + CVA
│   ├── layout/               # Sidebar / shell
│   ├── agents/               # Per-agent views (ClaudePlugins, GeminiExtensions, …)
│   ├── editors/              # JsonFileEditor, MarkdownEditor, SkillsEditor, McpCommandEditor, …
│   ├── shared/               # Reusable list/row layouts (ExtensionListLayout, ExtensionRow)
│   └── shared-skills/        # Shared skills management UI
├── hooks/                    # useAgents, useConfig, useItemLoader, useTheme
└── lib/                      # electron.ts (callElectron/electronAPI), agentColors.ts,
                              #   parseMcpCommand.ts, utils.ts (cn helper)
```

---

## Documentation files

| File | When to read |
|------|--------------|
| [ipc-electron.md](./ipc-electron.md) | Calling the main process from the renderer (**must read**) |
| [state-management.md](./state-management.md) | Loading/saving data, where state lives |
| [components.md](./components.md) | Building/styling components, accessibility |
| [react-pitfalls.md](./react-pitfalls.md) | `useState`/`useMemo`/lifecycle gotchas (**must read**) |

---

## Core rules

| Rule | Reference |
|------|-----------|
| All native/FS/CLI calls go through `callElectron(() => electronAPI()…)` | [ipc-electron.md](./ipc-electron.md) |
| Never import `fs`/`path`/`os`/`electron` in the renderer | [`../shared/architecture.md`](../shared/architecture.md) |
| Import shared types via `@shared/...`; own files via `@/...` | [`../shared/architecture.md`](../shared/architecture.md) |
| Wrap a function stored in `useState` with `() =>` | [react-pitfalls.md](./react-pitfalls.md) |
| `useMemo` objects/arrays/Date before passing to a hook dependency | [react-pitfalls.md](./react-pitfalls.md) |
| No native `alert`/`confirm`/`prompt` — use Radix dialogs + `sonner` toasts | [components.md](./components.md) |
| Follow `DESIGN.md`; thread the active `agentColor` through interactive accents | [components.md](./components.md) |

---

**Language**: all documentation is written in **English**.
