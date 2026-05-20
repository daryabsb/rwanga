// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 1 — Rga.ScriptSession unit tests (plan §3.5, §8.2).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="host"></div></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.window.Rga = {};

  // Stub the minimum engine surface ScriptSession reads from.
  const stub = {
    activeDoc: null,
    activeView: null,
    viewMode: 'flow',
    viewListeners: new Set(),
    index: { scenes: [], pages: [] },
    pageMap: []
  };
  global.window.Rga.TabManager = {
    activeDoc: function() { return stub.activeDoc; },
    _editorView: function() { return stub.activeView; }
  };
  global.window.Rga.ViewManager = {
    current: function() { return stub.viewMode; },
    onChange: function(fn) { stub.viewListeners.add(fn); return function() { stub.viewListeners.delete(fn); }; }
  };
  global.window.Rga.Nav = {
    getIndex: function() { return stub.index; },
    getPageMap: function() { return stub.pageMap; },
    getOutline: function() { return stub.outline || { statistics: { words: 0, sceneCount: 0, pages: 0 } }; }
  };

  ['../../../renderer/js/shell/layout.js',
   '../../../renderer/js/shell/sidebar.js',
   '../../../renderer/js/shell/script-session.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Session = global.window.Rga.ScriptSession;
  Session._reset();
  global.window.Rga.Shell.Layout._reset();
  global.window.Rga.Shell.Sidebar._reset();
  global.window.Rga.Shell.Sidebar.setHost(document.getElementById('host'));
  return { Session, Sidebar: global.window.Rga.Shell.Sidebar, stub };
}

function makeFakeView(selectionFrom) {
  return {
    state: {
      selection: { from: selectionFrom, to: selectionFrom, empty: true }
    }
  };
}

test('get() before init returns the empty snapshot', () => {
  const { Session } = boot();
  const s = Session.get();
  assert.equal(s.activeScript, null);
  assert.equal(s.currentScene, null);
  assert.equal(s.currentPage, null);
  assert.equal(s.currentView, null);
  assert.deepEqual(s.openPanels, []);
  assert.equal(s.activePanel, null);
});

test('init() populates the snapshot from current upstream state', () => {
  const { Session, stub } = boot();
  stub.activeDoc = { docId: 'doc-1', displayName: 'Test.rga', dirty: false };
  stub.viewMode = 'draft';
  Session.init();
  const s = Session.get();
  assert.deepEqual(s.activeScript, { docId: 'doc-1', displayName: 'Test.rga', dirty: false });
  assert.equal(s.currentView, 'draft');
});

test('get() returns a SHALLOW COPY — mutations do not affect internal state', () => {
  const { Session, stub } = boot();
  stub.activeDoc = { docId: 'd', displayName: 'X.rga', dirty: false };
  Session.init();
  const s1 = Session.get();
  s1.activeScript.dirty = true;
  s1.openPanels.push('mutated');
  const s2 = Session.get();
  assert.equal(s2.activeScript.dirty, false);
  assert.deepEqual(s2.openPanels, []);
});

test('subscribe is fired with (newSnapshot, prevSnapshot) on each real change', () => {
  const { Session, stub } = boot();
  Session.init();
  let received = null;
  Session.subscribe(function(next, prev) { received = { next: next, prev: prev }; });
  stub.activeDoc = { docId: 'd1', displayName: 'A.rga', dirty: false };
  document.dispatchEvent(new CustomEvent('editor.tabActivated'));
  assert.ok(received, 'subscriber fired');
  assert.equal(received.prev.activeScript, null);
  assert.equal(received.next.activeScript.displayName, 'A.rga');
});

test('shallow-equality filters no-op recomputes (same upstream → no notification)', () => {
  const { Session, stub } = boot();
  stub.activeDoc = { docId: 'd', displayName: 'X.rga', dirty: false };
  Session.init();
  let count = 0;
  Session.subscribe(function() { count += 1; });
  // Fire tabActivated three times with same state — no change.
  document.dispatchEvent(new CustomEvent('editor.tabActivated'));
  document.dispatchEvent(new CustomEvent('editor.tabActivated'));
  document.dispatchEvent(new CustomEvent('editor.tabActivated'));
  assert.equal(count, 0);
});

