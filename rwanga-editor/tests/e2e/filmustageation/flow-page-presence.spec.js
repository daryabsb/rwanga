// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F2/F3 — Flow page presence (shadow/depth) + desk separation.
//
// Source of truth: FLOW_VIEW_UX_DIRECTION_V2 §1 (Page Presence), §2/§3
// (dark/light), Closing §3 + ENGINEERING_IMPLEMENTATION_GUIDE items F2, F3.
//
// What this slice changed (renderer/css):
//   F2 — the Flow paper (#editor-container.view-flow #editor) gets the
//        already-defined --editor-page-shadow token (was box-shadow:none),
//        so it reads as a real sheet lifted off the desk. Paper stays white
//        by default (--editor-page-bg, unchanged).
//   F3 — the Flow desk (#editor-container.view-flow) uses a new scoped
//        --flow-desk-bg token (a step deeper than --editor-bg) so the page
//        is the focal object. Flow-only: Draft/Print keep --editor-bg.
//
// Doctrine guarded: no page seams (Flow continuous, Law 4); Print Preview /
// PDF untouched (.rga-page-sheet owns its own shadow, separate selector);
// tokens only, no hardcoded theme colours; both themes.
//
// Prerequisite: `npm run build:renderer`. Run with: npm run test:e2e
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const ART_DIR = path.resolve(APP_ROOT, 'test-results', 'flow-page-presence');

let app, page, userDataDir;

test.beforeAll(() => { try { fs.mkdirSync(ART_DIR, { recursive: true }); } catch (_) {} });

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-f2f3-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(window.Rga && window.Rga.TabManager && window.Rga.TabManager._editorView()));
  await page.waitForFunction(() => !!(window.Rga.ViewMode && window.Rga.ViewMode.get));
});

test.afterEach(async () => {
  if (app) { await app.close(); app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

async function buildFlowScript() {
  await page.evaluate(() => {
    const v = window.Rga.TabManager._editorView();
    const s = v.state.schema, PM = window.RgaProseMirror;
    const scenes = [];
    for (let i = 0; i < 4; i += 1) {
      scenes.push(s.nodes.scene.create(
        { id: 'sc' + i, notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
        [
          s.nodes.sceneHeading.create({ setting: 'INT.', time: 'NIGHT', headingStyle: null }, s.text('APARTMENT ' + i)),
          s.nodes.action.create(null, s.text('The room is dim. ' + 'Action detail. '.repeat(8))),
          s.nodes.character.create(null, s.text('COLLECTOR')),
          s.nodes.dialogue.create(null, s.text('I hate this job, every single night of it.'))
        ]
      ));
    }
    const doc = s.nodes.doc.create(null, [s.nodes.titleStrip.create({ removable: true }), s.nodes.body.create(null, scenes)]);
    v.updateState(PM.EditorState.create({ schema: s, doc: doc, plugins: v.state.plugins }));
  });
  await page.evaluate(() => { if (window.Rga.ViewMode.get() !== 'flow') window.Rga.ViewMode.set('flow'); });
  await page.evaluate(() => window.Rga.FlowChrome && window.Rga.FlowChrome.refresh && window.Rga.FlowChrome.refresh());
  await page.waitForFunction(() => {
    const c = document.querySelector('#editor-container.view-flow');
    return !!c;
  }, null, { timeout: 8000 });
}

async function setTheme(theme) {
  await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); }, theme);
}

async function surfaceProbe() {
  return page.evaluate(() => {
    const container = document.querySelector('#editor-container.view-flow');
    const editor = document.getElementById('editor');
    const gutter = document.getElementById('flow-line-gutter');
    const cc = getComputedStyle(container);
    const ce = getComputedStyle(editor);
    const cg = getComputedStyle(gutter);
    return {
      deskBg: cc.backgroundColor,
      pageBg: ce.backgroundColor,
      pageShadow: ce.boxShadow,
      railBg: cg.backgroundColor
    };
  });
}

const hasShadow = (s) => !!s && s !== 'none' && s.trim() !== '';

// =================================================================
// F2.1 — dark: the page carries a real shadow and is a distinct
//        surface from the desk.
// =================================================================
test('F2/F3 — dark: the page has a soft shadow and is distinct from the recessive desk', async () => {
  await setTheme('dark');
  await buildFlowScript();
  const s = await surfaceProbe();

  expect(hasShadow(s.pageShadow)).toBe(true);     // F2 — page is lifted (was none)
  expect(s.pageBg).not.toBe(s.deskBg);            // F3 — page != desk
  await page.locator('#editor-container').screenshot({ path: path.join(ART_DIR, 'page-dark.png') });
});

// =================================================================
// F2.2 — light: paper stays white, has a shadow, distinct from desk.
// =================================================================
test('F2/F3 — light: the white page has a shadow and is distinct from the recessive desk', async () => {
  await setTheme('light');
  await buildFlowScript();
  const s = await surfaceProbe();

  expect(hasShadow(s.pageShadow)).toBe(true);
  expect(s.pageBg).toBe('rgb(255, 255, 255)');    // paper stays WHITE by default
  expect(s.pageBg).not.toBe(s.deskBg);
  await page.locator('#editor-container').screenshot({ path: path.join(ART_DIR, 'page-light.png') });
});

// =================================================================
// F3 — rail + page + desk are three visually distinct surfaces
//      (in both themes). Composes cleanly with the F1 rail tokens.
// =================================================================
test('F3 — rail, page, and desk are three distinct surfaces (dark)', async () => {
  await setTheme('dark');
  await buildFlowScript();
  const s = await surfaceProbe();
  const set = new Set([s.deskBg, s.pageBg, s.railBg]);
  expect(set.size).toBe(3);                        // all three differ
});

test('F3 — rail, page, and desk are three distinct surfaces (light)', async () => {
  await setTheme('light');
  await buildFlowScript();
  const s = await surfaceProbe();
  const set = new Set([s.deskBg, s.pageBg, s.railBg]);
  expect(set.size).toBe(3);
});

// =================================================================
// F3 — the desk recedes: --flow-desk-bg is deeper than the shared
//      --editor-bg (Draft/Print baseline), proving the scoped change.
// =================================================================
test('F3 — the Flow desk token is deeper than the shared --editor-bg (recessive desk)', async () => {
  await setTheme('dark');
  await buildFlowScript();
  const t = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      flowDesk: cs.getPropertyValue('--flow-desk-bg').trim(),
      editorBg: cs.getPropertyValue('--editor-bg').trim()
    };
  });
  expect(t.flowDesk).not.toBe('');
  expect(t.flowDesk).not.toBe(t.editorBg);         // scoped recede, not the shared token
});

