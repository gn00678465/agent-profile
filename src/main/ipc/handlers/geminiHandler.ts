import { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { IPC_CHANNELS } from '../../../shared/types';
import type {
  GeminiSettings,
  GeminiExtension,
  GeminiExtensionEnablement,
  GeminiSessionEntry,
  GeminiSessionMessage,
} from '../../../shared/types';
import { assertSafePath, assertSafeName, success, failure, readJsonFile, writeJsonFile, formatGeminiSessionName } from './configUtils';

export function registerGeminiHandler(ipcMain: IpcMain, _home: string): void {
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_GEMINI_SETTINGS,
    async (_event, configDir: string) => {
      try {
        const settingsPath = path.join(configDir, 'settings.json');
        const result = await readJsonFile<GeminiSettings>(settingsPath);
        return success(result);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE_GEMINI_SETTINGS,
    async (_event, configDir: string, settings: GeminiSettings) => {
      try {
        await writeJsonFile(path.join(configDir, 'settings.json'), settings);
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // Gemini extensions
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_GEMINI_EXTENSIONS,
    async (_event, configDir: string) => {
      try {
        const extensionsDir = path.join(configDir, 'extensions');
        const enablementPath = path.join(extensionsDir, 'extension-enablement.json');

        let entryNames: string[] = [];
        try {
          entryNames = await fs.readdir(extensionsDir);
        } catch {
          return success({ extensions: [], enablement: {} });
        }

        const [enablementResult] = await Promise.all([
          readJsonFile<GeminiExtensionEnablement>(enablementPath),
        ]);

        const extensions: Array<GeminiExtension & { name: string; enabled: boolean }> = [];
        for (const entryName of entryNames) {
          const entryPath = path.join(extensionsDir, entryName);
          try {
            const stat = await fs.stat(entryPath);
            if (!stat.isDirectory()) continue;
          } catch {
            continue;
          }
          const manifestPath = path.join(entryPath, 'gemini-extension.json');
          const manifest = await readJsonFile<GeminiExtension>(manifestPath);
          if (manifest.data) {
            const enablement = enablementResult.data ?? {};
            extensions.push({
              ...manifest.data,
              name: entryName,
              enabled: entryName in enablement,
            });
          }
        }

        return success({
          extensions,
          enablement: enablementResult.data ?? {},
        });
      } catch (err) {
        return failure(err);
      }
    }
  );

  // Delete a Gemini extension (remove enablement entry + extension folder)
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_GEMINI_EXTENSION,
    async (_event, configDir: string, extensionName: string) => {
      try {
        assertSafeName(extensionName);
        const extensionsDir = path.join(configDir, 'extensions');

        // 1. Remove from extension-enablement.json
        const enablementPath = path.join(extensionsDir, 'extension-enablement.json');
        const enablementResult = await readJsonFile<GeminiExtensionEnablement>(enablementPath);
        if (enablementResult.data && extensionName in enablementResult.data) {
          const updated = Object.fromEntries(
            Object.entries(enablementResult.data).filter(([k]) => k !== extensionName)
          );
          await writeJsonFile(enablementPath, updated);
        }

        // 2. Remove the extension folder
        const extPath = path.join(extensionsDir, extensionName);
        await fs.rm(extPath, { recursive: true, force: true });

        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_GEMINI_SESSIONS,
    async (_event, configDir: string) => {
      try {
        assertSafePath(configDir, os.homedir());

        const sessions: GeminiSessionEntry[] = [];

        const scanDir = async (baseDir: string) => {
          let hashDirs: string[];
          try {
            hashDirs = await fs.readdir(baseDir);
          } catch {
            return;
          }
          for (const hashDir of hashDirs) {
            const chatsDir = path.join(baseDir, hashDir, 'chats');
            let chatFiles: string[];
            try {
              chatFiles = await fs.readdir(chatsDir);
            } catch {
              continue;
            }
            for (const chatFile of chatFiles) {
              if (!chatFile.endsWith('.json')) continue;
              const filePath = path.join(chatsDir, chatFile);
              try {
                const content = await fs.readFile(filePath, 'utf-8');
                const json = JSON.parse(content) as {
                  sessionId?: string;
                  projectHash?: string;
                  startTime?: string;
                  lastUpdated?: string;
                  messages?: unknown[];
                };
                const stat = await fs.stat(filePath);
                if (!json.sessionId || !json.startTime) continue;
                sessions.push({
                  id: json.sessionId,
                  name: formatGeminiSessionName(json.startTime),
                  path: filePath,
                  type: 'hash',
                  agentType: 'gemini',
                  lastModified: stat.mtimeMs,
                  sessionId: json.sessionId,
                  projectHash: json.projectHash ?? hashDir,
                  startTime: json.startTime,
                  lastUpdated: json.lastUpdated ?? json.startTime,
                  messageCount: json.messages?.length ?? 0,
                });
              } catch {
                // skip malformed files
              }
            }
          }
        };

        await scanDir(path.join(configDir, 'tmp'));
        await scanDir(path.join(configDir, 'history'));

        sessions.sort((a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );

        return success(sessions);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_GEMINI_SESSION_MESSAGES,
    async (_event, filePath: string) => {
      try {
        assertSafePath(filePath, os.homedir());
        const content = await fs.readFile(filePath, 'utf-8');
        const json = JSON.parse(content) as { messages?: Array<Record<string, unknown>> };
        const rawMessages = json.messages ?? [];
        // Normalize content to string — Gemini CLI emits several shapes:
        //   "string"                  → use as-is
        //   { text: "..." }           → extract .text
        //   [{ text: "..." }, ...]    → join all .text values
        const normalizeContent = (raw: unknown): string => {
          if (typeof raw === 'string') return raw;
          if (Array.isArray(raw)) {
            return raw
              .map((item) =>
                item && typeof item === 'object' && 'text' in item
                  ? String((item as { text: unknown }).text ?? '')
                  : String(item ?? '')
              )
              .join('');
          }
          if (raw && typeof raw === 'object' && 'text' in raw) {
            return String((raw as { text: unknown }).text ?? '');
          }
          return String(raw ?? '');
        };
        const normalized: GeminiSessionMessage[] = rawMessages.map((msg) => ({
          ...(msg as GeminiSessionMessage),
          content: normalizeContent(msg.content),
        }));
        const MAX_MESSAGES = 500;
        const result = normalized.length > MAX_MESSAGES ? normalized.slice(normalized.length - MAX_MESSAGES) : normalized;
        return success(result);
      } catch (err) {
        return failure(err);
      }
    }
  );
}
