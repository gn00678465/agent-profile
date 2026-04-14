/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { isElectron, callElectron } from '../../renderer/lib/electron';

describe('isElectron', () => {
  it('should return true when electronAPI is present on window', () => {
    // electronAPI is set in setup.ts via Object.defineProperty
    // If not set, manually set it for this test
    if (!('electronAPI' in window)) {
      Object.defineProperty(window, 'electronAPI', { value: {}, configurable: true });
    }
    expect(isElectron()).toBe(true);
  });
});

describe('callElectron', () => {
  it('should return data on success', async () => {
    const result = await callElectron(() =>
      Promise.resolve({ success: true, data: 'test-data' })
    );
    expect(result).toBe('test-data');
  });

  it('should throw on failure', async () => {
    await expect(
      callElectron(() =>
        Promise.resolve({ success: false, error: 'Something went wrong' })
      )
    ).rejects.toThrow('Something went wrong');
  });

  it('should throw with generic message when no error provided', async () => {
    await expect(
      callElectron(() =>
        Promise.resolve({ success: false })
      )
    ).rejects.toThrow('Unknown error');
  });

  it('should handle complex data types', async () => {
    const complexData = { mcpServers: { test: { command: 'npx', args: ['-y', 'test'] } } };
    const result = await callElectron(() =>
      Promise.resolve({ success: true, data: complexData })
    );
    expect(result).toEqual(complexData);
  });
});
