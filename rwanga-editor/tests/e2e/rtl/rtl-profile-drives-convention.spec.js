// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// S4.5 — SW-23 roll-up decisive test: the RTL PROFILE drives the convention,
// not a direction flag bolted onto a second layout model.
//
// Law: docs/Filmustageation/redesign_campaign/RTL_SCREENPLAY_CONVENTION.md
// Criteria: docs/plans/evidence/S4.1-rtl-qa-protocol.md §SW-23
//
// THE DECISIVE TEST (S4.1 §SW-23(b)): take a COPY of the RTL fixture, flip
// metadata.screenplayProfile.direction to 'ltr', and confirm the SAME
// magnitudes (2.0in cue / 1.5in parenthetical / 1.0in dialogue / flush action
// & heading / mirrored transition) come back as Hollywood-LEFT geometry —
// now measured from the LEFT edge instead of the right. This proves the
// mirror is a REFLECTION of one resolver, not a second implementation
// (RTL_SCREENPLAY_CONVENTION.md doctrine 4, Law 12).
//
// Also covers: the converse (the RTL copy, untouched, still mirrors from the
// right) and the masterplan's own ask — a BRAND NEW document authored with
// the Kurdish/RTL profile applies direction + conventions with zero manual
// tweaking (proving the profile, not fixture-specific state, drives it).
//
// FIXTURE LAW (masterplan §0.2): every document opened here is a %TEMP% copy
// (or a synthetic file written straight to %TEMP%). The tracked fixture
// tests/fixtures/mysterious-guest-rtl.rga is read once (to derive the
// LTR-flipped copy) and never opened directly, never written to.
'use strict';

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { closeApp } = require('../../helpers/app-teardown');

const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURE = path.resolve(APP_ROOT, 'tests', 'fixtures', 'mysterious-guest-rtl.rga');
const TOL_PX = 4;   // ~1mm at 96dpi, per S4.1 protocol §0.2

const EVIDENCE_DIR = process.env.RGA_S45_EVIDENCE
  ? path.resolve(APP_ROOT, '..', 'docs', 'plans', 'evidence')
  : null;

let app, page, userDataDir, workDir;

test.beforeEach(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-s45-'));
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwanga-s45-doc-'));
});

test.afterEach(async () => {
  if (app) { await closeApp(app); app = null; }
  for (const d of [userDataDir, workDir]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
  userDataDir = workDir = null;
});

async function shot(name) {
  if (!EVIDENCE_DIR) return;
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  try { await page.screenshot({ path: path.join(EVIDENCE_DIR, name) }); } catch (_) {}
}

async function launchAndOpen(filePath, expectNameFragment) {
  app = await electron.launch({ args: ['--user-data-dir=' + userDataDir, APP_ROOT] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(
    window.Rga && window.Rga.FileManager && window.Rga.FileManager.getActive
    && window.Rga.FileManager.getActive() && window.Rga.PrintPreview));

  await app.evaluate(({ dialog }, fp) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [fp] });
  }, filePath);
  await page.evaluate(() => window.Rga.FileManager.openFromDialog());
  await page.waitForFunction((frag) => {
    const d = window.Rga.FileManager.getActive();
    return !!(d && String(d.displayName || '').indexOf(frag) >= 0);
  }, expectNameFragment);
}

async function openPreview() {
  await page.evaluate(() => window.Rga.PrintPreview.open());
  await page.waitForFunction(() => window.Rga.PrintPreview.isActive() === true);
  await page.waitForFunction(() => document.querySelectorAll('.rga-page-sheet').length > 0);
  await page.waitForTimeout(600);
}

// Measures the Print Preview surface generically over the reading axis. Does
// NOT assume which physical side is "start" — the caller supplies `direction`
// and the assertions below resolve start/end padding from it. This is what
// makes the same measurement function usable for both the RTL original and
// the LTR-flipped copy: identical code path, only the expected physical edge
// differs, exactly as the single-resolver doctrine (Law 12) requires.
async function measurePrint() {
  return page.evaluate(() => {
    const TYPES = ['sceneHeading', 'action', 'character', 'parenthetical', 'dialogue', 'transition'];
    const out = { direction: null, sheets: 0, blocks: {} };
    const sheet = document.querySelector('.rga-page-sheet');
    out.direction = sheet ? getComputedStyle(sheet).direction : null;
    out.sheets = document.querySelectorAll('.rga-page-sheet').length;

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
          gapLeft: Math.round(text.left - box.left),
          gapRight: Math.round(box.right - text.right),
          sample: (el.textContent || '').slice(0, 40)
        };
      });
    });
    return out;
  });
}

