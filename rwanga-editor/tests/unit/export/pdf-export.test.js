// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PB1.B — renderer pdf-export tests.
//
// Covers the export-document assembly (page-size parity via @page, RTL
// direction, stylesheet replication, overlay reset) and the run() caller
// contract (guards + the happy-path call into window.rwanga.export.toPDF).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><head>' +
    '<link rel="stylesheet" href="css/reset.css">' +
    '<link rel="stylesheet" href="css/editor-prosemirror.css">' +
    '</head><body></body></html>', { url: 'file:///app/renderer/index.html' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  const p = '../../../renderer/js/export/pdf-export.js';
  delete require.cache[require.resolve(p)];
  require(p);
  return global.window.Rga;
}

// ---- _buildExportHtml ------------------------------------------------------

test('PB1.B: _buildExportHtml pins @page to the resolved pageSize (Letter)', () => {
  const Rga = boot();
  const html = Rga.PdfExport._buildExportHtml({
    sheetsHTML: '<div class="rga-page-sheet"></div>',
    cssHrefs: [],
    geometry: { pageSize: { w: 8.5, h: 11.0, unit: 'in' }, direction: 'ltr' }
  });
  assert.match(html, /@page \{ size: 8\.5in 11in; margin: 0; \}/);
});

test('PB1.B: _buildExportHtml pins @page to A4 dimensions when geometry is A4', () => {
  const Rga = boot();
  const html = Rga.PdfExport._buildExportHtml({
    sheetsHTML: '', cssHrefs: [],
    geometry: { pageSize: { w: 8.27, h: 11.69, unit: 'in' }, direction: 'ltr' }
  });
  assert.match(html, /@page \{ size: 8\.27in 11\.69in; margin: 0; \}/);
});

test('PB1.B: _buildExportHtml sets dir="rtl" for RTL documents', () => {
  const Rga = boot();
  const html = Rga.PdfExport._buildExportHtml({
    sheetsHTML: '', cssHrefs: [],
    geometry: { pageSize: { w: 8.5, h: 11.0 }, direction: 'rtl' }
  });
  assert.match(html, /<html dir="rtl">/);
});

test('PB1.B: _buildExportHtml replicates the app stylesheet links and embeds the sheets', () => {
  const Rga = boot();
  const html = Rga.PdfExport._buildExportHtml({
    sheetsHTML: '<div class="rga-page-sheet" data-page-number="1">PAGE</div>',
    cssHrefs: ['file:///app/renderer/css/editor-prosemirror.css'],
    geometry: { pageSize: { w: 8.5, h: 11.0 }, direction: 'ltr' }
  });
  assert.match(html, /<link rel="stylesheet" href="file:\/\/\/app\/renderer\/css\/editor-prosemirror\.css">/);
  assert.match(html, /data-page-number="1">PAGE</);
  assert.match(html, /id="rga-print-preview-root"/);
});

