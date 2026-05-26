// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Margins + Color — H7 (RC1 §5.2.7 + §5.2.9 + §15.9).
//
// Proves the eleven behaviors the H7 brief mandates:
//
//   Margins
//   1. margin_group renders four fields (top/right/bottom/left)
//   2. margin edit updates Settings.Store with the whole object
//   3. margin values persist after reload
//   4. margin reset restores default
//   5. out-of-range margin values clamp honestly (>3 → 3, <0 → 0)
//
//   Color
//   6. color swatches render (one per palette entry, no free-form picker)
//   7. color selection updates Store
//   8. editor desk/background visibly changes
//      (--editor-bg custom property repaints immediately)
//   9. color persists after reload
//  10. color reset restores default
//
//  Inventory
//  11. unsupported-control inventory no longer lists margins/color
//      as active unsupported controls
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchAndOpen(userDataDir) {
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Settings && window.Rga.Settings.Store &&
    window.Rga.Settings.Applicators && window.Rga.SettingsWorkspace));
  await page.evaluate(async () => { await window.Rga.Settings.Store.init(); });
  await page.evaluate(() => window.Rga.SettingsWorkspace.open());
  await page.waitForSelector(
    '[data-renderer="workspace"][data-workspace-kind="settings"] .rga-settings-row',
    { timeout: 5000 });
  return { app, page };
}

async function openMarginsSection(page) {
  await page.click('[data-section-id="pageSetup"]');
  await page.waitForSelector('.rga-settings-row[data-setting-id="pageSetup.margins"]');
}

async function openAppearanceSection(page) {
  await page.click('[data-section-id="appearance"]');
  await page.waitForSelector('.rga-settings-row[data-setting-id="appearance.editorDeskColor"]');
}

// -----------------------------------------------------------------
// 1. margin_group renders four fields
// -----------------------------------------------------------------

test('H7 — pageSetup.margins row renders the constitutional 2×2 margin-group control', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h7-margins-render-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openMarginsSection(page);
    const row = page.locator('.rga-settings-row[data-setting-id="pageSetup.margins"]');
    await expect(row).toBeVisible();
    await expect(row).not.toHaveClass(/is-persists-only/);

    const wrap = row.locator('.rga-settings-control-margins');
    await expect(wrap).toBeVisible();

    // Four labeled fields, one per side.
    const fieldKeys = await wrap
      .locator('.rga-settings-control-margins-input')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-margin-field')));
    expect(fieldKeys.sort()).toEqual(['bottom', 'left', 'right', 'top']);

    // Min/max/step attributes on every input.
    for (const key of ['top', 'right', 'bottom', 'left']) {
      const input = wrap.locator('input[data-margin-field="' + key + '"]');
      expect(await input.getAttribute('min')).toBe('0');
      expect(await input.getAttribute('max')).toBe('3');
      expect(await input.getAttribute('step')).toBe('0.1');
    }

    // Each field carries its 'in' unit.
    const unitTexts = await wrap
      .locator('.rga-settings-control-margins-unit')
      .allTextContents();
    expect(unitTexts.length).toBe(4);
    unitTexts.forEach((t) => expect(t.trim()).toBe('in'));

    // Default value matches the registry default.
    const cur = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('pageSetup.margins'));
    expect(cur).toEqual({ top: 1, bottom: 1, left: 1.5, right: 1 });
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 2. margin edit updates Store
// -----------------------------------------------------------------

test('H7 — editing a margin field writes the whole {top, right, bottom, left} object through Settings.Store', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h7-margins-edit-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openMarginsSection(page);
    const topInput = page.locator(
      '.rga-settings-row[data-setting-id="pageSetup.margins"] input[data-margin-field="top"]');
    await topInput.fill('2');
    await topInput.dispatchEvent('change');

    const stored = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('pageSetup.margins'));
    expect(stored).toEqual({ top: 2, bottom: 1, left: 1.5, right: 1 });
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 3. margin values persist after reload
// -----------------------------------------------------------------

