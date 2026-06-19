# Thinking Guides

> **Purpose**: systematic questions to ask *before* coding, to catch issues before they become bugs.
> Most defects come from "didn't think of that," not lack of skill.
>
> These are general-purpose engineering guides (not tied to any one stack). The data-layer-specific
> guides from the original template (DB schema change, transaction consistency) were removed — this
> app has no database; persistence is JSON/Markdown files (see
> [`../backend/config-persistence.md`](../backend/config-persistence.md)).

## Available guides

| Guide | Use when |
|-------|----------|
| [pre-implementation-checklist.md](./pre-implementation-checklist.md) | Before starting any feature — verify readiness, search for existing patterns first |
| [cross-layer-thinking-guide.md](./cross-layer-thinking-guide.md) | A change spans renderer ↔ preload ↔ main ↔ shared (the IPC path) |
| [code-reuse-thinking-guide.md](./code-reuse-thinking-guide.md) | You're about to write something that may already exist |
| [bug-root-cause-thinking-guide.md](./bug-root-cause-thinking-guide.md) | After fixing a non-trivial bug — make it un-repeatable |
| [semantic-change-checklist.md](./semantic-change-checklist.md) | Changing what a field/value *means*, not just adding one |

## This project's layers

When applying the cross-layer guide, the boundaries here are (see
[`../shared/architecture.md`](../shared/architecture.md)):

```
Renderer (React components)
   │  callElectron()  →  window.electronAPI
Preload (contextBridge)
   │  ipcRenderer.invoke
Main (ipcMain.handle → handlers)
   │  fs / spawn
Disk (JSON / Markdown / JSONL config files)   ← no database
```

Each boundary is a place where types, serialization, and async timing can drift — only serializable
data crosses IPC, and every handler returns the `IpcResponse<T>` envelope.

## The pre-modification rule

> Before changing any value, **search first.**

```bash
rg "VALUE_TO_CHANGE" --type ts        # who else references it?
```

This single habit prevents most "forgot to update X" bugs — especially channel names in
`src/shared/types.ts`, which are referenced from main, preload, and the renderer type.

---

**Language**: all documentation is written in **English**.
