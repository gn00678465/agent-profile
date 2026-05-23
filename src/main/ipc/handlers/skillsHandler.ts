import { IpcMain } from 'electron';
import fs from 'fs/promises';
import { execFile, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import path from 'path';
import os from 'os';
import { IPC_CHANNELS } from '../../../shared/types';
import type {
  Skill,
  SkillFrontmatter,
  SkillLinkedBy,
  LinkedByAgentType,
  InstallRegistryOptions,
  InstallRegistryResult,
  SkillLock,
  SkillsCliAgent,
} from '../../../shared/types';
import { assertSafePath, assertSafeName, success, failure } from './configUtils';

const execFileAsync = promisify(execFile);

// ─── Cancellable install-registry process map (CA-06, CA-08, CA-11) ──────────

const installRegistryProcs = new Map<string, ChildProcess>();
const updateRegistryProcs = new Map<string, ChildProcess>();
const removeRegistryProcs = new Map<string, ChildProcess>();

const SHELL_METACHAR_OR_WS = /[;|&$`\s]/;

/** Two-sided validator — same rules as renderer-side. */
function validateRegistryInput(input: string): string | null {
  if (!input || !input.trim()) return 'Input is required';
  if (input.length > 500) return 'Input exceeds 500 chars';
  if (SHELL_METACHAR_OR_WS.test(input)) return 'Input contains forbidden characters';
  return null;
}

/** Non-shared agent types whose skills/ folder may contain symlinks pointing to shared skills. */
const LINKED_BY_AGENT_TYPES: readonly LinkedByAgentType[] = [
  'claude-code',
  'claude-desktop',
  'gemini',
  'copilot',
];

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

/**
 * Resolve the home-relative config directories for non-shared agents. Each agent's
 * actual configDir comes from getAgents(); for the linked-by reverse scan we list
 * candidate dirs based on the standard layout: `<home>/<agent-dir>/skills/`.
 * The shared skills dir is fixed at `<home>/.agents/skills`.
 */
function defaultAgentSkillsDirs(home: string): Record<LinkedByAgentType, string[]> {
  return {
    'claude-code': [path.join(home, '.claude', 'skills')],
    'claude-desktop': [path.join(home, 'Library', 'Application Support', 'Claude', 'skills')],
    gemini: [path.join(home, '.gemini', 'skills')],
    copilot: [path.join(home, '.copilot', 'skills'), path.join(home, '.config', 'copilot', 'skills')],
  };
}

export function registerSkillsHandler(ipcMain: IpcMain, home: string): void {
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

  // ── Skill: install from registry via `npx skills add <input>` ───────────
  // AC-5..9, CA-08, CA-10, CA-11

  ipcMain.handle(
    IPC_CHANNELS.SKILL_INSTALL_REGISTRY,
    async (event, sharedConfigDir: string, input: string, options: InstallRegistryOptions) => {
      const validation = validateRegistryInput(input);
      if (validation) return failure(new Error(validation));

      // Validate options
      const ALLOWED_AGENTS: readonly SkillsCliAgent[] = ['claude-code', 'github-copilot', 'antigravity'];
      const agents = Array.isArray(options?.agents) ? options.agents : [];
      for (const a of agents) {
        if (!ALLOWED_AGENTS.includes(a)) {
          return failure(new Error(`Invalid agent: ${a}`));
        }
      }
      const skillFilter = (options?.skill ?? '').trim();
      if (skillFilter && skillFilter !== '*' && !/^[\w.,*-]+$/.test(skillFilter)) {
        return failure(new Error('Invalid --skill value: only alphanumerics, dot, hyphen, underscore, comma, and asterisk allowed'));
      }

      // Local-path branch: additional path-safety check
      if (input.startsWith('./') || input.startsWith('/') || input.startsWith('~')) {
        try {
          const resolved = input.startsWith('~')
            ? path.join(home, input.slice(1))
            : path.resolve(input);
          assertSafePath(resolved, home);
        } catch (err) {
          return failure(err);
        }
      }

      // The `skills` CLI installs files to ~/.agents/skills/<name> (universal /
      // shared pool) and creates symlinks back from each agent's own dir for
      // every `-a <name>` flag. We don't need a tmpdir + copy dance — the CLI
      // already places the canonical files in the right location.
      const sharedSkillsDir = path.join(sharedConfigDir, 'skills');
      try {
        await fs.mkdir(sharedSkillsDir, { recursive: true });
      } catch (err) {
        return failure(err);
      }

      // Build CLI args: `skills add <input> -a X -a Y --yes [--skill <filter>]`
      const args = ['skills', 'add', input];
      for (const a of agents) args.push('-a', a);
      args.push('--yes');
      if (skillFilter && skillFilter !== '*') args.push('--skill', skillFilter);

      const augmentedEnv = {
        ...process.env,
        PATH: ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', process.env.PATH ?? '']
          .filter(Boolean)
          .join(':'),
      };

      const requestId = randomUUID();

      // The CLI creates its universal pool at `<cwd>/.agents/skills/`. Setting
      // cwd to sharedConfigDir itself produces a nested `<sharedConfigDir>/.agents/skills/`
      // which is wrong. cwd must be the PARENT of sharedConfigDir (e.g. `$HOME`)
      // so the CLI's `<cwd>/.agents/skills/` resolves to sharedConfigDir itself.
      const cliCwd = path.dirname(sharedConfigDir);

      try {
        const child = spawn('npx', args, {
          cwd: cliCwd,
          timeout: 90_000,
          env: augmentedEnv,
        });
        installRegistryProcs.set(requestId, child);

        // CA-08: early-emit `:started` so renderer can cancel before completion.
        event.sender.send(IPC_CHANNELS.SKILL_INSTALL_REGISTRY_STARTED, { requestId });

        const cliResult = await new Promise<InstallRegistryResult>((resolve, reject) => {
          let stdout = '';
          let stderr = '';
          child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf-8'); });
          child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf-8'); });
          child.on('error', (err) => {
            installRegistryProcs.delete(requestId);
            reject(err);
          });
          child.on('close', (code, signal) => {
            installRegistryProcs.delete(requestId);
            resolve({ requestId, stdout, stderr, exitCode: code ?? (signal ? -1 : 0) });
          });
        });

        return success(cliResult);
      } catch (err) {
        installRegistryProcs.delete(requestId);
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SKILL_INSTALL_REGISTRY_CANCEL,
    async (_event, requestId: string) => {
      const child = installRegistryProcs.get(requestId);
      if (!child) return failure(new Error('unknown requestId'));

      try {
        child.kill('SIGTERM');
        // CA-11: escalate to SIGKILL after 1500 ms if the child has not exited.
        const escalationTimer = setTimeout(() => {
          if (installRegistryProcs.has(requestId)) {
            try { child.kill('SIGKILL'); } catch { /* already gone */ }
          }
        }, 1500);
        // Best-effort: clear the timer when the process eventually closes.
        child.once('close', () => clearTimeout(escalationTimer));
        return success({ killed: true });
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── Skill: import an existing folder ─────────────────────────────────────
  // AC-10

  ipcMain.handle(
    IPC_CHANNELS.SKILL_IMPORT_FOLDER,
    async (_event, sharedConfigDir: string, sourcePath: string) => {
      try {
        assertSafePath(sourcePath, home);
        const skillMd = path.join(sourcePath, 'SKILL.md');
        try {
          await fs.access(skillMd);
        } catch {
          return failure(new Error('Source folder must contain a SKILL.md file'));
        }

        const skillsDir = path.join(sharedConfigDir, 'skills');
        await fs.mkdir(skillsDir, { recursive: true });
        const basename = path.basename(sourcePath);
        assertSafeName(basename);
        const dest = path.join(skillsDir, basename);

        try {
          await fs.access(dest);
          return failure(new Error(`Destination "${basename}" already exists`));
        } catch {
          // expected: dest does not exist
        }

        await fs.cp(sourcePath, dest, { recursive: true });
        return success({ skillId: basename });
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── Skill: reverse-link scan — which agents linked each shared skill ─────
  // AC-11

  ipcMain.handle(
    IPC_CHANNELS.SKILL_GET_LINKED_BY,
    async (_event, sharedConfigDir: string) => {
      try {
        const sharedSkillsDir = path.join(sharedConfigDir, 'skills');
        let sharedNames: string[];
        try {
          sharedNames = await fs.readdir(sharedSkillsDir);
        } catch {
          return success<SkillLinkedBy[]>([]);
        }
        const sharedAbs = new Map<string, string>();
        for (const name of sharedNames) {
          sharedAbs.set(path.resolve(sharedSkillsDir, name), name);
        }

        const result = new Map<string, Set<LinkedByAgentType>>();
        for (const name of sharedNames) result.set(name, new Set());

        const candidatesByAgent = defaultAgentSkillsDirs(home);
        for (const agentType of LINKED_BY_AGENT_TYPES) {
          for (const agentSkillsDir of candidatesByAgent[agentType]) {
            let entries: string[];
            try {
              entries = await fs.readdir(agentSkillsDir);
            } catch {
              continue;
            }
            for (const entry of entries) {
              const entryPath = path.join(agentSkillsDir, entry);
              try {
                const lstat = await fs.lstat(entryPath);
                if (!lstat.isSymbolicLink()) continue;
                const target = await fs.readlink(entryPath);
                const resolvedTarget = path.isAbsolute(target)
                  ? path.resolve(target)
                  : path.resolve(agentSkillsDir, target);
                const sharedSkillId = sharedAbs.get(resolvedTarget);
                if (sharedSkillId) {
                  result.get(sharedSkillId)?.add(agentType);
                }
              } catch {
                continue;
              }
            }
          }
        }

        const aggregated: SkillLinkedBy[] = [];
        for (const [skillId, agents] of result.entries()) {
          aggregated.push({ skillId, agents: Array.from(agents).sort() });
        }
        return success(aggregated);
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── Skill: update installed skills via `npx skills update [ids...]` ─────
  // CA-08, CA-11

  ipcMain.handle(
    IPC_CHANNELS.SKILL_UPDATE_REGISTRY,
    async (event, sharedConfigDir: string, skillIds: string[]) => {
      try {
        assertSafePath(sharedConfigDir, home);
      } catch (err) {
        return failure(err);
      }
      const ids = Array.isArray(skillIds) ? skillIds : [];
      for (const id of ids) {
        try {
          assertSafeName(id);
        } catch (err) {
          return failure(err);
        }
      }

      const augmentedEnv = {
        ...process.env,
        PATH: ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', process.env.PATH ?? '']
          .filter(Boolean)
          .join(':'),
      };

      const requestId = randomUUID();
      // Same cwd reasoning as install: the CLI looks at `<cwd>/.agents/skills/`
      // for tracked skills, so cwd must be the PARENT of sharedConfigDir.
      const cliCwd = path.dirname(sharedConfigDir);
      try {
        const args = ['skills', 'update', ...ids, '--yes'];
        const child = spawn('npx', args, {
          cwd: cliCwd,
          timeout: 90_000,
          env: augmentedEnv,
        });
        updateRegistryProcs.set(requestId, child);
        event.sender.send(IPC_CHANNELS.SKILL_UPDATE_REGISTRY_STARTED, { requestId });

        const result = await new Promise<InstallRegistryResult>((resolve, reject) => {
          let stdout = '';
          let stderr = '';
          child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf-8'); });
          child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf-8'); });
          child.on('error', (err) => {
            updateRegistryProcs.delete(requestId);
            reject(err);
          });
          child.on('close', (code, signal) => {
            updateRegistryProcs.delete(requestId);
            resolve({ requestId, stdout, stderr, exitCode: code ?? (signal ? -1 : 0) });
          });
        });

        return success(result);
      } catch (err) {
        updateRegistryProcs.delete(requestId);
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SKILL_UPDATE_REGISTRY_CANCEL,
    async (_event, requestId: string) => {
      const child = updateRegistryProcs.get(requestId);
      if (!child) return failure(new Error('unknown requestId'));
      try {
        child.kill('SIGTERM');
        const escalationTimer = setTimeout(() => {
          if (updateRegistryProcs.has(requestId)) {
            try { child.kill('SIGKILL'); } catch { /* already gone */ }
          }
        }, 1500);
        child.once('close', () => clearTimeout(escalationTimer));
        return success({ killed: true });
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── Skill: remove lock-tracked skill via `npx skills remove <id>` ────────
  // Use this when a skill has a `.skill-lock.json` entry so the CLI can also
  // remove cross-agent symlinks and update the lockfile. For skills without
  // lock entries, the page should use the existing config:delete-skill
  // handler which just unlinks the directory.

  ipcMain.handle(
    IPC_CHANNELS.SKILL_REMOVE_REGISTRY,
    async (event, sharedConfigDir: string, skillIds: string[]) => {
      try {
        assertSafePath(sharedConfigDir, home);
      } catch (err) {
        return failure(err);
      }
      const ids = Array.isArray(skillIds) ? skillIds : [];
      if (ids.length === 0) {
        return failure(new Error('At least one skill ID is required'));
      }
      for (const id of ids) {
        try {
          assertSafeName(id);
        } catch (err) {
          return failure(err);
        }
      }

      const augmentedEnv = {
        ...process.env,
        PATH: ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', process.env.PATH ?? '']
          .filter(Boolean)
          .join(':'),
      };

      const requestId = randomUUID();
      // Same cwd reasoning as install/update: CLI scopes its universal pool
      // to `<cwd>/.agents/skills/`, so cwd must be the parent of sharedConfigDir.
      const cliCwd = path.dirname(sharedConfigDir);
      try {
        const args = ['skills', 'remove', ...ids, '--yes'];
        const child = spawn('npx', args, {
          cwd: cliCwd,
          timeout: 90_000,
          env: augmentedEnv,
        });
        removeRegistryProcs.set(requestId, child);
        event.sender.send(IPC_CHANNELS.SKILL_REMOVE_REGISTRY_STARTED, { requestId });

        const result = await new Promise<InstallRegistryResult>((resolve, reject) => {
          let stdout = '';
          let stderr = '';
          child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf-8'); });
          child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf-8'); });
          child.on('error', (err) => {
            removeRegistryProcs.delete(requestId);
            reject(err);
          });
          child.on('close', (code, signal) => {
            removeRegistryProcs.delete(requestId);
            resolve({ requestId, stdout, stderr, exitCode: code ?? (signal ? -1 : 0) });
          });
        });

        return success(result);
      } catch (err) {
        removeRegistryProcs.delete(requestId);
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SKILL_REMOVE_REGISTRY_CANCEL,
    async (_event, requestId: string) => {
      const child = removeRegistryProcs.get(requestId);
      if (!child) return failure(new Error('unknown requestId'));
      try {
        child.kill('SIGTERM');
        const escalationTimer = setTimeout(() => {
          if (removeRegistryProcs.has(requestId)) {
            try { child.kill('SIGKILL'); } catch { /* already gone */ }
          }
        }, 1500);
        child.once('close', () => clearTimeout(escalationTimer));
        return success({ killed: true });
      } catch (err) {
        return failure(err);
      }
    }
  );

  // ── Skill: parse <sharedConfigDir>/.skill-lock.json ──────────────────────
  // Returned when the file is missing OR malformed:
  //   success(null)  — caller treats it as "no lock data"

  ipcMain.handle(
    IPC_CHANNELS.SKILL_GET_LOCK,
    async (_event, sharedConfigDir: string) => {
      try {
        assertSafePath(sharedConfigDir, home);
        // The CLI's lockfile filename has varied across versions:
        //   - `.skill-lock.json` (dotted, current — v3 schema)
        //   - `skills-lock.json` (no dot, older or transitional builds)
        // Try the current name first, fall back to the legacy one so the page
        // populates source badges regardless of which CLI version installed
        // the skill.
        const lockCandidates = [
          path.join(sharedConfigDir, '.skill-lock.json'),
          path.join(sharedConfigDir, 'skills-lock.json'),
        ];
        let raw: string | null = null;
        for (const candidate of lockCandidates) {
          try {
            raw = await fs.readFile(candidate, 'utf-8');
            break;
          } catch (e) {
            const err = e as NodeJS.ErrnoException;
            if (err.code !== 'ENOENT') throw err;
          }
        }
        if (raw === null) return success<SkillLock | null>(null);
        try {
          const parsed = JSON.parse(raw) as SkillLock;
          if (!parsed || typeof parsed !== 'object' || typeof parsed.skills !== 'object') {
            return success<SkillLock | null>(null);
          }
          return success<SkillLock>(parsed);
        } catch {
          // Malformed JSON — treat as no lock data rather than failing the page.
          return success<SkillLock | null>(null);
        }
      } catch (err) {
        return failure(err);
      }
    }
  );
}
