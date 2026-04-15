import { test as base, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

// CJS wrapper used as Playwright's entry point — see electron-entry.cjs for why.
const MAIN = path.resolve(process.cwd(), 'e2e/electron-entry.cjs');

type E2EFixtures = {
  tempHome: string;
  electronApp: ElectronApplication;
  page: Page;
};

export const test = base.extend<E2EFixtures>({
  // Per-test isolated home directory with minimal stub config files.
  // Checked once here so all tests fail fast with the same helpful message.
  tempHome: async ({}, use) => {
    if (!fs.existsSync(MAIN)) {
      throw new Error(
        `Build artifact not found: ${MAIN}\nRun 'bun run build' before running E2E tests.`,
      );
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-profile-e2e-'));
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.copilot'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.gemini'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), '{}');
    fs.writeFileSync(path.join(dir, '.copilot', 'config.json'), '{}');
    fs.writeFileSync(path.join(dir, '.gemini', 'settings.json'), '{}');
    await use(dir);
    // Teardown runs after electronApp closes (dependency order), so no file-lock risk.
    fs.rmSync(dir, { recursive: true, force: true });
  },

  // Launch a fresh Electron instance for each test (full isolation).
  // Depends on tempHome so it's torn down before tempHome cleanup.
  electronApp: async ({ tempHome }, use) => {
    const app = await electron.launch({
      args: [MAIN],
      env: { ...process.env, HOME: tempHome, USERPROFILE: tempHome },
    });
    await use(app);
    await app.close(); // wait for process exit before tempHome is deleted
  },

  // Get the first Electron window and wait until the sidebar is populated.
  page: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    // Wait for agents to load: the first sidebar button must appear.
    await window.waitForSelector('button[title="Claude Code"]', { timeout: 20_000 });
    await use(window);
  },
});

export { expect } from '@playwright/test';
