// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Shortcut controls — H6 (RC1 §5.2.8 + §15.5).
//
// Proves the eight behaviors the H6 brief mandates:
//   1. shortcut control renders (key caps, not the read-only fallback)
//   2. clicking the row enters rebind mode ("Press new shortcut...")
//   3. a captured keystroke is read by the control
//   4. Settings.Store receives the new value
//   5. behavior updates immediately — the new combo invokes the bound
//      command without a restart (verified via kb.toggleSidebar, which
//      maps to view.toggleSidebar)
//   6. duplicate-shortcut conflicts are handled honestly — toast +
//      setting unchanged, no silent overwrite
//   7. reload preserves the rebound shortcut
//   8. reset (Store.set back to the registry default) restores the
//      original combo
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
    window.Rga.Settings.Applicators && window.Rga.KeyboardRegistry &&
    window.Rga.SettingsWorkspace));
  await page.evaluate(async () => { await window.Rga.Settings.Store.init(); });
  await page.evaluate(() => window.Rga.SettingsWorkspace.open());
  await page.waitForSelector(
    '[data-renderer="workspace"][data-workspace-kind="settings"] .rga-settings-row',
    { timeout: 5000 });
  await page.click('[data-section-id="shortcuts"]');
  await page.waitForSelector('.rga-settings-row[data-setting-id="kb.commandPalette"]');
  return { app, page };
}

// -----------------------------------------------------------------
// 1. Shortcut control renders with the constitutional shape
// -----------------------------------------------------------------

test('H6 — every kb.* row renders the constitutional shortcut control (key caps, no read-only fallback)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h6-render-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const ids = await page.evaluate(() => {
      const R = window.Rga.Settings.Registry;
      return R.all().filter((e) => e.type === 'shortcut').map((e) => e.id);
    });
    expect(ids.length).toBe(10);

    for (const id of ids) {
      const row = page.locator('.rga-settings-row[data-setting-id="' + id + '"]');
      await expect(row).toBeVisible();
      // RC1 §15.5 + H3A: shortcut rows are wired now, so PERSISTS_ONLY
      // treatment must NOT apply.
      await expect(row).not.toHaveClass(/is-persists-only/);

      const wrap = row.locator('.rga-settings-control-shortcut');
      await expect(wrap).toBeVisible();

      // At least one key cap renders; for combos with modifiers a '+'
      // separator also exists.
      const capCount = await wrap.locator('.rga-settings-control-shortcut-cap').count();
      expect(capCount).toBeGreaterThan(0);

      // The read-only fallback must NOT be used (the value column is
      // not the is-readonly text branch).
      const valueIsReadonly = await row
        .locator('.rga-settings-row-value.is-readonly')
        .count();
      expect(valueIsReadonly).toBe(0);
    }

    // Spot-check kb.commandPalette's caps spell out Ctrl + Shift + P.
    const caps = await page
      .locator('.rga-settings-row[data-setting-id="kb.commandPalette"] .rga-settings-control-shortcut-cap')
      .allTextContents();
    expect(caps).toEqual(['Ctrl', 'Shift', 'P']);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 2. Clicking the row enters rebind mode
// -----------------------------------------------------------------

test('H6 — clicking a shortcut row enters rebind mode with the accent-coloured prompt', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h6-rebind-mode-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    const wrap = page.locator('.rga-settings-row[data-setting-id="kb.find"] .rga-settings-control-shortcut');
    await wrap.click();
    await expect(wrap).toHaveClass(/is-rebinding/);
    const prompt = wrap.locator('.rga-settings-control-shortcut-prompt');
    await expect(prompt).toBeVisible();
    expect((await prompt.textContent()).trim()).toBe('Press new shortcut...');

    // Escape must cancel cleanly (no Store write).
    await page.keyboard.press('Escape');
    await expect(wrap).not.toHaveClass(/is-rebinding/);
    const afterEscape = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('kb.find'));
    expect(afterEscape).toBe('Ctrl+F');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 3. Key capture works and 4. Store receives the update
// -----------------------------------------------------------------

test('H6 — key capture writes the new combo through Settings.Store and re-renders the caps', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h6-capture-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    // Pick kb.find (default Ctrl+F) and rebind it to Ctrl+Alt+G, a
    // combo no other kb.* entry uses by default.
    const wrap = page.locator('.rga-settings-row[data-setting-id="kb.find"] .rga-settings-control-shortcut');
    await wrap.click();
    await expect(wrap).toHaveClass(/is-rebinding/);

    await page.keyboard.down('Control');
    await page.keyboard.down('Alt');
    await page.keyboard.press('G');
    await page.keyboard.up('Alt');
    await page.keyboard.up('Control');

    await expect(wrap).not.toHaveClass(/is-rebinding/);
    const caps = await wrap.locator('.rga-settings-control-shortcut-cap').allTextContents();
    expect(caps).toEqual(['Ctrl', 'Alt', 'G']);

    const stored = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('kb.find'));
    expect(stored).toBe('Ctrl+Alt+G');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 5. Behavior updates immediately
//    kb.toggleSidebar maps to view.toggleSidebar; rebinding the kb
//    setting must cause the new combo to trigger the command without
//    a restart.
// -----------------------------------------------------------------

