/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { JsonFileEditor } from '../JsonFileEditor';

vi.mock('@/lib/electron', () => ({
  callElectron: vi.fn(),
  electronAPI: vi.fn(),
  isElectron: vi.fn(() => true),
}));

vi.mock('@/components/ui/JsonEditor', () => ({
  JsonEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="json-editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { callElectron, electronAPI } from '@/lib/electron';

function setupMockApi() {
  const api = {
    file: {
      read: vi.fn(),
      write: vi.fn(),
    },
  };
  vi.mocked(electronAPI).mockReturnValue(api as any);
  return api;
}

describe('JsonFileEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    setupMockApi();
    vi.mocked(callElectron).mockImplementation(() => new Promise(() => {}));
    render(<JsonFileEditor filePath="/home/user/.copilot/config.json" title="Test Config" />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders title and description after loading', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue('{}');
    render(
      <JsonFileEditor
        filePath="/home/user/.copilot/config.json"
        title="Test Config"
        description="/home/user/.copilot/config.json"
      />
    );
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    expect(screen.getByText('Test Config')).toBeTruthy();
    expect(screen.getByText('/home/user/.copilot/config.json')).toBeTruthy();
  });

  it('shows file-not-found amber warning when file does not exist', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockRejectedValue(new Error('ENOENT: no such file or directory'));
    render(<JsonFileEditor filePath="/home/user/.copilot/config.json" title="Test Config" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    expect(screen.getByText(/does not exist/i)).toBeTruthy();
  });

  it('shows error banner for non-ENOENT load errors', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockRejectedValue(new Error('Permission denied'));
    render(<JsonFileEditor filePath="/home/user/.copilot/config.json" title="Test Config" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    expect(screen.getByText('Permission denied')).toBeTruthy();
  });

  it('renders JSON editor with loaded content', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue('{"model":"sonnet"}');
    render(<JsonFileEditor filePath="/home/user/.copilot/config.json" title="Test Config" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    const editor = screen.getByTestId('json-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('{"model":"sonnet"}');
  });

  it('Save button is disabled initially (not dirty)', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue('{}');
    render(<JsonFileEditor filePath="/home/user/.copilot/config.json" title="Test Config" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('enables Save button after editing content', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue('{}');
    render(<JsonFileEditor filePath="/home/user/.copilot/config.json" title="Test Config" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.change(screen.getByTestId('json-editor'), { target: { value: '{"new":"value"}' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled());
  });

  it('calls file.write on save and reloads', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce('{}')       // initial load
      .mockResolvedValueOnce(undefined)  // write
      .mockResolvedValueOnce('{"model":"sonnet"}'); // reload
    render(<JsonFileEditor filePath="/home/user/.copilot/config.json" title="Test Config" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.change(screen.getByTestId('json-editor'), { target: { value: '{"model":"sonnet"}' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    await waitFor(() => expect(callElectron).toHaveBeenCalledTimes(3));
  });

  it('shows JSON error when saving invalid JSON', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue('{}');
    render(<JsonFileEditor filePath="/home/user/.copilot/config.json" title="Test Config" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.change(screen.getByTestId('json-editor'), { target: { value: '{invalid' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('Format button formats valid JSON', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue('{}');
    render(<JsonFileEditor filePath="/home/user/.copilot/config.json" title="Test Config" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.change(screen.getByTestId('json-editor'), { target: { value: '{"model":"s","theme":"auto"}' } });
    fireEvent.click(screen.getByRole('button', { name: /format/i }));
    await waitFor(() => {
      const value = (screen.getByTestId('json-editor') as HTMLTextAreaElement).value;
      expect(value).toContain('\n');
    });
  });

  it('Format button shows JSON error for invalid JSON', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue('{}');
    render(<JsonFileEditor filePath="/home/user/.copilot/config.json" title="Test Config" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.change(screen.getByTestId('json-editor'), { target: { value: '{bad' } });
    fireEvent.click(screen.getByRole('button', { name: /format/i }));
    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('Refresh button reloads content', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue('{}');
    render(<JsonFileEditor filePath="/home/user/.copilot/config.json" title="Test Config" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /refresh/i })); });
    await waitFor(() => expect(callElectron).toHaveBeenCalledTimes(2));
  });

  it('shows error when save fails', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce('{}')
      .mockRejectedValueOnce(new Error('Failed to write'));
    render(<JsonFileEditor filePath="/home/user/.copilot/config.json" title="Test Config" />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.change(screen.getByTestId('json-editor'), { target: { value: '{"x":1}' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    await waitFor(() => expect(screen.getByText('Failed to write')).toBeTruthy());
  });
});
