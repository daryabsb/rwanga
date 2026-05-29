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
   '../../../renderer/js/shell/icons-lucide.js',
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

// SN-Bundle-1 — empty-state copy refreshed to doc-type-neutral voice.
// Title stays "Scenes" (identity); body now describes what the catalogue
// will show, not the screenplay-specific slug-Enter mechanic.
test('mount with no scenes renders the empty state with SN-Bundle-1 doc-type-neutral copy', () => {
  const { Rga, host } = boot();
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const empty = host.querySelector('.rga-shell-panel-empty');
  assert.ok(empty, 'unified empty-state DOM rendered');
  assert.equal(empty.querySelector('.rga-shell-panel-empty-title').textContent, 'Scenes');
  assert.equal(empty.querySelector('.rga-shell-panel-empty-body').textContent,
    'Scenes will appear here as you write.');
  // True empty state must NOT show the header (the empty surface IS the
  // identity in this state) or the find input (nothing to find).
  assert.equal(host.querySelector('.rga-shell-scene-navigator-section-header'), null,
    'header is not rendered when there are zero scenes');
  assert.equal(host.querySelector('.rga-shell-scene-navigator-find-input'), null,
    'find input is not rendered when there are zero scenes');
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

// SN.2 — note indicator renders as the Lucide `square-pen` mark (inline
// SVG), not the old 📝 emoji. The container span keeps its aria-label
// for assistive tech (the Lucide SVG itself is aria-hidden).
test('rows with hasNotes=true show the note indicator as a Lucide square-pen SVG', () => {
  const { Rga, host } = boot({
    scenes: [{ nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0, pmEndPos: 10, hasNotes: true, hasRevisionFlag: false }]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const ind = host.querySelector('.rga-shell-scene-navigator-indicator');
  assert.ok(ind);
  assert.equal(ind.getAttribute('aria-label'), 'Has notes');
  assert.equal(ind.getAttribute('data-icon-name'), 'square-pen');
  const svg = ind.querySelector('svg');
  assert.ok(svg, 'note indicator renders as inline SVG (not emoji glyph)');
  // square-pen has TWO paths — the square outline + the pencil. This is
  // also the shape-distinguishability check vs flag-triangle-right (1 path).
  assert.equal(svg.querySelectorAll('path').length, 2, 'square-pen has 2 paths');
});

// SN.2 — revision indicator renders as the Lucide `flag-triangle-right`
// mark. Distinct shape from square-pen (1 path vs 2) so notes vs revision
// is tellable apart without relying on color (UX Direction §7).
test('rows with hasRevisionFlag=true show the revision indicator as a Lucide flag-triangle-right SVG', () => {
  const { Rga, host } = boot({
    scenes: [{ nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0, pmEndPos: 10, hasNotes: false, hasRevisionFlag: true }]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const inds = host.querySelectorAll('.rga-shell-scene-navigator-indicator');
  assert.equal(inds.length, 1);
  assert.equal(inds[0].getAttribute('aria-label'), 'Has revision flag');
  assert.equal(inds[0].getAttribute('data-icon-name'), 'flag-triangle-right');
  const svg = inds[0].querySelector('svg');
  assert.ok(svg, 'revision indicator renders as inline SVG (not emoji glyph)');
  assert.equal(svg.querySelectorAll('path').length, 1, 'flag-triangle-right has 1 path');
});

// SN.2 — when both indicators are present they sit in the documented
// order (notes first, revision second) and remain shape-distinguishable.
test('SN.2: both indicators present render in documented order with distinct shapes', () => {
  const { Rga, host } = boot({
    scenes: [{ nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0, pmEndPos: 10, hasNotes: true, hasRevisionFlag: true }]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const inds = host.querySelectorAll('.rga-shell-scene-navigator-indicator');
  assert.equal(inds.length, 2);
  assert.equal(inds[0].getAttribute('data-icon-name'), 'square-pen');
  assert.equal(inds[1].getAttribute('data-icon-name'), 'flag-triangle-right');
  // Shape-distinguishable structurally: different path counts.
  assert.notEqual(
    inds[0].querySelector('svg').querySelectorAll('path').length,
    inds[1].querySelector('svg').querySelectorAll('path').length,
    'notes and revision indicators must be shape-distinct, not just color-distinct'
  );
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

// ----------------------------------------------------------------
// SN-Bundle-1 — header + find/filter foundation
// ----------------------------------------------------------------
// Coverage: header renders count when scenes exist; find input present
// when scenes exist; filter by heading (case-insensitive) + by scene
// number; no-results surface with Clear affordance; Escape precedence
// (filter first, then selection); SEPARATION INVARIANT survives filter;
// SN.1 auto-scroll re-fires after Clear when current was filtered out.

function fireInput(input, value) {
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

test('SN-Bundle-1: header renders "Scenes" + count when scenes exist', () => {
  const { Rga, host } = boot({
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'INT. ROOM — DAY',     pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'EXT. STREET — NIGHT', pmPos: 10, pmEndPos: 30 },
      { nodeId: 'c', sceneNumber: 3, headingDisplay: 'INT. CAFÉ — DAY',     pmPos: 30, pmEndPos: 50 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const header = host.querySelector('.rga-shell-scene-navigator-section-header');
  assert.ok(header, 'header rendered above the scene list');
  assert.equal(
    header.querySelector('.rga-shell-scene-navigator-section-header-label').textContent,
    'Scenes');
  assert.equal(
    header.querySelector('.rga-shell-scene-navigator-section-header-count').textContent,
    ' · 3');
  // Header has no buttons / no actions — identity + count only (UX
  // Direction §9 forbids a button strip).
  assert.equal(header.querySelector('button'), null,
    'header carries no button — identity + count only');
});

test('SN-Bundle-1: find input rendered above list, placeholder + aria-label correct', () => {
  const { Rga, host } = boot({
    scenes: [{ nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0, pmEndPos: 10 }]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const input = host.querySelector('.rga-shell-scene-navigator-find-input');
  assert.ok(input, 'find input rendered');
  assert.equal(input.getAttribute('placeholder'), 'Find scene…');
  assert.equal(input.getAttribute('aria-label'), 'Find scene');
  assert.equal(input.value, '', 'find input starts empty');
});

test('SN-Bundle-1: find filters by heading (substring, case-insensitive)', () => {
  const { Rga, host } = boot({
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'INT. ROOM — DAY',       pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'EXT. STREET — NIGHT',   pmPos: 10, pmEndPos: 30 },
      { nodeId: 'c', sceneNumber: 3, headingDisplay: 'INT. ROOFTOP — NIGHT',  pmPos: 30, pmEndPos: 50 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const input = host.querySelector('.rga-shell-scene-navigator-find-input');
  fireInput(input, 'ROOF');
  const rows = host.querySelectorAll('.rga-shell-scene-navigator-row');
  assert.equal(rows.length, 1, 'only the matching row remains');
  assert.equal(rows[0].getAttribute('data-scene-node-id'), 'c');
  // Case-insensitivity: lowercase query matches uppercase heading.
  fireInput(input, 'street');
  const rows2 = host.querySelectorAll('.rga-shell-scene-navigator-row');
  assert.equal(rows2.length, 1);
  assert.equal(rows2[0].getAttribute('data-scene-node-id'), 'b');
  // Header count reflects the unfiltered total — orientation, not result count.
  assert.equal(
    host.querySelector('.rga-shell-scene-navigator-section-header-count').textContent,
    ' · 3');
});

test('SN-Bundle-1: find filters by scene number string', () => {
  const { Rga, host } = boot({
    scenes: [
      { nodeId: 'a', sceneNumber: 1,  headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 12, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 },
      { nodeId: 'c', sceneNumber: 22, headingDisplay: 'C', pmPos: 30, pmEndPos: 50 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const input = host.querySelector('.rga-shell-scene-navigator-find-input');
  // "2" matches scene 12 AND scene 22 (substring on number string).
  fireInput(input, '2');
  const rows = host.querySelectorAll('.rga-shell-scene-navigator-row');
  assert.equal(rows.length, 2);
  const ids = Array.from(rows).map(function(r) { return r.getAttribute('data-scene-node-id'); });
  assert.deepEqual(ids, ['b', 'c']);
});

test('SN-Bundle-1: no-results surface renders with query echo + Clear affordance', () => {
  const { Rga, host } = boot({
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'INT. ROOM — DAY', pmPos: 0, pmEndPos: 10 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const input = host.querySelector('.rga-shell-scene-navigator-find-input');
  fireInput(input, 'xyz-impossible');
  // No matching rows.
  assert.equal(host.querySelectorAll('.rga-shell-scene-navigator-row').length, 0);
  // Unified empty-surface used for the no-results state (consistent voice).
  const empty = host.querySelector('.rga-shell-panel-empty');
  assert.ok(empty, 'no-results uses the unified .rga-shell-panel-empty surface');
  assert.equal(empty.querySelector('.rga-shell-panel-empty-title').textContent, 'No scenes found');
  assert.match(empty.querySelector('.rga-shell-panel-empty-body').textContent, /xyz-impossible/);
  // Clear affordance present.
  const clearBtn = empty.querySelector('.rga-shell-panel-empty-action');
  assert.ok(clearBtn, 'Clear button present in no-results state');
  assert.equal(clearBtn.textContent, 'Clear');
  // Header + find input still present — identity stays put through no-results.
  assert.ok(host.querySelector('.rga-shell-scene-navigator-section-header'),
    'header remains visible in no-results state');
  assert.ok(host.querySelector('.rga-shell-scene-navigator-find-input'),
    'find input remains visible in no-results state');
});

test('SN-Bundle-1: Clear affordance restores full list and clears filter input', () => {
  const { Rga, host } = boot({
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const input = host.querySelector('.rga-shell-scene-navigator-find-input');
  fireInput(input, 'nothing-matches');
  const clearBtn = host.querySelector('.rga-shell-panel-empty-action');
  clearBtn.click();
  assert.equal(host.querySelectorAll('.rga-shell-scene-navigator-row').length, 2,
    'full list restored');
  // Find input present + value cleared.
  const inputAfter = host.querySelector('.rga-shell-scene-navigator-find-input');
  assert.ok(inputAfter);
  assert.equal(inputAfter.value, '', 'find input value cleared');
});

test('SN-Bundle-1: Escape precedence — filter has text → first Escape clears filter (not selection)', () => {
  const { Rga, host } = boot({
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'INT. ROOM — DAY',     pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'EXT. STREET — NIGHT', pmPos: 10, pmEndPos: 30 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  // Keyboard-select row 'b' first.
  fireKey(host, 'ArrowDown');
  fireKey(host, 'ArrowDown');
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), 'b');
  // Apply a filter.
  const input = host.querySelector('.rga-shell-scene-navigator-find-input');
  fireInput(input, 'street');
  // First Escape — clears filter, selection preserved.
  fireKey(host, 'Escape');
  assert.equal(host.querySelector('.rga-shell-scene-navigator-find-input').value, '',
    'first Escape cleared the filter');
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), 'b',
    'first Escape did NOT clear selection (precedence: filter first)');
  // Second Escape — clears selection.
  fireKey(host, 'Escape');
  assert.equal(Rga.Shell.SceneNavigator.selectedRowNodeId(), null,
    'second Escape (filter empty) cleared selection — today\'s behaviour preserved');
});

test('SN-Bundle-1: SEPARATION INVARIANT holds across filtered renders', () => {
  const { Rga, host } = boot({
    cursor: 15,  // cursor inside scene 'b'
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'INT. ROOM — DAY',     pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'EXT. STREET — NIGHT', pmPos: 10, pmEndPos: 30 },
      { nodeId: 'c', sceneNumber: 3, headingDisplay: 'INT. CAFÉ — DAY',     pmPos: 30, pmEndPos: 50 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  // Keyboard-select scene 'c' while cursor is in 'b'.
  Rga.Shell.SceneNavigator.focusRow('c');
  // Filter to include both 'b' (current) and 'c' (selected) — substring 'T' hits both headings.
  const input = host.querySelector('.rga-shell-scene-navigator-find-input');
  fireInput(input, 'T');
  // Both classes still render on their respective rows.
  const rowB = host.querySelector('[data-scene-node-id="b"]');
  const rowC = host.querySelector('[data-scene-node-id="c"]');
  assert.ok(rowB && rowB.classList.contains('rga-shell-scene-navigator-row-current'),
    'current class preserved under filter');
  assert.ok(rowC && rowC.classList.contains('rga-shell-scene-navigator-row-selected'),
    'selected class preserved under filter');
  // They never collapse onto the same row.
  assert.ok(!rowB.classList.contains('rga-shell-scene-navigator-row-selected'));
  assert.ok(!rowC.classList.contains('rga-shell-scene-navigator-row-current'));
});

test('SN-Bundle-1: SN.1 auto-scroll re-fires after a Clear when current was filtered out', () => {
  const { Rga, host } = boot({
    cursor: 5,
    scenes: [
      { nodeId: 'a', sceneNumber: 1, headingDisplay: 'INT. ROOM — DAY',     pmPos: 0,  pmEndPos: 10 },
      { nodeId: 'b', sceneNumber: 2, headingDisplay: 'EXT. STREET — NIGHT', pmPos: 10, pmEndPos: 30 }
    ]
  });
  Rga.Shell.Sidebar.activate('sceneNavigator');
  // Install scroll spy AFTER initial mount so we measure only post-mount
  // transitions. sn1Calls() filters by behavior:'auto' + current-row class
  // — both required to distinguish SN.1 scrolls from _setSelected scrolls.
  const spy = installScrollSpy();
  const baseline = spy.sn1Calls().length;
  // Filter to exclude scene 'a' (current). _setFilter resets
  // _lastCurrentNodeId; the filtered render has no current row in DOM,
  // so SN.1's inner querySelector returns null and the scroll is skipped.
  const input = host.querySelector('.rga-shell-scene-navigator-find-input');
  fireInput(input, 'STREET');
  assert.equal(spy.sn1Calls().length, baseline,
    'SN.1 does not fire while current row is filtered out');
  // Clear filter — current row returns to DOM, _lastCurrentNodeId is still
  // null (was reset on the filter set), so SN.1 fires on the unfiltered render.
  fireInput(input, '');
  assert.ok(spy.sn1Calls().length > baseline,
    'SN.1 re-fires on filter clear so "you are here" is visible again');
});
