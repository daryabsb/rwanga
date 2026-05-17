// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Runtime Ownership Stabilization Slice 7 — regression tests.
// Covers §A (SessionBoundary + ScriptMetrics independence) at the
// behavioural level.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function freshJSDOM(html) {
  const dom = new JSDOM(html || '<!DOCTYPE html><html><body></body></html>',
                        { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  global.window.Rga = {};
  global.Rga = global.window.Rga;
  return dom;
}

function reloadModules(paths) {
  paths.forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
}

function bootSessionStack(opts) {
  opts = opts || {};
  freshJSDOM();
  // Minimal upstream stubs ScriptSession + ScriptMetrics need.
  global.window.Rga.TabManager = {
    activeDoc:     function() { return opts.activeDoc || null; },
    _editorView:   function() { return opts.activeView || null; }
  };
  global.window.Rga.ViewManager = {
    current:  function() { return opts.viewMode || 'flow'; },
    onChange: function() { return function() {}; }
  };
  global.window.Rga.Nav = {
    getIndex:   function() { return opts.index || { scenes: [], pages: [] }; },
    getPageMap: function() { return opts.pageMap || []; },
    findScene:  function() { return null; },
    getOutline: function() { return opts.outline || { statistics: { words: 0, sceneCount: 0, pages: 0 } }; }
  };
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/sidebar.js',
    '../../../renderer/js/shell/session-boundary.js',
    '../../../renderer/js/shell/script-session.js',
    '../../../renderer/js/shell/script-metrics.js'
  ]);
  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  Rga.ScriptSession._reset();
  Rga.ScriptMetrics._reset();
  Rga.ScriptSession.init();
  return Rga;
}

// ================================================================
// §A — SessionBoundary manifest
// ================================================================

test('§A: Rga.SessionBoundary exposes the documented public API', () => {
  freshJSDOM();
  reloadModules(['../../../renderer/js/shell/session-boundary.js']);
  const Rga = global.window.Rga;
  assert.ok(Rga.SessionBoundary, 'Rga.SessionBoundary must exist');
  assert.ok(Rga.Shell.SessionBoundary, 'Rga.Shell.SessionBoundary must exist (namespaced alias)');
  ['ownerOf', 'fieldsOf', 'isFieldOf', 'owners', 'semanticOf', 'moduleOf']
    .forEach(function(name) {
      assert.equal(typeof Rga.SessionBoundary[name], 'function',
        'Rga.SessionBoundary.' + name + ' must be a function');
    });
});

test('§A: SessionBoundary manifest declares the four owners with correct semantics', () => {
  freshJSDOM();
  reloadModules(['../../../renderer/js/shell/session-boundary.js']);
  const SB = global.window.Rga.SessionBoundary;
  assert.deepEqual(SB.owners().sort(),
    ['ScriptMetrics', 'ScriptSession', 'ViewManager', 'WorkspaceState']);
  assert.equal(SB.semanticOf('ScriptSession'),  'writer-context');
  assert.equal(SB.semanticOf('ScriptMetrics'),  'derived-analytics');
  assert.equal(SB.semanticOf('ViewManager'),    'view-mode');
  assert.equal(SB.semanticOf('WorkspaceState'), 'workspace-persistence');
});

test('§A: SessionBoundary.ownerOf returns the correct owner for known fields', () => {
  freshJSDOM();
  reloadModules(['../../../renderer/js/shell/session-boundary.js']);
  const SB = global.window.Rga.SessionBoundary;
  assert.equal(SB.ownerOf('activeScript'),     'ScriptSession');
  assert.equal(SB.ownerOf('currentScene'),     'ScriptSession');
  assert.equal(SB.ownerOf('wordCount'),        'ScriptMetrics');
  assert.equal(SB.ownerOf('currentBlockType'), 'ScriptMetrics');
  assert.equal(SB.ownerOf('sceneCount'),       'ScriptMetrics');  // reserved-future
  assert.equal(SB.ownerOf('sidebar'),          'WorkspaceState');
  assert.equal(SB.ownerOf('studioPanel'),      'WorkspaceState');
  assert.equal(SB.ownerOf('unknownField'),     null);
});

