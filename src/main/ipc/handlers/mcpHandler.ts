import { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { IPC_CHANNELS } from '../../../shared/types';
import type { AgentType, McpSettings, ConfigFile } from '../../../shared/types';
import { assertSafePath, success, failure, writeJsonFile } from './configUtils';

export function registerMcpHandler(ipcMain: IpcMain, _home: string): void {
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_MCP,
    async (_event, configDir: string, agentType: AgentType) => {
      try {
        let targetPath: string;
        if (agentType === 'claude-code') {
          targetPath = path.join(os.homedir(), '.claude.json');
        } else if (agentType === 'gemini') {
          targetPath = path.join(configDir, 'settings.json');
        } else {
          targetPath = path.join(configDir, 'mcp-config.json');
        }

        assertSafePath(targetPath, os.homedir());

        let content: string;
        try {
          content = await fs.readFile(targetPath, 'utf-8');
        } catch (err: unknown) {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return success<ConfigFile<McpSettings>>({
              path: targetPath,
              exists: false,
              data: { mcpServers: {} },
            });
          }
          throw err;
        }

        // Abort on malformed JSON — do not silently use empty object
        const parsed = JSON.parse(content) as Record<string, unknown>;
        const mcpServers = (parsed.mcpServers ?? {}) as McpSettings['mcpServers'];
        return success<ConfigFile<McpSettings>>({
          path: targetPath,
          exists: true,
          data: { mcpServers },
        });
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE_MCP,
    async (_event, configDir: string, agentType: AgentType, settings: McpSettings) => {
      try {
        let targetPath: string;
        if (agentType === 'claude-code') {
          targetPath = path.join(os.homedir(), '.claude.json');
        } else if (agentType === 'gemini') {
          targetPath = path.join(configDir, 'settings.json');
        } else {
          targetPath = path.join(configDir, 'mcp-config.json');
        }

        assertSafePath(targetPath, os.homedir());

        // Read existing file — abort on malformed JSON to prevent data loss
        let existing: Record<string, unknown> = {};
        try {
          const content = await fs.readFile(targetPath, 'utf-8');
          existing = JSON.parse(content) as Record<string, unknown>;
        } catch (err: unknown) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            // File exists but is malformed — abort rather than wipe
            throw err;
          }
          // ENOENT: new file, start from empty
        }

        // Preserve all existing keys; update only mcpServers
        const merged = { ...existing, mcpServers: settings.mcpServers };
        await writeJsonFile(targetPath, merged);
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );
}
