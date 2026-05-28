// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 1 — Rga.Shell.SceneNavigator unit tests (plan §3.7.1, §8.2).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="host"></div></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.KeyboardEvent = dom.window.KeyboardEvent;
  global.window.Rga = {};

  // Stub engine surface.
  const stub = {
    view: null,
    index: opts.index || { scenes: [], pages: [] },
    findSceneCall: null,
    dispatchCall: null
  };
  if (opts.scenes) {
    stub.view = {
      state: {
        doc: {
          resolve: function(pos) { return { pos: pos }; }
        },
        selection: { from: opts.cursor || 0, to: opts.cursor || 0, empty: true },
        tr: { setSelection: function() { stub.dispatchCall = { kind: 'setSelection' }; return this; }, scrollIntoView: function() { return this; } }
      },
      dispatch: function(tr) { /* stub */ },
      focus: function() {}
    };
    stub.index = { scenes: opts.scenes, pages: opts.pages || [] };
  }
  global.window.Rga.TabManager = {
    activeDoc: function() { return null; },
    _editorView: function() { return stub.view; }
  };
  global.window.Rga.ViewManager = {
    current: function() { return 'flow'; },
    onChange: function() { return function() {}; }
  };
  global.window.Rga.Nav = {
    getIndex: function() { return stub.index; },
    getPageMap: function() { return Array.isArray(stub.index.pages) ? stub.index.pages.map(function(p) { return { pageNumber: p.pageNumber }; }) : []; },
    findScene: function(doc, nodeId) {
      stub.findSceneCall = nodeId;
      const sc = (stub.index.scenes || []).find(function(s) { return s.nodeId === nodeId; });
      return sc ? sc.pmPos : null;
    }
  };
  global.window.RgaProseMirror = { TextSelection: { near: function($p) { return { kind: 'sel', pos: $p.pos }; } } };

  ['../../../renderer/js/shell/layout.js',
   '../../../renderer/js/shell/sidebar.js',
   '../../../renderer/js/shell/script-session.js',
   '../../../renderer/js/shell/panels/scene-navigator.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  Rga.ScriptSession._reset();
  Rga.Shell.SceneNavigator._reset();
  Rga.Shell.Sidebar.setHost(document.getElementById('host'));
  // Re-register (panel module's IIFE-registration is dropped by _reset).
  Rga.Shell.Sidebar.registerPanel(Rga.Shell.SceneNavigator._controller);
  Rga.ScriptSession.init();
  return { Rga, host: document.getElementById('host'), stub };
}

test('panel registers with Sidebar under id "sceneNavigator" + writer-facing label "Scenes"', () => {
  const { Rga } = boot();
  const c = Rga.Shell.Sidebar.getController('sceneNavigator');
  assert.ok(c);
  assert.equal(c.label, 'Scenes');
  assert.equal(c.shortcut, 'Cmd-Shift-S');
});

test('mount with no scenes renders the empty state (Bundle 1 §B: unified .rga-shell-panel-empty class)', () => {
  const { Rga, host } = boot();
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const empty = host.querySelector('.rga-shell-panel-empty');
  assert.ok(empty, 'unified empty-state DOM rendered');
  assert.match(empty.textContent, /No scenes yet/);
  // Bundle 1 §B: also check the title segment is present.
  assert.ok(empty.querySelector('.rga-shell-panel-empty-title'),
    'empty state includes a title segment');
  assert.ok(empty.querySelector('.rga-shell-panel-empty-body'),
    'empty state includes a body segment');
});

