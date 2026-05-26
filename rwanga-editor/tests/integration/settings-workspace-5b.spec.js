// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings workspace read-only rows + search — Slice 5B integration.
//
// End-to-end: open Settings (Ctrl+,), confirm rows render with current
// effective values, then exercise the three search examples named in
// the slice authorization.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');
const WS_SEL   = '[data-renderer="workspace"][data-workspace-kind="settings"]';

async function launchAndOpenSettings(userDataDir) {
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.TabManager && window.Rga.Workspaces &&
    window.Rga.Workspaces.get && window.Rga.Workspaces.get('settings')
  ));
  await page.keyboard.press('Control+Comma');
  await page.waitForSelector(WS_SEL + ' .rga-settings-rows');
  return { app, page };
}

async function typeQuery(page, q) {
  await page.evaluate((query) => {
    const input = document.querySelector(
      '[data-renderer="workspace"][data-workspace-kind="settings"] .rga-settings-search-input');
    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, q);
}

async function rowIds(page) {
  return await page.evaluate(() =>
    Array.from(document.querySelectorAll(
      '[data-renderer="workspace"][data-workspace-kind="settings"] .rga-settings-row'))
      .map((r) => r.getAttribute('data-setting-id')));
}

test('Slice 5B — General section rows render with current effective values', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-5b-rows-'));
  const { app, page } = await launchAndOpenSettings(userDataDir);
  try {
    const ids = await rowIds(page);
    expect(ids).toEqual([
      'language', 'theme', 'windowZoom',
      'recentFilesLimit', 'confirmBeforeClose', 'restoreLastSession'
    ]);
    // Spot-check the theme row's effective value via the checked
    // radio input — registry default is 'dark'. (H2 turned this row
    // into an editable radio with human labels; reading the checked
    // input's `value` keeps the assertion aligned with the underlying
    // value, not the localized display text.)
    const themeVal = await page.$eval(
      WS_SEL + ' .rga-settings-row[data-setting-id="theme"] [data-control-for="theme"] input[type="radio"]:checked',
      (el) => el.value);
    expect(themeVal).toBe('dark');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Slice 5B — search "paper" surfaces pageSetup.paperSize', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-5b-search-paper-'));
  const { app, page } = await launchAndOpenSettings(userDataDir);
  try {
    await typeQuery(page, 'paper');
    await page.waitForFunction(() =>
      document.querySelectorAll(
        '[data-renderer="workspace"][data-workspace-kind="settings"] .rga-settings-row').length > 0);
    const ids = await rowIds(page);
    expect(ids).toContain('pageSetup.paperSize');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Slice 5B — search "dark" surfaces theme', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-5b-search-dark-'));
  const { app, page } = await launchAndOpenSettings(userDataDir);
  try {
    await typeQuery(page, 'dark');
    await page.waitForFunction(() =>
      document.querySelectorAll(
        '[data-renderer="workspace"][data-workspace-kind="settings"] .rga-settings-row').length > 0);
    const ids = await rowIds(page);
    expect(ids).toContain('theme');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Slice 5B — search "font size" surfaces editor.fontSize', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-5b-search-fontsize-'));
  const { app, page } = await launchAndOpenSettings(userDataDir);
  try {
    await typeQuery(page, 'font size');
    await page.waitForFunction(() =>
      document.querySelectorAll(
        '[data-renderer="workspace"][data-workspace-kind="settings"] .rga-settings-row').length > 0);
    const ids = await rowIds(page);
    expect(ids).toContain('editor.fontSize');
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Slice 5B — no-result search shows the empty state', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-5b-search-empty-'));
  const { app, page } = await launchAndOpenSettings(userDataDir);
  try {
    await typeQuery(page, 'xyzzy_no_match_settings');
    await page.waitForFunction(() =>
      document.querySelectorAll(
        '[data-renderer="workspace"][data-workspace-kind="settings"] .rga-settings-row').length === 0);
    const emptyVisible = await page.evaluate(() => {
      const e = document.querySelector(
        '[data-renderer="workspace"][data-workspace-kind="settings"] .rga-settings-empty');
      return !!e && !e.hasAttribute('hidden') && e.style.display !== 'none';
    });
    expect(emptyVisible).toBe(true);
  } finally {
    await app.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
});
