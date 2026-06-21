import { IpcMain } from 'electron';
import os from 'os';
import { registerAgentsHandler } from './handlers/agentsHandler';
import { registerClaudeHandler } from './handlers/claudeHandler';
import { registerClaudePluginsHandler } from './handlers/claudePluginsHandler';
import { registerCodexPluginsHandler } from './handlers/codexPluginsHandler';
import { registerGeminiHandler } from './handlers/geminiHandler';
import { registerCopilotHandler } from './handlers/copilotHandler';
import { registerMcpHandler } from './handlers/mcpHandler';
import { registerSkillsHandler } from './handlers/skillsHandler';
import { registerRulesHandler } from './handlers/rulesHandler';
import { registerMarkdownHandler } from './handlers/markdownHandler';

export function registerConfigHandlers(ipcMain: IpcMain): void {
  const home = os.homedir();
  registerAgentsHandler(ipcMain, home);
  registerClaudeHandler(ipcMain, home);
  registerClaudePluginsHandler(ipcMain, home);
  registerCodexPluginsHandler(ipcMain, home);
  registerGeminiHandler(ipcMain, home);
  registerCopilotHandler(ipcMain, home);
  registerMcpHandler(ipcMain, home);
  registerSkillsHandler(ipcMain, home);
  registerRulesHandler(ipcMain, home);
  registerMarkdownHandler(ipcMain, home);
}
