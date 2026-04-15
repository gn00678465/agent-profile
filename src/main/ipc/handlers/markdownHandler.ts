import { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC_CHANNELS } from '../../../shared/types';
import type { ConfigFile } from '../../../shared/types';
import { success, failure } from './configUtils';

export function registerMarkdownHandler(ipcMain: IpcMain, _home: string): void {
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_MARKDOWN,
    async (_event, filePath: string) => {
      try {
        let content: string | null = null;
        let exists = false;
        try {
          content = await fs.readFile(filePath, 'utf-8');
          exists = true;
        } catch {
          // File doesn't exist
        }
        return success<ConfigFile<string>>({ path: filePath, exists, data: content });
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE_MARKDOWN,
    async (_event, filePath: string, content: string) => {
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );
}