test('viewManager.onChange recomputes currentView', () => {
  const { Session, stub } = boot();
  Session.init();
  let received = null;
  Session.subscribe(function(next) { received = next; });
  // Simulate ViewManager firing.
  stub.viewMode = 'printPreview';
  stub.viewListeners.forEach(function(fn) { fn(); });
  assert.equal(received.currentView, 'printPreview');
});

test('sidebar.onChange recomputes openPanels + activePanel', () => {
  const { Session, Sidebar } = boot();
  Session.init();
  let received = null;
  Session.subscribe(function(next) { received = next; });
  Sidebar.registerPanel({ id: 'a', label: 'A', icon: 'A', available: true, mount: function() {}, unmount: function() {} });
  Sidebar.activate('a');
  assert.ok(received);
  assert.deepEqual(received.openPanels, ['a']);
  assert.equal(received.activePanel, 'a');
});

test('selectionchange recomputes currentScene + currentPage from cursor position', () => {
  const { Session, stub } = boot();
  stub.activeView = makeFakeView(15);
  stub.index = {
    scenes: [
      { nodeId: 'sc-1', sceneNumber: 1, headingDisplay: 'INT. ROOM — DAY',  pmPos: 10, pmEndPos: 30 },
      { nodeId: 'sc-2', sceneNumber: 2, headingDisplay: 'EXT. STREET — NIGHT', pmPos: 30, pmEndPos: 60 }
    ],
    pages: [{ pageNumber: 1, sceneIds: ['sc-1', 'sc-2'] }]
  };
  stub.pageMap = [{ pageNumber: 1 }];
  Session.init();
  const s = Session.get();
  assert.equal(s.currentScene.nodeId, 'sc-1');
  assert.equal(s.currentScene.sceneNumber, 1);
  assert.equal(s.currentPage.number, 1);
  assert.equal(s.currentPage.total, 1);
});

test('currentScene is null when the cursor sits outside every scene range', () => {
  const { Session, stub } = boot();
  stub.activeView = makeFakeView(5);  // before scene 1's pmPos=10
  stub.index = { scenes: [{ nodeId: 's', sceneNumber: 1, headingDisplay: 'INT. A', pmPos: 10, pmEndPos: 30 }], pages: [] };
  stub.pageMap = [{ pageNumber: 1 }];
  Session.init();
  assert.equal(Session.get().currentScene, null);
});

test('currentScene tracks cursor movement across scene boundaries via selectionchange', () => {
  const { Session, stub } = boot();
  stub.activeView = makeFakeView(15);
  stub.index = {
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 10, pmEndPos: 30 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 30, pmEndPos: 60 }
    ],
    pages: []
  };
  Session.init();
  assert.equal(Session.get().currentScene.nodeId, 'a');
  // Move cursor.
  stub.activeView = makeFakeView(45);
  document.dispatchEvent(new Event('selectionchange'));
  assert.equal(Session.get().currentScene.nodeId, 'b');
});

test('init is idempotent — calling twice does not double-wire listeners', () => {
  const { Session, stub } = boot();
  Session.init();
  Session.init();
  let count = 0;
  Session.subscribe(function() { count += 1; });
  stub.activeDoc = { docId: 'd', displayName: 'X.rga', dirty: false };
  document.dispatchEvent(new CustomEvent('editor.tabActivated'));
  assert.equal(count, 1, 'subscriber fired exactly once');
});

test('ScriptSession exposes get / init / recompute / subscribe — no setters', () => {
  const { Session } = boot();
  const surface = Object.keys(Session).filter(function(k) { return k.charAt(0) !== '_'; });
  // recompute() (Recovery Step 7) is a forced-refresh command, NOT a
  // setter — it re-derives writer-context from upstream truth; it does
  // not let a consumer mutate writer-context. The "no setters" boundary
  // discipline still holds.
  assert.deepEqual(surface.sort(), ['get', 'init', 'recompute', 'subscribe']);
});

