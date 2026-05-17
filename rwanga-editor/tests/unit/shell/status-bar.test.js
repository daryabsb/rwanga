// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 1 — Rga.Shell.StatusBar unit tests (plan §3.4, §8.2).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><footer id="status-bar"></footer><div id="host"></div></body></html>',
    { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.window.Rga = {};

  const stub = {
    activeDoc: opts.activeDoc || null,
    activeView: opts.activeView || null,
    viewMode: opts.viewMode || 'flow',
    viewListeners: new Set(),
    activatedTo: null,
    index: opts.index || { scenes: [], pages: [] },
    pageMap: opts.pageMap || [],
    outline: opts.outline || null
  };
  global.window.Rga.TabManager = {
    activeDoc: function() { return stub.activeDoc; },
    _editorView: function() { return stub.activeView; }
  };
  global.window.Rga.ViewManager = {
    current: function() { return stub.viewMode; },
    onChange: function(fn) { stub.viewListeners.add(fn); return function() { stub.viewListeners.delete(fn); }; },
    activate: function(id) { stub.activatedTo = id; stub.viewMode = id; stub.viewListeners.forEach(function(fn) { fn(); }); }
  };
  global.window.Rga.Nav = {
    getIndex: function() { return stub.index; },
    getPageMap: function() { return stub.pageMap; },
    getOutline: function() { return stub.outline || { statistics: { words: 0, sceneCount: 0, pages: 0 } }; }
  };

  ['../../../renderer/js/shell/layout.js',
   '../../../renderer/js/shell/sidebar.js',
   '../../../renderer/js/shell/script-session.js',
   '../../../renderer/js/shell/status-bar.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  Rga.ScriptSession._reset();
  Rga.Shell.StatusBar._reset();
  Rga.ScriptSession.init();
  Rga.Shell.StatusBar.init(document.getElementById('status-bar'));
  return { Rga, stub, status: document.getElementById('status-bar') };
}

function viewWithCursor(pos) {
  return { state: { selection: { from: pos, to: pos, empty: true } } };
}

test('init creates 7 segment elements (Slice 2 added blockType + wordCount); no-active-script state', () => {
  const { status } = boot();
  const segments = status.querySelectorAll('.rga-shell-status-segment');
  assert.equal(segments.length, 7);
  assert.equal(status.querySelector('[data-segment="scene"]').textContent, 'Scene: —');
  assert.equal(status.querySelector('[data-segment="page"]').textContent, 'Page: —/—');
  assert.equal(status.querySelector('[data-segment="blockType"]').textContent, '—');
  // No active view → wordCount is null → segment shows "— words"
  // (open-script-with-zero-words shows "0 words"; see separate test).
  assert.equal(status.querySelector('[data-segment="wordCount"]').textContent, '— words');
  assert.equal(status.querySelector('[data-segment="viewMode"]').textContent, 'Flow');
  assert.equal(status.querySelector('[data-segment="language"]').textContent, '—');
  assert.equal(status.querySelector('[data-segment="offline"]').textContent, 'Local');
});

test('Slice 2: wordCount segment shows "0 words" when script is open but empty', () => {
  const { status } = boot({
    outline: { statistics: { words: 0, sceneCount: 0, pages: 0 } },
    activeView: { state: { selection: { from: 0, to: 0, empty: true, $from: { parent: { type: { name: 'action' } } } } } }
  });
  assert.equal(status.querySelector('[data-segment="wordCount"]').textContent, '0 words');
});

test('Slice 2: segment order matches plan §3.4 (scene · page · blockType · wordCount · viewMode · lang · offline)', () => {
  const { status } = boot();
  const ids = Array.from(status.querySelectorAll('.rga-shell-status-segment'))
                   .map(function(el) { return el.getAttribute('data-segment'); });
  assert.deepEqual(ids, ['scene', 'page', 'blockType', 'wordCount', 'viewMode', 'language', 'offline']);
});

test('viewMode segment text reflects Rga.ViewManager.current() via ScriptSession', () => {
  const { status } = boot({ viewMode: 'draft' });
  assert.equal(status.querySelector('[data-segment="viewMode"]').textContent, 'Draft');
});

test('viewMode segment updates when Rga.ViewManager.onChange fires (via ScriptSession)', () => {
  const { Rga, status } = boot();
  assert.equal(status.querySelector('[data-segment="viewMode"]').textContent, 'Flow');
  Rga.ViewManager.activate('printPreview');
  assert.equal(status.querySelector('[data-segment="viewMode"]').textContent, 'Print Preview');
});

test('clicking the viewMode segment cycles to the next mode via Rga.ViewManager.activate', () => {
  const { Rga, status, stub } = boot();
  status.querySelector('[data-segment="viewMode"]').click();
  assert.equal(stub.activatedTo, 'draft');
});

test('scene segment renders "Scene: S{N}" where N is the current scene\'s sceneNumber', () => {
  const { status } = boot({
    activeView: viewWithCursor(15),
    index: {
      scenes: [
        { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
        { nodeId: 'b', sceneNumber: 12, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 }
      ],
      pages: []
    }
  });
  assert.equal(status.querySelector('[data-segment="scene"]').textContent, 'Scene: S12');
});

test('scene segment renders "Scene: —" when no script is open', () => {
  const { status } = boot();
  assert.equal(status.querySelector('[data-segment="scene"]').textContent, 'Scene: —');
});

test('page segment renders "Page: {N}/{M}" when scene maps to a page', () => {
  const { status } = boot({
    activeView: viewWithCursor(15),
    index: {
      scenes: [{ nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 10, pmEndPos: 30 }],
      pages: [
        { pageNumber: 1, sceneIds: ['a'] },
        { pageNumber: 2, sceneIds: [] }
      ]
    },
    pageMap: [{ pageNumber: 1 }, { pageNumber: 2 }]
  });
  assert.equal(status.querySelector('[data-segment="page"]').textContent, 'Page: 1/2');
});

test('page segment renders "Page: —/—" when no script is open', () => {
  const { status } = boot();
  assert.equal(status.querySelector('[data-segment="page"]').textContent, 'Page: —/—');
});

test('language segment shows the active script\'s screenplayProfile.language', () => {
  const { status } = boot({
    activeDoc: { docId: 'd', displayName: 'X.rga', dirty: false,
                 metadata: { screenplayProfile: { language: 'ku' } } }
  });
  // Language only refreshes via tabActivated.
  document.dispatchEvent(new CustomEvent('editor.tabActivated'));
  assert.equal(status.querySelector('[data-segment="language"]').textContent, 'ku');
});

test('offlineIndicator is hard-coded "Local" in Slice 1', () => {
  const { status } = boot();
  assert.equal(status.querySelector('[data-segment="offline"]').textContent, 'Local');
});

test('selection change refreshes scene + page segments without changing others', () => {
  const { status, stub } = boot({
    activeView: viewWithCursor(5),
    index: {
      scenes: [
        { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
        { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 }
      ],
      pages: [{ pageNumber: 1, sceneIds: ['a'] }, { pageNumber: 2, sceneIds: ['b'] }]
    },
    pageMap: [{ pageNumber: 1 }, { pageNumber: 2 }]
  });
  assert.equal(status.querySelector('[data-segment="scene"]').textContent, 'Scene: S1');
  assert.equal(status.querySelector('[data-segment="page"]').textContent, 'Page: 1/2');
  // Move cursor.
  stub.activeView.state.selection.from = 20;
  stub.activeView.state.selection.to = 20;
  document.dispatchEvent(new Event('selectionchange'));
  assert.equal(status.querySelector('[data-segment="scene"]').textContent, 'Scene: S2');
  assert.equal(status.querySelector('[data-segment="page"]').textContent, 'Page: 2/2');
});

test('editor.tabActivated event triggers refresh of the language segment', () => {
  const { stub, status } = boot();
  // Initial: no active doc → '—'.
  assert.equal(status.querySelector('[data-segment="language"]').textContent, '—');
  stub.activeDoc = { docId: 'd', displayName: 'X.rga', dirty: false,
                     metadata: { screenplayProfile: { language: 'ar' } } };
  document.dispatchEvent(new CustomEvent('editor.tabActivated'));
  assert.equal(status.querySelector('[data-segment="language"]').textContent, 'ar');
});

// ----------------------------------------------------------------
// Slice 2 — wordCount + blockType segments
// ----------------------------------------------------------------

test('Slice 2: wordCount segment formats as "N words" with thousands separator', () => {
  const { status } = boot({
    outline: { statistics: { words: 3420, sceneCount: 1, pages: 1 } },
    activeView: { state: { selection: { from: 0, to: 0, empty: true, $from: { parent: { type: { name: 'action' } } } } } }
  });
  assert.equal(status.querySelector('[data-segment="wordCount"]').textContent, '3,420 words');
});

test('Slice 2: wordCount segment formats "1 word" (singular)', () => {
  const { status } = boot({
    outline: { statistics: { words: 1, sceneCount: 1, pages: 1 } },
    activeView: { state: { selection: { from: 0, to: 0, empty: true, $from: { parent: { type: { name: 'action' } } } } } }
  });
  assert.equal(status.querySelector('[data-segment="wordCount"]').textContent, '1 word');
});

test('Slice 2: blockType segment title-cases the structural block name', () => {
  const { status } = boot({
    outline: { statistics: { words: 0, sceneCount: 0, pages: 0 } },
    activeView: { state: { selection: { from: 0, to: 0, empty: true, $from: { parent: { type: { name: 'dialogue' } } } } } }
  });
  assert.equal(status.querySelector('[data-segment="blockType"]').textContent, 'Dialogue');
});

test('Slice 2: blockType "sceneHeading" → "Scene Heading" (two words)', () => {
  const { status } = boot({
    outline: { statistics: { words: 0, sceneCount: 0, pages: 0 } },
    activeView: { state: { selection: { from: 0, to: 0, empty: true, $from: { parent: { type: { name: 'sceneHeading' } } } } } }
  });
  assert.equal(status.querySelector('[data-segment="blockType"]').textContent, 'Scene Heading');
});
