// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Store substrate — Slice 2 integration proof.
//
// Two tests:
//   1. Setting change reaches the editor DOM (applicator wiring works).
//   2. Reload preserves the user-tier value via window.rwanga.prefs
//      (close + reopen the app with the same userDataDir).
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
  // Make sure the store + applicator have hydrated before tests poke at them.
  await page.evaluate(async () => { await window.Rga.Settings.Store.init(); });
  // Allow the applicator's initial apply microtask to settle.
  await page.waitForFunction(() => !!document.getElementById('editor'));
  return { app, page };
}

test('Slice 2 — changing editor.highlightCurrentLine flips the #editor class', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-settings-'));
  const { app, page } = await launch(userDataDir);
  try {
    // Default is true: applicator should have set the class on #editor.
    const before = await page.evaluate(() => {
      const el = document.getElementById('editor');
      return el && el.classList.contains('rga-line-highlight-on');
    });
    expect(before).toBe(true);

    // Flip to false; applicator should remove the class.
    await page.evaluate(() => {
      window.Rga.Settings.Store.set('editor.highlightCurrentLine', false);
    });
    const after = await page.evaluate(() => {
      const el = document.getElementById('editor');
      return el && el.classList.contains('rga-line-highlight-on');
    });
    expect(after).toBe(false);

    // And back to true.
    await page.evaluate(() => {
      window.Rga.Settings.Store.set('editor.highlightCurrentLine', true);
    });
    const reapplied = await page.evaluate(() => {
      const el = document.getElementById('editor');
      return el && el.classList.contains('rga-line-highlight-on');
    });
    expect(reapplied).toBe(true);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Slice 2 — user-tier value persists across a close + reopen', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-settings-'));
  try {
    // First launch: set the user-tier value to false.
    {
      const { app, page } = await launch(userDataDir);
      await page.evaluate(() => {
        window.Rga.Settings.Store.set('editor.highlightCurrentLine', false);
      });
      // Wait for the prefs.write to land on disk before we close — the
      // store fires it async (fire-and-forget). A short wait beats a
      // race; this is the same pattern the workspace-state tests use.
      await page.waitForFunction(() => {
        // The pref file is written via IPC; we can't peek at it from
        // the renderer, but we can read it back through the same IPC
        // and confirm the value before closing.
        return window.rwanga.prefs.read().then((p) => p['editor.highlightCurrentLine'] === false);
      });
      await app.close();
    }
    // Second launch with the SAME userDataDir: prefs should restore.
    {
      const { app, page } = await launch(userDataDir);
      try {
        const effective = await page.evaluate(() =>
          window.Rga.Settings.Store.effective('editor.highlightCurrentLine'));
        expect(effective).toBe(false);
        // And the editor DOM should reflect the restored value.
        const hasClass = await page.evaluate(() => {
          const el = document.getElementById('editor');
          return el && el.classList.contains('rga-line-highlight-on');
        });
        expect(hasClass).toBe(false);
      } finally {
        await app.close();
      }
    }
  } finally {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
