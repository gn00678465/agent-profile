# Components & Styling

> Build on the existing Radix-based primitives, style with Tailwind + CVA, and follow `DESIGN.md`.
> Read [`../../../DESIGN.md`](../../../DESIGN.md) before any UI change — it is the design source of truth.

## Organization

| Directory | What goes here |
|-----------|----------------|
| `components/ui/` | Generic primitives wrapping Radix / `@base-ui/react` (button, dialog, tabs, switch, select, tooltip…) with `class-variance-authority` variants. Reuse these — don't hand-roll buttons/dialogs. |
| `components/layout/` | App shell (`Sidebar`) |
| `components/agents/` | Per-agent feature views (`ClaudePlugins`, `GeminiExtensions`) |
| `components/editors/` | Domain editors (`JsonFileEditor`, `MarkdownEditor`, `SkillsEditor`, `McpCommandEditor`, `RulesEditor`, session views) |
| `components/shared/` | Reusable list/row scaffolding (`ExtensionListLayout`, `ExtensionRow`) with loading/empty/content states |

Compose feature views from `editors/` + `shared/` + `ui/`. New generic widget → add to `ui/`. New
per-agent screen → `agents/`.

## Styling

- **Tailwind utility classes**, merged with the `cn()` helper (`clsx` + `tailwind-merge`) from
  `src/renderer/lib/utils.ts`. Use `cn(...)` for conditional classes — don't concatenate strings.
- **Variants via `cva`** (see `components/ui/button.tsx`) — encode size/variant there, not as ad-hoc
  conditionals at call sites.
- **Design tokens from `DESIGN.md`**: warm neutral palette, whisper border (`1px solid
  rgba(0,0,0,0.1)`), Notion Blue (`#0075de`) for the primary CTA. Reference tokens / CSS custom
  properties, don't hardcode arbitrary hex.
- **Agent accent color**: the active `agentColor` is threaded from `App.tsx` as a prop. Use it for
  interactive accents (selected tab, toggle on-state, highlights) so each agent keeps its identity.
  Helpers live in `src/renderer/lib/agentColors.ts`.

## Accessibility & interaction

- **Semantic elements.** Use `<button>` for actions; reserve `<div role="button" tabIndex={0}>` (with
  `onKeyDown` for Enter/Space) for the case where a clickable card must contain its own nested button
  — HTML forbids `<button>` inside `<button>`.
- **No native browser dialogs.** Never `alert`/`confirm`/`prompt` (poor UX, blocked under Electron).
  Use the Radix alert-dialog from `ui/` for confirmation and `sonner` for transient feedback:
  ```typescript
  import { toast } from 'sonner';
  toast.success('Saved'); toast.error(message);
  ```
- **Native file/dir pickers go through IPC** — `electronAPI().dialog.openDir()/openFile()/saveFile()`,
  never an `<input type="file">` expecting a real path.

## Layout polish

- Reserve scrollbar space on scrollable containers with `scrollbar-gutter: stable` to avoid content
  jumping when the scrollbar appears.
- Render explicit loading and empty states (the `shared/` list components already model
  loading/empty/content) — don't show a blank panel while data loads.

---

**Language**: all documentation is written in **English**.
