/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isElectron, callElectron, electronAPI } from '../lib/electron';
import type { IpcResponse } from '@shared/types';

describe('isElectron()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when window.electronAPI is present', () => {
    vi.stubGlobal('window', { electronAPI: {} });
    expect(isElectron()).toBe(true);
  });

  it('returns false when window.electronAPI is absent', () => {
    vi.stubGlobal('window', {});
    expect(isElectron()).toBe(false);
  });
});

describe('callElectron()', () => {
  it('returns unwrapped data on success', async () => {
    const mockFn = vi.fn<[], Promise<IpcResponse<string>>>().mockResolvedValue({
      success: true,
      data: 'hello',
    });

    const result = await callElectron(mockFn);
    expect(result).toBe('hello');
  });

  it('throws an error when response.success is false', async () => {
    const mockFn = vi.fn<[], Promise<IpcResponse<string>>>().mockResolvedValue({
      success: false,
      error: 'Permission denied',
    });

    await expect(callElectron(mockFn)).rejects.toThrow('Permission denied');
  });

  it('throws "Unknown error" when success is false and no error message', async () => {
    const mockFn = vi.fn<[], Promise<IpcResponse<string>>>().mockResolvedValue({
      success: false,
    });

    await expect(callElectron(mockFn)).rejects.toThrow('Unknown error');
  });

  it('returns undefined data as undefined (not throws)', async () => {
    const mockFn = vi.fn<[], Promise<IpcResponse<void>>>().mockResolvedValue({
      success: true,
      data: undefined,
    });

    const result = await callElectron(mockFn);
    expect(result).toBeUndefined();
  });

  it('propagates the exact error message from IPC response', async () => {
    const errorMsg = 'ENOENT: no such file or directory, open /missing/path';
    const mockFn = vi.fn<[], Promise<IpcResponse<string>>>().mockResolvedValue({
      success: false,
      error: errorMsg,
    });

    await expect(callElectron(mockFn)).rejects.toThrow(errorMsg);
  });

  it('returns complex object data correctly', async () => {
    const data = { agents: [{ id: 'claude', name: 'Claude Code' }] };
    const mockFn = vi.fn<[], Promise<IpcResponse<typeof data>>>().mockResolvedValue({
      success: true,
      data,
    });

    const result = await callElectron(mockFn);
    expect(result).toEqual(data);
    expect(result.agents[0].id).toBe('claude');
  });
});

describe('electronAPI()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns window.electronAPI when in Electron context', () => {
    const mockAPI = { config: { getAgents: vi.fn() } };
    vi.stubGlobal('window', { electronAPI: mockAPI });

    const api = electronAPI();
    expect(api).toBe(mockAPI);
  });

  it('throws when not in Electron context', () => {
    vi.stubGlobal('window', {});
    expect(() => electronAPI()).toThrow('Not running in Electron');
  });
});
