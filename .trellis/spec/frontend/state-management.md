# State Management

> State is local React state (`useState`) plus small custom hooks that own one slice of data each.
> There is **no** Redux, Zustand, MobX, or TanStack Query. Data comes from the main process via
> `callElectron` (see [ipc-electron.md](./ipc-electron.md)).

## Custom data hooks

Each data concern is a hook in `src/renderer/hooks/`. The shape is consistent: local state +
`useCallback` loader + `useEffect` to load + action callbacks.

```typescript
// Pattern (src/renderer/hooks/useConfig.ts, useAgents.ts, useItemLoader.ts)
export function useSkills(configDir: string | null) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!configDir) return;
    setLoading(true);
    try {
      setSkills(await callElectron(() => electronAPI().config.getSkills(configDir)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [configDir]);

  useEffect(() => { void load(); }, [load]);

  const saveSkill = useCallback(async (skill: Skill) => {
    await callElectron(() => electronAPI().config.saveSkill(configDir!, skill));
    await load();   // re-load after a write so the UI reflects disk
  }, [configDir, load]);

  return { skills, loading, error, saveSkill, reload: load };
}
```

Existing hooks: `useAgents` (agent list), `useConfig` (`useSkills`, `useMarkdown`), `useItemLoader`
(generic async loader), `useTheme` (dark/light + persistence).

## Where state lives

| State | Where | Notes |
|-------|-------|-------|
| Active agent + active tab | `App.tsx` (`useState`) | `AGENT_TABS` drives the tab list; never unmounts |
| Per-feature data (skills, settings, plugins…) | the feature's custom hook | one hook per data slice |
| Per-component UI (open dialog, form input, filter) | component `useState` | lift to parent only if it must survive unmount |
| Theme | `useTheme` | persisted |
| Active agent accent color | prop (`agentColor`) | threaded down from `App.tsx`, not a context |

## Rules

1. **One hook per data slice.** Don't fetch the same data in two components — share a hook.
2. **Immutable updates.** `setSkills(prev => [...prev, next])`, never `prev.push(...)`. (See
   [`../shared/code-quality.md`](../shared/code-quality.md).)
3. **Re-load after writes.** After a successful save/delete IPC call, re-run the loader so the UI
   matches disk (there is no cache layer to invalidate).
4. **Errors → state → toast.** Catch in the hook, store an `error` string, and surface it via `sonner`
   at the component; never let a rejected promise go unhandled.
5. **Distinguish initial load from refetch** to avoid skeleton flicker — see
   [react-pitfalls.md](./react-pitfalls.md).
6. **Lift state only as far as needed.** Prefer local `useState`; lift to `App.tsx` (which never
   unmounts) when state must persist across tab/agent switches. Don't reach for a global store.

---

**Language**: all documentation is written in **English**.
