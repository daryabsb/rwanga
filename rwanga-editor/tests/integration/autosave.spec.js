// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Persistence Safety — Brick 3 (autosave). Proves the wired write path: a
// dirty document is snapshotted to <userData>/autosave/, one file per document.
// (The force-kill E2E is Task 5; Brick 3 does NOT restore — that is Brick 4.)
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

let app, page, userDataDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-e2e-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(
    () => !!(window.Rga && window.Rga.FileManager
      && window.Rga.FileManager.getActive && window.Rga.FileManager.getActive()
      && window.Rga.TabManager && window.Rga.TabManager._editorView
      && window.Rga.TabManager._editorView())
  );
});

test.afterEach(async () => {
  if (app) { try { await app.close(); } catch (_) {} app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

test('autosave writes a snapshot to userData/autosave while typing', async () => {
  await page.locator('#editor').click();
  await page.keyboard.type('autosavemarker');

  // The immediate seed lands at once; the debounce snapshot — carrying the
  // full typed text — lands ~2s after typing stops. Poll the snapshot content.
  await expect.poll(() => {
    const list = listSnapshots(userDataDir);
    if (list.length !== 1) return '';
    try {
      const e = JSON.parse(fs.readFileSync(path.join(snapshotDir(userDataDir), list[0]), 'utf8'));
      return String(e.rga || '').toLowerCase();
    } catch (_) { return ''; }
  }).toContain('autosavemarker');

  // The snapshot is a single valid envelope.
  const snaps = listSnapshots(userDataDir);
  expect(snaps.length).toBe(1);
  const env = JSON.parse(fs.readFileSync(path.join(snapshotDir(userDataDir), snaps[0]), 'utf8'));
  expect(env.schemaVersion).toBe(1);
  expect(typeof env.rga).toBe('string');
});

test('multiple tabs keep separate snapshots', async () => {
  // Document 1.
  await page.locator('#editor').click();
  await page.keyboard.type('firsttab');
  await expect.poll(() => listSnapshots(userDataDir).length).toBeGreaterThanOrEqual(1);

  // Document 2 — a new script, then type.
  await page.evaluate(() => window.Rga.FileManager.newScript());
  await page.locator('#editor').click();
  await page.keyboard.type('secondtab');
  await expect.poll(() => listSnapshots(userDataDir).length).toBeGreaterThanOrEqual(2);

  // Two distinct snapshot files — one per document.
  expect(listSnapshots(userDataDir).length).toBe(2);
});

test('a snapshot survives a force-kill and is present after reopen (no restore)', async () => {
  await page.locator('#editor').click();
  await page.keyboard.type('crashmarker');
  await expect.poll(() => listSnapshots(userDataDir).length).toBeGreaterThan(0);
  const before = listSnapshots(userDataDir);
  expect(before.length).toBe(1);

  // Force-terminate the app — a crash, no graceful shutdown.
  await killApp(app);
  app = null;

  // Reopen with a FRESH userData profile carrying the crash's autosave
  // snapshots. A fresh profile sidesteps the single-instance lock that a
  // millisecond-fast same-profile relaunch races; the snapshot store on disk
  // is identical, so the "snapshot survives a crash" assertion is unchanged.
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-e2e-'));
  if (fs.existsSync(snapshotDir(userDataDir))) {
    fs.cpSync(snapshotDir(userDataDir), snapshotDir(fresh), { recursive: true });
  }
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  userDataDir = fresh;
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page2 = await app.firstWindow();
  await page2.waitForLoadState('domcontentloaded');
  await page2.waitForFunction(() => !!(window.Rga && window.Rga.FileManager));

  // The pre-crash snapshot is still on disk — Brick 3 does NOT restore it.
  expect(listSnapshots(userDataDir)).toContain(before[0]);

  // The reopened editor shows a fresh, clean document — nothing was restored.
  const dirty = await page2.evaluate(() => {
    const d = window.Rga.FileManager.getActive();
    return d ? d.dirty : false;
  });
  expect(dirty).toBe(false);
});
