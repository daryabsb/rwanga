// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Fork A — PaperView controller unit tests (Brick 2).
//
// PaperView renders the read-only Paper truth surface: it builds a
// RenderModel from the ACTIVE document plus the ALREADY-COMPUTED PageMap
// (Rga.Nav.getPageMap), then paints it via PrintRenderer.
//
// Guards (Rule 9 + the geometry-ownership invariant):
//   - never calls Rga.PageMap.build()  (one PageMap per document)
//   - never reads DOM geometry (getBoundingClientRect / scroll/clientHeight)
//   - never reaches into the hidden #editor
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  // PrintRenderer is the REAL module so render() paints real .rga-page-sheet
  // leaves; everything upstream of PaperView is faked for isolation.
  ['../../../renderer/js/framework/slug-resolver.js',
   '../../../renderer/js/framework/print-renderer.js',
   '../../../renderer/js/framework/paper-view.js'].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  return global.window.Rga;
}

function fakeView() {
  return { state: { doc: { __pmDoc: true } } };
}

// Wire fake collaborators onto Rga. Returns a `calls` ledger for assertions.
function wireDeps(Rga, opts) {
  opts = opts || {};
  const pageMap = ('pageMap' in opts)
    ? opts.pageMap
    : [ { pageNumber: 1, usedLines: 8, availableLines: 57, blocks: [0] },
        { pageNumber: 2, usedLines: 9, availableLines: 57, blocks: [1] } ];
  const calls = { getPageMap: 0, pageMapBuild: 0, normalize: 0, renderModelBuild: [] };

  Rga.Nav = { getPageMap: function() { calls.getPageMap++; return pageMap; } };
  Rga.PageMap = { build: function() { calls.pageMapBuild++; return []; } };
  Rga.Normalizer = { normalize: function() {
    calls.normalize++;
    return [ { nodeType: 'action', pmFrom: 1, pmTo: 5, text: 'a' },
             { nodeType: 'action', pmFrom: 6, pmTo: 9, text: 'b' } ];
  } };
  Rga.ManuscriptGeometry = { resolve: function() {
    return { direction: 'ltr', pageSize: { w: 8.5, h: 11, unit: 'in' },
             margins: { top: 1, bottom: 1, left: 1.5, right: 1, unit: 'in' } };
  } };
  Rga.TabManager = { activeDoc: function() { return {}; } };
  Rga.RenderModel = { build: function(doc, pm, nb, lp) {
    calls.renderModelBuild.push({ doc: doc, pm: pm, nb: nb, lp: lp });
    return {
      totalPages: pm.length,
      layoutProfile: lp,
      pages: pm.map(function(p) {
        return {
          pageNumber: p.pageNumber, usedLines: p.usedLines, availableLines: p.availableLines,
          blocks: (p.blocks || []).map(function(idx) {
            return { type: 'action', pmFrom: idx * 10, pmTo: idx * 10 + 4,
                     sceneNodeId: null, sceneNumber: null, text: 'x',
                     inlineRuns: [{ text: 'x', marks: [] }] };
          })
        };
      })
    };
  } };
  return calls;
}

// --- buildPaperModel: PageMap reuse, no second build ------------------

test('buildPaperModel sources the PageMap from Rga.Nav.getPageMap', () => {
  const Rga = boot();
  const calls = wireDeps(Rga);
  Rga.PaperView.buildPaperModel(fakeView());
  assert.equal(calls.getPageMap, 1);
});

test('buildPaperModel passes the nav-index PageMap straight to RenderModel.build', () => {
  const Rga = boot();
  const pm = [{ pageNumber: 1, usedLines: 5, availableLines: 57, blocks: [0] }];
  const calls = wireDeps(Rga, { pageMap: pm });
  Rga.PaperView.buildPaperModel(fakeView());
  assert.equal(calls.renderModelBuild.length, 1);
  assert.equal(calls.renderModelBuild[0].pm, pm);
});

test('PaperView never calls Rga.PageMap.build — one PageMap per document', () => {
  const Rga = boot();
  const calls = wireDeps(Rga);
  Rga.PaperView.render(fakeView(), document.createElement('div'));
  assert.equal(calls.pageMapBuild, 0);
});

test('buildPaperModel returns null when no PageMap is available — no fallback build', () => {
  const Rga = boot();
  const calls = wireDeps(Rga, { pageMap: null });
  assert.equal(Rga.PaperView.buildPaperModel(fakeView()), null);
  assert.equal(calls.pageMapBuild, 0);
});

// --- render: PrintRenderer into the container, read-only -------------

test('render paints one .rga-page-sheet per PageMap page into the container', () => {
  const Rga = boot();
  wireDeps(Rga, { pageMap: [
    { pageNumber: 1, usedLines: 5, availableLines: 57, blocks: [0] },
    { pageNumber: 2, usedLines: 5, availableLines: 57, blocks: [1] },
    { pageNumber: 3, usedLines: 5, availableLines: 57, blocks: [0] }
  ] });
  const container = document.createElement('div');
  const ok = Rga.PaperView.render(fakeView(), container);
  assert.equal(ok, true);
  assert.equal(container.querySelectorAll('.rga-page-sheet').length, 3);
});

test('the Paper surface is read-only — no contenteditable, no .ProseMirror', () => {
  const Rga = boot();
  wireDeps(Rga);
  const container = document.createElement('div');
  Rga.PaperView.render(fakeView(), container);
  assert.equal(container.querySelectorAll('[contenteditable]').length, 0);
  assert.equal(container.querySelectorAll('.ProseMirror').length, 0);
});

