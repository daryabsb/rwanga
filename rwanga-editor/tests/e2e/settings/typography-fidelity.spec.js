// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Typography & Content Geometry Fidelity — S6 (Phase 2).
//
// Proves the ten S6 assertions against the live Settings workspace:
//   1.  Section title font-size = 16px
//   2.  Section title font-weight = 600
//   3.  Row label font-size = 13px
//   4.  Row label font-weight = 500
//   5.  Helper font-size = 11px
//   6.  Helper font-weight = 400
//   7.  Content padding = 24px 32px (top/bottom 24, left/right 32)
//   8.  Content max-width = 680px
//   9.  S4 row grid still holds (display:grid, ~1fr auto, 8px column gap)
//  10.  Existing controls still function after the typography change
//       (editor.spellcheck toggle round-trip through Settings.Store).
//
// The spec is intentionally narrow per the S6 brief: no badges, no
// reset buttons, no control work, no nav chrome.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchAndOpen(userDataDir) {
  const app  = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() =>
    !!(window.Rga && window.Rga.SettingsWorkspace && window.Rga.Settings
       && window.Rga.Settings.Store));
  return { app, page };
}

async function openSettings(page) {
  await page.evaluate(() => window.Rga.SettingsWorkspace.open());
  await page.waitForSelector('.rga-settings-workspace .rga-settings-row');
}

async function clearDirtyAndClose(app, page) {
  try {
    await page.evaluate(() => {
      const TM = window.Rga && window.Rga.TabManager;
      const docs = TM ? [TM.activeDoc(), TM.lastActiveDoc && TM.lastActiveDoc()].filter(Boolean) : [];
      docs.forEach((d) => {
        if (window.Rga.Doc && window.Rga.Doc.clearDirty) window.Rga.Doc.clearDirty(d);
        else d.dirty = false;
      });
    });
  } catch (_) {}
  await app.close();
}

function readComputed(page, selector, props) {
  return page.evaluate(({ sel, ps }) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const out = {};
    ps.forEach((p) => { out[p] = cs[p]; });
    return out;
  }, { sel: selector, ps: props });
}

// -----------------------------------------------------------------
// 1 + 2. Section title — 16px / 600
// -----------------------------------------------------------------

test('S6 §1 — section title font-size is 16px', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's6-title-size-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const styles = await readComputed(page,
      '.rga-settings-content-title', ['fontSize']);
    expect(styles.fontSize).toBe('16px');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('S6 §2 — section title font-weight is 600', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's6-title-weight-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const styles = await readComputed(page,
      '.rga-settings-content-title', ['fontWeight']);
    expect(styles.fontWeight).toBe('600');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 3 + 4. Row label — 13px / 500
// -----------------------------------------------------------------

test('S6 §3 — row label font-size is 13px', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's6-label-size-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const styles = await readComputed(page,
      '.rga-settings-row .rga-settings-row-label', ['fontSize']);
    expect(styles.fontSize).toBe('13px');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('S6 §4 — row label font-weight is 500', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's6-label-weight-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const styles = await readComputed(page,
      '.rga-settings-row .rga-settings-row-label', ['fontWeight']);
    expect(styles.fontWeight).toBe('500');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 5 + 6. Helper text — 11px / 400
// -----------------------------------------------------------------

test('S6 §5 — helper text font-size is 11px', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's6-helper-size-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const styles = await readComputed(page,
      '.rga-settings-row .rga-settings-row-description', ['fontSize']);
    expect(styles.fontSize).toBe('11px');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('S6 §6 — helper text font-weight is 400', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's6-helper-weight-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const styles = await readComputed(page,
      '.rga-settings-row .rga-settings-row-description', ['fontWeight']);
    expect(styles.fontWeight).toBe('400');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 7. Content padding = 24px 32px
// -----------------------------------------------------------------

test('S6 §7 — content padding is 24px top/bottom, 32px left/right', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's6-padding-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const styles = await readComputed(page, '.rga-settings-content',
      ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']);
    expect(styles.paddingTop).toBe('24px');
    expect(styles.paddingBottom).toBe('24px');
    expect(styles.paddingLeft).toBe('32px');
    expect(styles.paddingRight).toBe('32px');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 8. Content max-width = 680px
// -----------------------------------------------------------------

test('S6 §8 — content max-width is 680px', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's6-maxw-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const styles = await readComputed(page, '.rga-settings-content',
      ['maxWidth']);
    expect(styles.maxWidth).toBe('680px');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 9. S4 row grid still holds
// -----------------------------------------------------------------

test('S6 §9 — S4 row grid invariant still holds (display:grid, two tracks, 8px column gap)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's6-s4-grid-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const styles = await readComputed(page,
      '.rga-settings-row[data-setting-id="theme"]',
      ['display', 'gridTemplateColumns', 'columnGap']);
    expect(styles.display).toBe('grid');
    expect(styles.columnGap).toBe('8px');
    // Two tracks, label column wider than control column.
    const tracks = String(styles.gridTemplateColumns || '').trim().split(/\s+/);
    expect(tracks.length).toBe(2);
    const t1 = parseFloat(tracks[0]);
    const t2 = parseFloat(tracks[1]);
    expect(Number.isFinite(t1) && Number.isFinite(t2)).toBe(true);
    expect(t1 > t2).toBe(true);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 10. Existing controls still function
// -----------------------------------------------------------------

test('S6 §10 — controls still function after typography change (editor.spellcheck toggle round-trip)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's6-func-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    await page.click('.rga-settings-nav-item[data-section-id="editor"]');
    await page.waitForSelector(
      '.rga-settings-row[data-setting-id="editor.spellcheck"] .rga-settings-row-value input');

    const before = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('editor.spellcheck'));
    expect(before).toBe(true);

    await page.click(
      '.rga-settings-row[data-setting-id="editor.spellcheck"] .rga-settings-row-value input');
    await page.waitForFunction(() =>
      window.Rga.Settings.Store.effective('editor.spellcheck') === false,
      null, { timeout: 1000 });

    const after = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('editor.spellcheck'));
    expect(after).toBe(false);

    await page.evaluate(() =>
      window.Rga.Settings.Store.set('editor.spellcheck', true));
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
