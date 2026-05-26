// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Visual Contract — H3A (RC1 §8.1.2 INTERPRETATION CORRECTION).
//
// H3 first read RC1 §8.1.2 ("entire row at 60% opacity") literally and
// applied a row-level fade. The designer corrected: PERSISTS_ONLY
// signals belong to the INTERACTION LAYER ONLY. Row, label, helper,
// padding, and hierarchy must remain visually untouched compared to a
// REAL row. The control surfaces its own disabled state via the native
// `disabled` attribute; the textual signal is the appended
// "Behavior not wired yet." helper.
//
// This spec proves the corrected visual contract by snapshotting
// computed styles + box geometry on a REAL row and a PERSISTS_ONLY row
// side-by-side and asserting the structural metrics match.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

const PERSISTS_ID = 'language';     // PERSISTS_ONLY (select, no applicator)
const REAL_ID     = 'theme';        // REAL (radio, wired in H2)

async function launchAndOpen(userDataDir) {
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Settings && window.Rga.Settings.Store &&
    window.Rga.SettingsWorkspace));
  await page.evaluate(async () => { await window.Rga.Settings.Store.init(); });
  await page.evaluate(() => window.Rga.SettingsWorkspace.open());
  // Both rows live in General — the default section, no click needed.
  await page.waitForSelector(
    '.rga-settings-row[data-setting-id="' + REAL_ID + '"]');
  await page.waitForSelector(
    '.rga-settings-row[data-setting-id="' + PERSISTS_ID + '"]');
  return { app, page };
}

async function probe(page, settingId) {
  return await page.evaluate((id) => {
    const row   = document.querySelector('.rga-settings-row[data-setting-id="' + id + '"]');
    if (!row) return null;
    const label = row.querySelector('.rga-settings-row-label');
    const desc  = row.querySelector('.rga-settings-row-description');
    const value = row.querySelector('.rga-settings-row-value');
    function s(el) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        opacity:        cs.opacity,
        color:          cs.color,
        fontSize:       cs.fontSize,
        fontWeight:     cs.fontWeight,
        lineHeight:     cs.lineHeight,
        paddingTop:     cs.paddingTop,
        paddingBottom:  cs.paddingBottom,
        marginTop:      cs.marginTop,
        marginBottom:   cs.marginBottom
      };
    }
    return { row: s(row), label: s(label), desc: s(desc), value: s(value) };
  }, settingId);
}

// -----------------------------------------------------------------
// 1. Label opacity unchanged
// -----------------------------------------------------------------

test('H3A — label opacity is unchanged between REAL and PERSISTS_ONLY rows', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h3a-label-op-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const real = await probe(page, REAL_ID);
    const persists = await probe(page, PERSISTS_ID);
    expect(parseFloat(real.label.opacity)).toBe(1);
    expect(parseFloat(persists.label.opacity)).toBe(1);
    expect(persists.label.opacity).toBe(real.label.opacity);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 2. Helper text opacity unchanged
// -----------------------------------------------------------------

test('H3A — helper text opacity is unchanged between REAL and PERSISTS_ONLY rows', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h3a-desc-op-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const real = await probe(page, REAL_ID);
    const persists = await probe(page, PERSISTS_ID);
    expect(parseFloat(real.desc.opacity)).toBe(1);
    expect(parseFloat(persists.desc.opacity)).toBe(1);
    expect(persists.desc.opacity).toBe(real.desc.opacity);
    // And the descendants' effective color is identical (no fade
    // imposed by an ancestor).
    expect(persists.desc.color).toBe(real.desc.color);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 3. Control is disabled
// -----------------------------------------------------------------

test('H3A — PERSISTS_ONLY control is disabled (interaction layer signal)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h3a-disabled-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const ctrl = page.locator(
      '.rga-settings-row[data-setting-id="' + PERSISTS_ID + '"] select');
    await expect(ctrl).toBeDisabled();
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 4. Row height (structural metrics) unchanged
// -----------------------------------------------------------------

test('H3A — row padding/margin metrics are identical between REAL and PERSISTS_ONLY rows', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h3a-row-height-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const real = await probe(page, REAL_ID);
    const persists = await probe(page, PERSISTS_ID);
    // Structural box metrics — independent of text content length.
    expect(persists.row.paddingTop).toBe(real.row.paddingTop);
    expect(persists.row.paddingBottom).toBe(real.row.paddingBottom);
    expect(persists.row.marginTop).toBe(real.row.marginTop);
    expect(persists.row.marginBottom).toBe(real.row.marginBottom);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 5. Row spacing unchanged (no extra gap added by disabled state)
// -----------------------------------------------------------------

test('H3A — inter-row spacing is identical between REAL and PERSISTS_ONLY rows', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h3a-row-spacing-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    // Compare REAL row to PERSISTS_ONLY row + check no spacing
    // attribute differs.
    const spacing = await page.evaluate((ids) => {
      function metric(id) {
        const r = document.querySelector('.rga-settings-row[data-setting-id="' + id + '"]');
        if (!r) return null;
        const cs = getComputedStyle(r);
        return {
          paddingTop:    cs.paddingTop,
          paddingBottom: cs.paddingBottom,
          marginTop:     cs.marginTop,
          marginBottom:  cs.marginBottom,
          borderTopWidth: cs.borderTopWidth,
          borderBottomWidth: cs.borderBottomWidth,
          rowGap:        cs.rowGap
        };
      }
      return { real: metric(ids.real), persists: metric(ids.persists) };
    }, { real: REAL_ID, persists: PERSISTS_ID });
    expect(spacing.persists).toEqual(spacing.real);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 6. Hierarchy / typography unchanged
// -----------------------------------------------------------------

test('H3A — label and helper typography (size, weight, line-height) are identical across row states', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h3a-typography-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const real = await probe(page, REAL_ID);
    const persists = await probe(page, PERSISTS_ID);
    // Label hierarchy preserved.
    expect(persists.label.fontSize).toBe(real.label.fontSize);
    expect(persists.label.fontWeight).toBe(real.label.fontWeight);
    expect(persists.label.lineHeight).toBe(real.label.lineHeight);
    expect(persists.label.color).toBe(real.label.color);
    // Helper hierarchy preserved.
    expect(persists.desc.fontSize).toBe(real.desc.fontSize);
    expect(persists.desc.fontWeight).toBe(real.desc.fontWeight);
    expect(persists.desc.lineHeight).toBe(real.desc.lineHeight);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 7. Row container opacity is exactly 1.0 (no inherited fade)
// -----------------------------------------------------------------

test('H3A — PERSISTS_ONLY row container opacity is 1.0 (no row-level fade)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h3a-row-op-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const persists = await probe(page, PERSISTS_ID);
    expect(parseFloat(persists.row.opacity)).toBe(1);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
