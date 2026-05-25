// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Shell / appearance applicators — Slice 4B integration proof.
//
// Required by the Slice 4B scope: "At least one setting beyond
// theme persists and rehydrates." theme is intentionally deferred
// in this slice; appearance.editorDeskColor stands in as the proof.
// The spec sets a non-default desk color, closes the app, reopens
// it with the same userDataDir, and verifies --editor-bg on the
// documentElement reflects the persisted value.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');

async function launch(userDataDir) {
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Settings && window.Rga.Settings.Store &&
    window.Rga.Settings.Applicators
  ));
  await page.evaluate(async () => { await window.Rga.Settings.Store.init(); });
  // applyAll() runs during boot from index.html; give the microtask
  // a beat to settle so the var is on documentElement when we probe.
  await page.waitForFunction(() => !!document.getElementById('editor'));
  return { app, page };
}

test('Slice 4B — editorDeskColor applies through the applicator at runtime; no inline at boot', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-shell-'));
  const { app, page } = await launch(userDataDir);
  try {
    // Post-5B drift fix: at boot with no user override, no inline
    // --editor-bg is set. Theme tokens (light/dark) own the desk.
    const before = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--editor-bg'));
    expect(before).toBe('');

    // Switch via Store; user-tier override now exists → applicator
    // pushes the new hex inline.
    await page.evaluate(() =>
      window.Rga.Settings.Store.set('appearance.editorDeskColor', '#1a1a2e'));
    const after = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--editor-bg'));
    expect(after).toBe('#1a1a2e');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Slice 4B — persisted appearance.editorDeskColor rehydrates across a close + reopen', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-shell-'));
  try {
    // First launch: set a non-default desk color and wait for the
    // pref write to land on disk before closing.
    {
      const { app, page } = await launch(userDataDir);
      await page.evaluate(() =>
        window.Rga.Settings.Store.set('appearance.editorDeskColor', '#2d2520'));
      await page.waitForFunction(() =>
        window.rwanga.prefs.read().then((p) => p['appearance.editorDeskColor'] === '#2d2520'));
      await app.close();
    }
    // Second launch: prefs restores the value, applyAll() applies it.
    {
      const { app, page } = await launch(userDataDir);
      try {
        const effective = await page.evaluate(() =>
          window.Rga.Settings.Store.effective('appearance.editorDeskColor'));
        expect(effective).toBe('#2d2520');
        const styleVar = await page.evaluate(() =>
          document.documentElement.style.getPropertyValue('--editor-bg'));
        expect(styleVar).toBe('#2d2520');
      } finally {
        await app.close();
      }
    }
  } finally {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