test('§A: SessionBoundary.isFieldOf accepts canonical pairs and rejects swaps', () => {
  freshJSDOM();
  reloadModules(['../../../renderer/js/shell/session-boundary.js']);
  const SB = global.window.Rga.SessionBoundary;
  assert.equal(SB.isFieldOf('ScriptSession', 'activeScript'),  true);
  assert.equal(SB.isFieldOf('ScriptMetrics', 'wordCount'),     true);
  // Cross-owner accesses fail — this is the boundary in code form.
  assert.equal(SB.isFieldOf('ScriptSession', 'wordCount'),     false,
    'wordCount must NOT be owned by ScriptSession');
  assert.equal(SB.isFieldOf('ScriptMetrics', 'activeScript'),  false,
    'activeScript must NOT be owned by ScriptMetrics');
});

// ================================================================
// §A — ScriptSession snapshot is now writer-context-only
// ================================================================

test('§A: Rga.ScriptSession.get() returns ONLY the 7 writer-context fields', () => {
  const Rga = bootSessionStack();
  const snap = Rga.ScriptSession.get();
  assert.deepEqual(Object.keys(snap).sort(), [
    'activePanel', 'activeScript', 'currentPage', 'currentScene',
    'currentSelection', 'currentView', 'openPanels'
  ]);
  // Analytics-field leakage check.
  ['wordCount', 'currentBlockType',
   'dialogueWords', 'actionWords', 'sceneCount', 'estimatedRuntime'].forEach(function(f) {
    assert.equal(f in snap, false,
      'ScriptSession snapshot must NOT carry "' + f + '" — that field is owned by ScriptMetrics');
  });
});

// ================================================================
// §A — ScriptMetrics derives independently
// ================================================================

test('§A: Rga.ScriptMetrics.get() derives wordCount from Rga.Nav.getOutline (not from ScriptSession.get())', () => {
  const Rga = bootSessionStack({
    activeView: { state: { selection: { from: 0, to: 0, empty: true } } },
    outline:    { statistics: { words: 1234, sceneCount: 8, pages: 12 } }
  });
  const snap = Rga.ScriptMetrics.get();
  assert.equal(snap.wordCount, 1234,
    'ScriptMetrics.get() must compute wordCount from Rga.Nav.getOutline().statistics.words');
});

test('§A: Rga.ScriptMetrics.get() derives currentBlockType from the cursor parent', () => {
  const Rga = bootSessionStack({
    activeView: {
      state: {
        selection: {
          from: 0, to: 0, empty: true,
          $from: { parent: { type: { name: 'dialogue' } } }
        }
      }
    }
  });
  assert.equal(Rga.ScriptMetrics.get().currentBlockType, 'dialogue');
});

test('§A: Rga.ScriptMetrics.get() filters non-body parents (returns null)', () => {
  const Rga = bootSessionStack({
    activeView: {
      state: {
        selection: {
          from: 0, to: 0, empty: true,
          $from: { parent: { type: { name: 'doc' } } }
        }
      }
    }
  });
  assert.equal(Rga.ScriptMetrics.get().currentBlockType, null);
});

test('§A: Rga.ScriptMetrics.get() snapshot has the documented shape (live + reserved)', () => {
  const Rga = bootSessionStack();
  const snap = Rga.ScriptMetrics.get();
  assert.deepEqual(Object.keys(snap).sort(), [
    'actionWords', 'currentBlockType', 'dialogueWords',
    'estimatedRuntime', 'sceneCount', 'wordCount'
  ]);
  // Writer-context leakage check.
  ['activeScript', 'currentScene', 'currentPage', 'currentView',
   'currentSelection', 'openPanels', 'activePanel'].forEach(function(f) {
    assert.equal(f in snap, false,
      'ScriptMetrics snapshot must NOT carry "' + f + '" — that field is owned by ScriptSession');
  });
});

