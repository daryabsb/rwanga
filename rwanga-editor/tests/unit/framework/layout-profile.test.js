// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 6 — LayoutProfile composer tests.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  // Recovery Step 3: layout-profile.js's _resolvePageSize reads
  // Rga.Constants.PAPER_SIZES, so constants.js must load first.
  const cPath  = '../../../renderer/js/constants.js';
  const lpPath = '../../../renderer/js/framework/layout-profile.js';
  delete require.cache[require.resolve(cPath)];
  delete require.cache[require.resolve(lpPath)];
  require(cPath);
  require(lpPath);
  return { LP: global.window.Rga.LayoutProfile, Constants: global.window.Rga.Constants };
}

test('default Hollywood/Letter/Courier 12pt: linesPerPage=53, theoreticalLinesPerPage=54, safetyLines=1', () => {
  // UPDATED 2026-05-19: linesPerPage was 54 before the P0 bottom-safety-reserve
  // change. compose() now subtracts SAFETY_LINES (1) from the theoretical budget,
  // giving 53. Both values are surfaced on the profile for transparency.
  const { LP } = boot();
  const p = LP.compose({ language: 'en', screenplayConvention: 'hollywood' }, null);
  assert.equal(p.linesPerPage, 53,                  'linesPerPage must be 53 (theoretical 54 - safety 1)');
  assert.equal(p.theoreticalLinesPerPage, 54,        'theoreticalLinesPerPage must be 54 (pure-math budget)');
  assert.equal(p.safetyLines, 1,                     'safetyLines must be 1 (the reserve constant)');
  assert.equal(p.pageSize.w, 8.5);
  assert.equal(p.pageSize.h, 11.0);
  assert.equal(p.font.family, 'Courier');
  assert.equal(p.font.sizePt, 12);
});

test('action / sceneHeading / shot / paragraph / heading have cpl=60 (6.0in × 10cpi)', () => {
  const { LP } = boot();
  const p = LP.compose(null, null);
  ['action','sceneHeading','shot','paragraph','heading'].forEach(function(t) {
    assert.equal(p.blocks[t].cpl, 60, t + ' cpl');
  });
});

test('dialogue cpl=35; character cpl=35; parenthetical cpl=20', () => {
  const { LP } = boot();
  const p = LP.compose(null, null);
  assert.equal(p.blocks.dialogue.cpl, 35);
  assert.equal(p.blocks.character.cpl, 35);
  assert.equal(p.blocks.parenthetical.cpl, 20);
});

test('sceneHeading + character carry keepWithNext=true; others false', () => {
  const { LP } = boot();
  const p = LP.compose(null, null);
  assert.equal(p.blocks.sceneHeading.keepWithNext, true);
  assert.equal(p.blocks.character.keepWithNext, true);
  ['action','dialogue','parenthetical','shot','transition','paragraph','heading']
    .forEach(function(t) { assert.equal(p.blocks[t].keepWithNext, false, t); });
});

test('leadingBlankLines defaults: sceneHeading/action/character/shot/transition/paragraph/heading=1; parenthetical/dialogue=0', () => {
  const { LP } = boot();
  const p = LP.compose(null, null);
  assert.equal(p.blocks.sceneHeading.leadingBlankLines,  1);
  assert.equal(p.blocks.action.leadingBlankLines,        1);
  assert.equal(p.blocks.character.leadingBlankLines,     1);
  assert.equal(p.blocks.parenthetical.leadingBlankLines, 0);
  assert.equal(p.blocks.dialogue.leadingBlankLines,      0);
  assert.equal(p.blocks.shot.leadingBlankLines,          1);
  assert.equal(p.blocks.transition.leadingBlankLines,    1);
});

