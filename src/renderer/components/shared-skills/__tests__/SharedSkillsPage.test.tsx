/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SharedSkillsPage } from '../SharedSkillsPage';
import type { Skill, SkillLinkedBy, AgentProfile } from '@shared/types';

// ─── Mock useSkills hook ──────────────────────────────────────────────────────
const useSkillsMock = vi.fn();
vi.mock('@/hooks/useConfig', () => ({
  useSkills: (...args: unknown[]) => useSkillsMock(...args),
}));

// ─── Mock the install + update dialogs (interaction covered by their own test files) ───
vi.mock('../InstallFromRegistryDialog', () => ({
  InstallFromRegistryDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? <div data-testid="mock-install-dialog"><button onClick={() => onOpenChange(false)}>close</button></div> : null,
}));
vi.mock('../UpdateRegistryDialog', () => ({
  UpdateRegistryDialog: ({ skillIds, targetLabel, onOpenChange }: { skillIds: string[]; targetLabel: string; onOpenChange: (v: boolean) => void }) => (
    <div data-testid="mock-update-dialog" data-skill-ids={skillIds.join(',')} data-label={targetLabel}>
      <button onClick={() => onOpenChange(false)}>close</button>
    </div>
  ),
}));

// ─── electronAPI stub ────────────────────────────────────────────────────────
const getSkillsLinkedBy = vi.fn();
const getSkillLock = vi.fn();
const getAgents = vi.fn();
const getSkills = vi.fn();
const installSkillFromZip = vi.fn();
const importSkillFromFolder = vi.fn();
const removeSkillFromRegistry = vi.fn();
const openDir = vi.fn();
const openFile = vi.fn();

function setupElectronAPI() {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    config: {
      getSkillsLinkedBy: (...args: unknown[]) => getSkillsLinkedBy(...args),
      getSkillLock: (...args: unknown[]) => getSkillLock(...args),
      getAgents: () => getAgents(),
      getSkills: (...args: unknown[]) => getSkills(...args),
      installSkillFromZip: (...args: unknown[]) => installSkillFromZip(...args),
      importSkillFromFolder: (...args: unknown[]) => importSkillFromFolder(...args),
      removeSkillFromRegistry: (...args: unknown[]) => removeSkillFromRegistry(...args),
    },
    dialog: {
      openDir: () => openDir(),
      openFile: (...args: unknown[]) => openFile(...args),
    },
  };
}

const sharedSkills: Skill[] = [
  { id: 'a-skill', name: 'A Skill', description: 'desc-a', content: '---\nname: A\n---\n' },
  { id: 'b-skill', name: 'B Skill', description: 'desc-b', content: '---\nname: B\n---\n' },
];

function defaultHookState(overrides: Record<string, unknown> = {}) {
  return {
    skills: sharedSkills,
    loading: false,
    error: null,
    saveSkill: vi.fn().mockResolvedValue(undefined),
    deleteSkill: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    linkSharedSkill: vi.fn(),
    installSkillFromZip: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupElectronAPI();
  vi.stubGlobal('confirm', vi.fn(() => true));

  // Default IPC responses
  getSkillsLinkedBy.mockResolvedValue({ success: true, data: [] as SkillLinkedBy[] });
  getSkillLock.mockResolvedValue({ success: true, data: null });
  getAgents.mockResolvedValue({ success: true, data: [] as AgentProfile[] });
  getSkills.mockResolvedValue({ success: true, data: [] as Skill[] });
});

