/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useClaudeSettings,
  useMcpSettings,
  useSkills,
  useMarkdown,
} from '../useConfig';
import type { ClaudeSettings, McpSettings, Skill, ConfigFile } from '@shared/types';

// Mock the electron module
vi.mock('../../lib/electron', () => ({
  callElectron: vi.fn(),
  electronAPI: vi.fn(),
  isElectron: vi.fn(() => true),
}));

import { callElectron, electronAPI } from '../../lib/electron';

const mockClaudeConfig: ConfigFile<ClaudeSettings> = {
  path: '/home/user/.claude/settings.json',
  exists: true,
  data: {
    model: 'opus',
    permissions: { allow: ['Bash(*)'] },
    env: { MY_VAR: 'value' },
  },
};

const mockMcpConfig: ConfigFile<McpSettings> = {
  path: '/home/user/.claude/mcp-config.json',
  exists: true,
  data: {
    mcpServers: {
      test: { type: 'stdio', command: 'npx', args: ['-y', 'test-mcp'] },
    },
  },
};

const mockSkills: Skill[] = [
  {
    id: 'commit-message',
    name: 'Commit Message',
    description: 'Generate commit messages',
    content: '---\nname: Commit Message\n---\n# Commit Message',
  },
  {
    id: 'github-pr',
    name: 'GitHub PR',
    description: 'Manage GitHub pull requests',
    content: '---\nname: GitHub PR\n---\n# GitHub PR',
  },
];

