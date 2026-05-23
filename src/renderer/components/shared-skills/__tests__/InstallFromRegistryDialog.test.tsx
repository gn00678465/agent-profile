/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { InstallFromRegistryDialog, validateRegistryInput } from '../InstallFromRegistryDialog';

// Stub electronAPI on window
const installSkillFromRegistry = vi.fn();
const cancelInstallSkillFromRegistry = vi.fn();
let startedListener: ((p: { requestId: string }) => void) | null = null;
const onInstallSkillFromRegistryStarted = vi.fn((handler: (p: { requestId: string }) => void) => {
  startedListener = handler;
  return () => { startedListener = null; };
});

beforeEach(() => {
  installSkillFromRegistry.mockReset();
  cancelInstallSkillFromRegistry.mockReset();
  onInstallSkillFromRegistryStarted.mockClear();
  startedListener = null;
  (globalThis as unknown as { window: Window & { electronAPI: unknown } }).window = globalThis.window;
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    config: {
      installSkillFromRegistry: (...args: unknown[]) => installSkillFromRegistry(...args),
      cancelInstallSkillFromRegistry: (...args: unknown[]) => cancelInstallSkillFromRegistry(...args),
      onInstallSkillFromRegistryStarted: (h: (p: { requestId: string }) => void) => onInstallSkillFromRegistryStarted(h),
    },
  };
});

describe('validateRegistryInput (renderer-side)', () => {
  it.each([
    ['owner/repo'],
    ['vercel-labs/skills'],
    ['https://github.com/owner/repo'],
    ['http://example.com/x'],
    ['git@github.com:owner/repo.git'],
    ['./local-skill'],
    ['/abs/path/skill'],
    ['~/my-skill'],
  ])('accepts %s', (input) => {
    expect(validateRegistryInput(input)).toBeNull();
  });

  it.each([
    ['', 'Input is required'],
    ['   ', 'Input is required'],
    ['x'.repeat(501), 'Input exceeds 500 chars'],
    ['has space', 'Input cannot contain whitespace or shell metacharacters'],
    ['evil; rm -rf', 'Input cannot contain whitespace or shell metacharacters'],
    ['a|b', 'Input cannot contain whitespace or shell metacharacters'],
    ['a&b', 'Input cannot contain whitespace or shell metacharacters'],
    ['$VAR', 'Input cannot contain whitespace or shell metacharacters'],
    ['back`tick', 'Input cannot contain whitespace or shell metacharacters'],
  ])('rejects %s', (input, expectedSubstring) => {
    const err = validateRegistryInput(input);
    expect(err).toBeTruthy();
    if (err) expect(err).toContain(expectedSubstring);
  });

  it('boundary: exactly 500 chars is accepted, 501 rejected', () => {
    expect(validateRegistryInput('a'.repeat(500))).toBeNull();
    expect(validateRegistryInput('a'.repeat(501))).toBe('Input exceeds 500 chars');
  });
});

