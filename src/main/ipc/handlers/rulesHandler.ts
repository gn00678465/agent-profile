import { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { IPC_CHANNELS } from '../../../shared/types';
import type { RuleFile } from '../../../shared/types';
import { assertSafePath, assertSafeName, success, failure } from './configUtils';

/**
 * Parses a renderer-supplied rule path like `folder/rule.md` or `rule.md`.
 * Validates that it is at most one level deep and contains no traversal.
 * Returns { folder, fileName } where folder is null for top-level files.
 */
function parseRulePath(rulePath: string): { folder: string | null; fileName: string } {
  if (!rulePath || rulePath.trim() === '') {
    throw new Error('Invalid rule path: empty');
  }
  const parts = rulePath.split('/');
  if (parts.length > 2) {
    throw new Error('Invalid rule path: only one folder level is supported');
  }
  for (const part of parts) {
    if (!part || part === '..' || part.includes('..') || /[\\]/.test(part)) {
      throw new Error(`Invalid rule path component: "${part}"`);
    }
  }
  if (parts.length === 2) {
    return { folder: parts[0], fileName: parts[1] };
  }
  return { folder: null, fileName: parts[0] };
}

/**
 * Creates an empty rule file within configDir/rules/.
 * Shared logic used by CONFIG_CREATE_RULE.
 * Returns the absolute path of the created file.
 */
async function createRuleFile(
  configDir: string,
  rulePath: string,
  knownConfigDirs: string[]
): Promise<string> {
  const resolved = path.resolve(configDir);
  if (!knownConfigDirs.some((d) => path.resolve(d) === resolved)) {
    throw new Error('Access denied: unknown config directory');
  }
  const { folder, fileName } = parseRulePath(rulePath);
  const rulesDir = path.join(configDir, 'rules');
  const targetDir = folder ? path.join(rulesDir, folder) : rulesDir;
  const filePath = path.join(targetDir, fileName);
  assertSafePath(filePath, os.homedir());
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(filePath, '', 'utf-8');
  return filePath;
}

export function registerRulesHandler(ipcMain: IpcMain, home: string): void {
  const knownConfigDirs = [
    path.join(home, '.claude'),
    path.join(home, '.gemini'),
    path.join(home, '.copilot'),
    path.join(home, '.agents'),
  ];

  function assertKnownConfigDir(configDir: string): void {
    const resolved = path.resolve(configDir);
    if (!knownConfigDirs.some((d) => path.resolve(d) === resolved)) {
      throw new Error('Access denied: unknown config directory');
    }
  }

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_CREATE_RULE,
    async (_event, configDir: string, rulePath: string) => {
      try {
        const filePath = await createRuleFile(configDir, rulePath, knownConfigDirs);
        return success(filePath);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_RULE_FOLDER,
    async (_event, configDir: string, folderName: string) => {
      try {
        assertKnownConfigDir(configDir);
        assertSafeName(folderName);
        const folderPath = path.join(configDir, 'rules', folderName);
        assertSafePath(folderPath, os.homedir());
        await fs.rm(folderPath, { recursive: true, force: true });
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_RULES,
    async (_event, configDir: string) => {
      try {
        const rulesDir = path.join(configDir, 'rules');
        const rules: RuleFile[] = [];

        let topEntries: string[] = [];
        try {
          topEntries = await fs.readdir(rulesDir);
        } catch {
          return success<RuleFile[]>([]);
        }

        for (const topName of topEntries) {
          const topPath = path.join(rulesDir, topName);
          let topStat;
          try { topStat = await fs.stat(topPath); } catch { continue; }

          if (topStat.isDirectory()) {
            // Folder — list .md files inside
            let subEntries: string[] = [];
            try { subEntries = await fs.readdir(topPath); } catch { continue; }
            for (const subName of subEntries) {
              if (!subName.endsWith('.md')) continue;
              const filePath = path.join(topPath, subName);
              try {
                const s = await fs.stat(filePath);
                if (!s.isFile()) continue;
              } catch { continue; }
              rules.push({
                id: `${topName}/${subName.slice(0, -3)}`,
                folder: topName,
                name: subName,
                path: filePath,
              });
            }
          } else if (topStat.isFile() && topName.endsWith('.md')) {
            // Top-level .md file
            rules.push({
              id: topName.slice(0, -3),
              folder: '',
              name: topName,
              path: topPath,
            });
          }
        }

        return success(rules);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE_RULE,
    async (_event, filePath: string, content: string) => {
      try {
        assertSafePath(filePath, os.homedir());
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_RULE,
    async (_event, filePath: string) => {
      try {
        assertSafePath(filePath, os.homedir());
        await fs.unlink(filePath);
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_RENAME_RULE,
    async (_event, filePath: string, newName: string) => {
      try {
        assertSafePath(filePath, os.homedir());
        assertSafeName(newName);
        if (!newName.endsWith('.md')) {
          throw new Error('Rule name must end with .md');
        }
        const newPath = path.join(path.dirname(filePath), newName);
        assertSafePath(newPath, os.homedir());
        await fs.rename(filePath, newPath);
        return success(newPath);
      } catch (err) {
        return failure(err);
      }
    }
  );
}
