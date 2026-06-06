// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Review Bar v1 — unit tests (jsdom).
//
// Covers the bar's DOM contract (three zones, every directed control, the
// shown-but-disabled Print slot) and the pure helpers (paper label, zoom
// clamp/format, fit math, jump parsing). Live scroll/fit/zoom geometry —
// which jsdom cannot lay out — is proven in the Playwright spec.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.requestAnimationFrame = function(fn) { return setTimeout(fn, 0); };
  global.window.Rga = {};
  const p = '../../../renderer/js/framework/review-bar.js';
  delete require.cache[require.resolve(p)];
  require(p);
  return global.window.Rga;
}

// Build a fake preview surface (#rga-print-preview-root + N sheets) so show()
// has something to host, mirroring the real PrintRenderer output.
function mountPreview(n, opts) {
  opts = opts || {};
  const root = document.createElement('div');
  root.id = 'rga-print-preview-root';
  for (let i = 1; i <= n; i += 1) {
    const s = document.createElement('div');
    s.className = 'rga-page-sheet';
    s.setAttribute('data-page-number', String(i));
    s.style.width = (opts.w || 8.5) + 'in';
    s.style.height = (opts.h || 11) + 'in';
    root.appendChild(s);
  }
  document.body.appendChild(root);
  return root;
}

// ---- Pure helpers ----------------------------------------------------------

test('ReviewBar._paperLabel maps standard sizes (Letter / A4 / Legal / Custom)', () => {
  const Rga = boot();
  const PL = Rga.ReviewBar._paperLabel;
  assert.equal(PL({ w: 8.5, h: 11 }), 'Letter');
  assert.equal(PL({ w: 8.27, h: 11.69 }), 'A4');
  assert.equal(PL({ w: 8.5, h: 14 }), 'Legal');
  assert.equal(PL({ w: 11, h: 8.5 }), 'Letter');   // orientation-agnostic
  assert.equal(PL({ w: 9, h: 13 }), 'Custom');
  assert.equal(PL(null), 'Custom');
});

test('ReviewBar._clampZoom clamps to [0.25, 4]', () => {
  const Rga = boot();
  const C = Rga.ReviewBar._clampZoom;
  assert.equal(C(1), 1);
  assert.equal(C(0.1), 0.25);
  assert.equal(C(9), 4);
  assert.equal(C(0), 0.25);
  assert.equal(C(NaN), 0.25);
});

test('ReviewBar._formatPct rounds to a percentage string', () => {
  const Rga = boot();
  assert.equal(Rga.ReviewBar._formatPct(1), '100%');
  assert.equal(Rga.ReviewBar._formatPct(0.5), '50%');
  assert.equal(Rga.ReviewBar._formatPct(1.337), '134%');
});

test('ReviewBar._fitScale: width mode uses width ratio; page mode uses min ratio', () => {
  const Rga = boot();
  const F = Rga.ReviewBar._fitScale;
  const natural = { w: 816, h: 1056 };          // Letter @96dpi
  // Wide-but-short viewport: width fits at 1.0, but height limits page mode.
  const avail = { w: 816, h: 528 };
  assert.equal(F('width', avail, natural), 1);                 // 816/816
  assert.equal(F('page', avail, natural), 0.5);                // min(1, 528/1056)
  // Degenerate natural → scale 1 (no divide-by-zero).
  assert.equal(F('page', avail, { w: 0, h: 0 }), 1);
});

test('ReviewBar._parseJump clamps to 1..total or returns null', () => {
  const Rga = boot();
  const J = Rga.ReviewBar._parseJump;
  assert.equal(J('7', 12), 7);
  assert.equal(J('99', 12), 12);
  assert.equal(J('0', 12), 1);
  assert.equal(J('-3', 12), 1);
  assert.equal(J('abc', 12), null);
  assert.equal(J('5', 0), null);
});

