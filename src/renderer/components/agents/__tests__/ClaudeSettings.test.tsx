/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ClaudeSettingsView } from '../ClaudeSettings';

// Mock the useClaudeSettings hook
vi.mock('@/hooks/useConfig', () => ({
  useClaudeSettings: vi.fn(),
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

  it('renders settings form when loaded', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: { model: 'opus' },
        },
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.getByText('Claude Code Settings')).toBeTruthy();
    expect(screen.getByText('/home/user/.claude/settings.json')).toBeTruthy();
  });

  it('shows warning when settings.json does not exist', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: { path: '/home/user/.claude/settings.json', exists: false, data: null },
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.getByText(/settings.json does not exist yet/)).toBeTruthy();
  });

  it('does not show not-exist warning when settings.json exists', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: { model: 'opus' },
        },
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.queryByText(/does not exist yet/)).toBeNull();
  });

  it('shows error message when error is set', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({ error: 'Failed to read settings' })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.getByText('Failed to read settings')).toBeTruthy();
  });

  it('populates model input from loaded config', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: { model: 'claude-opus-4-6' },
        },
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    const modelInput = screen.getByRole('textbox', { name: /model/i });
    expect((modelInput as HTMLInputElement).value).toBe('claude-opus-4-6');
  });

  it('enables save button after model input change', async () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: { model: 'opus' },
        },
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);

    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).toBeDisabled();

    const modelInput = screen.getByRole('textbox', { name: /model/i });
    fireEvent.change(modelInput, { target: { value: 'sonnet' } });

    await waitFor(() => expect(saveBtn).not.toBeDisabled());
  });

  it('calls save with updated settings when Save is clicked', async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: { model: 'opus' },
        },
        save: saveMock,
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);

    const modelInput = screen.getByRole('textbox', { name: /model/i });
    fireEvent.change(modelInput, { target: { value: 'sonnet' } });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'sonnet' }));
  });

  it('calls refresh when Refresh button is clicked', () => {
    const refreshMock = vi.fn();
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: {},
        },
        refresh: refreshMock,
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it('shows Saving... text when saving is true', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: { model: 'opus' },
        },
        saving: true,
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.getByText('Saving...')).toBeTruthy();
  });

  it('adds a new environment variable when Enter key is pressed in value input', async () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: {},
        },
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);

    const keyInput = screen.getByPlaceholderText('KEY');
    const valueInput = screen.getByPlaceholderText('value');

    fireEvent.change(keyInput, { target: { value: 'MY_VAR' } });
    fireEvent.change(valueInput, { target: { value: 'my_value' } });
    // Pressing Enter in the value input triggers addEnvVar
    fireEvent.keyDown(valueInput, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('MY_VAR')).toBeTruthy();
    });
  });

  it('adds a new permission when Add button is clicked', async () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: { permissions: { allow: [] } },
        },
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);

    const permInput = screen.getByPlaceholderText('Bash(*)');
    fireEvent.change(permInput, { target: { value: 'Read(*)' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(screen.getByText('Read(*)')).toBeTruthy();
    });
  });

  it('displays existing permissions from loaded config', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: { permissions: { allow: ['Bash(*)', 'Read(*)'] } },
        },
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.getByText('Bash(*)')).toBeTruthy();
    expect(screen.getByText('Read(*)')).toBeTruthy();
  });

  it('displays enabled plugins summary when plugins exist', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: {
            enabledPlugins: { 'context7@official': true, 'github@official': false },
          },
        },
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.getByText('Enabled Plugins')).toBeTruthy();
    expect(screen.getByText('context7@official')).toBeTruthy();
    expect(screen.getByText('github@official')).toBeTruthy();
  });

  it('does not show plugins card when no enabledPlugins', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: {},
        },
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.queryByText('Enabled Plugins')).toBeNull();
  });

  // ── JSON toggle tests ──────────────────────────────────────────────────────

  it('renders JSON toggle button', () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: { path: '/home/user/.claude/settings.json', exists: true, data: {} },
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);
    expect(screen.getByRole('button', { name: /json/i })).toBeTruthy();
  });

  it('switches to JSON textarea when JSON button is clicked', async () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: { model: 'opus' },
        },
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);

    fireEvent.click(screen.getByRole('button', { name: /json/i }));

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeTruthy();
      // Model card should be hidden in JSON mode
      expect(screen.queryByText('Active model for Claude Code')).toBeNull();
    });
  });

  it('shows Form button when in JSON mode to switch back', async () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: { model: 'opus' },
        },
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);

    fireEvent.click(screen.getByRole('button', { name: /json/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /form/i })).toBeTruthy();
    });
  });

  it('saves JSON content when save is clicked in JSON mode', async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: { model: 'opus' },
        },
        save: saveMock,
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);

    // Switch to JSON mode
    fireEvent.click(screen.getByRole('button', { name: /json/i }));

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeTruthy();
    });

    // Edit the JSON
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '{"model":"sonnet"}' } });

    // Save
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'sonnet' }));
  });

  it('shows JSON error for invalid JSON on save', async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: { model: 'opus' },
        },
        save: saveMock,
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);

    fireEvent.click(screen.getByRole('button', { name: /json/i }));

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeTruthy();
    });

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '{invalid json' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    // Should not have called save
    expect(saveMock).not.toHaveBeenCalled();
    // Should show error
    await waitFor(() => {
      const errorElements = document.querySelectorAll('.text-destructive');
      expect(errorElements.length).toBeGreaterThan(0);
    });
  });

  it('adds env var on Enter key press in key input', async () => {
    vi.mocked(useClaudeSettings).mockReturnValue(
      makeHook({
        config: {
          path: '/home/user/.claude/settings.json',
          exists: true,
          data: {},
        },
      })
    );

    render(<ClaudeSettingsView configDir="/home/user/.claude" />);

    const keyInput = screen.getByPlaceholderText('KEY');
    fireEvent.change(keyInput, { target: { value: 'ENTER_VAR' } });
    fireEvent.keyDown(keyInput, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('ENTER_VAR')).toBeTruthy();
    });
  });
});
