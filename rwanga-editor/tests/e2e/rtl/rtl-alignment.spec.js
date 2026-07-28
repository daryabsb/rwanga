// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// S4.2 — RTL editor alignment sweep (RTL-04 … RTL-09).
//
// Judged against the ratified law:
//   docs/Filmustageation/redesign_campaign/RTL_SCREENPLAY_CONVENTION.md
// Criteria (per-ID, measurable):
//   docs/plans/evidence/S4.1-rtl-qa-protocol.md
//
// TWO SURFACES, TWO TRUTHS (protocol §0 — read it before changing this file):
//   * PRINT PREVIEW carries the full law: the 2.0in / 1.5in / 1.0in indent
//     magnitudes, measured from the READING-START edge (right, in RTL).
//   * FLOW carries direction only. Flow is a continuous drafting surface by
//     locked doctrine and deliberately CENTRES character/dialogue/parenthetical
//     (editor-prosemirror.css:1145-1162). Asserting print indents against Flow
//     would manufacture reds and invite a "fix" that breaks the Flow doctrine.
//
// This is the REAL pipeline over the REAL fixture — a Kurdish feature with 47
// scenes — not a synthetic probe. (tests/e2e/filmustageation/rtl-print-block-
// mirror.spec.js already proves the CSS in isolation; this proves the document
// a writer actually opens.)
//
// FIXTURE LAW (masterplan §0.2): the app auto-migrates any fixture it opens, so
// this spec copies mysterious-guest-rtl.rga to %TEMP% and opens the COPY. The
// tracked fixture is never touched.
//
// 1in == 96 CSS px. 2.0in=192px, 1.5in=144px, 1.0in=96px, 3.5in=336px.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { closeApp } = require('../../helpers/app-teardown');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURE = path.resolve(APP_ROOT, 'tests', 'fixtures', 'mysterious-guest-rtl.rga');
const TOL_PX = 4;              // ~1mm at 96dpi

// Evidence capture is opt-in so the suite never writes into docs/ on a normal
// run: set RGA_S42_EVIDENCE=1 to drop the S4.2 screenshots next to the
// evidence file. The measurements above are the verdict; the images illustrate.
const EVIDENCE_DIR = process.env.RGA_S42_EVIDENCE
  ? path.resolve(APP_ROOT, '..', 'docs', 'plans', 'evidence')
  : null;
// Capture the VIEWPORT, not the element: an element screenshot of a page sheet
// that is wider than the scroll container comes back cropped, which reads as
// "text clipped at the margin" when nothing is wrong. The measurements are the
// verdict; a misleading image is worse than no image.
async function shot(name) {
  if (!EVIDENCE_DIR) return;
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  try { await page.screenshot({ path: path.join(EVIDENCE_DIR, name) }); } catch (_) {}
}

let app, page, userDataDir, workDir, fixtureCopy;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-s42-'));
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-s42-doc-'));
  fixtureCopy = path.join(workDir, 'mysterious-guest-rtl.rga');
  fs.copyFileSync(FIXTURE, fixtureCopy);   // §0.2 — open the COPY, never the tracked file

  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.FileManager && window.Rga.FileManager.getActive
    && window.Rga.FileManager.getActive() && window.Rga.PrintPreview));

  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  }, fixtureCopy);
  await page.evaluate(() => window.Rga.FileManager.openFromDialog());
  await page.waitForFunction(() => {
    const d = window.Rga.FileManager.getActive();
    return !!(d && String(d.displayName || '').indexOf('mysterious') >= 0);
  });
});

