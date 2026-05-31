// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation R1 — RTL print-block logical-property mirror.
//
// Source of truth: RTL_SCREENPLAY_CONVENTION.md (platform law) +
// ENGINEERING_IMPLEMENTATION_GUIDE.md item R1.
//
// What R1 changed (renderer/css/editor-prosemirror.css, .rga-print-block-*):
//   character     padding-left:2.0in → padding-inline-start:2.0in
//   parenthetical padding-left:1.5in → padding-inline-start:1.5in
//   dialogue      padding-left:1.0in → padding-inline-start:1.0in
//   transition    text-align:right   → text-align:end
//
// WHY a computed-style probe (not a pipeline render): Print Preview and PDF
// export are the SAME render and consume the SAME .rga-print-block-* CSS (the
// single resolver, Law 12). Proving the CSS resolves correctly under dir=ltr
// AND dir=rtl proves both surfaces at once. This is exactly the LTR-vs-RTL
// computed-style probe the RTL-V1 doctrine prescribes as the per-fix test.
//
// The doctrine guarantee: logical `start` == physical `left` in LTR, so the
// LTR computed values are byte-identical to the pre-R1 physical-property
// output (pixel parity). In RTL the same magnitudes mirror to the right edge.
//
// 1in == 96 CSS px. 2.0in=192px, 1.5in=144px, 1.0in=96px.
//
// Prerequisite: `npm run build:renderer`. Run with: npm run test:e2e
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const ART_DIR = path.resolve(APP_ROOT, 'test-results', 'rtl-print-block-mirror');

let app, page, userDataDir;

test.beforeAll(() => { try { fs.mkdirSync(ART_DIR, { recursive: true }); } catch (_) {} });

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-r1-'));
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(window.Rga && window.Rga.PrintRenderer));
});

test.afterEach(async () => {
  if (app) { await app.close(); app = null; }
  if (userDataDir) {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    userDataDir = null;
  }
});

// Build a real .rga-page-sheet (the exact class the renderer emits) carrying
// one of each indented screenplay block, append it on-screen so layout is
// live, and read getComputedStyle for the four R1-affected blocks. The real
// loaded editor-prosemirror.css is the single source under test.
async function probe(direction) {
  return page.evaluate(async (dir) => {
    const host = document.createElement('div');
    host.id = '__r1_probe_host';
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#3a3a3a;'
      + 'display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';

    const sheet = document.createElement('div');
    sheet.className = 'rga-page-sheet';
    if (dir === 'rtl') sheet.setAttribute('dir', 'rtl');

    const content = document.createElement('div');
    content.className = 'rga-page-sheet-content';

    const mk = (type, text) => {
      const el = document.createElement('div');
      el.className = 'rga-print-block rga-print-block-' + type;
      el.setAttribute('data-block-type', type);
      el.textContent = text;
      return el;
    };
    content.appendChild(mk('sceneHeading', dir === 'rtl' ? 'داخلي. شقة — ليل' : 'INT. APARTMENT — NIGHT'));
    content.appendChild(mk('action', dir === 'rtl' ? 'الغرفة معتمة.' : 'The room is dim.'));
    content.appendChild(mk('character', dir === 'rtl' ? 'الجامع' : 'COLLECTOR'));
    content.appendChild(mk('parenthetical', dir === 'rtl' ? '(بهدوء)' : '(quietly)'));
    content.appendChild(mk('dialogue', dir === 'rtl' ? 'أكره هذا العمل كل ليلة.' : 'I hate this job, every single night.'));
    content.appendChild(mk('transition', dir === 'rtl' ? 'قطع إلى:' : 'CUT TO:'));
    sheet.appendChild(content);
    host.appendChild(sheet);
    document.body.appendChild(host);

    // Let layout fully settle before reading computed logical-property
    // resolution. Reading getComputedStyle in the same microtask as the
    // insertion can race Chromium's first resolution of padding-inline-start
    // for a freshly-attached RTL subtree. Force a reflow, then wait two
    // animation frames so the style + layout are committed.
    void sheet.offsetHeight;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const read = (type) => {
      const el = content.querySelector('.rga-print-block-' + type);
      const cs = getComputedStyle(el);
      return {
        paddingLeft: cs.paddingLeft,
        paddingRight: cs.paddingRight,
        textAlign: cs.textAlign
      };
    };

    // Visual proof for the transition: getComputedStyle reports text-align
    // as the LOGICAL keyword ("end") in both directions — it does NOT resolve
    // to physical left/right (unlike padding-inline-start, which does). So to
    // prove the VISUAL mirror we measure where the transition text actually
    // lands inside its full-width block, using a Range (tests may measure;
    // only the render pipeline may not, Phase 7). end => text hugs the right
    // in LTR, the left in RTL.
    const txEl = content.querySelector('.rga-print-block-transition');
    const blockRect = txEl.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(txEl);
    const textRect = range.getBoundingClientRect();
    const transitionGeom = {
      blockCenterX: blockRect.left + blockRect.width / 2,
      textCenterX: textRect.left + textRect.width / 2,
      // gap from each block edge to the text box — the smaller gap is the
      // side the text is anchored to.
      gapLeft: textRect.left - blockRect.left,
      gapRight: blockRect.right - textRect.right
    };

    return {
      character: read('character'),
      parenthetical: read('parenthetical'),
      dialogue: read('dialogue'),
      transition: read('transition'),
      transitionGeom: transitionGeom
    };
  }, direction);
}

