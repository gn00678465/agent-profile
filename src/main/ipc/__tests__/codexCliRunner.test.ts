// Phase 1 — codexCliRunner whitelist/validator tests + parser tests against real
// codex v0.136.0 fixtures.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Intercept child_process.spawn at the module boundary so nothing touches the real shell.
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

// Import after mock so the runner's internal `spawn` reference is the mock.
import {
  detectCodexBinary,
  isWhitelisted,
  runMarketplaceAdd,
  runMarketplaceRemove,
  runMarketplaceUpgrade,
  runPluginAdd,
  runPluginRemove,
  runWhitelisted,
  _resetBinaryCache,
  _internals,
} from '../handlers/codexCliRunner';
import {
  parseCodexMarketplaceList,
  parseCodexPluginList,
} from '../handlers/codexPluginsParse';

// ─── Real fixtures (verbatim from live codex v0.136.0) ───────────────────────

const MARKETPLACE_LIST_FIXTURE = [
  'MARKETPLACE     ROOT',
  'ponytail        C:\\Users\\gn006\\.codex\\.tmp\\marketplaces\\ponytail',
  'openai-curated  C:\\Users\\gn006\\.codex\\.tmp\\plugins',
  '',
].join('\n');

// `ponytail@ponytail` PATH contains spaces + a comma; openai-curated rows have backslash paths.
const PLUGIN_LIST_FIXTURE = [
  'Marketplace `ponytail`',
  'C:\\Users\\gn006\\.codex\\.tmp\\marketplaces\\ponytail\\.agents\\plugins\\marketplace.json',
  '',
  'PLUGIN             STATUS         VERSION  PATH',
  'ponytail@ponytail  not installed           https://github.com/DietrichGebert/ponytail.git, ref `main`',
  '',
  'Marketplace `openai-curated`',
  'C:\\Users\\gn006\\.codex\\.tmp\\plugins\\.agents\\plugins\\marketplace.json',
  '',
  'PLUGIN                         STATUS         VERSION  PATH',
  'linear@openai-curated          not installed           C:\\Users\\gn006\\.codex\\.tmp\\plugins\\plugins\\linear',
  'gmail@openai-curated           not installed           C:\\Users\\gn006\\.codex\\.tmp\\plugins\\plugins\\gmail',
  '',
].join('\n');

// Real captured `codex plugin list` block for an INSTALLED plugin (codex v0.136.0).
// The STATUS column reports "installed, enabled" (note the comma + wider column), which
// the earlier synthetic "installed" fixture failed to represent — that gap let a real
// installed plugin get dropped by the parser.
const PLUGIN_LIST_INSTALLED_FIXTURE = [
  'Marketplace `ponytail`',
  'C:\\Users\\gn006\\.codex\\.tmp\\marketplaces\\ponytail\\.agents\\plugins\\marketplace.json',
  '',
  'PLUGIN             STATUS              VERSION  PATH',
  'ponytail@ponytail  installed, enabled  4.7.0    https://github.com/DietrichGebert/ponytail.git, ref `main`',
  '',
].join('\n');

