// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Workspace chrome ownership — integration spec.
//
// End-to-end:
//   1. App boots with an Untitled document — all three editor-only
//      chrome surfaces (#rga-shell-toolbar, #bottom-panel,
//      #inspector-panel) are visible.
//   2. Opening Settings via Ctrl+, hides all three.
//   3. Activating the document tab again restores all three.
//   4. Singleton: opening Settings twice does not create two tabs.
//
// The unit suite at tests/unit/shell/workspace-chrome-policy.test.js
// covers the policy logic in isolation; this spec proves the wiring
// in the real Electron renderer.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');
const WS_SEL   = '[data-renderer="workspace"][data-workspace-kind="settings"]';

async function launch(userDataDir) {
  const app = await electron.launch({
    args: ['--user-data-dir=' + userDataDir, APP_ROOT]
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.TabManager && window.Rga.Workspaces &&
    window.Rga.Workspaces.get && window.Rga.Workspaces.get('settings')
  ));
  await page.waitForSelector('#editor', { timeout: 8000 });
  return { app, page };
}

async function chromeVisibility(page) {
  return await page.evaluate(() => ({
    toolbar:     getComputedStyle(document.getElementById('rga-shell-toolbar')).display,
    bottomPanel: getComputedStyle(document.getElementById('bottom-panel')).display,
    inspector:   getComputedStyle(document.getElementById('inspector-panel')).display
  }));
}

async function activateFirstDoc(page) {
  await page.evaluate(() => {
    const TM = window.Rga.TabManager;
    const doc = TM.tabs().find(function(t) { return t.kind === 'document'; });
    if (doc) TM.activate(doc.id);
  });
  await page.waitForFunction(() =>
    document.getElementById('rga-shell-toolbar').style.display === '');
}

test('chrome — document tab keeps toolbar/bottomPanel/inspector visible', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-chrome-doc-'));
  const { app, page } = await launch(userDataDir);
  try {
    const v = await chromeVisibility(page);
    expect(v.toolbar).not.toBe('none');
    expect(v.bottomPanel).not.toBe('none');
    expect(v.inspector).not.toBe('none');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('chrome — Settings tab hides toolbar + bottom panel + inspector', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-chrome-settings-'));
  const { app, page } = await launch(userDataDir);
  try {
    await page.keyboard.press('Control+Comma');
    await page.waitForSelector(WS_SEL + ' .rga-settings-rows .rga-settings-row');
    const v = await chromeVisibility(page);
    expect(v.toolbar).toBe('none');
    expect(v.bottomPanel).toBe('none');
    expect(v.inspector).toBe('none');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('chrome — switching back to the document tab restores all three', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-chrome-restore-'));
  const { app, page } = await launch(userDataDir);
  try {
    const before = await chromeVisibility(page);
    expect(before.toolbar).not.toBe('none');

    await page.keyboard.press('Control+Comma');
    await page.waitForSelector(WS_SEL + ' .rga-settings-rows .rga-settings-row');
    const open = await chromeVisibility(page);
    expect(open.toolbar).toBe('none');
    expect(open.bottomPanel).toBe('none');
    expect(open.inspector).toBe('none');

    await activateFirstDoc(page);
    const after = await chromeVisibility(page);
    expect(after.toolbar).not.toBe('none');
    expect(after.bottomPanel).not.toBe('none');
    expect(after.inspector).not.toBe('none');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('chrome — opening Settings twice does not stack tabs (singleton preserved)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-chrome-singleton-'));
  const { app, page } = await launch(userDataDir);
  try {
    await page.keyboard.press('Control+Comma');
    await page.waitForSelector(WS_SEL);
    // Switch to a doc, then re-open Settings.
    await activateFirstDoc(page);
    await page.keyboard.press('Control+Comma');
    await page.waitForSelector(WS_SEL);
    const settingsCount = await page.evaluate(() =>
      document.querySelectorAll(
        '[data-renderer="workspace"][data-workspace-kind="settings"]').length);
    expect(settingsCount).toBe(1);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