test('each row renders sceneNumber + headingDisplay + estimated page + indicators in documented order', () => {
  const { Rga, host } = boot({
    cursor: 5,
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'INT. ROOM — DAY',  pmPos: 0,  pmEndPos: 20, hasNotes: false, hasRevisionFlag: false },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'EXT. STREET — NIGHT', pmPos: 20, pmEndPos: 40, hasNotes: true,  hasRevisionFlag: true }
    ],
    pages: [{ pageNumber: 1, sceneIds: ['a'] }, { pageNumber: 2, sceneIds: ['b'] }]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const rows = host.querySelectorAll('.rga-shell-scene-navigator-row');
  assert.equal(rows.length, 2);
  // Row 1: scene 1, no indicators, p.1
  assert.equal(rows[0].querySelector('.rga-shell-scene-navigator-num').textContent, '1');
  assert.match(rows[0].querySelector('.rga-shell-scene-navigator-heading').textContent, /INT\. ROOM/);
  assert.equal(rows[0].querySelectorAll('.rga-shell-scene-navigator-indicator').length, 0);
  assert.equal(rows[0].querySelector('.rga-shell-scene-navigator-page').textContent, 'p.1');
  // Row 2: scene 2, two indicators, p.2
  assert.equal(rows[1].querySelector('.rga-shell-scene-navigator-num').textContent, '2');
  assert.equal(rows[1].querySelectorAll('.rga-shell-scene-navigator-indicator').length, 2);
  assert.equal(rows[1].querySelector('.rga-shell-scene-navigator-page').textContent, 'p.2');
});

test('rows with hasNotes=true show the note indicator', () => {
  const { Rga, host } = boot({
    scenes: [{ nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0, pmEndPos: 10, hasNotes: true, hasRevisionFlag: false }]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const ind = host.querySelector('.rga-shell-scene-navigator-indicator');
  assert.ok(ind);
  assert.equal(ind.textContent, '📝');
  assert.equal(ind.getAttribute('aria-label'), 'Has notes');
});

test('rows with hasRevisionFlag=true show the flag indicator', () => {
  const { Rga, host } = boot({
    scenes: [{ nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0, pmEndPos: 10, hasNotes: false, hasRevisionFlag: true }]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const inds = host.querySelectorAll('.rga-shell-scene-navigator-indicator');
  assert.equal(inds.length, 1);
  assert.equal(inds[0].textContent, '🚩');
});

test('the row containing the cursor gets the current-scene mark — sourced from ScriptSession', () => {
  const { Rga, host } = boot({
    cursor: 15,
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const rows = host.querySelectorAll('.rga-shell-scene-navigator-row');
  assert.ok(!rows[0].classList.contains('rga-shell-scene-navigator-row-current'));
  assert.ok(rows[1].classList.contains('rga-shell-scene-navigator-row-current'));
});

test('scrollToScene(nodeId) calls Rga.Nav.findScene and dispatches a selection transaction', () => {
  const { Rga, stub } = boot({
    scenes: [{ nodeId: 'sc-1', sceneNumber: 1, headingDisplay: 'A', pmPos: 42, pmEndPos: 100 }]
  });
  const ok = Rga.Shell.SceneNavigator.scrollToScene('sc-1');
  assert.equal(ok, true);
  assert.equal(stub.findSceneCall, 'sc-1');
  assert.deepEqual(stub.dispatchCall, { kind: 'setSelection' });
});

test('scrollToScene(unknown) returns false safely without throwing', () => {
  const { Rga } = boot({
    scenes: [{ nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0, pmEndPos: 10 }]
  });
  const ok = Rga.Shell.SceneNavigator.scrollToScene('ghost');
  assert.equal(ok, false);
});

test('clicking a row triggers scrollToScene for that row\'s nodeId', () => {
  const { Rga, host, stub } = boot({
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const rowB = host.querySelector('[data-scene-node-id="b"]');
  rowB.click();
  assert.equal(stub.findSceneCall, 'b');
});

test('current-scene mark updates when ScriptSession notifies of a scene change', () => {
  const { Rga, host, stub } = boot({
    cursor: 5,
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  assert.ok(host.querySelector('[data-scene-node-id="a"]').classList.contains('rga-shell-scene-navigator-row-current'));
  // Move cursor → re-fire selectionchange → re-render.
  stub.view.state.selection.from = 20;
  stub.view.state.selection.to = 20;
  document.dispatchEvent(new Event('selectionchange'));
  const rowsAfter = host.querySelectorAll('.rga-shell-scene-navigator-row');
  assert.ok(!rowsAfter[0].classList.contains('rga-shell-scene-navigator-row-current'));
  assert.ok(rowsAfter[1].classList.contains('rga-shell-scene-navigator-row-current'));
});

// ----------------------------------------------------------------
// Slice 2 — keyboard navigation + focusRow API
// ----------------------------------------------------------------
// CRITICAL INVARIANT: current-scene indicator (cursor) and selected row
// (keyboard) are separate states. Tests below assert they never collapse.

function fireKey(container, key) {
  const ev = new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: key });
  container.dispatchEvent(ev);
  return ev;
}

test('Slice 2: ArrowDown moves selected row WITHOUT moving the editor cursor', () => {
  const { Rga, host, stub } = boot({
    cursor: 5,  // cursor inside scene 'a'
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  // Cursor is in scene 'a' → current-scene mark is on row 'a'.
  assert.ok(host.querySelector('[data-scene-node-id="a"]').classList.contains('rga-shell-scene-navigator-row-current'));
  // No row is keyboard-selected yet.
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), null);
  // Press ArrowDown — selects row 'a' (index 0).
  fireKey(host, 'ArrowDown');
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), 'a');
  // Press ArrowDown again — selects row 'b'.
  fireKey(host, 'ArrowDown');
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), 'b');
  // Editor cursor did NOT move (stub.view.state.selection.from is still 5).
  assert.equal(stub.view.state.selection.from, 5);
  // Current-scene indicator STILL points to 'a' (cursor's scene), not 'b' (selected).
  const rows = host.querySelectorAll('.rga-shell-scene-navigator-row');
  assert.ok(rows[0].classList.contains('rga-shell-scene-navigator-row-current'), 'row a keeps current-scene mark');
  assert.ok(rows[1].classList.contains('rga-shell-scene-navigator-row-selected'), 'row b carries selected mark');
  assert.ok(!rows[1].classList.contains('rga-shell-scene-navigator-row-current'), 'row b is NOT current');
  assert.ok(!rows[0].classList.contains('rga-shell-scene-navigator-row-selected'), 'row a is NOT selected');
});

test('Slice 2: ArrowUp moves selection backward; Home/End jump to first/last', () => {
  const { Rga, host } = boot({
    cursor: 0,
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 20 },
      { nodeId: 'c', sceneNumber: 3, headingDisplay: 'C', pmPos: 20, pmEndPos: 30 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  fireKey(host, 'End');
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), 'c');
  fireKey(host, 'ArrowUp');
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), 'b');
  fireKey(host, 'Home');
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), 'a');
});

