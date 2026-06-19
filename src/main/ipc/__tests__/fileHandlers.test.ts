import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFileHandlers } from '../fileHandlers';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    unlink: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
  },
}));

import fs from 'fs/promises';

// Build a mock ipcMain that captures handlers
function createMockIpcMain() {
  const handlers: Record<string, Function> = {};
  return {
    handle: (channel: string, fn: Function) => {
      handlers[channel] = fn;
    },
    invoke: async (channel: string, ...args: unknown[]) => {
      const handler = handlers[channel];
      if (!handler) throw new Error(`No handler for channel: ${channel}`);
      return handler({}, ...args);
    },
    handlers,
  };
}

describe('fileHandlers', () => {
  let ipc: ReturnType<typeof createMockIpcMain>;

  beforeEach(() => {
    vi.clearAllMocks();
    ipc = createMockIpcMain();
    registerFileHandlers(ipc as any);
  });

  // ── FILE_READ ──────────────────────────────────────────────────────────────

  describe('file:read', () => {
    it('returns success with file content when file exists', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('hello world' as any);

      const result = await ipc.invoke('file:read', '/some/file.txt');
      expect(result.success).toBe(true);
      expect(result.data).toBe('hello world');
      expect(fs.readFile).toHaveBeenCalledWith('/some/file.txt', 'utf-8');
    });

    it('returns failure when file does not exist', async () => {
      const err = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
      vi.mocked(fs.readFile).mockRejectedValue(err);

      const result = await ipc.invoke('file:read', '/nonexistent/file.txt');
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    it('returns failure with string error when non-Error is thrown', async () => {
      vi.mocked(fs.readFile).mockRejectedValue('some string error');

      const result = await ipc.invoke('file:read', '/some/file.txt');
      expect(result.success).toBe(false);
      expect(result.error).toBe('some string error');
    });
  });

  // ── FILE_WRITE ─────────────────────────────────────────────────────────────

  describe('file:write', () => {
    it('creates directories and writes file successfully', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const result = await ipc.invoke('file:write', '/some/dir/file.txt', 'content');
      expect(result.success).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith('/some/dir', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith('/some/dir/file.txt', 'content', 'utf-8');
    });

    it('returns failure when mkdir fails', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'));

      const result = await ipc.invoke('file:write', '/restricted/file.txt', 'content');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('returns failure when writeFile fails', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Disk full'));

      const result = await ipc.invoke('file:write', '/some/file.txt', 'content');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Disk full');
    });
  });

  // ── FILE_EXISTS ────────────────────────────────────────────────────────────

  describe('file:exists', () => {
    it('returns true when file is accessible', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined as any);

      const result = await ipc.invoke('file:exists', '/existing/file.txt');
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('returns false when file is not accessible', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await ipc.invoke('file:exists', '/nonexistent/file.txt');
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });
  });

  // ── FILE_DELETE ────────────────────────────────────────────────────────────

  describe('file:delete', () => {
    it('deletes file successfully', async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined as any);

      const result = await ipc.invoke('file:delete', '/some/file.txt');
      expect(result.success).toBe(true);
      expect(fs.unlink).toHaveBeenCalledWith('/some/file.txt');
    });

    it('returns failure when file does not exist', async () => {
      const err = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
      vi.mocked(fs.unlink).mockRejectedValue(err);

      const result = await ipc.invoke('file:delete', '/nonexistent.txt');
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });
  });

  // ── JSON_READ ──────────────────────────────────────────────────────────────

  describe('json:read', () => {
    it('reads and parses JSON file successfully', async () => {
      const data = { key: 'value', nested: { num: 42 } };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(data) as any);

      const result = await ipc.invoke('json:read', '/some/config.json');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('returns failure for malformed JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{invalid json' as any);

      const result = await ipc.invoke('json:read', '/some/config.json');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns failure when file does not exist', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readFile).mockRejectedValue(err);

      const result = await ipc.invoke('json:read', '/nonexistent.json');
      expect(result.success).toBe(false);
    });

    it('handles empty JSON object', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{}' as any);

      const result = await ipc.invoke('json:read', '/empty.json');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });
  });

  // ── JSON_WRITE ─────────────────────────────────────────────────────────────

  describe('json:write', () => {
    it('writes JSON with 2-space indentation', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      const data = { key: 'value', arr: [1, 2, 3] };
      const result = await ipc.invoke('json:write', '/some/config.json', data);

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/some/config.json',
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    });

    it('creates parent directories when they do not exist', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined as any);

      await ipc.invoke('json:write', '/nested/dir/config.json', {});
      expect(fs.mkdir).toHaveBeenCalledWith('/nested/dir', { recursive: true });
    });
  });

  // ── DIR_LIST ───────────────────────────────────────────────────────────────

  describe('dir:list', () => {
    it('lists directory contents with file info', async () => {
      const mockEntries = [
        { name: 'file.txt', isDirectory: () => false, isFile: () => true },
        { name: 'subdir', isDirectory: () => true, isFile: () => false },
      ];
      vi.mocked(fs.readdir).mockResolvedValue(mockEntries as any);
      vi.mocked(fs.stat).mockResolvedValue({ size: 100, mtimeMs: 1000 } as any);

      const result = await ipc.invoke('dir:list', '/some/dir');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        name: 'file.txt',
        isFile: true,
        isDirectory: false,
      });
      expect(result.data[1]).toMatchObject({
        name: 'subdir',
        isDirectory: true,
        isFile: false,
      });
    });

    it('returns failure when directory does not exist', async () => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readdir).mockRejectedValue(err);

      const result = await ipc.invoke('dir:list', '/nonexistent');
      expect(result.success).toBe(false);
    });

    it('handles stat errors gracefully for individual entries', async () => {
      const mockEntries = [
        { name: 'file.txt', isDirectory: () => false, isFile: () => true },
      ];
      vi.mocked(fs.readdir).mockResolvedValue(mockEntries as any);
      vi.mocked(fs.stat).mockRejectedValue(new Error('stat error'));

      const result = await ipc.invoke('dir:list', '/some/dir');
      expect(result.success).toBe(true);
      // Entry should still be returned even if stat fails
      expect(result.data[0].name).toBe('file.txt');
      expect(result.data[0].size).toBeUndefined();
      expect(result.data[0].lastModified).toBeUndefined();
    });
  });

  // ── DIR_CREATE ─────────────────────────────────────────────────────────────

  describe('dir:create', () => {
    it('creates directory recursively', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);

      const result = await ipc.invoke('dir:create', '/some/nested/dir');
      expect(result.success).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith('/some/nested/dir', { recursive: true });
    });

    it('returns failure when directory creation fails', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'));

      const result = await ipc.invoke('dir:create', '/restricted');
      expect(result.success).toBe(false);
    });
  });

  // ── DIR_EXISTS ─────────────────────────────────────────────────────────────

  describe('dir:exists', () => {
    it('returns true for an existing directory', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      const result = await ipc.invoke('dir:exists', '/some/dir');
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('returns false for a file path (not a directory)', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);

      const result = await ipc.invoke('dir:exists', '/some/file.txt');
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it('returns false when path does not exist', async () => {
      vi.mocked(fs.stat).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const result = await ipc.invoke('dir:exists', '/nonexistent');
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });
  });
});