// Reading-start padding, resolved for whichever physical direction the page
// actually rendered — RTL: padding comes in on the right; LTR: on the left.
function startPad(row, direction) {
  return direction === 'rtl' ? row.paddingRight : row.paddingLeft;
}
function endPad(row, direction) {
  return direction === 'rtl' ? row.paddingLeft : row.paddingRight;
}
// The gap between the text and the box's reading-END edge (where transitions
// must hug). RTL end = left; LTR end = right.
function endGap(row, direction) {
  return direction === 'rtl' ? row.gapLeft : row.gapRight;
}
function startGap(row, direction) {
  return direction === 'rtl' ? row.gapRight : row.gapLeft;
}

// The full SW-23(a)/(b) assertion set, parameterised by expected direction.
// Used identically for the RTL original AND the LTR-flipped copy — the same
// function proves the reflection because it asserts the SAME magnitudes
// against whichever edge `direction` says is "start".
function assertConventionGeometry(m, direction, tableOut) {
  expect(m.direction, 'the printed page direction must match the document profile').toBe(direction);
  expect(m.sheets, 'no print pages rendered').toBeGreaterThan(0);

  const expectations = {
    sceneHeading:  0,
    action:        0,
    character:     192,   // 2.0in
    parenthetical: 144,   // 1.5in
    dialogue:      96     // 1.0in
  };

  Object.entries(expectations).forEach(([type, expPad]) => {
    const rows = m.blocks[type];
    expect(rows.length, `no ${type} blocks found (direction=${direction})`).toBeGreaterThan(0);
    rows.forEach((r, i) => {
      const sp = startPad(r, direction);
      const ep = endPad(r, direction);
      expect(Math.abs(sp - expPad),
        `${type} #${i} ("${r.sample}") start-pad was ${sp}px, expected ${expPad}px `
        + `(direction=${direction})`).toBeLessThanOrEqual(TOL_PX);
      expect(ep, `${type} #${i} ("${r.sample}") must carry NO end-side padding `
        + `(${ep}px means the indent did not mirror; direction=${direction})`).toBeLessThanOrEqual(TOL_PX);
      if (tableOut) {
        tableOut.push({ direction, type, index: i, expectedIn: (expPad / 96).toFixed(2), measuredIn: (sp / 96).toFixed(3), deltaIn: Math.abs(sp - expPad) / 96 });
      }
    });
  });

  ['dialogue', 'parenthetical'].forEach((type) => {
    const px = parseFloat(m.blocks[type][0].maxWidth);
    expect(Math.abs(px - 336),
      `${type} box max-width was ${m.blocks[type][0].maxWidth}, expected 3.5in (336px) `
      + `(direction=${direction})`).toBeLessThanOrEqual(TOL_PX);
  });

  const transitions = m.blocks.transition;
  expect(transitions.length, `no transition blocks found (direction=${direction})`).toBeGreaterThan(0);
  transitions.forEach((r, i) => {
    const eg = endGap(r, direction);
    const sg = startGap(r, direction);
    expect(eg, `transition #${i} ("${r.sample}") must hug the reading-END edge; `
      + `endGap=${eg} startGap=${sg} (direction=${direction})`).toBeLessThan(sg);
    if (tableOut) {
      tableOut.push({ direction, type: 'transition', index: i, expectedIn: 'flush-end', measuredIn: `endGap=${eg}px`, deltaIn: null });
    }
  });

  expect(m.blocks.sceneHeading[0].fontWeight, `scene heading must be bold (direction=${direction})`)
    .toMatch(/^(bold|[6-9]00)$/);
}

// ---------------------------------------------------------------------------
// Test 1 (the decisive test) — LTR-flipped copy renders the SAME magnitudes
// as Hollywood-left geometry, measured from the LEFT edge.
// ---------------------------------------------------------------------------
test('SW-23(b) — flipping metadata.screenplayProfile.direction to ltr on a fixture copy restores Hollywood-LEFT geometry with the SAME magnitudes', async () => {
  const raw = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));   // read tracked fixture — never write back to it
  raw.metadata = raw.metadata || {};
  raw.metadata.screenplayProfile = Object.assign({}, raw.metadata.screenplayProfile, { direction: 'ltr' });
  const ltrCopy = path.join(workDir, 'mysterious-guest-ltr-flip.rga');
  fs.writeFileSync(ltrCopy, JSON.stringify(raw));

  await launchAndOpen(ltrCopy, 'mysterious');
  await openPreview();
  await shot('S4.5-ltr-flip-print.png');

  const m = await measurePrint();
  // eslint-disable-next-line no-console
  console.log('[S4.5 LTR-flip] ' + JSON.stringify({ direction: m.direction, sheets: m.sheets }));

  const table = [];
  assertConventionGeometry(m, 'ltr', table);
  // eslint-disable-next-line no-console
  console.log('[S4.5 LTR-flip table] ' + JSON.stringify(table));

  if (EVIDENCE_DIR) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'S4.5-ltr-flip-measurements.json'), JSON.stringify({ m, table }, null, 2));
  }
});

