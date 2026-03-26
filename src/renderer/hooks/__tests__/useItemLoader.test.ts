/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useItemLoader } from '../useItemLoader';

describe('useItemLoader', () => {
  it('starts in loading state with empty items', () => {
    const loadFn = vi.fn(() => new Promise<string[]>(() => {}));
    const { result } = renderHook(() => useItemLoader(loadFn));
    expect(result.current.loading).toBe(true);
    expect(result.current.items).toEqual([]);
  });

  it('calls loadFn on mount and populates items', async () => {
    const loadFn = vi.fn().mockResolvedValue(['a', 'b']);
    const { result } = renderHook(() => useItemLoader(loadFn));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual(['a', 'b']);
    expect(loadFn).toHaveBeenCalledTimes(1);
  });

  it('sets loading=false in finally even when loadFn throws', async () => {
    const loadFn = vi.fn().mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useItemLoader(loadFn));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });

  it('load() can be called manually for refresh', async () => {
    const loadFn = vi.fn()
      .mockResolvedValueOnce(['first'])
      .mockResolvedValueOnce(['first', 'second']);
    const { result } = renderHook(() => useItemLoader(loadFn));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual(['first']);

    await act(async () => { await result.current.load(); });
    expect(result.current.items).toEqual(['first', 'second']);
    expect(loadFn).toHaveBeenCalledTimes(2);
  });

  it('setItems enables optimistic updates without reload', async () => {
    const loadFn = vi.fn().mockResolvedValue(['a']);
    const { result } = renderHook(() => useItemLoader(loadFn));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.setItems(['a', 'b']); });
    expect(result.current.items).toEqual(['a', 'b']);
    expect(loadFn).toHaveBeenCalledTimes(1); // no reload triggered
  });
});
