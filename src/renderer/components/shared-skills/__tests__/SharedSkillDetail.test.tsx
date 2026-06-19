/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SharedSkillDetail } from '../SharedSkillDetail';
import { DEFAULT_SKILL_TEMPLATE } from '@/components/editors/SkillsEditor';
import type { Skill } from '@shared/types';

const skill: Skill = {
  id: 'commit-message',
  name: 'Commit Message',
  description: 'Generate git commit messages',
  version: '1.0.0',
  content: '---\nname: Commit Message\nversion: "1.0.0"\n---\n# body',
};

describe('SharedSkillDetail', () => {
  it('edit mode shows skill id, version badge, and content in textarea', () => {
    render(
      <SharedSkillDetail
        mode="edit"
        skill={skill}
        saving={false}
        saveError={null}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('commit-message')).toBeTruthy();
    expect(screen.getByText('v1.0.0')).toBeTruthy();
    const editor = screen.getByTestId('shared-skill-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe(skill.content);
  });

  it('new mode seeds the textarea with DEFAULT_SKILL_TEMPLATE', () => {
    render(
      <SharedSkillDetail
        mode="new"
        saving={false}
        saveError={null}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const editor = screen.getByTestId('shared-skill-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe(DEFAULT_SKILL_TEMPLATE);
  });

  it('Save in edit mode invokes onSave with id + current textarea value', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <SharedSkillDetail
        mode="edit"
        skill={skill}
        saving={false}
        saveError={null}
        onSave={onSave}
        onBack={vi.fn()}
      />,
    );
    const editor = screen.getByTestId('shared-skill-editor') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'updated content' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });
    expect(onSave).toHaveBeenCalledWith('commit-message', 'updated content');
  });

  it('Save in new mode requires non-empty id (button disabled when empty)', () => {
    render(
      <SharedSkillDetail
        mode="new"
        saving={false}
        saveError={null}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
    const idInput = screen.getByTestId('new-skill-id-input');
    fireEvent.change(idInput, { target: { value: 'my-new-skill' } });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('Cancel button calls onBack', () => {
    const onBack = vi.fn();
    render(
      <SharedSkillDetail
        mode="edit"
        skill={skill}
        saving={false}
        saveError={null}
        onSave={vi.fn()}
        onBack={onBack}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('pressing Escape calls onBack', () => {
    const onBack = vi.fn();
    render(
      <SharedSkillDetail
        mode="edit"
        skill={skill}
        saving={false}
        saveError={null}
        onSave={vi.fn()}
        onBack={onBack}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('saveError is rendered as inline banner when present', () => {
    render(
      <SharedSkillDetail
        mode="edit"
        skill={skill}
        saving={false}
        saveError="Disk full"
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('Disk full')).toBeTruthy();
  });

  it('saving=true disables Save button and shows Saving…', () => {
    render(
      <SharedSkillDetail
        mode="edit"
        skill={skill}
        saving
        saveError={null}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const saveBtn = screen.getByRole('button', { name: /saving/i }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });
});
