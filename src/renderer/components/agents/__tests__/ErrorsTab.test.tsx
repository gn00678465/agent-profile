/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ErrorsTab } from '../ClaudePlugins/ErrorsTab';

vi.mock('@/lib/electron', () => ({
  callElectron: vi.fn(),
  electronAPI: vi.fn(),
  isElectron: vi.fn(() => true),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { callElectron, electronAPI } from '@/lib/electron';

function unwrapMock() {
  vi.mocked(callElectron).mockImplementation(async (fn: any) => {
    const r = await fn();
    if (r && typeof r === 'object' && 'success' in r) {
      if (!r.success) throw new Error(r.error);
      return r.data;
    }
    return r;
  });
}

function setupApi(data: any[]) {
  const api = {
    config: {
      getClaudePluginErrors: vi.fn().mockResolvedValue({ success: true, data }),
    },
  };
  vi.mocked(electronAPI).mockReturnValue(api as any);
  return api;
}

describe('ErrorsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unwrapMock();
  });

  it('renders an empty state when no errors are present', async () => {
    setupApi([]);
    render(<ErrorsTab configDir="/home/user/.claude" />);
    await waitFor(() => {
      expect(screen.getByText('No plugin errors')).toBeTruthy();
    });
  });

  it('renders one error card per ClaudePluginError entry', async () => {
    setupApi([
      {
        scope: 'plugin',
        targetId: 'installed_plugins.json',
        severity: 'error',
        message: 'Unexpected token in JSON',
        raisedAt: '2026-05-03T10:00:00Z',
      },
      {
        scope: 'marketplace',
        targetId: 'foo',
        severity: 'warn',
        message: 'unsynced',
        raisedAt: '2026-05-03T10:01:00Z',
      },
    ]);
    render(<ErrorsTab configDir="/home/user/.claude" />);

    await waitFor(() => {
      expect(screen.getByText('Unexpected token in JSON')).toBeTruthy();
      expect(screen.getByText('unsynced')).toBeTruthy();
    });
  });

  it('reports the error count via onCountChange', async () => {
    setupApi([
      { scope: 'plugin', targetId: 'a', severity: 'error', message: 'm1', raisedAt: '' },
      { scope: 'plugin', targetId: 'b', severity: 'warn', message: 'm2', raisedAt: '' },
    ]);
    const onCountChange = vi.fn();
    render(<ErrorsTab configDir="/home/user/.claude" onCountChange={onCountChange} />);

    await waitFor(() => {
      expect(onCountChange).toHaveBeenCalledWith(1); // only 'error' severity counted
    });
  });
});