describe('SharedSkillsPage — layout regions in DOM order', () => {
  it('renders header → filter → list testids in document order', async () => {
    useSkillsMock.mockReturnValue(defaultHookState());
    render(<SharedSkillsPage configDir="/home/user/.agents" />);

    const header = screen.getByTestId('shared-skills-header');
    const filter = screen.getByTestId('shared-skills-filter');
    const list = screen.getByTestId('shared-skills-list');
    const ids = ['shared-skills-header', 'shared-skills-filter', 'shared-skills-list'];
    const found = screen.getAllByTestId(/shared-skills-(header|filter|list)/).map((n) => n.getAttribute('data-testid'));
    expect(found).toEqual(ids);
    expect(header && filter && list).toBeTruthy();
  });

  it('renders 3 header action buttons in order', () => {
    useSkillsMock.mockReturnValue(defaultHookState());
    render(<SharedSkillsPage configDir="/x" />);
    expect(screen.getByTestId('header-install-registry')).toBeTruthy();
    expect(screen.getByTestId('header-import-folder')).toBeTruthy();
    expect(screen.getByTestId('header-install-zip')).toBeTruthy();
  });

  it('renders 4 agent chips (claude-code, codex, gemini, copilot) — chips are NOT interactive', () => {
    useSkillsMock.mockReturnValue(defaultHookState());
    render(<SharedSkillsPage configDir="/x" />);
    expect(screen.getByTestId('filter-chip-claude-code')).toBeTruthy();
    expect(screen.getByTestId('filter-chip-codex')).toBeTruthy();
    expect(screen.getByTestId('filter-chip-gemini')).toBeTruthy();
    expect(screen.getByTestId('filter-chip-copilot')).toBeTruthy();
    // No role=button, no onclick: chip is a span
    const chip = screen.getByTestId('filter-chip-claude-code');
    expect(chip.tagName.toLowerCase()).toBe('span');
    expect(chip.getAttribute('role')).not.toBe('button');
    expect(chip.getAttribute('tabIndex')).toBeNull();
  });

  it('renders Refresh button + Create blank link', () => {
    useSkillsMock.mockReturnValue(defaultHookState());
    render(<SharedSkillsPage configDir="/x" />);
    expect(screen.getByTestId('filter-refresh')).toBeTruthy();
    expect(screen.getByTestId('filter-create-blank')).toBeTruthy();
  });
});

describe('SharedSkillsPage — list states', () => {
  it('loading: shows "Loading skills…"', () => {
    useSkillsMock.mockReturnValue(defaultHookState({ loading: true, skills: [] }));
    render(<SharedSkillsPage configDir="/x" />);
    expect(screen.getByText(/Loading skills/)).toBeTruthy();
  });

  it('empty: shows empty-state text referencing header actions', () => {
    useSkillsMock.mockReturnValue(defaultHookState({ skills: [] }));
    render(<SharedSkillsPage configDir="/x" />);
    expect(screen.getByTestId('empty-state').textContent ?? '').toMatch(/No shared skills/);
  });

  it('error from useSkills shows banner with Retry that calls refresh', () => {
    const refresh = vi.fn();
    useSkillsMock.mockReturnValue(defaultHookState({ error: 'boom', skills: [], refresh }));
    render(<SharedSkillsPage configDir="/x" />);
    expect(screen.getByTestId('error-banner').textContent ?? '').toContain('boom');
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refresh).toHaveBeenCalled();
  });

  it('populated: renders one row per skill', async () => {
    useSkillsMock.mockReturnValue(defaultHookState());
    render(<SharedSkillsPage configDir="/x" />);
    await waitFor(() => {
      expect(screen.getByTestId('shared-skill-row-a-skill')).toBeTruthy();
      expect(screen.getByTestId('shared-skill-row-b-skill')).toBeTruthy();
    });
  });
});

describe('SharedSkillsPage — page swap', () => {
  it('clicking a row enters detail view; list is unmounted', async () => {
    useSkillsMock.mockReturnValue(defaultHookState());
    render(<SharedSkillsPage configDir="/x" />);
    await waitFor(() => screen.getByTestId('shared-skill-row-a-skill'));
    fireEvent.click(screen.getByTestId('shared-skill-row-a-skill'));
    expect(screen.getByTestId('shared-skills-detail')).toBeTruthy();
    expect(screen.queryByTestId('shared-skills-list')).toBeNull();
  });

  it('Esc in detail view returns to list', async () => {
    useSkillsMock.mockReturnValue(defaultHookState());
    render(<SharedSkillsPage configDir="/x" />);
    await waitFor(() => screen.getByTestId('shared-skill-row-a-skill'));
    fireEvent.click(screen.getByTestId('shared-skill-row-a-skill'));
    expect(screen.getByTestId('shared-skills-detail')).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.getByTestId('shared-skills-list')).toBeTruthy();
  });

  it('Create blank link enters detail in new mode', async () => {
    useSkillsMock.mockReturnValue(defaultHookState({ skills: [] }));
    render(<SharedSkillsPage configDir="/x" />);
    fireEvent.click(screen.getByTestId('filter-create-blank'));
    expect(screen.getByTestId('shared-skills-detail')).toBeTruthy();
    expect(screen.getByTestId('new-skill-id-input')).toBeTruthy();
  });
});

