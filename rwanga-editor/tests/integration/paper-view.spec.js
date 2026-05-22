// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Fork A — Brick 3 integration tests (Playwright + Electron).
//
// Verifies the Paper-view <-> Flow round trip in the REAL Electron app —
// the behaviour JSDOM unit tests cannot prove: true visual hide/show of
// the editor, caret restoration, live typing, and the undo stack.
//
// Prerequisite: `npm run build:renderer` (the app loads the built bundle).
// Run with:     npm run test:e2e
//
// Single-instance unblock (Option A — TEST HARNESS ONLY): each launch gets
// its OWN temporary Electron `userData` directory via the `--user-data-dir`
// command-line switch. Electron's single-instance lock is keyed to the
// userData path, so every isolated profile acquires its lock NORMALLY.
// `electron/main.js` and production single-instance behaviour are entirely
// untouched — there is no production runtime change and no test-only gate.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');

let app, page, userDataDir;

test.beforeEach(async () => {
  // Unique throwaway profile per launch — isolates the single-instance lock.
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-e2e-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  // Wait for the renderer runtime + view-mode controller to be ready.
  await page.waitForFunction(() => !!(window.Rga && window.Rga.ViewMode));
});

test.afterEach(async () => {
  if (app) { await app.close(); app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

function setMode(mode) {
  return page.evaluate((m) => window.Rga.ViewMode.set(m), mode);
}

// 1 — Flow -> Print -> Flow round trip.
test('Flow -> Print -> Flow round trip switches the active mode', async () => {
  expect(await page.evaluate(() => window.Rga.ViewMode.get())).toBe('flow');
  await setMode('print');
  expect(await page.evaluate(() => window.Rga.ViewMode.get())).toBe('print');
  await setMode('flow');
  expect(await page.evaluate(() => window.Rga.ViewMode.get())).toBe('flow');
});

// 2 — The live editor visually disappears in Print.
test('the live #editor visually disappears in Print and returns in Flow', async () => {
  await expect(page.locator('#editor')).toBeVisible();
  await setMode('print');
  await expect(page.locator('#editor')).toBeHidden();
  await setMode('flow');
  await expect(page.locator('#editor')).toBeVisible();
});

// 3 — Paper page leaves appear in Print.
test('Paper page leaves appear in Print mode', async () => {
  await setMode('print');
  await expect(page.locator('#rga-paper-view-root .rga-page-sheet').first()).toBeVisible();
});

// 4 — Return to Flow restores the editing caret.
test('returning to Flow restores the editing caret', async () => {
  await page.locator('#editor').click();
  await setMode('print');
  await setMode('flow');
  const caretInEditor = await page.evaluate(() => {
    const ed = document.querySelector('#editor');
    return !!(ed && document.activeElement && ed.contains(document.activeElement));
  });
  expect(caretInEditor).toBe(true);
});

// 5 — Enter + typing works after a Print round trip.
test('Enter and typing work after a Print round trip', async () => {
  await page.locator('#editor').click();
  await setMode('print');
  await setMode('flow');
  await page.locator('#editor').click();
  await page.keyboard.press('Enter');
  await page.keyboard.type('text after round trip');
  await expect(page.locator('#editor')).toContainText('text after round trip');
});

// 6 — The undo stack survives a Print round trip.
test('the undo stack survives a Print round trip', async () => {
  await page.locator('#editor').click();
  await page.keyboard.type('undo me please');
  await setMode('print');
  await setMode('flow');
  await page.locator('#editor').click();
  await page.keyboard.press('Control+z');
  await expect(page.locator('#editor')).not.toContainText('undo me please');
});

// 7 — Brick 6: click-to-edit affordance.
test('clicking a block in Paper view returns to Flow with a working caret', async () => {
  await page.locator('#editor').click();
  await page.keyboard.type('clickable manuscript line');
  await setMode('print');
  // click a rendered Paper block — the read-only "edit in Flow" affordance
  await page.locator('#rga-paper-view-root .rga-print-block').first().click();
  expect(await page.evaluate(() => window.Rga.ViewMode.get())).toBe('flow');
  await expect(page.locator('#editor')).toBeVisible();
  // the restored caret is live — typing lands in the editor
  await page.keyboard.type(' EDITED');
  await expect(page.locator('#editor')).toContainText('EDITED');
});
