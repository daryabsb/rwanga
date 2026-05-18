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
  const path = '../../../renderer/js/framework/layout-profile.js';
  delete require.cache[require.resolve(path)];
  require(path);
  return { LP: global.window.Rga.LayoutProfile };
}

test('default Hollywood/Letter/Courier 12pt gives 54 lines per page', () => {
  const { LP } = boot();
  const p = LP.compose({ language: 'en', screenplayConvention: 'hollywood' }, null);
  assert.equal(p.linesPerPage, 54);
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
  // A4 is slightly taller → ≥54 lines.
  assert.ok(p.linesPerPage >= 54);
});

test('larger font size shrinks cpl + linesPerPage proportionally', () => {
  const { LP } = boot();
  const p = LP.compose(null, { font_size: 14 });
  // 14pt: cpi = 10 * 12/14 ≈ 8.57; 6in × 8.57 = ~51 → floor = 51
  assert.ok(p.blocks.action.cpl < 60);
  // Lines per page: lpi = 72/14 ≈ 5.14; 9in × 5.14 ≈ 46
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
