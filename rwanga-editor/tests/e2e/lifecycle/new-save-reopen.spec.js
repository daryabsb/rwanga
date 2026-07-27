// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PF-02 — new → type → save → reopen: content survives the round trip through disk.
// Masterplan slice S3.2 (docs/plans/2026-07-02-stage1-launch-gate-masterplan.md).
//
// STEP-1 SEAM (the dialog-free save path), confirmed by reading
// renderer/js/file-manager.js + electron/bridge/files.js + electron/preload.js:
//
//   * Native dialogs cannot be driven by Playwright, but they CAN be stubbed in
//     the MAIN process: `app.evaluate(({ dialog }) => { dialog.showSaveDialog = ... })`.
//     That is the idiom already used by tests/integration/atomic-save.spec.js, and it
//     is strictly better than assigning `doc.handle` from the renderer, because the
//     real user path runs end to end: FileManager.saveAs() → IPC `files.pickSaveAs`
//     → dialog → writeFileAtomic → Doc.rebindHandle → Doc.clearDirty.
//   * Once a handle is bound, FileManager.save() writes via IPC `files.save` with no
//     dialog at all (file-manager.js:66-91).
//   * Reopening likewise runs the REAL path: `dialog.showOpenDialog` stubbed →
//     FileManager.openFromDialog() → IPC `files.pickOpen` (reads the bytes off disk)
//     → openFromContent → Doc.deserialize.
//   * Caveat found while reading: FileManager.save() reads the module-local
//     `activeDoc`, which is set by TabManager on tab activation (tab-manager.js:148) —
//     hence every spec waits on `FileManager.getActive()` before acting.
//
// The reopen happens in a SECOND app instance with a fresh userData dir, so the
// assertion proves the bytes on disk carry the content — not renderer memory.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launch(userDataDir) {
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.FileManager && window.Rga.FileManager.getActive
    && window.Rga.FileManager.getActive()
    && window.Rga.Doc && typeof window.Rga.Doc.serialize === 'function'));
  return { app, page };
}

async function clearDirtyAndClose(app, page) {
  try {
    await page.evaluate(() => {
      const doc = window.Rga.FileManager.getActive();
      if (doc && window.Rga.Doc && window.Rga.Doc.clearDirty) window.Rga.Doc.clearDirty(doc);
      else if (doc) doc.dirty = false;
    });
  } catch (_) {}
  await app.close();
}

test('PF-02 — a new document round-trips through disk (new → type → save → reopen)', async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf02-work-'));
  const writerData = fs.mkdtempSync(path.join(os.tmpdir(), 'pf02-writer-'));
  const readerData = fs.mkdtempSync(path.join(os.tmpdir(), 'pf02-reader-'));
  const target = path.join(workDir, 'pf02-roundtrip.rga');

  // ---- Session 1: create, type, save ----
  const writer = await launch(writerData);
  try {
    await writer.page.evaluate(() => window.Rga.FileManager.newScript());
    await writer.page.waitForFunction(() => !!window.Rga.FileManager.getActive());

    await writer.page.locator('#editor').click();
    await writer.page.keyboard.type('INT. KITCHEN - NIGHT');
    await writer.page.keyboard.press('Enter');
    await writer.page.keyboard.type('A kettle whistles.');

    // Save As with the native dialog stubbed in the main process.
    await writer.app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, target);
    const res = await writer.page.evaluate(() => window.Rga.FileManager.saveAs());
    expect(res, 'saveAs() returned null — the write did not complete').not.toBeNull();

    // The document is now bound to the file and clean.
    const bound = await writer.page.evaluate(() => {
      const doc = window.Rga.FileManager.getActive();
      return { handle: doc.handle, displayName: doc.displayName, dirty: doc.dirty };
    });
    expect(bound.handle).toBe(target);
    expect(bound.displayName).toBe('pf02-roundtrip.rga');
    expect(bound.dirty).toBe(false);
  } finally {
    await clearDirtyAndClose(writer.app, writer.page);
  }

  // The bytes are on disk, and they are a parseable .rga.
  expect(fs.existsSync(target)).toBe(true);
  const onDisk = fs.readFileSync(target, 'utf8');
  expect(onDisk).toContain('KITCHEN');
  expect(onDisk).toContain('kettle');
  expect(() => JSON.parse(onDisk)).not.toThrow();

  // ---- Session 2: a cold app instance reopens the file ----
  const reader = await launch(readerData);
  try {
    await reader.app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, target);
    const opened = await reader.page.evaluate(async () => {
      const doc = await window.Rga.FileManager.openFromDialog();
      return doc ? {
        handle: doc.handle,
        displayName: doc.displayName,
        dirty: doc.dirty,
        serialized: window.Rga.Doc.serialize(doc),
      } : null;
    });

    expect(opened, 'openFromDialog() returned null — the file did not reopen').not.toBeNull();
    expect(opened.handle).toBe(target);
    expect(opened.displayName).toBe('pf02-roundtrip.rga');
    expect(opened.dirty).toBe(false);
    // The typed content survived: new → type → save → reopen.
    expect(opened.serialized).toContain('KITCHEN');
    expect(opened.serialized).toContain('kettle');
  } finally {
    await clearDirtyAndClose(reader.app, reader.page);
  }

  for (const d of [workDir, writerData, readerData]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});
