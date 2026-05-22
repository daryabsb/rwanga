// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Persistence Safety — Brick 4 (crash recovery). The automated kill-and-recover
// test (QG-11): type → snapshot → crash → relaunch → recovery prompt →
// Restore reopens the unsaved work; Discard clears it.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');

function snapshotDir(udd) { return path.join(udd, 'autosave'); }
function listSnapshots(udd) {
  try {
    return fs.readdirSync(snapshotDir(udd)).filter((f) => f.endsWith('.autosave.json'));
  } catch (_) { return []; }
}
function aSnapshotContains(udd, text) {
  for (const f of listSnapshots(udd)) {
    try {
      const e = JSON.parse(fs.readFileSync(path.join(snapshotDir(udd), f), 'utf8'));
      if (String(e.rga || '').toLowerCase().includes(text)) return true;
    } catch (_) { /* ignore */ }
  }
  return false;
}

let app, userDataDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-e2e-'));
});

test.afterEach(async () => {
  if (app) { try { await app.close(); } catch (_) {} app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

async function launch() {
  const a = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const p = await a.firstWindow();
  await p.waitForLoadState('domcontentloaded');
  await p.waitForFunction(() => !!(window.Rga && window.Rga.FileManager));
  return { a, p };
}

// Hard-kill the app (a crash) and wait until the OS process is fully gone.
async function killApp(a) {
  const proc = a.process();
  const exited = new Promise((resolve) => {
    if (proc.exitCode !== null) { resolve(); return; }
    proc.once('exit', () => resolve());
  });
  proc.kill('SIGKILL');
  await exited;
}

// Simulate crash + reopen: hard-kill the app, carry its autosave snapshots into
// a FRESH userData profile, and relaunch. A fresh profile sidesteps the
// single-instance lock that a millisecond-fast same-profile relaunch races; the
// recovery logic is identical — Rga.Recovery scans userData/autosave/ either way.
async function crashAndRelaunch() {
  await killApp(app);
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-e2e-'));
  const src = snapshotDir(userDataDir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, snapshotDir(fresh), { recursive: true });
  }
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  userDataDir = fresh;
  return launch();
}

// Type into a launched window and wait until the full text is in a snapshot.
async function typeAndSnapshot(p, marker) {
  await p.waitForFunction(() => !!(window.Rga.TabManager
    && window.Rga.TabManager._editorView && window.Rga.TabManager._editorView()));
  await p.locator('#editor').click();
  await p.keyboard.type(marker);
  await expect.poll(() => aSnapshotContains(userDataDir, marker)).toBe(true);
}

test('crash recovery — Restore reopens the unsaved work', async () => {
  let win = await launch();
  app = win.a;
  await typeAndSnapshot(win.p, 'recovermarker');

  win = await crashAndRelaunch();
  app = win.a;

  // The recovery prompt appears.
  await expect(win.p.locator('#recovery-modal')).toBeVisible();
  await win.p.locator('#recovery-modal [data-choice="restore"]').click();

  // The recovered document is open, dirty, and carries the typed content.
  await win.p.waitForFunction(() => {
    const d = window.Rga.FileManager.getActive();
    return !!(d && d.dirty === true);
  });
  await expect(win.p.locator('#editor')).toContainText(/recovermarker/i);
});

test('crash recovery — Discard clears the snapshot and opens a clean document', async () => {
  let win = await launch();
  app = win.a;
  await typeAndSnapshot(win.p, 'discardmarker');

  win = await crashAndRelaunch();
  app = win.a;

  await expect(win.p.locator('#recovery-modal')).toBeVisible();
  await win.p.locator('#recovery-modal [data-choice="discard"]').click();

  // The snapshot is gone and the editor holds a fresh, clean document.
  await expect.poll(() => listSnapshots(userDataDir).length).toBe(0);
  const dirty = await win.p.evaluate(() => {
    const d = window.Rga.FileManager.getActive();
    return d ? d.dirty : null;
  });
  expect(dirty).toBe(false);
});
