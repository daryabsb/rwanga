// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PF-03 — open a .rga from disk: the real Open path, on a real (RTL, v3) fixture.
// Masterplan slice S3.2 (docs/plans/2026-07-02-stage1-launch-gate-masterplan.md).
//
// STEP-1 SEAM: `dialog.showOpenDialog` is stubbed in the MAIN process, so
// FileManager.openFromDialog() → IPC `files.pickOpen` → readFile → openFromContent
// → Doc.deserialize runs exactly as it does for a user. See the seam note at the
// top of new-save-reopen.spec.js for the full reading.
//
// DELIBERATE DEVIATION from the slice text: the plan says to open
// tests/fixtures/mysterious-guest-rtl.rga directly. This spec opens a TEMP COPY
// instead. Reason: masterplan §0.2 / the fixture law — a running app that touches a
// fixture can auto-migrate it and dirty the tree (this fixture is rga_version 3.0 and
// the app is on 5.x, so it is exactly the migration-on-open case). The copy carries
// identical bytes, so the "no write-back on open" assertion is just as strong, and the
// repo fixture cannot be dirtied by a test run.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { closeApp } = require('../../helpers/app-teardown');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURE = path.resolve(APP_ROOT, 'tests', 'fixtures', 'mysterious-guest-rtl.rga');

test('PF-03 — an existing .rga opens from disk and is not written back', async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf03-work-'));
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf03-user-'));
  const target = path.join(workDir, 'mysterious-guest-rtl.rga');

  fs.copyFileSync(FIXTURE, target);
  const before = fs.readFileSync(target);
  const parsedBefore = JSON.parse(before.toString('utf8'));
  expect(parsedBefore.metadata.title).toBe('میوانی نادیار');   // the fixture we think we have

  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  try {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!(
      window.Rga && window.Rga.FileManager && window.Rga.FileManager.getActive
      && window.Rga.FileManager.getActive()
      && window.Rga.Doc && typeof window.Rga.Doc.serialize === 'function'));

    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, target);

    const opened = await page.evaluate(async () => {
      const doc = await window.Rga.FileManager.openFromDialog();
      if (!doc) return null;
      const parsed = JSON.parse(window.Rga.Doc.serialize(doc));
      // Count scene headings in the ProseMirror body — a real document has some.
      let scenes = 0;
      (function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type && String(node.type).toLowerCase().indexOf('scene') !== -1) scenes++;
        (node.content || []).forEach(walk);
      })(parsed.body);
      return {
        handle: doc.handle,
        displayName: doc.displayName,
        dirty: doc.dirty,
        title: parsed.metadata.title,
        direction: (parsed.metadata.screenplayProfile || {}).direction,
        bodyChildren: (parsed.body && parsed.body.content || []).length,
        scenes,
        recentTop: (window.Rga.FileManager.getRecent()[0] || {}).handle,
      };
    });

    expect(opened, 'openFromDialog() returned null — the fixture did not open').not.toBeNull();
    expect(opened.handle).toBe(target);
    expect(opened.displayName).toBe('mysterious-guest-rtl.rga');
    expect(opened.dirty).toBe(false);
    // The real content arrived, RTL profile intact.
    expect(opened.title).toBe('میوانی نادیار');
    expect(opened.direction).toBe('rtl');
    expect(opened.bodyChildren).toBeGreaterThan(0);
    expect(opened.scenes).toBeGreaterThan(0);
    // Opening records the file in Recent (the route back to it).
    expect(opened.recentTop).toBe(target);
  } finally {
    try {
      await page.evaluate(() => {
        const doc = window.Rga.FileManager.getActive();
        if (doc) doc.dirty = false;
      });
    } catch (_) {}
    await closeApp(app);
  }

  // Opening must never write to the file — no migration write-back, no .bak, no .tmp.
  expect(fs.readFileSync(target).equals(before)).toBe(true);
  expect(fs.existsSync(target + '.bak')).toBe(false);
  expect(fs.readdirSync(workDir).filter((e) => e.endsWith('.tmp'))).toEqual([]);

  for (const d of [workDir, userDataDir]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});
