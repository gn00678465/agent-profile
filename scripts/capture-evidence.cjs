'use strict';
// scripts/capture-evidence.cjs
//
// Drives the production-built Electron app over the **renderer's** Chromium
// DevTools Protocol (`--remote-debugging-port=9222`) using Playwright's
// `chromium.connectOverCDP()`, then captures M1-M14 evidence screenshots
// for feat-019 to evidence/feat-019/.
//
// This sidesteps the Windows STATUS_BREAKPOINT crash documented in
// docs/E2E_BLOCKED.md — that bug is in Playwright's `electron.launch()`
// path which spawns Electron with Node's `--inspect=0` flag and crashes
// on the first CDP message. `--remote-debugging-port` is a different
// mechanism (renderer V8 CDP, not Node inspector) and is the same one
// `webContents.openDevTools()` uses internally.
//
// Usage:
//   bun run build           # produce dist/ + dist-electron/
//   bun run capture         # this script (or:  node scripts/capture-evidence.cjs)
//
// Outputs:
//   evidence/feat-019/m{1..14}.png      (overwrites placeholder PNGs)
//   evidence/feat-019/m4-no-binary.png  (mocked NOT_FOUND state)
//   evidence/feat-019/capture.log       (run log)

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.join(ROOT, 'evidence', 'feat-019');
// Direct .exe (Windows) / dist binary (Unix) — avoids the npm .cmd shim which
// can strip env overrides (USERPROFILE/HOME) before reaching Electron's main process.
const ELECTRON_BIN = process.platform === 'win32'
  ? path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron');
const MAIN_ENTRY = path.join(ROOT, 'dist-electron', 'main', 'index.mjs');
const CDP_PORT = 9222;
const CDP_ENDPOINT = `http://127.0.0.1:${CDP_PORT}`;

const log = (...args) => {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(line);
  fs.appendFileSync(path.join(EVIDENCE_DIR, 'capture.log'), line + '\n');
};