describe('useClaudeSettings hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockApi = {
      config: {
        getClaudeSettings: vi.fn(),
        saveClaudeSettings: vi.fn(),
      },
    };
    vi.mocked(electronAPI).mockReturnValue(mockApi as any);
  });

  it('starts in loading state when configDir is provided', () => {
    vi.mocked(callElectron).mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useClaudeSettings('/home/user/.claude'));
    expect(result.current.loading).toBe(true);
    expect(result.current.config).toBeNull();
  });

  it('does not load when configDir is null', async () => {
    const { result } = renderHook(() => useClaudeSettings(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.config).toBeNull();
    expect(callElectron).not.toHaveBeenCalled();
  });

  it('loads Claude settings successfully', async () => {
    vi.mocked(callElectron).mockResolvedValue(mockClaudeConfig);

    const { result } = renderHook(() => useClaudeSettings('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.config).toEqual(mockClaudeConfig);
    expect(result.current.error).toBeNull();
  });

  it('sets error state when loading fails', async () => {
    vi.mocked(callElectron).mockRejectedValue(new Error('Cannot read settings'));

    const { result } = renderHook(() => useClaudeSettings('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Cannot read settings');
    expect(result.current.config).toBeNull();
  });

  it('save() calls saveClaudeSettings and reloads config', async () => {
    vi.mocked(callElectron)
      .mockResolvedValueOnce(mockClaudeConfig) // initial load
      .mockResolvedValueOnce(undefined)         // save
      .mockResolvedValueOnce({                  // reload after save
        ...mockClaudeConfig,
        data: { model: 'sonnet' },
      });

    const { result } = renderHook(() => useClaudeSettings('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.save({ model: 'sonnet' });
    });

    await waitFor(() => expect(result.current.saving).toBe(false));

    expect(callElectron).toHaveBeenCalledTimes(3); // load, save, reload
  });

  it('sets saving=true during save operation', async () => {
    let resolveSave: (value: undefined) => void;
    const savePromise = new Promise<undefined>((resolve) => {
      resolveSave = resolve;
    });

    vi.mocked(callElectron)
      .mockResolvedValueOnce(mockClaudeConfig)  // initial load
      .mockReturnValueOnce(savePromise as any);  // save - delayed

    const { result } = renderHook(() => useClaudeSettings('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Start save
    act(() => {
      void result.current.save({ model: 'opus' });
    });

    // During save, saving should be true
    await waitFor(() => expect(result.current.saving).toBe(true));

    // Resolve save
    resolveSave!(undefined);
    vi.mocked(callElectron).mockResolvedValueOnce(mockClaudeConfig);

    await waitFor(() => expect(result.current.saving).toBe(false));
  });

  it('save() throws and sets error when save fails', async () => {
    vi.mocked(callElectron)
      .mockResolvedValueOnce(mockClaudeConfig)
      .mockRejectedValueOnce(new Error('Write failed'));

    const { result } = renderHook(() => useClaudeSettings('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    let caughtError: Error | null = null;
    await act(async () => {
      try {
        await result.current.save({ model: 'bad' });
      } catch (e) {
        caughtError = e as Error;
      }
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toBe('Write failed');
    await waitFor(() => expect(result.current.error).toBe('Write failed'));
  });

  it('refresh() reloads Claude settings', async () => {
    vi.mocked(callElectron).mockResolvedValue(mockClaudeConfig);

    const { result } = renderHook(() => useClaudeSettings('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(callElectron).toHaveBeenCalledTimes(2);
  });
});

describe('useMcpSettings hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockApi = {
      config: {
        getMcp: vi.fn(),
        saveMcp: vi.fn(),
      },
    };
    vi.mocked(electronAPI).mockReturnValue(mockApi as any);
  });

  it('does not load when configDir is null', () => {
    const { result } = renderHook(() => useMcpSettings(null));
    expect(result.current.loading).toBe(false);
    expect(callElectron).not.toHaveBeenCalled();
  });

  it('loads MCP settings successfully', async () => {
    vi.mocked(callElectron).mockResolvedValue(mockMcpConfig);

    const { result } = renderHook(() => useMcpSettings('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.config).toEqual(mockMcpConfig);
    expect(result.current.error).toBeNull();
  });

  it('saves MCP settings and reloads', async () => {
    vi.mocked(callElectron)
      .mockResolvedValueOnce(mockMcpConfig)  // load
      .mockResolvedValueOnce(undefined)       // save
      .mockResolvedValueOnce(mockMcpConfig); // reload

    const { result } = renderHook(() => useMcpSettings('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.save({ mcpServers: {} });
    });

    expect(callElectron).toHaveBeenCalledTimes(3);
  });
});

describe('useSkills hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockApi = {
      config: {
        getSkills: vi.fn(),
        saveSkill: vi.fn(),
        deleteSkill: vi.fn(),
      },
    };
    vi.mocked(electronAPI).mockReturnValue(mockApi as any);
  });

  it('does not load when configDir is null', () => {
    const { result } = renderHook(() => useSkills(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.skills).toEqual([]);
  });

  it('loads skills successfully', async () => {
    vi.mocked(callElectron).mockResolvedValue(mockSkills);

    const { result } = renderHook(() => useSkills('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.skills).toEqual(mockSkills);
    expect(result.current.error).toBeNull();
  });

  it('sets error when loading skills fails', async () => {
    vi.mocked(callElectron).mockRejectedValue(new Error('Skills dir not found'));

    const { result } = renderHook(() => useSkills('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Skills dir not found');
    expect(result.current.skills).toEqual([]);
  });

  it('saveSkill() saves and reloads skills list', async () => {
    vi.mocked(callElectron)
      .mockResolvedValueOnce(mockSkills)    // initial load
      .mockResolvedValueOnce(undefined)     // save
      .mockResolvedValueOnce([...mockSkills, { id: 'new-skill', name: 'New Skill', content: '' }]); // reload

    const { result } = renderHook(() => useSkills('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveSkill({
        id: 'new-skill',
        name: 'New Skill',
        content: '---\nname: New Skill\n---',
      });
    });

    await waitFor(() => expect(result.current.skills).toHaveLength(3));
  });

  it('saveSkill() throws when save fails', async () => {
    vi.mocked(callElectron)
      .mockResolvedValueOnce(mockSkills)
      .mockRejectedValueOnce(new Error('Write error'));

    const { result } = renderHook(() => useSkills('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    let caughtError: Error | null = null;
    await act(async () => {
      try {
        await result.current.saveSkill({ id: 'test', name: 'Test', content: '' });
      } catch (e) {
        caughtError = e as Error;
      }
    });
    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toContain('Write error');
  });

  it('deleteSkill() deletes and reloads skills list', async () => {
    vi.mocked(callElectron)
      .mockResolvedValueOnce(mockSkills)    // initial load
      .mockResolvedValueOnce(undefined)     // delete
      .mockResolvedValueOnce([mockSkills[1]]); // reload (commit-message removed)

    const { result } = renderHook(() => useSkills('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteSkill('commit-message');
    });

    await waitFor(() => expect(result.current.skills).toHaveLength(1));
    expect(result.current.skills[0].id).toBe('github-pr');
  });

  it('deleteSkill() throws when deletion fails', async () => {
    vi.mocked(callElectron)
      .mockResolvedValueOnce(mockSkills)
      .mockRejectedValueOnce(new Error('Delete error'));

    const { result } = renderHook(() => useSkills('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    let caughtError: Error | null = null;
    await act(async () => {
      try {
        await result.current.deleteSkill('nonexistent');
      } catch (e) {
        caughtError = e as Error;
      }
    });
    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toContain('Delete error');
  });

  it('refresh() reloads skills', async () => {
    vi.mocked(callElectron).mockResolvedValue(mockSkills);

    const { result } = renderHook(() => useSkills('/home/user/.claude'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(callElectron).toHaveBeenCalledTimes(2);
  });
});

describe('useMarkdown hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockApi = {
      config: {
        getMarkdown: vi.fn(),
        saveMarkdown: vi.fn(),
      },
    };
    vi.mocked(electronAPI).mockReturnValue(mockApi as any);
  });

  it('does not load when filePath is null', () => {
    const { result } = renderHook(() => useMarkdown(null));
    expect(result.current.loading).toBe(false);
    expect(callElectron).not.toHaveBeenCalled();
  });

  it('loads markdown file successfully', async () => {
    const markdownConfig: ConfigFile<string> = {
      path: '/home/user/.claude/CLAUDE.md',
      exists: true,
      data: '# Global Instructions\n\nDo this.',
    };
    vi.mocked(callElectron).mockResolvedValue(markdownConfig);

    const { result } = renderHook(() => useMarkdown('/home/user/.claude/CLAUDE.md'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.config).toEqual(markdownConfig);
    expect(result.current.error).toBeNull();
  });

  it('handles non-existent markdown file', async () => {
    const notFound: ConfigFile<string> = {
      path: '/home/user/.claude/CLAUDE.md',
      exists: false,
      data: null,
    };
    vi.mocked(callElectron).mockResolvedValue(notFound);

    const { result } = renderHook(() => useMarkdown('/home/user/.claude/CLAUDE.md'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.config?.exists).toBe(false);
    expect(result.current.config?.data).toBeNull();
  });

  it('save() writes markdown and reloads', async () => {
    const initialConfig: ConfigFile<string> = {
      path: '/home/user/.claude/CLAUDE.md',
      exists: false,
      data: null,
    };
    const savedConfig: ConfigFile<string> = {
      path: '/home/user/.claude/CLAUDE.md',
      exists: true,
      data: '# New Content',
    };

    vi.mocked(callElectron)
      .mockResolvedValueOnce(initialConfig)  // load
      .mockResolvedValueOnce(undefined)       // save
      .mockResolvedValueOnce(savedConfig);   // reload

    const { result } = renderHook(() => useMarkdown('/home/user/.claude/CLAUDE.md'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.save('# New Content');
    });

    await waitFor(() => expect(result.current.saving).toBe(false));
    expect(result.current.config?.exists).toBe(true);
    expect(result.current.config?.data).toBe('# New Content');
  });

  it('save() sets error and throws when write fails', async () => {
    const initialConfig: ConfigFile<string> = {
      path: '/home/user/.claude/CLAUDE.md',
      exists: false,
      data: null,
    };

    vi.mocked(callElectron)
      .mockResolvedValueOnce(initialConfig)
      .mockRejectedValueOnce(new Error('Read-only filesystem'));

    const { result } = renderHook(() => useMarkdown('/home/user/.claude/CLAUDE.md'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    let caughtError: Error | null = null;
    await act(async () => {
      try {
        await result.current.save('# Test');
      } catch (e) {
        caughtError = e as Error;
      }
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toBe('Read-only filesystem');
    expect(result.current.error).toBe('Read-only filesystem');
  });
});
