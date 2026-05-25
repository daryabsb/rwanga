// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Editor applicators — Slice 4A integration proof.
//
// The Slice 4A scope requires "persisted editor setting rehydrates
// and applies on boot for at least one new setting beyond
// highlightCurrentLine." This spec uses editor.fontSize for that
// proof: set it at runtime, close, reopen with the same userDataDir,
// and verify both the effective value and the --editor-font-size
// CSS var on #editor.
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
    window.Rga && window.Rga.Settings && window.Rga.Settings.Store
  ));
  await page.evaluate(async () => { await window.Rga.Settings.Store.init(); });
  await page.waitForFunction(() => !!document.getElementById('editor'));
  return { app, page };
}

test('Slice 4A — editor.fontSize applicator updates --editor-font-size on #editor at runtime', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-editor-'));
  const { app, page } = await launch(userDataDir);
  try {
    // Registry default 12 → --editor-font-size = "12pt" on #editor
    // after applyAll() at boot.
    const before = await page.evaluate(() =>
      document.getElementById('editor').style.getPropertyValue('--editor-font-size'));
    expect(before).toBe('12pt');

    // Move it to 14 via the Store; applicator should push it through.
    await page.evaluate(() => window.Rga.Settings.Store.set('editor.fontSize', 14));
    const after = await page.evaluate(() =>
      document.getElementById('editor').style.getPropertyValue('--editor-font-size'));
    expect(after).toBe('14pt');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Slice 4A — persisted editor.fontSize rehydrates across a close + reopen', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-editor-'));
  try {
    // First launch: set fontSize to 18 (registry default is 12). Wait
    // for the IPC pref write to land before closing — same pattern as
    // the settings-store.spec.js persistence test.
    {
      const { app, page } = await launch(userDataDir);
      await page.evaluate(() => window.Rga.Settings.Store.set('editor.fontSize', 18));
      await page.waitForFunction(() =>
        window.rwanga.prefs.read().then((p) => p['editor.fontSize'] === 18));
      await app.close();
    }
    // Second launch with the SAME userDataDir: prefs should restore
    // 18, applyAll() should push it onto #editor before the test
    // probes the var.
    {
      const { app, page } = await launch(userDataDir);
      try {
        const effective = await page.evaluate(() =>
          window.Rga.Settings.Store.effective('editor.fontSize'));
        expect(effective).toBe(18);
        const styleVar = await page.evaluate(() =>
          document.getElementById('editor').style.getPropertyValue('--editor-font-size'));
        expect(styleVar).toBe('18pt');
      } finally {
        await app.close();
      }
    }
  } finally {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