// ----------------------------------------------------------------
// Slice 7 §A — snapshot shape boundary
// (wordCount + currentBlockType migrated to Rga.ScriptMetrics; the
// equivalent tests now live in script-metrics.test.js.)
// ----------------------------------------------------------------

test('Slice 7 §A: ScriptSession snapshot shape is locked to the 7 writer-context fields', () => {
  const { Session } = boot();
  Session.init();
  const snap = Session.get();
  assert.deepEqual(Object.keys(snap).sort(), [
    'activePanel', 'activeScript', 'currentPage', 'currentScene',
    'currentSelection', 'currentView', 'openPanels'
  ], 'snapshot must contain ONLY the 7 writer-context fields — no analytics leakage');
  assert.equal('wordCount'        in snap, false, 'wordCount must not be on ScriptSession snapshot');
  assert.equal('currentBlockType' in snap, false, 'currentBlockType must not be on ScriptSession snapshot');
});

// ================================================================
// Recovery Step 7 — Page Setup Apply triggers a ScriptSession
// recompute. Apply rebuilds the PageMap via a meta-only PM
// transaction that fires no selectionchange; ScriptSession.recompute()
// is the public forced-refresh entry the Apply path calls so the
// status-bar Page X/Y updates on the same gesture.
// ================================================================

test('Recovery Step 7: recompute() is public and refreshes the status-bar source without cursor movement', () => {
  const { Session, stub } = boot();
  assert.equal(typeof Session.recompute, 'function', 'recompute() must be a public method');
  stub.activeView = makeFakeView(0);
  stub.index = { scenes: [], pages: [] };
  stub.pageMap = [{}, {}];          // 2 pages
  Session.init();
  assert.equal(Session.get().currentPage.total, 2, 'initial total reflects the 2-page PageMap');

  // Simulate a Page Setup margin change: PageMap rebuilt to 3 pages.
  // No selectionchange, no cursor move — only a forced recompute().
  stub.pageMap = [{}, {}, {}];
  Session.recompute();
  assert.equal(Session.get().currentPage.total, 3,
    'recompute() must refresh currentPage.total — the status-bar source — with no cursor movement');
});

test('Recovery Step 7: page-setup-dialog Apply path calls Rga.ScriptSession.recompute()', () => {
  // Source-level wiring guard: the Apply branch must ask ScriptSession to
  // recompute after the forceReindex dispatch.
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'renderer', 'js', 'editor', 'page-setup-dialog.js'),
    'utf8'
  );
  assert.ok(/ScriptSession\.recompute\s*\(/.test(src),
    'page-setup-dialog.js Apply path must call Rga.ScriptSession.recompute()');
});

test('Recovery Step 7: existing selectionchange recompute path still works', () => {
  const { Session, stub } = boot();
  stub.activeView = makeFakeView(0);
  stub.index = { scenes: [], pages: [] };
  stub.pageMap = [{}];             // 1 page
  Session.init();
  assert.equal(Session.get().currentPage.total, 1);

  // A selectionchange must still trigger a recompute (Step 7 adds a path,
  // it must not break the existing one).
  stub.pageMap = [{}, {}];
  document.dispatchEvent(new Event('selectionchange'));
  assert.equal(Session.get().currentPage.total, 2,
    'selectionchange must still drive a recompute');
});

test('Recovery Step 7: recompute() does not cause a duplicate / looping notification', () => {
  const { Session, stub } = boot();
  stub.activeView = makeFakeView(0);
  stub.index = { scenes: [], pages: [] };
  stub.pageMap = [{}];
  Session.init();

  let notifications = 0;
  Session.subscribe(function() { notifications += 1; });

  // One real change → exactly one notification.
  stub.pageMap = [{}, {}];
  Session.recompute();
  assert.equal(notifications, 1, 'one real change yields exactly one notification — no loop');

  // recompute() with no change → calm, zero further notifications.
  Session.recompute();
  assert.equal(notifications, 1, 'a no-op recompute() notifies no one (snapshot-equality short-circuit)');
});
