/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GeminiSettingsView } from '../GeminiSettings';

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

  it('shows loading state while fetching settings', () => {
    setupMockApi();
    vi.mocked(callElectron).mockImplementation(() => new Promise(() => {}));
    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    expect(screen.getByText('Loading settings...')).toBeTruthy();
  });

  it('renders header after load', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.gemini/settings.json',
      exists: true,
      data: {},
    });
    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());
    expect(screen.getByText('Gemini CLI Settings')).toBeTruthy();
    expect(screen.getByText('/home/user/.gemini/settings.json')).toBeTruthy();
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

  it('renders JSON editor with initial config data', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.gemini/settings.json',
      exists: true,
      data: { general: { vimMode: true } },
    });
    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());
    const editor = screen.getByRole('textbox');
    expect((editor as HTMLTextAreaElement).value).toContain('"vimMode"');
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

  it('enables Save button after editing JSON', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      path: '/home/user/.gemini/settings.json',
      exists: true,
      data: {},
    });
    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"general":{"vimMode":true}}' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled());
  });

  it('calls saveGeminiSettings and reloads after save', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce({ path: '/home/user/.gemini/settings.json', exists: true, data: {} })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ path: '/home/user/.gemini/settings.json', exists: true, data: { general: { vimMode: true } } });

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"general":{"vimMode":true}}' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    await waitFor(() => expect(callElectron).toHaveBeenCalledTimes(3));
  });

  it('shows Saving... text during save', async () => {
    setupMockApi();
    let resolveSave: (v: undefined) => void;
    const savePromise = new Promise<undefined>((resolve) => { resolveSave = resolve; });

    vi.mocked(callElectron)
      .mockResolvedValueOnce({ path: '/home/user/.gemini/settings.json', exists: true, data: {} })
      .mockReturnValueOnce(savePromise as any);

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"general":{}}' } });
    act(() => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });

    await waitFor(() => expect(screen.getByText('Saving...')).toBeTruthy());

    resolveSave!(undefined);
    vi.mocked(callElectron).mockResolvedValueOnce({ path: '/home/user/.gemini/settings.json', exists: true, data: {} });
    await waitFor(() => expect(screen.queryByText('Saving...')).toBeNull());
  });

  it('shows error when save fails', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce({ path: '/home/user/.gemini/settings.json', exists: true, data: {} })
      .mockRejectedValueOnce(new Error('Write permission denied'));

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"general":{}}' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    await waitFor(() => expect(screen.getByText('Write permission denied')).toBeTruthy());
  });

  it('shows JSON error when saving invalid JSON', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({ path: '/home/user/.gemini/settings.json', exists: true, data: {} });

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{invalid json' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });

    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('calls load when Refresh button is clicked', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({ path: '/home/user/.gemini/settings.json', exists: true, data: {} });

    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /refresh/i })); });
    await waitFor(() => expect(callElectron).toHaveBeenCalledTimes(2));
  });

  it('renders Format button', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({ path: '/home/user/.gemini/settings.json', exists: true, data: {} });
    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());
    expect(screen.getByRole('button', { name: /format/i })).toBeTruthy();
  });

  it('Format button pretty-prints valid JSON', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({ path: '/home/user/.gemini/settings.json', exists: true, data: {} });
    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"general":{"vimMode":true}}' } });
    fireEvent.click(screen.getByRole('button', { name: /format/i }));

    await waitFor(() => {
      const value = (screen.getByRole('textbox') as HTMLTextAreaElement).value;
      expect(value).toContain('\n');
    });
  });

  it('Format button shows JSON error for invalid JSON', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({ path: '/home/user/.gemini/settings.json', exists: true, data: {} });
    render(<GeminiSettingsView configDir="/home/user/.gemini" />);
    await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{bad' } });
    fireEvent.click(screen.getByRole('button', { name: /format/i }));

    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
