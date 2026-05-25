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

// chromeVisibility returns BOTH the policy-class membership and the
// effective computed display. The class is the workspace-policy lever
// (TabManager owns it); the computed display is the runtime truth
// (CSS rule .rga-hidden-by-workspace-policy { display:none } makes
// them line up). Asserting both keeps the spec honest if the CSS
// rule is ever dropped or shadowed.
const HIDDEN_CLASS = 'rga-hidden-by-workspace-policy';

async function chromeVisibility(page) {
  return await page.evaluate((cls) => {
    function read(id) {
      const el = document.getElementById(id);
      return {
        hiddenByPolicy: el.classList.contains(cls),
        computedDisplay: getComputedStyle(el).display
      };
    }
    return {
      toolbar:     read('rga-shell-toolbar'),
      bottomPanel: read('bottom-panel'),
      inspector:   read('inspector-panel')
    };
  }, HIDDEN_CLASS);
}

async function activateFirstDoc(page) {
  await page.evaluate(() => {
    const TM = window.Rga.TabManager;
    const doc = TM.tabs().find(function(t) { return t.kind === 'document'; });
    if (doc) TM.activate(doc.id);
  });
  await page.waitForFunction((cls) =>
    !document.getElementById('rga-shell-toolbar').classList.contains(cls),
    HIDDEN_CLASS);
}

test('chrome — document tab keeps toolbar/bottomPanel/inspector visible', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-chrome-doc-'));
  const { app, page } = await launch(userDataDir);
  try {
    const v = await chromeVisibility(page);
    expect(v.toolbar.hiddenByPolicy).toBe(false);
    expect(v.bottomPanel.hiddenByPolicy).toBe(false);
    expect(v.inspector.hiddenByPolicy).toBe(false);
    expect(v.toolbar.computedDisplay).not.toBe('none');
    expect(v.bottomPanel.computedDisplay).not.toBe('none');
    expect(v.inspector.computedDisplay).not.toBe('none');
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
    expect(v.toolbar.hiddenByPolicy).toBe(true);
    expect(v.bottomPanel.hiddenByPolicy).toBe(true);
    expect(v.inspector.hiddenByPolicy).toBe(true);
    expect(v.toolbar.computedDisplay).toBe('none');
    expect(v.bottomPanel.computedDisplay).toBe('none');
    expect(v.inspector.computedDisplay).toBe('none');
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
    expect(before.toolbar.hiddenByPolicy).toBe(false);

    await page.keyboard.press('Control+Comma');
    await page.waitForSelector(WS_SEL + ' .rga-settings-rows .rga-settings-row');
    const open = await chromeVisibility(page);
    expect(open.toolbar.hiddenByPolicy).toBe(true);
    expect(open.bottomPanel.hiddenByPolicy).toBe(true);
    expect(open.inspector.hiddenByPolicy).toBe(true);

    await activateFirstDoc(page);
    const after = await chromeVisibility(page);
    expect(after.toolbar.hiddenByPolicy).toBe(false);
    expect(after.bottomPanel.hiddenByPolicy).toBe(false);
    expect(after.inspector.hiddenByPolicy).toBe(false);
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
