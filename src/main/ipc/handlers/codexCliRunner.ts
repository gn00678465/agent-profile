// codexCliRunner — the ONLY module allowed to spawn the `codex` CLI binary.
// Second security boundary, mirroring cliRunner.ts (which owns `claude`). All input goes
// through an 8-pattern whitelist + format-aware validators (source / plugin-id / ref).
// No shell:true, no exec/execSync. Timeout 60s → SIGTERM, +5s → SIGKILL.

import { spawn, type ChildProcess } from 'child_process';
import os from 'os';
import { assertSafeName } from './configUtils';
import type { CliRunResult } from '../../../shared/types';

const TIMEOUT_MS = 60_000;
const KILL_GRACE_MS = 5_000;

// git URL regex (https / ssh / shorthand `github:owner/repo`) — same shape as cliRunner L6.
const GIT_URL_REGEX = /^(https:\/\/[\w./@:-]+|git@[\w./:-]+:[\w./-]+|github:[\w-]+\/[\w.-]+)$/;

// owner/repo shorthand, optionally suffixed with `@ref`.
const OWNER_REPO_REGEX = /^[\w-]+\/[\w.-]+$/;

// Reject NUL + CR/LF/tab — used for local directory-path validation where most printable
// characters (incl. spaces and Windows path separators) are legal.
function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0 || c === 9 || c === 10 || c === 13) return true;
  }
  return false;
}

const NOT_FOUND_MSG_CODEX =
  'codex CLI not found in PATH; install via instructions at https://developers.openai.com/codex/cli';

// Platform binary candidates.
function binaryCandidates(): string[] {
  if (process.platform === 'win32') return ['codex.exe', 'codex.cmd', 'codex'];
  return ['codex'];
}

function detectorCommand(): { cmd: string; args: string[] } {
  if (process.platform === 'win32') return { cmd: 'where', args: ['codex'] };
  return { cmd: 'which', args: ['codex'] };
}

let cachedBinary: string | null = null;

export function _resetBinaryCache(): void {
  cachedBinary = null;
}

export async function detectCodexBinary(): Promise<string | null> {
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
          error: 'codex CLI timeout (60s)',
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
        error: code === 0 ? undefined : `codex CLI exited with code ${String(code)}`,
      });
    });
  });
}

// ─── Validators ──────────────────────────────────────────────────────────────
// Throw on invalid input; the run* wrappers convert throws into { success:false, error }.

// Reject a leading '-' so a token can never be mistaken for a flag by codex's arg parser
// (argument injection, CWE-88). Legit owners/repos/refs/names never start with '-'.
function assertNoLeadingDash(s: string, label: string): void {
  if (s.startsWith('-')) throw new Error(`invalid ${label}: must not start with '-': "${s}"`);
}

