/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('light');

  // jsdom doesn't implement matchMedia — provide a stub
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('useTheme', () => {
  it('defaults to system theme when no localStorage value', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
  });

  it('reads initial theme from localStorage', () => {
    localStorage.setItem('theme', 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
  });

  it('toggleTheme switches from dark to light', () => {
    localStorage.setItem('theme', 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(true);

    act(() => { result.current.toggleTheme(); });

    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('toggleTheme switches from light to dark', () => {
    localStorage.setItem('theme', 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);

    act(() => { result.current.toggleTheme(); });

    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('adds light class to html element when theme is light', () => {
    localStorage.setItem('theme', 'light');
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('removes light class from html element when theme is dark', () => {
    document.documentElement.classList.add('light');
    localStorage.setItem('theme', 'dark');
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('setTheme persists to localStorage', () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.setTheme('light'); });
    expect(localStorage.getItem('theme')).toBe('light');
    expect(result.current.theme).toBe('light');
  });
});
