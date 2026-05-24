// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 1 wiring proof — drives the real Electron app to confirm the
// document + workspace tab kind split works end-to-end.
//
// Per Shell Doctrine §4:
//   #tab-content-host hosts BOTH renderer kinds; TabManager toggles
//   visibility so only the active renderer is shown.
//
// Per the Playwright > screenshots rule ([[feedback_playwright_over_screenshots]]):
//   layout / responsive / DOM-geometry iteration uses a real Playwright
//   spec, not screenshots. This spec proves the wiring without burning
//   user attention on a visual confirm.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');

let app, page, userDataDir, consoleErrors;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-ws-'));
  consoleErrors = [];
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.TabManager && window.Rga.Workspaces && window.Rga.FileManager
  ));
});

test.afterEach(async () => {
  if (app) { await app.close(); app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

test('Slice 1 — Rga.Workspaces registry exists and hello-world is registered at boot', async () => {
  const registered = await page.evaluate(() => window.Rga.Workspaces.registered());
  expect(registered).toContain('hello-world');
  // No console errors from loading the new modules.
  expect(consoleErrors).toEqual([]);
});

test('Slice 1 — openWorkspace("hello-world") mounts the proof div into #tab-content-host', async () => {
  const result = await page.evaluate(() => {
    const tab = window.Rga.TabManager.openWorkspace('hello-world');
    const host = document.getElementById('tab-content-host');
    const proof = host && host.querySelector('.hw-proof');
    return {
      tabKind: tab && tab.kind,
      workspaceKind: tab && tab.workspaceKind,
      proofText: proof ? proof.textContent : null,
      hostHasMount: !!(host && host.querySelector('[data-renderer="workspace"][data-workspace-kind="hello-world"]'))
    };
  });
  expect(result.tabKind).toBe('workspace');
  expect(result.workspaceKind).toBe('hello-world');
  expect(result.proofText).toBe('Workspace tab works');
  expect(result.hostHasMount).toBe(true);
});

test('Slice 1 — opening workspace hides document renderer; opening document re-shows it', async () => {
  // Start: open a new doc so the document renderer is mounted and visible.
  await page.evaluate(async () => {
    await window.Rga.FileManager.newScript();
  });
  // Confirm document renderer visible.
  const docVisibleBefore = await page.evaluate(() => {
    const el = document.querySelector('#tab-content-host [data-renderer="document"]');
    return el && getComputedStyle(el).display !== 'none';
  });
  expect(docVisibleBefore).toBe(true);

  // Open workspace tab; document renderer should hide.
  await page.evaluate(() => window.Rga.TabManager.openWorkspace('hello-world'));
  const docVisibleDuringWs = await page.evaluate(() => {
    const el = document.querySelector('#tab-content-host [data-renderer="document"]');
    return el && getComputedStyle(el).display !== 'none';
  });
  const wsVisibleDuringWs = await page.evaluate(() => {
    const el = document.querySelector('#tab-content-host [data-renderer="workspace"][data-workspace-kind="hello-world"]');
    return el && getComputedStyle(el).display !== 'none';
  });
  expect(docVisibleDuringWs).toBe(false);
  expect(wsVisibleDuringWs).toBe(true);

  // Switch back to the document tab; document renderer reappears.
  await page.evaluate(() => {
    const tabs = window.Rga.TabManager.tabs();
    const docTab = tabs.find((t) => t.kind === 'document');
    window.Rga.TabManager.activate(docTab.id);
  });
  const docVisibleAfter = await page.evaluate(() => {
    const el = document.querySelector('#tab-content-host [data-renderer="document"]');
    return el && getComputedStyle(el).display !== 'none';
  });
  const wsVisibleAfter = await page.evaluate(() => {
    const el = document.querySelector('#tab-content-host [data-renderer="workspace"][data-workspace-kind="hello-world"]');
    return el && getComputedStyle(el).display !== 'none';
  });
  expect(docVisibleAfter).toBe(true);
  expect(wsVisibleAfter).toBe(false);
});

test('Slice 1 — activeDoc returns null while workspace tab active; restores after switching back', async () => {
  // Open a doc → activeDoc is that doc.
  await page.evaluate(async () => {
    await window.Rga.FileManager.newScript();
  });
  const initial = await page.evaluate(() => !!window.Rga.TabManager.activeDoc());
  expect(initial).toBe(true);

  // Open workspace → activeDoc becomes null (workspace is active, not a doc).
  await page.evaluate(() => window.Rga.TabManager.openWorkspace('hello-world'));
  const duringWs = await page.evaluate(() => window.Rga.TabManager.activeDoc());
  expect(duringWs).toBe(null);

  // Switch back → activeDoc returns the doc again.
  await page.evaluate(() => {
    const tabs = window.Rga.TabManager.tabs();
    const docTab = tabs.find((t) => t.kind === 'document');
    window.Rga.TabManager.activate(docTab.id);
  });
  const afterRestore = await page.evaluate(() => !!window.Rga.TabManager.activeDoc());
  expect(afterRestore).toBe(true);

  // No console errors should have been raised by any of the activeDoc()
  // consumers (status bar, breadcrumb, script-session, etc.) during the
  // null-active period.
  expect(consoleErrors).toEqual([]);
});

test('Slice 1 — closing the workspace tab does not prompt CloseGuard and the doc tab stays', async () => {
  // Note: at boot the renderer auto-creates an Untitled document if no
  // session restores tabs (renderer/index.html:1344), so tab counts here
  // are relative to that baseline. The assertion is "the workspace tab
  // is gone and a document tab is active", not "tab count is 1".
  const baselineCount = await page.evaluate(() => window.Rga.TabManager.tabs().length);
  const wsTabId = await page.evaluate(() => {
    const t = window.Rga.TabManager.openWorkspace('hello-world');
    return t.id;
  });
  const afterOpenCount = await page.evaluate(() => window.Rga.TabManager.tabs().length);
  expect(afterOpenCount).toBe(baselineCount + 1);

  // Close the workspace tab; expect immediate close (no modal blocking the call).
  await page.evaluate((id) => window.Rga.TabManager.closeTab(id), wsTabId);
  const state = await page.evaluate((id) => ({
    workspaceStillPresent: window.Rga.TabManager.tabs().some((t) => t.id === id),
    activeKind: (window.Rga.TabManager.activeTab() || {}).kind,
    totalTabs: window.Rga.TabManager.tabs().length
  }), wsTabId);
  expect(state.workspaceStillPresent).toBe(false);
  expect(state.activeKind).toBe('document');
  expect(state.totalTabs).toBe(baselineCount);
  expect(consoleErrors).toEqual([]);
});