// ---------------------------------------------------------------------------
// Test 2 (the converse) — the RTL copy, direction UNCHANGED, still mirrors
// from the right exactly as S4.2 measured. Proves flipping the OTHER copy in
// test 1 did not somehow depend on shared/mutated state.
// ---------------------------------------------------------------------------
test('SW-23(b) converse — the same fixture with direction left at rtl still renders mirrored from the RIGHT (unchanged)', async () => {
  const rtlCopy = path.join(workDir, 'mysterious-guest-rtl-control.rga');
  fs.copyFileSync(FIXTURE, rtlCopy);   // §0.2 — copy only, direction untouched

  await launchAndOpen(rtlCopy, 'mysterious');
  await openPreview();
  await shot('S4.5-rtl-control-print.png');

  const m = await measurePrint();
  const table = [];
  assertConventionGeometry(m, 'rtl', table);
  // eslint-disable-next-line no-console
  console.log('[S4.5 RTL-control table] ' + JSON.stringify(table));

  if (EVIDENCE_DIR) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'S4.5-rtl-control-measurements.json'), JSON.stringify({ m, table }, null, 2));
  }
});

// ---------------------------------------------------------------------------
// Test 3 — a BRAND NEW document, authored fresh (not derived from the
// mysterious-guest fixture) with the Kurdish/RTL profile, applies direction +
// the full convention with ZERO manual tweaking. Proves the profile itself —
// not fixture-specific migration state — drives the geometry.
// ---------------------------------------------------------------------------
function buildNewKurdishDoc() {
  return {
    rga_version: '3.0',
    document_type: 'screenplay',
    metadata: {
      title: 'دۆکیومێنتی نوێ',
      author: 'S4.5',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: 1,
      revision_notes: '',
      screenplayProfile: { language: 'ku', direction: 'rtl', screenplayConvention: 'hollywood' },
      production_type: 'feature',
      genre: '',
      logline: '',
      useSchemaV3: true
    },
    settings: {
      theme: 'dark',
      font_size: 12,
      font_family: 'Courier Prime',
      show_scene_numbers: true,
      page_size: 'A4',
      pageSetup: { paperSize: 'A4', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } },
      sceneHeadingStyle: 'twoLine',
      units: 'in'
    },
    body: {
      type: 'doc',
      content: [
        {
          type: 'body',
          content: [
            {
              type: 'scene',
              attrs: { id: 'scene-001', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
              content: [
                {
                  type: 'sceneHeading',
                  attrs: { setting: 'ناوەوە', time: 'رۆژ', headingStyle: null },
                  content: [{ type: 'text', text: 'ماڵێکی نوێ' }]
                },
                {
                  type: 'action',
                  content: [{ type: 'text', text: 'ئەمە دیمەنێکی نوێیە کە بۆ تاقیکردنەوە نووسراوە.' }]
                },
                {
                  type: 'character',
                  content: [{ type: 'text', text: 'نوێژ' }]
                },
                {
                  type: 'parenthetical',
                  content: [{ type: 'text', text: '(بە هێمنی)' }]
                },
                {
                  type: 'dialogue',
                  content: [{ type: 'text', text: 'ئەمە قسەیەکی تاقیکارییە بۆ پشتڕاستکردنەوەی ڕێکخستنی دۆکیومێنتێکی نوێ.' }]
                },
                {
                  type: 'transition',
                  attrs: { presetType: 'CUT' },
                  content: [{ type: 'text', text: 'کات' }]
                }
              ]
            }
          ]
        }
      ]
    }
  };
}

test('SW-23 — a brand-new document authored with the Kurdish/RTL profile applies direction + convention with no manual tweaking', async () => {
  const newDocPath = path.join(workDir, 'new-kurdish-doc.rga');
  fs.writeFileSync(newDocPath, JSON.stringify(buildNewKurdishDoc()));

  await launchAndOpen(newDocPath, 'new-kurdish-doc');
  await openPreview();
  await shot('S4.5-new-doc-print.png');

  const m = await measurePrint();
  const table = [];
  assertConventionGeometry(m, 'rtl', table);
  // eslint-disable-next-line no-console
  console.log('[S4.5 new-doc table] ' + JSON.stringify(table));

  if (EVIDENCE_DIR) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'S4.5-new-doc-measurements.json'), JSON.stringify({ m, table }, null, 2));
  }
});
