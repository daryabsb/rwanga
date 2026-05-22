// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Fork A — Brick 3: view-mode <-> Paper view integration (JSDOM unit group).
//
// Print mode renders the read-only Paper truth surface and hides the live
// #editor; Flow/Draft clear it and restore #editor. The hidden editor is
// preserved (Rule 9 — state only): view-mode never destroys the EditorView
// and never reads its DOM geometry.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
    '<div id="editor-container"><div id="editor" class="rga-page"></div></div>' +
    '</body></html>',
    { url: 'http://localhost/' });   // a real origin — JSDOM localStorage needs it
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  try { dom.window.localStorage.clear(); } catch (_) {}
  global.window.Rga = {};
  ['../../renderer/js/framework/view-manager.js',
   '../../renderer/js/view-mode.js'].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  return { Rga: global.window.Rga, dom: dom };
}

// Fake PaperView (spy) + fake TabManager returning a fake EditorView.
function wireFakes(Rga) {
  const calls = { render: 0, clear: 0, focus: 0, lastContainer: null, lastView: undefined };
  const fakeSelection = { __marker: 'flow-caret' };
  const fakeView = {
    state: { selection: fakeSelection },
    destroyed: false,
    focus: function() { calls.focus += 1; },
    destroy: function() { this.destroyed = true; }
  };
  Rga.TabManager = { _editorView: function() { return fakeView; } };
  Rga.PaperView = {
    render: function(view, container) {
      calls.render += 1; calls.lastView = view; calls.lastContainer = container;
      if (container) {
        container.innerHTML = '<div class="rga-page-sheet"></div><div class="rga-page-sheet"></div>';
      }
      return true;
    },
    clear: function(container) {
      calls.clear += 1;
      if (container) container.innerHTML = '';
    }
  };
  calls.fakeView = fakeView;
  calls.fakeSelection = fakeSelection;
  return calls;
}

function editorEl()   { return document.getElementById('editor'); }
function paperRoots() { return document.querySelectorAll('#rga-paper-view-root'); }
function sheetCount() { return document.querySelectorAll('.rga-page-sheet').length; }

// --- 1. Print mode renders the Paper view ----------------------------

test('switching to Print mode calls PaperView.render', () => {
  const { Rga } = boot();
  const calls = wireFakes(Rga);
  Rga.ViewMode.init();
  Rga.ViewMode.set('print');
  assert.equal(calls.render, 1);
});

// --- 2. Flow mode clears the Paper view ------------------------------

test('switching back to Flow mode calls PaperView.clear', () => {
  const { Rga } = boot();
  const calls = wireFakes(Rga);
  Rga.ViewMode.init();
  Rga.ViewMode.set('print');
  Rga.ViewMode.set('flow');
  assert.ok(calls.clear >= 1, 'PaperView.clear must run on the way back to Flow');
});

// --- 3. #editor visibility toggles -----------------------------------

test('#editor is hidden in Print and shown again in Flow', () => {
  const { Rga } = boot();
  wireFakes(Rga);
  Rga.ViewMode.init();
  Rga.ViewMode.set('print');
  assert.equal(editorEl().style.display, 'none');
  Rga.ViewMode.set('flow');
  assert.notEqual(editorEl().style.display, 'none');
});

// --- 4. Flow selection / EditorView survives the round trip ---------

test('the EditorView and its selection survive a Flow -> Print -> Flow round trip', () => {
  const { Rga } = boot();
  const calls = wireFakes(Rga);
  Rga.ViewMode.init();
  Rga.ViewMode.set('print');
  Rga.ViewMode.set('flow');
  assert.equal(calls.fakeView.destroyed, false, 'view-mode must never destroy the EditorView');
  assert.equal(calls.fakeView.state.selection, calls.fakeSelection, 'selection state is untouched');
  assert.ok(calls.focus >= 1, 'returning to Flow re-focuses the editor so the caret is restored');
});

// --- 5. Repeated switching does not accumulate Paper surfaces -------

test('repeated Print/Flow switching does not accumulate page sheets', () => {
  const { Rga } = boot();
  wireFakes(Rga);
  Rga.ViewMode.init();
  for (let i = 0; i < 6; i += 1) { Rga.ViewMode.set('print'); Rga.ViewMode.set('flow'); }
  Rga.ViewMode.set('print');
  assert.equal(sheetCount(), 2, 'Print shows exactly the current render — no stale sheets');
});

// --- 6. Only one Paper render container is ever created -------------

test('no second Paper render container is created across many switches', () => {
  const { Rga } = boot();
  wireFakes(Rga);
  Rga.ViewMode.init();
  for (let i = 0; i < 10; i += 1) { Rga.ViewMode.set('print'); Rga.ViewMode.set('flow'); }
  assert.equal(paperRoots().length, 1);
});

// --- Regression: 50x switching is stable ---------------------------

test('50x mode switching does not grow sheet count, DOM nodes, or listeners', () => {
  const { Rga, dom } = boot();
  wireFakes(Rga);
  Rga.ViewMode.init();

  const ET = dom.window.EventTarget.prototype;
  const realAdd = ET.addEventListener;
  let addedDuringLoop = 0;

  Rga.ViewMode.set('print'); Rga.ViewMode.set('flow');          // warm-up cycle
  const nodesAfter1 = document.querySelectorAll('*').length;

  ET.addEventListener = function() { addedDuringLoop += 1; return realAdd.apply(this, arguments); };
  try {
    for (let i = 0; i < 50; i += 1) { Rga.ViewMode.set('print'); Rga.ViewMode.set('flow'); }
  } finally {
    ET.addEventListener = realAdd;
  }
  const nodesAfter50 = document.querySelectorAll('*').length;

  assert.equal(paperRoots().length, 1, 'still exactly one Paper container');
  assert.equal(sheetCount(), 0, 'ended on Flow — Paper surface is cleared');
  assert.equal(nodesAfter50, nodesAfter1, 'DOM node count is stable across 50 switches');
  assert.equal(addedDuringLoop, 0, 'mode switching adds no event listeners');
});

// --- Rule 9 guard: view-mode never measures DOM geometry -----------

test('view-mode.js source uses no DOM-measurement APIs (Rule 9)', () => {
  const fs = require('fs'); const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '../../renderer/js/view-mode.js'), 'utf8');
  const code = src.split('\n')
    .map(function(l) { const i = l.indexOf('//'); return i >= 0 ? l.slice(0, i) : l; })
    .join('\n');
  ['getBoundingClientRect', 'scrollHeight', 'clientHeight', 'offsetHeight', 'offsetWidth', 'getComputedStyle']
    .forEach(function(banned) {
      assert.equal(new RegExp('\\b' + banned + '\\b').test(code), false,
        'view-mode.js uses banned geometry API: ' + banned);
    });
});