describe('codexCliRunner — whitelist', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    _resetBinaryCache();
  });

  it('accepts exactly the 8 whitelisted patterns', () => {
    expect(isWhitelisted(['--version'])).toBe(true);
    expect(isWhitelisted(['plugin', 'marketplace', 'list'])).toBe(true);
    expect(isWhitelisted(['plugin', 'marketplace', 'add', 'owner/repo'])).toBe(true);
    expect(isWhitelisted(['plugin', 'marketplace', 'add', 'owner/repo', '--ref', 'main'])).toBe(true);
    expect(isWhitelisted(['plugin', 'marketplace', 'remove', 'ponytail'])).toBe(true);
    expect(isWhitelisted(['plugin', 'marketplace', 'upgrade'])).toBe(true);
    expect(isWhitelisted(['plugin', 'marketplace', 'upgrade', 'ponytail'])).toBe(true);
    expect(isWhitelisted(['plugin', 'list'])).toBe(true);
    expect(isWhitelisted(['plugin', 'add', 'linear@openai-curated'])).toBe(true);
    expect(isWhitelisted(['plugin', 'remove', 'linear@openai-curated'])).toBe(true);
  });

  it('rejects non-whitelisted args and extra/short tokens', () => {
    expect(isWhitelisted(['rm', '-rf', '/'])).toBe(false);
    expect(isWhitelisted(['--version', 'extra'])).toBe(false);
    expect(isWhitelisted(['plugin'])).toBe(false);
    expect(isWhitelisted(['plugin', 'list', 'extra'])).toBe(false);
    expect(isWhitelisted(['plugin', 'add'])).toBe(false);
    expect(isWhitelisted(['plugin', 'add', 'a', 'b'])).toBe(false);
    expect(isWhitelisted(['plugin', 'marketplace'])).toBe(false);
    expect(isWhitelisted(['plugin', 'marketplace', 'add'])).toBe(false);
    // --ref present but wrong arity / wrong flag
    expect(isWhitelisted(['plugin', 'marketplace', 'add', 'owner/repo', '--branch', 'main'])).toBe(false);
    expect(isWhitelisted(['plugin', 'marketplace', 'add', 'owner/repo', '--ref'])).toBe(false);
    expect(isWhitelisted(['plugin', 'marketplace', 'upgrade', 'a', 'b'])).toBe(false);
    expect(isWhitelisted(['exec', 'whoami'])).toBe(false);
  });

  it('runWhitelisted short-circuits non-whitelisted vectors before spawn', async () => {
    const result = await runWhitelisted(['exec', 'whoami']);
    expect(result.success).toBe(false);
    expect(result.error).toBe('command not whitelisted');
    expect(spawnMock).not.toHaveBeenCalled();
  });
});

describe('codexCliRunner — validators reject injection before spawn', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    _resetBinaryCache();
  });

  it('rejects unsafe marketplace names (.. / path-sep / shell metachar)', async () => {
    for (const bad of ['../etc/passwd', 'foo/bar', 'a;rm -rf /', 'a|b', 'a`b`', 'foo bar']) {
      const r = await runMarketplaceRemove(bad);
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/invalid marketplace name/);
    }
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('rejects bad marketplace sources', async () => {
    // bare token (not owner/repo, not URL, not path)
    let r = await runMarketplaceAdd('justaword');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/invalid marketplace source/);

    // empty source
    r = await runMarketplaceAdd('');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/invalid marketplace source/);

    // shell metachar in a path-like source
    r = await runMarketplaceAdd('./repo;rm -rf /');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/invalid marketplace source/);

    // control chars (newline/tab) in source
    r = await runMarketplaceAdd('./repo\nevil');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/invalid marketplace source/);

    // owner/repo with bad ref
    r = await runMarketplaceAdd('owner/repo', 'main;evil');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/invalid ref/);

    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('rejects leading-dash tokens (argument injection) across source/name/ref/id', async () => {
    let r = await runMarketplaceAdd('-x/y'); // matches owner/repo regex but starts with '-'
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/must not start with '-'/);

    r = await runMarketplaceRemove('-curated');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/must not start with '-'/);

    r = await runMarketplaceAdd('owner/repo', '-ref');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/must not start with '-'/);

    r = await runPluginAdd('-name@mkt');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/must not start with '-'/);

    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('rejects bad plugin ids (no @ / two @ / unsafe halves)', async () => {
    for (const bad of ['noatsign', 'a@b@c', '@curated', 'name@', '../x@mkt', 'name@../mkt', 'name@m;kt']) {
      const r = await runPluginAdd(bad);
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/invalid plugin id|Invalid name|invalid marketplace name/);
    }
    const r2 = await runPluginRemove('name@a/b');
    expect(r2.success).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});