// =================================================================
// DOCTRINE — Print Preview is UNCHANGED: the print sheet keeps its own
// hardcoded shadow (not --editor-page-shadow) and the Flow desk token
// does not reach the print surface.
// =================================================================
test('doctrine — Print Preview sheet shadow is its own value, unaffected by the Flow page shadow', async () => {
  await buildFlowScript();
  const probe = await page.evaluate(() => {
    window.Rga.PrintPreview.open();
    const sheet = document.querySelector('#rga-print-preview-root .rga-page-sheet');
    const root = document.getElementById('rga-print-preview-root');
    const rootBg = getComputedStyle(root).backgroundColor;
    const sheetShadow = sheet ? getComputedStyle(sheet).boxShadow : null;
    const sheetBg = sheet ? getComputedStyle(sheet).backgroundColor : null;
    // The Flow page shadow token, resolved, to prove the sheet differs.
    const pageShadowToken = getComputedStyle(document.documentElement).getPropertyValue('--editor-page-shadow').trim();
    window.Rga.PrintPreview.hide();
    return { sheetShadow, sheetBg, rootBg, pageShadowToken };
  });
  // Sheet is white and has a shadow, but NOT the Flow page-shadow token value.
  expect(probe.sheetBg).toBe('rgb(255, 255, 255)');
  expect(probe.sheetShadow).not.toBe('none');
  // The print sheet shadow is its own multi-layer value, distinct from the
  // single-layer Flow token — proves Print Preview wasn't repointed.
  expect(probe.sheetShadow).not.toBe(probe.pageShadowToken);
  // The Flow desk token must not paint the print backdrop (it's a radial-
  // gradient warm-dark field, not the flat --flow-desk-bg).
  expect(probe.rootBg).not.toBe('rgb(15, 15, 15)');  // not --flow-desk-bg #0f0f0f
});

// =================================================================
// DOCTRINE — no page seam: the Flow page is a single continuous surface
// (one #editor element, height auto), not paginated sheets.
// =================================================================
test('doctrine — Flow stays continuous: one page element, no sheet stack (Law 4)', async () => {
  await buildFlowScript();
  const counts = await page.evaluate(() => ({
    flowPages: document.querySelectorAll('#editor-container.view-flow #editor').length,
    printSheets: document.querySelectorAll('#editor-container.view-flow .rga-page-sheet').length
  }));
  expect(counts.flowPages).toBe(1);    // single continuous paper
  expect(counts.printSheets).toBe(0);  // no paginated sheets leaked into Flow
});
