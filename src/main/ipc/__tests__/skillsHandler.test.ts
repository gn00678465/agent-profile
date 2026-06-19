import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { EventEmitter } from 'events';
import { registerSkillsHandler } from '../handlers/skillsHandler';

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('os', () => ({ default: { homedir: vi.fn(() => '/home/testuser'), tmpdir: vi.fn(() => '/tmp') } }));

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    mkdtemp: vi.fn(async (prefix: string) => `${prefix}mock-tmp`),
    readdir: vi.fn(),
    stat: vi.fn(),
    lstat: vi.fn(),
    unlink: vi.fn(),
    rm: vi.fn(),
    access: vi.fn(),
    readlink: vi.fn(),
    cp: vi.fn(),
    symlink: vi.fn(),
  },
}));

// Track spawn calls
const spawnCalls: Array<{ cmd: string; args: string[]; opts: unknown; child: FakeChild }> = [];
class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  killSignal: NodeJS.Signals | null = null;
  kill(sig?: NodeJS.Signals) {
    this.killed = true;
    this.killSignal = sig ?? 'SIGTERM';
    return true;
  }
}
vi.mock('child_process', () => ({
  spawn: vi.fn((cmd: string, args: string[], opts: unknown) => {
    const child = new FakeChild();
    spawnCalls.push({ cmd, args, opts, child });
    return child as unknown;
  }),
  execFile: vi.fn(),
}));

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'mock-uuid-1234'),
}));

// ─── IpcMain stub ────────────────────────────────────────────────────────────
function createMockIpcMain() {
  const handlers: Record<string, Function> = {};
  return {
    handle: (channel: string, fn: Function) => { handlers[channel] = fn; },
    invoke: async (channel: string, ...args: unknown[]) => {
      const h = handlers[channel];
      if (!h) throw new Error(`No handler: ${channel}`);
      // Provide a stub `event` with sender.send capturing emitted events
      const sent: Array<{ channel: string; payload: unknown }> = [];
      const event = { sender: { send: (ch: string, payload: unknown) => sent.push({ channel: ch, payload }) } };
      const r = await h(event, ...args);
      return { result: r, sent };
    },
    handlers,
  };
}

import fs from 'fs/promises';
import { spawn } from 'child_process';