test('A4 paper composes correctly (action cpl clamped by narrower usable width)', () => {
  const { LP } = boot();
  const p = LP.compose(null, { pageSetup: { size: 'A4', margins: { top: 1, bottom: 1, left: 1.5, right: 1, unit: 'in' } } });
  assert.ok(Math.abs(p.pageSize.w - 8.2677) < 0.01);
  assert.ok(Math.abs(p.pageSize.h - 11.6929) < 0.01);
  // A4 usable width = 8.27 - 2.5 = ~5.77in → clamps 6.0in action col to 5.77 → cpl ~ 57.
  // (Letter would give 60.) Either way the value reflects actual paper, not DOM measure.
  assert.ok(p.blocks.action.cpl < 60);
  assert.ok(p.blocks.action.cpl > 50);
  // A4 is slightly taller → theoretical=58, after safety reserve actual=57 ≥ 54.
  assert.ok(p.linesPerPage >= 54);
});

test('larger font size shrinks cpl + linesPerPage proportionally', () => {
  const { LP } = boot();
  const p = LP.compose(null, { font_size: 14 });
  // 14pt: cpi = 10 * 12/14 ≈ 8.57; 6in × 8.57 = ~51 → floor = 51
  assert.ok(p.blocks.action.cpl < 60);
  // Lines per page: lpi = 72/14 ≈ 5.14; 9in × 5.14 ≈ 46 theoretical, minus safety → 45 < 53.
  assert.ok(p.linesPerPage < 54);
});

test('compose is pure / repeatable — same inputs give equal output', () => {
  const { LP } = boot();
  const a = LP.compose(null, null);
  const b = LP.compose(null, null);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('sceneHeading carries separator strings (setting↔location, location↔time) — overrideable per convention', () => {
  const { LP } = boot();
  const p = LP.compose(null, null);
  assert.ok(p.blocks.sceneHeading.separators, 'separators present');
  assert.equal(p.blocks.sceneHeading.separators.settingLocation, ' ');
  assert.equal(p.blocks.sceneHeading.separators.locationTime, ' — ');
});

// ----------------------------------------------------------------
// SP-19 fix — paperSize is canonical; size accepted as legacy alias
// ----------------------------------------------------------------

test('SP-19: paperSize field resolves paper dimensions (canonical path)', () => {
  // FAILS before fix: _resolvePageSize read ps.size, ignoring ps.paperSize.
  // PASSES after fix: ps.paperSize is read first as the canonical field.
  const { LP } = boot();
  const p = LP.compose(null, { pageSetup: { paperSize: 'A4', margins: { top: 1, bottom: 1, left: 1.5, right: 1, unit: 'in' } } });
  assert.ok(Math.abs(p.pageSize.w - 8.2677) < 0.01,
    'A4 width via paperSize: expected ~8.2677, got ' + p.pageSize.w);
  assert.ok(Math.abs(p.pageSize.h - 11.6929) < 0.01,
    'A4 height via paperSize: expected ~11.6929, got ' + p.pageSize.h);
});

test('SP-19: legacy size field still resolves paper dimensions (backward compat for v2 docs)', () => {
  // Regression guard: old v2 docs may still carry { size: 'A4' }.
  // The fix adds ps.size as a fallback alias, so existing docs keep working.
  const { LP } = boot();
  const p = LP.compose(null, { pageSetup: { size: 'A4', margins: { top: 1, bottom: 1, left: 1.5, right: 1, unit: 'in' } } });
  assert.ok(Math.abs(p.pageSize.w - 8.2677) < 0.01,
    'A4 width via legacy size: expected ~8.2677, got ' + p.pageSize.w);
  assert.ok(Math.abs(p.pageSize.h - 11.6929) < 0.01,
    'A4 height via legacy size: expected ~11.6929, got ' + p.pageSize.h);
});

test('SP-19: paperSize takes precedence over legacy size when both present', () => {
  // If a doc somehow has both fields, paperSize wins (it is canonical).
  const { LP } = boot();
  const p = LP.compose(null, { pageSetup: { paperSize: 'Letter', size: 'A4', margins: { top: 1, bottom: 1, left: 1.5, right: 1, unit: 'in' } } });
  // Letter: 8.5 × 11.0
  assert.ok(Math.abs(p.pageSize.w - 8.5) < 0.01,
    'Letter width must win when paperSize=Letter overrides size=A4; got ' + p.pageSize.w);
  assert.ok(Math.abs(p.pageSize.h - 11.0) < 0.01,
    'Letter height must win when paperSize=Letter overrides size=A4; got ' + p.pageSize.h);
});

// ================================================================
// P0 — Safety reserve: compose() subtracts SAFETY_LINES (Test 3)
// ================================================================

test('P0.3 safety reserve: Letter Hollywood → linesPerPage=53, theoreticalLinesPerPage=54, safetyLines=1', () => {
  // Explicit per-paper-size assertions from the P0 brief.
  // Letter: usable = 11 - 1 - 1 = 9in; 9in × 6lpi = 54 theoretical → 53 after reserve.
  const { LP } = boot();
  const p = LP.compose({ language: 'en' }, { pageSetup: { paperSize: 'Letter', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } } });
  assert.equal(p.linesPerPage, 53,                   'Letter linesPerPage must be 53');
  assert.equal(p.theoreticalLinesPerPage, 54,         'Letter theoreticalLinesPerPage must be 54');
  assert.equal(p.safetyLines, 1,                      'safetyLines must be 1');
});

test('P0.3 safety reserve: A4 Hollywood → linesPerPage=57, theoreticalLinesPerPage=58, safetyLines=1', () => {
  // A4: usable = 11.6929 - 1 - 1 = 9.6929in; 9.6929in × 6lpi = 58.157 → floor = 58 → minus 1 = 57.
  const { LP } = boot();
  const p = LP.compose({ language: 'en' }, { pageSetup: { paperSize: 'A4', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } } });
  assert.equal(p.linesPerPage, 57,                    'A4 linesPerPage must be 57');
  assert.equal(p.theoreticalLinesPerPage, 58,          'A4 theoreticalLinesPerPage must be 58');
  assert.equal(p.safetyLines, 1,                       'safetyLines must be 1');
});