describe('InstallFromRegistryDialog', () => {
  it('shows inline validation error when input is invalid and Install clicked', async () => {
    render(
      <InstallFromRegistryDialog
        open
        onOpenChange={vi.fn()}
        sharedConfigDir="/x"
        onInstallComplete={vi.fn()}
      />,
    );
    const input = screen.getByTestId('registry-input');
    fireEvent.change(input, { target: { value: 'has space' } });
    fireEvent.click(screen.getByRole('button', { name: /install/i }));
    expect(await screen.findByTestId('validation-error')).toBeTruthy();
    expect(installSkillFromRegistry).not.toHaveBeenCalled();
  });

  it('success path: invokes IPC, displays stdout, calls onInstallComplete', async () => {
    const onInstallComplete = vi.fn().mockResolvedValue(undefined);
    installSkillFromRegistry.mockResolvedValue({
      success: true,
      data: { requestId: 'r-1', stdout: '+ added skill', stderr: '', exitCode: 0 },
    });

    render(
      <InstallFromRegistryDialog
        open
        onOpenChange={vi.fn()}
        sharedConfigDir="/x"
        onInstallComplete={onInstallComplete}
      />,
    );
    fireEvent.change(screen.getByTestId('registry-input'), { target: { value: 'owner/repo' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /install/i }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('registry-output').textContent).toContain('+ added skill');
    });
    expect(onInstallComplete).toHaveBeenCalled();
  });

  it('agent checkboxes: default has only claude-code checked; lists 3 supported agents (no gemini-cli, no universal)', () => {
    render(
      <InstallFromRegistryDialog
        open
        onOpenChange={vi.fn()}
        sharedConfigDir="/x"
        onInstallComplete={vi.fn()}
      />,
    );
    expect((screen.getByTestId('registry-agent-claude-code') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('registry-agent-github-copilot') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId('registry-agent-antigravity') as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByTestId('registry-agent-gemini-cli')).toBeNull();
    expect(screen.queryByTestId('registry-agent-universal')).toBeNull();
  });

  it('dispatched options reflect multi-agent selection + skill filter', async () => {
    installSkillFromRegistry.mockResolvedValue({
      success: true, data: { requestId: 'r-x', stdout: '', stderr: '', exitCode: 0 },
    });
    render(
      <InstallFromRegistryDialog
        open
        onOpenChange={vi.fn()}
        sharedConfigDir="/x"
        onInstallComplete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('registry-input'), { target: { value: 'mattpocock/skills' } });
    fireEvent.click(screen.getByTestId('registry-agent-github-copilot'));
    fireEvent.click(screen.getByTestId('registry-agent-antigravity'));
    fireEvent.change(screen.getByTestId('registry-skill-filter'), { target: { value: 'handoff' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /install/i }));
    });
    expect(installSkillFromRegistry).toHaveBeenCalledWith(
      '/x',
      'mattpocock/skills',
      { agents: ['claude-code', 'github-copilot', 'antigravity'], skill: 'handoff' },
    );
  });

  it('unchecking the only agent yields agents=[] (universal-only install, no symlinks)', async () => {
    installSkillFromRegistry.mockResolvedValue({
      success: true, data: { requestId: 'r-z', stdout: '', stderr: '', exitCode: 0 },
    });
    render(
      <InstallFromRegistryDialog
        open
        onOpenChange={vi.fn()}
        sharedConfigDir="/x"
        onInstallComplete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('registry-input'), { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByTestId('registry-agent-claude-code'));  // uncheck the default
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /install/i }));
    });
    expect(installSkillFromRegistry).toHaveBeenCalledWith(
      '/x',
      'owner/repo',
      expect.objectContaining({ agents: [] }),
    );
  });

  it('skill filter validation: rejects unsafe characters (e.g. "foo/bar")', async () => {
    render(
      <InstallFromRegistryDialog
        open
        onOpenChange={vi.fn()}
        sharedConfigDir="/x"
        onInstallComplete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('registry-input'), { target: { value: 'owner/repo' } });
    fireEvent.change(screen.getByTestId('registry-skill-filter'), { target: { value: 'foo/bar' } });
    fireEvent.click(screen.getByRole('button', { name: /install/i }));
    expect(await screen.findByTestId('validation-error')).toBeTruthy();
    expect(installSkillFromRegistry).not.toHaveBeenCalled();
  });

  it('skill filter "*" (default) is sent verbatim to handler — handler decides to omit flag', async () => {
    installSkillFromRegistry.mockResolvedValue({
      success: true, data: { requestId: 'r-y', stdout: '', stderr: '', exitCode: 0 },
    });
    render(
      <InstallFromRegistryDialog
        open
        onOpenChange={vi.fn()}
        sharedConfigDir="/x"
        onInstallComplete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('registry-input'), { target: { value: 'owner/repo' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /install/i }));
    });
    expect(installSkillFromRegistry).toHaveBeenCalledWith(
      '/x',
      'owner/repo',
      expect.objectContaining({ skill: '*' }),
    );
  });


  it('failure path: non-zero exitCode shows error, does NOT call onInstallComplete', async () => {
    const onInstallComplete = vi.fn();
    installSkillFromRegistry.mockResolvedValue({
      success: true,
      data: { requestId: 'r-2', stdout: '', stderr: 'oops', exitCode: 1 },
    });
    render(
      <InstallFromRegistryDialog
        open
        onOpenChange={vi.fn()}
        sharedConfigDir="/x"
        onInstallComplete={onInstallComplete}
      />,
    );
    fireEvent.change(screen.getByTestId('registry-input'), { target: { value: 'owner/repo' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /install/i }));
    });
    await waitFor(() => {
      expect(screen.getByText(/exited with code 1/i)).toBeTruthy();
    });
    expect(onInstallComplete).not.toHaveBeenCalled();
  });

  it('Cancel during install: invokes cancelInstallSkillFromRegistry with captured requestId', async () => {
    // Install never resolves until we control it
    let resolveInstall: (v: unknown) => void = () => {};
    installSkillFromRegistry.mockImplementation(() => new Promise((res) => { resolveInstall = res; }));
    cancelInstallSkillFromRegistry.mockResolvedValue({ success: true, data: { killed: true } });

    const onOpenChange = vi.fn();
    render(
      <InstallFromRegistryDialog
        open
        onOpenChange={onOpenChange}
        sharedConfigDir="/x"
        onInstallComplete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('registry-input'), { target: { value: 'owner/repo' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /install/i }));
    });

    // Simulate the early `:started` event arriving with a requestId
    expect(startedListener).toBeTruthy();
    act(() => { startedListener?.({ requestId: 'req-abc' }); });

    // Click Cancel
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    });
    expect(cancelInstallSkillFromRegistry).toHaveBeenCalledWith('req-abc');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    resolveInstall({ success: true, data: { requestId: 'req-abc', stdout: '', stderr: '', exitCode: -1 } });
  });
});
