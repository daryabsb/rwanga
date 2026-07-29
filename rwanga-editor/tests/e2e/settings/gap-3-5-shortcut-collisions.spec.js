// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// GAP-3-5 (S3.4F) — end-to-end proof that the three shortcut collisions the
// S3.3 console audit found are actually gone, in a running app, out of the
// box (no user rebinding). Two halves, both required by the slice:
//
//   1. The keys really fire the RIGHT command (not the collision's silent
//      winner) — proven via real Ctrl/Shift/Alt keypresses, not by calling
//      the handler function directly.
//   2. Settings displays the TRUE binding for every command it lists — a
//      shortcut shown in Settings that does not work is the defect, not
//      merely the collision underneath it (masterplan §S3.4F).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { closeApp } = require('../../helpers/app-teardown');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launch() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gap-3-5-'));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.FileManager && window.Rga.Shell && window.Rga.Shell.Sidebar &&
    window.Rga.KeyboardRegistry && window.Rga.Settings && window.Rga.Settings.Store &&
    window.Rga.SettingsWorkspace && window.Rga.PdfExport));
  await page.evaluate(async () => { await window.Rga.Settings.Store.init(); });
  return { app, page, userDataDir };
}

async function pressCombo(page, mods, key) {
  for (const m of mods) await page.keyboard.down(m);
  await page.keyboard.press(key);
  for (const m of mods.slice().reverse()) await page.keyboard.up(m);
}

// -----------------------------------------------------------------
// 1. Settings honesty — the caps rendered for each affected row match
//    the new, non-colliding defaults (no user has rebound anything).
// -----------------------------------------------------------------

test('GAP-3-5 — Settings displays the TRUE binding for kb.saveAs, kb.sceneNavigator, kb.exportPdf', async () => {
  const { app, page, userDataDir } = await launch();
  try {
    await page.evaluate(() => window.Rga.SettingsWorkspace.open());
    await page.waitForSelector(
      '[data-renderer="workspace"][data-workspace-kind="settings"] .rga-settings-row',
      { timeout: 5000 });
    await page.click('[data-section-id="shortcuts"]');
    await page.waitForSelector('.rga-settings-row[data-setting-id="kb.saveAs"]');

    const capsFor = async (id) => page
      .locator('.rga-settings-row[data-setting-id="' + id + '"] .rga-settings-control-shortcut-cap')
      .allTextContents();

    expect(await capsFor('kb.saveAs')).toEqual(['Ctrl', 'Shift', 'S']);
    expect(await capsFor('kb.sceneNavigator')).toEqual(['Ctrl', 'Shift', '1']);
    expect(await capsFor('kb.exportPdf')).toEqual(['Ctrl', 'Alt', 'E']);
  } finally {
    await closeApp(app);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 2. Ctrl+Shift+S fires Save As, not Scene Navigator (the primary
//    GAP-3-5 defect: Save As was dead on arrival before this slice).
// -----------------------------------------------------------------

test('GAP-3-5 — Ctrl+Shift+S fires Save As, not Scene Navigator, out of the box', async () => {
  const { app, page, userDataDir } = await launch();
  try {
    // Scene Navigator is the screenplay doc-type's DEFAULT sidebar panel, so
    // it is already current + visible at boot. The proof that its toggle
    // did NOT fire is that this state is UNCHANGED after the keypress — if
    // panel.sceneNavigator had fired, _togglePanel would deactivate it
    // (isCurrent && visible → hide), same as the old, broken behavior.
    const before = await page.evaluate(() => ({
      panel: window.Rga.Shell.Sidebar.current(),
      visible: window.Rga.Shell.Layout.get().sidebar.visible
    }));
    expect(before.panel).toBe('sceneNavigator');
    expect(before.visible).toBe(true);

    // Stub the native dialog (would otherwise hang the test) and record the
    // call renderer-side, on the REAL FileManager.saveAs, so the assertion
    // proves the keypress reached the actual command — not a mock standing
    // in for it.
    await app.evaluate(({ dialog }) => {
      dialog.showSaveDialog = async () => ({ canceled: true });
    });
    await page.evaluate(() => {
      window.__gap35SaveAsCalls = 0;
      const orig = window.Rga.FileManager.saveAs.bind(window.Rga.FileManager);
      window.Rga.FileManager.saveAs = function() {
        window.__gap35SaveAsCalls += 1;
        return orig.apply(this, arguments);
      };
    });

    await page.locator('#editor').click();
    await pressCombo(page, ['Control', 'Shift'], 'S');

    await page.waitForFunction(() => window.__gap35SaveAsCalls >= 1, { timeout: 3000 });

    // Scene Navigator's toggle did NOT also fire: still current, still visible.
    const after = await page.evaluate(() => ({
      panel: window.Rga.Shell.Sidebar.current(),
      visible: window.Rga.Shell.Layout.get().sidebar.visible
    }));
    expect(after.panel).toBe('sceneNavigator');
    expect(after.visible).toBe(true);
  } finally {
    await closeApp(app);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 3. Ctrl+Shift+1 fires Scene Navigator — the combo Settings now
//    honestly advertises for it actually works.
// -----------------------------------------------------------------

test('GAP-3-5 — Ctrl+Shift+1 activates the Scene Navigator panel (its new, honest default)', async () => {
  const { app, page, userDataDir } = await launch();
  try {
    // Scene Navigator is the boot-time default panel; switch away from it
    // first so the keypress has something observable to prove.
    await page.evaluate(() => window.Rga.Shell.Sidebar.activate('scriptWorkspace'));
    const before = await page.evaluate(() => window.Rga.Shell.Sidebar.current());
    expect(before).toBe('scriptWorkspace');

    await page.locator('#editor').click();
    await pressCombo(page, ['Control', 'Shift'], '1');

    await page.waitForFunction(() => window.Rga.Shell.Sidebar.current() === 'sceneNavigator',
      { timeout: 3000 });
  } finally {
    await closeApp(app);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 4. Ctrl+Alt+E fires Export PDF on its new default; the OLD default
//    (Ctrl+Shift+E) now belongs solely to the scriptWorkspace panel
//    toggle and no longer reaches Export PDF at all.
// -----------------------------------------------------------------

test('GAP-3-5 — Ctrl+Alt+E fires Export PDF; Ctrl+Shift+E now belongs only to the scriptWorkspace panel', async () => {
  const { app, page, userDataDir } = await launch();
  try {
    await page.evaluate(() => {
      window.__gap35PdfCalls = 0;
      const orig = window.Rga.PdfExport.run.bind(window.Rga.PdfExport);
      window.Rga.PdfExport.run = function() {
        window.__gap35PdfCalls += 1;
        return orig.apply(this, arguments);
      };
    });

    await page.locator('#editor').click();

    // Old default: Ctrl+Shift+E must now toggle scriptWorkspace, and must
    // NOT reach Export PDF.
    await pressCombo(page, ['Control', 'Shift'], 'E');
    await page.waitForFunction(() => window.Rga.Shell.Sidebar.current() === 'scriptWorkspace',
      { timeout: 3000 });
    const pdfCallsAfterOldCombo = await page.evaluate(() => window.__gap35PdfCalls);
    expect(pdfCallsAfterOldCombo).toBe(0);

    // New default: Ctrl+Alt+E fires Export PDF.
    await pressCombo(page, ['Control', 'Alt'], 'E');
    await page.waitForFunction(() => window.__gap35PdfCalls >= 1, { timeout: 3000 });
  } finally {
    await closeApp(app);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
