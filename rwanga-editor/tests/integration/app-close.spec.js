// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Persistence Safety — Brick 2 (app-close dirty guard). Proves: closing the
// app with unsaved changes intercepts the close and prompts; Cancel keeps the
// app open; Discard lets it close.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');

let app, page, userDataDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-e2e-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(
    () => !!(window.Rga && window.Rga.FileManager
      && window.Rga.FileManager.getActive && window.Rga.FileManager.getActive()
      && window.Rga.TabManager && window.Rga.TabManager._editorView
      && window.Rga.TabManager._editorView())
  );
});

test.afterEach(async () => {
  if (app) { try { await app.close(); } catch (_) {} app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

test('closing with unsaved changes prompts, and Cancel keeps the app open', async () => {
  // Make the active document dirty. A dirty document is this test's premise —
  // wait until the edit has registered before proceeding.
  await page.locator('#editor').click();
  await page.keyboard.type('unsavedmarker');
  await page.waitForFunction(() => window.Rga.FileManager.getActive().dirty);

  // Trigger an app close.
  await page.evaluate(() => window.rwanga.window.close());

  // The guard intercepted it — the unsaved-changes modal appears.
  await expect(page.locator('#unsaved-modal')).toBeVisible();

  // Cancel.
  await page.locator('#unsaved-modal [data-choice="cancel"]').click();
  await expect(page.locator('#unsaved-modal')).toBeHidden();

  // The app is still alive and the document is still here, still dirty.
  expect(await page.evaluate(() => window.Rga.FileManager.getActive().dirty)).toBe(true);
});

test('closing with unsaved changes and choosing Discard closes the app', async () => {
  await page.locator('#editor').click();
  await page.keyboard.type('unsavedmarker');
  await page.waitForFunction(() => window.Rga.FileManager.getActive().dirty);

  const appClosed = app.waitForEvent('close');
  await page.evaluate(() => window.rwanga.window.close());
  await expect(page.locator('#unsaved-modal')).toBeVisible();

  // Clicking Discard makes the app quit. Use dispatchEvent so the click is not
  // followed by Playwright's post-action wait, which would race the teardown
  // the click itself triggers.
  await page.locator('#unsaved-modal [data-choice="discard"]').dispatchEvent('click');

  // The verdict was "allow" — the app actually closes.
  await appClosed;
});
