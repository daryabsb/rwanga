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

test('ScriptSession exposes no setters — get / subscribe / init / _reset only', () => {
  const { Session } = boot();
  const surface = Object.keys(Session).filter(function(k) { return k.charAt(0) !== '_'; });
  assert.deepEqual(surface.sort(), ['get', 'init', 'subscribe']);
});

// ----------------------------------------------------------------
// Slice 2 additions — wordCount + currentBlockType
// ----------------------------------------------------------------

test('Slice 2: wordCount field derives from Rga.Nav.getOutline(state).statistics.words', () => {
  const { Session, stub } = boot();
  stub.activeView = { state: { selection: { from: 0, to: 0, empty: true } } };
  stub.outline = { statistics: { words: 3420, sceneCount: 8, pages: 12 } };
  Session.init();
  assert.equal(Session.get().wordCount, 3420);
});

test('Slice 2: wordCount is null when there is no active view', () => {
  const { Session } = boot();
  Session.init();
  assert.equal(Session.get().wordCount, null);
});

test('Slice 2: currentBlockType derives from cursor\'s enclosing parent type', () => {
  const { Session, stub } = boot();
  const fakeParent = { type: { name: 'dialogue' } };
  stub.activeView = {
    state: {
      selection: { from: 0, to: 0, empty: true, $from: { parent: fakeParent } }
    }
  };
  Session.init();
  assert.equal(Session.get().currentBlockType, 'dialogue');
});

test('Slice 2: currentBlockType filters out structural wrappers — returns null for non-body parents', () => {
  const { Session, stub } = boot();
  // Cursor's parent is the doc wrapper, not a body block.
  const fakeParent = { type: { name: 'doc' } };
  stub.activeView = {
    state: {
      selection: { from: 0, to: 0, empty: true, $from: { parent: fakeParent } }
    }
  };
  Session.init();
  assert.equal(Session.get().currentBlockType, null);
});

test('Slice 2: shallow-eq filter handles new fields — same wordCount/blockType → no notification', () => {
  const { Session, stub } = boot();
  const fakeParent = { type: { name: 'action' } };
  stub.activeView = {
    state: { selection: { from: 0, to: 0, empty: true, $from: { parent: fakeParent } } }
  };
  stub.outline = { statistics: { words: 100, sceneCount: 1, pages: 1 } };
  Session.init();
  let count = 0;
  Session.subscribe(function() { count += 1; });
  // Trigger a recompute event without changing any field.
  document.dispatchEvent(new Event('selectionchange'));
  document.dispatchEvent(new Event('selectionchange'));
  assert.equal(count, 0, 'no notifications when nothing changed');
  // Now change wordCount → one notification.
  stub.outline.statistics.words = 200;
  document.dispatchEvent(new Event('selectionchange'));
  assert.equal(count, 1);
});
