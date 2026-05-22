// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Fork A (Brick 4+5) — the A2-killer.
//
// The defect Fork A exists to kill: an in-editor page that grew unbounded
// with content, so an A4 visually became A2 / A3 / ... This proves the cure
// end-to-end: the Paper view's leaves are FIXED geometry. Repeated Enter
// grows the page COUNT; it can never grow an existing leaf.
//
// Single-instance unblock: Option A (per-launch temp userData dir) — see
// paper-view.spec.js. electron/main.js is untouched.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');

let app, page, userDataDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-e2e-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(window.Rga && window.Rga.ViewMode));
});

test.afterEach(async () => {
  if (app) { await app.close(); app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

function setMode(mode) {
  return page.evaluate((m) => window.Rga.ViewMode.set(m), mode);
}

async function typeLines(n) {
  for (let i = 0; i < n; i += 1) {
    await page.keyboard.type('x');
    await page.keyboard.press('Enter');
  }
}

// Rendered height of every Paper leaf, rounded to whole px.
function leafHeights() {
  return page.locator('#rga-paper-view-root .rga-page-sheet')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
}

test('A2-killer — repeated Enter grows the page COUNT, never an existing leaf', async () => {
  await page.locator('#editor').click();

  // Phase 1 — type enough to span at least one page.
  await typeLines(60);
  await setMode('print');
  const heights1 = await leafHeights();
  expect(heights1.length).toBeGreaterThan(0);

  // Phase 2 — back to Flow, press Enter ~60 more times.
  await setMode('flow');
  await page.locator('#editor').click();
  await typeLines(60);
  await setMode('print');
  const heights2 = await leafHeights();

  // The page COUNT increases ...
  expect(heights2.length).toBeGreaterThan(heights1.length);

  // ... but every leaf — in BOTH captures — is the SAME fixed height.
  // No leaf grew; no A4 -> A2 stretch. Content that overflows a leaf is
  // carried to the next leaf, never absorbed by growing this one.
  const allHeights = heights1.concat(heights2);
  const fixed = allHeights[0];
  for (const h of allHeights) {
    expect(h).toBe(fixed);
  }
});
