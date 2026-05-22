// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Fork A (Brick 4+5) — PageSurface retired to a pure --page-width publisher.
//
// PageSurface no longer applies paper geometry to #editor. #editor is no
// longer "paper"; the Paper view (PrintRenderer leaves) owns page geometry.
// PageSurface's sole remaining job: publish the resolved paper width to the
// --page-width CSS token so a Page Setup paper-size change still reaches the
// Flow editor column + the Row-3 toolbar band.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
    // A legacy .rga-page element is present ON PURPOSE — PageSurface must
    // no longer touch it.
    '<div id="editor" class="rga-page"><div class="ProseMirror"></div></div>' +
    '</body></html>'
  );
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  const paths = [
    '../../../renderer/js/constants.js',
    '../../../renderer/js/framework/layout-profile.js',
    '../../../renderer/js/framework/manuscript-geometry.js',
    '../../../renderer/js/editor/page-surface.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  return { PageSurface: global.window.Rga.PageSurface, LP: global.window.Rga.LayoutProfile, doc: global.document };
}

// --- surviving behaviour: --page-width still updates after Page Setup ---

test('apply() publishes --page-width from the resolved paper width (Letter)', () => {
  const { PageSurface, doc } = boot();
  PageSurface.apply({ paperSize: 'Letter', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } });
  assert.equal(doc.documentElement.style.getPropertyValue('--page-width'), '8.5in');
});

test('apply() Letter -> A4 updates --page-width (Page Setup change reaches the token)', () => {
  const { PageSurface, doc } = boot();
  PageSurface.apply({ paperSize: 'Letter', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } });
  assert.equal(doc.documentElement.style.getPropertyValue('--page-width'), '8.5in');
  PageSurface.apply({ paperSize: 'A4', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } });
  assert.equal(doc.documentElement.style.getPropertyValue('--page-width'), '8.2677in');
});

test('apply() A4 -> Legal updates --page-width', () => {
  const { PageSurface, doc } = boot();
  PageSurface.apply({ paperSize: 'A4', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } });
  assert.equal(doc.documentElement.style.getPropertyValue('--page-width'), '8.2677in');
  PageSurface.apply({ paperSize: 'Legal', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } });
  assert.equal(doc.documentElement.style.getPropertyValue('--page-width'), '8.5in');
});

test('--page-width derives from the resolved geometry, not a literal', () => {
  const { PageSurface, LP, doc } = boot();
  const pageSetup = { paperSize: 'A4', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } };
  PageSurface.apply(pageSetup);
  const profile = LP.compose(null, { pageSetup: pageSetup });
  assert.equal(doc.documentElement.style.getPropertyValue('--page-width'), profile.pageSize.w + 'in');
});

test('--page-width is published on documentElement (the :root scope the token resolves from)', () => {
  const { PageSurface, doc } = boot();
  PageSurface.apply({ paperSize: 'A4', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } });
  assert.equal(doc.documentElement.style.getPropertyValue('--page-width'), '8.2677in');
});

// --- retirement: PageSurface no longer applies geometry to the editor ---

test('apply() does NOT write inline geometry onto the editor element', () => {
  const { PageSurface, doc } = boot();
  PageSurface.apply({ paperSize: 'Letter', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } });
  const el = doc.getElementById('editor');
  assert.equal(el.style.width, '', 'no inline width');
  assert.equal(el.style.minHeight, '', 'no inline min-height — the growth model is gone');
  assert.equal(el.style.paddingTop, '', 'no inline padding');
});

test('apply() does NOT set min-height on the .ProseMirror content element', () => {
  const { PageSurface, doc } = boot();
  PageSurface.apply({ paperSize: 'Letter', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } });
  assert.equal(doc.querySelector('.ProseMirror').style.minHeight, '');
});

test('apply() with a missing pageSetup does not throw', () => {
  const { PageSurface } = boot();
  assert.doesNotThrow(function() { PageSurface.apply(null); });
  assert.doesNotThrow(function() { PageSurface.apply(undefined); });
});

test('page-surface.js source no longer applies paper geometry (retired)', () => {
  const fs = require('fs'); const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '../../../renderer/js/editor/page-surface.js'), 'utf8');
  const code = src.split('\n').map(function(l){ const i = l.indexOf('//'); return i >= 0 ? l.slice(0, i) : l; }).join('\n');
  assert.equal(/minHeight|min-height/.test(code), false, 'no min-height application — the growth model is retired');
  assert.equal(/querySelector|getElementById/.test(code), false, 'PageSurface no longer reaches into the editor DOM');
  assert.equal(/\.rga-page\b/.test(code), false, 'PageSurface no longer depends on the .rga-page class');
});
