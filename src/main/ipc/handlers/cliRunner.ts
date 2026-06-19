// cliRunner — only allowed module to spawn the `claude` CLI binary.
// All input goes through whitelist + assertSafeName / git-URL regex (S1-5).
// No shell:true, no exec/execSync. Timeout 60s → SIGTERM, +5s → SIGKILL (RC4).

import { spawn, type ChildProcess } from 'child_process';
import os from 'os';
import { assertSafeName } from './configUtils';
import type { CliRunResult, ClaudeMarketplaceSource } from '../../../shared/types';

const TIMEOUT_MS = 60_000;
const KILL_GRACE_MS = 5_000;

const ALLOWED_SCOPES = new Set(['user', 'project', 'local']);

// L6 — git URL regex (https / ssh / shorthand `github:owner/repo`)
const GIT_URL_REGEX = /^(https:\/\/[\w./@:-]+|git@[\w./:-]+:[\w./-]+|github:[\w-]+\/[\w.-]+)$/;

// Reject NUL + CR/LF/tab — used for directory-path validation where most
// printable characters (incl. spaces and Windows path separators) are legal.
function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0 || c === 9 || c === 10 || c === 13) return true;
  }
  return false;
}

const NOT_FOUND_MSG =
  'claude CLI not found in PATH; install via instructions at https://code.claude.com/docs/zh-TW/setup';

// L7 — platform binary candidates
function binaryCandidates(): string[] {
  if (process.platform === 'win32') return ['claude.cmd', 'claude.exe', 'claude.bat'];
  return ['claude'];
}

function detectorCommand(): { cmd: string; args: string[] } {
  if (process.platform === 'win32') return { cmd: 'where', args: ['claude'] };
  return { cmd: 'which', args: ['claude'] };
}

let cachedBinary: string | null = null;

export function _resetBinaryCache(): void {
  cachedBinary = null;
}

export async function detectBinary(): Promise<string | null> {
  if (cachedBinary) return cachedBinary;
  const { cmd, args } = detectorCommand();
  const result = await runRaw(cmd, args, { timeoutMs: 5_000 });
  if (!result.success || !result.stdout) return null;
  // Each line is a candidate path; on Windows `where` lists all PATHEXT matches.
  const candidates = binaryCandidates();
  const lines = result.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const want of candidates) {
    const hit = lines.find((l) => l.toLowerCase().endsWith(want.toLowerCase()));
    if (hit) {
      cachedBinary = hit;
      return hit;
    }
  }
  // fallback: first candidate path
  if (lines[0]) {
    cachedBinary = lines[0];
    return lines[0];
  }
  return null;
}

interface RunOpts {
  timeoutMs?: number;
}

async function runRaw(cmd: string, args: string[], opts: RunOpts = {}): Promise<CliRunResult> {
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  return new Promise<CliRunResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killTimer: NodeJS.Timeout | null = null;

    let child: ChildProcess;
    try {
      child = spawn(cmd, args, { shell: false, windowsHide: true });
    } catch (err) {
      resolve({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGTERM'); } catch { /* noop */ }
      killTimer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* noop */ }
      }, KILL_GRACE_MS);
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf-8'); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf-8'); });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve({ success: false, error: err.message, stdout, stderr });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      if (timedOut) {
        resolve({
          success: false,
          error: 'claude CLI timeout (60s)',
          stdout,
          stderr,
          exitCode: code ?? undefined,
        });
        return;
      }
      resolve({
        success: code === 0,
        exitCode: code ?? undefined,
        stdout,
        stderr,
        error: code === 0 ? undefined : `claude CLI exited with code ${String(code)}`,
      });
    });
  });
}

// ─── Whitelist (L4) ─────────────────────────────────────────────────────────
// 11 token patterns. Anything else → reject before spawn.

