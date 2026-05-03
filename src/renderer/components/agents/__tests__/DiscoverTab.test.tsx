/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

class ROStub {
  observe(): void { /* noop */ }
  unobserve(): void { /* noop */ }
  disconnect(): void { /* noop */ }
}
(globalThis as any).ResizeObserver = ROStub;

import { DiscoverTab } from '../ClaudePlugins/DiscoverTab';

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

const MARKETPLACES = [
  {
    name: 'mp1',
    source: { source: 'github', repo: 'a/b' },
    installLocation: '/x',
    autoUpdate: true,
    isOfficial: true,
    pluginCount: 1,
  },
];

const DISCOVERY = [
  {
    name: 'p1',
    marketplace: 'mp1',
    description: 'Plugin one description',
    author: { name: 'Alice' },
    category: 'dev',
    installed: false,
  },
];

function setupApi(overrides: any = {}) {
  const api = {
    config: {
      getClaudeMarketplaces: vi.fn().mockResolvedValue({ success: true, data: MARKETPLACES }),
      getClaudePluginDiscovery: vi.fn().mockResolvedValue({ success: true, data: DISCOVERY }),
    },
    claudeCli: {
      pluginInstall: vi.fn().mockResolvedValue({ success: true, data: { success: true, stdout: 'installed.\n' } }),
    },
    ...overrides,
  };
  vi.mocked(electronAPI).mockReturnValue(api as any);
  return api;
}

describe('DiscoverTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unwrapMock();
  });

  it('shows placeholder before a marketplace is selected', async () => {
    setupApi();
    render(<DiscoverTab configDir="/home/user/.claude" />);
    expect(screen.getByText('Select a marketplace to discover plugins')).toBeTruthy();
  });

  it('opens the scope chooser dialog when Install is clicked', async () => {
    const user = userEvent.setup();
    const api = setupApi();
    render(<DiscoverTab configDir="/home/user/.claude" />);

    // Wait for marketplaces to load and become clickable
    await waitFor(() => {
      expect(screen.getByText('mp1')).toBeTruthy();
    });
    await user.click(screen.getByText('mp1'));

    await waitFor(() => {
      expect(api.config.getClaudePluginDiscovery).toHaveBeenCalledWith('/home/user/.claude', 'mp1');
    });
    await waitFor(() => {
      expect(screen.getByText('p1')).toBeTruthy();
    });

    await user.click(screen.getByLabelText('Install p1'));
    await waitFor(() => {
      expect(screen.getByText(/Choose where to install p1/i)).toBeTruthy();
    });
  });

  it('shows empty discovery message when marketplace returns no plugins', async () => {
    const user = userEvent.setup();
    const api = setupApi({
      config: {
        getClaudeMarketplaces: vi.fn().mockResolvedValue({ success: true, data: MARKETPLACES }),
        getClaudePluginDiscovery: vi.fn().mockResolvedValue({ success: true, data: [] }),
      },
    });
    render(<DiscoverTab configDir="/home/user/.claude" />);

    await waitFor(() => expect(screen.getByText('mp1')).toBeTruthy());
    await user.click(screen.getByText('mp1'));

    await waitFor(() => {
      expect(api.config.getClaudePluginDiscovery).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('No plugins available in this marketplace.')).toBeTruthy();
    });
  });
});
