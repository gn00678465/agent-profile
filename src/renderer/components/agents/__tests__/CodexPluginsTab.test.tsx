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

import { PluginsTab } from '../CodexPlugins/PluginsTab';

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

const PLUGINS = [
  { id: 'ponytail@ponytail', name: 'ponytail', marketplace: 'ponytail', status: 'not-installed' as const },
  { id: 'codereview@openai-curated', name: 'codereview', marketplace: 'openai-curated', status: 'installed' as const, version: '1.2.0', path: '/x/codereview' },
];

function setupApi(overrides: any = {}) {
  const config = {
    getCodexPlugins: vi.fn().mockResolvedValue({ success: true, data: PLUGINS }),
    codexPluginAdd: vi.fn().mockResolvedValue({ success: true, data: { success: true, stdout: '' } }),
    codexPluginRemove: vi.fn().mockResolvedValue({ success: true, data: { success: true, stdout: '' } }),
    ...overrides.config,
  };
  const api = { config, app: { openExternal: vi.fn() } };
  vi.mocked(electronAPI).mockReturnValue(api as any);
  return api;
}

describe('CodexPluginsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unwrapMock();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders plugins grouped with status badges', async () => {
    setupApi();
    render(<PluginsTab accentColor="#3941ff" />);

    await waitFor(() => expect(screen.getByText('ponytail@ponytail')).toBeTruthy());
    expect(screen.getByText('codereview@openai-curated')).toBeTruthy();
    // "not installed" appears both as a filter button and a status badge.
    expect(screen.getAllByText('not installed').length).toBeGreaterThanOrEqual(2);
    // The installed badge text within a row.
    expect(screen.getAllByText('installed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('v1.2.0')).toBeTruthy();
  });

  it('installs a not-installed plugin and re-fetches', async () => {
    const user = userEvent.setup();
    const api = setupApi();
    render(<PluginsTab accentColor="#3941ff" />);

    await waitFor(() => expect(screen.getByText('ponytail@ponytail')).toBeTruthy());
    await user.click(screen.getByLabelText('Install ponytail@ponytail'));

    await waitFor(() => {
      expect(api.config.codexPluginAdd).toHaveBeenCalledWith('ponytail@ponytail');
    });
    await waitFor(() => {
      expect(api.config.getCodexPlugins).toHaveBeenCalledTimes(2);
    });
  });

  it('removes an installed plugin with the right id', async () => {
    const user = userEvent.setup();
    const api = setupApi();
    render(<PluginsTab accentColor="#3941ff" />);

    await waitFor(() => expect(screen.getByText('codereview@openai-curated')).toBeTruthy());
    await user.click(screen.getByLabelText('Remove codereview@openai-curated'));

    await waitFor(() => {
      expect(api.config.codexPluginRemove).toHaveBeenCalledWith('codereview@openai-curated');
    });
  });

  it('shows the error and terminal hint when install CliRunResult fails', async () => {
    const user = userEvent.setup();
    setupApi({
      config: {
        codexPluginAdd: vi.fn().mockResolvedValue({
          success: true,
          data: { success: false, error: 'auth required' },
        }),
      },
    });
    render(<PluginsTab accentColor="#3941ff" />);

    await waitFor(() => expect(screen.getByText('ponytail@ponytail')).toBeTruthy());
    await user.click(screen.getByLabelText('Install ponytail@ponytail'));

    await waitFor(() => {
      expect(screen.getByText(/auth required/i)).toBeTruthy();
    });
    expect(screen.getByText(/codex plugin add <id>/i)).toBeTruthy();
  });

  it('narrows the list with the status filter', async () => {
    const user = userEvent.setup();
    setupApi();
    render(<PluginsTab accentColor="#3941ff" />);

    await waitFor(() => expect(screen.getByText('ponytail@ponytail')).toBeTruthy());

    await user.click(screen.getByRole('button', { name: 'installed' }));
    await waitFor(() => {
      expect(screen.queryByText('ponytail@ponytail')).toBeNull();
    });
    expect(screen.getByText('codereview@openai-curated')).toBeTruthy();
  });

  it('narrows the list with the marketplace filter', async () => {
    const user = userEvent.setup();
    setupApi();
    render(<PluginsTab accentColor="#3941ff" />);

    await waitFor(() => expect(screen.getByText('ponytail@ponytail')).toBeTruthy());

    await user.selectOptions(screen.getByLabelText('Marketplace filter'), 'openai-curated');
    await waitFor(() => {
      expect(screen.queryByText('ponytail@ponytail')).toBeNull();
    });
    expect(screen.getByText('codereview@openai-curated')).toBeTruthy();
  });

  it('shows the codex-not-installed friendly prompt when read rejects', async () => {
    setupApi({
      config: {
        getCodexPlugins: vi.fn().mockResolvedValue({
          success: false,
          error: 'codex CLI not found in PATH; install via instructions at https://developers.openai.com/codex/cli',
        }),
      },
    });
    render(<PluginsTab accentColor="#3941ff" />);

    await waitFor(() => {
      expect(screen.getByText('codex CLI not found')).toBeTruthy();
    });
  });
});
