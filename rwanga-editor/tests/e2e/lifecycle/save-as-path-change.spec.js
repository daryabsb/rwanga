// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PF-05 — Save As re-points the document at a NEW file: B gets the edit, A is untouched,
// and the app's identity (title, handle, Recent) follows the document to B.
// Masterplan slice S3.2 (docs/plans/2026-07-02-stage1-launch-gate-masterplan.md).
//
// STEP-1 SEAM: `dialog.showSaveDialog` / `dialog.showOpenDialog` stubbed in the MAIN
// process, so FileManager.saveAs() → IPC `files.pickSaveAs` → writeFileAtomic →
// Doc.rebindHandle → Doc.clearDirty runs exactly as it does for a user. Full reading
// in the seam note at the top of new-save-reopen.spec.js.
//
// Uses a temp COPY of the RTL fixture as file A (masterplan §0.2 fixture law — never
// let a running app touch a repo fixture).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { closeApp } = require('../../helpers/app-teardown');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURE = path.resolve(APP_ROOT, 'tests', 'fixtures', 'mysterious-guest-rtl.rga');

test('PF-05 — Save As writes a new file and re-points the document at it', async () => {
  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'pf05-a-'));
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'pf05-b-'));
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf05-user-'));
  const fileA = path.join(dirA, 'original.rga');
  const fileB = path.join(dirB, 'renamed-copy.rga');

  fs.copyFileSync(FIXTURE, fileA);
  const beforeA = fs.readFileSync(fileA);

  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  try {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!(
      window.Rga && window.Rga.FileManager && window.Rga.FileManager.getActive
      && window.Rga.FileManager.getActive()
      && window.Rga.Doc && typeof window.Rga.Doc.serialize === 'function'));

    // Open file A through the real Open path.
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, fileA);
    const openedA = await page.evaluate(() => window.Rga.FileManager.openFromDialog()
      .then((doc) => (doc ? { handle: doc.handle, displayName: doc.displayName } : null)));
    expect(openedA, 'file A did not open').not.toBeNull();
    expect(openedA.handle).toBe(fileA);

    // Edit it.
    await page.locator('#editor').click();
    await page.keyboard.type('saveasmarker');
    const dirtyAfterEdit = await page.evaluate(() => window.Rga.FileManager.getActive().dirty);
    expect(dirtyAfterEdit).toBe(true);

    // Save As into a DIFFERENT directory.
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, fileB);
    const res = await page.evaluate(() => window.Rga.FileManager.saveAs());
    expect(res, 'saveAs() returned null — the write did not complete').not.toBeNull();

    // The document now IS file B: handle, display name, cleanliness, Recent.
    const after = await page.evaluate(() => {
      const doc = window.Rga.FileManager.getActive();
      return {
        handle: doc.handle,
        displayName: doc.displayName,
        origin: doc.origin,
        dirty: doc.dirty,
        recentHandles: window.Rga.FileManager.getRecent().map((r) => r.handle),
      };
    });
    expect(after.handle).toBe(fileB);
    expect(after.displayName).toBe('renamed-copy.rga');
    expect(after.origin).toBe('disk');
    expect(after.dirty).toBe(false);
    expect(after.recentHandles).toContain(fileA);   // where it came from stays reachable
  } finally {
    try {
      await page.evaluate(() => {
        const doc = window.Rga.FileManager.getActive();
        if (doc) doc.dirty = false;
      });
    } catch (_) {}
    await closeApp(app);
  }

  // B exists and carries the edit; A is byte-for-byte untouched.
  expect(fs.existsSync(fileB)).toBe(true);
  expect(fs.readFileSync(fileB, 'utf8')).toContain('saveasmarker');
  expect(fs.readFileSync(fileA).equals(beforeA)).toBe(true);
  expect(fs.readFileSync(fileA, 'utf8')).not.toContain('saveasmarker');
  // A fresh target has no previous version to back up.
  expect(fs.existsSync(fileB + '.bak')).toBe(false);
  expect(fs.readdirSync(dirB).filter((e) => e.endsWith('.tmp'))).toEqual([]);

  for (const d of [dirA, dirB, userDataDir]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});
