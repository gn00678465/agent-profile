/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ClaudeSettingsView } from '../ClaudeSettings';

vi.mock('@/hooks/useConfig', () => ({
  useClaudeSettings: vi.fn(),
}));

vi.mock('@/components/ui/JsonEditor', () => ({
  JsonEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { useClaudeSettings } from '@/hooks/useConfig';

const makeHook = (overrides = {}) => ({
  config: null,
  loading: false,
  saving: false,
  error: null,
  save: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn(),
  ...overrides,
});

describe('ClaudeSettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(makeHook({ loading: true }));
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.getByText('Loading settings...')).toBeTruthy();
  });

  it('renders header after loading', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ config: { path: '/home/user/.claude/settings.json', exists: true, data: {} } })
    );
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.getByText('Claude Code Settings')).toBeTruthy();
    expect(screen.getByText('/home/user/.claude/settings.json')).toBeTruthy();
  });

  it('shows warning when settings.json does not exist', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ config: { path: '/home/user/.claude/settings.json', exists: false, data: null } })
    );
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.getByText(/settings.json does not exist yet/)).toBeTruthy();
  });

  it('does not show not-exist warning when file exists', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ config: { path: '/home/user/.claude/settings.json', exists: true, data: {} } })
    );
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.queryByText(/does not exist yet/)).toBeNull();
  });

  it('shows error message when load fails', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ error: 'Failed to read settings' })
    );
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.getByText('Failed to read settings')).toBeTruthy();
  });

  it('renders JSON editor with initial config data', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ config: { path: '/home/user/.claude/settings.json', exists: true, data: { model: 'opus' } } })
    );
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    const editor = screen.getByRole('textbox');
    expect((editor as HTMLTextAreaElement).value).toContain('"model"');
    expect((editor as HTMLTextAreaElement).value).toContain('"opus"');
  });

  it('Save button is disabled initially', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ config: { path: '/home/user/.claude/settings.json', exists: true, data: {} } })
    );
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('enables Save button after editing JSON', async () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ config: { path: '/home/user/.claude/settings.json', exists: true, data: {} } })
    );
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"model":"sonnet"}' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled());
  });

  it('calls save with parsed JSON when Save is clicked', async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ config: { path: '/home/user/.claude/settings.json', exists: true, data: {} }, save: saveMock })
    );
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"model":"sonnet"}' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'sonnet' }));
  });

  it('shows JSON error banner when saving invalid JSON', async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ config: { path: '/home/user/.claude/settings.json', exists: true, data: {} }, save: saveMock })
    );
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{invalid' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    expect(saveMock).not.toHaveBeenCalled();
    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('shows Saving... text when saving is true', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ config: { path: '/home/user/.claude/settings.json', exists: true, data: {} }, saving: true })
    );
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.getByText('Saving...')).toBeTruthy();
  });

  it('calls refresh when Refresh button is clicked', () => {
    const refreshMock = vi.fn();
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ config: { path: '/home/user/.claude/settings.json', exists: true, data: {} }, refresh: refreshMock })
    );
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it('renders Format button', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ config: { path: '/home/user/.claude/settings.json', exists: true, data: {} } })
    );
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.getByRole('button', { name: /format/i })).toBeTruthy();
  });

  it('Format button pretty-prints valid JSON', async () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ config: { path: '/home/user/.claude/settings.json', exists: true, data: {} } })
    );
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    const editor = screen.getByRole('textbox');
    fireEvent.change(editor, { target: { value: '{"model":"opus","env":{}}' } });
    fireEvent.click(screen.getByRole('button', { name: /format/i }));
    await waitFor(() => {
      const value = (screen.getByRole('textbox') as HTMLTextAreaElement).value;
      expect(value).toContain('\n');
    });
  });

  it('Format button shows JSON error for invalid JSON', async () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ config: { path: '/home/user/.claude/settings.json', exists: true, data: {} } })
    );
    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{bad json' } });
    fireEvent.click(screen.getByRole('button', { name: /format/i }));
    await waitFor(() => {
      const errors = document.querySelectorAll('.text-destructive');
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
