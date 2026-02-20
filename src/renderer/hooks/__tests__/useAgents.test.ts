/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgents } from '../useAgents';
import type { AgentProfile } from '@shared/types';

// Mock the electron module
vi.mock('../../lib/electron', () => ({
  callElectron: vi.fn(),
  electronAPI: vi.fn(),
  isElectron: vi.fn(() => true),
}));

import { callElectron, electronAPI } from '../../lib/electron';

const mockAgents: AgentProfile[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    configDir: '/home/user/.claude',
    type: 'claude-code',
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    configDir: '/home/user/.gemini',
    type: 'gemini',
  },
];

describe('useAgents hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockApi = {
      config: {
        getAgents: vi.fn().mockResolvedValue({ success: true, data: mockAgents }),
      },
    };
    vi.mocked(electronAPI).mockReturnValue(mockApi as any);
  });

  it('starts in loading state', () => {
    vi.mocked(callElectron).mockImplementation(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useAgents());
    expect(result.current.loading).toBe(true);
    expect(result.current.agents).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('loads agents successfully', async () => {
    vi.mocked(callElectron).mockResolvedValue(mockAgents);

    const { result } = renderHook(() => useAgents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.agents).toEqual(mockAgents);
    expect(result.current.error).toBeNull();
  });

  it('sets error state when loading fails', async () => {
    vi.mocked(callElectron).mockRejectedValue(new Error('IPC connection failed'));

    const { result } = renderHook(() => useAgents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('IPC connection failed');
    expect(result.current.agents).toEqual([]);
  });

  it('sets generic error message for non-Error failures', async () => {
    vi.mocked(callElectron).mockRejectedValue('some string error');

    const { result } = renderHook(() => useAgents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load agents');
  });

  it('refresh() reloads agents', async () => {
    vi.mocked(callElectron).mockResolvedValue(mockAgents);

    const { result } = renderHook(() => useAgents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updatedAgents = [...mockAgents, {
      id: 'copilot',
      name: 'GitHub Copilot',
      configDir: '/home/user/.copilot',
      type: 'copilot' as const,
    }];

    vi.mocked(callElectron).mockResolvedValue(updatedAgents);

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.agents).toHaveLength(3);
  });

  it('clears error on successful refresh', async () => {
    vi.mocked(callElectron).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAgents());

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });

    vi.mocked(callElectron).mockResolvedValue(mockAgents);

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.agents).toEqual(mockAgents);
  });
});
