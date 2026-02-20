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

vi.mock('@/components/ui/JsonEditor', () => ({
  JsonEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} />
  ),
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

  it('shows loading state while fetching config', () => {
    setupMockApi();
    vi.mocked(callElectron).mockImplementation(() => new Promise(() => {}));
    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    expect(screen.getByText('Loading config...')).toBeTruthy();
  });

  it('renders header after loading', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: {},
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

  it('renders JSON editor with initial config data', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: { model: 'claude-sonnet-4.5', theme: 'auto' },
    });
    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());
    const editor = screen.getByRole('textbox');
    expect((editor as HTMLTextAreaElement).value).toContain('"model"');
    expect((editor as HTMLTextAreaElement).value).toContain('"claude-sonnet-4.5"');
  });

  it('Save button is disabled initially', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: {},
    });
    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('enables Save button after editing JSON', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.copilot/config.json',
      exists: true,
      data: {},
    });
    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"model":"sonnet"}' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled());
  });

  it('calls saveCopilotConfig and reloads after save', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce({ path: '/home/user/.copilot/config.json', exists: true, data: {} })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ path: '/home/user/.copilot/config.json', exists: true, data: { model: 'sonnet' } });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"model":"sonnet"}' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    await waitFor(() => expect(callElectron).toHaveBeenCalledTimes(3));
  });

  it('shows Saving... text during save', async () => {
    setupMockApi();
    let resolveSave: (v: undefined) => void;
    const savePromise = new Promise<undefined>((resolve) => { resolveSave = resolve; });

    vi.mocked(callElectron)
      .mockResolvedValueOnce({ path: '/home/user/.copilot/config.json', exists: true, data: {} })
      .mockReturnValueOnce(savePromise as any);

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"model":"s"}' } });
    act(() => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    await waitFor(() => expect(screen.getByText('Saving...')).toBeTruthy());

    resolveSave!(undefined);
    vi.mocked(callElectron).mockResolvedValueOnce({ path: '/home/user/.copilot/config.json', exists: true, data: {} });
    await waitFor(() => expect(screen.queryByText('Saving...')).toBeNull());
  });

  it('shows error when save fails', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce({ path: '/home/user/.copilot/config.json', exists: true, data: {} })
      .mockRejectedValueOnce(new Error('Failed to save'));

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"model":"s"}' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    await waitFor(() => expect(screen.getByText('Failed to save')).toBeTruthy());
  });

  it('shows JSON error when saving invalid JSON', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({ path: '/home/user/.copilot/config.json', exists: true, data: {} });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{invalid' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });

    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('calls load when Refresh is clicked', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({ path: '/home/user/.copilot/config.json', exists: true, data: {} });

    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /refresh/i })); });
    await waitFor(() => expect(callElectron).toHaveBeenCalledTimes(2));
  });

  it('renders Format button', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({ path: '/home/user/.copilot/config.json', exists: true, data: {} });
    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());
    expect(screen.getByRole('button', { name: /format/i })).toBeTruthy();
  });

  it('Format button pretty-prints valid JSON', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({ path: '/home/user/.copilot/config.json', exists: true, data: {} });
    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"model":"s","theme":"auto"}' } });
    fireEvent.click(screen.getByRole('button', { name: /format/i }));

    await waitFor(() => {
      const value = (screen.getByRole('textbox') as HTMLTextAreaElement).value;
      expect(value).toContain('\n');
    });
  });

  it('Format button shows JSON error for invalid JSON', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({ path: '/home/user/.copilot/config.json', exists: true, data: {} });
    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    await waitFor(() => expect(screen.queryByText('Loading config...')).toBeNull());

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{bad' } });
    fireEvent.click(screen.getByRole('button', { name: /format/i }));

    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