function buildMarketplaceSourceArg(name: string, source: ClaudeMarketplaceSource): string {
  // CLI syntax: `claude plugin marketplace add <name> <source-arg>`
  // <source-arg> is a single token: github repo, git URL, or path. Validated here.
  switch (source.source) {
    case 'github': {
      assertSafeMarketplaceName(name);
      const repo = source.repo;
      if (!/^[\w-]+\/[\w.-]+$/.test(repo)) {
        throw new Error(`invalid github repo: "${repo}"`);
      }
      return repo;
    }
    case 'git':
    case 'git-subdir':
    case 'url': {
      assertSafeMarketplaceName(name);
      const url = source.url;
      if (!GIT_URL_REGEX.test(url)) {
        throw new Error(`invalid git URL: "${url}"`);
      }
      return url;
    }
    case 'directory': {
      assertSafeMarketplaceName(name);
      // Directory path: reject NUL / line-control chars; cannot regex-validate full path
      // since Windows paths legitimately contain colons and backslashes. Defer assertion
      // to consuming CLI; minimal rejection here.
      const p = source.path;
      if (!p || hasControlChars(p)) {
        throw new Error(`invalid directory path: "${p}"`);
      }
      return p;
    }
    default: {
      const _exhaustive: never = source;
      throw new Error(`unsupported marketplace source: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// Marketplace name has more permissive rules than assertSafeName (allows hyphens, dots).
// But still rejects path separators and traversal sequences.
function assertSafeMarketplaceName(name: string): void {
  if (!name) throw new Error('invalid marketplace name: empty');
  if (/[/\\]/.test(name)) throw new Error(`invalid marketplace name: contains path separator: "${name}"`);
  if (name.includes('..')) throw new Error(`invalid marketplace name: contains "..": "${name}"`);
  if (/[;&|`$<>"'\s]/.test(name)) throw new Error(`invalid marketplace name: shell metacharacters in "${name}"`);
}

function assertSafeScope(scope: string): asserts scope is 'user' | 'project' | 'local' {
  if (!ALLOWED_SCOPES.has(scope)) {
    throw new Error(`invalid scope: "${scope}"`);
  }
}

// Build args for each whitelisted command. Throws on invalid input.
const Commands = {
  marketplaceAdd(name: string, source: ClaudeMarketplaceSource): string[] {
    const sourceArg = buildMarketplaceSourceArg(name, source);
    return ['plugin', 'marketplace', 'add', name, sourceArg];
  },
  marketplaceRemove(name: string): string[] {
    assertSafeMarketplaceName(name);
    return ['plugin', 'marketplace', 'remove', name];
  },
  marketplaceUpdate(name: string): string[] {
    assertSafeMarketplaceName(name);
    return ['plugin', 'marketplace', 'update', name];
  },
  marketplaceListJson(): string[] {
    return ['plugin', 'marketplace', 'list', '--json'];
  },
  pluginInstall(pluginId: string, scope: string): string[] {
    assertSafePluginId(pluginId);
    assertSafeScope(scope);
    return ['plugin', 'install', pluginId, '--scope', scope];
  },
  pluginUninstall(pluginId: string, scope: string): string[] {
    assertSafePluginId(pluginId);
    assertSafeScope(scope);
    return ['plugin', 'uninstall', pluginId, '--scope', scope];
  },
  pluginEnable(pluginId: string): string[] {
    assertSafePluginId(pluginId);
    return ['plugin', 'enable', pluginId];
  },
  pluginDisable(pluginId: string): string[] {
    assertSafePluginId(pluginId);
    return ['plugin', 'disable', pluginId];
  },
  pluginReload(): string[] {
    return ['plugin', 'reload'];
  },
  versionProbe(): string[] {
    return ['--version'];
  },
  pluginHelp(): string[] {
    return ['plugin', '--help'];
  },
} as const;

function assertSafePluginId(pluginId: string): void {
  if (!pluginId || !pluginId.includes('@')) {
    throw new Error(`invalid plugin id: "${pluginId}" (expected name@marketplace)`);
  }
  const [name, marketplace, ...rest] = pluginId.split('@');
  if (rest.length) throw new Error(`invalid plugin id: too many '@' in "${pluginId}"`);
  if (!name || !marketplace) throw new Error(`invalid plugin id: "${pluginId}"`);
  assertSafeName(name);
  assertSafeMarketplaceName(marketplace);
}

// Public surface — each function returns CliRunResult.
async function runWith(args: string[]): Promise<CliRunResult> {
  const bin = await detectBinary();
  if (!bin) {
    return { success: false, error: NOT_FOUND_MSG };
  }
  return runRaw(bin, args);
}

export async function runMarketplaceAdd(name: string, source: ClaudeMarketplaceSource): Promise<CliRunResult> {
  let args: string[];
  try { args = Commands.marketplaceAdd(name, source); }
  catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) }; }
  return runWith(args);
}

export async function runMarketplaceRemove(name: string): Promise<CliRunResult> {
  let args: string[];
  try { args = Commands.marketplaceRemove(name); }
  catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) }; }
  return runWith(args);
}

export async function runMarketplaceUpdate(name: string): Promise<CliRunResult> {
  let args: string[];
  try { args = Commands.marketplaceUpdate(name); }
  catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) }; }
  return runWith(args);
}

export async function runMarketplaceListJson(): Promise<CliRunResult> {
  return runWith(Commands.marketplaceListJson());
}

export async function runPluginInstall(pluginId: string, scope: string): Promise<CliRunResult> {
  let args: string[];
  try { args = Commands.pluginInstall(pluginId, scope); }
  catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) }; }
  return runWith(args);
}

export async function runPluginUninstall(pluginId: string, scope: string): Promise<CliRunResult> {
  let args: string[];
  try { args = Commands.pluginUninstall(pluginId, scope); }
  catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) }; }
  return runWith(args);
}

export async function runPluginReload(): Promise<CliRunResult> {
  return runWith(Commands.pluginReload());
}

// Generic runner with explicit whitelist guard — used by tests to assert rejection.
export async function runWhitelisted(args: string[]): Promise<CliRunResult> {
  if (!isWhitelisted(args)) {
    return { success: false, error: 'command not whitelisted' };
  }
  return runWith(args);
}

export function isWhitelisted(args: string[]): boolean {
  // Match the 11 patterns positionally; values at <variable> slots accepted as any
  // valid token (additional input validation already enforced by Commands.* builders).
  const a = args;
  if (a[0] === '--version' && a.length === 1) return true;
  if (a[0] === 'plugin') {
    if (a[1] === 'reload' && a.length === 2) return true;
    if (a[1] === '--help' && a.length === 2) return true;
    if (a[1] === 'install' && a.length === 5 && a[3] === '--scope') return true;
    if (a[1] === 'uninstall' && a.length === 5 && a[3] === '--scope') return true;
    if (a[1] === 'enable' && a.length === 3) return true;
    if (a[1] === 'disable' && a.length === 3) return true;
    if (a[1] === 'marketplace') {
      if (a[2] === 'add' && a.length === 5) return true;
      if (a[2] === 'remove' && a.length === 4) return true;
      if (a[2] === 'update' && a.length === 4) return true;
      if (a[2] === 'list' && a.length === 4 && a[3] === '--json') return true;
    }
  }
  return false;
}

// Re-export internals for tests (intentional surface, not user-facing IPC).
export const _internals = {
  GIT_URL_REGEX,
  NOT_FOUND_MSG,
  binaryCandidates,
  detectorCommand,
  homedir: () => os.homedir(),
};
