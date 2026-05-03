// S3-1 — cliRunner test (6 cases)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// We intercept child_process.spawn at the module boundary to avoid touching the real
// shell. Each spawn call returns a controllable EventEmitter-like child.

interface FakeChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: (signal?: string) => boolean;
  killed: boolean;
}

function makeFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = vi.fn((_signal?: string) => {
    child.killed = true;
    return true;
  });
  return child;
}

const spawnMock = vi.fn();

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

// Import after mock so cliRunner's internal `spawn` reference is the mock.
import {
  detectBinary,
  isWhitelisted,
  runMarketplaceAdd,
  runMarketplaceRemove,
  runWhitelisted,
  _resetBinaryCache,
  _internals,
} from '../handlers/cliRunner';

describe('cliRunner', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    _resetBinaryCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // (a) binary not found path
  it('returns NOT_FOUND error when which/where finds no binary', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);

    const detectPromise = detectBinary();
    // Simulate which/where exit code 1 with empty stdout (binary missing)
    setImmediate(() => {
      child.emit('close', 1);
    });
    const bin = await detectPromise;
    expect(bin).toBeNull();

    // Subsequent CLI call should short-circuit with NOT_FOUND_MSG
    spawnMock.mockReset();
    const child2 = makeFakeChild();
    spawnMock.mockReturnValueOnce(child2);
    setImmediate(() => child2.emit('close', 1));
    const result = await runMarketplaceRemove('foo');
    expect(result.success).toBe(false);
    expect(result.error).toContain('claude CLI not found');
    expect(result.error).toBe(_internals.NOT_FOUND_MSG);
  });

  // (b) timeout 後 SIGTERM
  it('on long-running spawn fires SIGTERM after timeout', async () => {
    vi.useFakeTimers();
    // Pretend binary detection succeeds
    const detectChild = makeFakeChild();
    spawnMock.mockReturnValueOnce(detectChild);
    const detectPromise = detectBinary();
    detectChild.stdout.emit('data', Buffer.from('/usr/local/bin/claude\n'));
    detectChild.emit('close', 0);
    await detectPromise;

    // Now actual command — child never closes
    const cliChild = makeFakeChild();
    spawnMock.mockReturnValueOnce(cliChild);
    const promise = runMarketplaceRemove('foo-marketplace');

    // Advance past the 60s timeout
    await vi.advanceTimersByTimeAsync(60_001);
    expect(cliChild.kill).toHaveBeenCalledWith('SIGTERM');

    // Now let close fire to resolve the promise
    cliChild.emit('close', null);
    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
  });

  // (c) 非白名單指令拒絕
  it('rejects commands outside the whitelist', async () => {
    expect(isWhitelisted(['plugin', 'list'])).toBe(false);
    expect(isWhitelisted(['rm', '-rf', '/'])).toBe(false);
    expect(isWhitelisted(['plugin', 'install', 'foo@bar'])).toBe(false); // missing --scope

    const result = await runWhitelisted(['plugin', 'list']);
    expect(result.success).toBe(false);
    expect(result.error).toBe('command not whitelisted');
    expect(spawnMock).not.toHaveBeenCalled();
  });

  // (d) marketplace name 含 .. / ; 觸發 assertSafeName 拒絕
  it('rejects unsafe marketplace names before spawn', async () => {
    const r1 = await runMarketplaceRemove('../etc/passwd');
    expect(r1.success).toBe(false);
    expect(r1.error).toMatch(/invalid marketplace name/);

    const r2 = await runMarketplaceRemove('foo;rm -rf /');
    expect(r2.success).toBe(false);
    expect(r2.error).toMatch(/invalid marketplace name/);

    expect(spawnMock).not.toHaveBeenCalled();
  });

  // (e) git URL 不合法拒絕
  it('rejects illegal git URL in marketplace add', async () => {
    const r1 = await runMarketplaceAdd('foo', { source: 'git', url: 'file:///etc/passwd' });
    expect(r1.success).toBe(false);
    expect(r1.error).toMatch(/invalid git URL/);

    const r2 = await runMarketplaceAdd('foo', { source: 'github', repo: '../malicious' });
    expect(r2.success).toBe(false);
    expect(r2.error).toMatch(/invalid github repo/);

    expect(spawnMock).not.toHaveBeenCalled();
  });

  // (f) 成功 exit 0 回傳 stdout
  it('returns stdout on successful exit 0', async () => {
    // First spawn = detection
    const detectChild = makeFakeChild();
    spawnMock.mockReturnValueOnce(detectChild);
    const detectPromise = detectBinary();
    detectChild.stdout.emit('data', Buffer.from('/usr/local/bin/claude\n'));
    detectChild.emit('close', 0);
    await detectPromise;

    // Second spawn = actual command
    const cliChild = makeFakeChild();
    spawnMock.mockReturnValueOnce(cliChild);
    const promise = runMarketplaceRemove('valid-name');

    setImmediate(() => {
      cliChild.stdout.emit('data', Buffer.from('Marketplace removed.\n'));
      cliChild.emit('close', 0);
    });

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('Marketplace removed.\n');
    expect(result.error).toBeUndefined();
  });
});
