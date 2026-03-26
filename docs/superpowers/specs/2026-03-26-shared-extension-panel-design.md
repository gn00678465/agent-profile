# Shared Extension/Plugin Panel — Design Spec

**Date:** 2026-03-26  
**Status:** Approved

---

## Problem Statement

`GeminiExtensionsView` and `ClaudePluginsView` share identical structural patterns (load-on-mount hook setup, loading spinner, empty state, ScrollArea shell, delete flow with toast) but are currently implemented independently. This creates duplicated boilerplate and diverging maintenance surfaces.

**Goal:** Extract the common structural code into shared units so both components stay in sync and future agent panels can reuse the same foundation.

---

## Scope

- Frontend only — no new backend IPC handlers
- Gemini enable/disable toggle is explicitly **out of scope** (deferred)
- ClaudePlugins filter, detail panel, toggle remain unchanged
- Existing tests must continue to pass

---

## Architecture

### New Files

```
src/renderer/
  hooks/
    useItemLoader.ts              ← generic load/state hook
  components/
    shared/
      ExtensionListLayout.tsx     ← ScrollArea shell + loading + empty state
```

### Modified Files

```
src/renderer/components/agents/
  GeminiExtensions.tsx            ← uses hook + layout
  ClaudePlugins.tsx               ← uses hook + layout
```

### New Test Files

```
src/renderer/hooks/__tests__/
  useItemLoader.test.ts
src/renderer/components/shared/__tests__/
  ExtensionListLayout.test.tsx
```

---

## Component Designs

### `useItemLoader<T>(loadFn: () => Promise<T[]>)`

Generic hook that standardises the load-on-mount pattern used by both panels.

```typescript
// src/renderer/hooks/useItemLoader.ts
import { useState, useCallback, useEffect } from 'react';

export function useItemLoader<T>(loadFn: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadFn();
      setItems(result);
    } finally {
      setLoading(false);
    }
  }, [loadFn]);

  useEffect(() => { load(); }, [load]);

  return { items, loading, setItems, load };
}
```

**Responsibilities:**
- Holds `items` and `loading` state
- Wraps `loadFn` in `useCallback` (caller must memoise their own fn with `useCallback`)
- Triggers load on mount via `useEffect([load])`
- Exposes `setItems` for optimistic updates and `load` for manual refresh

**Error handling:** Errors propagate to the caller (each component handles agent-specific toast messages).

---

### `ExtensionListLayout`

Shared shell component. Renders the outer structure; callers provide content via props/children.

```typescript
// src/renderer/components/shared/ExtensionListLayout.tsx
interface ExtensionListLayoutProps {
  loading: boolean;
  isEmpty: boolean;
  emptyIcon?: ReactNode;      // defaults to generic icon
  emptyTitle: string;
  emptyDescription?: string;
  toolbar?: ReactNode;        // rendered above the list (e.g. filter bar)
  children: ReactNode;        // list items
}
```

**Renders:**
1. If `loading` → centred spinner / "Loading…" text
2. If `isEmpty` (and not loading) → centred empty state (icon + title + description)
3. Otherwise → `ScrollArea` containing optional `toolbar` followed by `children`

---

### `GeminiExtensionsView` (after refactor)

Becomes a thin wrapper:

```tsx
const loadFn = useCallback(async () => {
  const r = await callElectron(() => electronAPI().config.getGeminiExtensions(configDir));
  // map to display shape
}, [configDir]);

const { items: exts, loading, setItems: setExts } = useItemLoader(loadFn);

return (
  <ExtensionListLayout
    loading={loading}
    isEmpty={exts.length === 0}
    emptyTitle="No extensions installed"
    emptyDescription="Extensions added to ~/.gemini/extensions/ will appear here."
  >
    {exts.map(ext => <ExtRow key={ext.name} ... />)}
  </ExtensionListLayout>
);
```

No toolbar, no filter, no detail panel — behaviour unchanged.

---

### `ClaudePluginsView` (after refactor)

Uses the same hook and layout; all existing functionality is preserved:

```tsx
const loadFn = useCallback(async () =>
  callElectron(() => electronAPI().config.getClaudePlugins(configDir))
, [configDir]);

const { items: plugins, loading, setItems: setPlugins, load } = useItemLoader(loadFn);
const [selected, setSelected] = useState<ClaudePlugin | null>(null);
const [filter, setFilter] = useState<'all' | 'user' | 'project'>('all');

const filtered = plugins.filter(p => filter === 'all' || p.scope === filter);

return (
  <div className="flex flex-1 overflow-hidden">
    <ExtensionListLayout
      loading={loading}
      isEmpty={filtered.length === 0}
      emptyTitle="No plugins installed"
      toolbar={<FilterToolbar filter={filter} onChange={setFilter} count={plugins.length} onRefresh={load} accentColor={accentColor} />}
    >
      {filtered.map(plugin => <PluginRow key={...} ... />)}
    </ExtensionListLayout>
    {selected && <PluginDetail ... />}
  </div>
);
```

The toolbar (filter pills + refresh button) is extracted as `FilterToolbar` to keep the parent component readable.

---

## Data Flow

```
GeminiExtensionsView
  useItemLoader(loadFn)          → items[], loading, setItems
  ExtensionListLayout            → renders shell
    ExtRow[]                     → renders list items

ClaudePluginsView
  useItemLoader(loadFn)          → plugins[], loading, setItems, load
  filter state                   → filtered[]
  selected state                 → detail panel
  ExtensionListLayout            → renders shell
    FilterToolbar (toolbar slot) → filter pills + refresh
    PluginRow[]                  → renders list items
  PluginDetail (side panel)      → plugin metadata
```

---

## Error Handling

| Location | Behaviour |
|----------|-----------|
| `useItemLoader` | Re-throws; `loading` is set to `false` in `finally` |
| `GeminiExtensionsView.loadFn` | Catches, calls `toast.error()` |
| `ClaudePluginsView.loadFn` | Catches, calls `toast.error()` |
| Delete handlers | Each component handles its own error toast (agent-specific messages) |

---

## Testing Plan

| File | Tests |
|------|-------|
| `useItemLoader.test.ts` | success load, error propagation, re-load on call |
| `ExtensionListLayout.test.tsx` | loading state, empty state (with/without icon), toolbar slot, children slot |
| `GeminiExtensions.test.tsx` | existing tests pass unchanged |
| `ClaudePlugins.test.tsx` | existing tests pass unchanged |

---

## What Does NOT Change

- All IPC channels and backend handlers
- GeminiExtensions feature set (no toggle added)
- ClaudePlugins feature set (filter, detail panel, toggle all preserved)
- Public component signatures (`configDir`, `accentColor` props)
- Existing test coverage

---

## Expected Impact

- **Removed duplication:** ~35 lines of identical boilerplate per component
- **Reusability:** Any future agent panel (e.g. Copilot extensions) can use `useItemLoader` + `ExtensionListLayout` immediately
- **Consistency:** Loading spinner and empty state look identical across agents without manual coordination