test('Slice 2: Enter on the selected row dispatches scrollToScene for that row', () => {
  const { Rga, host, stub } = boot({
    cursor: 0,
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'sc-target', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  fireKey(host, 'ArrowDown');  // select 'a'
  fireKey(host, 'ArrowDown');  // select 'sc-target'
  fireKey(host, 'Enter');
  assert.equal(stub.findSceneCall, 'sc-target');
});

test('Slice 2: Escape clears the selected row state', () => {
  const { Rga, host } = boot({
    scenes: [{ nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0, pmEndPos: 10 }]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  fireKey(host, 'ArrowDown');
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), 'a');
  fireKey(host, 'Escape');
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), null);
});

test('Slice 2: focusRow(nodeId) sets the selected row WITHOUT moving the cursor', () => {
  const { Rga, stub, host } = boot({
    cursor: 0,
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const before = stub.view.state.selection.from;
  const ok = Rga.Shell.SceneNavigator.focusRow('b');
  assert.equal(ok, true);
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), 'b');
  // Editor cursor not touched.
  assert.equal(stub.view.state.selection.from, before);
  // findSceneCall is null because focusRow does NOT trigger scrollToScene.
  assert.equal(stub.findSceneCall, null);
});

test('Slice 2: SEPARATION INVARIANT — selected row and current scene can co-exist independently', () => {
  const { Rga, host } = boot({
    cursor: 5,  // inside scene 'a'
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  // State: row 'a' has current-scene mark; no row has selected mark.
  Rga.Shell.SceneNavigator.focusRow('b');
  // State: row 'a' has current-scene mark; row 'b' has selected mark.
  const rows = host.querySelectorAll('.rga-shell-scene-navigator-row');
  assert.ok(rows[0].classList.contains('rga-shell-scene-navigator-row-current'));
  assert.ok(!rows[0].classList.contains('rga-shell-scene-navigator-row-selected'));
  assert.ok(!rows[1].classList.contains('rga-shell-scene-navigator-row-current'));
  assert.ok(rows[1].classList.contains('rga-shell-scene-navigator-row-selected'));
  // Now focus same row as cursor → both classes on row 'a'.
  Rga.Shell.SceneNavigator.focusRow('a');
  const rowsAfter = host.querySelectorAll('.rga-shell-scene-navigator-row');
  assert.ok(rowsAfter[0].classList.contains('rga-shell-scene-navigator-row-current'));
  assert.ok(rowsAfter[0].classList.contains('rga-shell-scene-navigator-row-selected'));
  // Classes are independently applied; no collapse.
});

// ----------------------------------------------------------------
// SN.1 — auto-scroll current row into view on scene transition
// ----------------------------------------------------------------
// The current-scene marker is the writer's "you are here" cue. It only
// helps if "here" is visible. SN.1 makes the navigator scroll the current
// row into view when the cursor crosses a scene boundary, while leaving
// selection-driven scroll, click-to-jump, and the separation invariant
// untouched. Tests below install a per-DOM spy on Element.prototype.
// scrollIntoView so each call's target classList can be inspected.

function installScrollSpy() {
  const calls = [];
  global.window.Element.prototype.scrollIntoView = function(opts) {
    calls.push({ on: this.className || '', opts: opts });
  };
  // sn1Calls() isolates the SN.1 code path from _setSelected's selected-row
  // scroll. Both pass `block: 'nearest'`, so the only argument-level
  // distinguisher is the SN.1-only `behavior: 'auto'` opt. We also require
  // the target row to carry the current-scene class — defensive against
  // future code that might pass `behavior: 'auto'` from a different path.
  return {
    calls: calls,
    sn1Calls: function() {
      return calls.filter(function(c) {
        return c.opts && c.opts.behavior === 'auto'
            && c.on.indexOf('rga-shell-scene-navigator-row-current') >= 0;
      });
    },
    reset: function() { calls.length = 0; }
  };
}

test('SN.1: current row scrolls into view when ScriptSession transitions to a new current scene', () => {
  const { Rga, stub } = boot({
    cursor: 5,  // inside scene 'a'
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 }
    ]
  });
  // Install spy AFTER boot — `boot()` replaces global.window, so the spy
  // must target the NEW window's Element.prototype to be picked up by the
  // elements rendered by Sidebar.activate below.
  const spy = installScrollSpy();
  Rga.Shell.Sidebar.activate('sceneNavigator');
  // Initial mount: a is the current scene → scrolled into view once.
  const initial = spy.sn1Calls();
  assert.equal(initial.length, 1, 'initial mount scrolls the current row into view');
  assert.deepEqual(initial[0].opts, { behavior: 'auto', block: 'nearest' });
  spy.reset();
  // Move cursor into scene 'b'. ScriptSession re-derives current → re-render.
  stub.view.state.selection.from = 20;
  stub.view.state.selection.to = 20;
  document.dispatchEvent(new window.Event('selectionchange'));
  // Transition into a new current scene → exactly one current-row scroll.
  const transition = spy.sn1Calls();
  assert.equal(transition.length, 1, 'scene transition scrolls the new current row');
  assert.deepEqual(transition[0].opts, { behavior: 'auto', block: 'nearest' });
});

