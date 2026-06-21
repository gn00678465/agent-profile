/**
 * @vitest-environment jsdom
 *
 * Regression coverage for the Codex/Copilot Subagents tab. These reproduce the
 * four bugs found when E2E was skipped:
 *   1-3. create/rename must update the list (and not wipe it) without a manual
 *        refresh — the post-mutation refetch must use the same dir/ext opts.
 *   4.   duplicate names must be blocked (case-insensitive — Windows collides).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SubagentsEditor } from '../SubagentsEditor';
import type { SubagentFile } from '@shared/types';

vi.mock('@/components/editors/TomlFileEditor', () => ({
  TomlFileEditor: ({ onSaved }: { onSaved?: () => void }) => (
    <button data-testid="editor-save" onClick={() => onSaved?.()}>save</button>
  ),
}));
vi.mock('@/components/editors/MarkdownEditor', () => ({
  MarkdownEditor: () => <div data-testid="md-editor-stub" />,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/lib/electron', () => ({
  callElectron: vi.fn(),
  electronAPI: vi.fn(),
  isElectron: vi.fn(() => true),
}));

import { callElectron, electronAPI } from '@/lib/electron';

const CODEX_DIR = '/home/.codex';
let store: SubagentFile[];
const getSubagents = vi.fn();
const createSubagent = vi.fn();
const renameSubagent = vi.fn();
const deleteSubagent = vi.fn();

function pathFor(name: string, opts: { dir: string; ext: string }) {
  return `${CODEX_DIR}/${opts.dir}/${name}${opts.ext}`;
}

function renderCodex() {
  return render(
    <SubagentsEditor
      configDir={CODEX_DIR}
      accentColor="#3941ff"
      subdir="agents"
      ext=".toml"
      editorKind="toml"
      template={(n) => `name = "${n}"\n`}
    />
  );
}

async function addSubagent(name: string) {
  fireEvent.click(screen.getByTitle('Add subagent'));
  const input = screen.getByPlaceholderText('subagent-name');
  fireEvent.change(input, { target: { value: name } });
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
}

beforeEach(() => {
  vi.clearAllMocks();
  store = [];

  // Real-ish callElectron: invoke the thunk and unwrap the IPC envelope.
  vi.mocked(callElectron).mockImplementation(async (fn: any) => {
    const r = await fn();
    if (!r.success) throw new Error(r.error);
    return r.data;
  });

  getSubagents.mockImplementation(async () => ({ success: true, data: [...store] }));
  createSubagent.mockImplementation(async (_dir: string, name: string, opts: any) => {
    const p = pathFor(name, opts);
    store.push({ id: name, name, path: p });
    return { success: true, data: p };
  });
  renameSubagent.mockImplementation(async (_dir: string, oldName: string, newName: string, opts: any) => {
    const it = store.find((s) => s.name === oldName);
    const p = pathFor(newName, opts);
    if (it) { it.id = newName; it.name = newName; it.path = p; }
    return { success: true, data: p };
  });
  deleteSubagent.mockImplementation(async (_dir: string, name: string) => {
    store = store.filter((s) => s.name !== name);
    return { success: true, data: undefined };
  });

  vi.mocked(electronAPI).mockReturnValue({
    config: { getSubagents, createSubagent, renameSubagent, deleteSubagent },
  } as any);
});

describe('SubagentsEditor — create/rename refresh the list (bugs 1-3)', () => {
  it('shows a newly created subagent without a manual refresh', async () => {
    renderCodex();
    await waitFor(() => expect(screen.getByText('No subagents found')).toBeTruthy());

    await addSubagent('planner');

    await waitFor(() => expect(screen.getByText('planner')).toBeTruthy());
    // refetch must target agents/.toml, not the default subagents/.agent.md
    expect(getSubagents).toHaveBeenLastCalledWith(CODEX_DIR, { dir: 'agents', ext: '.toml' });
  });

  it('keeps existing subagents visible after adding another (no disappear)', async () => {
    store = [
      { id: 'planner', name: 'planner', path: pathFor('planner', { dir: 'agents', ext: '.toml' }) },
      { id: 'reviewer', name: 'reviewer', path: pathFor('reviewer', { dir: 'agents', ext: '.toml' }) },
    ];
    renderCodex();
    await waitFor(() => expect(screen.getByText('planner')).toBeTruthy());

    await addSubagent('tester');

    await waitFor(() => expect(screen.getByText('tester')).toBeTruthy());
    expect(screen.getByText('planner')).toBeTruthy();
    expect(screen.getByText('reviewer')).toBeTruthy();
  });

  it('reflects a rename in the list without a manual refresh', async () => {
    store = [{ id: 'planner', name: 'planner', path: pathFor('planner', { dir: 'agents', ext: '.toml' }) }];
    renderCodex();
    await waitFor(() => expect(screen.getByText('planner')).toBeTruthy());

    fireEvent.click(screen.getByTitle('Rename'));
    const input = screen.getByDisplayValue('planner');
    fireEvent.change(input, { target: { value: 'architect' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });

    await waitFor(() => expect(screen.getByText('architect')).toBeTruthy());
    expect(screen.queryByText('planner')).toBeNull();
  });
});

describe('SubagentsEditor — list display', () => {
  it('shows each subagent description under its name', async () => {
    store = [{
      id: 'planner',
      name: 'planner',
      path: pathFor('planner', { dir: 'agents', ext: '.toml' }),
      description: 'Plans the work',
    }];
    renderCodex();
    await waitFor(() => expect(screen.getByText('planner')).toBeTruthy());
    expect(screen.getByText('Plans the work')).toBeTruthy();
  });

  it('syncs the list description after the editor saves', async () => {
    // Starts with no description.
    store = [{ id: 'planner', name: 'planner', path: pathFor('planner', { dir: 'agents', ext: '.toml' }) }];
    renderCodex();
    await waitFor(() => expect(screen.getByText('planner')).toBeTruthy());
    fireEvent.click(screen.getByText('planner')); // open the editor

    // Simulate the file gaining a description, then the editor saving.
    store[0] = { ...store[0], description: 'Now described' };
    await act(async () => { fireEvent.click(screen.getByTestId('editor-save')); });

    await waitFor(() => expect(screen.getByText('Now described')).toBeTruthy());
  });
});

describe('SubagentsEditor — duplicate name guard (bug 4)', () => {
  it('blocks creating a duplicate name (case-insensitive) and never calls createSubagent', async () => {
    store = [{ id: 'planner', name: 'planner', path: pathFor('planner', { dir: 'agents', ext: '.toml' }) }];
    renderCodex();
    await waitFor(() => expect(screen.getByText('planner')).toBeTruthy());

    await addSubagent('PLANNER');

    expect(screen.getByText(/already exists/i)).toBeTruthy();
    expect(createSubagent).not.toHaveBeenCalled();
  });

  it('blocks renaming onto an existing name and never calls renameSubagent', async () => {
    store = [
      { id: 'planner', name: 'planner', path: pathFor('planner', { dir: 'agents', ext: '.toml' }) },
      { id: 'reviewer', name: 'reviewer', path: pathFor('reviewer', { dir: 'agents', ext: '.toml' }) },
    ];
    renderCodex();
    await waitFor(() => expect(screen.getByText('planner')).toBeTruthy());

    fireEvent.click(screen.getAllByTitle('Rename')[0]); // planner's pencil
    const input = screen.getByDisplayValue('planner');
    fireEvent.change(input, { target: { value: 'reviewer' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });

    expect(screen.getByText(/already exists/i)).toBeTruthy();
    expect(renameSubagent).not.toHaveBeenCalled();
  });
});
