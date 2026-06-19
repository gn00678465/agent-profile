# React Pitfalls

> React 19 traps that cause real bugs in this renderer. The first two are **must-knows**.

## 1. Storing a function in `useState`

`useState`'s setter treats a function argument as an *updater* and calls it immediately. To store a
function as a value, wrap it:

```tsx
const [cb, setCb] = useState<(() => void) | null>(null);

setCb(myFunction);        // WRONG — React runs myFunction(prevState) now
setCb(() => myFunction);  // CORRECT — stores the function
```

**Symptoms:** state resets right after you set it; UI flickers to the new value then reverts.

## 2. Object / array / `Date` in hook dependencies

React compares dependencies by reference (`===`). A value recreated each render (an inline object, or
anything from a function that returns `new Date()` / `{...}`) makes the dependency change every render
→ refetch → re-render → **infinite loop**.

```tsx
// WRONG — new object every render
const range = getDateRange(option);
useMyData(range);

// CORRECT — stabilize with useMemo
const range = useMemo(() => getDateRange(option), [option]);
useMyData(range);
```

| Dependency value | Needs `useMemo`? |
|------------------|------------------|
| primitives (string/number/boolean) | No |
| inline object/array | Yes |
| `Date` / result of a function returning a new object | Yes |
| value from `useState` / `useRef` | No (already stable) |

**Symptoms:** the same IPC call fires repeatedly, high CPU, unresponsive UI.

## 3. State lost when a component unmounts

Conditional rendering unmounts a subtree and discards its `useState`. If the state should survive
(e.g. expand/collapse, selection, scroll position), lift it to an ancestor that doesn't unmount during
that flow — in this app, often `App.tsx`.

```tsx
// expandedIds is lost every time we switch to the editor and back:
if (editing) return <Editor item={editing} />;
return <Tree />;                       // remounts with fresh state

// Lift it so it persists:
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
if (editing) return <Editor item={editing} />;
return <Tree expandedIds={expandedIds} onExpandedIdsChange={setExpandedIds} />;
```

Decision: component-level (form/temp UI) → local `useState`; page-level (survives tab/agent switch) →
lift to a stable parent; session-level (preferences) → persist (`useTheme` pattern / `localStorage`).

## 4. Loading flash on refetch

Showing the skeleton on *every* fetch makes the UI flicker after a save/delete refetch. Distinguish
the initial load from a background refetch:

```tsx
const [loading, setLoading] = useState(true);      // initial only
const [refetching, setRefetching] = useState(false);

const load = async (isRefetch = false) => {
  isRefetch ? setRefetching(true) : setLoading(true);
  try { setData(await callElectron(() => electronAPI().config.getSkills(dir))); }
  finally { setLoading(false); setRefetching(false); }
};
```

Show the skeleton on initial load; keep showing existing data (optionally a subtle indicator) on
refetch.

## 5. Hooks keyed by an `id` reset their state on `id` change

Any hook that namespaces internal state by an `id` prop clears that state when the `id` changes. If you
`set...` right before changing the `id`, the change wipes it (race). Stash the value in a `ref` and
apply it in a `useEffect` that runs *after* the `id` change settles.

---

## Quick reference

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Function in `useState` | state resets / function runs early | wrap with `() =>` |
| Object/Date in deps | infinite loop, endless IPC | `useMemo` |
| State in unmounting component | lost on navigation | lift to stable parent |
| Loading on every fetch | flicker | initial vs. refetch flags |
| Hook keyed by `id` | state cleared on switch | `ref` + `useEffect` after change |

**Language**: all documentation is written in **English**.