describe('SharedSkillsPage — agent icon click', () => {
  it('clicking an agent icon in a row calls onSelectAgentType, does NOT enter detail', async () => {
    getSkillsLinkedBy.mockResolvedValue({
      success: true,
      data: [{ skillId: 'a-skill', agents: ['claude-code'] }] as SkillLinkedBy[],
    });
    useSkillsMock.mockReturnValue(defaultHookState());
    const onSelectAgentType = vi.fn();
    render(<SharedSkillsPage configDir="/x" onSelectAgentType={onSelectAgentType} />);
    await waitFor(() => screen.getByTestId('agent-icon-claude-code'));
    fireEvent.click(screen.getByTestId('agent-icon-claude-code'));
    expect(onSelectAgentType).toHaveBeenCalledWith('claude-code');
    expect(screen.queryByTestId('shared-skills-detail')).toBeNull();
  });
});

describe('SharedSkillsPage — chip count (CA-09 dedup)', () => {
  it('chip count = linkedBy aggregation + own dir non-symlinks (no double-count)', async () => {
    // Setup: Claude has 2 own skills, one of them is a symlink to a shared skill.
    // linkedBy says Claude has a-skill linked.
    // Expected Claude count: 1 (linkedBy) + 1 (own, isSymbolicLink !== true) = 2 — NOT 3.
    getSkillsLinkedBy.mockResolvedValue({
      success: true,
      data: [
        { skillId: 'a-skill', agents: ['claude-code'] },
        { skillId: 'b-skill', agents: [] },
      ] as SkillLinkedBy[],
    });
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 'claude', name: 'Claude', type: 'claude-code', configDir: '/home/.claude' },
        { id: 'shared', name: 'Shared', type: 'shared', configDir: '/home/.agents' },
      ] as AgentProfile[],
    });
    getSkills.mockImplementation((configDir: string) => {
      if (configDir === '/home/.claude') {
        return Promise.resolve({
          success: true,
          data: [
            { id: 'a-skill', name: 'A', content: '', isSymbolicLink: true },     // symlinked — excluded
            { id: 'own-1', name: 'Own 1', content: '', isSymbolicLink: false },  // counted
          ] as Skill[],
        });
      }
      return Promise.resolve({ success: true, data: [] as Skill[] });
    });

    useSkillsMock.mockReturnValue(defaultHookState());
    render(<SharedSkillsPage configDir="/home/.agents" />);
    await waitFor(() => {
      expect(screen.getByTestId('filter-chip-count-claude-code').textContent).toBe('2');
    });
  });
});

describe('SharedSkillsPage — Codex (whole shared pool)', () => {
  it('Codex chip counts all shared skills and every row shows the Codex icon', async () => {
    // 2 shared skills in the pool; Codex reads ~/.agents/skills directly, so it
    // "uses" all of them regardless of per-agent symlinks (linkedBy is empty).
    useSkillsMock.mockReturnValue(defaultHookState());
    render(<SharedSkillsPage configDir="/home/.agents" />);
    await waitFor(() => {
      expect(screen.getByTestId('filter-chip-count-codex').textContent).toBe('2');
    });
    await waitFor(() => {
      expect(screen.getAllByTestId('agent-icon-codex').length).toBe(2);
    });
  });
});

