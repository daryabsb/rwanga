// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Responsive Shell — integration tests (Playwright + Electron).
//
// Diagnoses the mode-driven shell behaviour the responsive engine
// (renderer/js/shell/responsive.js) is supposed to deliver:
//   • Wide    — all panels visible, no collapse classes.
//   • Compact — inspector collapses to a 32px rail with a visible
//               reopen button; sidebar stays as-is; toolbar Writing
//               + Mode groups hidden; menubar trailing items hidden.
//   • Narrow  — sidebar AND inspector collapse; editor 1fr fills the
//               remaining width (THIS is the case that was empty-
//               white in the manual screenshot — the test pins it).
//
// Each test resizes the actual BrowserWindow via the Electron main
// process (page.setViewportSize alone does not propagate through to
// window.innerWidth correctly in framed Electron windows). Then it
// waits for the responsive engine's debounce + Layout subscriber and
// asserts the DOM facts directly. No screenshots in CI.
//
// Prereq: `npm run build:renderer`.
// Run:    npm run test:e2e -- responsive-shell.spec.js
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE  = path.resolve(__dirname, '..', 'fixtures', 'mysterious-guest-rtl.rga');

let app, page, userDataDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-resp-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(window.Rga && window.Rga.Shell && window.Rga.Shell.Responsive));
  // Open the RTL fixture so the editor renders manuscript content (not
  // the empty state). The opener lives on Rga.FileManager.
  await page.evaluate(async (fixturePath) => {
    if (window.Rga && window.Rga.FileManager && typeof window.Rga.FileManager.openPath === 'function') {
      await window.Rga.FileManager.openPath(fixturePath);
    } else if (window.rwanga && window.rwanga.fs && typeof window.rwanga.fs.readFile === 'function') {
      // Fallback: direct IPC read + manual open.
      const buf = await window.rwanga.fs.readFile(fixturePath);
      if (window.Rga && window.Rga.TabManager && typeof window.Rga.TabManager.openFromBuffer === 'function') {
        await window.Rga.TabManager.openFromBuffer(buf, fixturePath);
      }
    }
  }, FIXTURE);
});