// Marketplace source can be: owner/repo (optionally `@ref`), a git URL, or a local path.
function assertSafeMarketplaceSource(src: string): void {
  if (!src) throw new Error('invalid marketplace source: empty');
  if (hasControlChars(src)) throw new Error(`invalid marketplace source: control chars in "${src}"`);
  assertNoLeadingDash(src, 'marketplace source');

  // owner/repo, optionally suffixed with @ref.
  const atIdx = src.indexOf('@');
  if (OWNER_REPO_REGEX.test(src)) return;
  if (atIdx > 0) {
    const repo = src.slice(0, atIdx);
    const ref = src.slice(atIdx + 1);
    if (OWNER_REPO_REGEX.test(repo)) {
      assertSafeRef(ref);
      return;
    }
  }

  // git URL.
  if (GIT_URL_REGEX.test(src)) return;

  // Local path: must look path-like (contains a separator or starts with . / ~) and carry
  // no shell metacharacters. Bare tokens are rejected so typos don't silently become args.
  if (/[/\\]/.test(src) || /^[.~]/.test(src)) {
    if (/[;&|`$<>"'*?]/.test(src)) {
      throw new Error(`invalid marketplace source: shell metacharacters in "${src}"`);
    }
    return;
  }

  throw new Error(`invalid marketplace source: "${src}"`);
}

// Marketplace name (the standalone identifier used for remove/upgrade and the right side of
// a plugin id). More permissive than assertSafeName (allows hyphens/dots) but rejects path
// separators, traversal, and shell metacharacters.
function assertSafeMarketplaceName(name: string): void {
  if (!name) throw new Error('invalid marketplace name: empty');
  assertNoLeadingDash(name, 'marketplace name');
  if (/[/\\]/.test(name)) throw new Error(`invalid marketplace name: contains path separator: "${name}"`);
  if (name.includes('..')) throw new Error(`invalid marketplace name: contains "..": "${name}"`);
  if (/[;&|`$<>"'\s]/.test(name)) throw new Error(`invalid marketplace name: shell metacharacters in "${name}"`);
}

// Codex plugin id is `name@marketplace` with exactly one '@'.
function assertSafeCodexPluginId(pluginId: string): void {
  if (!pluginId || !pluginId.includes('@')) {
    throw new Error(`invalid plugin id: "${pluginId}" (expected name@marketplace)`);
  }
  const parts = pluginId.split('@');
  if (parts.length !== 2) throw new Error(`invalid plugin id: too many '@' in "${pluginId}"`);
  const [name, marketplace] = parts;
  if (!name || !marketplace) throw new Error(`invalid plugin id: "${pluginId}"`);
  assertNoLeadingDash(name, 'plugin name');
  assertSafeName(name);
  assertSafeMarketplaceName(marketplace);
}

// Git ref (branch/tag): no whitespace or shell metacharacters.
function assertSafeRef(ref: string): void {
  if (!ref) throw new Error('invalid ref: empty');
  assertNoLeadingDash(ref, 'ref');
  if (/[;&|`$<>"'\s]/.test(ref)) throw new Error(`invalid ref: shell metacharacters in "${ref}"`);
  if (ref.includes('..')) throw new Error(`invalid ref: contains "..": "${ref}"`);
}

// ─── Command builders ────────────────────────────────────────────────────────
// Pure builders → return an approved arg vector. Throw on invalid input.

const Commands = {
  versionProbe(): string[] {
    return ['--version'];
  },
  marketplaceList(): string[] {
    return ['plugin', 'marketplace', 'list'];
  },
  marketplaceAdd(source: string, ref?: string): string[] {
    assertSafeMarketplaceSource(source);
    if (ref !== undefined) {
      assertSafeRef(ref);
      return ['plugin', 'marketplace', 'add', source, '--ref', ref];
    }
    return ['plugin', 'marketplace', 'add', source];
  },
  marketplaceRemove(name: string): string[] {
    assertSafeMarketplaceName(name);
    return ['plugin', 'marketplace', 'remove', name];
  },
  marketplaceUpgrade(name?: string): string[] {
    if (name !== undefined) {
      assertSafeMarketplaceName(name);
      return ['plugin', 'marketplace', 'upgrade', name];
    }
    return ['plugin', 'marketplace', 'upgrade'];
  },
  pluginList(): string[] {
    return ['plugin', 'list'];
  },
  pluginAdd(pluginId: string): string[] {
    assertSafeCodexPluginId(pluginId);
    return ['plugin', 'add', pluginId];
  },
  pluginRemove(pluginId: string): string[] {
    assertSafeCodexPluginId(pluginId);
    return ['plugin', 'remove', pluginId];
  },
} as const;

// ─── Whitelist (positional, 8 patterns) ──────────────────────────────────────
// Anything else → reject before spawn. Values at <variable> slots are accepted as any
// token here; format validation is enforced by the Commands.* builders.
export function isWhitelisted(args: string[]): boolean {
  const a = args;
  if (a[0] === '--version' && a.length === 1) return true;
  if (a[0] === 'plugin') {
    // plugin list
    if (a[1] === 'list' && a.length === 2) return true;
    // plugin add <id>
    if (a[1] === 'add' && a.length === 3) return true;
    // plugin remove <id>
    if (a[1] === 'remove' && a.length === 3) return true;
    if (a[1] === 'marketplace') {
      // plugin marketplace list
      if (a[2] === 'list' && a.length === 3) return true;
      // plugin marketplace add <source>  [--ref <ref>]
      if (a[2] === 'add') {
        if (a.length === 4) return true;
        if (a.length === 6 && a[4] === '--ref') return true;
      }
      // plugin marketplace remove <name>
      if (a[2] === 'remove' && a.length === 4) return true;
      // plugin marketplace upgrade  [<name>]
      if (a[2] === 'upgrade' && (a.length === 3 || a.length === 4)) return true;
    }
  }
  return false;
}

// ─── Public surface — each returns CliRunResult ──────────────────────────────

async function runWith(args: string[]): Promise<CliRunResult> {
  const bin = await detectCodexBinary();
  if (!bin) {
    return { success: false, error: NOT_FOUND_MSG_CODEX };
  }
  return runRaw(bin, args);
}

export async function runMarketplaceList(): Promise<CliRunResult> {
  return runWith(Commands.marketplaceList());
}

export async function runMarketplaceAdd(source: string, ref?: string): Promise<CliRunResult> {
  let args: string[];
  try { args = Commands.marketplaceAdd(source, ref); }
  catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) }; }
  return runWith(args);
}

export async function runMarketplaceRemove(name: string): Promise<CliRunResult> {
  let args: string[];
  try { args = Commands.marketplaceRemove(name); }
  catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) }; }
  return runWith(args);
}

export async function runMarketplaceUpgrade(name?: string): Promise<CliRunResult> {
  let args: string[];
  try { args = Commands.marketplaceUpgrade(name); }
  catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) }; }
  return runWith(args);
}

export async function runPluginList(): Promise<CliRunResult> {
  return runWith(Commands.pluginList());
}

export async function runPluginAdd(pluginId: string): Promise<CliRunResult> {
  let args: string[];
  try { args = Commands.pluginAdd(pluginId); }
  catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) }; }
  return runWith(args);
}

export async function runPluginRemove(pluginId: string): Promise<CliRunResult> {
  let args: string[];
  try { args = Commands.pluginRemove(pluginId); }
  catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) }; }
  return runWith(args);
}

// Generic runner with explicit whitelist guard — used by tests to assert rejection.
export async function runWhitelisted(args: string[]): Promise<CliRunResult> {
  if (!isWhitelisted(args)) {
    return { success: false, error: 'command not whitelisted' };
  }
  return runWith(args);
}

// Re-export internals for tests (intentional surface, not user-facing IPC).
export const _internals = {
  GIT_URL_REGEX,
  OWNER_REPO_REGEX,
  NOT_FOUND_MSG_CODEX,
  binaryCandidates,
  detectorCommand,
  Commands,
  assertSafeMarketplaceSource,
  assertSafeCodexPluginId,
  assertSafeRef,
  assertSafeMarketplaceName,
  homedir: () => os.homedir(),
};
