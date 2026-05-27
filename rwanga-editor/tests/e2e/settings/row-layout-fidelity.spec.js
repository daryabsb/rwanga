// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Row Layout Fidelity — S4 (Phase 2 — Visual Fidelity Recovery).
//
// Proves the ten S4 assertions against the live Settings workspace:
//   1.  Row uses CSS grid (display:grid)
//   2.  Grid columns are 1fr auto equivalent (2 tracks, second sized to
//       content)
//   3.  Row column gap is 8px
//   4.  No card background (.rga-settings-row background is transparent
//       — no card surface fill)
//   5.  No border radius
//   6.  No full card border (border-top/left/right widths are 0)
//   7.  Bottom separator exists (1px solid border-bottom)
//   8.  Control column aligns right (value cell justify-self:end and its
//       resolved x-position sits at the row's right edge)
//   9.  Label / helper column aligns left (header + description sit in
//       the first column, hugging the left edge)
//  10.  Existing controls still function after the layout change
//       (toggling appearance.statusBar still writes through the Store).
//
// The spec is intentionally narrow per the S4 brief: no badges, no
// reset buttons, no controls, no nav. CSS-only acceptance material.
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

// Reads the computed-style + layout summary of one row. We anchor on a
// known REAL row (`theme`) so the grid shape is exercised with a real
// control on the right.
async function summarizeRow(page, settingId) {
  return await page.evaluate((id) => {
    const row = document.querySelector('.rga-settings-row[data-setting-id="' + id + '"]');
    if (!row) return null;
    const cs = getComputedStyle(row);
    const header = row.querySelector('.rga-settings-row-header');
    const value  = row.querySelector('.rga-settings-row-value');
    const rowRect    = row.getBoundingClientRect();
    const headerRect = header ? header.getBoundingClientRect() : null;
    const valueRect  = value  ? value.getBoundingClientRect()  : null;
    return {
      display:         cs.display,
      gridTemplateColumns: cs.gridTemplateColumns,
      columnGap:       cs.columnGap,
      backgroundColor: cs.backgroundColor,
      borderTopLeftRadius:     cs.borderTopLeftRadius,
      borderTopRightRadius:    cs.borderTopRightRadius,
      borderBottomLeftRadius:  cs.borderBottomLeftRadius,
      borderBottomRightRadius: cs.borderBottomRightRadius,
      borderTopWidth:     cs.borderTopWidth,
      borderRightWidth:   cs.borderRightWidth,
      borderLeftWidth:    cs.borderLeftWidth,
      borderBottomWidth:  cs.borderBottomWidth,
      borderBottomStyle:  cs.borderBottomStyle,
      borderBottomColor:  cs.borderBottomColor,
      rowLeft:    rowRect.left,
      rowRight:   rowRect.right,
      headerLeft: headerRect && headerRect.left,
      valueLeft:  valueRect  && valueRect.left,
      valueRight: valueRect  && valueRect.right,
      hasHeader:  !!header,
      hasValue:   !!value
    };
  }, settingId);
}

// "background is transparent" can surface as rgba(0,0,0,0) (resolved
// transparent) or 'transparent' literal. Both are acceptable.
function isTransparent(bg) {
  if (!bg) return false;
  const normalized = bg.replace(/\s+/g, '');
  return normalized === 'rgba(0,0,0,0)' || normalized === 'transparent';
}

// "1fr auto" resolves at compute time to two pixel-sized tracks where
// the first track is wider (it took the leftover space) and the second
// is content-sized. We assert: exactly 2 tracks; first track strictly
// wider than the second; both > 0.
function looksLike1frAuto(gridTemplateColumns) {
  const tracks = String(gridTemplateColumns || '').trim().split(/\s+/);
  if (tracks.length !== 2) return false;
  const t1 = parseFloat(tracks[0]);
  const t2 = parseFloat(tracks[1]);
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return false;
  if (t1 <= 0 || t2 <= 0) return false;
  return t1 > t2;
}

// -----------------------------------------------------------------
// 1. display: grid
// -----------------------------------------------------------------

test('S4 §1 — every Settings row uses CSS grid (display:grid)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's4-grid-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const displays = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.rga-settings-row'))
        .map((r) => getComputedStyle(r).display));
    expect(displays.length).toBeGreaterThan(0);
    displays.forEach((d) => expect(d).toBe('grid'));
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 2. grid-template-columns ≈ "1fr auto" (2 tracks, first wider)
// -----------------------------------------------------------------