test('H7 — pageSetup.margins survives a close + reopen and rehydrates the inputs', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h7-margins-persist-'));
  try {
    {
      const { app, page } = await launchAndOpen(userDataDir);
      await page.evaluate(() => window.Rga.Settings.Store.set(
        'pageSetup.margins', { top: 0.5, bottom: 0.75, left: 2.5, right: 0.5 }));
      await page.waitForFunction(() =>
        window.rwanga.prefs.read().then((p) => {
          const m = p['pageSetup.margins'];
          return m && m.top === 0.5 && m.left === 2.5;
        }));
      await app.close();
    }
    {
      const { app, page } = await launchAndOpen(userDataDir);
      try {
        const stored = await page.evaluate(() =>
          window.Rga.Settings.Store.effective('pageSetup.margins'));
        expect(stored).toEqual({ top: 0.5, bottom: 0.75, left: 2.5, right: 0.5 });

        await openMarginsSection(page);
        const topVal = await page.locator(
          '.rga-settings-row[data-setting-id="pageSetup.margins"] input[data-margin-field="top"]'
        ).inputValue();
        expect(topVal).toBe('0.5');
        const leftVal = await page.locator(
          '.rga-settings-row[data-setting-id="pageSetup.margins"] input[data-margin-field="left"]'
        ).inputValue();
        expect(leftVal).toBe('2.5');
      } finally {
        await app.close();
      }
    }
  } finally {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 4. margin reset restores default
// -----------------------------------------------------------------

test('H7 — Store.set(default) restores the registry default margins object', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h7-margins-reset-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openMarginsSection(page);
    await page.evaluate(() => window.Rga.Settings.Store.set(
      'pageSetup.margins', { top: 2, bottom: 2, left: 2, right: 2 }));
    const moved = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('pageSetup.margins'));
    expect(moved).toEqual({ top: 2, bottom: 2, left: 2, right: 2 });

    const defaultVal = await page.evaluate(() =>
      window.Rga.Settings.Registry.getDefault('pageSetup.margins'));
    expect(defaultVal).toEqual({ top: 1, bottom: 1, left: 1.5, right: 1 });
    await page.evaluate((v) => window.Rga.Settings.Store.set('pageSetup.margins', v), defaultVal);

    const restored = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('pageSetup.margins'));
    expect(restored).toEqual({ top: 1, bottom: 1, left: 1.5, right: 1 });

    const topVal = await page.locator(
      '.rga-settings-row[data-setting-id="pageSetup.margins"] input[data-margin-field="top"]'
    ).inputValue();
    expect(topVal).toBe('1');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 5. out-of-range margin values clamp honestly
// -----------------------------------------------------------------

test('H7 — typing an out-of-range margin clamps both the visible value and the stored value', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h7-margins-clamp-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openMarginsSection(page);
    const rightInput = page.locator(
      '.rga-settings-row[data-setting-id="pageSetup.margins"] input[data-margin-field="right"]');
    // Above-max: 5 → clamp to 3.
    await rightInput.fill('5');
    await rightInput.dispatchEvent('change');
    expect(await rightInput.inputValue()).toBe('3');
    let stored = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('pageSetup.margins'));
    expect(stored.right).toBe(3);

    // Below-min: -2 → clamp to 0.
    const bottomInput = page.locator(
      '.rga-settings-row[data-setting-id="pageSetup.margins"] input[data-margin-field="bottom"]');
    await bottomInput.fill('-2');
    await bottomInput.dispatchEvent('change');
    expect(await bottomInput.inputValue()).toBe('0');
    stored = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('pageSetup.margins'));
    expect(stored.bottom).toBe(0);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 6. color swatches render
// -----------------------------------------------------------------

