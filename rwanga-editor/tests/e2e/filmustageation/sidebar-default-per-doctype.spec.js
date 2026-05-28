// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.2 — Sidebar default per doc-type.
//
// Verifies the end-to-end boot path in real Electron:
//   - CORE Layout default sidebar.activePanel is null (no screenplay
//     name leaks into shell defaults).
//   - Rga.DocTypes exposes bootDefaultSidebarPanel().
//   - With the screenplay doc-type registered, the boot resolver picks
//     'sceneNavigator' (identical to pre-F1A.2 visible behaviour).
//   - After boot, the sidebar has the Scene Navigator mounted.
//   - The activity-bar rail items still render in doctrine order
//     (regression guard against the slice touching rail grouping).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1a-2-sidebar-default-'));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Shell && window.Rga.Shell.Sidebar &&
    window.Rga.Shell.Layout && window.Rga.DocTypes &&
    typeof window.Rga.DocTypes.bootDefaultSidebarPanel === 'function'));
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// =================================================================
// 1. CORE Layout default — sidebar.activePanel is null pre-init.
//    (The renderer has booted by the time this spec runs, so Layout
//    has already been written by Sidebar.activate; we assert via the
//    DEFAULTS object the module exposes for tests.)
// =================================================================

test('F1A.2 — Rga.Shell.Layout._DEFAULTS.sidebar.activePanel is null (no screenplay name in CORE Layout)', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const layoutDefault = await page.evaluate(() =>
      window.Rga.Shell.Layout._DEFAULTS.sidebar.activePanel);
    expect(layoutDefault).toBe(null);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 2. Rga.DocTypes.bootDefaultSidebarPanel returns 'sceneNavigator'
//    (screenplay is registered and declares this default).
// =================================================================

test('F1A.2 — DocTypes.bootDefaultSidebarPanel returns screenplay\'s declared default', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    // page.evaluate must check the function-typeof INSIDE the page —
    // functions don't survive the JSON roundtrip back to the test
    // process (they come back as undefined).
    const result = await page.evaluate(() => {
      const cfg = window.Rga.DocTypes.get('screenplay');
      return {
        registered:               window.Rga.DocTypes.registered(),
        bootDefault:              window.Rga.DocTypes.bootDefaultSidebarPanel(),
        configDefaultSidebar:     cfg && cfg.defaultSidebarPanel,
        configHasSelectSchema:    !!(cfg && typeof cfg.selectSchema === 'function')
      };
    });
    expect(result.registered).toContain('screenplay');
    expect(result.bootDefault).toBe('sceneNavigator');
    expect(result.configDefaultSidebar).toBe('sceneNavigator');
    expect(result.configHasSelectSchema).toBe(true);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 3. After boot, the sidebar lands on sceneNavigator — identical to
//    pre-F1A.2 visible behaviour.
// =================================================================

test('F1A.2 — sidebar boots with Scene Navigator active (screenplay behaviour preserved)', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    // Wait until Rga.Shell.init has completed (Sidebar has an active
    // panel after init succeeds).
    await page.waitForFunction(() =>
      window.Rga.Shell.Sidebar.current() !== null, null, { timeout: 5000 });
    const boot = await page.evaluate(() => ({
      sidebarCurrent: window.Rga.Shell.Sidebar.current(),
      layoutActive:   window.Rga.Shell.Layout.get().sidebar.activePanel,
      sidebarVisible: window.Rga.Shell.Layout.get().sidebar.visible,
      hostHasNavigator: !!document.querySelector(
        '#rga-shell-sidebar-host .rga-shell-scene-navigator')
    }));
    expect(boot.sidebarCurrent).toBe('sceneNavigator');
    expect(boot.layoutActive).toBe('sceneNavigator');
    expect(boot.sidebarVisible).toBe(true);
    expect(boot.hostHasNavigator).toBe(true);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 4. Rail grouping intact — F1A.2 must not touch rail order.
// =================================================================

test('F1A.2 — activity-rail items still render in doctrine order (no rail-grouping regression)', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await page.waitForSelector('#activity-bar .rga-shell-rail-item', { timeout: 5000 });
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#activity-bar .rga-shell-rail-item'))
        .map((b) => b.getAttribute('data-panel-id')));
    // Activity Rail Doctrine §Rule 3 — locked grouping.
    expect(ids).toEqual([
      'sceneNavigator', 'scriptWorkspace', 'outline', 'search',
      'characters', 'revisions',
      'settings'
    ]);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 5. The legacy DEFAULT_PANEL constant is gone — direct regression
//    guard against re-introducing a screenplay-specific CORE name.
// =================================================================

test('F1A.2 — Rga.Shell exposes no screenplay-specific default-panel constant', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const hasLegacy = await page.evaluate(() => {
      // The pre-F1A.2 code held a top-level `const DEFAULT_PANEL =
      // 'sceneNavigator'` inside the shell/index.js IIFE. It was
      // never on Rga.Shell, so this assertion has always been true;
      // the test is here as a behavioural lock — any future leak of
      // a screenplay default onto Rga.Shell.* shows up loudly.
      const blocked = ['DEFAULT_PANEL', 'defaultPanel', 'defaultSidebarPanel'];
      return blocked.some((k) => typeof window.Rga.Shell[k] !== 'undefined');
    });
    expect(hasLegacy).toBe(false);
  } finally {
    await teardown(app, userDataDir);
  }
});