test('ReviewBar._orientationLabel / _directionLabel title-case the owned enums', () => {
  const Rga = boot();
  assert.equal(Rga.ReviewBar._orientationLabel('landscape'), 'Landscape');
  assert.equal(Rga.ReviewBar._orientationLabel('portrait'), 'Portrait');
  assert.equal(Rga.ReviewBar._orientationLabel(undefined), 'Portrait');   // default
  assert.equal(Rga.ReviewBar._directionLabel('rtl'), 'RTL');
  assert.equal(Rga.ReviewBar._directionLabel('ltr'), 'LTR');
  assert.equal(Rga.ReviewBar._directionLabel(null), 'LTR');               // default
});

test('ReviewBar._confidence: pages → Ready; empty → Review', () => {
  const Rga = boot();
  const C = Rga.ReviewBar._confidence;
  assert.equal(C(12).state, 'ready');
  assert.equal(C(1).state, 'ready');
  assert.equal(C(0).state, 'review');
  assert.match(C(0).title, /Review/);
});

test('ReviewBar._distinctSceneCount counts distinct positive scene numbers only', () => {
  const Rga = boot();
  const D = Rga.ReviewBar._distinctSceneCount;
  assert.equal(D(['1', '1', '2', '3', '3', '3']), 3);   // de-duplicated across pages
  assert.equal(D(['2', '1', '2']), 2);
  assert.equal(D(['0', '-1', 'x', '']), 0);             // non-positive / NaN ignored
  assert.equal(D([]), 0);
});

// ---- DOM contract ----------------------------------------------------------

test('show() builds the bar with all three zones and every directed control', () => {
  const Rga = boot();
  mountPreview(12);
  Rga.ReviewBar.show();
  const bar = document.getElementById('rga-review-bar');
  assert.ok(bar, 'review bar must be mounted');
  // Three zones present.
  assert.ok(bar.querySelector('.rga-review-context'), 'context/exit zone');
  assert.ok(bar.querySelector('.rga-review-center'), 'navigation+zoom zone');
  assert.ok(bar.querySelector('.rga-review-output'), 'output/commit zone');
  // Controls (scope list).
  assert.ok(bar.querySelector('.rga-review-done'), 'Done');
  assert.ok(bar.querySelector('.rga-review-prev'), 'Previous');
  assert.ok(bar.querySelector('.rga-review-next'), 'Next');
  assert.ok(bar.querySelector('.rga-review-pageind'), 'page indicator');
  assert.ok(bar.querySelector('.rga-review-pageind-input'), 'jump input');
  assert.ok(bar.querySelector('.rga-review-fit-page'), 'Fit page');
  assert.ok(bar.querySelector('.rga-review-fit-width'), 'Fit width');
  assert.ok(bar.querySelector('.rga-review-zoom-out'), 'zoom out');
  assert.ok(bar.querySelector('.rga-review-zoom-in'), 'zoom in');
  assert.ok(bar.querySelector('.rga-review-zoom-pct'), 'zoom percent readout');
  assert.ok(bar.querySelector('.rga-review-export'), 'Export PDF');
  Rga.ReviewBar.hide();
});

test('Print is present but disabled (shown-but-deferred slot)', () => {
  const Rga = boot();
  mountPreview(3);
  Rga.ReviewBar.show();
  const print = document.querySelector('.rga-review-print');
  assert.ok(print, 'Print slot must exist');
  assert.equal(print.disabled, true, 'Print must be disabled (deferred wire)');
  Rga.ReviewBar.hide();
});

test('page indicator shows current / total from rendered sheets', () => {
  const Rga = boot();
  mountPreview(12);
  Rga.ReviewBar.show();
  const ind = document.querySelector('.rga-review-pageind');
  // Total comes from the rendered sheet count; the current-page number is
  // scroll/layout-derived (proven live in Playwright — jsdom has no layout).
  assert.match(ind.textContent.replace(/\s+/g, ' ').trim(), /^\d+ \/ 12$/);
  Rga.ReviewBar.hide();
});

