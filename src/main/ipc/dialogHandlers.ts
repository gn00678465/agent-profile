import { IpcMain, dialog } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { IpcResponse } from '../../shared/types';

function success<T>(data: T): IpcResponse<T> {
  return { success: true, data };
}

function failure(error: unknown): IpcResponse<never> {
  const message = error instanceof Error ? error.message : String(error);
  return { success: false, error: message };
}

export function registerDialogHandlers(ipcMain: IpcMain) {
  // Open directory picker
  ipcMain.handle(
    IPC_CHANNELS.DIALOG_OPEN_DIR,
    async (_event, defaultPath?: string) => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory'],
          defaultPath,
        });
        if (result.canceled || result.filePaths.length === 0) {
          return success(null);
        }
        return success(result.filePaths[0]);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // Open file picker
  ipcMain.handle(
    IPC_CHANNELS.DIALOG_OPEN_FILE,
    async (_event, filters?: Electron.FileFilter[], defaultPath?: string) => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openFile'],
          filters,
          defaultPath,
        });
        if (result.canceled || result.filePaths.length === 0) {
          return success(null);
        }
        return success(result.filePaths[0]);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // Save file picker
  ipcMain.handle(
    IPC_CHANNELS.DIALOG_SAVE_FILE,
    async (_event, filters?: Electron.FileFilter[], defaultPath?: string) => {
      try {
        const result = await dialog.showSaveDialog({
          filters,
          defaultPath,
        });
        if (result.canceled || !result.filePath) {
          return success(null);
        }
        return success(result.filePath);
      } catch (err) {
        return failure(err);
      }
    }
  );
}