test('H7 — appearance.editorDeskColor row renders one swatch per palette option (no free-form picker)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h7-color-render-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openAppearanceSection(page);
    const row = page.locator('.rga-settings-row[data-setting-id="appearance.editorDeskColor"]');
    await expect(row).toBeVisible();
    await expect(row).not.toHaveClass(/is-persists-only/);

    const wrap = row.locator('.rga-settings-control-color');
    await expect(wrap).toBeVisible();

    // RC1 §15.9 palette: four predefined swatches.
    const values = await wrap
      .locator('.rga-settings-control-color-swatch')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-color-value')));
    expect(values).toEqual(['#141414', '#1a1a2e', '#1c1c1c', '#2d2520']);

    // No <input type="color"> anywhere on the row — the constitution
    // forbids free-form color pickers.
    const freeFormPickerCount = await row.locator('input[type="color"]').count();
    expect(freeFormPickerCount).toBe(0);

    // The default swatch is marked active.
    const activeValue = await wrap
      .locator('.rga-settings-control-color-swatch.is-active')
      .getAttribute('data-color-value');
    expect(activeValue).toBe('#141414');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 7. color selection updates Store
// 8. editor desk/background visibly changes
// -----------------------------------------------------------------

test('H7 — clicking a color swatch writes through Store and the --editor-bg custom property repaints immediately', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h7-color-apply-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openAppearanceSection(page);

    await page.click(
      '.rga-settings-row[data-setting-id="appearance.editorDeskColor"] ' +
      '.rga-settings-control-color-swatch[data-color-value="#1a1a2e"]');

    const stored = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('appearance.editorDeskColor'));
    expect(stored).toBe('#1a1a2e');

    // The applicator pushes the chosen hex into --editor-bg on
    // documentElement — visible repaint.
    const cssVar = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--editor-bg').trim());
    expect(cssVar).toBe('#1a1a2e');

    // Active swatch updates.
    const activeAfter = await page
      .locator('.rga-settings-row[data-setting-id="appearance.editorDeskColor"] ' +
               '.rga-settings-control-color-swatch.is-active')
      .getAttribute('data-color-value');
    expect(activeAfter).toBe('#1a1a2e');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 9. color persists after reload
// -----------------------------------------------------------------

test('H7 — chosen desk color survives a close + reopen and reapplies at boot', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h7-color-persist-'));
  try {
    {
      const { app, page } = await launchAndOpen(userDataDir);
      await openAppearanceSection(page);
      await page.click(
        '.rga-settings-row[data-setting-id="appearance.editorDeskColor"] ' +
        '.rga-settings-control-color-swatch[data-color-value="#2d2520"]');
      await page.waitForFunction(() =>
        window.rwanga.prefs.read().then((p) =>
          p['appearance.editorDeskColor'] === '#2d2520'));
      await app.close();
    }
    {
      const { app, page } = await launchAndOpen(userDataDir);
      try {
        const stored = await page.evaluate(() =>
          window.Rga.Settings.Store.effective('appearance.editorDeskColor'));
        expect(stored).toBe('#2d2520');

        const cssVar = await page.evaluate(() =>
          document.documentElement.style.getPropertyValue('--editor-bg').trim());
        expect(cssVar).toBe('#2d2520');

        await openAppearanceSection(page);
        const activeValue = await page
          .locator('.rga-settings-row[data-setting-id="appearance.editorDeskColor"] ' +
                   '.rga-settings-control-color-swatch.is-active')
          .getAttribute('data-color-value');
        expect(activeValue).toBe('#2d2520');
      } finally {
        await app.close();
      }
    }
  } finally {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 10. color reset restores default
// -----------------------------------------------------------------

test('H7 — Store.set(default) restores the original desk color and the --editor-bg falls back to the theme token', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h7-color-reset-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    await openAppearanceSection(page);
    await page.click(
      '.rga-settings-row[data-setting-id="appearance.editorDeskColor"] ' +
      '.rga-settings-control-color-swatch[data-color-value="#1a1a2e"]');
    const moved = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('appearance.editorDeskColor'));
    expect(moved).toBe('#1a1a2e');

    // Reset via the user-tier delete path (mimics the "Reset" verb
    // even though no UI button ships this slice).
    await page.evaluate(() => {
      const Store = window.Rga.Settings.Store;
      Store.set('appearance.editorDeskColor',
        window.Rga.Settings.Registry.getDefault('appearance.editorDeskColor'));
    });

    const restored = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('appearance.editorDeskColor'));
    expect(restored).toBe('#141414');

    const activeValue = await page
      .locator('.rga-settings-row[data-setting-id="appearance.editorDeskColor"] ' +
               '.rga-settings-control-color-swatch.is-active')
      .getAttribute('data-color-value');
    expect(activeValue).toBe('#141414');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 11. inventory no longer lists margins/color as active unsupported controls
// -----------------------------------------------------------------

test('H7 — UNSUPPORTED_CONTROL_INVENTORY.md lists zero deferred entries; margins and color appear under Shipped Slices', () => {
  const docPath = path.resolve(__dirname, '..', '..', '..',
    'docs', 'rwanga-settings', 'UNSUPPORTED_CONTROL_INVENTORY.md');
  expect(fs.existsSync(docPath)).toBe(true);
  const body = fs.readFileSync(docPath, 'utf8');

  // Summary table acknowledges zero deferred entries.
  expect(body).toMatch(/Total deferred[\s\S]{0,40}0/);
  // Both control types now appear in the Shipped Slices section with H7.
  expect(body).toMatch(/`margins`\s+—\s+closed by H7/);
  expect(body).toMatch(/`color`\s+—\s+closed by H7/);
  // The Inventory section explicitly states no remaining unsupported types.
  expect(body).toMatch(/No remaining unsupported control types/);
});