test.afterEach(async () => {
  if (app) { await app.close(); app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

// Resize the actual Electron BrowserWindow and wait for the engine's
// debounce (100ms) + a paint cycle. Returns when the responsive engine
// has had a chance to apply its mode.
async function resizeWindow(w, h) {
  // app.evaluate runs in the MAIN process where BrowserWindow lives.
  await app.evaluate(async ({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.setSize(size.w, size.h);
  }, { w, h });
  // Let the resize event propagate + the engine debounce (100ms) +
  // one rAF for layout.
  await page.waitForTimeout(180);
}

function currentMode() {
  return page.evaluate(() => window.Rga.Shell.Responsive.currentMode());
}

function appClasses() {
  return page.evaluate(() => Array.from(document.getElementById('app').classList));
}

function workspaceClasses() {
  return page.evaluate(() => Array.from(document.getElementById('workspace').classList));
}

// =============================================================
// Wide mode — all panels expanded, no collapse classes.
// =============================================================

test('wide mode: all panels expanded, mode-wide on #app, no collapse classes', async () => {
  await resizeWindow(1600, 1000);
  expect(await currentMode()).toBe('wide');
  expect(await appClasses()).toContain('mode-wide');
  const wsClasses = await workspaceClasses();
  expect(wsClasses).not.toContain('sidebar-collapsed');
  expect(wsClasses).not.toContain('inspector-collapsed');
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#sidebar')).toBeVisible();
  await expect(page.locator('#inspector-panel')).toBeVisible();
  // Inspector header (only present when expanded) must show.
  await expect(page.locator('.inspector-header')).toBeVisible();
});

// =============================================================
// Compact mode — inspector collapsed to 32px rail; sidebar stays.
// =============================================================

test('compact mode: inspector rail is 32px wide and reopen button is visible', async () => {
  await resizeWindow(1200, 900);
  expect(await currentMode()).toBe('compact');
  expect(await appClasses()).toContain('mode-compact');
  const wsClasses = await workspaceClasses();
  expect(wsClasses).toContain('inspector-collapsed');
  expect(wsClasses).not.toContain('sidebar-collapsed');
  // Inspector rail must be exactly 32px in the workspace grid.
  const railBox = await page.locator('#inspector-panel').boundingBox();
  expect(railBox).not.toBeNull();
  expect(railBox.width).toBeCloseTo(32, 1);
  // Reopen button must be visible.
  await expect(page.locator('#inspector-toggle')).toBeVisible();
  // Sidebar still expanded.
  await expect(page.locator('#sidebar')).toBeVisible();
  // Editor still visible.
  await expect(page.locator('#editor')).toBeVisible();
});

test('compact mode: clicking the reopen button restores the inspector (within-mode toggle holds; mode change still wins)', async () => {
  await resizeWindow(1200, 900);
  expect(await currentMode()).toBe('compact');
  expect(await workspaceClasses()).toContain('inspector-collapsed');
  await page.locator('#inspector-toggle').click();
  // After click, class should be off — within-mode toggle works.
  await expect.poll(async () => (await workspaceClasses()).includes('inspector-collapsed')).toBe(false);
  // No-resize: engine doesn't fire, so the toggle holds.
  expect(await currentMode()).toBe('compact');
  expect(await workspaceClasses()).not.toContain('inspector-collapsed');
  // Now resize to a different mode — the engine MUST re-collapse the
  // inspector for the editor to function. Inspector first-class
  // contract: full-close is forbidden, but auto-collapse on screen
  // change is required (no userOverride blocks the engine).
  await resizeWindow(900, 900);
  expect(await currentMode()).toBe('narrow');
  expect(await workspaceClasses()).toContain('inspector-collapsed');
});

// =============================================================
// Narrow mode — THE big bug. Editor must NOT be all-white.
// =============================================================

test('narrow mode: editor area fills the window minus chrome (no all-white empty area)', async () => {
  await resizeWindow(850, 900);
  expect(await currentMode()).toBe('narrow');
  expect(await appClasses()).toContain('mode-narrow');
  const wsClasses = await workspaceClasses();
  expect(wsClasses).toContain('sidebar-collapsed');
  expect(wsClasses).toContain('inspector-collapsed');
  // Editor must be visible and have meaningful width — this is the
  // assertion the empty-white screenshot would have failed. With the
  // combined grid rule (rail 48 + 0 + 0 + 1fr + 0 + rail 32 = 80px
  // fixed), editor 1fr at 850px window = 770px wide. Allowing some
  // slack for chrome rounding, assert > 600.
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#tab-bar')).toBeVisible();
  const editorAreaBox = await page.locator('#editor-area').boundingBox();
  expect(editorAreaBox).not.toBeNull();
  expect(editorAreaBox.width).toBeGreaterThan(600);
  // Inspector rail still 32px.
  const railBox = await page.locator('#inspector-panel').boundingBox();
  expect(railBox.width).toBeCloseTo(32, 1);
  // Reopen button visible.
  await expect(page.locator('#inspector-toggle')).toBeVisible();
});

test('narrow mode: toolbar shows only the Text group; menubar shows File/Edit/View only', async () => {
  await resizeWindow(850, 900);
  expect(await currentMode()).toBe('narrow');
  // Text group visible; Scene + Writing + Mode groups hidden.
  await expect(page.locator('.rga-shell-toolbar-group[data-group="text"]')).toBeVisible();
  await expect(page.locator('.rga-shell-toolbar-group[data-group="scene"]')).toBeHidden();
  await expect(page.locator('.rga-shell-toolbar-group[data-group="writing"]')).toBeHidden();
  await expect(page.locator('.rga-shell-toolbar-group[data-group="mode"]')).toBeHidden();
  // Menubar: File / Edit / View visible; everything else hidden.
  await expect(page.locator('.rga-shell-menubar-item[data-menu="file"]')).toBeVisible();
  await expect(page.locator('.rga-shell-menubar-item[data-menu="edit"]')).toBeVisible();
  await expect(page.locator('.rga-shell-menubar-item[data-menu="view"]')).toBeVisible();
  await expect(page.locator('.rga-shell-menubar-item[data-menu="script"]')).toBeHidden();
  await expect(page.locator('.rga-shell-menubar-item[data-menu="tags"]')).toBeHidden();
  await expect(page.locator('.rga-shell-menubar-item[data-menu="tools"]')).toBeHidden();
  await expect(page.locator('.rga-shell-menubar-item[data-menu="export"]')).toBeHidden();
  await expect(page.locator('.rga-shell-menubar-item[data-menu="help"]')).toBeHidden();
});

// =============================================================
// Hysteresis — dragging back and forth across a boundary must not
// flap the mode.
// =============================================================

// =============================================================
// Inspector first-class contract — drag-to-collapse is impossible,
// and pre-existing stuck-state widths recover automatically.
// =============================================================

test('inspector first-class: drag cannot close the panel; clamps at 240 minimum', async () => {
  await resizeWindow(1600, 1000);
  expect(await currentMode()).toBe('wide');
  // Establish a known starting width.
  await page.evaluate(() => window.Rga.Shell.Layout.set({ inspector: { width: 320 } }));
  // Grab the inspector handle and drag it HARD inward (right-to-left
  // in LTR = leftward = shrinking inspector). Simulate a drag much
  // farther than the panel's width so the clamp is exercised.
  const handle = await page.locator('.resize-handle[data-resize="inspector"]').boundingBox();
  expect(handle).not.toBeNull();
  const startX = handle.x + handle.width / 2;
  const startY = handle.y + handle.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Drag 500px to the right (=inspector shrinks by 500px from 320 → would be -180).
  await page.mouse.move(startX + 500, startY, { steps: 20 });
  await page.mouse.up();
  // Width must be clamped at MIN_INSPECTOR_EXPANDED, never below.
  // (The drag handler clamps in real time; we read the persisted value.)
  const persisted = await page.evaluate(() => window.Rga.Shell.Layout.get().inspector.width);
  expect(persisted).toBeGreaterThanOrEqual(240);
  // Inspector still expanded — drag never collapses.
  expect(await workspaceClasses()).not.toContain('inspector-collapsed');
  // DOM panel measures at least 240.
  const inspBox = await page.locator('#inspector-panel').boundingBox();
  expect(inspBox.width).toBeGreaterThanOrEqual(240);
});

test('inspector first-class: stuck width:0 recovers to default 280 on next open', async () => {
  await resizeWindow(1600, 1000);
  // Simulate the historic stuck state — Layout has width:0 AND class:collapsed.
  await page.evaluate(() => {
    window.Rga.Shell.Layout.set({ inspector: { width: 0 } });
    const ws = document.getElementById('workspace');
    if (ws) ws.classList.add('inspector-collapsed');
  });
  // Verify the stuck state is in place.
  expect(await page.evaluate(() => window.Rga.Shell.Layout.get().inspector.width)).toBe(0);
  expect(await workspaceClasses()).toContain('inspector-collapsed');
  // Now uncollapse via the public path (mirrors the View → Toggle Inspector
  // command, the reopen button, and the engine's wide-mode route).
  await page.evaluate(() => window.Rga.Shell.StudioPanel.openInspector());
  // Recovery: width restored to 280, class removed, panel measures > 240.
  const w = await page.evaluate(() => window.Rga.Shell.Layout.get().inspector.width);
  expect(w).toBe(280);
  expect(await workspaceClasses()).not.toContain('inspector-collapsed');
  const inspBox = await page.locator('#inspector-panel').boundingBox();
  expect(inspBox.width).toBeGreaterThanOrEqual(240);
});

test('inspector first-class: toggle button is visible in BOTH states and collapses/expands on click', async () => {
  await resizeWindow(1600, 1000);
  // Expanded state — button visible at top-inline-end corner.
  expect(await workspaceClasses()).not.toContain('inspector-collapsed');
  await expect(page.locator('#inspector-toggle')).toBeVisible();
  // Click → should COLLAPSE (not just no-op).
  await page.locator('#inspector-toggle').click();
  await expect.poll(async () => (await workspaceClasses()).includes('inspector-collapsed')).toBe(true);
  // Button still visible in collapsed state.
  await expect(page.locator('#inspector-toggle')).toBeVisible();
  // Click again → expands.
  await page.locator('#inspector-toggle').click();
  await expect.poll(async () => (await workspaceClasses()).includes('inspector-collapsed')).toBe(false);
  await expect(page.locator('#inspector-toggle')).toBeVisible();
});

test('inspector first-class: View → Toggle Inspector is collapse/uncollapse, never close', async () => {
  await resizeWindow(1600, 1000);
  // Start expanded.
  expect(await workspaceClasses()).not.toContain('inspector-collapsed');
  // Programmatic equivalent of the menu command (registered as
  // view.toggleInspector → Rga.Inspector.toggle → StudioPanel.toggleInspector).
  await page.evaluate(() => window.Rga.Inspector.toggle());
  expect(await workspaceClasses()).toContain('inspector-collapsed');
  // Inspector measures 32 (rail), not 0.
  let inspBox = await page.locator('#inspector-panel').boundingBox();
  expect(inspBox.width).toBeCloseTo(32, 1);
  // Toggle again — back to expanded.
  await page.evaluate(() => window.Rga.Inspector.toggle());
  expect(await workspaceClasses()).not.toContain('inspector-collapsed');
  inspBox = await page.locator('#inspector-panel').boundingBox();
  expect(inspBox.width).toBeGreaterThanOrEqual(240);
});

test('hysteresis: small width changes around a threshold do not flap the mode', async () => {
  // Land in compact.
  await resizeWindow(1200, 900);
  expect(await currentMode()).toBe('compact');
  // Grow by a small amount — should stay compact, not jump to wide.
  await resizeWindow(1300, 900);
  expect(await currentMode()).toBe('compact');
  // Grow well past the wide threshold + buffer — now should switch.
  await resizeWindow(1600, 900);
  expect(await currentMode()).toBe('wide');
});
