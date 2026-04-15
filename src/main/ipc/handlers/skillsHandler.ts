import { IpcMain } from 'electron';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import { IPC_CHANNELS } from '../../../shared/types';
import type { Skill, SkillFrontmatter } from '../../../shared/types';
import { assertSafePath, assertSafeName, success, failure } from './configUtils';

const execFileAsync = promisify(execFile);

// Parse SKILL.md frontmatter
function parseSkillFrontmatter(content: string): SkillFrontmatter | undefined {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) return undefined;
  try {
    // Simple YAML parser for skill frontmatter (no external deps needed)
    const yaml = match[1];
    const fm: Record<string, unknown> = {};
    const lines = yaml.split('\n');
    let currentKey: string | null = null;
    let arrayItems: string[] = [];

    for (const line of lines) {
      const arrayItemMatch = /^\s{2}-\s+(.+)$/.exec(line);
      const keyValueMatch = /^(\S+):\s*(.*)$/.exec(line);

      if (arrayItemMatch && currentKey) {
        arrayItems.push(arrayItemMatch[1].trim());
        fm[currentKey] = arrayItems;
      } else if (keyValueMatch) {
        if (currentKey && arrayItems.length > 0) {
          fm[currentKey] = arrayItems;
        }
        currentKey = keyValueMatch[1];
        arrayItems = [];
        const val = keyValueMatch[2].trim();
        if (val === 'true') fm[currentKey] = true;
        else if (val === 'false') fm[currentKey] = false;
        else if (val.startsWith('"') && val.endsWith('"')) fm[currentKey] = val.slice(1, -1);
        else if (val !== '') fm[currentKey] = val;
      }
    }
    return fm as unknown as SkillFrontmatter;
  } catch {
    return undefined;
  }
}

// Read a skill from a folder
async function readSkillFolder(folderPath: string, isSymbolicLink?: boolean): Promise<Skill | null> {
  const skillMdPath = path.join(folderPath, 'SKILL.md');
  try {
    const content = await fs.readFile(skillMdPath, 'utf-8');
    const id = path.basename(folderPath);
    const frontmatter = parseSkillFrontmatter(content);
    const name = frontmatter?.name ?? id;
    return {
      id,
      name,
      description: frontmatter?.description,
      version: frontmatter?.version,
      content,
      frontmatter,
      filePath: skillMdPath,
      dirPath: folderPath,
      userInvocable: frontmatter?.['user-invocable'],
      isSymbolicLink,
    };
  } catch {
    return null;
  }
}

export function registerSkillsHandler(ipcMain: IpcMain, _home: string): void {
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_SKILLS,
    async (_event, configDir: string) => {
      try {
        const skillsDir = path.join(configDir, 'skills');
        let entryNames: string[];
        try {
          entryNames = await fs.readdir(skillsDir);
        } catch {
          return success<Skill[]>([]);
        }

        const skills: Skill[] = [];
        for (const entryName of entryNames) {
          const entryPath = path.join(skillsDir, entryName);
          try {
            const lstat = await fs.lstat(entryPath);
            const isSymbolicLink = lstat.isSymbolicLink();

            // If it's a symbolic link, we need to check if the target is a directory
            if (isSymbolicLink) {
              const stat = await fs.stat(entryPath);
              if (!stat.isDirectory()) continue;
            } else if (!lstat.isDirectory()) {
              continue;
            }

            const skill = await readSkillFolder(entryPath, isSymbolicLink);
            if (skill) skills.push(skill);
          } catch {
            continue;
          }
        }

        return success(skills);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE_SKILL,
    async (_event, configDir: string, skill: Skill) => {
      try {
        assertSafeName(skill.id);
        const skillDir = path.join(configDir, 'skills', skill.id);
        const skillPath = path.join(skillDir, 'SKILL.md');
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(skillPath, skill.content, 'utf-8');
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_SKILL,
    async (_event, configDir: string, skillId: string) => {
      try {
        assertSafeName(skillId);
        const skillDir = path.join(configDir, 'skills', skillId);
        await fs.rm(skillDir, { recursive: true, force: true });
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── Skill: link shared skill via symbolic link ──────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.SKILL_LINK_SHARED,
    async (_event, agentConfigDir: string, sharedSkillPath: string, skillId: string) => {
      try {
        assertSafeName(skillId);
        assertSafePath(sharedSkillPath, os.homedir());
        const skillsDir = path.join(agentConfigDir, 'skills');
        await fs.mkdir(skillsDir, { recursive: true });
        const linkPath = path.join(skillsDir, skillId);

        // Check for existing entry
        try {
          const lstat = await fs.lstat(linkPath);
          if (lstat.isSymbolicLink()) {
            const existing = await fs.readlink(linkPath);
            if (path.resolve(existing) === path.resolve(sharedSkillPath)) {
              // Already correctly linked
              return success(undefined);
            }
            // Different symlink — remove and re-create
            await fs.unlink(linkPath);
          } else {
            return failure(new Error(`A real skill named "${skillId}" already exists. Remove it first.`));
          }
        } catch (e) {
          const err = e as NodeJS.ErrnoException;
          if (err.code !== 'ENOENT') throw err;
          // Expected: path doesn't exist yet
        }

        // On Windows use 'junction' for directory symlinks; on others use 'dir'
        const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
        await fs.symlink(sharedSkillPath, linkPath, symlinkType);
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── Skill: install from ZIP archive ───────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.SKILL_INSTALL_ZIP,
    async (_event, agentConfigDir: string, zipFilePath: string) => {
      try {
        const skillsDir = path.join(agentConfigDir, 'skills');
        await fs.mkdir(skillsDir, { recursive: true });

        if (process.platform === 'win32') {
          // Paths are passed via environment variables — never interpolated into the
          // command string — to prevent command injection from renderer-supplied paths.
          const ps1 =
            "$ErrorActionPreference = 'Stop'; " +
            'Expand-Archive -Force -LiteralPath $env:ZIP_SRC -DestinationPath $env:ZIP_DST';
          await execFileAsync(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', ps1],
            { env: { ...process.env, ZIP_SRC: zipFilePath, ZIP_DST: skillsDir } }
          );
        } else {
          await execFileAsync('unzip', ['-o', zipFilePath, '-d', skillsDir]);
        }
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );
}