test('P0.3 safety reserve: Legal Hollywood → linesPerPage=71, theoreticalLinesPerPage=72, safetyLines=1', () => {
  // Legal: usable = 14 - 1 - 1 = 12in; 12in × 6lpi = 72 theoretical → 71 after reserve.
  const { LP } = boot();
  const p = LP.compose({ language: 'en' }, { pageSetup: { paperSize: 'Legal', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } } });
  assert.equal(p.linesPerPage, 71,                    'Legal linesPerPage must be 71');
  assert.equal(p.theoreticalLinesPerPage, 72,          'Legal theoreticalLinesPerPage must be 72');
  assert.equal(p.safetyLines, 1,                       'safetyLines must be 1');
});

// ================================================================
// Recovery Step 1 — Constants.PAPER_SIZES and LayoutProfile must
// agree on paper dimensions. Before Step 1 constants.js declared A4
// as 8.27 × 11.69 (2dp) while LayoutProfile used 8.2677 × 11.6929;
// PageSurface read the former, PageMap the latter, so the visual
// page and the paginated content disagreed about A4 by ~0.06mm.
// (After Step 3 the agreement is structural — LayoutProfile reads
// the Constants table directly — but this stays as a regression guard.)
// ================================================================

test('Recovery Step 1: Constants.PAPER_SIZES agrees with LayoutProfile pageSize for every paper', () => {
  const { Constants, LP } = boot();
  ['Letter', 'A4', 'Legal'].forEach(function(name) {
    const c = Constants.PAPER_SIZES[name];
    const p = LP.compose(null, { pageSetup: { paperSize: name, margins: { top: 1, bottom: 1, left: 1.5, right: 1, unit: 'in' } } });
    assert.equal(p.pageSize.w, c.width,  name + ' width: Constants (' + c.width + ') must equal LayoutProfile (' + p.pageSize.w + ')');
    assert.equal(p.pageSize.h, c.height, name + ' height: Constants (' + c.height + ') must equal LayoutProfile (' + p.pageSize.h + ')');
  });
});

