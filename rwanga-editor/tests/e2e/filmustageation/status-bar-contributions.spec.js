// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.4 — Status-bar contribution API smoke.
//
// Proves the real Electron boot path:
//   - status bar has the documented public registration API
//   - CORE owns 4 segments (offline / wordCount / viewMode / theme)
//   - screenplay plugin contributes 4 more (scene / blockType / page /
//     language) so the visible bar still has 8 segments — identical
//     to pre-F1A.4 behaviour
//   - the segments appear in the correct (section, order) layout
//   - invalid registrations are rejected without throwing
//   - unregister removes the span cleanly
//   - the theme + viewMode CORE segments remain interactive (no
//     regression on existing instrument behaviour)
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1a-4-status-bar-'));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Shell && window.Rga.Shell.StatusBar &&
    typeof window.Rga.Shell.StatusBar.registerSegment === 'function'));
  // Status bar must be initialized — segments rendered.
  await page.waitForSelector('#status-bar .rga-shell-status-segment',
    { timeout: 5000 });
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// =================================================================
// 1. Public API exposed at boot.
// =================================================================

test('F1A.4 — Rga.Shell.StatusBar exposes the contribution API at boot', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const apiShape = await page.evaluate(() => {
      const SB = window.Rga.Shell.StatusBar;
      return ['init', 'refresh', 'registerSegment', 'unregisterSegment',
              'registered', '_reset']
        .every((n) => typeof SB[n] === 'function');
    });
    expect(apiShape).toBe(true);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 2. All 8 segments present in the correct order — CORE + screenplay
//    contribution preserves the pre-F1A.4 visible behaviour.
// =================================================================

test('F1A.4 — all 8 segments render in correct (section, order) layout', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const layout = await page.evaluate(() => {
      const root = document.getElementById('status-bar');
      const allIds = Array.from(root.querySelectorAll('.rga-shell-status-segment'))
        .map((el) => el.getAttribute('data-segment'));
      const left = Array.from(root.querySelectorAll(
        '.rga-shell-statusbar-left .rga-shell-status-segment'))
        .map((el) => el.getAttribute('data-segment'));
      const center = Array.from(root.querySelectorAll(
        '.rga-shell-statusbar-center .rga-shell-status-segment'))
        .map((el) => el.getAttribute('data-segment'));
      const right = Array.from(root.querySelectorAll(
        '.rga-shell-statusbar-right .rga-shell-status-segment'))
        .map((el) => el.getAttribute('data-segment'));
      return { allIds, left, center, right };
    });
    expect(layout.allIds).toEqual([
      'offline', 'scene', 'blockType', 'page',
      'wordCount', 'viewMode', 'language', 'theme'
    ]);
    expect(layout.left).toEqual(['offline', 'scene']);
    expect(layout.center).toEqual(['blockType', 'page']);
    expect(layout.right).toEqual(['wordCount', 'viewMode', 'language', 'theme']);
  } finally {
    await teardown(app, userDataDir);
  }
});

test('F1A.4 — registered() returns all 8 ids at boot', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const registered = await page.evaluate(() =>
      window.Rga.Shell.StatusBar.registered());
    expect(registered.sort()).toEqual(
      ['blockType', 'language', 'offline', 'page', 'scene', 'theme', 'viewMode', 'wordCount']);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 3. CORE instruments still interactive — no regression.
// =================================================================

test('F1A.4 — theme segment still toggles via the H2B constitutional path', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      const t = document.querySelector('[data-segment="theme"]');
      const before = t.textContent;
      t.click();
      return { before, after: t.textContent };
    });
    // The click goes through Rga.SettingsTheme.toggle which writes to
    // Settings.Store; the theme applicator updates Rga.Theme; the
    // segment's onChange subscriber re-renders. Round-trip proof:
    // textContent flipped (Dark ↔ Light).
    expect(result.after).not.toBe(result.before);
    expect(['Dark', 'Light']).toContain(result.before);
    expect(['Dark', 'Light']).toContain(result.after);
  } finally {
    await teardown(app, userDataDir);
  }
});

test('F1A.4 — viewMode segment still exposes its select + four options', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const shape = await page.evaluate(() => {
      const seg = document.querySelector('[data-segment="viewMode"]');
      const select = seg.querySelector('select.rga-shell-status-viewmode-select');
      const options = Array.from(select.options).map((o) => o.value);
      return { hasSelect: !!select, options };
    });
    expect(shape.hasSelect).toBe(true);
    expect(shape.options).toEqual(['flow', 'draft', 'print', 'printPreview']);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 4. Late registration / unregister round-trip.
// =================================================================

test('F1A.4 — late-registered plugin segment mounts in the correct slot and unregister removes it', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      const SB = window.Rga.Shell.StatusBar;
      const root = document.getElementById('status-bar');
      const beforeIds = Array.from(root.querySelectorAll(
        '.rga-shell-statusbar-center .rga-shell-status-segment'))
        .map((el) => el.getAttribute('data-segment'));
      const registered = SB.registerSegment({
        id: 'late-smoke',
        section: 'center',
        order: 55,        // between blockType (50) and page (60)
        mount: function(span) { span.textContent = 'LATE'; }
      });
      const duringIds = Array.from(root.querySelectorAll(
        '.rga-shell-statusbar-center .rga-shell-status-segment'))
        .map((el) => el.getAttribute('data-segment'));
      const span = root.querySelector('[data-segment="late-smoke"]');
      const spanText = span && span.textContent;
      const removed = SB.unregisterSegment('late-smoke');
      const afterIds = Array.from(root.querySelectorAll(
        '.rga-shell-statusbar-center .rga-shell-status-segment'))
        .map((el) => el.getAttribute('data-segment'));
      return { beforeIds, registered, duringIds, spanText, removed, afterIds };
    });
    expect(result.registered).toBe(true);
    expect(result.beforeIds).toEqual(['blockType', 'page']);
    expect(result.duringIds).toEqual(['blockType', 'late-smoke', 'page']);
    expect(result.spanText).toBe('LATE');
    expect(result.removed).toBe(true);
    expect(result.afterIds).toEqual(['blockType', 'page']);
  } finally {
    await teardown(app, userDataDir);
  }
});

// =================================================================
// 5. Invalid registrations fail safely.
// =================================================================

test('F1A.4 — invalid registrations return false without throwing or corrupting state', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const result = await page.evaluate(() => {
      const SB = window.Rga.Shell.StatusBar;
      let threw = false;
      let outcomes;
      try {
        outcomes = [
          SB.registerSegment(null),
          SB.registerSegment(undefined),
          SB.registerSegment({}),
          SB.registerSegment({ id: 'no-section', mount: function() {} }),
          SB.registerSegment({ id: 'bad-section', section: 'top', mount: function() {} }),
          SB.registerSegment({ id: 'no-mount', section: 'left' }),
          SB.registerSegment({ id: 'offline', section: 'left', mount: function() {} })  // duplicate
        ];
      } catch (e) {
        threw = true;
      }
      return {
        threw: threw,
        outcomes: outcomes,
        // CORE + screenplay registry still 8.
        registeredCount: SB.registered().length
      };
    });
    expect(result.threw).toBe(false);
    expect(result.outcomes.every((o) => o === false)).toBe(true);
    expect(result.registeredCount).toBe(8);
  } finally {
    await teardown(app, userDataDir);
  }
});
