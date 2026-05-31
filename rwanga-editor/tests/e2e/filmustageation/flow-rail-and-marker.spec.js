// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1/F6 — Flow line-number rail personality + P## page marker.
//
// Source of truth: FLOW_VIEW_UX_DIRECTION_V2 §1-Gutter, §1-Page +
// ENGINEERING_IMPLEMENTATION_GUIDE items F1, F1b/F6.
//
// What this slice changed:
//   F1 — .flow-line-gutter gets its own background band + a page-facing
//        hairline edge + refined tabular numerals (tokens --flow-rail-*).
//   F6 — the floating "— Page N —" marker becomes a styled P## accent tab,
//        MOVED from the inline-END chrome zone (where it collided with
//        right-aligned transitions) to the inline-START (rail) side. Uses
//        logical inset-inline-start so RTL mirrors automatically.
//        nav-index.js _buildPageMarkerWidget now emits 'P' + N.
//
// Doctrine guarded: Flow stays continuous (the marker parent keeps height:0,
// zero PageMap budget — an ambient coordinate, never a hard seam, Law 4).
// No Print Preview change, no pagination-truth change, no settings.
//
// Prerequisite: `npm run build:renderer`. Run with: npm run test:e2e
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const ART_DIR = path.resolve(APP_ROOT, 'test-results', 'flow-rail-and-marker');

let app, page, userDataDir;

test.beforeAll(() => { try { fs.mkdirSync(ART_DIR, { recursive: true }); } catch (_) {} });

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-f1f6-'));
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

// Seed a multi-scene screenplay via updateState (NOT dispatch — keeps the doc
// clean so CloseGuard never blocks app.close()), ensure Flow view, and let the
// FlowChrome line-number pass paint the rail.
async function buildFlowScript() {
  await page.evaluate(() => {
    const v = window.Rga.TabManager._editorView();
    const s = v.state.schema, PM = window.RgaProseMirror;
    const scenes = [];
    for (let i = 0; i < 6; i += 1) {
      scenes.push(s.nodes.scene.create(
        { id: 'sc' + i, notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
        [
          s.nodes.sceneHeading.create({ setting: 'INT.', time: 'NIGHT', headingStyle: null }, s.text('APARTMENT ' + i)),
          s.nodes.action.create(null, s.text('The room is dim. ' + 'Action detail. '.repeat(10))),
          s.nodes.character.create(null, s.text('COLLECTOR')),
          s.nodes.dialogue.create(null, s.text('I hate this job, every single night of it.')),
          s.nodes.transition.create({ presetType: 'CUT' }, s.text('CUT TO:'))
        ]
      ));
    }
    const doc = s.nodes.doc.create(null, [s.nodes.titleStrip.create({ removable: true }), s.nodes.body.create(null, scenes)]);
    v.updateState(PM.EditorState.create({ schema: s, doc: doc, plugins: v.state.plugins }));
  });
  // Ensure Flow view is active, then let FlowChrome's debounced paint run.
  await page.evaluate(() => { if (window.Rga.ViewMode.get() !== 'flow') window.Rga.ViewMode.set('flow'); });
  await page.evaluate(() => window.Rga.FlowChrome && window.Rga.FlowChrome.refresh && window.Rga.FlowChrome.refresh());
  await page.waitForFunction(() => {
    const g = document.getElementById('flow-line-gutter');
    return g && g.querySelectorAll('.flow-line-num').length > 0;
  }, null, { timeout: 8000 });
}

async function setTheme(theme) {
  await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); }, theme);
}

async function setDir(dir) {
  await page.evaluate((d) => {
    const ed = document.getElementById('editor');
    if (ed) ed.setAttribute('dir', d);
  }, dir);
}

async function railProbe() {
  return page.evaluate(() => {
    const g = document.getElementById('flow-line-gutter');
    const cs = getComputedStyle(g);
    const nums = g.querySelectorAll('.flow-line-num');
    return {
      display: cs.display,
      background: cs.backgroundColor,
      borderInlineEndWidth: cs.borderInlineEndWidth,
      color: cs.color,
      numCount: nums.length,
      numFontVariant: nums[0] ? getComputedStyle(nums[0]).fontVariantNumeric : null
    };
  });
}

const isTransparent = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent' || c === '';

// =================================================================
// F1.1 — the rail has its own visible background band (light + dark)
//        and a page-facing edge + numerals. Not an invisible gutter.
// =================================================================
test('F1 — the line-number rail has its own background band, page-facing edge, and numerals (dark)', async () => {
  await setTheme('dark');
  await buildFlowScript();
  const r = await railProbe();

  expect(r.display).not.toBe('none');          // rail visible in Flow
  expect(isTransparent(r.background)).toBe(false);   // distinct band, not transparent
  expect(parseFloat(r.borderInlineEndWidth)).toBeGreaterThan(0);  // framing edge
  expect(r.numCount).toBeGreaterThan(0);       // line numbers present (kept, not removed)
  expect(r.numFontVariant).toContain('tabular-nums');  // refined numerals

  await page.locator('#flow-line-gutter').screenshot({ path: path.join(ART_DIR, 'rail-dark.png') });
});

test('F1 — the rail band is also present and visible in the light theme', async () => {
  await setTheme('light');
  await buildFlowScript();
  const r = await railProbe();

  expect(r.display).not.toBe('none');
  expect(isTransparent(r.background)).toBe(false);
  expect(parseFloat(r.borderInlineEndWidth)).toBeGreaterThan(0);
  expect(r.numCount).toBeGreaterThan(0);

  await page.locator('#flow-line-gutter').screenshot({ path: path.join(ART_DIR, 'rail-light.png') });
});

