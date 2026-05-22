// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Persistence Safety — Brick 1 (atomic save). Proves the wired save path:
// a real Save As / Save writes the .rga atomically and rolls a previous-
// version .bak, and that a failed .bak backup is non-fatal (Amendment 1).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');

let app, page, userDataDir, workDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-e2e-'));
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-save-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(
    () => !!(window.Rga && window.Rga.FileManager
      && window.Rga.FileManager.getActive && window.Rga.FileManager.getActive())
  );
});

test.afterEach(async () => {
  if (app) { await app.close(); app = null; }
  for (const d of [userDataDir, workDir]) {
    if (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }
  }
  userDataDir = workDir = null;
});

test('atomic Save As writes the .rga, and a later Save rolls a .bak', async () => {
  const target = path.join(workDir, 'script.rga');

  // Stub the native Save dialog (main process) to return our temp path.
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, target);

  // First write: type into the editor, then Save As.
  await page.locator('#editor').click();
  await page.keyboard.type('firstversionmarker');
  await page.evaluate(() => window.Rga.FileManager.saveAs());

  expect(fs.existsSync(target)).toBe(true);
  expect(fs.readFileSync(target, 'utf8').toLowerCase()).toContain('firstversionmarker');
  expect(fs.existsSync(target + '.bak')).toBe(false);   // nothing to back up yet

  // Second write: edit again, then Save (handle is bound — no dialog).
  await page.locator('#editor').click();
  await page.keyboard.type('secondversionmarker');
  await page.evaluate(() => window.Rga.FileManager.save());

  expect(fs.readFileSync(target, 'utf8').toLowerCase()).toContain('secondversionmarker');
  // The previous version is now in .bak.
  expect(fs.existsSync(target + '.bak')).toBe(true);
  const bak = fs.readFileSync(target + '.bak', 'utf8').toLowerCase();
  expect(bak).toContain('firstversionmarker');
  expect(bak).not.toContain('secondversionmarker');

  // No stale .tmp left behind.
  expect(fs.readdirSync(workDir).filter((e) => e.endsWith('.tmp'))).toEqual([]);
});

test('a failed .bak backup is non-fatal — the save still succeeds (Amendment 1)', async () => {
  const target = path.join(workDir, 'script.rga');

  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, target);

  // First save establishes the file.
  await page.locator('#editor').click();
  await page.keyboard.type('alphamarker');
  await page.evaluate(() => window.Rga.FileManager.saveAs());
  expect(fs.existsSync(target)).toBe(true);

  // Occupy the .bak path with a directory so the backup copy must fail.
  fs.mkdirSync(target + '.bak');

  // Edit and Save again — the backup will fail.
  await page.locator('#editor').click();
  await page.keyboard.type('betamarker');
  await page.evaluate(() => window.Rga.FileManager.save());

  // The save still succeeded: the file holds the new content ...
  expect(fs.readFileSync(target, 'utf8').toLowerCase()).toContain('betamarker');
  // ... the document is CLEAN ...
  const dirty = await page.evaluate(() => window.Rga.FileManager.getActive().dirty);
  expect(dirty).toBe(false);
  // ... and a non-blocking toast notification was shown (no modal).
  await expect(page.locator('.toast-container .toast')).toHaveCount(1);
});