test('§A: Rga.ScriptMetrics.subscribe fires when wordCount changes (independent derivation)', () => {
  // Wire a mutable outline so we can simulate a wordCount change
  // between two ScriptSession recomputes.
  let words = 100;
  const view = { state: { selection: { from: 0, to: 0, empty: true } } };
  freshJSDOM();
  global.window.Rga.TabManager  = { activeDoc: function() { return null; }, _editorView: function() { return view; } };
  global.window.Rga.ViewManager = { current: function() { return 'flow'; }, onChange: function() { return function() {}; } };
  global.window.Rga.Nav = {
    getIndex:   function() { return { scenes: [], pages: [] }; },
    getPageMap: function() { return []; },
    findScene:  function() { return null; },
    getOutline: function() { return { statistics: { words: words } }; }
  };
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/sidebar.js',
    '../../../renderer/js/shell/session-boundary.js',
    '../../../renderer/js/shell/script-session.js',
    '../../../renderer/js/shell/script-metrics.js'
  ]);
  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  Rga.ScriptSession._reset();
  Rga.ScriptMetrics._reset();
  Rga.ScriptSession.init();

  const events = [];
  Rga.ScriptMetrics.subscribe(function(next, prev) { events.push({ next: next, prev: prev }); });

  // Change wordCount via Nav, then trigger ScriptSession recompute.
  words = 250;
  Rga.ScriptSession._recompute();
  // ScriptSession's snapshot didn't actually change (no writer-context
  // field flipped), so its subscribers won't fire. Hmm — ScriptMetrics
  // subscribes to ScriptSession; if ScriptSession doesn't notify,
  // ScriptMetrics doesn't see the change. This is a real limitation
  // of the "ScriptSession is our trigger" design.
  //
  // To make ScriptMetrics see the change, ScriptSession must fire on
  // any cursor / tab / view event regardless of analytics. The
  // cursor selectionchange path WILL fire because ScriptSession
  // recomputes its currentSelection.from on every selectionchange.
  // Below we simulate a real cursor move that ALSO carries new
  // wordCount.
  view.state.selection.from = 99;
  document.dispatchEvent(new global.window.Event('selectionchange'));
  // Now ScriptSession sees currentSelection.from change → fires →
  // ScriptMetrics re-derives → sees wordCount went 100 → 250 → fires.
  assert.equal(events.length, 1, 'ScriptMetrics fired exactly once for the analytics change');
  assert.equal(events[0].next.wordCount, 250);
  assert.equal(events[0].prev.wordCount, 100);
});

// ================================================================
// §A — StatusBar reads from correct owners (already true post-Slice-5;
// re-asserted here as the boundary's behavioural acceptance.)
// ================================================================

test('§A: source audit — StatusBar reads writer-context from ScriptSession and analytics from ScriptMetrics', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../../renderer/js/shell/status-bar.js'), 'utf8');
  assert.ok(/Rga\.ScriptSession\.get\s*\(/.test(src),
    'status-bar.js must read writer-context via Rga.ScriptSession.get()');
  assert.ok(/Rga\.ScriptMetrics\.get\s*\(/.test(src),
    'status-bar.js must read analytics via Rga.ScriptMetrics.get()');
  // Source-level boundary: _renderBlockType and _renderWordCount
  // must be CALLED with the ScriptMetrics snapshot.
  assert.ok(/_renderBlockType\s*\(\s*sm\s*\)/.test(src),
    '_renderBlockType must be called with the ScriptMetrics snapshot (sm)');
  assert.ok(/_renderWordCount\s*\(\s*sm\s*\)/.test(src),
    '_renderWordCount must be called with the ScriptMetrics snapshot (sm)');
});
