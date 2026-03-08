/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SkillsEditor } from '../SkillsEditor';
import type { Skill } from '@shared/types';

// Mock useSkills hook
vi.mock('@/hooks/useConfig', () => ({
  useSkills: vi.fn(),
}));

// Mock AddSkillDialog: renders a "New Skill" button when open that calls onCreateNew
vi.mock('../AddSkillDialog', () => ({
  AddSkillDialog: ({ open, onOpenChange, onCreateNew }: any) =>
    open ? (
      <button onClick={() => { onOpenChange(false); onCreateNew(); }}>New Skill</button>
    ) : null,
}));

import { useSkills } from '@/hooks/useConfig';

const mockSkills: Skill[] = [
  {
    id: 'commit-message',
    name: 'Commit Message',
    description: 'Generate git commit messages',
    version: '1.0.0',
    content: '---\nname: Commit Message\nversion: "1.0.0"\ndescription: Generate git commit messages\nuser-invocable: true\n---\n# Commit Message',
    userInvocable: true,
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Review code changes',
    content: '---\nname: Code Review\n---\n# Code Review',
  },
];

function makeHook(overrides = {}) {
  return {
    skills: [],
    loading: false,
    error: null,
    saveSkill: vi.fn().mockResolvedValue(undefined),
    deleteSkill: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn(),
    ...overrides,
  };
}

