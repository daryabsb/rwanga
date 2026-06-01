// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Density Slice 7 — atomic RTL profile calibration.
//
// Slice 4 found PageMap's content-line model mis-calibrated for the ratified
// Kurdish/RTL profile (Rule 10): `_charsPerInch` assumes Courier 10 cpi while
// the truth surface renders Noto Naskh, and `blockWidthsIn.dialogue` (3.5in)
// does not match the truth-surface CSS column (2.5in). Slice 7 corrects BOTH
// atomically in `layout-profile.js` — cpi and widths together (Slice 4 proved
// either constant alone regresses the document total).
//
// Derivation — no fixture-only constants:
//  - RTL cpi 14.5 = the measured Noto Naskh line capacity (Density Slice 4/7
//    line-capacity forensic — median of action 14.1 / parenthetical 14.5 /
//    dialogue 15.5 cpi). A font metric, not a per-manuscript number.
//  - blockWidthsIn.dialogue 2.5in = the truth-surface CSS column
//    (`.rga-print-block-dialogue` max-width 3.5in − padding-left 1.0in).
//
// Success metric: PageMap predicted ≈ Paper-truth rendered lines — NOT any
// "71 → X pages" target. The rendered baseline below is the truth surface
// measured by the paper-truth probe (paper-truth-report.md, post Slice 6);
// the real-render re-confirmation is the probe rerun.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RJS = path.resolve(__dirname, '../../../renderer/js');
const FIXTURE = path.resolve(__dirname, '../../fixtures/mysterious-guest-rtl.rga');

// Paper-truth rendered content lines per type — measured by the paper-truth
// probe on the Fork A truth surface (paper-truth-report.md, post Slice 6).
// This is the calibration TARGET: PageMap predicted should ≈ these.
const RENDERED = {
  action: 885, dialogue: 937, parenthetical: 90,
  character: 434, sceneHeading: 47, transition: 44
};
// Pre-Slice-7 PageMap predicted (cpi 10, dialogue width 3.5) — the regression
// baseline for "no type may worsen" (same probe report).
const PRE_SLICE7_PREDICTED = {
  action: 1163, dialogue: 974, parenthetical: 104,
  character: 434, sceneHeading: 47, transition: 44
};
const TYPES = ['action', 'dialogue', 'parenthetical', 'character', 'sceneHeading', 'transition'];

// Run the real pipeline (.rga → schema-v3 → Normalizer → LayoutProfile →
// PageMap.measureBlock) and sum PREDICTED content lines per type. Content
// lines only — measureBlock(..., isFirstOnPage=true) excludes the leading
// blank, exactly as the rendered baseline excludes block margins.
function predictedByType() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  global.window.RgaProseMirror = {
    Schema: require(path.resolve(__dirname, '../../../node_modules/prosemirror-model')).Schema
  };
  ['constants.js', 'framework/base-outer-marks.js', 'doc-types/screenplay/schema-v3.js',
   'framework/slug-resolver.js',
   'framework/layout-profile.js', 'framework/pagemap-engine.js',
   'framework/screenplay-normalizer.js'].forEach(function (rel) {
    const p = path.join(RJS, rel);
    delete require.cache[require.resolve(p)];
    require(p);
  });
  const Rga = global.window.Rga;
  const parsed = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const doc = Rga.DocTypes.screenplay.buildSchemaV3().nodeFromJSON(parsed.body);
  const blocks = Rga.Normalizer.normalize(doc);
  const profile = Rga.LayoutProfile.compose(parsed.metadata.screenplayProfile, parsed.settings);
  const out = {};
  blocks.forEach(function (b) {
    out[b.nodeType] = (out[b.nodeType] || 0) + Rga.PageMap.measureBlock(b, profile, true);
  });
  return out;
}

function bootLayoutProfile() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  ['constants.js', 'framework/layout-profile.js'].forEach(function (rel) {
    const p = path.join(RJS, rel);
    delete require.cache[require.resolve(p)];
    require(p);
  });
  return global.window.Rga.LayoutProfile;
}

test('Slice 7 — per-type prediction accuracy: PageMap predicted ≈ Paper-truth rendered', () => {
  // RED before calibration: action 1163/885 = 1.31× and parenthetical
  // 104/90 = 1.16× exceed the ±12% accuracy bar.
  const predicted = predictedByType();
  TYPES.forEach(function (t) {
    const ratio = predicted[t] / RENDERED[t];
    assert.ok(Math.abs(ratio - 1) <= 0.12,
      t + ': PageMap predicted ' + predicted[t] + ' vs Paper-truth rendered ' + RENDERED[t] +
      ' = ' + ratio.toFixed(3) + '× — outside the ±12% accuracy bar');
  });
});

test('Slice 7 — regression: no type worsens beyond its pre-Slice-7 error', () => {
  const predicted = predictedByType();
  TYPES.forEach(function (t) {
    const before = Math.abs(PRE_SLICE7_PREDICTED[t] / RENDERED[t] - 1);
    const after  = Math.abs(predicted[t] / RENDERED[t] - 1);
    assert.ok(after <= before + 1e-9,
      t + ': error worsened — pre-Slice-7 ' + before.toFixed(3) + ', now ' + after.toFixed(3));
  });
});

test('Slice 7 — the calibration is atomic and derived (cpi + widths move together)', () => {
  // Both knobs must move — cpi alone or widths alone is forbidden (Slice 4
  // proved each in isolation regresses the document total).
  const LP = bootLayoutProfile();
  assert.equal(LP._charsPerInch(12, 'rtl'), 14.5,
    'RTL cpi must be the measured Noto Naskh capacity (14.5 cpi at 12pt)');
  assert.equal(LP._charsPerInch(12, 'ltr'), 10,
    'LTR cpi must stay Courier 10 cpi — the Hollywood profile is untouched');
  assert.equal(LP._charsPerInch(12), 10,
    'no direction → LTR/Courier (backward-compatible default)');
  assert.equal(LP._HOLLYWOOD_DEFAULTS.blockWidthsIn.dialogue, 2.5,
    'dialogue column must be the truth-surface CSS width (2.5in), not the 3.5in nominal');
});