async function snap(name) {
  const host = page.locator('#__r1_probe_host');
  await host.screenshot({ path: path.join(ART_DIR, name) });
}

async function clearProbe() {
  await page.evaluate(() => {
    const h = document.getElementById('__r1_probe_host');
    if (h) h.remove();
  });
}

const px = (s) => parseFloat(s);

// =================================================================
// 1. LTR parity — logical start resolves to left, identical to the
//    pre-R1 physical padding-left output. This is the regression anchor.
// =================================================================
test('R1 — LTR: indents resolve to the LEFT at the exact Hollywood magnitudes (pixel parity)', async () => {
  const r = await probe('ltr');
  await snap('ltr.png');

  // character cue: 2.0in from the start (= left in LTR), nothing on the right.
  expect(px(r.character.paddingLeft)).toBeCloseTo(192, 0);
  expect(px(r.character.paddingRight)).toBeCloseTo(0, 0);

  // parenthetical: 1.5in from the left.
  expect(px(r.parenthetical.paddingLeft)).toBeCloseTo(144, 0);
  expect(px(r.parenthetical.paddingRight)).toBeCloseTo(0, 0);

  // dialogue: 1.0in from the left.
  expect(px(r.dialogue.paddingLeft)).toBeCloseTo(96, 0);
  expect(px(r.dialogue.paddingRight)).toBeCloseTo(0, 0);

  // transition: logical end-alignment (the R1 mechanism) — reported as the
  // logical keyword, and visually anchored to the RIGHT in LTR (end == right).
  expect(r.transition.textAlign).toBe('end');
  expect(r.transitionGeom.gapRight).toBeLessThan(r.transitionGeom.gapLeft);
  expect(r.transitionGeom.textCenterX).toBeGreaterThan(r.transitionGeom.blockCenterX);

  await clearProbe();
});

// =================================================================
// 2. RTL mirror — the identical magnitudes inset from the reading-start
//    (RIGHT) edge; transition moves to the reading-end (LEFT).
// =================================================================
test('R1 — RTL: indents mirror to the RIGHT edge; transition moves to the LEFT', async () => {
  const r = await probe('rtl');
  await snap('rtl.png');

  // character cue: 2.0in from the start (= right in RTL), nothing on the left.
  expect(px(r.character.paddingRight)).toBeCloseTo(192, 0);
  expect(px(r.character.paddingLeft)).toBeCloseTo(0, 0);

  // parenthetical: 1.5in from the right.
  expect(px(r.parenthetical.paddingRight)).toBeCloseTo(144, 0);
  expect(px(r.parenthetical.paddingLeft)).toBeCloseTo(0, 0);

  // dialogue: 1.0in from the right.
  expect(px(r.dialogue.paddingRight)).toBeCloseTo(96, 0);
  expect(px(r.dialogue.paddingLeft)).toBeCloseTo(0, 0);

  // transition: logical end-alignment — visually anchored to the LEFT in RTL
  // (end == left), i.e. it moves OFF the reading-start (right) side.
  expect(r.transition.textAlign).toBe('end');
  expect(r.transitionGeom.gapLeft).toBeLessThan(r.transitionGeom.gapRight);
  expect(r.transitionGeom.textCenterX).toBeLessThan(r.transitionGeom.blockCenterX);

  await clearProbe();
});

// =================================================================
// 3. Magnitude invariance — the SAME numbers in both directions
//    (geometry is mirrored, not redefined; no second resolver).
// =================================================================
test('R1 — the indent magnitudes are identical in both directions (single geometry, mirrored)', async () => {
  const ltr = await probe('ltr');
  await clearProbe();
  const rtl = await probe('rtl');
  await clearProbe();

  // start-edge inset (left in LTR, right in RTL) is the same magnitude.
  expect(px(ltr.character.paddingLeft)).toBeCloseTo(px(rtl.character.paddingRight), 0);
  expect(px(ltr.parenthetical.paddingLeft)).toBeCloseTo(px(rtl.parenthetical.paddingRight), 0);
  expect(px(ltr.dialogue.paddingLeft)).toBeCloseTo(px(rtl.dialogue.paddingRight), 0);

  // transition: same logical end-alignment in both directions (one rule), and
  // it visually flips sides — anchored right in LTR, left in RTL.
  expect(ltr.transition.textAlign).toBe('end');
  expect(rtl.transition.textAlign).toBe('end');
  expect(ltr.transitionGeom.textCenterX).toBeGreaterThan(ltr.transitionGeom.blockCenterX);
  expect(rtl.transitionGeom.textCenterX).toBeLessThan(rtl.transitionGeom.blockCenterX);
});