test('SN.1: no auto-scroll when re-render fires but the current scene is unchanged', () => {
  const { Rga } = boot({
    cursor: 5,
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  // Install spy AFTER mount so the initial-mount scroll is not counted.
  const spy = installScrollSpy();
  // Multiple incidental re-renders with the same current scene.
  Rga.Shell.SceneNavigator._render();
  Rga.Shell.SceneNavigator._render();
  Rga.Shell.SceneNavigator._render();
  assert.equal(spy.sn1Calls().length, 0,
    'identical-current re-renders must not trigger scroll');
});

test('SN.1: keyboard selection does NOT trigger current-row auto-scroll', () => {
  const { Rga, host } = boot({
    cursor: 5,  // cursor stays in scene 'a' throughout
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 },
      { nodeId: 'c', sceneNumber: 3, headingDisplay: 'C', pmPos: 30, pmEndPos: 50 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const spy = installScrollSpy();  // installed after mount → clean slate
  // Walk the keyboard selection forward — cursor (and therefore current) stays in 'a'.
  fireKey(host, 'ArrowDown');  // select 'a'
  fireKey(host, 'ArrowDown');  // select 'b'
  fireKey(host, 'ArrowDown');  // select 'c'
  // Selected scrolls fire on the SELECTED row, never on the current row.
  assert.equal(spy.sn1Calls().length, 0,
    'keyboard selection must not touch the current-row scroll');
  // Sanity: selected state advanced; current state unchanged.
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), 'c');
  const rows = host.querySelectorAll('.rga-shell-scene-navigator-row');
  assert.ok(rows[0].classList.contains('rga-shell-scene-navigator-row-current'),
    'a stays current — cursor never moved');
  assert.ok(rows[2].classList.contains('rga-shell-scene-navigator-row-selected'),
    'c carries the selected mark');
});

test('SN.1: separation invariant holds when current transitions while a different row is selected', () => {
  const { Rga, host, stub } = boot({
    cursor: 5,  // cursor in scene 'a'
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 },
      { nodeId: 'c', sceneNumber: 3, headingDisplay: 'C', pmPos: 30, pmEndPos: 50 }
    ]
  });
  // Install spy AFTER boot (see note in the transition test above).
  const spy = installScrollSpy();
  Rga.Shell.Sidebar.activate('sceneNavigator');
  // Keyboard-select row 'c' while cursor (current) stays in 'a'.
  fireKey(host, 'End');
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), 'c');
  spy.reset();
  // Now move the cursor into scene 'b' — current transitions 'a' → 'b'.
  stub.view.state.selection.from = 20;
  stub.view.state.selection.to = 20;
  document.dispatchEvent(new window.Event('selectionchange'));
  // Auto-scroll fires on row 'b' (the new current). Selected row 'c' is preserved.
  const transition = spy.sn1Calls();
  assert.equal(transition.length, 1, 'current-row scroll fires for the transitioned scene');
  const rows = host.querySelectorAll('.rga-shell-scene-navigator-row');
  assert.ok(!rows[0].classList.contains('rga-shell-scene-navigator-row-current'),
    'a is no longer current');
  assert.ok(rows[1].classList.contains('rga-shell-scene-navigator-row-current'),
    'b is current');
  assert.ok(rows[2].classList.contains('rga-shell-scene-navigator-row-selected'),
    'c remains the keyboard-selected row');
  assert.ok(!rows[1].classList.contains('rga-shell-scene-navigator-row-selected'),
    'b is not selected');
  assert.ok(!rows[2].classList.contains('rga-shell-scene-navigator-row-current'),
    'c is not current');
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), 'c',
    'selected nodeId survives the auto-scroll');
});

test('SN.1: unmount clears the last-current tracker so a fresh re-mount scrolls again', () => {
  const { Rga } = boot({
    cursor: 5,
    scenes: [{ nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0, pmEndPos: 10 }]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  // Spy installed AFTER initial mount.
  const spy = installScrollSpy();
  Rga.Shell.Sidebar.deactivate();
  // Re-activate → fresh mount on the same nodeId must still scroll (unmount cleared tracker).
  Rga.Shell.Sidebar.activate('sceneNavigator');
  assert.equal(spy.sn1Calls().length, 1,
    'fresh mount after unmount scrolls current row even if nodeId is unchanged');
});