describe('codexCliRunner — happy-path arg construction', () => {
  const { Commands } = _internals;

  it('builds correct arg vectors and they are all whitelisted', () => {
    expect(Commands.versionProbe()).toEqual(['--version']);
    expect(Commands.marketplaceList()).toEqual(['plugin', 'marketplace', 'list']);
    expect(Commands.marketplaceAdd('owner/repo')).toEqual(['plugin', 'marketplace', 'add', 'owner/repo']);
    expect(Commands.marketplaceAdd('owner/repo', 'main')).toEqual(
      ['plugin', 'marketplace', 'add', 'owner/repo', '--ref', 'main'],
    );
    expect(Commands.marketplaceAdd('https://github.com/owner/repo.git')).toEqual(
      ['plugin', 'marketplace', 'add', 'https://github.com/owner/repo.git'],
    );
    expect(Commands.marketplaceAdd('owner/repo@v1.0')).toEqual(
      ['plugin', 'marketplace', 'add', 'owner/repo@v1.0'],
    );
    expect(Commands.marketplaceRemove('ponytail')).toEqual(['plugin', 'marketplace', 'remove', 'ponytail']);
    expect(Commands.marketplaceUpgrade()).toEqual(['plugin', 'marketplace', 'upgrade']);
    expect(Commands.marketplaceUpgrade('ponytail')).toEqual(['plugin', 'marketplace', 'upgrade', 'ponytail']);
    expect(Commands.pluginList()).toEqual(['plugin', 'list']);
    expect(Commands.pluginAdd('linear@openai-curated')).toEqual(['plugin', 'add', 'linear@openai-curated']);
    expect(Commands.pluginRemove('linear@openai-curated')).toEqual(['plugin', 'remove', 'linear@openai-curated']);

    // every builder output must pass the whitelist gate
    for (const args of [
      Commands.versionProbe(),
      Commands.marketplaceList(),
      Commands.marketplaceAdd('owner/repo'),
      Commands.marketplaceAdd('owner/repo', 'main'),
      Commands.marketplaceRemove('ponytail'),
      Commands.marketplaceUpgrade(),
      Commands.marketplaceUpgrade('ponytail'),
      Commands.pluginList(),
      Commands.pluginAdd('linear@openai-curated'),
      Commands.pluginRemove('linear@openai-curated'),
    ]) {
      expect(isWhitelisted(args)).toBe(true);
    }
  });

  it('accepts a valid local path source', () => {
    expect(Commands.marketplaceAdd('./local/marketplace')).toEqual(
      ['plugin', 'marketplace', 'add', './local/marketplace'],
    );
    expect(Commands.marketplaceAdd('C:\\Users\\me\\mkt')).toEqual(
      ['plugin', 'marketplace', 'add', 'C:\\Users\\me\\mkt'],
    );
  });
});

describe('codexCliRunner — spawn paths', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    _resetBinaryCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns NOT_FOUND_MSG_CODEX when binary detection fails', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValueOnce(child);
    const detectPromise = detectCodexBinary();
    setImmediate(() => child.emit('close', 1));
    expect(await detectPromise).toBeNull();

    spawnMock.mockReset();
    const child2 = makeFakeChild();
    spawnMock.mockReturnValueOnce(child2);
    setImmediate(() => child2.emit('close', 1));
    const result = await runMarketplaceRemove('ponytail');
    expect(result.success).toBe(false);
    expect(result.error).toBe(_internals.NOT_FOUND_MSG_CODEX);
  });

  it('fires SIGTERM after the 60s timeout', async () => {
    vi.useFakeTimers();
    const detectChild = makeFakeChild();
    spawnMock.mockReturnValueOnce(detectChild);
    const detectPromise = detectCodexBinary();
    detectChild.stdout.emit('data', Buffer.from('/usr/local/bin/codex\n'));
    detectChild.emit('close', 0);
    await detectPromise;

    const cliChild = makeFakeChild();
    spawnMock.mockReturnValueOnce(cliChild);
    const promise = runMarketplaceRemove('ponytail');
    await vi.advanceTimersByTimeAsync(60_001);
    expect(cliChild.kill).toHaveBeenCalledWith('SIGTERM');

    cliChild.emit('close', null);
    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
  });

  it('spawns with shell:false and returns stdout on exit 0', async () => {
    const detectChild = makeFakeChild();
    spawnMock.mockReturnValueOnce(detectChild);
    const detectPromise = detectCodexBinary();
    detectChild.stdout.emit('data', Buffer.from('/usr/local/bin/codex\n'));
    detectChild.emit('close', 0);
    await detectPromise;

    const cliChild = makeFakeChild();
    spawnMock.mockReturnValueOnce(cliChild);
    const promise = runMarketplaceUpgrade();
    setImmediate(() => {
      cliChild.stdout.emit('data', Buffer.from('Upgraded.\n'));
      cliChild.emit('close', 0);
    });
    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('Upgraded.\n');

    // assert no-shell spawn options on the actual command invocation
    const lastCall = spawnMock.mock.calls[spawnMock.mock.calls.length - 1];
    expect(lastCall[0]).toBe('/usr/local/bin/codex');
    expect(lastCall[1]).toEqual(['plugin', 'marketplace', 'upgrade']);
    expect(lastCall[2]).toMatchObject({ shell: false, windowsHide: true });
  });
});

