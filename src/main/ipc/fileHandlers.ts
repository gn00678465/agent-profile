import { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC_CHANNELS } from '../../shared/types';
import type { IpcResponse, DirectoryEntry } from '../../shared/types';

function success<T>(data: T): IpcResponse<T> {
  return { success: true, data };
}

function failure(error: unknown): IpcResponse<never> {
  const message = error instanceof Error ? error.message : String(error);
  return { success: false, error: message };
}

export function registerFileHandlers(ipcMain: IpcMain) {
  // Read a file as text
  ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return success(content);
    } catch (err) {
      return failure(err);
    }
  });

  // Write text to a file (creates directories if needed)
  ipcMain.handle(IPC_CHANNELS.FILE_WRITE, async (_event, filePath: string, content: string) => {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return success(undefined);
    } catch (err) {
      return failure(err);
    }
  });

  // Check if a file exists
  ipcMain.handle(IPC_CHANNELS.FILE_EXISTS, async (_event, filePath: string) => {
    try {
      await fs.access(filePath);
      return success(true);
    } catch {
      return success(false);
    }
  });

  // Delete a file
  ipcMain.handle(IPC_CHANNELS.FILE_DELETE, async (_event, filePath: string) => {
    try {
      await fs.unlink(filePath);
      return success(undefined);
    } catch (err) {
      return failure(err);
    }
  });

  // Read JSON file
  ipcMain.handle(IPC_CHANNELS.JSON_READ, async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as unknown;
      return success(data);
    } catch (err) {
      return failure(err);
    }
  });

  // Write JSON file
  ipcMain.handle(IPC_CHANNELS.JSON_WRITE, async (_event, filePath: string, data: unknown) => {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, content, 'utf-8');
      return success(undefined);
    } catch (err) {
      return failure(err);
    }
  });

  // List directory contents
  ipcMain.handle(IPC_CHANNELS.DIR_LIST, async (_event, dirPath: string) => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const result: DirectoryEntry[] = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(dirPath, entry.name);
          let size: number | undefined;
          let lastModified: number | undefined;
          try {
            const stat = await fs.stat(fullPath);
            size = stat.size;
            lastModified = stat.mtimeMs;
          } catch {
            // ignore stat errors
          }
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            size,
            lastModified,
          };
        })
      );
      return success(result);
    } catch (err) {
      return failure(err);
    }
  });

  // Create directory
  ipcMain.handle(IPC_CHANNELS.DIR_CREATE, async (_event, dirPath: string) => {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return success(undefined);
    } catch (err) {
      return failure(err);
    }
  });

  // Check if directory exists
  ipcMain.handle(IPC_CHANNELS.DIR_EXISTS, async (_event, dirPath: string) => {
    try {
      const stat = await fs.stat(dirPath);
      return success(stat.isDirectory());
    } catch {
      return success(false);
    }
  });
}
