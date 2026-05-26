// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Honest Controls Foundation — H3 (Settings Constitution v1.0 RC1).
//
// Proves the five visible behaviors mandated by the H3 brief:
//   1. PERSISTS_ONLY controls are non-interactive (disabled + no writes)
//   2. helper text appears with the literal "Behavior not wired yet."
//   3. row carries 60% opacity (RC1 §8.1.2)
//   4. Store ownership respected — no direct DOM/localStorage writes
//   5. PERSISTS_ONLY controls do not call Store.set on attempted input
//
// Plus a negative assertion that the forbidden type chip
// (.rga-settings-row-type-chip) is no longer rendered anywhere
// (RC1 §7.3).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launch(userDataDir) {
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Settings && window.Rga.Settings.Store &&
    window.Rga.Settings.Applicators && window.Rga.SettingsWorkspace
  ));
  await page.evaluate(async () => { await window.Rga.Settings.Store.init(); });
  await page.evaluate(() => window.Rga.SettingsWorkspace.open());
  // Wait for the workspace surface to render.
  await page.waitForSelector('[data-renderer="workspace"][data-workspace-kind="settings"] .rga-settings-row',
    { timeout: 5000 });
  return { app, page };
}

// A known PERSISTS_ONLY entry (no applicator today). Stable across the
// arc — autosave.enabled stays PERSISTS_ONLY until its applicator
// lands in a future slice. If it becomes REAL, this test will report
// the change explicitly.
const PERSISTS_ONLY_ID = 'autosave.enabled';
const PERSISTS_ONLY_SECTION = 'autosave';

// A known REAL entry — wired in H2.
const REAL_ID = 'theme';

// -----------------------------------------------------------------
// Rule (1) + (3) — PERSISTS_ONLY rows are non-interactive at 60%
// -----------------------------------------------------------------

test('H3 — PERSISTS_ONLY row carries 60% opacity and aria-disabled (RC1 §8.1.2)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h3-opacity-'));
  const { app, page } = await launch(userDataDir);
  try {
    await page.click('[data-section-id="' + PERSISTS_ONLY_SECTION + '"]');
    const row = page.locator('.rga-settings-row[data-setting-id="' + PERSISTS_ONLY_ID + '"]');
    await expect(row).toHaveClass(/is-persists-only/);
    await expect(row).toHaveAttribute('aria-disabled', 'true');
    const opacity = await row.evaluate((el) => getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeCloseTo(0.6, 2);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('H3 — PERSISTS_ONLY control has the disabled attribute (RC1 §8.1.2)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h3-disabled-'));
  const { app, page } = await launch(userDataDir);
  try {
    await page.click('[data-section-id="' + PERSISTS_ONLY_SECTION + '"]');
    const ctrl = page.locator(
      '.rga-settings-row[data-setting-id="' + PERSISTS_ONLY_ID + '"] input[type="checkbox"]');
    await expect(ctrl).toBeDisabled();
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// Rule (2) — helper text appended with literal "Behavior not wired yet."
// -----------------------------------------------------------------

test('H3 — PERSISTS_ONLY row helper text ends with "Behavior not wired yet." (RC1 §8.1.2)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h3-helper-'));
  const { app, page } = await launch(userDataDir);
  try {
    await page.click('[data-section-id="' + PERSISTS_ONLY_SECTION + '"]');
    const desc = await page.$eval(
      '.rga-settings-row[data-setting-id="' + PERSISTS_ONLY_ID + '"] .rga-settings-row-description',
      (el) => el.textContent.trim());
    expect(desc.endsWith('Behavior not wired yet.')).toBe(true);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// Rule (4) + (5) — attempted interaction does not call Store.set
// (Store ownership respected, no fake-live writes)
// -----------------------------------------------------------------

test('H3 — attempting to interact with a PERSISTS_ONLY control does NOT call Store.set', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h3-no-write-'));
  const { app, page } = await launch(userDataDir);
  try {
    await page.click('[data-section-id="' + PERSISTS_ONLY_SECTION + '"]');

    // Snapshot the user-tier value before; instrument Store.set so
    // any post-interaction call is observable.
    await page.evaluate(() => {
      window.__setCalls = [];
      const origSet = window.Rga.Settings.Store.set;
      window.Rga.Settings.Store.set = function(id, value, opts) {
        window.__setCalls.push({ id: id, value: value });
        return origSet.call(window.Rga.Settings.Store, id, value, opts);
      };
    });

    const before = await page.evaluate(() =>
      window.Rga.Settings.Store.get('autosave.enabled', 'user'));

    // Try to interact. The control is disabled, so click should be a
    // no-op; we also dispatch a synthetic change event in case some
    // path tries to bypass the disabled state.
    const ctrl = page.locator(
      '.rga-settings-row[data-setting-id="' + PERSISTS_ONLY_ID + '"] input[type="checkbox"]');
    await ctrl.click({ force: true });   // force-bypasses the disabled actionable check
    await page.evaluate(() => {
      const el = document.querySelector(
        '.rga-settings-row[data-setting-id="autosave.enabled"] input[type="checkbox"]');
      if (el) {
        el.checked = !el.checked;        // direct DOM mutation
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const after = await page.evaluate(() =>
      window.Rga.Settings.Store.get('autosave.enabled', 'user'));
    const setCalls = await page.evaluate(() =>
      window.__setCalls.filter((c) => c.id === 'autosave.enabled'));

    expect(setCalls.length).toBe(0);   // no Store.set for this id
    expect(after).toBe(before);         // user tier unchanged
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// REAL row contrast: same surface, fully interactive, no PERSISTS
// flag and no honest-state appended helper.
// -----------------------------------------------------------------

test('H3 — REAL row (theme) renders fully interactive without the PERSISTS_ONLY treatment', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h3-real-row-'));
  const { app, page } = await launch(userDataDir);
  try {
    await page.click('[data-section-id="general"]');
    const row = page.locator('.rga-settings-row[data-setting-id="' + REAL_ID + '"]');
    await expect(row).not.toHaveClass(/is-persists-only/);
    const desc = await page.$eval(
      '.rga-settings-row[data-setting-id="' + REAL_ID + '"] .rga-settings-row-description',
      (el) => el.textContent.trim());
    expect(desc.endsWith('Behavior not wired yet.')).toBe(false);
    const opacity = await row.evaluate((el) => getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeCloseTo(1.0, 2);
    // Radio inputs accept input.
    const radios = page.locator(
      '.rga-settings-row[data-setting-id="' + REAL_ID + '"] input[type="radio"]');
    const count = await radios.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(radios.nth(i)).not.toBeDisabled();
    }
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// RC1 §7.3 — the forbidden control-type chip is absent from EVERY row
// -----------------------------------------------------------------

test('H3 — no row renders the forbidden control-type chip (RC1 §7.3)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h3-no-chip-'));
  const { app, page } = await launch(userDataDir);
  try {
    // Walk every section and assert the chip is nowhere.
    const sectionIds = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-section-id]'))
        .map((el) => el.getAttribute('data-section-id')));
    expect(sectionIds.length).toBeGreaterThan(0);
    for (const sid of sectionIds) {
      await page.click('[data-section-id="' + sid + '"]');
      const chipCount = await page.evaluate(() =>
        document.querySelectorAll('.rga-settings-row-type-chip').length);
      expect(chipCount).toBe(0);
    }
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