describe('parseCodexMarketplaceList', () => {
  it('parses the two-column marketplace table, skipping the header', () => {
    const out = parseCodexMarketplaceList(MARKETPLACE_LIST_FIXTURE);
    expect(out).toEqual([
      { name: 'ponytail', root: 'C:\\Users\\gn006\\.codex\\.tmp\\marketplaces\\ponytail' },
      { name: 'openai-curated', root: 'C:\\Users\\gn006\\.codex\\.tmp\\plugins' },
    ]);
  });

  it('returns [] for empty / header-only input', () => {
    expect(parseCodexMarketplaceList('')).toEqual([]);
    expect(parseCodexMarketplaceList('MARKETPLACE     ROOT\n')).toEqual([]);
  });
});

describe('parseCodexPluginList', () => {
  it('parses multi-marketplace blocks with not-installed status and empty version', () => {
    const out = parseCodexPluginList(PLUGIN_LIST_FIXTURE);
    expect(out).toEqual([
      {
        id: 'ponytail@ponytail',
        name: 'ponytail',
        marketplace: 'ponytail',
        status: 'not-installed',
        path: 'https://github.com/DietrichGebert/ponytail.git, ref `main`',
      },
      {
        id: 'linear@openai-curated',
        name: 'linear',
        marketplace: 'openai-curated',
        status: 'not-installed',
        path: 'C:\\Users\\gn006\\.codex\\.tmp\\plugins\\plugins\\linear',
      },
      {
        id: 'gmail@openai-curated',
        name: 'gmail',
        marketplace: 'openai-curated',
        status: 'not-installed',
        path: 'C:\\Users\\gn006\\.codex\\.tmp\\plugins\\plugins\\gmail',
      },
    ]);
    // empty VERSION column must be absent, not ''
    expect(out[0].version).toBeUndefined();
  });

  it('parses an "installed, enabled" status with a populated version column', () => {
    const out = parseCodexPluginList(PLUGIN_LIST_INSTALLED_FIXTURE);
    expect(out).toEqual([
      {
        id: 'ponytail@ponytail',
        name: 'ponytail',
        marketplace: 'ponytail',
        status: 'installed',
        version: '4.7.0',
        path: 'https://github.com/DietrichGebert/ponytail.git, ref `main`',
      },
    ]);
  });

  it('skips unparseable rows and never throws', () => {
    const noise = [
      'Marketplace `x`',
      'C:\\path\\marketplace.json',
      '',
      'PLUGIN          STATUS         VERSION  PATH',
      'garbage line with no at sign and weird status',
      'good@x          installed      9.9      C:\\p',
      '',
    ].join('\n');
    const out = parseCodexPluginList(noise);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('good@x');
    expect(parseCodexPluginList('')).toEqual([]);
  });
});
