// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Theme Constitutional Activation — H2 integration proof.
//
// Proves the four constitutional conditions for the `theme` setting:
//   1. labels are human-readable (Dark / Light / System), no codes
//   2. state is visually readable (color-scheme: dark light declared)
//   3. behavior is wired (Store -> Rga.Theme bridge produces visible
//      data-theme flips for dark, light, and matchMedia-resolved
//      'system'; persists across reload; bi-directional Ctrl+Shift+T
//      sync writes back to the Store; legacy localStorage migrates
//      into prefs once)
//   4. (this file) Playwright proves it.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');

async function launch(userDataDir, options) {
  options = options || {};
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Settings && window.Rga.Settings.Store &&
    window.Rga.Settings.Applicators && window.Rga.Theme
  ));
  // Ensure the boot Store.init() chain has finished and applyAll has
  // run by waiting for the user tier to be settled. Calling init()
  // again is idempotent.
  await page.evaluate(async () => { await window.Rga.Settings.Store.init(); });
  if (options.colorScheme) {
    await page.emulateMedia({ colorScheme: options.colorScheme });
  }
  return { app, page };
}

// -----------------------------------------------------------------
// Rule 1 — labels are human-readable
// -----------------------------------------------------------------

test('H2 — theme radio displays human labels (Dark / Light / System), not raw codes', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h2-labels-'));
  const { app, page } = await launch(userDataDir);
  try {
    // Open the Settings workspace via the canonical opener so the
    // theme radio is mounted.
    await page.evaluate(() => window.Rga.SettingsWorkspace.open());
    const labelText = await page.evaluate(() => {
      const group = document.querySelector('[data-control-for="theme"]');
      if (!group) return null;
      return Array.from(group.querySelectorAll('label span'))
        .map((s) => s.textContent.trim());
    });
    expect(labelText).toEqual(['Dark', 'Light', 'System']);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// Rule 2 — state is visually readable
// -----------------------------------------------------------------

test('H2 — color-scheme: dark light is declared on :root for native select readability', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h2-cscheme-'));
  const { app, page } = await launch(userDataDir);
  try {
    const colorScheme = await page.evaluate(() =>
      getComputedStyle(document.documentElement).colorScheme);
    expect(colorScheme).toMatch(/dark/);
    expect(colorScheme).toMatch(/light/);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// Rule 3 — behavior is wired (the bulk of the proof)
// -----------------------------------------------------------------

test('H2 — selecting Light via Store flips data-theme to light synchronously', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h2-light-'));
  const { app, page } = await launch(userDataDir);
  try {
    const before = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'));
    expect(before).toBe('dark');

    await page.evaluate(() => window.Rga.Settings.Store.set('theme', 'light'));
    const after = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'));
    expect(after).toBe('light');

    await page.evaluate(() => window.Rga.Settings.Store.set('theme', 'dark'));
    const back = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'));
    expect(back).toBe('dark');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test("H2 — 'system' resolves via matchMedia and re-resolves when the OS scheme flips", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h2-system-'));
  const { app, page } = await launch(userDataDir, { colorScheme: 'dark' });
  try {
    await page.evaluate(() => window.Rga.Settings.Store.set('theme', 'system'));
    const dark = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'));
    expect(dark).toBe('dark');

    await page.emulateMedia({ colorScheme: 'light' });
    // matchMedia 'change' fires asynchronously in the renderer; poll.
    await page.waitForFunction(() =>
      document.documentElement.getAttribute('data-theme') === 'light',
      null, { timeout: 2000 });

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() =>
      document.documentElement.getAttribute('data-theme') === 'dark',
      null, { timeout: 2000 });

    // Setting persisted is still 'system' — the resolved DOM value is
    // a derivation, not a write-back.
    const stored = await page.evaluate(() =>
      window.Rga.Settings.Store.get('theme', 'user'));
    expect(stored).toBe('system');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('H2 — chosen theme persists across a close + reopen', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h2-persist-'));
  try {
    {
      const { app, page } = await launch(userDataDir);
      await page.evaluate(() => window.Rga.Settings.Store.set('theme', 'light'));
      await page.waitForFunction(() =>
        window.rwanga.prefs.read().then((p) => p['theme'] === 'light'));
      await app.close();
    }
    {
      const { app, page } = await launch(userDataDir);
      try {
        const effective = await page.evaluate(() =>
          window.Rga.Settings.Store.effective('theme'));
        expect(effective).toBe('light');
        const domTheme = await page.evaluate(() =>
          document.documentElement.getAttribute('data-theme'));
        expect(domTheme).toBe('light');
      } finally {
        await app.close();
      }
    }
  } finally {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('H2 — Ctrl+Shift+T inverse-syncs Rga.Theme back into the Settings store', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h2-inverse-'));
  const { app, page } = await launch(userDataDir);
  try {
    // Establish a known start state.
    await page.evaluate(() => window.Rga.Settings.Store.set('theme', 'dark'));
    expect(await page.evaluate(() => window.Rga.Theme.current)).toBe('dark');

    // The keyboard handler is wired in app-shell.js. Invoke the same
    // path the Ctrl+Shift+T binding takes by calling toggle directly
    // (the Playwright keyboard press path is sensitive to focus state
    // in Electron; the inverse-sync we want to prove fires on
    // Rga.Theme.onChange regardless of who triggered the toggle).
    await page.evaluate(() => window.Rga.Theme.toggle());

    await page.waitForFunction(() =>
      window.Rga.Settings.Store.get('theme', 'user') === 'light',
      null, { timeout: 2000 });

    expect(await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'))).toBe('light');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// H2B — Settings is the SINGLE source of truth for theme
// -----------------------------------------------------------------

test("H2B — legacy doc.settings.theme MUST NOT shadow the user's Settings choice across close + reopen", async () => {
  // Reproduces the bug the user reported: pick Light in Settings,
  // close, reopen, app reverts to Dark because a legacy .rga file
  // carries `settings.theme = 'dark'` and the Store cascade used to
  // give script-tier priority over user-tier. H2B blocks script-tier
  // shadowing of persistsTo:'user' ids.
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h2b-legacy-'));
  try {
    {
      const { app, page } = await launch(userDataDir);
      // Force an active doc to carry the legacy theme key, then set
      // Light via Settings.Store and wait for prefs to flush.
      await page.evaluate(() => {
        const doc = window.Rga.TabManager.activeDoc && window.Rga.TabManager.activeDoc();
        if (doc) { doc.settings = doc.settings || {}; doc.settings.theme = 'dark'; }
        window.Rga.Settings.Store.set('theme', 'light', { tier: 'user' });
      });
      await page.waitForFunction(() =>
        window.rwanga.prefs.read().then((p) => p['theme'] === 'light'));
      // Effective MUST be 'light' immediately, despite the script-tier
      // 'dark' in doc.settings — Settings.Store user-tier wins.
      const effective = await page.evaluate(() =>
        window.Rga.Settings.Store.effective('theme'));
      expect(effective).toBe('light');
      const dom = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme'));
      expect(dom).toBe('light');
      await app.close();
    }
    {
      const { app, page } = await launch(userDataDir);
      try {
        const effective = await page.evaluate(() =>
          window.Rga.Settings.Store.effective('theme'));
        expect(effective).toBe('light');
        const dom = await page.evaluate(() =>
          document.documentElement.getAttribute('data-theme'));
        expect(dom).toBe('light');
      } finally {
        await app.close();
      }
    }
  } finally {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('H2B — Rga.SettingsTheme.toggle is the production helper and writes through Settings.Store', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h2b-helper-'));
  const { app, page } = await launch(userDataDir);
  try {
    const hasHelper = await page.evaluate(() =>
      !!(window.Rga.SettingsTheme && typeof window.Rga.SettingsTheme.toggle === 'function'));
    expect(hasHelper).toBe(true);

    await page.evaluate(() => window.Rga.Settings.Store.set('theme', 'dark', { tier: 'user' }));
    await page.evaluate(() => window.Rga.SettingsTheme.toggle());
    expect(await page.evaluate(() =>
      window.Rga.Settings.Store.get('theme', 'user'))).toBe('light');
    expect(await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'))).toBe('light');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('H2B — the status bar theme instrument click routes through Settings.Store, not Rga.Theme directly', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h2b-statusbar-'));
  const { app, page } = await launch(userDataDir);
  try {
    // Establish a known starting state via Settings.
    await page.evaluate(() => window.Rga.Settings.Store.set('theme', 'dark', { tier: 'user' }));

    // Click the status bar theme instrument.
    const seg = await page.$('[data-segment="theme"]');
    expect(seg).not.toBeNull();
    await seg.click();

    // After the click, Settings.Store user-tier must hold the new
    // value AND the DOM must reflect it.
    await page.waitForFunction(() =>
      window.Rga.Settings.Store.get('theme', 'user') === 'light',
      null, { timeout: 2000 });
    expect(await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'))).toBe('light');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('H2 — legacy localStorage rga-theme migrates into prefs.theme exactly once', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-h2-migrate-'));
  const { app, page } = await launch(userDataDir);
  try {
    // Wipe Store user-tier and set up the pre-migration condition:
    // prefs has no theme, legacy localStorage holds 'light'.
    await page.evaluate(async () => {
      window.Rga.Settings.Store._reset();
      await window.Rga.Settings.Store.init();
      window.localStorage.setItem('rga-theme', 'light');
    });
    expect(await page.evaluate(() =>
      window.Rga.Settings.Store.get('theme', 'user'))).toBe(undefined);

    // Run the migration explicitly (boot path normally invokes this).
    await page.evaluate(async () => { await window.Rga.Settings.Migrations.run(); });

    const after = await page.evaluate(() =>
      window.Rga.Settings.Store.get('theme', 'user'));
    expect(after).toBe('light');

    // Idempotence: a second run must not change anything.
    await page.evaluate(async () => {
      window.localStorage.setItem('rga-theme', 'dark');  // sneak a different legacy value
      await window.Rga.Settings.Migrations.run();
    });
    const second = await page.evaluate(() =>
      window.Rga.Settings.Store.get('theme', 'user'));
    expect(second).toBe('light');  // unchanged — prefs already populated.
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
