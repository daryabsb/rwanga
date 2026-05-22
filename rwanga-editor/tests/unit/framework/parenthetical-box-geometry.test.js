// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Density Slice 6 — parenthetical print-block geometry.
//
// Under the ratified Kurdish/RTL screenplay profile (Option C, Rule 10) the
// Paper truth surface and PageMap must agree on ONE profile geometry.
//
// Slices 4/5 found `.rga-print-block-parenthetical` renders only a 0.50in
// text column: `reset.css` sets a global `box-sizing: border-box`, so
// `max-width` caps the WHOLE box and the text column = max-width − padding.
// `max-width: 2.0in` − `padding-left: 1.5in` = 0.50in — while the layout
// profile (`blockWidthsIn.parenthetical`) intends a 2.0in column. That is a
// render defect in the CSS, NOT a PageMap miscalibration. The fix widens the
// box (`max-width: 3.5in`) so the text column becomes the intended 2.0in.
//
// These tests are the test-first gate for that fix. The real-render
// confirmation is the paper-truth probe rerun (tests/diagnostics/).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RENDERER = path.resolve(__dirname, '../../../renderer');

// Read a CSS file with comments stripped (matches the pattern in
// paper-geometry-ownership.test.js).
function readCss(file) {
  return fs.readFileSync(path.join(RENDERER, 'css', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

// Extract a numeric `in` declaration from one CSS rule body. An absent
// property returns 0 — reset.css + `.rga-print-block` zero all padding.
function declIn(css, selector, prop) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = css.match(new RegExp(esc + '\\s*\\{([^}]*)\\}'));
  if (!rule) return null;
  const d = rule[1].match(new RegExp(prop + '\\s*:\\s*([\\d.]+)in'));
  return d ? parseFloat(d[1]) : 0;
}

// The parenthetical text column actually painted. border-box (verified in
// the first test) means max-width caps the whole box → text = max-width −
// padding-left − padding-right.
function parentheticalTextColumnIn() {
  const css = readCss('editor-prosemirror.css');
  return declIn(css, '.rga-print-block-parenthetical', 'max-width')
       - declIn(css, '.rga-print-block-parenthetical', 'padding-left')
       - declIn(css, '.rga-print-block-parenthetical', 'padding-right');
}

// Boot LayoutProfile (constants.js first — _resolvePageSize reads it).
function bootLayoutProfile() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  ['../../../renderer/js/constants.js',
   '../../../renderer/js/framework/layout-profile.js'].forEach(function (p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  return global.window.Rga.LayoutProfile;
}

test('reset.css establishes global border-box — the max-width−padding formula is valid', () => {
  // The parenthetical arithmetic in every test below assumes border-box.
  assert.match(readCss('reset.css'),
    /\*[^{]*\{[^}]*box-sizing\s*:\s*border-box/,
    'reset.css must set box-sizing:border-box on * — otherwise the text column ' +
    'is not max-width − padding and these tests would be measuring the wrong thing');
});

test('parenthetical print-block text column matches the intended profile width (2.0in)', () => {
  // RED before the fix: max-width 2.0in − padding-left 1.5in = 0.50in.
  // GREEN after the fix: max-width 3.5in − padding-left 1.5in = 2.00in.
  const LP = bootLayoutProfile();
  const intended = LP._HOLLYWOOD_DEFAULTS.blockWidthsIn.parenthetical;
  assert.equal(intended, 2.0, 'sanity: the layout profile intends a 2.0in parenthetical column');
  const rendered = parentheticalTextColumnIn();
  assert.equal(rendered, intended,
    'parenthetical CSS text column is ' + rendered + 'in but the ratified profile intends ' +
    intended + 'in — a 0.50in column is the Slice 4/5 render defect');
});

test('PageMap parenthetical assumption is sourced from the profile, not the defective CSS', () => {
  // PageMap's parenthetical cpl derives from layout-profile blockWidthsIn (a
  // code constant, 2.0in) — never from a CSS measurement. So the fix is "make
  // the CSS meet the profile", never "recalibrate PageMap down to 0.5in".
  const LP = bootLayoutProfile();
  assert.equal(LP._HOLLYWOOD_DEFAULTS.blockWidthsIn.parenthetical, 2.0,
    'PageMap parenthetical width is a layout-profile code constant (2.0in), not CSS-derived');
  const cpi = LP._charsPerInch(12, 'rtl');                // Noto Naskh RTL → 14.5 cpi (Slice 7)
  const p = LP.compose({ language: 'ku', direction: 'rtl' },
    { pageSetup: { paperSize: 'A4', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } } });
  assert.equal(p.blocks.parenthetical.cpl, Math.floor(2.0 * cpi),
    'PageMap parenthetical cpl reflects the 2.0in profile width — not the 0.5in CSS defect');
  // Coherence: after the fix the CSS-rendered column and PageMap agree on one
  // profile width. RED before the fix (PageMap 20 ≠ CSS 0.5×cpi = 5).
  assert.equal(p.blocks.parenthetical.cpl, parentheticalTextColumnIn() * cpi,
    'the CSS-rendered parenthetical column and PageMap cpl must agree on one profile width');
});

test('the fix is surgical — dialogue and character print-block widths are unchanged', () => {
  // Slice 6 scope is `.rga-print-block-parenthetical` only — no other
  // typography changes.
  const css = readCss('editor-prosemirror.css');
  assert.equal(declIn(css, '.rga-print-block-dialogue', 'padding-left'), 1.0,
    'dialogue indent must be untouched');
  assert.equal(declIn(css, '.rga-print-block-dialogue', 'max-width'), 3.5,
    'dialogue max-width must be untouched');
  assert.equal(declIn(css, '.rga-print-block-character', 'padding-left'), 2.0,
    'character indent must be untouched');
});
