// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Window Zoom — H5 (RC1 §5.2.5).
//
// First slider control to ship in Settings. Proves the six behaviors
// mandated by the H5 brief:
//   1. slider renders with the constitutional shape
//      (input[type=range] inside .rga-settings-control-slider wrap,
//       with min/max/step/unit drawn from the registry)
//   2. slider interaction updates the inner value
//   3. Store receives the update via Settings.Store
//   4. value survives a close + reopen cycle (prefs persistence)
//   5. Store.set(default) resets both the visible value AND the
//      applied zoom factor (no UI reset button this slice — RC1 §4.1
//      reset glyph is deferred until design authorizes it)
//   6. visible UI scales — webFrame.getZoomFactor reflects the
//      Store.effective value as 0.5x–2.0x factor
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
  await page.click('[data-section-id="general"]');
  await page.waitForSelector('.rga-settings-row[data-setting-id="windowZoom"]');
  return { app, page };
}

// Set the slider's inner range input to a value and dispatch the same
// input event the user's drag would trigger. The _makeSlider re-emits
// `change` on every input, so this drives the whole wire path.
async function setSliderValue(page, value) {
  await page.evaluate((v) => {
    const input = document.querySelector(
      '.rga-settings-row[data-setting-id="windowZoom"] input[type="range"]');
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

// -----------------------------------------------------------------
// 1. Slider renders with constitutional shape
// -----------------------------------------------------------------

test('H5 — windowZoom row renders the constitutional slider control', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h5-render-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const row = page.locator('.rga-settings-row[data-setting-id="windowZoom"]');
    await expect(row).toBeVisible();

    // The PERSISTS_ONLY treatment must NOT apply — windowZoom is wired.
    await expect(row).not.toHaveClass(/is-persists-only/);
    const desc = await row.locator('.rga-settings-row-description').textContent();
    expect((desc || '').endsWith('Behavior not wired yet.')).toBe(false);

    // Constitutional shape: a wrap + a native range input + a value label.
    const wrap = row.locator('.rga-settings-control-slider');
    await expect(wrap).toBeVisible();

    const input = wrap.locator('input[type="range"]');
    await expect(input).toBeVisible();
    await expect(input).not.toBeDisabled();
    expect(await input.getAttribute('min')).toBe('50');
    expect(await input.getAttribute('max')).toBe('200');
    expect(await input.getAttribute('step')).toBe('10');

    const label = wrap.locator('.rga-settings-control-slider-value');
    await expect(label).toBeVisible();
    expect((await label.textContent()).trim()).toBe('100%');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 2. Slider interaction changes the visible value
// 3. Store receives the update
// -----------------------------------------------------------------

test('H5 — slider interaction updates the value label and writes through Settings.Store', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h5-interact-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    // Instrument Store.set so we can assert the wire path fired.
    await page.evaluate(() => {
      window.__zoomSetCalls = [];
      const orig = window.Rga.Settings.Store.set;
      window.Rga.Settings.Store.set = function(id, value, opts) {
        if (id === 'windowZoom') window.__zoomSetCalls.push(value);
        return orig.call(window.Rga.Settings.Store, id, value, opts);
      };
    });

    await setSliderValue(page, 150);

    // The visible label and Store effective both reflect 150.
    const labelText = await page.locator(
      '.rga-settings-row[data-setting-id="windowZoom"] .rga-settings-control-slider-value'
    ).textContent();
    expect((labelText || '').trim()).toBe('150%');

    const effective = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('windowZoom'));
    expect(effective).toBe(150);

    // The wire path called Store.set with the new value.
    const calls = await page.evaluate(() => window.__zoomSetCalls.slice());
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]).toBe(150);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 4. Reload preserves the value
// -----------------------------------------------------------------

test('H5 — windowZoom persists across a close + reopen and reapplies at boot', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h5-persist-'));
  try {
    // First launch: set to 130 and wait for the pref write to land.
    {
      const { app, page } = await launchAndOpen(userDataDir);
      await setSliderValue(page, 130);
      await page.waitForFunction(() =>
        window.rwanga.prefs.read().then((p) => p['windowZoom'] === 130));
      await app.close();
    }
    // Second launch: Store.effective is 130, applicator has reapplied.
    {
      const { app, page } = await launchAndOpen(userDataDir);
      try {
        const effective = await page.evaluate(() =>
          window.Rga.Settings.Store.effective('windowZoom'));
        expect(effective).toBe(130);

        const labelText = await page.locator(
          '.rga-settings-row[data-setting-id="windowZoom"] .rga-settings-control-slider-value'
        ).textContent();
        expect((labelText || '').trim()).toBe('130%');

        const factor = await page.evaluate(() =>
          window.rwanga.window.getZoomFactor());
        expect(factor).toBeCloseTo(1.3, 2);
      } finally {
        await app.close();
      }
    }
  } finally {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 5. Reset behavior: Store.set(default) restores both UI + zoom
// -----------------------------------------------------------------

test('H5 — Store.set(default) returns the slider to 100% and resets the renderer zoom', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h5-reset-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    // Move away from the default, confirm the zoom factor reflects it.
    // The slider's step:10 means we pick a multiple of 10 to avoid the
    // native input snapping to a neighbouring step.
    await setSliderValue(page, 170);
    const beforeFactor = await page.evaluate(() =>
      window.rwanga.window.getZoomFactor());
    expect(beforeFactor).toBeCloseTo(1.7, 2);

    // "Reset" via the Store-level path: write the registry default.
    // No UI reset button in this slice (RC1 §4.1 deferred).
    const defaultVal = await page.evaluate(() =>
      window.Rga.Settings.Registry.getDefault('windowZoom'));
    expect(defaultVal).toBe(100);
    await page.evaluate((v) => window.Rga.Settings.Store.set('windowZoom', v), defaultVal);

    // The slider visual + the Store effective + the applied factor all
    // return to the default.
    const labelText = await page.locator(
      '.rga-settings-row[data-setting-id="windowZoom"] .rga-settings-control-slider-value'
    ).textContent();
    expect((labelText || '').trim()).toBe('100%');

    const effective = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('windowZoom'));
    expect(effective).toBe(100);

    const afterFactor = await page.evaluate(() =>
      window.rwanga.window.getZoomFactor());
    expect(afterFactor).toBeCloseTo(1.0, 2);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 6. Visible UI scales — webFrame.getZoomFactor matches Store.effective
// -----------------------------------------------------------------

test('H5 — Store.set propagates through the applicator into webFrame.setZoomFactor (visible UI change)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h5-visible-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    // Cross-check several percentages map to the expected zoom factor.
    const cases = [
      { pct: 50,  factor: 0.5 },
      { pct: 100, factor: 1.0 },
      { pct: 130, factor: 1.3 },
      { pct: 200, factor: 2.0 }
    ];
    for (const c of cases) {
      await page.evaluate((p) => window.Rga.Settings.Store.set('windowZoom', p), c.pct);
      const factor = await page.evaluate(() =>
        window.rwanga.window.getZoomFactor());
      expect(factor).toBeCloseTo(c.factor, 2);
    }

    // Defensive clamp inside the applicator: an out-of-range Store
    // value never escapes into webFrame. (The slider itself is clamped
    // by the native input min/max, but Store.set can be called from
    // anywhere.)
    await page.evaluate(() => window.Rga.Settings.Store.set('windowZoom', 500));
    const clampedHigh = await page.evaluate(() =>
      window.rwanga.window.getZoomFactor());
    expect(clampedHigh).toBeCloseTo(2.0, 2);

    await page.evaluate(() => window.Rga.Settings.Store.set('windowZoom', 10));
    const clampedLow = await page.evaluate(() =>
      window.rwanga.window.getZoomFactor());
    expect(clampedLow).toBeCloseTo(0.5, 2);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