test('Recovery Step 1: A4 in Constants.PAPER_SIZES matches ISO 216 (210mm × 297mm)', () => {
  const { Constants } = boot();
  const A4 = Constants.PAPER_SIZES.A4;
  assert.equal(A4.width,  8.2677,  'A4 width must be 210/25.4 to 4dp = 8.2677');
  assert.equal(A4.height, 11.6929, 'A4 height must be 297/25.4 to 4dp = 11.6929');
  assert.ok(Math.abs(A4.width  - 210 / 25.4) < 0.0001, 'A4 width within 0.0001in of 210mm');
  assert.ok(Math.abs(A4.height - 297 / 25.4) < 0.0001, 'A4 height within 0.0001in of 297mm');
});

// ================================================================
// Recovery Step 3 — _resolvePageSize reads from Constants.PAPER_SIZES.
// LayoutProfile no longer carries its own Letter/A4/Legal table;
// Constants.PAPER_SIZES is the single paper-size source.
// ================================================================

test('Recovery Step 3: LayoutProfile pageSize is sourced from Constants.PAPER_SIZES for Letter/A4/Legal', () => {
  const { LP, Constants } = boot();
  ['Letter', 'A4', 'Legal'].forEach(function(name) {
    const c = Constants.PAPER_SIZES[name];
    const p = LP.compose(null, { pageSetup: { paperSize: name, margins: { top: 1, bottom: 1, left: 1.5, right: 1 } } });
    assert.equal(p.pageSize.w, c.width,  name + ' width must come from Constants.PAPER_SIZES');
    assert.equal(p.pageSize.h, c.height, name + ' height must come from Constants.PAPER_SIZES');
    assert.equal(p.pageSize.unit, 'in');
  });
});

test('Recovery Step 3: paperSize remains the canonical field (wins over legacy size)', () => {
  const { LP, Constants } = boot();
  const p = LP.compose(null, { pageSetup: { paperSize: 'Letter', size: 'A4', margins: { top: 1, bottom: 1, left: 1.5, right: 1 } } });
  assert.equal(p.pageSize.w, Constants.PAPER_SIZES.Letter.width,  'paperSize=Letter must win over size=A4');
  assert.equal(p.pageSize.h, Constants.PAPER_SIZES.Letter.height);
});

test('Recovery Step 3: legacy `size` field still resolves via Constants.PAPER_SIZES', () => {
  const { LP, Constants } = boot();
  const p = LP.compose(null, { pageSetup: { size: 'A4', margins: { top: 1, bottom: 1, left: 1.5, right: 1 } } });
  assert.equal(p.pageSize.w, Constants.PAPER_SIZES.A4.width,  'legacy size=A4 must still resolve');
  assert.equal(p.pageSize.h, Constants.PAPER_SIZES.A4.height);
});

test('Recovery Step 3: unknown paper size falls back to the Hollywood default page size', () => {
  const { LP } = boot();
  const def = LP._HOLLYWOOD_DEFAULTS.pageSize;
  // 'Tabloid' is not a key in Constants.PAPER_SIZES → _resolvePageSize returns
  // null → compose() uses HOLLYWOOD_DEFAULTS.pageSize, exactly as before.
  const p = LP.compose(null, { pageSetup: { paperSize: 'Tabloid', margins: { top: 1, bottom: 1, left: 1.5, right: 1 } } });
  assert.equal(p.pageSize.w, def.w, 'unknown paper width falls back to Hollywood default');
  assert.equal(p.pageSize.h, def.h, 'unknown paper height falls back to Hollywood default');
});
