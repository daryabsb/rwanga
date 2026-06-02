// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Scene Navigator — RTL marks-expansion fix (computed-geometry confirmation).
//
// Bug: the navigator catalogues the scenes of the active script but never
// adopted the script's writing direction, and its disclosure chevron / marks
// zone were laid out with physical (left) CSS. For an RTL script the chevron
// poked LEFT into the heading column (wrong placement / not usable) and the
// caret pointed the wrong way; the marks zone indented from the wrong side.
//
// This spec drives the REAL path: it makes the active document RTL
// (metadata.screenplayProfile.direction = 'rtl' — the same source #editor
// reads via TabManager.applyDocumentDirection) and confirms:
//   1. The navigator mirrors the script (wrapper dir = 'rtl').
//   2. The chevron is visible at rest (opacity > 0.4).
//   3. The chevron sits on the inline-start (right) side — it does NOT
//      overlap the heading column.
//   4. The collapsed caret points toward inline-start (left in RTL):
//      border-right is the solid edge, not border-left.
//   5. Expanding renders the marks zone, indented from the inline-start
//      (padding-inline-start resolves to padding-right in RTL).
//   6. LTR is unchanged (control assertions in a second test).
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sn-rtl-expansion-'));
  const app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.Shell && window.Rga.Shell.Sidebar &&
    window.Rga.Shell.SceneNavigator && window.Rga.ScriptSession && window.Rga.TabManager));
  await page.waitForFunction(() =>
    window.Rga.Shell.Sidebar.current() === 'sceneNavigator', null, { timeout: 5000 });
  return { app, page, userDataDir };
}

async function teardown(app, userDataDir) {
  try { await app.close(); } catch (_) {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
}

// Seed two scenes (second carries marks) and force the active document's
// direction. `dir` is 'rtl' or 'ltr'. Mirrors the visual-weight spec's seed
// pattern (override Nav.getIndex) but also overrides activeDoc so the
// navigator reads the same screenplayProfile.direction the editor reads.
async function seed(page, dir) {
  return page.evaluate((dir) => {
    const scenes = [
      { nodeId: 'sc-1', sceneNumber: 1, pmPos: 0,   pmEndPos: 100, headingDisplay: 'INT. KITCHEN — DAY',  hasNotes: false, hasRevisionFlag: false },
      { nodeId: 'sc-2', sceneNumber: 2, pmPos: 100, pmEndPos: 200, headingDisplay: 'EXT. STREET — NIGHT', hasNotes: true,  hasRevisionFlag: true  }
    ];
    const fakeIndex = { scenes: scenes, pages: [], characters: [], tags: {}, notes: [], flags: [] };
    window.Rga.Nav.getIndex = function() { return fakeIndex; };
    window.Rga.TabManager.activeDoc = function() {
      return { metadata: { screenplayProfile: { direction: dir } } };
    };
    window.Rga.Shell.SceneNavigator._render();
  }, dir);
}

test('SN RTL — navigator mirrors the script; chevron on inline-start, caret points left, marks indent from start', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seed(page, 'rtl');

    const rowSel = '.rga-shell-scene-navigator-row[data-scene-node-id="sc-2"]';
    await page.locator(rowSel + ' .rga-shell-scene-navigator-chevron').click();

    const m = await page.evaluate((rowSel) => {
      const wrapper = document.querySelector('.rga-shell-scene-navigator');
      const row = document.querySelector(rowSel);
      const chevron = row.querySelector('.rga-shell-scene-navigator-chevron');
      const heading = row.querySelector('.rga-shell-scene-navigator-heading');
      const marks = row.querySelector('.rga-shell-scene-navigator-marks');
      const cs = (el, pseudo) => getComputedStyle(el, pseudo || null);
      const rect = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; };
      const caret = cs(chevron, '::before');
      return {
        wrapperDir:    wrapper ? (wrapper.getAttribute('dir') || cs(wrapper).direction) : null,
        chevronOpacity: parseFloat(cs(chevron).opacity),
        chevronRect:   rect(chevron),
        headingRect:   rect(heading),
        caretBorderLeft:  parseFloat(caret.borderLeftWidth) || 0,
        caretBorderRight: parseFloat(caret.borderRightWidth) || 0,
        marksPresent:  !!marks,
        marksPadLeft:  marks ? parseFloat(cs(marks).paddingLeft) : null,
        marksPadRight: marks ? parseFloat(cs(marks).paddingRight) : null
      };
    }, rowSel);

    // 1. Navigator mirrors the RTL script.
    expect(String(m.wrapperDir).toLowerCase()).toBe('rtl');
    // 2. Chevron visible at rest.
    expect(m.chevronOpacity).toBeGreaterThan(0.4);
    // 3. Chevron sits on inline-start (right) — it must NOT overlap the
    //    heading column (which is to the LEFT of the gutter in RTL).
    expect(m.chevronRect.left).toBeGreaterThanOrEqual(m.headingRect.right - 1);
    // 4. Collapsed caret points toward inline-start (left in RTL): the solid
    //    triangle edge is border-right, not border-left.
    expect(m.caretBorderRight).toBeGreaterThan(m.caretBorderLeft);
    // 5. Marks render, indented from inline-start (→ padding-right in RTL).
    expect(m.marksPresent).toBe(true);
    expect(m.marksPadRight).toBeGreaterThan(m.marksPadLeft);
  } finally {
    await teardown(app, userDataDir);
  }
});

test('SN LTR — control: chevron on inline-start (left), caret points right, marks indent from left (unchanged)', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await seed(page, 'ltr');

    const rowSel = '.rga-shell-scene-navigator-row[data-scene-node-id="sc-2"]';
    await page.locator(rowSel + ' .rga-shell-scene-navigator-chevron').click();

    const m = await page.evaluate((rowSel) => {
      const wrapper = document.querySelector('.rga-shell-scene-navigator');
      const row = document.querySelector(rowSel);
      const chevron = row.querySelector('.rga-shell-scene-navigator-chevron');
      const heading = row.querySelector('.rga-shell-scene-navigator-heading');
      const marks = row.querySelector('.rga-shell-scene-navigator-marks');
      const cs = (el, pseudo) => getComputedStyle(el, pseudo || null);
      const rect = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right }; };
      const caret = cs(chevron, '::before');
      return {
        wrapperDir:    wrapper ? (cs(wrapper).direction) : null,
        chevronRect:   rect(chevron),
        headingRect:   rect(heading),
        caretBorderLeft:  parseFloat(caret.borderLeftWidth) || 0,
        caretBorderRight: parseFloat(caret.borderRightWidth) || 0,
        marksPresent:  !!marks,
        marksPadLeft:  marks ? parseFloat(cs(marks).paddingLeft) : null,
        marksPadRight: marks ? parseFloat(cs(marks).paddingRight) : null
      };
    }, rowSel);

    // LTR (default) — the accepted polish is unchanged.
    expect(m.wrapperDir).toBe('ltr');
    // Chevron on inline-start (left) — to the LEFT of the heading column.
    expect(m.chevronRect.right).toBeLessThanOrEqual(m.headingRect.left + 1);
    // Collapsed caret points right (border-left is the solid edge).
    expect(m.caretBorderLeft).toBeGreaterThan(m.caretBorderRight);
    // Marks indent from the left.
    expect(m.marksPresent).toBe(true);
    expect(m.marksPadLeft).toBeGreaterThan(m.marksPadRight);
  } finally {
    await teardown(app, userDataDir);
  }
});