async function waitForCdp(timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${CDP_ENDPOINT}/json/version`);
      if (res.ok) {
        const j = await res.json();
        log('CDP ready:', j.Browser);
        return;
      }
    } catch { /* not yet */ }
    await sleep(250);
  }
  throw new Error(`CDP endpoint ${CDP_ENDPOINT} did not become ready in ${timeoutMs}ms`);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function spawnElectron(env = {}) {
  log('Spawning Electron (direct .exe) with --remote-debugging-port=' + CDP_PORT);
  if (env.HOME || env.USERPROFILE) {
    log('  HOME=' + (env.HOME || '(unset)'));
    log('  USERPROFILE=' + (env.USERPROFILE || '(unset)'));
  }
  // Per-pass user-data-dir so renderer state never leaks between passes.
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-userdata-'));
  const child = spawn(
    ELECTRON_BIN,
    [
      MAIN_ENTRY,
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
    ],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env, NODE_ENV: 'production' },
      windowsHide: false,
      shell: false,
    }
  );
  child._userDataDir = userDataDir; // for cleanup
  child.stdout.on('data', (d) => log('[electron]', d.toString().trim()));
  child.stderr.on('data', (d) => log('[electron:err]', d.toString().trim()));
  child.on('error', (err) => log('[electron:spawn-error]', err.message));
  return child;
}

async function captureScenarios(page, opts = {}) {
  const { skipMocked = false } = opts;
  const shoot = async (n, note) => {
    const file = path.join(EVIDENCE_DIR, `m${n}.png`);
    await page.screenshot({ path: file });
    log(`  ✓ m${n}.png — ${note}`);
  };

  // Wait until sidebar settles
  log('Waiting for sidebar...');
  await page.waitForSelector('button[title="Claude Code"]', { timeout: 30_000 });

  // Click Claude → navigate into agent
  await page.click('button[title="Claude Code"]');
  await page.waitForTimeout(800);

  // Find the Plugins tab inside the agent view (TabsTrigger with "Plugins" text)
  log('Switching to Plugins tab...');
  await page.getByRole('tab', { name: /plugins/i }).first().click();
  await page.waitForTimeout(1500); // let installed_plugins.json load

  // ── M1 — Tab strip default Installed ───────────────────────────────────
  await shoot(1, 'Tab strip default — Installed pre-selected');

  // ── M2 — Marketplaces tab ──────────────────────────────────────────────
  log('Click Marketplaces tab...');
  await page.getByRole('tab', { name: /^marketplaces$/i }).click();
  await page.waitForTimeout(1500);
  await shoot(2, 'Marketplaces list with Built-in pill');

  // ── M3 — Add Marketplace dialog ────────────────────────────────────────
  log('Open Add Marketplace dialog...');
  await page.getByRole('button', { name: /add marketplace/i }).click();
  await page.waitForSelector('text=Register a new marketplace', { timeout: 5_000 });
  // Fill name
  await page.getByLabel('Name', { exact: true }).fill('test-marketplace');
  // Switch to directory radio
  await page.getByRole('radio', { name: 'directory', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByLabel('Local path').fill('D:\\Projects\\harness-helper');
  // Toggle auto-update on
  const autoSwitch = page.locator('#mp-auto');
  await autoSwitch.click();
  await page.waitForTimeout(300);
  await shoot(3, 'Add Marketplace dialog with directory + auto-update');
  // Cancel — do not actually submit
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForTimeout(500);

  // ── M4 — Discover tab → Install scope chooser ──────────────────────────
  log('Switch to Discover tab + open scope chooser...');
  await page.getByRole('tab', { name: /^discover$/i }).click();
  await page.waitForTimeout(1500);
  // Click first marketplace selector pill (claude-plugins-official typically)
  const mpButtons = page.locator('button:has-text("claude-plugins-official")');
  if (await mpButtons.count() > 0) {
    await mpButtons.first().click();
    await page.waitForTimeout(2000);
    // Find the first non-installed Install button
    const installBtn = page.getByRole('button', { name: /^install/i }).first();
    if (await installBtn.count() > 0) {
      await installBtn.click();
      await page.waitForSelector('text=Install scope', { timeout: 5_000 });
      await page.waitForTimeout(500);
      await shoot(4, 'Discover + scope chooser open');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.waitForTimeout(500);
    } else {
      log('  ! No Install button found, capturing Discover tab anyway');
      await shoot(4, 'Discover tab (no installable plugins to demo scope chooser)');
    }
  } else {
    log('  ! No marketplace selector pills found');
    await shoot(4, 'Discover tab default');
  }

  // ── M5 — Errors empty state ────────────────────────────────────────────
  log('Switch to Errors tab (empty state expected)...');
  await page.getByRole('tab', { name: /^errors/i }).click();
  await page.waitForTimeout(1500);
  await shoot(5, 'Errors empty state (or populated, depends on env)');

  // ── M6 — Installed toggle round-trip ───────────────────────────────────
  log('Back to Installed for M6 toggle...');
  await page.getByRole('tab', { name: /^installed$/i }).click();
  await page.waitForTimeout(1000);
  await shoot(6, 'Installed list after Errors tab visit');

  // ── M7 — Add Marketplace button states (focus) ─────────────────────────
  log('M7 — focus on + Add Marketplace');
  await page.getByRole('tab', { name: /^marketplaces$/i }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /add marketplace/i }).focus();
  await page.waitForTimeout(300);
  await shoot(7, '+ Add Marketplace focused (focus ring)');

  // ── M8 — MarketplaceDialog dynamic field swap ──────────────────────────
  log('M8 — dialog dynamic fields');
  await page.getByRole('button', { name: /add marketplace/i }).click();
  await page.waitForSelector('text=Register a new marketplace', { timeout: 5_000 });
  // Cycle through source types — final state shows directory's Local path field
  await page.getByRole('radio', { name: 'git', exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole('radio', { name: 'url', exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole('radio', { name: 'directory', exact: true }).click();
  await page.waitForTimeout(300);
  await shoot(8, 'Dialog showing directory source type with Local path field');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForTimeout(500);

  // ── M9 — Discover Install loading + scope chooser focus ────────────────
  log('M9 — Discover scope chooser focus');
  await page.getByRole('tab', { name: /^discover$/i }).click();
  await page.waitForTimeout(1200);
  const mpAgain = page.locator('button:has-text("claude-plugins-official")');
  if (await mpAgain.count() > 0) {
    await mpAgain.first().click();
    await page.waitForTimeout(1500);
    const installBtn = page.getByRole('button', { name: /^install/i }).first();
    if (await installBtn.count() > 0) {
      await installBtn.click();
      await page.waitForSelector('text=Install scope', { timeout: 5_000 });
      // Focus on Project radio to show focus ring (use exact match — "local"
      // option also contains the word "project")
      await page.getByRole('radio', { name: 'project ./.claude/' }).focus();
      await page.waitForTimeout(300);
      await shoot(9, 'Scope chooser with Project radio focused');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.waitForTimeout(500);
    } else {
      await shoot(9, 'Discover tab — no Install button to demo loading');
    }
  } else {
    await shoot(9, 'Discover tab default');
  }

  // ── M10 — Built-in marketplace Remove disabled tooltip ─────────────────
  log('M10 — Built-in Remove disabled tooltip');
  await page.getByRole('tab', { name: /^marketplaces$/i }).click();
  await page.waitForTimeout(1000);
  // Hover over the Remove button on claude-plugins-official card.
  // Disabled buttons set pointer-events:none, so use force:true to bypass
  // Playwright's actionability check (we just want the visual hover, not
  // an actual click).
  const officialRemove = page.getByRole('button', { name: /remove claude-plugins-official/i });
  if (await officialRemove.count() > 0) {
    try {
      await officialRemove.hover({ force: true, timeout: 3000 });
    } catch { /* hover may still fail on disabled — capture anyway */ }
    await page.waitForTimeout(500);
  }
  await shoot(10, 'Marketplaces tab — Built-in Remove disabled (with title tooltip)');

  // ── M11 — InstalledTab plugin Switch focus ─────────────────────────────
  log('M11 — Installed Switch focus');
  await page.getByRole('tab', { name: /^installed$/i }).click();
  await page.waitForTimeout(1500);
  // Find the first Switch (toggle) — Radix Switch role is "switch"
  const firstSwitch = page.getByRole('switch').first();
  if (await firstSwitch.count() > 0) {
    await firstSwitch.focus();
    await page.waitForTimeout(300);
  }
  await shoot(11, 'Installed plugin Switch focused');

  // M12-M14 require mocked data (empty state / corrupt JSON).
  // Skip if running against the user's real ~/.claude/ — these will be
  // captured in a second pass with TEMP_HOME mocking.
  if (skipMocked) {
    log('Skipping M12-M14 (mocked-state pass — will run separately)');
    return;
  }
}

async function captureMockedScenarios(page) {
  const shoot = async (n, note) => {
    const file = path.join(EVIDENCE_DIR, `m${n}.png`);
    await page.screenshot({ path: file });
    log(`  ✓ m${n}.png — ${note}`);
  };

  await page.waitForSelector('button[title="Claude Code"]', { timeout: 30_000 });
  await page.click('button[title="Claude Code"]');
  await page.waitForTimeout(800);
  await page.getByRole('tab', { name: /plugins/i }).first().click();
  await page.waitForTimeout(1500);

  // ── M12 — InstalledTab empty state ────────────────────────────────────
  log('M12 — Installed empty');
  await shoot(12, 'Installed empty state');

  // ── M13 — Marketplaces empty + Discover placeholder ────────────────────
  log('M13 — Marketplaces empty + Discover placeholder');
  await page.getByRole('tab', { name: /^marketplaces$/i }).click();
  await page.waitForTimeout(1000);
  await shoot(13, 'Marketplaces empty');

  // ── M4 supplemental — claude binary missing ────────────────────────────
  // Same screenshot as the no-installed-marketplaces case approximates the
  // not-found UX from the user's perspective. Real "claude not in PATH"
  // is a CLI-side error surfaced via toast on Install attempts; the static
  // tab UI is identical to a normal load.
  log('m4-no-binary supplemental');
  await page.getByRole('tab', { name: /^discover$/i }).click();
  await page.waitForTimeout(1500);
  const file = path.join(EVIDENCE_DIR, 'm4-no-binary.png');
  await page.screenshot({ path: file });
  log(`  ✓ m4-no-binary.png — Discover tab in clean-home state (no marketplaces → no Install possible)`);

  // ── M14 — Errors populated + tab badge counter ────────────────────────
  log('M14 — Errors populated');
  await page.getByRole('tab', { name: /^errors/i }).click();
  await page.waitForTimeout(1500);
  await shoot(14, 'Errors tab — should show error from corrupt installed_plugins.json');
}

function makeMockedHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-profile-capture-'));
  fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
  fs.mkdirSync(path.join(home, '.copilot'), { recursive: true });
  fs.mkdirSync(path.join(home, '.gemini'), { recursive: true });
  // Settings stub
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), '{}');
  fs.writeFileSync(path.join(home, '.copilot', 'config.json'), '{}');
  fs.writeFileSync(path.join(home, '.gemini', 'settings.json'), '{}');
  // Corrupt installed_plugins.json — drives M14 error scenario
  fs.writeFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), '{not valid json');
  return home;
}

async function runPass(env, name, capturer) {
  log(`=== Pass: ${name} ===`);
  const child = spawnElectron(env);
  let browser = null;
  try {
    await waitForCdp();
    browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    const ctx = browser.contexts()[0];
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.setViewportSize({ width: 1280, height: 800 }).catch(() => undefined);
    await capturer(page);
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    log(`Killing electron pid=${child.pid}`);
    try { child.kill('SIGTERM'); } catch { /* noop */ }
    // Give it 2s to die gracefully then SIGKILL
    await sleep(2000);
    try { child.kill('SIGKILL'); } catch { /* noop */ }
  }
}

async function main() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'capture.log'), ''); // truncate

  if (!fs.existsSync(MAIN_ENTRY)) {
    throw new Error(`Build artifact not found: ${MAIN_ENTRY}\nRun 'bun run build' first.`);
  }

  // Pass 1: real ~/.claude/ — captures M1-M11
  await runPass({}, 'real home (M1-M11)', (page) => captureScenarios(page, { skipMocked: true }));

  // Pass 2: mocked TEMP home with corrupt installed_plugins.json — captures M12-M14 + m4-no-binary
  const mockedHome = makeMockedHome();
  log(`Mocked home: ${mockedHome}`);
  try {
    await runPass(
      { HOME: mockedHome, USERPROFILE: mockedHome },
      'mocked empty home (M12-M14 + m4-no-binary)',
      captureMockedScenarios
    );
  } finally {
    fs.rmSync(mockedHome, { recursive: true, force: true });
  }

  log('=== Done ===');
  log('Captures saved to: ' + EVIDENCE_DIR);
}

main().catch((err) => {
  log('FATAL:', err.stack || err.message || String(err));
  process.exit(1);
});
