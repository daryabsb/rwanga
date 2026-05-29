// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Review Bar v1 — Playwright (Electron) integration.
//
// Proves the live review-surface behaviour jsdom cannot: the bar mounts over
// the real sheet stack, the page indicator tracks scroll, prev/next/jump
// navigate, Fit/zoom transform the stack (presentation only), Export routes
// to the PDF pipe, and Done/Esc return to the editor.
//
// Prerequisite: `npm run build:renderer`. Run with: npm run test:e2e
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

let app, page, userDataDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-e2e-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(window.Rga && window.Rga.PrintPreview && window.Rga.ReviewBar));
  // A document tab must be active so the preview has a view to render.
  await page.waitForFunction(() => !!(window.Rga.TabManager && window.Rga.TabManager._editorView()));
});

test.afterEach(async () => {
  if (app) { await app.close(); app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

function enterPreview() {
  return page.evaluate(() => window.Rga.PrintPreview.open());
}

// Insert enough text to force a multi-page package, then enter preview.
async function enterMultiPagePreview() {
  await page.locator('#editor').click();
  await page.evaluate(() => {
    const v = window.Rga.TabManager._editorView();
    const big = 'A long line of action that fills the page. '.repeat(220);
    v.dispatch(v.state.tr.insertText(big));
  });
  await enterPreview();
  await expect(page.locator('#rga-review-bar')).toBeVisible();
}

test('entering Print Preview mounts the review bar with all directed controls', async () => {
  await enterPreview();
  const bar = page.locator('#rga-review-bar');
  await expect(bar).toBeVisible();
  await expect(bar.locator('.rga-review-done')).toBeVisible();
  await expect(bar.locator('.rga-review-pageind')).toBeVisible();
  await expect(bar.locator('.rga-review-prev')).toBeVisible();
  await expect(bar.locator('.rga-review-next')).toBeVisible();
  await expect(bar.locator('.rga-review-fit-page')).toBeVisible();
  await expect(bar.locator('.rga-review-fit-width')).toBeVisible();
  await expect(bar.locator('.rga-review-zoom-pct')).toBeVisible();
  await expect(bar.locator('.rga-review-export')).toBeVisible();
  // Print is shown-but-deferred (disabled).
  await expect(bar.locator('.rga-review-print')).toBeDisabled();
});

test('Fit page is the default on entry; the percent readout is populated', async () => {
  await enterPreview();
  await expect(page.locator('.rga-review-fit-page')).toHaveClass(/is-active/);
  await expect(page.locator('.rga-review-zoom-pct')).toHaveText(/%$/);
});

test('the page indicator reports current / total from the real sheet stack', async () => {
  await enterPreview();
  const total = await page.locator('#rga-print-preview-root .rga-page-sheet').count();
  await expect(page.locator('.rga-review-pageind')).toHaveText(new RegExp('1 / ' + total));
});

test('Done returns to the editor and removes the bar', async () => {
  await enterPreview();
  await page.locator('.rga-review-done').click();
  await expect(page.locator('#rga-review-bar')).toBeHidden();
  await expect(page.locator('#editor')).toBeVisible();
  expect(await page.evaluate(() => window.Rga.PrintPreview.isActive())).toBe(false);
});

test('Esc still exits the surface (keyboard path) and removes the bar', async () => {
  await enterPreview();
  await page.keyboard.press('Escape');
  await expect(page.locator('#rga-review-bar')).toBeHidden();
  expect(await page.evaluate(() => window.Rga.PrintPreview.isActive())).toBe(false);
});

test('Fit width toggles the active fit control; zoom stepper changes the readout and clears fit', async () => {
  await enterPreview();
  await page.locator('.rga-review-fit-width').click();
  await expect(page.locator('.rga-review-fit-width')).toHaveClass(/is-active/);
  await expect(page.locator('.rga-review-fit-page')).not.toHaveClass(/is-active/);

  const before = await page.locator('.rga-review-zoom-pct').textContent();
  await page.locator('.rga-review-zoom-in').click();
  await expect(page.locator('.rga-review-zoom-pct')).not.toHaveText(before);
  // Manual zoom clears any active fit mode.
  await expect(page.locator('.rga-review-fit-width')).not.toHaveClass(/is-active/);
});

test('zoom is presentation-only — it sets root.style.zoom and never the sheet inch geometry', async () => {
  await enterPreview();
  await page.locator('.rga-review-zoom-in').click();
  const probe = await page.evaluate(() => {
    const root = document.getElementById('rga-print-preview-root');
    const sheet = root.querySelector('.rga-page-sheet');
    return { rootZoom: root.style.zoom, sheetW: sheet.style.width, sheetH: sheet.style.height };
  });
  expect(probe.rootZoom).not.toBe('');                 // presentation transform applied
  expect(probe.sheetW).toMatch(/in$/);                 // sheet geometry stays inch-true
  expect(probe.sheetH).toMatch(/in$/);
});

test('Export PDF routes through the review surface to Rga.PdfExport.run()', async () => {
  await enterPreview();
  // Stub the pipe so no native save dialog blocks the test; assert it fires.
  await page.evaluate(() => {
    window.__exportRan = 0;
    window.Rga.PdfExport.run = () => { window.__exportRan += 1; return Promise.resolve(true); };
  });
  await page.locator('.rga-review-export').click();
  expect(await page.evaluate(() => window.__exportRan)).toBe(1);
});

test('next / prev navigate the package and the indicator tracks the page', async () => {
  await enterMultiPagePreview();
  const total = await page.locator('#rga-print-preview-root .rga-page-sheet').count();
  expect(total).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.rga-review-pageind')).toHaveText(new RegExp('^\\s*1 / ' + total));
  await page.locator('.rga-review-next').click();
  await expect(page.locator('.rga-review-pageind')).toHaveText(new RegExp('^\\s*2 / ' + total));
  await page.locator('.rga-review-prev').click();
  await expect(page.locator('.rga-review-pageind')).toHaveText(new RegExp('^\\s*1 / ' + total));
});

test('jump-to-page: click the indicator, type a page, Enter scrolls there', async () => {
  await enterMultiPagePreview();
  const total = await page.locator('#rga-print-preview-root .rga-page-sheet').count();
  await page.locator('.rga-review-pageind').click();
  const input = page.locator('.rga-review-pageind-input');
  await expect(input).toBeVisible();
  await input.fill(String(total));
  await input.press('Enter');
  await expect(page.locator('.rga-review-pageind')).toHaveText(new RegExp(total + ' / ' + total));
});
