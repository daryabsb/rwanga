// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Scene chrome geometry — Playwright + Electron.
//
// Pins the vertical gap between the scene-number chrome
// (.rga-scene-v3-num) and the scene-heading slugline
// (.rga-scene-heading-v3) in BOTH directions. The 2026-05-23
// tightening (heading-v3 margin-top 1.6em → 0.4em) needs both LTR
// and RTL to verify before claiming the layout is sane.
//
// Why both directions:
//   • LTR reads "SCENE N" in Latin glyphs at 13px; gap absolutes are
//     small to begin with.
//   • RTL reads "دیمەنی N" in Kurdish glyphs at 16px (per the
//     [dir="rtl"] .rga-scene-v3-num bump). Em-based margins scale
//     with the larger font, so the absolute gap is bigger in RTL
//     — this is the regression risk.
//
// We don't pin an exact pixel value (typography is the author's choice);
// we pin a CEILING (gap must read as "tight neighbour", not "chasm")
// and a FLOOR (must remain visually separated, not glued).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..');
const RTL_FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'mysterious-guest-rtl.rga');
const LTR_FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'playground-the-last-light.rga');

const GAP_CEILING_PX = 20; // tighter than the old ~25-35px gap
const GAP_FLOOR_PX   = 2;  // must not be glued (kept tiny so test survives 0.4em → 0.3em iteration)

let app, page, userDataDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-scene-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(window.Rga && window.Rga.Shell && window.Rga.FileManager));
});

test.afterEach(async () => {
  if (app) { await app.close(); app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

async function openFixture(fixturePath) {
  // Read the .rga content in Node, push to renderer via
  // FileManager.openFromContent (bypasses IPC for test reliability).
  const content = fs.readFileSync(fixturePath, 'utf8');
  await page.evaluate(async ({ handle, body }) => {
    await window.Rga.FileManager.openFromContent(handle, body);
  }, { handle: fixturePath, body: content });
  // Wait for ANY scene-v3 element from this doc to render (the previous
  // boot-time default scene is replaced by the loaded doc).
  await page.waitForFunction(() => {
    return document.querySelectorAll('.rga-scene-v3').length >= 1;
  }, null, { timeout: 5000 });
  // Direction is set by TabManager.applyDocumentDirection on tab activation;
  // wait for the editor's dir attribute to match the doc's declared profile.
  await page.waitForTimeout(150);
}

async function measureNumToHeadingGap() {
  return page.evaluate(() => {
    const scene = document.querySelector('.rga-scene-v3');
    if (!scene) return { error: 'no-scene-v3' };
    const num = scene.querySelector('.rga-scene-v3-num');
    const heading = scene.querySelector('.rga-scene-heading-v3');
    if (!num || !heading) return { error: 'missing-num-or-heading' };
    const numRect = num.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    const editor = document.getElementById('editor');
    const tabTitle = document.querySelector('.tab.active .tab-title');
    return {
      numBottom: numRect.bottom,
      headingTop: headingRect.top,
      gap: headingRect.top - numRect.bottom,
      numFontSize: getComputedStyle(num).fontSize,
      headingMarginTop: getComputedStyle(heading).marginTop,
      // Diagnostics — what document is actually loaded.
      editorDir: editor ? editor.getAttribute('dir') : null,
      activeTabTitle: tabTitle ? tabTitle.textContent : null,
      sceneCount: document.querySelectorAll('.rga-scene-v3').length
    };
  });
}

test('scene chrome (LTR): num→heading gap is tight without gluing', async () => {
  await openFixture(LTR_FIXTURE);
  const m = await measureNumToHeadingGap();
  expect(m.error).toBeUndefined();
  expect(m.gap).toBeGreaterThan(GAP_FLOOR_PX);
  expect(m.gap).toBeLessThan(GAP_CEILING_PX);
  // Sanity: num retains its LTR scale (13px) — RTL bump did not leak.
  expect(parseFloat(m.numFontSize)).toBeCloseTo(13, 0);
});

test('scene chrome (RTL): num→heading gap is tight without gluing, num is larger than LTR', async () => {
  await openFixture(RTL_FIXTURE);
  const m = await measureNumToHeadingGap();
  expect(m.error).toBeUndefined();
  expect(m.gap).toBeGreaterThan(GAP_FLOOR_PX);
  expect(m.gap).toBeLessThan(GAP_CEILING_PX);
  // RTL num must be visibly larger than LTR (16px per the
  // [dir="rtl"] .rga-scene-v3-num bump for Kurdish glyph metrics).
  expect(parseFloat(m.numFontSize)).toBeGreaterThanOrEqual(15);
});