describe('SharedSkillsPage — header actions', () => {
  it('Install from ZIP: opens file dialog, calls installSkillFromZip, refreshes', async () => {
    openFile.mockResolvedValue({ success: true, data: '/tmp/skill.zip' });
    installSkillFromZip.mockResolvedValue({ success: true, data: undefined });
    const refresh = vi.fn().mockResolvedValue(undefined);
    useSkillsMock.mockReturnValue(defaultHookState({ refresh }));
    render(<SharedSkillsPage configDir="/x" />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('header-install-zip'));
    });
    await waitFor(() => {
      expect(installSkillFromZip).toHaveBeenCalledWith('/x', '/tmp/skill.zip');
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('Import folder: opens dir picker, calls importSkillFromFolder, refreshes', async () => {
    openDir.mockResolvedValue({ success: true, data: '/tmp/my-skill' });
    importSkillFromFolder.mockResolvedValue({ success: true, data: { skillId: 'my-skill' } });
    const refresh = vi.fn().mockResolvedValue(undefined);
    useSkillsMock.mockReturnValue(defaultHookState({ refresh }));
    render(<SharedSkillsPage configDir="/x" />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('header-import-folder'));
    });
    await waitFor(() => {
      expect(importSkillFromFolder).toHaveBeenCalledWith('/x', '/tmp/my-skill');
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('Install from registry: opens the install dialog', () => {
    useSkillsMock.mockReturnValue(defaultHookState());
    render(<SharedSkillsPage configDir="/x" />);
    fireEvent.click(screen.getByTestId('header-install-registry'));
    expect(screen.getByTestId('mock-install-dialog')).toBeTruthy();
  });
});

describe('SharedSkillsPage — update flow', () => {
  it('Update all button is disabled when no skills are lock-tracked', async () => {
    getSkillLock.mockResolvedValue({ success: true, data: null });
    useSkillsMock.mockReturnValue(defaultHookState());
    render(<SharedSkillsPage configDir="/x" />);
    const btn = await screen.findByTestId('header-update-all');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('Update all button opens dialog with empty skillIds (= update all) when lock data exists', async () => {
    getSkillLock.mockResolvedValue({
      success: true,
      data: {
        version: 3,
        skills: {
          'a-skill': {
            source: 'tw93/kami', sourceType: 'github', sourceUrl: '', skillPath: '',
            skillFolderHash: 'x', installedAt: '2026-05-23', updatedAt: '2026-05-23',
          },
        },
      },
    });
    useSkillsMock.mockReturnValue(defaultHookState());
    render(<SharedSkillsPage configDir="/x" />);
    const btn = await screen.findByTestId('header-update-all');
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(btn);
    const dialog = screen.getByTestId('mock-update-dialog');
    expect(dialog.getAttribute('data-skill-ids')).toBe('');
    expect(dialog.getAttribute('data-label')).toBe('all tracked skills');
  });
});

describe('SharedSkillsPage — delete flow', () => {
  it('lock-tracked skill: routes through removeSkillFromRegistry, not local deleteSkill', async () => {
    const lockEntry = {
      source: 'tw93/kami', sourceType: 'github', sourceUrl: '', skillPath: '',
      skillFolderHash: 'x', installedAt: '2026-05-23', updatedAt: '2026-05-23',
    };
    getSkillLock.mockResolvedValue({
      success: true,
      data: { version: 3, skills: { 'a-skill': lockEntry } },
    });
    removeSkillFromRegistry.mockResolvedValue({
      success: true,
      data: { requestId: 'r-1', stdout: '✓ removed a-skill', stderr: '', exitCode: 0 },
    });
    const deleteSkill = vi.fn();
    const refresh = vi.fn().mockResolvedValue(undefined);
    useSkillsMock.mockReturnValue(defaultHookState({ deleteSkill, refresh }));
    render(<SharedSkillsPage configDir="/home/.agents" />);
    await waitFor(() => screen.getByTestId('shared-skill-row-a-skill'));
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Delete A Skill'));
    });
    await waitFor(() => {
      expect(removeSkillFromRegistry).toHaveBeenCalledWith('/home/.agents', ['a-skill']);
    });
    expect(deleteSkill).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it('non-lock-tracked skill: falls through to local deleteSkill', async () => {
    getSkillLock.mockResolvedValue({ success: true, data: null });
    const deleteSkill = vi.fn().mockResolvedValue(undefined);
    useSkillsMock.mockReturnValue(defaultHookState({ deleteSkill }));
    render(<SharedSkillsPage configDir="/home/.agents" />);
    await waitFor(() => screen.getByTestId('shared-skill-row-a-skill'));
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Delete A Skill'));
    });
    expect(deleteSkill).toHaveBeenCalledWith('a-skill');
    expect(removeSkillFromRegistry).not.toHaveBeenCalled();
  });

  it('lock-tracked + CLI fails: falls back to local deleteSkill + surfaces error', async () => {
    getSkillLock.mockResolvedValue({
      success: true,
      data: { version: 3, skills: { 'a-skill': {
        source: 'x/y', sourceType: 'github', sourceUrl: '', skillPath: '',
        skillFolderHash: 'h', installedAt: '2026-05-23', updatedAt: '2026-05-23',
      } } },
    });
    removeSkillFromRegistry.mockResolvedValue({
      success: true,
      data: { requestId: 'r-2', stdout: '', stderr: 'network error', exitCode: 1 },
    });
    const deleteSkill = vi.fn().mockResolvedValue(undefined);
    useSkillsMock.mockReturnValue(defaultHookState({ deleteSkill }));
    render(<SharedSkillsPage configDir="/home/.agents" />);
    await waitFor(() => screen.getByTestId('shared-skill-row-a-skill'));
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Delete A Skill'));
    });
    await waitFor(() => {
      expect(deleteSkill).toHaveBeenCalledWith('a-skill');
    });
    // Error banner should surface the CLI failure even though fallback succeeded
    await waitFor(() => {
      expect(screen.getByTestId('error-banner').textContent ?? '').toMatch(/Removed locally/);
    });
  });
});