test('PB1.B: _buildExportHtml neutralises the on-screen overlay (display block, no shadow, no gap)', () => {
  const Rga = boot();
  const html = Rga.PdfExport._buildExportHtml({ sheetsHTML: '', cssHrefs: [], geometry: { pageSize: { w: 8.5, h: 11 } } });
  assert.match(html, /#rga-print-preview-root \{[^}]*display: block !important/);
  assert.match(html, /\.rga-page-sheet \{[^}]*box-shadow: none !important/);
  assert.match(html, /break-after: page/);
});

// ---- _suggestedName --------------------------------------------------------

test('PB1.B: _suggestedName swaps .rga for .pdf', () => {
  const Rga = boot();
  Rga.TabManager = { activeDoc: function() { return { displayName: 'The Last Light.rga' }; } };
  assert.equal(Rga.PdfExport._suggestedName(), 'The Last Light.pdf');
});

test('PB1.B: _suggestedName sanitises path-illegal characters and falls back to Script', () => {
  const Rga = boot();
  Rga.TabManager = { activeDoc: function() { return { displayName: 'a/b:c?.rga' }; } };
  assert.equal(Rga.PdfExport._suggestedName(), 'a_b_c_.pdf');
  Rga.TabManager = { activeDoc: function() { return null; } };
  assert.equal(Rga.PdfExport._suggestedName(), 'Script.pdf');
});

// ---- _geometry -------------------------------------------------------------

test('PB1.B: _geometry falls back to Letter when no resolver is present', () => {
  const Rga = boot();
  const g = Rga.PdfExport._geometry();
  assert.equal(g.pageSize.w, 8.5);
  assert.equal(g.pageSize.h, 11.0);
  assert.equal(g.direction, 'ltr');
});

test('PB1.B: _geometry reads pageSize/margins/direction from ManuscriptGeometry', () => {
  const Rga = boot();
  Rga.ManuscriptGeometry = { resolve: function() {
    return { pageSize: { w: 8.27, h: 11.69, unit: 'in' }, margins: { top: 1, bottom: 1, left: 1.5, right: 1 }, direction: 'rtl', orientation: 'portrait' };
  } };
  Rga.TabManager = { activeDoc: function() { return {}; } };
  const g = Rga.PdfExport._geometry();
  assert.equal(g.pageSize.w, 8.27);
  assert.equal(g.direction, 'rtl');
});

// ---- run() -----------------------------------------------------------------

test('PB1.B: run() is a no-op (returns false) when the desktop bridge is absent', async () => {
  const Rga = boot();
  // window.rwanga undefined (jsdom) → bridge absent.
  const ok = await Rga.PdfExport.run();
  assert.equal(ok, false);
});

test('PB1.B: run() returns false when no editor view is open', async () => {
  const Rga = boot();
  global.window.rwanga = { export: { toPDF: function() { throw new Error('should not be called'); } } };
  Rga.TabManager = { _editorView: function() { return null; }, activeDoc: function() { return null; } };
  const ok = await Rga.PdfExport.run();
  assert.equal(ok, false);
});

test('PB1.B: run() renders sheets and calls window.rwanga.export.toPDF with html + geometry', async () => {
  const Rga = boot();
  let captured = null;
  global.window.rwanga = { export: { toPDF: function(html, options) { captured = { html: html, options: options }; return Promise.resolve({ path: '/out/The Last Light.pdf' }); } } };
  const fakeView = { state: { doc: {} } };
  Rga.TabManager = {
    _editorView: function() { return fakeView; },
    activeDoc: function() { return { displayName: 'The Last Light.rga' }; }
  };
  Rga.PrintPreview = { buildModel: function(v) { assert.equal(v, fakeView); return { pages: [], totalPages: 1 }; }, getOptions: function() { return {}; } };
  Rga.PrintRenderer = { render: function(model, container) { container.innerHTML = '<div class="rga-page-sheet" data-page-number="1">SCENE</div>'; } };
  Rga.ManuscriptGeometry = { resolve: function() { return { pageSize: { w: 8.5, h: 11.0, unit: 'in' }, margins: {}, direction: 'ltr' }; } };

  const ok = await Rga.PdfExport.run();
  assert.equal(ok, true);
  assert.ok(captured, 'toPDF must be called');
  assert.match(captured.html, /data-page-number="1">SCENE</);
  assert.match(captured.html, /@page \{ size: 8\.5in 11in/);
  assert.equal(captured.options.suggestedName, 'The Last Light.pdf');
  assert.equal(captured.options.geometry.pageSize.w, 8.5);
});

test('PB1.B: run() returns false and does not throw when the handler reports an error', async () => {
  const Rga = boot();
  global.window.rwanga = { export: { toPDF: function() { return Promise.resolve({ error: 'disk full' }); } } };
  Rga.TabManager = { _editorView: function() { return { state: { doc: {} } }; }, activeDoc: function() { return null; } };
  Rga.PrintPreview = { buildModel: function() { return { pages: [], totalPages: 1 }; }, getOptions: function() { return {}; } };
  Rga.PrintRenderer = { render: function(m, c) { c.innerHTML = '<div class="rga-page-sheet"></div>'; } };
  Rga.ManuscriptGeometry = { resolve: function() { return { pageSize: { w: 8.5, h: 11 }, margins: {}, direction: 'ltr' }; } };
  const ok = await Rga.PdfExport.run();
  assert.equal(ok, false);
});

test('PB1.B: run() returns false (not rejected) when the bridge rejects', async () => {
  const Rga = boot();
  global.window.rwanga = { export: { toPDF: function() { return Promise.reject(new Error('ipc down')); } } };
  Rga.TabManager = { _editorView: function() { return { state: { doc: {} } }; }, activeDoc: function() { return null; } };
  Rga.PrintPreview = { buildModel: function() { return { pages: [], totalPages: 1 }; }, getOptions: function() { return {}; } };
  Rga.PrintRenderer = { render: function(m, c) { c.innerHTML = '<div class="rga-page-sheet"></div>'; } };
  Rga.ManuscriptGeometry = { resolve: function() { return { pageSize: { w: 8.5, h: 11 }, margins: {}, direction: 'ltr' }; } };
  const ok = await Rga.PdfExport.run();
  assert.equal(ok, false);
});