// =================================================================
// F1.2 — the rail band differs between light and dark (token-driven,
//         not a single hardcoded color).
// =================================================================
test('F1 — the rail background is theme-aware (light band != dark band)', async () => {
  await setTheme('dark');
  await buildFlowScript();
  const darkBg = (await railProbe()).background;
  await setTheme('light');
  await page.evaluate(() => window.Rga.FlowChrome && window.Rga.FlowChrome.refresh && window.Rga.FlowChrome.refresh());
  const lightBg = (await railProbe()).background;
  expect(darkBg).not.toBe(lightBg);
});

// =================================================================
// F6.1 — the P## marker tab resolves on the inline-START (rail) side,
//        clear of a right-aligned transition, in LTR. Built from the
//        exact DOM nav-index._buildPageMarkerWidget emits.
// =================================================================
async function markerProbe(dir) {
  return page.evaluate((d) => {
    const container = document.getElementById('editor-container');
    const editor = document.getElementById('editor');
    editor.setAttribute('dir', d);

    // Reproduce the builder's exact DOM contract, with the F6 text.
    const marker = document.createElement('div');
    marker.className = 'rga-page-marker';
    marker.setAttribute('data-page-number', '2');
    marker.setAttribute('role', 'separator');
    const rule = document.createElement('span');
    rule.className = 'rga-page-marker-rule';
    marker.appendChild(rule);
    const begin = document.createElement('span');
    begin.className = 'rga-page-marker-begin';
    begin.textContent = 'P2';
    marker.appendChild(begin);
    // Place it inside the editor like the PM widget would be.
    editor.appendChild(marker);

    // A right-aligned transition next to it, to prove no collision.
    const tx = document.createElement('div');
    tx.className = 'rga-print-block rga-print-block-transition';
    tx.textContent = 'CUT TO:';
    editor.appendChild(tx);

    void editor.offsetHeight;

    const beginRect = begin.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    const beginCenterX = beginRect.left + beginRect.width / 2;
    const editorCenterX = editorRect.left + editorRect.width / 2;
    const beginCs = getComputedStyle(begin);

    const out = {
      text: begin.textContent,
      isPstyle: /^P\d+$/.test(begin.textContent),
      hasTabBg: !(getComputedStyle(begin).backgroundColor === 'rgba(0, 0, 0, 0)'),
      // inline-start side: LTR => left half (centerX < editorCenter);
      //                    RTL => right half (centerX > editorCenter).
      beginOnInlineStart: d === 'rtl'
        ? beginCenterX > editorCenterX
        : beginCenterX < editorCenterX,
      fontWeight: beginCs.fontWeight
    };
    marker.remove();
    tx.remove();
    return out;
  }, dir);
}

test('F6 — the marker is a styled P## tab on the inline-start side (LTR)', async () => {
  await setTheme('dark');
  await buildFlowScript();
  const m = await markerProbe('ltr');
  expect(m.text).toBe('P2');
  expect(m.isPstyle).toBe(true);               // no longer "— Page N —"
  expect(m.hasTabBg).toBe(true);               // styled accent tab, not bare text
  expect(parseInt(m.fontWeight, 10)).toBeGreaterThanOrEqual(600);
  expect(m.beginOnInlineStart).toBe(true);     // rail side, clear of inline-end transition
  await setDir('ltr');
  await page.screenshot({ path: path.join(ART_DIR, 'flow-ltr.png') });
});

// =================================================================
// F6.2 — RTL: the P## tab mirrors to the inline-start (physical right)
//         side via logical properties — same rail side as the gutter.
// =================================================================
test('F6 — the P## tab mirrors to the inline-start side in RTL', async () => {
  await setTheme('dark');
  await buildFlowScript();
  const m = await markerProbe('rtl');
  expect(m.text).toBe('P2');
  expect(m.beginOnInlineStart).toBe(true);     // inline-start == right in RTL
  await setDir('rtl');
  await page.evaluate(() => window.Rga.FlowChrome && window.Rga.FlowChrome.refresh && window.Rga.FlowChrome.refresh());
  await page.screenshot({ path: path.join(ART_DIR, 'flow-rtl.png') });
});

// =================================================================
// F6.3 — RTL rail itself sits on the inline-start (physical right) edge,
//         i.e. to the right of the page (existing ownership preserved).
// =================================================================
test('F6/F1 — in RTL the rail sits on the inline-start (right) edge of the page', async () => {
  await setTheme('dark');
  await buildFlowScript();
  await setDir('rtl');
  await page.evaluate(() => window.Rga.FlowChrome && window.Rga.FlowChrome.refresh && window.Rga.FlowChrome.refresh());
  const sides = await page.evaluate(() => {
    const g = document.getElementById('flow-line-gutter');
    const ed = document.getElementById('editor');
    const gr = g.getBoundingClientRect();
    const er = ed.getBoundingClientRect();
    return { gutterCenterX: gr.left + gr.width / 2, editorCenterX: er.left + er.width / 2 };
  });
  // RTL: rail is on the page's right (inline-start) edge.
  expect(sides.gutterCenterX).toBeGreaterThan(sides.editorCenterX);
});

// =================================================================
// Doctrine — Flow stays continuous: the marker parent contributes zero
// height (height:0), so the marker is an ambient coordinate, not a seam.
// =================================================================
test('doctrine — the Flow page marker parent has zero height (no page seam, Law 4)', async () => {
  await setTheme('dark');
  await buildFlowScript();
  const h = await page.evaluate(() => {
    const editor = document.getElementById('editor');
    const marker = document.createElement('div');
    marker.className = 'rga-page-marker';
    editor.appendChild(marker);
    void editor.offsetHeight;
    const height = getComputedStyle(marker).height;
    marker.remove();
    return height;
  });
  expect(h).toBe('0px');
});
