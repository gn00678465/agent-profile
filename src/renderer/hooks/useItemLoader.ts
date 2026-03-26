import { useState, useCallback, useEffect } from 'react';

/**
 * Loads an array of items on mount and exposes controls for manual refresh
 * and optimistic updates.
 *
 * @param loadFn - **Must be stable across renders** (wrap in `useCallback`).
 *   A new `loadFn` reference triggers a reload. An unstable reference (e.g.,
 *   an inline arrow function) causes an infinite fetch loop.
 *   `loadFn` is contractually required to catch its own errors and return `[]`
 *   rather than throwing; the hook's internal `catch {}` is a safety net only.
 */
export function useItemLoader<T>(loadFn: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadFn();
      setItems(result ?? []);
    } catch {
      // Safety net: loadFn is contractually required to catch its own errors and
      // return []. This catch prevents unhandled promise rejections from useEffect
      // if a caller violates the contract.
    } finally {
      setLoading(false);
    }
  }, [loadFn]);

  useEffect(() => { void load(); }, [load]);

  return { items, loading, setItems, load };
}
