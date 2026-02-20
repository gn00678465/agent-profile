import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerDialogHandlers } from '../dialogHandlers';

// Mock electron's dialog module
vi.mock('electron', () => ({
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

import { dialog } from 'electron';

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

describe('dialogHandlers', () => {
  let ipc: ReturnType<typeof createMockIpcMain>;

  beforeEach(() => {
    vi.clearAllMocks();
    ipc = createMockIpcMain();
    registerDialogHandlers(ipc as any);
  });

  // ── DIALOG_OPEN_DIR ────────────────────────────────────────────────────────

  describe('dialog:open-dir', () => {
    it('returns selected directory path when user picks a folder', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/home/user/projects'],
      });

      const result = await ipc.invoke('dialog:open-dir');
      expect(result.success).toBe(true);
      expect(result.data).toBe('/home/user/projects');
    });

    it('returns null when dialog is canceled', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const result = await ipc.invoke('dialog:open-dir');
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('returns null when filePaths is empty even if not canceled', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: [],
      });

      const result = await ipc.invoke('dialog:open-dir');
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('passes defaultPath to showOpenDialog', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/some/path'],
      });

      await ipc.invoke('dialog:open-dir', '/home/user');
      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openDirectory'],
        defaultPath: '/home/user',
      });
    });

    it('calls showOpenDialog with openDirectory property', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/some/path'],
      });

      await ipc.invoke('dialog:open-dir');
      expect(dialog.showOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({ properties: ['openDirectory'] })
      );
    });

    it('returns failure when dialog throws an error', async () => {
      vi.mocked(dialog.showOpenDialog).mockRejectedValue(new Error('Dialog error'));

      const result = await ipc.invoke('dialog:open-dir');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Dialog error');
    });

    it('returns first path when multiple paths returned', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/first/path', '/second/path'],
      });

      const result = await ipc.invoke('dialog:open-dir');
      expect(result.success).toBe(true);
      expect(result.data).toBe('/first/path');
    });
  });

  // ── DIALOG_OPEN_FILE ───────────────────────────────────────────────────────

  describe('dialog:open-file', () => {
    it('returns selected file path when user picks a file', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/home/user/docs/file.md'],
      });

      const result = await ipc.invoke('dialog:open-file');
      expect(result.success).toBe(true);
      expect(result.data).toBe('/home/user/docs/file.md');
    });

    it('returns null when dialog is canceled', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const result = await ipc.invoke('dialog:open-file');
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('passes filters and defaultPath to showOpenDialog', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/some/file.json'],
      });

      const filters = [{ name: 'JSON Files', extensions: ['json'] }];
      await ipc.invoke('dialog:open-file', filters, '/home/user');

      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile'],
        filters,
        defaultPath: '/home/user',
      });
    });

    it('calls showOpenDialog with openFile property', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/some/file.txt'],
      });

      await ipc.invoke('dialog:open-file');
      expect(dialog.showOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({ properties: ['openFile'] })
      );
    });

    it('returns failure when dialog throws an error', async () => {
      vi.mocked(dialog.showOpenDialog).mockRejectedValue(new Error('Access denied'));

      const result = await ipc.invoke('dialog:open-file');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });
  });

  // ── DIALOG_SAVE_FILE ───────────────────────────────────────────────────────

  describe('dialog:save-file', () => {
    it('returns file path when user chooses a save location', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        canceled: false,
        filePath: '/home/user/output.json',
      });

      const result = await ipc.invoke('dialog:save-file');
      expect(result.success).toBe(true);
      expect(result.data).toBe('/home/user/output.json');
    });

    it('returns null when dialog is canceled', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        canceled: true,
        filePath: undefined as unknown as string,
      });

      const result = await ipc.invoke('dialog:save-file');
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('returns null when filePath is undefined', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        canceled: false,
        filePath: undefined as unknown as string,
      });

      const result = await ipc.invoke('dialog:save-file');
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('passes filters and defaultPath to showSaveDialog', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        canceled: false,
        filePath: '/home/user/export.md',
      });

      const filters = [{ name: 'Markdown', extensions: ['md'] }];
      await ipc.invoke('dialog:save-file', filters, '/home/user');

      expect(dialog.showSaveDialog).toHaveBeenCalledWith({
        filters,
        defaultPath: '/home/user',
      });
    });

    it('returns failure when dialog throws an error', async () => {
      vi.mocked(dialog.showSaveDialog).mockRejectedValue(new Error('Save dialog failed'));

      const result = await ipc.invoke('dialog:save-file');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Save dialog failed');
    });
  });
});