describe('skillsHandler', () => {
  let ipc: ReturnType<typeof createMockIpcMain>;
  const HOME = '/home/testuser';

  beforeEach(() => {
    vi.clearAllMocks();
    spawnCalls.length = 0;
    // Re-arm mkdtemp default after clearAllMocks (preserves impl, but defensive)
    (fs.mkdtemp as any).mockImplementation(async (prefix: string) => `${prefix}mock-tmp`);
    ipc = createMockIpcMain();
    registerSkillsHandler(ipc as any, HOME);
  });
  afterEach(() => { vi.useRealTimers(); });

  // ─── skill:install-registry — validation ─────────────────────────────────

  describe('skill:install-registry — validation (AC-6)', () => {
    it.each([
      ['', 'Input is required'],
      ['   ', 'Input is required'],
      ['a'.repeat(501), 'Input exceeds 500 chars'],
      ['has space', 'forbidden characters'],
      ['evil; rm', 'forbidden characters'],
      ['a|b', 'forbidden characters'],
      ['a&b', 'forbidden characters'],
      ['$x', 'forbidden characters'],
      ['back`tick', 'forbidden characters'],
    ])('rejects %s without spawning', async (input, expected) => {
      const { result } = await ipc.invoke('skill:install-registry', '/home/.agents', input, { agents: [], skill: '*' });
      expect(result.success).toBe(false);
      expect(result.error).toContain(expected);
      expect(spawn).not.toHaveBeenCalled();
    });

    it('boundary: exactly 500 chars is accepted (passes validation, then spawns)', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.readdir as any).mockResolvedValue([]);
      const promise = ipc.invoke('skill:install-registry', '/home/.agents', 'a'.repeat(500), { agents: [], skill: '*' });
      // Drain mkdir + mkdtemp + spawn microtasks
      await new Promise((r) => setTimeout(r, 0));
      expect(spawnCalls.length).toBe(1);
      const child = spawnCalls[0].child;
      child.emit('close', 0);
      await promise;
    });
  });

  // ─── skill:install-registry — happy path + started event (AC-7, CA-08) ───

  describe('skill:install-registry — happy path emits started event', () => {
    it('emits :started with requestId before child closes', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.readdir as any).mockResolvedValue([]);
      const promise = ipc.invoke('skill:install-registry', '/home/.agents', 'owner/repo', { agents: [], skill: '*' });
      // Allow mkdir + mkdtemp + spawn + sender.send to fire
      await new Promise((r) => setTimeout(r, 0));
      expect(spawnCalls.length).toBe(1);
      const child = spawnCalls[0].child;
      child.stdout.emit('data', Buffer.from('+ added\n'));
      child.emit('close', 0);
      const { result, sent } = await promise;
      expect(sent).toEqual([{ channel: 'skill:install-registry:started', payload: { requestId: 'mock-uuid-1234' } }]);
      expect(result.success).toBe(true);
      expect(result.data.requestId).toBe('mock-uuid-1234');
      expect(result.data.exitCode).toBe(0);
      expect(result.data.stdout).toContain('+ added');
    });

    it('spawns npx with skills add and the input as separate args (no shell injection)', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.readdir as any).mockResolvedValue([]);
      const promise = ipc.invoke('skill:install-registry', '/home/.agents', 'owner/repo', { agents: [], skill: '*' });
      await new Promise((r) => setTimeout(r, 0));
      expect(spawnCalls[0].cmd).toBe('npx');
      expect(spawnCalls[0].args[0]).toBe('skills');
      expect(spawnCalls[0].args[1]).toBe('add');
      expect(spawnCalls[0].args[2]).toBe('owner/repo');
      // With no agents selected: no `-a` flag; just --yes
      expect(spawnCalls[0].args).toContain('--yes');
      expect(spawnCalls[0].args).not.toContain('-a');
      spawnCalls[0].child.emit('close', 0);
      await promise;
    });

    it('builds multiple `-a <agent>` flags when agents are selected', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.readdir as any).mockResolvedValue([]);
      const promise = ipc.invoke(
        'skill:install-registry',
        '/home/.agents',
        'mattpocock/skills',
        { agents: ['claude-code', 'github-copilot', 'antigravity'], skill: 'handoff' },
      );
      await new Promise((r) => setTimeout(r, 0));
      const args = spawnCalls[0].args;
      expect(args).toEqual([
        'skills', 'add', 'mattpocock/skills',
        '-a', 'claude-code',
        '-a', 'github-copilot',
        '-a', 'antigravity',
        '--yes',
        '--skill', 'handoff',
      ]);
      spawnCalls[0].child.emit('close', 0);
      await promise;
    });

    it('rejects when an unknown agent name is passed', async () => {
      const { result } = await ipc.invoke(
        'skill:install-registry',
        '/home/.agents',
        'owner/repo',
        { agents: ['bogus' as unknown as 'claude-code'], skill: '*' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid agent: bogus/);
    });
  });

  // ─── skill:install-registry:cancel — SIGTERM → 1500 ms → SIGKILL ───────

  describe('skill:install-registry:cancel — SIGTERM → SIGKILL escalation (AC-8, CA-11)', () => {
    it('returns unknown requestId when no install is in flight', async () => {
      const { result } = await ipc.invoke('skill:install-registry:cancel', 'nope');
      expect(result.success).toBe(false);
      expect(result.error).toContain('unknown requestId');
    });

    it('sends SIGTERM immediately, then SIGKILL after 1500 ms if still alive', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.readdir as any).mockResolvedValue([]);
      const installPromise = ipc.invoke('skill:install-registry', '/home/.agents', 'owner/repo', { agents: [], skill: '*' });
      // Drain mkdir + mkdtemp + spawn microtasks BEFORE switching to fake timers
      await new Promise((r) => setTimeout(r, 0));
      vi.useFakeTimers();
      const child = spawnCalls[0].child;

      const cancelResult = await ipc.invoke('skill:install-registry:cancel', 'mock-uuid-1234');
      expect(cancelResult.result.success).toBe(true);
      expect(child.killSignal).toBe('SIGTERM');

      // Advance to just before 1500 ms — no SIGKILL yet
      await vi.advanceTimersByTimeAsync(1499);
      expect(child.killSignal).toBe('SIGTERM');

      // Advance to 1500 ms — SIGKILL escalation
      await vi.advanceTimersByTimeAsync(1);
      expect(child.killSignal).toBe('SIGKILL');

      // Close the child to clean up the install promise
      child.emit('close', null, 'SIGKILL');
      await installPromise;
    });
  });

  // ─── skill:import-folder ──────────────────────────────────────────────────

  describe('skill:import-folder (AC-10)', () => {
    it('happy path: validates source, requires SKILL.md, copies recursively, returns skillId', async () => {
      (fs.access as any).mockImplementation((p: string) => {
        // SKILL.md exists; dest does NOT
        if (p.endsWith('SKILL.md')) return Promise.resolve();
        return Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      });
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.cp as any).mockResolvedValue(undefined);
      const { result } = await ipc.invoke(
        'skill:import-folder',
        path.join(HOME, '.agents'),
        path.join(HOME, 'my-skill')
      );
      expect(result.success).toBe(true);
      expect(result.data.skillId).toBe('my-skill');
      expect((fs.cp as any).mock.calls[0][0]).toBe(path.join(HOME, 'my-skill'));
    });

    it('rejects when source folder lacks SKILL.md', async () => {
      (fs.access as any).mockImplementation((p: string) => {
        if (p.endsWith('SKILL.md')) return Promise.reject(new Error('ENOENT'));
        return Promise.resolve();
      });
      (fs.mkdir as any).mockResolvedValue(undefined);
      const { result } = await ipc.invoke(
        'skill:import-folder',
        path.join(HOME, '.agents'),
        path.join(HOME, 'bad-folder')
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/SKILL\.md/);
      expect(fs.cp).not.toHaveBeenCalled();
    });

    it('rejects on destination collision (folder with same basename already exists)', async () => {
      (fs.access as any).mockImplementation((_p: string) => {
        // SKILL.md exists; dest exists too
        return Promise.resolve();
      });
      (fs.mkdir as any).mockResolvedValue(undefined);
      const { result } = await ipc.invoke(
        'skill:import-folder',
        path.join(HOME, '.agents'),
        path.join(HOME, 'my-skill')
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already exists/);
      expect(fs.cp).not.toHaveBeenCalled();
    });

    it('rejects when source path escapes the home directory', async () => {
      const { result } = await ipc.invoke(
        'skill:import-folder',
        path.join(HOME, '.agents'),
        '/etc/passwd'
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Access denied/);
    });
  });

  // ─── skill:get-linked-by ──────────────────────────────────────────────────

  describe('skill:get-linked-by (AC-11)', () => {
    it('aggregates non-shared agents whose skills/ contains a symlink to shared skills', async () => {
      const sharedDir = path.join(HOME, '.agents');
      const sharedSkillsDir = path.join(sharedDir, 'skills');
      const claudeSkillsDir = path.join(HOME, '.claude', 'skills');
      const geminiSkillsDir = path.join(HOME, '.gemini', 'skills');

      (fs.readdir as any).mockImplementation((dir: string) => {
        if (dir === sharedSkillsDir) return Promise.resolve(['a-skill', 'b-skill']);
        if (dir === claudeSkillsDir) return Promise.resolve(['a-skill']);
        if (dir === geminiSkillsDir) return Promise.resolve(['b-skill', 'unrelated']);
        return Promise.reject(new Error('ENOENT'));
      });
      (fs.lstat as any).mockResolvedValue({ isSymbolicLink: () => true });
      (fs.readlink as any).mockImplementation((p: string) => {
        if (p === path.join(claudeSkillsDir, 'a-skill')) return Promise.resolve(path.join(sharedSkillsDir, 'a-skill'));
        if (p === path.join(geminiSkillsDir, 'b-skill')) return Promise.resolve(path.join(sharedSkillsDir, 'b-skill'));
        return Promise.resolve('/somewhere/else');
      });

      const { result } = await ipc.invoke('skill:get-linked-by', sharedDir);
      expect(result.success).toBe(true);
      const map: Record<string, string[]> = {};
      for (const r of result.data) map[r.skillId] = r.agents;
      expect(map['a-skill']).toEqual(['claude-code']);
      expect(map['b-skill']).toEqual(['gemini']);
    });

    it('returns empty array when shared skills directory is missing', async () => {
      (fs.readdir as any).mockRejectedValue(new Error('ENOENT'));
      const { result } = await ipc.invoke('skill:get-linked-by', path.join(HOME, '.agents'));
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  // ─── skill:get-lock ──────────────────────────────────────────────────────

  describe('skill:get-lock', () => {
    it('returns parsed SkillLock when .skill-lock.json exists', async () => {
      (fs.readFile as any).mockResolvedValue(JSON.stringify({
        version: 3,
        skills: {
          kami: {
            source: 'tw93/kami',
            sourceType: 'github',
            sourceUrl: 'https://github.com/tw93/kami.git',
            skillPath: 'SKILL.md',
            skillFolderHash: 'abc',
            installedAt: '2026-05-23T04:01:40.724Z',
            updatedAt: '2026-05-23T04:01:40.724Z',
          },
        },
      }));
      const { result } = await ipc.invoke('skill:get-lock', path.join(HOME, '.agents'));
      expect(result.success).toBe(true);
      expect(result.data.version).toBe(3);
      expect(result.data.skills.kami.source).toBe('tw93/kami');
    });

    it('returns null when .skill-lock.json is missing (ENOENT)', async () => {
      const enoent = Object.assign(new Error('not found'), { code: 'ENOENT' });
      (fs.readFile as any).mockRejectedValue(enoent);
      const { result } = await ipc.invoke('skill:get-lock', path.join(HOME, '.agents'));
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('returns null when JSON is malformed (does not surface error)', async () => {
      (fs.readFile as any).mockResolvedValue('{not valid json');
      const { result } = await ipc.invoke('skill:get-lock', path.join(HOME, '.agents'));
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('rejects when path escapes the home directory', async () => {
      const { result } = await ipc.invoke('skill:get-lock', '/etc');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Access denied/);
    });
  });

  // ─── skill:update-registry ───────────────────────────────────────────────

  describe('skill:update-registry', () => {
    it('spawns npx skills update with no IDs (= update all)', async () => {
      const promise = ipc.invoke('skill:update-registry', path.join(HOME, '.agents'), []);
      await new Promise((r) => setTimeout(r, 0));
      expect(spawnCalls.length).toBe(1);
      expect(spawnCalls[0].cmd).toBe('npx');
      expect(spawnCalls[0].args).toEqual(['skills', 'update', '--yes']);
      spawnCalls[0].child.emit('close', 0);
      const { result, sent } = await promise;
      expect(result.success).toBe(true);
      expect(sent[0].channel).toBe('skill:update-registry:started');
    });

    it('spawns npx skills update <id1> <id2> when IDs provided', async () => {
      const promise = ipc.invoke('skill:update-registry', path.join(HOME, '.agents'), ['kami', 'grill-me']);
      await new Promise((r) => setTimeout(r, 0));
      expect(spawnCalls[0].args).toEqual(['skills', 'update', 'kami', 'grill-me', '--yes']);
      spawnCalls[0].child.emit('close', 0);
      await promise;
    });

    it('rejects when any skill ID contains path separators', async () => {
      const { result } = await ipc.invoke(
        'skill:update-registry', path.join(HOME, '.agents'), ['../evil']
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid name/);
      expect(spawnCalls.length).toBe(0);
    });

    it('rejects when sharedConfigDir escapes home', async () => {
      const { result } = await ipc.invoke('skill:update-registry', '/etc', []);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Access denied/);
    });
  });

  // ─── skill:update-registry:cancel ────────────────────────────────────────

  describe('skill:update-registry:cancel — SIGTERM → SIGKILL escalation', () => {
    it('returns unknown requestId when no update is in flight', async () => {
      const { result } = await ipc.invoke('skill:update-registry:cancel', 'nope');
      expect(result.success).toBe(false);
      expect(result.error).toContain('unknown requestId');
    });

    it('sends SIGTERM immediately, then SIGKILL after 1500 ms', async () => {
      const installPromise = ipc.invoke('skill:update-registry', path.join(HOME, '.agents'), []);
      await new Promise((r) => setTimeout(r, 0));
      vi.useFakeTimers();
      const child = spawnCalls[0].child;
      const cancelResult = await ipc.invoke('skill:update-registry:cancel', 'mock-uuid-1234');
      expect(cancelResult.result.success).toBe(true);
      expect(child.killSignal).toBe('SIGTERM');
      await vi.advanceTimersByTimeAsync(1499);
      expect(child.killSignal).toBe('SIGTERM');
      await vi.advanceTimersByTimeAsync(1);
      expect(child.killSignal).toBe('SIGKILL');
      child.emit('close', null, 'SIGKILL');
      await installPromise;
    });
  });

  // ─── skill:remove-registry ───────────────────────────────────────────────

  describe('skill:remove-registry', () => {
    it('rejects when no skill IDs are provided', async () => {
      const { result } = await ipc.invoke('skill:remove-registry', path.join(HOME, '.agents'), []);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/At least one skill ID/);
      expect(spawnCalls.length).toBe(0);
    });

    it('spawns npx skills remove <id1> <id2> with cwd = parent of sharedConfigDir', async () => {
      const promise = ipc.invoke(
        'skill:remove-registry',
        path.join(HOME, '.agents'),
        ['kami', 'handoff'],
      );
      await new Promise((r) => setTimeout(r, 0));
      expect(spawnCalls[0].cmd).toBe('npx');
      expect(spawnCalls[0].args).toEqual(['skills', 'remove', 'kami', 'handoff', '--yes']);
      expect((spawnCalls[0].opts as { cwd: string }).cwd).toBe(HOME);
      spawnCalls[0].child.emit('close', 0);
      const { result, sent } = await promise;
      expect(result.success).toBe(true);
      expect(sent[0].channel).toBe('skill:remove-registry:started');
    });

    it('rejects when any skill ID contains path separators', async () => {
      const { result } = await ipc.invoke(
        'skill:remove-registry',
        path.join(HOME, '.agents'),
        ['../evil'],
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid name/);
      expect(spawnCalls.length).toBe(0);
    });

    it('rejects when sharedConfigDir escapes home', async () => {
      const { result } = await ipc.invoke('skill:remove-registry', '/etc', ['kami']);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Access denied/);
    });
  });

  describe('skill:remove-registry:cancel — SIGTERM → SIGKILL escalation', () => {
    it('returns unknown requestId when no remove is in flight', async () => {
      const { result } = await ipc.invoke('skill:remove-registry:cancel', 'nope');
      expect(result.success).toBe(false);
      expect(result.error).toContain('unknown requestId');
    });

    it('sends SIGTERM immediately, then SIGKILL after 1500 ms', async () => {
      const removePromise = ipc.invoke(
        'skill:remove-registry',
        path.join(HOME, '.agents'),
        ['kami'],
      );
      await new Promise((r) => setTimeout(r, 0));
      vi.useFakeTimers();
      const child = spawnCalls[0].child;
      const cancelResult = await ipc.invoke('skill:remove-registry:cancel', 'mock-uuid-1234');
      expect(cancelResult.result.success).toBe(true);
      expect(child.killSignal).toBe('SIGTERM');
      await vi.advanceTimersByTimeAsync(1499);
      expect(child.killSignal).toBe('SIGTERM');
      await vi.advanceTimersByTimeAsync(1);
      expect(child.killSignal).toBe('SIGKILL');
      child.emit('close', null, 'SIGKILL');
      await removePromise;
    });
  });
});