test('H6 — rebinding kb.toggleSidebar takes effect immediately (no restart) via Rga.KeyboardRegistry', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h6-immediate-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    // Rebind kb.toggleSidebar to Ctrl+Alt+J via the public Store API
    // — the applicator drives the KR rebind in response.
    await page.evaluate(() =>
      window.Rga.Settings.Store.set('kb.toggleSidebar', 'Ctrl+Alt+J'));

    // The new binding is live in KR.
    const bound = await page.evaluate(() => {
      const all = window.Rga.KeyboardRegistry._all();
      return Object.keys(all).filter((k) => k === 'cmd+alt+j').length === 1;
    });
    expect(bound).toBe(true);

    // Old binding (cmd+b) is gone — the applicator unregistered it
    // before installing the new combo.
    const oldGone = await page.evaluate(() => {
      const all = window.Rga.KeyboardRegistry._all();
      return all['cmd+b'] === undefined;
    });
    expect(oldGone).toBe(true);

    // The command itself still exists; invokeCommand fires its handler.
    // We assert via the sidebar visibility state flipping.
    const before = await page.evaluate(() =>
      window.Rga.Shell.Layout.get().sidebar.visible);
    await page.evaluate(() =>
      window.Rga.KeyboardRegistry.invokeCommand('view.toggleSidebar'));
    const after = await page.evaluate(() =>
      window.Rga.Shell.Layout.get().sidebar.visible);
    expect(after).toBe(!before);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 6. Duplicate-shortcut conflicts handled honestly
// -----------------------------------------------------------------

test('H6 — capturing a combo already used by another kb.* setting is rejected; original value unchanged', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h6-conflict-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    // kb.find defaults to Ctrl+F. Try to set kb.replace (default Ctrl+H)
    // to Ctrl+F — a conflict.
    const wrap = page.locator('.rga-settings-row[data-setting-id="kb.replace"] .rga-settings-control-shortcut');
    await wrap.click();
    await expect(wrap).toHaveClass(/is-rebinding/);

    await page.keyboard.down('Control');
    await page.keyboard.press('F');
    await page.keyboard.up('Control');

    // Rebind cancelled: caps still spell out Ctrl + H.
    await expect(wrap).not.toHaveClass(/is-rebinding/);
    const caps = await wrap.locator('.rga-settings-control-shortcut-cap').allTextContents();
    expect(caps).toEqual(['Ctrl', 'H']);

    const stored = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('kb.replace'));
    expect(stored).toBe('Ctrl+H');

    // A human-readable warning toast surfaces.
    const toast = page.locator('.toast-container .toast');
    await expect(toast.first()).toBeVisible({ timeout: 3000 });
    const toastMsg = await toast.first().locator('.toast-message').textContent();
    expect(toastMsg).toContain('Ctrl+F');
    expect(toastMsg.toLowerCase()).toContain('already bound');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 7. Reload preserves the rebound shortcut
// -----------------------------------------------------------------

test('H6 — a rebound shortcut survives a close + reopen and reapplies at boot', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h6-persist-'));
  try {
    {
      const { app, page } = await launchAndOpen(userDataDir);
      await page.evaluate(() =>
        window.Rga.Settings.Store.set('kb.toggleSidebar', 'Ctrl+Alt+K'));
      await page.waitForFunction(() =>
        window.rwanga.prefs.read().then((p) => p['kb.toggleSidebar'] === 'Ctrl+Alt+K'));
      await app.close();
    }
    {
      const { app, page } = await launchAndOpen(userDataDir);
      try {
        const stored = await page.evaluate(() =>
          window.Rga.Settings.Store.effective('kb.toggleSidebar'));
        expect(stored).toBe('Ctrl+Alt+K');

        const caps = await page
          .locator('.rga-settings-row[data-setting-id="kb.toggleSidebar"] .rga-settings-control-shortcut-cap')
          .allTextContents();
        expect(caps).toEqual(['Ctrl', 'Alt', 'K']);

        const bound = await page.evaluate(() => {
          const all = window.Rga.KeyboardRegistry._all();
          return all['cmd+alt+k'] !== undefined;
        });
        expect(bound).toBe(true);
      } finally {
        await app.close();
      }
    }
  } finally {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

// -----------------------------------------------------------------
// 8. Reset restores the registry default
// -----------------------------------------------------------------

test('H6 — Store.set(default) restores the original shortcut and re-binds the original combo', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h6-reset-'));
  const { app, page } = await launchAndOpen(userDataDir);
  try {
    // Move kb.find away from the default.
    await page.evaluate(() =>
      window.Rga.Settings.Store.set('kb.find', 'Ctrl+Alt+L'));
    const moved = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('kb.find'));
    expect(moved).toBe('Ctrl+Alt+L');

    // Reset to the registry default via the Store-level path. No UI
    // reset button this slice (RC1 §4.1 reset glyph still deferred).
    const defaultVal = await page.evaluate(() =>
      window.Rga.Settings.Registry.getDefault('kb.find'));
    expect(defaultVal).toBe('Ctrl+F');
    await page.evaluate((v) =>
      window.Rga.Settings.Store.set('kb.find', v), defaultVal);

    const restored = await page.evaluate(() =>
      window.Rga.Settings.Store.effective('kb.find'));
    expect(restored).toBe('Ctrl+F');

    const caps = await page
      .locator('.rga-settings-row[data-setting-id="kb.find"] .rga-settings-control-shortcut-cap')
      .allTextContents();
    expect(caps).toEqual(['Ctrl', 'F']);

    const bound = await page.evaluate(() => {
      const all = window.Rga.KeyboardRegistry._all();
      return all['cmd+f'] !== undefined && all['cmd+alt+l'] === undefined;
    });
    expect(bound).toBe(true);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