test.afterEach(async () => {
  if (app) { await closeApp(app); app = null; }
  for (const d of [userDataDir, workDir]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
  userDataDir = workDir = null;
});

// ---------------------------------------------------------------------------
// PRINT PREVIEW — the full law (RTL-04 … RTL-09 page truth)
// ---------------------------------------------------------------------------

// Sample the real rendered print blocks. For each type we read the RESOLVED
// physical padding (padding-inline-start resolves to padding-right under RTL)
// and, for edge-aligned blocks, where the text actually lands inside its box.
async function measurePrint() {
  return page.evaluate(() => {
    const TYPES = ['sceneHeading', 'action', 'character', 'parenthetical', 'dialogue', 'transition'];
    const out = { direction: null, sheets: 0, blocks: {} };

    const sheet = document.querySelector('.rga-page-sheet');
    out.direction = sheet ? getComputedStyle(sheet).direction : null;
    out.sheets = document.querySelectorAll('.rga-page-sheet').length;

    // Page-level containment (RTL-10 groundwork): the sheet's CONTENT box is
    // the printable area; nothing may render outside it on either edge.
    const content = document.querySelector('.rga-page-sheet-content');
    if (content) {
      const cr = content.getBoundingClientRect();
      const cs = getComputedStyle(content);
      out.contentBox = {
        left: Math.round(cr.left), right: Math.round(cr.right), width: Math.round(cr.width),
        padLeft: cs.paddingLeft, padRight: cs.paddingRight
      };
      const sr = sheet.getBoundingClientRect();
      out.sheetBox = { left: Math.round(sr.left), right: Math.round(sr.right), width: Math.round(sr.width) };
      out.escapes = [];
      Array.from(content.querySelectorAll('.rga-print-block')).slice(0, 200).forEach((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const t = range.getBoundingClientRect();
        if (t.width === 0) return;
        const overLeft  = Math.round(cr.left - t.left);
        const overRight = Math.round(t.right - cr.right);
        if (overLeft > 1 || overRight > 1) {
          out.escapes.push({
            type: el.getAttribute('data-block-type') || el.className,
            overLeft, overRight, sample: (el.textContent || '').slice(0, 30)
          });
        }
      });
    }

    TYPES.forEach((type) => {
      const els = Array.from(document.querySelectorAll('.rga-print-block-' + type)).slice(0, 12);
      out.blocks[type] = els.map((el) => {
        const cs = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(el);
        const text = range.getBoundingClientRect();
        return {
          paddingLeft: parseFloat(cs.paddingLeft),
          paddingRight: parseFloat(cs.paddingRight),
          maxWidth: cs.maxWidth,
          fontWeight: cs.fontWeight,
          textTransform: cs.textTransform,
          // clipping check (RTL-10 groundwork): content must fit its box
          overflowsBox: el.scrollWidth > el.clientWidth + 1,
          // which edge the text hugs inside its own box
          gapLeft: Math.round(text.left - box.left),
          gapRight: Math.round(box.right - text.right),
          sample: (el.textContent || '').slice(0, 40)
        };
      });
    });
    return out;
  });
}

test('RTL-04..RTL-09 (Print Preview) — the real RTL fixture renders as the mirrored Hollywood page', async () => {
  await page.evaluate(() => window.Rga.PrintPreview.open());
  await page.waitForFunction(() => window.Rga.PrintPreview.isActive() === true);
  await page.waitForFunction(() => document.querySelectorAll('.rga-page-sheet').length > 0);
  await page.waitForTimeout(600);   // let pagination settle

  await shot('S4.2-rtl-print-page.png');

  const m = await measurePrint();
  // eslint-disable-next-line no-console
  console.log('[S4.2 print] ' + JSON.stringify({
    direction: m.direction, sheets: m.sheets,
    counts: Object.fromEntries(Object.keys(m.blocks).map((k) => [k, m.blocks[k].length])),
    first: Object.fromEntries(Object.keys(m.blocks).map((k) => [k, m.blocks[k][0] || null]))
  }));

  // eslint-disable-next-line no-console
  console.log('[S4.2 containment] ' + JSON.stringify({
    sheetBox: m.sheetBox, contentBox: m.contentBox,
    escapeCount: (m.escapes || []).length, escapes: (m.escapes || []).slice(0, 5)
  }));

  expect(m.direction, 'the printed page must render right-to-left').toBe('rtl');
  expect(m.sheets, 'no print pages rendered').toBeGreaterThan(0);

  // Every indent is measured from the READING-START edge, which under RTL is
  // the right edge — so padding-inline-start resolves to padding-RIGHT.
  const expectations = {
    sceneHeading:  { startPad: 0,   label: 'RTL-09 scene heading — flush to reading-start' },
    action:        { startPad: 0,   label: 'RTL-04 action — flush to reading-start, full body width' },
    character:     { startPad: 192, label: 'RTL-06 character cue — 2.0in inward from reading-start' },
    parenthetical: { startPad: 144, label: 'RTL-07 parenthetical — 1.5in inward from reading-start' },
    dialogue:      { startPad: 96,  label: 'RTL-05 dialogue — 1.0in inward from reading-start' }
  };

  for (const [type, exp] of Object.entries(expectations)) {
    const rows = m.blocks[type];
    expect(rows.length, `${exp.label}: no ${type} blocks found in the rendered page`).toBeGreaterThan(0);
    rows.forEach((r, i) => {
      expect(Math.abs(r.paddingRight - exp.startPad),
        `${exp.label} — block #${i} ("${r.sample}") padding from the RIGHT (reading-start) edge `
        + `was ${r.paddingRight}px, expected ${exp.startPad}px`).toBeLessThanOrEqual(TOL_PX);
      expect(r.paddingLeft,
        `${exp.label} — block #${i} must carry NO padding on the reading-END (left) edge; `
        + `${r.paddingLeft}px means the indent did not mirror`).toBeLessThanOrEqual(TOL_PX);
    });
  }

  // Dialogue + parenthetical keep the 3.5in box (text columns 2.5in / 2.0in).
  ['dialogue', 'parenthetical'].forEach((type) => {
    const px = parseFloat(m.blocks[type][0].maxWidth);
    expect(Math.abs(px - 336),
      `${type} box max-width was ${m.blocks[type][0].maxWidth}, expected 3.5in (336px)`)
      .toBeLessThanOrEqual(TOL_PX);
  });

  // RTL-08: the transition mirrors to the reading-END edge, i.e. the LEFT.
  const transitions = m.blocks.transition;
  expect(transitions.length, 'RTL-08: no transition blocks found').toBeGreaterThan(0);
  transitions.forEach((r, i) => {
    expect(r.gapLeft,
      `RTL-08 — transition #${i} ("${r.sample}") must hug the reading-END (LEFT) edge; `
      + `gapLeft=${r.gapLeft}px gapRight=${r.gapRight}px — a smaller gapRight means it stayed `
      + `on the reading-start side`).toBeLessThan(r.gapRight);
  });

  // RTL-09: the slug is bold + uppercase-transformed (convention: "bold; UPPERCASE").
  expect(m.blocks.sceneHeading[0].fontWeight, 'RTL-09 scene heading must be bold')
    .toMatch(/^(bold|[6-9]00)$/);

  // Groundwork for RTL-10: nothing may overflow its own box.
  Object.entries(m.blocks).forEach(([type, rows]) => {
    rows.forEach((r, i) => {
      expect(r.overflowsBox, `${type} block #${i} ("${r.sample}") overflows its box — clipping risk`)
        .toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// FLOW — direction only (protocol §0)
// ---------------------------------------------------------------------------

test('RTL-04..RTL-09 (Flow) — the drafting surface mirrors direction without borrowing print indents', async () => {
  const m = await page.evaluate(() => {
    const read = (sel) => {
      const els = Array.from(document.querySelectorAll(sel)).slice(0, 8);
      return els.map((el) => {
        const cs = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(el);
        const text = range.getBoundingClientRect();
        return {
          direction: cs.direction,
          textAlign: cs.textAlign,
          gapLeft: Math.round(text.left - box.left),
          gapRight: Math.round(box.right - text.right),
          width: Math.round(box.width),
          sample: (el.textContent || '').slice(0, 32)
        };
      });
    };
    const editor = document.querySelector('#editor');
    return {
      editorDirection: editor ? getComputedStyle(editor).direction : null,
      action:        read('.rga-block-action'),
      character:     read('.rga-block-character'),
      dialogue:      read('.rga-block-dialogue'),
      parenthetical: read('.rga-block-parenthetical'),
      transition:    read('.rga-block-transition')
    };
  });
  // eslint-disable-next-line no-console
  console.log('[S4.2 flow] ' + JSON.stringify({
    editorDirection: m.editorDirection,
    first: Object.fromEntries(['action', 'character', 'dialogue', 'parenthetical', 'transition']
      .map((k) => [k, m[k][0] || null]))
  }));

  await shot('S4.2-rtl-flow-blocks.png');

  expect(m.editorDirection, 'Flow must render the RTL document right-to-left').toBe('rtl');

  // Action hugs the reading-START edge (right) — text-align:start under RTL.
  expect(m.action.length, 'no action blocks in Flow').toBeGreaterThan(0);
  m.action.forEach((r, i) => {
    expect(r.gapRight,
      `RTL-04 (Flow) — action #${i} ("${r.sample}") must hug the reading-start (RIGHT) edge; `
      + `gapLeft=${r.gapLeft} gapRight=${r.gapRight}`).toBeLessThanOrEqual(r.gapLeft);
  });

  // Transition hugs the reading-END edge (left) — text-align:end under RTL.
  expect(m.transition.length, 'no transition blocks in Flow').toBeGreaterThan(0);
  m.transition.forEach((r, i) => {
    expect(r.gapLeft,
      `RTL-08 (Flow) — transition #${i} ("${r.sample}") must hug the reading-end (LEFT) edge; `
      + `gapLeft=${r.gapLeft} gapRight=${r.gapRight}`).toBeLessThanOrEqual(r.gapRight);
  });

  // Dialogue / parenthetical / character stay SYMMETRIC in Flow — that is the
  // Flow doctrine, not a defect. A collapse to one side is the real failure.
  ['dialogue', 'parenthetical'].forEach((type) => {
    expect(m[type].length, `no ${type} blocks in Flow`).toBeGreaterThan(0);
    m[type].forEach((r, i) => {
      expect(Math.abs(r.gapLeft - r.gapRight),
        `${type} #${i} ("${r.sample}") must stay centred in Flow (continuous-drafting doctrine); `
        + `gapLeft=${r.gapLeft} gapRight=${r.gapRight}`).toBeLessThanOrEqual(6);
    });
  });
});
