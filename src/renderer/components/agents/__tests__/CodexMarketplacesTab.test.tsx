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

import { MarketplacesTab } from '../CodexPlugins/MarketplacesTab';

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
    name: 'ponytail',
    root: '/home/u/.codex/.tmp/marketplaces/ponytail',
    builtin: false,
    source: 'DietrichGebert/ponytail',
    sourceType: 'github',
    lastUpdated: '2026-06-20',
  },
  {
    name: 'openai-curated',
    root: '/builtin/openai-curated',
    builtin: true,
  },
];

function setupApi(overrides: any = {}) {
  const config = {
    getCodexMarketplaces: vi.fn().mockResolvedValue({ success: true, data: MARKETPLACES }),
    codexMarketplaceAdd: vi.fn().mockResolvedValue({ success: true, data: { success: true, stdout: '' } }),
    codexMarketplaceRemove: vi.fn().mockResolvedValue({ success: true, data: { success: true, stdout: '' } }),
    codexMarketplaceUpgrade: vi.fn().mockResolvedValue({ success: true, data: { success: true, stdout: '' } }),
    ...overrides.config,
  };
  const api = { config, app: { openExternal: vi.fn() } };
  vi.mocked(electronAPI).mockReturnValue(api as any);
  return api;
}

describe('CodexMarketplacesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unwrapMock();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders user and built-in marketplaces in two sections', async () => {
    setupApi();
    render(<MarketplacesTab configDir="/home/u/.codex" accentColor="#3941ff" />);

    await waitFor(() => expect(screen.getByText('ponytail')).toBeTruthy());
    expect(screen.getByText(/Your marketplaces/i)).toBeTruthy();
    expect(screen.getByText(/Built-in \(1\)/i)).toBeTruthy();
    expect(screen.getByText('openai-curated')).toBeTruthy();
    expect(screen.getByText('DietrichGebert/ponytail')).toBeTruthy();
  });

  it('shows Remove/Upgrade for user marketplace but not for built-in', async () => {
    setupApi();
    render(<MarketplacesTab configDir="/home/u/.codex" accentColor="#3941ff" />);

    await waitFor(() => expect(screen.getByText('ponytail')).toBeTruthy());
    expect(screen.getByLabelText('Remove ponytail')).toBeTruthy();
    expect(screen.getByLabelText('Upgrade ponytail')).toBeTruthy();
    expect(screen.queryByLabelText('Remove openai-curated')).toBeNull();
    expect(screen.queryByLabelText('Upgrade openai-curated')).toBeNull();
  });

  it('adds a marketplace with source + ref and re-fetches', async () => {
    const user = userEvent.setup();
    const api = setupApi();
    render(<MarketplacesTab configDir="/home/u/.codex" accentColor="#3941ff" />);

    await waitFor(() => expect(screen.getByText('ponytail')).toBeTruthy());
    await user.click(screen.getByLabelText('Add Marketplace'));

    await user.type(screen.getByLabelText(/Source/i), 'owner/repo');
    await user.type(screen.getByLabelText(/Ref/i), 'main');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(api.config.codexMarketplaceAdd).toHaveBeenCalledWith('owner/repo', 'main');
    });
    // initial load + reload after add
    await waitFor(() => {
      expect(api.config.getCodexMarketplaces).toHaveBeenCalledTimes(2);
    });
  });

  it('removes a user marketplace with the right name and re-fetches', async () => {
    const user = userEvent.setup();
    const api = setupApi();
    render(<MarketplacesTab configDir="/home/u/.codex" accentColor="#3941ff" />);

    await waitFor(() => expect(screen.getByText('ponytail')).toBeTruthy());
    await user.click(screen.getByLabelText('Remove ponytail'));

    await waitFor(() => {
      expect(api.config.codexMarketplaceRemove).toHaveBeenCalledWith('ponytail');
    });
    await waitFor(() => {
      expect(api.config.getCodexMarketplaces).toHaveBeenCalledTimes(2);
    });
  });

  it('upgrades a user marketplace with the right name', async () => {
    const user = userEvent.setup();
    const api = setupApi();
    render(<MarketplacesTab configDir="/home/u/.codex" accentColor="#3941ff" />);

    await waitFor(() => expect(screen.getByText('ponytail')).toBeTruthy());
    await user.click(screen.getByLabelText('Upgrade ponytail'));

    await waitFor(() => {
      expect(api.config.codexMarketplaceUpgrade).toHaveBeenCalledWith('ponytail');
    });
  });

  it('shows the error when a CliRunResult add fails', async () => {
    const user = userEvent.setup();
    setupApi({
      config: {
        codexMarketplaceAdd: vi.fn().mockResolvedValue({
          success: true,
          data: { success: false, error: 'clone failed: not found' },
        }),
      },
    });
    render(<MarketplacesTab configDir="/home/u/.codex" accentColor="#3941ff" />);

    await waitFor(() => expect(screen.getByText('ponytail')).toBeTruthy());
    await user.click(screen.getByLabelText('Add Marketplace'));
    await user.type(screen.getByLabelText(/Source/i), 'bad/repo');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByText(/clone failed: not found/i)).toBeTruthy();
    });
  });

  it('shows the codex-not-installed friendly prompt when read rejects', async () => {
    setupApi({
      config: {
        getCodexMarketplaces: vi.fn().mockResolvedValue({
          success: false,
          error: 'codex CLI not found in PATH; install via instructions at https://developers.openai.com/codex/cli',
        }),
      },
    });
    render(<MarketplacesTab configDir="/home/u/.codex" accentColor="#3941ff" />);

    await waitFor(() => {
      expect(screen.getByText('codex CLI not found')).toBeTruthy();
    });
    expect(screen.queryByLabelText('Add Marketplace')).toBeNull();
  });
});
