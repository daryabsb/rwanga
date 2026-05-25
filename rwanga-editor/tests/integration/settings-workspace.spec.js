// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings workspace skeleton — Slice 5A integration proof.
//
// End-to-end: Ctrl+, opens the workspace; pressing it again focuses
// the same tab (singleton via TabManager.openWorkspace).
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
    window.Rga && window.Rga.TabManager && window.Rga.Workspaces &&
    window.Rga.Workspaces.get && window.Rga.Workspaces.get('settings')
  ));
  return { app, page };
}

test('Slice 5A — Ctrl+, opens the Settings workspace tab', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-settings-ws-'));
  const { app, page } = await launch(userDataDir);
  try {
    // No Settings workspace mounted at boot. The
    // [data-renderer="workspace"] qualifier selects the actual mount
    // element inside #tab-content-host, NOT the matching tab button
    // in #tab-bar (which also carries data-workspace-kind).
    const beforeMount = await page.evaluate(() =>
      document.querySelectorAll(
        '[data-renderer="workspace"][data-workspace-kind="settings"]').length);
    expect(beforeMount).toBe(0);

    // Ctrl+,
    await page.keyboard.press('Control+Comma');

    // The workspace mount element appears under #tab-content-host.
    await page.waitForSelector(
      '[data-renderer="workspace"][data-workspace-kind="settings"]');
    const navCount = await page.evaluate(() =>
      document.querySelectorAll(
        '[data-renderer="workspace"][data-workspace-kind="settings"] .rga-settings-nav-item').length);
    expect(navCount).toBe(9);

    const title = await page.evaluate(() => {
      const t = document.querySelector(
        '[data-renderer="workspace"][data-workspace-kind="settings"] .rga-settings-content-title');
      return t ? t.textContent : '';
    });
    expect(title).toBe('General');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Slice 5A — pressing Ctrl+, twice does NOT create a second Settings tab (singleton)', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-settings-ws-'));
  const { app, page } = await launch(userDataDir);
  try {
    await page.keyboard.press('Control+Comma');
    await page.waitForSelector(
      '[data-renderer="workspace"][data-workspace-kind="settings"]');
    await page.keyboard.press('Control+Comma');
    // Give the second open a beat to settle if it were going to mount
    // a second one. Count the MOUNT element only — the tab-bar
    // button has the same data-workspace-kind attribute but lives in
    // #tab-bar, not #tab-content-host.
    await page.waitForFunction(() =>
      document.querySelectorAll(
        '[data-renderer="workspace"][data-workspace-kind="settings"]').length === 1);
    const count = await page.evaluate(() =>
      document.querySelectorAll(
        '[data-renderer="workspace"][data-workspace-kind="settings"]').length);
    expect(count).toBe(1);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
