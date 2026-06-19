/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SharedSkillRow } from '../SharedSkillRow';
import type { Skill } from '@shared/types';

const skill: Skill = {
  id: 'commit-message',
  name: 'Commit Message',
  description: 'Generate git commit messages from staged diff',
  content: '---\nname: Commit Message\n---\n# x',
};

describe('SharedSkillRow', () => {
  it('renders the name + 本地 badge + description', () => {
    render(
      <SharedSkillRow
        skill={skill}
        linkedAgents={[]}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onAgentIconClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Commit Message')).toBeTruthy();
    expect(screen.getByText('本地')).toBeTruthy();
    expect(screen.getByText('Generate git commit messages from staged diff')).toBeTruthy();
  });

  it('description has a title attribute equal to its text (tooltip on truncation)', () => {
    render(
      <SharedSkillRow
        skill={skill}
        linkedAgents={[]}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onAgentIconClick={vi.fn()}
      />,
    );
    const desc = screen.getByText('Generate git commit messages from staged diff');
    expect(desc.getAttribute('title')).toBe('Generate git commit messages from staged diff');
  });

  it('renders agent icons only for linked agents', () => {
    render(
      <SharedSkillRow
        skill={skill}
        linkedAgents={['claude-code', 'gemini']}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onAgentIconClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId('agent-icon-claude-code')).toBeTruthy();
    expect(screen.getByTestId('agent-icon-gemini')).toBeTruthy();
    expect(screen.queryByTestId('agent-icon-copilot')).toBeNull();
  });

  it('clicking the row body fires onOpen', () => {
    const onOpen = vi.fn();
    render(
      <SharedSkillRow
        skill={skill}
        linkedAgents={[]}
        onOpen={onOpen}
        onDelete={vi.fn()}
        onAgentIconClick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId(`shared-skill-row-${skill.id}`));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('clicking an agent icon fires onAgentIconClick but NOT onOpen', () => {
    const onOpen = vi.fn();
    const onAgentIconClick = vi.fn();
    render(
      <SharedSkillRow
        skill={skill}
        linkedAgents={['claude-code']}
        onOpen={onOpen}
        onDelete={vi.fn()}
        onAgentIconClick={onAgentIconClick}
      />,
    );
    fireEvent.click(screen.getByTestId('agent-icon-claude-code'));
    expect(onAgentIconClick).toHaveBeenCalledWith('claude-code');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('renders source badge when lock data is provided (instead of 本地)', () => {
    render(
      <SharedSkillRow
        skill={skill}
        linkedAgents={[]}
        lock={{
          source: 'tw93/kami',
          sourceType: 'github',
          sourceUrl: 'https://github.com/tw93/kami.git',
          skillPath: 'SKILL.md',
          skillFolderHash: 'abc123',
          installedAt: '2026-05-23T04:01:40.724Z',
          updatedAt: '2026-05-23T04:01:40.724Z',
        }}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onAgentIconClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId(`source-badge-${skill.id}`).textContent).toContain('tw93/kami');
    expect(screen.queryByText('本地')).toBeNull();
  });

  it('renders update button only when both lock data and onUpdate are provided', () => {
    const onUpdate = vi.fn();
    render(
      <SharedSkillRow
        skill={skill}
        linkedAgents={[]}
        lock={{
          source: 'tw93/kami', sourceType: 'github', sourceUrl: '', skillPath: '',
          skillFolderHash: 'x', installedAt: '2026-05-23', updatedAt: '2026-05-23',
        }}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={onUpdate}
        onAgentIconClick={vi.fn()}
      />,
    );
    const btn = screen.getByTestId(`update-${skill.id}`);
    fireEvent.click(btn);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('hides update button when no lock data', () => {
    render(
      <SharedSkillRow
        skill={skill}
        linkedAgents={[]}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onAgentIconClick={vi.fn()}
      />,
    );
    expect(screen.queryByTestId(`update-${skill.id}`)).toBeNull();
  });

  it('clicking delete fires onDelete but NOT onOpen', () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    render(
      <SharedSkillRow
        skill={skill}
        linkedAgents={[]}
        onOpen={onOpen}
        onDelete={onDelete}
        onAgentIconClick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText(`Delete ${skill.name}`));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
