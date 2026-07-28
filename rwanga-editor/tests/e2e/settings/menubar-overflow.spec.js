// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// GAP-3-1 — no feature may lose its ONLY menu route at any window size.
//
// The defect: the responsive rules hide trailing menubar items — compact hides
// Tags/Tools/Export/Help, narrow keeps only File/Edit/View — with no overflow.
// Settings' only menu entry lives in Tools, so on any laptop under Windows
// display scaling the Settings menu route simply vanished, along with every
// Export and Help entry. The existing tests stayed green because they assert
// COMMAND REGISTRATION, not menu reachability — which is exactly the gap this
// spec closes: it asserts what the user can actually reach.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { closeApp } = require('../../helpers/app-teardown');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

let app, page, userDataDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-gap31-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Shell && window.Rga.Shell.Menubar
    && document.querySelector('#rga-shell-menubar')));
});

test.afterEach(async () => {
  if (app) { await closeApp(app); app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

// Resize the real OS window and let the responsive engine settle.
async function setWindowWidth(width) {
  await app.evaluate(async ({ BrowserWindow }, w) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win.isMaximized()) win.unmaximize();
    const [, h] = win.getSize();
    win.setSize(w, h);
  }, width);
  await page.waitForTimeout(400);   // responsive debounce is 100ms
  await page.evaluate(() => window.Rga.Shell.Menubar.syncOverflow());
}

// Every menu label the user can actually open, counting the overflow's contents.
async function reachableMenuLabels() {
  return page.evaluate(() => {
    const menubar = document.querySelector('#rga-shell-menubar');
    const visible = [];
    menubar.querySelectorAll('.rga-shell-menubar-item[data-menu]').forEach((b) => {
      if (b.dataset.menu === 'overflow') return;
      if (getComputedStyle(b).display !== 'none') visible.push(b.dataset.menu);
    });
    const hidden = window.Rga.Shell.Menubar._hiddenMenuKeys();
    const overflowBtn = menubar.querySelector('.rga-shell-menubar-item[data-menu="overflow"]');
    const overflowUsable = !!overflowBtn
      && !overflowBtn.hidden
      && getComputedStyle(overflowBtn).display !== 'none';
    return {
      mode: (document.getElementById('app') || {}).className || '',
      visible, hidden, overflowUsable,
      overflowItems: window.Rga.Shell.Menubar._overflowDef()
        .filter((i) => i.type !== 'separator' && i.type !== 'header')
        .map((i) => i.label)
    };
  });
}

for (const width of [1600, 1150, 900]) {
  test(`GAP-3-1 — at ${width}px every menu is still reachable`, async () => {
    await setWindowWidth(width);
    const r = await reachableMenuLabels();
    // eslint-disable-next-line no-console
    console.log(`[GAP-3-1 ${width}px] ` + JSON.stringify(r));

    const ALL = ['file', 'edit', 'view', 'script', 'tags', 'tools', 'export', 'help'];
    const reachable = r.visible.concat(r.hidden.filter(() => r.overflowUsable));

    ALL.forEach((key) => {
      expect(reachable, `at ${width}px the "${key}" menu is unreachable — `
        + `visible=[${r.visible}] hidden=[${r.hidden}] overflowUsable=${r.overflowUsable}`)
        .toContain(key);
    });

    // If anything is hidden, the overflow must be present AND actually carry
    // those menus' items — an empty overflow button is not a route.
    if (r.hidden.length > 0) {
      expect(r.overflowUsable, `menus ${r.hidden} are hidden but the overflow button is not usable`)
        .toBe(true);
      expect(r.overflowItems.length,
        `the overflow menu is empty while ${r.hidden} are hidden`).toBeGreaterThan(0);
    }
  });
}

test('GAP-3-1 — Settings stays reachable through the menu at a laptop width', async () => {
  await setWindowWidth(1150);   // the user's real case: 1440px @ ~125% scaling

  const state = await page.evaluate(() => ({
    toolsHidden: window.Rga.Shell.Menubar._hiddenMenuKeys().indexOf('tools') >= 0,
    overflowLabels: window.Rga.Shell.Menubar._overflowDef()
      .filter((i) => i.type !== 'separator' && i.type !== 'header')
      .map((i) => i.label)
  }));
  // eslint-disable-next-line no-console
  console.log('[GAP-3-1 settings] ' + JSON.stringify(state));

  const settingsEntry = state.overflowLabels.filter((l) => /settings/i.test(l));
  if (state.toolsHidden) {
    expect(settingsEntry.length,
      `Tools is hidden at this width and the overflow does not offer Settings; `
      + `overflow carries: ${state.overflowLabels}`).toBeGreaterThan(0);
  }

  // And it must actually open and be clickable, not merely exist in a def.
  const overflow = page.locator('.rga-shell-menubar-item[data-menu="overflow"]');
  if (state.toolsHidden) {
    await expect(overflow).toBeVisible();
    await overflow.click();
    const dropdown = page.locator('#rga-shell-menubar-dropdown');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('.rga-shell-menubar-dropdown-item', { hasText: /settings/i }).first())
      .toBeVisible();
  }
});
