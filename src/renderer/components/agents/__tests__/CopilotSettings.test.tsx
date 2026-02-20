/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CopilotSettingsView } from '../CopilotSettings';

vi.mock('@/lib/electron', () => ({
  callElectron: vi.fn(),
  electronAPI: vi.fn(),
  isElectron: vi.fn(() => true),
}));

import { callElectron, electronAPI } from '@/lib/electron';

function setupMockApi() {
  const api = {
    config: {
      getCopilotConfig: vi.fn(),
      saveCopilotConfig: vi.fn(),
    },
  };
  vi.mocked(electronAPI).mockReturnValue(api as any);
  return api;
}

describe('CopilotSettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching config', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockImplementation(() => new Promise(() => {}));

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    expect(screen.getByText('Loading config...')).toBeTruthy();
  });

  it('renders settings form after loading', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: { model: 'claude-sonnet-4.5', theme: 'auto' },
    });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);

    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());
    expect(screen.getByText('GitHub Copilot Settings')).toBeTruthy();
    expect(screen.getByText('/home/user/.copilot/config.json')).toBeTruthy();
  });

  it('shows warning when config.json does not exist', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: false,
      data: null,
    });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);

    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());
    expect(screen.getByText(/config.json does not exist yet/)).toBeTruthy();
  });

  it('shows error when loading fails', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockRejectedValue(new Error('Config read error'));

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);

    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());
    expect(screen.getByText('Config read error')).toBeTruthy();
  });

  it('populates model input from loaded config', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: { model: 'claude-opus-4-6', theme: 'dark' },
    });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);

    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());
    const modelInput = screen.getByRole('textbox', { name: /model/i });
    expect((modelInput as HTMLInputElement).value).toBe('claude-opus-4-6');
  });

  it('renders theme buttons (auto, light, dark)', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: { theme: 'auto' },
    });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);

    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());
    expect(screen.getByText('auto')).toBeTruthy();
    expect(screen.getByText('light')).toBeTruthy();
    expect(screen.getByText('dark')).toBeTruthy();
  });

  it('enables save button after changing model', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: { model: 'old-model' },
    });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());

    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).toBeDisabled();

    const modelInput = screen.getByRole('textbox', { name: /model/i });
    fireEvent.change(modelInput, { target: { value: 'new-model' } });

    await waitFor(() => expect(saveBtn).not.toBeDisabled());
  });

  it('selects theme on button click and enables save', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: { theme: 'auto' },
    });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());

    fireEvent.click(screen.getByText('dark'));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled()
    );
  });

  it('calls saveCopilotConfig when Save is clicked', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce({
        path: '/home/user/.copilot/config.json',
        exists: true,
        data: { model: 'old', theme: 'auto' },
      })
      .mockResolvedValueOnce(undefined) // save
      .mockResolvedValueOnce({
        path: '/home/user/.copilot/config.json',
        exists: true,
        data: { model: 'new', theme: 'auto' },
      }); // reload

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());

    const modelInput = screen.getByRole('textbox', { name: /model/i });
    fireEvent.change(modelInput, { target: { value: 'new' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    await waitFor(() => expect(callElectron).toHaveBeenCalledTimes(3));
  });

  it('shows error when save fails', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce({
        path: '/home/user/.copilot/config.json',
        exists: true,
        data: { model: 'old' },
      })
      .mockRejectedValueOnce(new Error('Failed to save'));

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());

    const modelInput = screen.getByRole('textbox', { name: /model/i });
    fireEvent.change(modelInput, { target: { value: 'new' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    await waitFor(() => expect(screen.getByText('Failed to save')).toBeTruthy());
  });

  it('renders Render Markdown and Screen Reader switches', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: { render_markdown: true, screen_reader: false },
    });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());

    expect(screen.getByText('Render Markdown')).toBeTruthy();
    expect(screen.getByText('Screen Reader')).toBeTruthy();
  });

  it('displays logged-in users section when users exist', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: {
        logged_in_users: [{ host: 'https://github.com', login: 'octocat' }],
        last_logged_in_user: { host: 'https://github.com', login: 'octocat' },
      },
    });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());

    expect(screen.getByText('Logged In Users')).toBeTruthy();
    expect(screen.getByText('octocat')).toBeTruthy();
    expect(screen.getByText('active')).toBeTruthy();
  });

  it('does not show logged-in users when list is empty', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: { logged_in_users: [] },
    });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());

    expect(screen.queryByText('Logged In Users')).toBeNull();
  });

  // ── JSON toggle tests ──────────────────────────────────────────────────────

  it('renders JSON toggle button', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: {},
    });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());
    expect(screen.getByRole('button', { name: /json/i })).toBeTruthy();
  });

  it('switches to JSON textarea when JSON button is clicked', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: { model: 'claude-sonnet-4.5', theme: 'auto' },
    });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /json/i }));

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeTruthy();
      expect(screen.queryByText('Appearance')).toBeNull();
    });
  });

  it('shows Form button when in JSON mode', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: {},
    });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /json/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /form/i })).toBeTruthy();
    });
  });

  it('calls load when Refresh is clicked', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: {},
    });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    });

    await waitFor(() => expect(callElectron).toHaveBeenCalledTimes(2));
  });
});
