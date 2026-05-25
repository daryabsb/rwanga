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
        hiddenByPolicy:  el.classList.contains(cls),
        computedDisplay: getComputedStyle(el).display,
        width:           Math.round(el.getBoundingClientRect().width)
      };
    }
    function readGrid(id, axis) {
      const el = document.getElementById(id);
      return getComputedStyle(el)
        .getPropertyValue('grid-template-' + axis).trim();
    }
    return {
      toolbar:     read('rga-shell-toolbar'),
      bottomPanel: read('bottom-panel'),
      inspector:   read('inspector-panel'),
      // Layout-collapse signals: when the workspace policy hides the
      // inspector/bottom-panel, the grid track collapses to 0px. The
      // settings workspace width should grow.
      workspaceCols:    readGrid('workspace',     'columns'),
      centerColumnRows: readGrid('center-column', 'rows'),
      tabContentHost:   { width: Math.round(document.getElementById('tab-content-host').getBoundingClientRect().width) }
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

test('chrome (freeze) — tab-bar Y position is identical across doc → Settings → doc', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-chrome-freeze-'));
  const { app, page } = await launch(userDataDir);
  try {
    async function ys() {
      return await page.evaluate(() => ({
        toolbarY: Math.round(document.getElementById('rga-shell-toolbar').getBoundingClientRect().y),
        toolbarH: Math.round(document.getElementById('rga-shell-toolbar').getBoundingClientRect().height),
        tabBarY:  Math.round(document.getElementById('tab-bar').getBoundingClientRect().y),
        toolbarVisibility: getComputedStyle(document.getElementById('rga-shell-toolbar')).visibility,
        toolbarDisplay:    getComputedStyle(document.getElementById('rga-shell-toolbar')).display
      }));
    }
    const a = await ys();
    expect(a.toolbarVisibility).toBe('visible');
    expect(a.toolbarH).toBeGreaterThan(0);

    await page.keyboard.press('Control+Comma');
    await page.waitForSelector(WS_SEL + ' .rga-settings-rows .rga-settings-row');
    const b = await ys();
    // Geometry frozen: toolbar row still h>0 and same Y; tab-bar Y unchanged.
    expect(b.toolbarY).toBe(a.toolbarY);
    expect(b.toolbarH).toBe(a.toolbarH);
    expect(b.tabBarY).toBe(a.tabBarY);
    // Toolbar contents are inert + invisible.
    expect(b.toolbarVisibility).toBe('hidden');
    expect(b.toolbarDisplay).not.toBe('none');

    await activateFirstDoc(page);
    const c = await ys();
    expect(c.toolbarY).toBe(a.toolbarY);
    expect(c.tabBarY).toBe(a.tabBarY);
    expect(c.toolbarVisibility).toBe('visible');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('chrome (scroll) — Settings nav rail is independent of content scroll; search stays sticky', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-chrome-scroll-'));
  const { app, page } = await launch(userDataDir);
  try {
    await page.keyboard.press('Control+Comma');
    await page.waitForSelector(WS_SEL + ' .rga-settings-rows .rga-settings-row');

    // 1. Both columns are scroll containers (overflow-y allows scrolling).
    const containers = await page.evaluate((sel) => {
      const ws = document.querySelector(sel);
      const nav = ws.querySelector('.rga-settings-nav');
      const content = ws.querySelector('.rga-settings-content');
      return {
        navOverflow:     getComputedStyle(nav).overflowY,
        contentOverflow: getComputedStyle(content).overflowY,
        navY0:           Math.round(nav.getBoundingClientRect().y),
        searchY0:        Math.round(ws.querySelector('.rga-settings-search-input').getBoundingClientRect().y)
      };
    }, WS_SEL);
    expect(containers.navOverflow).toBe('auto');
    expect(containers.contentOverflow).toBe('auto');

    // 2. Scroll the content area to the bottom. Nav and search must not move.
    await page.evaluate((sel) => {
      const content = document.querySelector(sel).querySelector('.rga-settings-content');
      content.scrollTop = content.scrollHeight;
    }, WS_SEL);
    // Brief settle.
    await page.waitForTimeout(50);
    const after = await page.evaluate((sel) => {
      const ws = document.querySelector(sel);
      const nav = ws.querySelector('.rga-settings-nav');
      const search = ws.querySelector('.rga-settings-search-input');
      const content = ws.querySelector('.rga-settings-content');
      return {
        navY:        Math.round(nav.getBoundingClientRect().y),
        searchY:     Math.round(search.getBoundingClientRect().y),
        contentScrollTop: content.scrollTop
      };
    }, WS_SEL);
    // The content actually scrolled (sanity).
    expect(after.contentScrollTop).toBeGreaterThan(0);
    // Nav rail did not move — independent scroll container.
    expect(after.navY).toBe(containers.navY0);
    // Search stayed put — sticky at top of content column.
    expect(after.searchY).toBe(containers.searchY0);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('chrome (layout) — tab-content-host grows when Settings hides the inspector + bottom-panel tracks', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-chrome-grow-'));
  const { app, page } = await launch(userDataDir);
  try {
    const docState = await chromeVisibility(page);

    await page.keyboard.press('Control+Comma');
    await page.waitForSelector(WS_SEL + ' .rga-settings-rows .rga-settings-row');
    const settingsState = await chromeVisibility(page);

    // 1. Inspector column collapsed: last value in #workspace
    //    grid-template-columns ends with '0px' (was var(--inspector-width)
    //    ~ 280px).
    expect(/\b0px(\s+0px)?\s*$/.test(settingsState.workspaceCols)).toBe(true);
    // 2. Bottom-panel row collapsed: #center-column rows end with '0px 0px'.
    expect(/\b0px\s+0px\s*$/.test(settingsState.centerColumnRows)).toBe(true);
    // 3. tab-content-host grew (it now fills its flex parent, which itself
    //    grew because the inspector column collapsed).
    expect(settingsState.tabContentHost.width).toBeGreaterThan(docState.tabContentHost.width);
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
