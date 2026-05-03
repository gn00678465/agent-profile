/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClaudePluginsView } from '../ClaudePlugins';

vi.mock('@/lib/electron', () => ({
  callElectron: vi.fn(),
  electronAPI: vi.fn(),
  isElectron: vi.fn(() => true),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { callElectron, electronAPI } from '@/lib/electron';

const MOCK_PLUGIN = {
  id: 'context7@official',
  name: 'context7',
  marketplace: 'official',
  scope: 'user' as const,
  installPath: '/plugins/context7',
  version: '1.0.0',
  installedAt: '2026-01-01T00:00:00Z',
  lastUpdated: '2026-01-01T00:00:00Z',
  enabled: true,
};

function setupMockApi() {
  const api = {
    config: {
      getClaudePlugins: vi.fn(),
      setPluginEnabled: vi.fn(),
      deletePlugin: vi.fn(),
      getClaudeMarketplaces: vi.fn(),
      getClaudePluginDiscovery: vi.fn(),
      getClaudePluginErrors: vi.fn(),
    },
    claudeCli: {
      marketplaceAdd: vi.fn(),
      marketplaceRemove: vi.fn(),
      marketplaceUpdate: vi.fn(),
      pluginInstall: vi.fn(),
      pluginUninstall: vi.fn(),
      reload: vi.fn(),
    },
  };
  vi.mocked(electronAPI).mockReturnValue(api as any);
  return api;
}

describe('ClaudePluginsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching plugins', () => {
    setupMockApi();
    vi.mocked(callElectron).mockImplementation(() => new Promise(() => {}));

    render(<ClaudePluginsView configDir="/home/user/.claude" accentColor="#3b82f6" />);
    expect(screen.getByText('Loading plugins...')).toBeTruthy();
  });

  it('renders plugins list after loading', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue([MOCK_PLUGIN]);

    render(<ClaudePluginsView configDir="/home/user/.claude" accentColor="#3b82f6" />);

    await waitFor(() => expect(screen.queryByText('Loading plugins...')).toBeNull());
    expect(screen.getByText('context7')).toBeTruthy();
  });

  it('shows empty state when no plugins', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue([]);

    render(<ClaudePluginsView configDir="/home/user/.claude" accentColor="#3b82f6" />);

    await waitFor(() => expect(screen.queryByText('Loading plugins...')).toBeNull());
    expect(screen.getByText('No plugins installed')).toBeTruthy();
  });

  it('renders delete button on list items (visible on hover)', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue([MOCK_PLUGIN]);

    render(<ClaudePluginsView configDir="/home/user/.claude" accentColor="#3b82f6" />);

    await waitFor(() => expect(screen.queryByText('Loading plugins...')).toBeNull());
    const deleteBtn = screen.getByLabelText('Delete plugin');
    expect(deleteBtn).toBeTruthy();
  });

  it('calls deletePlugin and removes from list on confirm', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce([MOCK_PLUGIN]) // initial load
      .mockResolvedValueOnce(undefined);     // deletePlugin

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ClaudePluginsView configDir="/home/user/.claude" accentColor="#3b82f6" />);

    await waitFor(() => expect(screen.queryByText('Loading plugins...')).toBeNull());

    const deleteBtn = screen.getByLabelText('Delete plugin');
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    await waitFor(() => {
      expect(screen.queryByText('context7')).toBeNull();
    });
    expect(callElectron).toHaveBeenCalledTimes(2);
  });

  it('does not delete when confirm is cancelled', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue([MOCK_PLUGIN]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ClaudePluginsView configDir="/home/user/.claude" accentColor="#3b82f6" />);

    await waitFor(() => expect(screen.queryByText('Loading plugins...')).toBeNull());

    const deleteBtn = screen.getByLabelText('Delete plugin');
    fireEvent.click(deleteBtn);

    // Plugin should still be in list
    expect(screen.getByText('context7')).toBeTruthy();
    expect(callElectron).toHaveBeenCalledTimes(1); // only the initial load
  });

  it('shows Delete Plugin button in detail panel', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue([MOCK_PLUGIN]);

    render(<ClaudePluginsView configDir="/home/user/.claude" accentColor="#3b82f6" />);

    await waitFor(() => expect(screen.queryByText('Loading plugins...')).toBeNull());

    // Click on plugin to open detail panel
    fireEvent.click(screen.getByText('context7'));

    await waitFor(() => {
      expect(screen.getByText('Delete Plugin')).toBeTruthy();
    });
  });

  // ── S3-3 (feat-019) — 4-tab router (4 new cases) ────────────────────────────

  it('renders all four tab triggers (Installed / Marketplaces / Discover / Errors)', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue([]);

    render(<ClaudePluginsView configDir="/home/user/.claude" accentColor="#3b82f6" />);

    expect(screen.getByRole('tab', { name: /installed/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /marketplaces/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /discover/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /errors/i })).toBeTruthy();
  });

  it('selects Installed tab by default on mount', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue([]);

    render(<ClaudePluginsView configDir="/home/user/.claude" accentColor="#3b82f6" />);

    const installedTrigger = screen.getByRole('tab', { name: /installed/i });
    expect(installedTrigger.getAttribute('data-state')).toBe('active');
  });

  it('switching to Marketplaces invokes getClaudeMarketplaces', async () => {
    const user = userEvent.setup();
    const api = setupMockApi();
    vi.mocked(callElectron).mockImplementation(async (fn: any) => {
      const r = await fn();
      if (r && typeof r === 'object' && 'success' in r) {
        if (!r.success) throw new Error(r.error);
        return r.data;
      }
      return r;
    });
    api.config.getClaudePlugins.mockResolvedValue({ success: true, data: [] });
    api.config.getClaudeMarketplaces.mockResolvedValue({ success: true, data: [] });

    render(<ClaudePluginsView configDir="/home/user/.claude" accentColor="#3b82f6" />);

    const trigger = screen.getByRole('tab', { name: /marketplaces/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(api.config.getClaudeMarketplaces).toHaveBeenCalledWith('/home/user/.claude');
    });
  });

  it('switching to Errors invokes getClaudePluginErrors', async () => {
    const user = userEvent.setup();
    const api = setupMockApi();
    vi.mocked(callElectron).mockImplementation(async (fn: any) => {
      const r = await fn();
      if (r && typeof r === 'object' && 'success' in r) {
        if (!r.success) throw new Error(r.error);
        return r.data;
      }
      return r;
    });
    api.config.getClaudePlugins.mockResolvedValue({ success: true, data: [] });
    api.config.getClaudePluginErrors.mockResolvedValue({ success: true, data: [] });

    render(<ClaudePluginsView configDir="/home/user/.claude" accentColor="#3b82f6" />);

    const trigger = screen.getByRole('tab', { name: /errors/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(api.config.getClaudePluginErrors).toHaveBeenCalledWith('/home/user/.claude');
    });
  });
});
