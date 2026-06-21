/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { TomlFileEditor } from '../TomlFileEditor';

vi.mock('@/lib/electron', () => ({
  callElectron: vi.fn(),
  electronAPI: vi.fn(),
  isElectron: vi.fn(() => true),
}));

vi.mock('@/components/ui/TomlEditor', () => ({
  TomlEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="toml-editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

// Stub Taplo's WASM module — the Format button lazy-imports it.
vi.mock('@taplo/lib', () => ({
  Taplo: {
    initialize: vi.fn().mockResolvedValue({
      format: (s: string) => `${s}\n# formatted`,
    }),
  },
}));

import { callElectron, electronAPI } from '@/lib/electron';

function setupMockApi() {
  const api = { file: { read: vi.fn(), write: vi.fn() } };
  vi.mocked(electronAPI).mockReturnValue(api as any);
  return api;
}

const FILE = '/home/user/.codex/config.toml';

describe('TomlFileEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    setupMockApi();
    vi.mocked(callElectron).mockImplementation(() => new Promise(() => {}));
    render(<TomlFileEditor filePath={FILE} title="config.toml" />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders title and description after loading', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue('');
    render(<TomlFileEditor filePath={FILE} title="config.toml" description="Codex config" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    expect(screen.getByText('config.toml')).toBeTruthy();
    expect(screen.getByText('Codex config')).toBeTruthy();
  });

  it('shows file-not-found amber warning when file does not exist', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockRejectedValue(new Error('ENOENT: no such file or directory'));
    render(<TomlFileEditor filePath={FILE} title="config.toml" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    expect(screen.getByText(/does not exist/i)).toBeTruthy();
  });

  it('shows error banner for non-ENOENT load errors', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockRejectedValue(new Error('Permission denied'));
    render(<TomlFileEditor filePath={FILE} title="config.toml" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    expect(screen.getByText('Permission denied')).toBeTruthy();
  });

  it('renders editor with loaded content', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue('model = "gpt-5-codex"');
    render(<TomlFileEditor filePath={FILE} title="config.toml" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    const editor = screen.getByTestId('toml-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('model = "gpt-5-codex"');
  });

  it('Save button is disabled initially (not dirty)', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue('');
    render(<TomlFileEditor filePath={FILE} title="config.toml" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('Format button reformats via Taplo and marks dirty', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue('model="x"');
    render(<TomlFileEditor filePath={FILE} title="config.toml" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /format/i })); });
    await waitFor(() => {
      const editor = screen.getByTestId('toml-editor') as HTMLTextAreaElement;
      expect(editor.value).toContain('# formatted');
    });
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('saves valid TOML verbatim and reloads', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce('')                       // initial load
      .mockResolvedValueOnce(undefined)                // write
      .mockResolvedValueOnce('model = "gpt-5-codex"'); // reload
    render(<TomlFileEditor filePath={FILE} title="config.toml" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.change(screen.getByTestId('toml-editor'), { target: { value: 'model = "gpt-5-codex"' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    await waitFor(() => expect(callElectron).toHaveBeenCalledTimes(3));
  });

  it('blocks save and shows error on invalid TOML', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue(''); // only the initial load resolves
    render(<TomlFileEditor filePath={FILE} title="config.toml" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.change(screen.getByTestId('toml-editor'), { target: { value: '[unclosed' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
    // save aborted before the write — no second callElectron beyond the load
    expect(callElectron).toHaveBeenCalledTimes(1);
  });

  it('Refresh button reloads content', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue('');
    render(<TomlFileEditor filePath={FILE} title="config.toml" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /refresh/i })); });
    await waitFor(() => expect(callElectron).toHaveBeenCalledTimes(2));
  });

  it('shows error when save fails', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce('')
      .mockRejectedValueOnce(new Error('Failed to write'));
    render(<TomlFileEditor filePath={FILE} title="config.toml" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.change(screen.getByTestId('toml-editor'), { target: { value: 'x = 1' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    await waitFor(() => expect(screen.getByText('Failed to write')).toBeTruthy());
  });
});
