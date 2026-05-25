// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings workspace editable controls — Slice 5C integration.
//
// End-to-end coverage:
//   1. Edits made through a workspace control persist across an app
//      restart (Store.set → prefs.write → prefs.read hydration).
//   2. Edits made through a workspace control take effect immediately
//      (Store.effective reflects the new value while the workspace
//      is still mounted).
//
// Other 5C behaviors (toggle / select / radio / number / text writes,
// requiresPro disabled, unsupported types read-only, revert-on-reject,
// search+edit interleave) are covered by the owned unit suite at
// tests/unit/shell/settings-workspace.test.js §11–§20.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');
const WS_SEL   = '[data-renderer="workspace"][data-workspace-kind="settings"]';

async function launchAndOpenSettings(userDataDir) {
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.TabManager && window.Rga.Workspaces &&
    window.Rga.Workspaces.get && window.Rga.Workspaces.get('settings')
  ));
  await page.keyboard.press('Control+Comma');
  await page.waitForSelector(WS_SEL + ' .rga-settings-rows .rga-settings-row');
  return { app, page };
}

async function gotoEditor(page) {
  await page.evaluate(() => {
    document.querySelector(
      '[data-renderer="workspace"][data-workspace-kind="settings"] ' +
      '[data-section-id="editor"]')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForSelector(
    WS_SEL + ' .rga-settings-row[data-setting-id="editor.highlightCurrentLine"]');
}

test('Slice 5C — toggling a boolean control updates Store.effective immediately', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-5c-immediate-'));
  const { app, page } = await launchAndOpenSettings(userDataDir);
  try {
    await gotoEditor(page);

    const before = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('editor.highlightCurrentLine'));
    expect(before).toBe(true);

    // Uncheck the highlight toggle via a real DOM change event.
    await page.evaluate(() => {
      const cb = document.querySelector(
        '[data-renderer="workspace"][data-workspace-kind="settings"] ' +
        '.rga-settings-row[data-setting-id="editor.highlightCurrentLine"] ' +
        'input[type="checkbox"]');
      cb.checked = false;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const after = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('editor.highlightCurrentLine'));
    expect(after).toBe(false);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Slice 5C — an edit persists across app restart (prefs.write → prefs.read)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-5c-persist-'));
  try {
    // First launch — flip editor.highlightCurrentLine to false, then
    // wait for the prefs write to flush before closing.
    {
      const { app, page } = await launchAndOpenSettings(userDataDir);
      try {
        await gotoEditor(page);
        await page.evaluate(() => {
          const cb = document.querySelector(
            '[data-renderer="workspace"][data-workspace-kind="settings"] ' +
            '.rga-settings-row[data-setting-id="editor.highlightCurrentLine"] ' +
            'input[type="checkbox"]');
          cb.checked = false;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        });
        // Poll prefs.read until the disk write has landed. The write
        // is fire-and-forget, so we need a small wait window before
        // closing the app.
        await page.waitForFunction(async () => {
          const stored = await window.rwanga.prefs.read();
          return stored && stored['editor.highlightCurrentLine'] === false;
        }, null, { timeout: 5000 });
      } finally {
        await app.close();
      }
    }

    // Second launch — same user-data-dir. The toggle must come up
    // unchecked because hydration restored the persisted value.
    {
      const { app, page } = await launchAndOpenSettings(userDataDir);
      try {
        await gotoEditor(page);
        const checked = await page.$eval(
          WS_SEL + ' .rga-settings-row[data-setting-id="editor.highlightCurrentLine"]' +
          ' input[type="checkbox"]',
          (cb) => cb.checked);
        expect(checked).toBe(false);
        const eff = await page.evaluate(() =>
          window.Rga.Settings.Store.effective('editor.highlightCurrentLine'));
        expect(eff).toBe(false);
      } finally {
        await app.close();
      }
    }
  } finally {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
