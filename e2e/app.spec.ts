import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures';

// ─── Agent sidebar ─────────────────────────────────────────────────────────────

test.describe('Agent sidebar', () => {
  test('shows all four agents', async ({ page }) => {
    // All four icon buttons must be visible (the fixture already confirmed Claude Code
    // loaded; this assertion covers the full set).
    await expect(page.getByTitle('Claude Code')).toBeVisible();
    await expect(page.getByTitle('GitHub Copilot')).toBeVisible();
    await expect(page.getByTitle('Gemini CLI')).toBeVisible();
    await expect(page.getByTitle('Shared Skills')).toBeVisible();
  });
});

// ─── Settings navigation ───────────────────────────────────────────────────────

test.describe('Settings navigation', () => {
  test('default view shows active Settings tab with JSON editor', async ({ page }) => {
    // Claude Code is selected by default.  The Settings tab should be active and
    // the editor heading should be visible.
    const settingsTab = page.getByRole('tab', { name: 'Settings' });
    await expect(settingsTab).toBeVisible();
    await expect(settingsTab).toHaveAttribute('data-state', 'active');
    await expect(page.getByText('Claude Code Settings')).toBeVisible();
  });
});

// ─── Save settings ─────────────────────────────────────────────────────────────

test.describe('Save settings', () => {
  test('persists edited JSON to disk', async ({ page, tempHome }) => {
    // Wait for the JSON editor to finish its initial file load.
    await expect(page.locator('.cm-content[contenteditable="true"]')).toBeVisible({
      timeout: 10_000,
    });

    // Edit the CodeMirror editor: select all then type new valid JSON.
    const editor = page.locator('.cm-content[contenteditable="true"]');
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('{"model":"claude-sonnet-4"}');

    // Save button should now be enabled (isDirty=true).
    // getByRole with name:'Save' matches the exact accessible name, so it won't match
    // the button while it shows "Saving..." — giving us a built-in state filter.
    const saveBtn = page.getByRole('button', { name: 'Save' });
    await expect(saveBtn).toBeEnabled({ timeout: 3_000 });

    await saveBtn.click();

    // After the full save cycle: file.write → load() → isDirty=false, the button
    // returns to text "Save" and becomes disabled.  The locator itself won't match
    // during "Saving..." so this assertion blocks until the cycle is complete.
    await expect(saveBtn).toBeDisabled({ timeout: 10_000 });

    // Verify the file was actually written to the test home directory.
    const written = fs.readFileSync(
      path.join(tempHome, '.claude', 'settings.json'),
      'utf-8',
    );
    expect(written).toContain('claude-sonnet-4');
  });
});