test('package identity shows title · paper · N pp', () => {
  const Rga = boot();
  Rga.TabManager = { activeDoc: function() { return { displayName: 'The Collector.rga', metadata: {} }; } };
  Rga.ManuscriptGeometry = { resolve: function() { return { pageSize: { w: 8.5, h: 11 }, direction: 'ltr' }; } };
  mountPreview(12);
  Rga.ReviewBar.show();
  const id = document.querySelector('.rga-review-id');
  assert.match(id.textContent, /The Collector/);
  assert.match(id.textContent, /Letter/);
  assert.match(id.textContent, /12 pp/);
  Rga.ReviewBar.hide();
});

test('Slice A — identity sources the print contract: paper · orientation · direction · page #s', () => {
  const Rga = boot();
  Rga.TabManager = { activeDoc: function() { return { displayName: 'The Collector.rga', metadata: {} }; } };
  // PrintContract is the named resolver; the bar must read it (not re-derive).
  Rga.PrintContract = { resolve: function() {
    return { paperSize: 'A4', orientation: 'landscape', direction: 'ltr',
             pageNumbering: { enabled: false }, sceneNumbering: { enabled: true } };
  } };
  mountPreview(12);
  Rga.ReviewBar.show();
  const id = document.querySelector('.rga-review-id').textContent;
  assert.match(id, /A4/);
  assert.match(id, /Landscape/);
  assert.match(id, /LTR/);
  assert.match(id, /Page #s off/);
  assert.match(id, /12 pp/);
  Rga.ReviewBar.hide();
});

test('Slice B — identity folds in the scene count from rendered data-scene-number', () => {
  const Rga = boot();
  Rga.TabManager = { activeDoc: function() { return { displayName: 'x.rga', metadata: {} }; } };
  const root = mountPreview(3);
  // Stamp blocks across the sheets like PrintRenderer does (scenes 1,1,2,3).
  [1, 1, 2, 3].forEach(function(n) {
    const blk = document.createElement('div');
    blk.setAttribute('data-scene-number', String(n));
    root.appendChild(blk);
  });
  Rga.ReviewBar.show();
  assert.match(document.querySelector('.rga-review-id').textContent, /3 scenes/);
  Rga.ReviewBar.hide();
});

test('Slice B — a single scene is rendered in the singular ("1 scene")', () => {
  const Rga = boot();
  Rga.TabManager = { activeDoc: function() { return { displayName: 'x.rga', metadata: {} }; } };
  const root = mountPreview(1);
  const blk = document.createElement('div');
  blk.setAttribute('data-scene-number', '1');
  root.appendChild(blk);
  Rga.ReviewBar.show();
  assert.match(document.querySelector('.rga-review-id').textContent, /1 scene\b/);
  Rga.ReviewBar.hide();
});

test('Slice D — confidence whisper reads Ready with rendered pages', () => {
  const Rga = boot();
  mountPreview(5);
  Rga.ReviewBar.show();
  const conf = document.querySelector('.rga-review-confidence');
  assert.ok(conf, 'confidence whisper must be present in the output zone');
  assert.equal(conf.getAttribute('data-state'), 'ready');
  assert.match(conf.querySelector('.rga-review-confidence-label').textContent, /Ready/);
  Rga.ReviewBar.hide();
});

test('Slice A — paper falls back to geometry when PrintContract is absent', () => {
  const Rga = boot();
  Rga.TabManager = { activeDoc: function() { return { displayName: 'x.rga', metadata: {} }; } };
  Rga.ManuscriptGeometry = { resolve: function() { return { pageSize: { w: 8.5, h: 11 }, direction: 'rtl' }; } };
  // No Rga.PrintContract — the bar must still label from the geometry façade.
  mountPreview(2);
  Rga.ReviewBar.show();
  const id = document.querySelector('.rga-review-id').textContent;
  assert.match(id, /Letter/);
  assert.equal(document.getElementById('rga-review-bar').getAttribute('dir'), 'rtl');
  Rga.ReviewBar.hide();
});

test('RTL geometry mirrors the bar (dir="rtl")', () => {
  const Rga = boot();
  Rga.TabManager = { activeDoc: function() { return { displayName: 'x.rga', metadata: {} }; } };
  Rga.ManuscriptGeometry = { resolve: function() { return { pageSize: { w: 8.5, h: 11 }, direction: 'rtl' }; } };
  mountPreview(2);
  Rga.ReviewBar.show();
  assert.equal(document.getElementById('rga-review-bar').getAttribute('dir'), 'rtl');
  Rga.ReviewBar.hide();
});

test('Done routes to Rga.PrintPreview.hide()', () => {
  const Rga = boot();
  let hid = false;
  Rga.PrintPreview = { hide: function() { hid = true; } };
  mountPreview(2);
  Rga.ReviewBar.show();
  document.querySelector('.rga-review-done').click();
  assert.equal(hid, true, 'Done must call PrintPreview.hide');
  Rga.ReviewBar.hide();
});

test('Export PDF routes to Rga.PdfExport.run() — from the review surface', () => {
  const Rga = boot();
  let ran = false;
  Rga.PdfExport = { run: function() { ran = true; return Promise.resolve(true); } };
  mountPreview(2);
  Rga.ReviewBar.show();
  document.querySelector('.rga-review-export').click();
  assert.equal(ran, true, 'Export PDF must call Rga.PdfExport.run');
  Rga.ReviewBar.hide();
});

test('zoom stepper updates the percent readout and clears fit mode', () => {
  const Rga = boot();
  mountPreview(2);
  Rga.ReviewBar.show();   // enters at Fit page (is-active on fit-page)
  const pct = document.querySelector('.rga-review-zoom-pct');
  const before = pct.textContent;
  document.querySelector('.rga-review-zoom-in').click();
  assert.notEqual(pct.textContent, before, 'zoom-in must change the readout');
  assert.equal(document.querySelector('.rga-review-fit-page').classList.contains('is-active'), false,
    'manual zoom clears the active fit mode');
  Rga.ReviewBar.hide();
});

test('Fit width / Fit page toggle the active control', () => {
  const Rga = boot();
  mountPreview(2);
  Rga.ReviewBar.show();
  document.querySelector('.rga-review-fit-width').click();
  assert.equal(document.querySelector('.rga-review-fit-width').classList.contains('is-active'), true);
  assert.equal(document.querySelector('.rga-review-fit-page').classList.contains('is-active'), false);
  document.querySelector('.rga-review-fit-page').click();
  assert.equal(document.querySelector('.rga-review-fit-page').classList.contains('is-active'), true);
  Rga.ReviewBar.hide();
});

test('jump: clicking the indicator reveals the input; Enter scrolls, Esc cancels', () => {
  const Rga = boot();
  mountPreview(12);
  Rga.ReviewBar.show();
  const ind = document.querySelector('.rga-review-pageind');
  const input = document.querySelector('.rga-review-pageind-input');
  ind.click();
  assert.equal(input.hidden, false, 'jump input shown on indicator click');
  assert.equal(ind.hidden, true, 'indicator hidden while jumping');
  // Esc cancels back to the indicator.
  input.dispatchEvent(new global.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(input.hidden, true, 'Esc hides the jump input');
  assert.equal(ind.hidden, false, 'Esc restores the indicator');
  Rga.ReviewBar.hide();
});

test('hide() removes the bar and clears the presentation zoom', () => {
  const Rga = boot();
  const root = mountPreview(3);
  Rga.ReviewBar.show();
  assert.ok(document.getElementById('rga-review-bar'));
  Rga.ReviewBar.hide();
  assert.equal(document.getElementById('rga-review-bar'), null, 'bar removed on hide');
  assert.equal(root.style.zoom, '', 'presentation zoom reset on hide');
});

test('show() is a no-op when no preview root is present', () => {
  const Rga = boot();
  Rga.ReviewBar.show();   // no #rga-print-preview-root
  assert.equal(document.getElementById('rga-review-bar'), null, 'no bar without a preview surface');
});