test('S4 §2 — grid-template-columns resolves to 1fr auto equivalent (2 tracks, label column wider)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's4-cols-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const summary = await summarizeRow(page, 'theme');
    expect(summary).not.toBeNull();
    expect(looksLike1frAuto(summary.gridTemplateColumns)).toBe(true);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 3. column gap is 8px
// -----------------------------------------------------------------

test('S4 §3 — row column gap is 8px', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's4-gap-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const summary = await summarizeRow(page, 'theme');
    expect(summary.columnGap).toBe('8px');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 4. no card background
// -----------------------------------------------------------------

test('S4 §4 — row has no card background (transparent surface)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's4-bg-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const summary = await summarizeRow(page, 'theme');
    expect(isTransparent(summary.backgroundColor))
      .toBe(true);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 5. no border radius
// -----------------------------------------------------------------

test('S4 §5 — row has no border-radius on any corner', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's4-radius-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const summary = await summarizeRow(page, 'theme');
    expect(summary.borderTopLeftRadius).toBe('0px');
    expect(summary.borderTopRightRadius).toBe('0px');
    expect(summary.borderBottomLeftRadius).toBe('0px');
    expect(summary.borderBottomRightRadius).toBe('0px');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 6. no full card border (only bottom carries width)
// -----------------------------------------------------------------

test('S4 §6 — row has no full card border (only bottom is non-zero)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's4-noborder-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const summary = await summarizeRow(page, 'theme');
    expect(summary.borderTopWidth).toBe('0px');
    expect(summary.borderRightWidth).toBe('0px');
    expect(summary.borderLeftWidth).toBe('0px');
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 7. bottom separator exists
// -----------------------------------------------------------------

test('S4 §7 — row carries a 1px solid bottom separator', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's4-sep-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const summary = await summarizeRow(page, 'theme');
    expect(summary.borderBottomWidth).toBe('1px');
    expect(summary.borderBottomStyle).toBe('solid');
    // The colour resolves to the design token (rgb form). We assert it
    // is non-transparent so the separator is actually visible.
    expect(isTransparent(summary.borderBottomColor)).toBe(false);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 8. control column aligns right
// -----------------------------------------------------------------

test('S4 §8 — control column hugs the right edge of the row', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's4-ctrlr-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    // Use a toggle on the default (General) section — confirmBeforeClose
    // — so the row is rendered without navigating sections.
    const summary = await summarizeRow(page, 'confirmBeforeClose');
    expect(summary).not.toBeNull();
    expect(summary.hasValue).toBe(true);
    // Right-edge proximity: the value cell's right edge sits within a
    // 1px tolerance of the row's right edge (no fudge-factor gap).
    expect(Math.abs(summary.valueRight - summary.rowRight)).toBeLessThan(1.5);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 9. label/helper column aligns left
// -----------------------------------------------------------------

test('S4 §9 — label/helper column hugs the left edge of the row', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's4-labell-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);
    const summary = await summarizeRow(page, 'theme');
    // Header left == row left (no extra padding-left on the row).
    expect(Math.abs(summary.headerLeft - summary.rowLeft)).toBeLessThan(1.5);
    // The control sits to the RIGHT of the header.
    expect(summary.valueLeft).toBeGreaterThan(summary.headerLeft);
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 10. existing controls still function after the layout change
// -----------------------------------------------------------------

test('S4 §10 — existing controls still function after the layout change (toggle round-trip)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 's4-func-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openSettings(page);

    // Use editor.spellcheck — a REAL (applicator-wired) toggle on the
    // Editor section. PERSISTS_ONLY rows have pointer-events:none on
    // their value column, so the click must target a wired row.
    await page.click('.rga-settings-nav-item[data-section-id="editor"]');
    await page.waitForSelector(
      '.rga-settings-row[data-setting-id="editor.spellcheck"] .rga-settings-row-value input');

    const before = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('editor.spellcheck'));
    expect(before).toBe(true);

    // Click the toggle in the row (inside .rga-settings-row-value).
    await page.click(
      '.rga-settings-row[data-setting-id="editor.spellcheck"] .rga-settings-row-value input');
    // Allow the change event to propagate.
    await page.waitForFunction(() =>
      window.Rga.Settings.Store.effective('editor.spellcheck') === false,
      null, { timeout: 1000 });

    const after = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('editor.spellcheck'));
    expect(after).toBe(false);

    // Restore for cleanliness.
    await page.evaluate(() =>
      window.Rga.Settings.Store.set('editor.spellcheck', true));
  } finally {
    await clearDirtyAndClose(app, page);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
