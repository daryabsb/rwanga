// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Recovery Step 5 — ManuscriptGeometry is the single named geometry
// resolver. PageSurface, nav-index, and Print Preview route geometry
// resolution through it; none of them call LayoutProfile.compose
// directly anymore, and index.html loads the module at runtime.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RENDERER = path.join(__dirname, '..', '..', '..', 'renderer');

function src(rel) {
  return fs.readFileSync(path.join(RENDERER, rel), 'utf8');
}

// ----------------------------------------------------------------
// Each runtime geometry consumer must call the ManuscriptGeometry
// façade (resolve / resolveFrom) and must NOT call LayoutProfile
// .compose( directly. The literal call string `LayoutProfile.compose(`
// is checked so a prose mention of "LayoutProfile" in a comment does
// not trip the guard.
// ----------------------------------------------------------------

test('Recovery Step 5: PageSurface routes through ManuscriptGeometry, not LayoutProfile.compose', () => {
  const s = src('js/editor/page-surface.js');
  assert.ok(/ManuscriptGeometry\.resolve/.test(s),
    'page-surface.js must call the ManuscriptGeometry resolver');
  assert.ok(!s.includes('LayoutProfile.compose('),
    'page-surface.js must NOT call LayoutProfile.compose() directly');
});

test('Recovery Step 5: nav-index routes through ManuscriptGeometry, not LayoutProfile.compose', () => {
  const s = src('js/framework/nav-index.js');
  assert.ok(/ManuscriptGeometry\.resolve/.test(s),
    'nav-index.js must call the ManuscriptGeometry resolver');
  assert.ok(!s.includes('LayoutProfile.compose('),
    'nav-index.js must NOT call LayoutProfile.compose() directly');
});

test('Recovery Step 5: Print Preview routes through ManuscriptGeometry, not LayoutProfile.compose', () => {
  const s = src('js/framework/print-preview.js');
  assert.ok(/ManuscriptGeometry\.resolve/.test(s),
    'print-preview.js must call the ManuscriptGeometry resolver');
  assert.ok(!s.includes('LayoutProfile.compose('),
    'print-preview.js must NOT call LayoutProfile.compose() directly');
});

test('Recovery Step 5: index.html loads manuscript-geometry.js at runtime', () => {
  const html = src('index.html');
  assert.ok(html.includes('js/framework/manuscript-geometry.js'),
    'index.html must load manuscript-geometry.js — it is the runtime resolver, not shelf code');
  // It must load after layout-profile.js (it delegates to it) and before
  // nav-index.js (whose plugin resolves geometry through it).
  const iLayout = html.indexOf('js/framework/layout-profile.js');
  const iGeom   = html.indexOf('js/framework/manuscript-geometry.js');
  const iNav    = html.indexOf('js/framework/nav-index.js');
  assert.ok(iLayout !== -1 && iGeom !== -1 && iNav !== -1, 'all three scripts present');
  assert.ok(iLayout < iGeom, 'manuscript-geometry.js loads after layout-profile.js');
  assert.ok(iGeom < iNav,    'manuscript-geometry.js loads before nav-index.js');
});

// ----------------------------------------------------------------
// Identity — resolveFrom output still equals LayoutProfile.compose
// output (the Phase B identity rule, re-asserted as a Step 5 guard:
// routing through the façade must not change the arithmetic).
// ----------------------------------------------------------------

test('Recovery Step 5: ManuscriptGeometry.resolveFrom output equals LayoutProfile.compose output', () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  const paths = [
    '../../../renderer/js/constants.js',
    '../../../renderer/js/framework/slug-resolver.js',
    '../../../renderer/js/framework/layout-profile.js',
    '../../../renderer/js/framework/manuscript-geometry.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  const LP = global.window.Rga.LayoutProfile;
  const MG = global.window.Rga.ManuscriptGeometry;

  const cases = [
    [null, null],
    [{ language: 'en', screenplayConvention: 'hollywood' },
     { pageSetup: { paperSize: 'A4', margins: { top: 1, bottom: 1, left: 1.5, right: 1 } } }],
    [{ language: 'ku', direction: 'rtl' },
     { pageSetup: { paperSize: 'Letter', margins: { top: 0.75, bottom: 0.75, left: 1.25, right: 0.75 } } }]
  ];
  cases.forEach(function(c) {
    assert.deepEqual(MG.resolveFrom(c[0], c[1]), LP.compose(c[0], c[1]),
      'resolveFrom must equal compose for inputs ' + JSON.stringify(c));
  });
});
