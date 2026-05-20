// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Recovery Step 4 — PageSurface derives geometry from LayoutProfile.compose
// (which reads Constants.PAPER_SIZES) instead of resolving paper size +
// margins itself. The Flow visual page now shares one geometry source with
// PageMap and Print Preview.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
    '<div class="rga-page"><div class="ProseMirror"></div></div>' +
    '</body></html>'
  );
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  // page-surface.js resolves geometry through ManuscriptGeometry, which
  // delegates to LayoutProfile, which reads Constants.PAPER_SIZES —
  // load the full chain (Recovery Step 5).
  const paths = [
    '../../../renderer/js/constants.js',
    '../../../renderer/js/framework/layout-profile.js',
    '../../../renderer/js/framework/manuscript-geometry.js',
    '../../../renderer/js/editor/page-surface.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  return {
    PageSurface: global.window.Rga.PageSurface,
    LP:          global.window.Rga.LayoutProfile,
    Constants:   global.window.Rga.Constants,
    doc:         global.document
  };
}

// ----------------------------------------------------------------
// cssVarsForProfile — consumes a resolved layoutProfile
// ----------------------------------------------------------------

test('Recovery Step 4: PageSurface uses layoutProfile.pageSize for width + minHeight', () => {
  const { PageSurface } = boot();
  const profile = {
    pageSize: { w: 8.5, h: 11, unit: 'in' },
    margins:  { top: 1, right: 1, bottom: 1, left: 1.5, unit: 'in' }
  };
  const v = PageSurface._cssVarsForProfile(profile);
  assert.equal(v.width, '8.5in',  'width comes from layoutProfile.pageSize.w');
  assert.equal(v.minHeight, '11in', 'minHeight comes from layoutProfile.pageSize.h');
});

test('Recovery Step 4: PageSurface uses layoutProfile.margins for padding + content height', () => {
  const { PageSurface } = boot();
  const profile = {
    pageSize: { w: 8.5, h: 11, unit: 'in' },
    margins:  { top: 1, right: 1, bottom: 1, left: 1.5, unit: 'in' }
  };
  const v = PageSurface._cssVarsForProfile(profile);
  assert.equal(v.paddingTop,    '1in');
  assert.equal(v.paddingRight,  '1in');
  assert.equal(v.paddingBottom, '1in');
  assert.equal(v.paddingLeft,   '1.5in');
  assert.equal(v.contentMinHeight, '9in', 'content height = pageH - top - bottom');
});

// ----------------------------------------------------------------
// apply — end-to-end resolution through LayoutProfile.compose
// ----------------------------------------------------------------

test('Recovery Step 4: apply() A4 page dimensions match LayoutProfile.compose', () => {
  const { PageSurface, LP, doc } = boot();
  const pageSetup = { paperSize: 'A4', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } };
  PageSurface.apply(pageSetup);
  const profile = LP.compose(null, { pageSetup: pageSetup });
  const page = doc.querySelector('.rga-page');
  assert.equal(page.style.width,     profile.pageSize.w + 'in', 'A4 width matches LayoutProfile');
  assert.equal(page.style.minHeight, profile.pageSize.h + 'in', 'A4 height matches LayoutProfile');
  // A4 ISO 216 values, sourced from Constants.PAPER_SIZES via LayoutProfile.
  assert.equal(page.style.width,     '8.2677in');
  assert.equal(page.style.minHeight, '11.6929in');
});

test('Recovery Step 4: apply() Letter behavior unchanged (8.5 x 11, 1in/1.5in padding)', () => {
  const { PageSurface, doc } = boot();
  PageSurface.apply({ paperSize: 'Letter', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } });
  const page = doc.querySelector('.rga-page');
  assert.equal(page.style.width,         '8.5in');
  assert.equal(page.style.minHeight,     '11in');
  assert.equal(page.style.paddingTop,    '1in');
  assert.equal(page.style.paddingRight,  '1in');
  assert.equal(page.style.paddingBottom, '1in');
  assert.equal(page.style.paddingLeft,   '1.5in');
});

test('Recovery Step 4: apply() writes correct inline styles to .rga-page and .ProseMirror', () => {
  const { PageSurface, doc } = boot();
  PageSurface.apply({ paperSize: 'Letter', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } });
  const page = doc.querySelector('.rga-page');
  const pm   = page.querySelector('.ProseMirror');
  // .rga-page receives width + minHeight + four paddings.
  assert.ok(page.style.width && page.style.minHeight, 'page has width + minHeight');
  assert.ok(page.style.paddingTop && page.style.paddingLeft, 'page has padding');
  // .ProseMirror receives the content min-height = pageH - top - bottom = 9in.
  assert.equal(pm.style.minHeight, '9in', 'ProseMirror gets content min-height');
});

test('Recovery Step 4: apply() unknown paper size falls back to Letter dimensions', () => {
  const { PageSurface, doc } = boot();
  // Unknown name → LayoutProfile._resolvePageSize returns null →
  // compose() uses HOLLYWOOD_DEFAULTS.pageSize (Letter 8.5 x 11).
  PageSurface.apply({ paperSize: 'NotAPaper', margins: { top: 1, right: 1, bottom: 1, left: 1 } });
  const page = doc.querySelector('.rga-page');
  assert.equal(page.style.width,     '8.5in');
  assert.equal(page.style.minHeight, '11in');
});
