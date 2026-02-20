/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GeminiSettingsView } from '../GeminiSettings';

// Mock the electron module used directly by the component
vi.mock('@/lib/electron', () => ({
  callElectron: vi.fn(),
  electronAPI: vi.fn(),
  isElectron: vi.fn(() => true),
}));

import { callElectron, electronAPI } from '@/lib/electron';

function setupMockApi(overrides: Record<string, unknown> = {}) {
  const api = {
    config: {
      getGeminiSettings: vi.fn(),
      saveGeminiSettings: vi.fn(),
      ...overrides,
    },
  };
  vi.mocked(electronAPI).mockReturnValue(api as any);
  return api;
}

describe('GeminiSettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching settings', async () => {
    setupMockApi();
    // callElectron never resolves => stays loading
    vi.mocked(callElectron).mockImplementation(() => new Promise(() => {}));

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    expect(screen.getByText('Loading settings...')).toBeTruthy();
  });

  it('renders settings form after load', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.gemini/settings.json',
      exists: true,
      data: { general: { vimMode: false } },
    });

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());
    expect(screen.getByText('Gemini CLI Settings')).toBeTruthy();
  });

  it('shows warning when settings.json does not exist', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.gemini/settings.json',
      exists: false,
      data: null,
    });

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());
    expect(screen.getByText(/settings.json does not exist yet/)).toBeTruthy();
  });

  it('shows error when loading fails', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockRejectedValue(new Error('Cannot read Gemini settings'));

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());
    expect(screen.getByText('Cannot read Gemini settings')).toBeTruthy();
  });

  it('renders General settings toggles', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.gemini/settings.json',
      exists: true,
      data: {
        general: { previewFeatures: true, vimMode: true },
      },
    });

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());
    expect(screen.getByText('Preview Features')).toBeTruthy();
    expect(screen.getByText('Vim Mode')).toBeTruthy();
    expect(screen.getByText('Session Retention')).toBeTruthy();
    expect(screen.getByText('Prompt Completion')).toBeTruthy();
  });

  it('renders UI settings toggles', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.gemini/settings.json',
      exists: true,
      data: { ui: { showMemoryUsage: true } },
    });

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());
    expect(screen.getByText('Show Memory Usage')).toBeTruthy();
    expect(screen.getByText('Show Model Info in Chat')).toBeTruthy();
    expect(screen.getByText('Hide Context Summary')).toBeTruthy();
  });

  it('renders Experimental section with Skills toggle', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.gemini/settings.json',
      exists: true,
      data: { experimental: { skills: false } },
    });

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());
    expect(screen.getByText('Experimental')).toBeTruthy();
    expect(screen.getByText('Skills')).toBeTruthy();
  });

  it('Save button is disabled initially when no changes made', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.gemini/settings.json',
      exists: true,
      data: {},
    });

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);

    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('enables Save button after toggling a setting', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.gemini/settings.json',
      exists: true,
      data: { general: { vimMode: false } },
    });

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]); // Toggle first switch (Preview Features)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled()
    );
  });

  it('calls saveGeminiSettings and reloads after save', async () => {
    const mockApi = setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce({
        path: '/home/user/.gemini/settings.json',
        exists: true,
        data: { general: { vimMode: false } },
      }) // initial load
      .mockResolvedValueOnce(undefined) // save
      .mockResolvedValueOnce({
        path: '/home/user/.gemini/settings.json',
        exists: true,
        data: { general: { vimMode: true } },
      }); // reload

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[1]); // Toggle Vim Mode

    const saveBtn = screen.getByRole('button', { name: /save/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => expect(callElectron).toHaveBeenCalledTimes(3));
  });

  it('shows Saving... text during save', async () => {
    setupMockApi();
    let resolveSave: (v: undefined) => void;
    const savePromise = new Promise<undefined>((resolve) => {
      resolveSave = resolve;
    });

    vi.mocked(callElectron)
      .mockResolvedValueOnce({
        path: '/home/user/.gemini/settings.json',
        exists: true,
        data: {},
      })
      .mockReturnValueOnce(savePromise as any);

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    await waitFor(() => expect(screen.getByText('Saving...')).toBeTruthy());

    resolveSave!(undefined);
    vi.mocked(callElectron).mockResolvedValueOnce({
      path: '/home/user/.gemini/settings.json',
      exists: true,
      data: {},
    });
    await waitFor(() => expect(screen.queryByText('Saving...')).toBeNull());
  });

  it('shows error when save fails', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce({
        path: '/home/user/.gemini/settings.json',
        exists: true,
        data: {},
      })
      .mockRejectedValueOnce(new Error('Write permission denied'));

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    await waitFor(() => expect(screen.getByText('Write permission denied')).toBeTruthy());
  });

  // ── JSON toggle tests ──────────────────────────────────────────────────────

  it('renders JSON toggle button', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.gemini/settings.json',
      exists: true,
      data: {},
    });

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());
    expect(screen.getByRole('button', { name: /json/i })).toBeTruthy();
  });

  it('switches to JSON textarea when JSON button is clicked', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.gemini/settings.json',
      exists: true,
      data: { general: { vimMode: true } },
    });

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /json/i }));

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeTruthy();
      expect(screen.queryByText('Vim Mode')).toBeNull();
    });
  });

  it('shows Form button when in JSON mode', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.gemini/settings.json',
      exists: true,
      data: {},
    });

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /json/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /form/i })).toBeTruthy();
    });
  });

  it('calls load when Refresh button is clicked', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.gemini/settings.json',
      exists: true,
      data: {},
    });

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    });

    await waitFor(() => expect(callElectron).toHaveBeenCalledTimes(2));
  });
});