test('re-render replaces prior sheets — no accumulation', () => {
  const Rga = boot();
  wireDeps(Rga);
  const container = document.createElement('div');
  Rga.PaperView.render(fakeView(), container);
  Rga.PaperView.render(fakeView(), container);
  assert.equal(container.querySelectorAll('.rga-page-sheet').length, 2);
});

test('render returns false for a missing view and for a missing container', () => {
  const Rga = boot();
  wireDeps(Rga);
  assert.equal(Rga.PaperView.render(null, document.createElement('div')), false);
  assert.equal(Rga.PaperView.render(fakeView(), null), false);
});

// --- guard: no geometry-ownership leak (Rule 9 + invariant) ---------

test('paper-view.js source uses no DOM-measurement APIs and never builds a second PageMap', () => {
  const fs = require('fs'); const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '../../../renderer/js/framework/paper-view.js'), 'utf8');
  const code = src.split('\n')
    .map(function(l) { const i = l.indexOf('//'); return i >= 0 ? l.slice(0, i) : l; })
    .join('\n');
  ['getBoundingClientRect', 'scrollHeight', 'clientHeight', 'offsetHeight', 'offsetWidth', 'getComputedStyle']
    .forEach(function(banned) {
      assert.equal(new RegExp('\\b' + banned + '\\b').test(code), false,
        'paper-view.js uses banned geometry API: ' + banned);
    });
  assert.equal(/PageMap\s*\.\s*build/.test(code), false,
    'paper-view.js must not call PageMap.build — it reuses Rga.Nav.getPageMap');
});

test('paper-view.js never reaches into the hidden #editor (Rule 9 — editor is state, not geometry)', () => {
  const fs = require('fs'); const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '../../../renderer/js/framework/paper-view.js'), 'utf8');
  const code = src.split('\n')
    .map(function(l) { const i = l.indexOf('//'); return i >= 0 ? l.slice(0, i) : l; })
    .join('\n');
  assert.equal(/#editor/.test(code), false, 'paper-view.js must not reference #editor');
  assert.equal(/getElementById/.test(code), false, 'paper-view.js must not query the editor DOM');
});

// --- Brick 6: click-to-edit affordance -------------------------------
// The read-only Paper view: clicking a rendered block returns to Flow and
// restores the caret at that block's document position (data-pm-from).

function wireEditTarget(Rga) {
  const calls = { setMode: [], dispatched: null, focus: 0 };
  Rga.ViewMode = { set: function(m) { calls.setMode.push(m); } };
  const fakeView = {
    state: {
      doc: { content: { size: 1000 }, resolve: function(p) { return { pos: p }; } },
      tr:  { setSelection: function(s) { this._sel = s; return this; },
             scrollIntoView: function() { return this; } }
    },
    dispatch: function(tr) { calls.dispatched = tr; },
    focus: function() { calls.focus += 1; }
  };
  Rga.TabManager._editorView = function() { return fakeView; };
  global.window.RgaProseMirror = {
    TextSelection: { near: function(resolved) { return { type: 'text', from: resolved.pos }; } }
  };
  calls.fakeView = fakeView;
  return calls;
}

function clickEl(el) {
  el.dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));
}

test('clicking a Paper block returns to Flow — ViewMode.set("flow")', () => {
  const Rga = boot();
  wireDeps(Rga, { pageMap: [{ pageNumber: 1, usedLines: 5, availableLines: 57, blocks: [1] }] });
  const edit = wireEditTarget(Rga);
  const container = document.createElement('div');
  Rga.PaperView.render(fakeView(), container);
  clickEl(container.querySelector('[data-pm-from]'));
  assert.deepEqual(edit.setMode, ['flow']);
});

test('clicking a Paper block restores the caret from data-pm-from', () => {
  const Rga = boot();
  wireDeps(Rga, { pageMap: [{ pageNumber: 1, usedLines: 5, availableLines: 57, blocks: [1] }] });
  const edit = wireEditTarget(Rga);
  const container = document.createElement('div');
  Rga.PaperView.render(fakeView(), container);
  const block = container.querySelector('[data-pm-from]');
  assert.equal(block.getAttribute('data-pm-from'), '10', 'block carries pmFrom 10 (block index 1 * 10)');
  clickEl(block);
  assert.ok(edit.dispatched, 'a selection transaction was dispatched');
  assert.equal(edit.dispatched._sel.from, 10, 'caret placed at the block document position');
  assert.ok(edit.focus >= 1, 'editor is focused');
});

test('clicking outside any Paper block does nothing', () => {
  const Rga = boot();
  wireDeps(Rga);
  const edit = wireEditTarget(Rga);
  const container = document.createElement('div');
  Rga.PaperView.render(fakeView(), container);
  clickEl(container);   // the container itself — no data-pm-from
  assert.equal(edit.setMode.length, 0);
  assert.equal(edit.dispatched, null);
});

test('repeated render() wires the click-to-edit handler only once (no listener leak)', () => {
  const Rga = boot();
  wireDeps(Rga);
  wireEditTarget(Rga);
  const container = document.createElement('div');
  let added = 0;
  const realAdd = container.addEventListener.bind(container);
  container.addEventListener = function(type) {
    if (type === 'click') added += 1;
    return realAdd.apply(container, arguments);
  };
  Rga.PaperView.render(fakeView(), container);
  Rga.PaperView.render(fakeView(), container);
  Rga.PaperView.render(fakeView(), container);
  assert.equal(added, 1, 'click handler attached exactly once across three renders');
});
