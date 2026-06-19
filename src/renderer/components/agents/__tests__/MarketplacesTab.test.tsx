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

import { MarketplacesTab } from '../ClaudePlugins/MarketplacesTab';

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

function setupApi(overrides: any = {}) {
  const api = {
    config: {
      getClaudeMarketplaces: vi.fn().mockResolvedValue({ success: true, data: [] }),
    },
    claudeCli: {
      marketplaceAdd: vi.fn().mockResolvedValue({ success: true, data: { success: true, stdout: '' } }),
      marketplaceRemove: vi.fn().mockResolvedValue({ success: true, data: { success: true, stdout: '' } }),
      marketplaceUpdate: vi.fn().mockResolvedValue({ success: true, data: { success: true, stdout: '' } }),
    },
    ...overrides,
  };
  vi.mocked(electronAPI).mockReturnValue(api as any);
  return api;
}

describe('MarketplacesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unwrapMock();
  });

  it('renders the toolbar with Add Marketplace button', async () => {
    setupApi();
    render(<MarketplacesTab configDir="/home/user/.claude" />);
    expect(screen.getByLabelText('Add Marketplace')).toBeTruthy();
  });

  it('opens the MarketplaceDialog when Add Marketplace is clicked', async () => {
    const user = userEvent.setup();
    setupApi();
    render(<MarketplacesTab configDir="/home/user/.claude" />);

    await user.click(screen.getByLabelText('Add Marketplace'));
    await waitFor(() => {
      expect(screen.getByText(/Register a new marketplace/i)).toBeTruthy();
    });
  });

  it('shows the empty state when no marketplaces are registered', async () => {
    setupApi();
    render(<MarketplacesTab configDir="/home/user/.claude" />);
    await waitFor(() => {
      expect(screen.getByText('No marketplaces registered')).toBeTruthy();
    });
  });
});