describe('SkillsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset confirm dialog
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('shows loading state while skills load', () => {
    vi.mocked(useSkills).mockReturnValue(makeHook({ loading: true }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    expect(screen.getByText('Loading skills...')).toBeTruthy();
  });

  it('shows empty state when no skills installed', () => {
    vi.mocked(useSkills).mockReturnValue(makeHook({ skills: [] }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    expect(screen.getByText(/No skills installed/)).toBeTruthy();
  });

  it('renders skill list when skills exist', () => {
    vi.mocked(useSkills).mockReturnValue(makeHook({ skills: mockSkills }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    expect(screen.getByText('Commit Message')).toBeTruthy();
    expect(screen.getByText('Code Review')).toBeTruthy();
  });

  it('shows skill description in list', () => {
    vi.mocked(useSkills).mockReturnValue(makeHook({ skills: mockSkills }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    expect(screen.getByText('Generate git commit messages')).toBeTruthy();
  });

  it('shows agent name in the header', () => {
    vi.mocked(useSkills).mockReturnValue(makeHook({ skills: [] }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    expect(screen.getByText('Claude Code Skills')).toBeTruthy();
  });

  it('shows error message when error is set', () => {
    vi.mocked(useSkills).mockReturnValue(
      makeHook({ error: 'Failed to load skills directory' })
    );

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    expect(screen.getByText('Failed to load skills directory')).toBeTruthy();
  });

  it('shows editor panel with skill content when skill is clicked', async () => {
    vi.mocked(useSkills).mockReturnValue(makeHook({ skills: mockSkills }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    fireEvent.click(screen.getByText('Commit Message'));

    await waitFor(() => {
      expect(screen.getByDisplayValue(/name: Commit Message/)).toBeTruthy();
    });
  });

  it('shows skill id and version badge when skill is selected', async () => {
    vi.mocked(useSkills).mockReturnValue(makeHook({ skills: mockSkills }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    fireEvent.click(screen.getByText('Commit Message'));

    await waitFor(() => {
      expect(screen.getByText('commit-message')).toBeTruthy();
      expect(screen.getByText('v1.0.0')).toBeTruthy();
    });
  });

  it('shows user-invocable badge when skill is user invocable', async () => {
    vi.mocked(useSkills).mockReturnValue(makeHook({ skills: mockSkills }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    fireEvent.click(screen.getByText('Commit Message'));

    await waitFor(() => {
      expect(screen.getByText('user-invocable')).toBeTruthy();
    });
  });

  it('shows empty editor prompt when no skill is selected', () => {
    vi.mocked(useSkills).mockReturnValue(makeHook({ skills: mockSkills }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    expect(screen.getByText('Select a skill to edit or create a new one')).toBeTruthy();
  });

  it('enters new skill mode by clicking the "New Skill" empty-state button when no skills exist', async () => {
    // When skills is empty, clicking "Add Skill" opens the dialog;
    // clicking "New Skill" in the dialog enters new-skill mode.
    vi.mocked(useSkills).mockReturnValue(makeHook({ skills: [] }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);

    fireEvent.click(screen.getByRole('button', { name: /add skill/i }));
    fireEvent.click(await screen.findByRole('button', { name: /new skill/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('skill-id')).toBeTruthy();
    });
  });

  it('enters new skill mode when New Skill button in empty state is clicked (duplicate removed - covered above)', async () => {
    vi.mocked(useSkills).mockReturnValue(makeHook({ skills: [] }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    fireEvent.click(screen.getByRole('button', { name: /add skill/i }));
    fireEvent.click(await screen.findByRole('button', { name: /new skill/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('skill-id')).toBeTruthy();
    });
  });

  it('shows validation error when save clicked without skill id', async () => {
    vi.mocked(useSkills).mockReturnValue(makeHook({ skills: [] }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    fireEvent.click(screen.getByRole('button', { name: /add skill/i }));
    fireEvent.click(await screen.findByRole('button', { name: /new skill/i }));

    await waitFor(() => expect(screen.getByPlaceholderText('skill-id')).toBeTruthy());

    const saveBtn = screen.getByRole('button', { name: /^save$/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => expect(screen.getByText('Skill ID is required')).toBeTruthy());
  });

  it('saves new skill with correct id and content', async () => {
    const saveSkillMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSkills).mockReturnValue(
      makeHook({ skills: [], saveSkill: saveSkillMock })
    );

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    fireEvent.click(screen.getByRole('button', { name: /add skill/i }));
    fireEvent.click(await screen.findByRole('button', { name: /new skill/i }));

    await waitFor(() => expect(screen.getByPlaceholderText('skill-id')).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText('skill-id'), {
      target: { value: 'my-new-skill' },
    });

    // Update the textarea content so name can be extracted
    const textarea = screen.getByPlaceholderText('SKILL.md content...');
    fireEvent.change(textarea, {
      target: { value: '---\nname: My New Skill\n---\n# Content' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });

    await waitFor(() =>
      expect(saveSkillMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'my-new-skill',
          name: 'My New Skill',
        })
      )
    );
  });

  it('shows save error when saveSkill fails', async () => {
    const saveSkillMock = vi.fn().mockRejectedValue(new Error('Write failed'));
    vi.mocked(useSkills).mockReturnValue(
      makeHook({ skills: [], saveSkill: saveSkillMock })
    );

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    fireEvent.click(screen.getByRole('button', { name: /add skill/i }));
    fireEvent.click(await screen.findByRole('button', { name: /new skill/i }));

    await waitFor(() => expect(screen.getByPlaceholderText('skill-id')).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText('skill-id'), {
      target: { value: 'my-skill' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });

    await waitFor(() => expect(screen.getByText('Write failed')).toBeTruthy());
  });

  it('hides editor panel after Cancel is clicked', async () => {
    vi.mocked(useSkills).mockReturnValue(makeHook({ skills: mockSkills }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    fireEvent.click(screen.getByText('Commit Message'));

    await waitFor(() => expect(screen.getByDisplayValue(/name: Commit Message/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() =>
      expect(screen.getByText('Select a skill to edit or create a new one')).toBeTruthy()
    );
  });

  it('deletes skill after confirmation', async () => {
    const deleteSkillMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSkills).mockReturnValue(
      makeHook({ skills: mockSkills, deleteSkill: deleteSkillMock })
    );
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);

    // Hover over skill row to reveal delete button
    const skillRow = screen.getByText('Commit Message').closest('[role="button"]')!;
    fireEvent.mouseEnter(skillRow);

    // Find delete button inside the skill row
    const deleteBtn = skillRow.querySelector('button');
    await act(async () => {
      fireEvent.click(deleteBtn!);
    });

    await waitFor(() =>
      expect(deleteSkillMock).toHaveBeenCalledWith('commit-message')
    );
  });

  it('does not delete skill when confirmation is rejected', async () => {
    const deleteSkillMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSkills).mockReturnValue(
      makeHook({ skills: mockSkills, deleteSkill: deleteSkillMock })
    );
    vi.stubGlobal('confirm', vi.fn(() => false));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);

    const skillRow = screen.getByText('Commit Message').closest('[role="button"]')!;
    const deleteBtn = skillRow.querySelector('button');
    await act(async () => {
      fireEvent.click(deleteBtn!);
    });

    expect(deleteSkillMock).not.toHaveBeenCalled();
  });

  it('clears selection when currently selected skill is deleted', async () => {
    const deleteSkillMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSkills).mockReturnValue(
      makeHook({ skills: mockSkills, deleteSkill: deleteSkillMock })
    );
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);

    // Select the skill first
    fireEvent.click(screen.getByText('Commit Message'));
    await waitFor(() => expect(screen.getByDisplayValue(/name: Commit Message/)).toBeTruthy());

    // Delete the selected skill
    const skillRow = screen.getByText('Commit Message').closest('[role="button"]')!;
    const deleteBtn = skillRow.querySelector('button');
    await act(async () => {
      fireEvent.click(deleteBtn!);
    });

    await waitFor(() =>
      expect(screen.getByText('Select a skill to edit or create a new one')).toBeTruthy()
    );
  });

  it('calls refresh when header refresh icon button is clicked', () => {
    const refreshMock = vi.fn();
    vi.mocked(useSkills).mockReturnValue(makeHook({ skills: [], refresh: refreshMock }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);

    // The header has two small icon buttons: first is refresh (RefreshCw), second is plus
    const smallIconButtons = screen.getAllByRole('button').filter((b) =>
      b.className?.includes('h-6 w-6')
    );
    // First small icon button in DOM is the refresh button
    fireEvent.click(smallIconButtons[0]);
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it('updates textarea when typing in editor', async () => {
    vi.mocked(useSkills).mockReturnValue(makeHook({ skills: mockSkills }));

    render(<SkillsEditor configDir="/home/user/.claude" agentName="Claude Code" />);
    fireEvent.click(screen.getByText('Commit Message'));

    await waitFor(() => expect(screen.getByPlaceholderText('SKILL.md content...')).toBeTruthy());

    const textarea = screen.getByPlaceholderText('SKILL.md content...');
    fireEvent.change(textarea, { target: { value: '# Updated content' } });

    expect((textarea as HTMLTextAreaElement).value).toBe('# Updated content');
  });
});
