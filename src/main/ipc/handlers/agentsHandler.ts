import { IpcMain } from 'electron';
import path from 'path';
import { IPC_CHANNELS } from '../../../shared/types';
import type { AgentProfile } from '../../../shared/types';
import { success, failure } from './configUtils';

export function getKnownAgents(home: string): AgentProfile[] {
  return [
    {
      id: 'claude-code',
      name: 'Claude Code',
      configDir: path.join(home, '.claude'),
      description: 'Claude Code CLI agent',
      type: 'claude-code',
    },
    {
      id: 'copilot',
      name: 'GitHub Copilot',
      configDir: path.join(home, '.copilot'),
      description: 'GitHub Copilot CLI agent',
      type: 'copilot',
    },
    {
      id: 'gemini',
      name: 'Gemini CLI',
      configDir: path.join(home, '.gemini'),
      description: 'Google Gemini CLI agent',
      type: 'gemini',
    },
    {
      id: 'shared',
      name: 'Shared Skills',
      configDir: path.join(home, '.agents'),
      description: 'Cross-agent shared skills and config',
      type: 'shared',
    },
  ];
}

export function registerAgentsHandler(ipcMain: IpcMain, home: string): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_AGENTS, async () => {
    try {
      return success(getKnownAgents(home));
    } catch (err) {
      return failure(err);
    }
  });
}
