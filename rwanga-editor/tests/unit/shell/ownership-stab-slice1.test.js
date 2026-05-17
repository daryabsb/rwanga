// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Runtime Ownership Stabilization Slice 1 — regression tests.
//
// Covers acceptance criteria for sections A (Bottom Panel), B (Draft
// mode), and C (Scene Navigator) in the slice brief. Tests exercise
// the public surfaces ONLY — no engine internals.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// ----------------------------------------------------------------
// Shared boot harness (minimal — only the modules each test needs).
// ----------------------------------------------------------------

function freshJSDOM(html, opts) {
  opts = opts || {};
  const dom = new JSDOM(html, { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  global.window.Rga = {};
  global.Rga = global.window.Rga;  // app-shell.js uses bare `Rga`
  return dom;
}

function fresh$Helpers() {
  global.window.Rga.$  = function(sel, root) { return (root || document).querySelector(sel); };
  global.window.Rga.$$ = function(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  global.window.Rga.Keyboard = { register: function() {} };
  global.window.Rga.Shell = global.window.Rga.Shell || {};
}

function reloadModules(paths) {
  paths.forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
}

// ================================================================
// A — Bottom Panel ownership
// ================================================================

test('A: open → close → reopen all converge on Rga.Shell.Layout.studioPanel.visible (SSOT)', () => {
  freshJSDOM(
    '<!DOCTYPE html><html><body>' +
    '<div id="center-column"><div id="bottom-panel"></div></div>' +
    '<button id="btn-close-bottom-panel"></button>' +
    '</body></html>'
  );
  fresh$Helpers();
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/studio-panel.js',
    '../../../renderer/js/app-shell.js'
  ]);
  const Rga = global.window.Rga;
  Rga.BottomPanel.init();

  // Initial: open (legacy DOM default; no persisted value yet).
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, true,    'initial: SSOT says visible');
  assert.equal(document.getElementById('center-column').classList.contains('bottom-collapsed'), false, 'initial: DOM open');

  // Close via toggleCollapse (the public API).
  Rga.BottomPanel.toggleCollapse();
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, false,   'after close: SSOT says hidden');
  assert.equal(document.getElementById('center-column').classList.contains('bottom-collapsed'), true,  'after close: DOM follows');

  // Reopen via toggleCollapse.
  Rga.BottomPanel.toggleCollapse();
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, true,    'after reopen: SSOT says visible');
  assert.equal(document.getElementById('center-column').classList.contains('bottom-collapsed'), false, 'after reopen: DOM open');
});

test('A: visibility persists across reload via the workspace blob (Slice 4 §A migration)', () => {
  // Session 1 — set to closed, then verify the workspace blob is
  // written (replaces the pre-Slice-4 scoped key `rga-shell-studio-
  // panel-visible`).
  freshJSDOM(
    '<!DOCTYPE html><html><body>' +
    '<div id="center-column"><div id="bottom-panel"></div></div>' +
    '</body></html>'
  );
  fresh$Helpers();
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/workspace-state.js',
    '../../../renderer/js/shell/studio-panel.js',
    '../../../renderer/js/app-shell.js'
  ]);
  let Rga = global.window.Rga;
  Rga.WorkspaceState.init();
  Rga.BottomPanel.init();
  Rga.BottomPanel.toggleCollapse();  // open → closed
  const blob1 = JSON.parse(localStorage.getItem('rga-workspace-layout'));
  assert.equal(blob1 && blob1.studioPanel && blob1.studioPanel.visible, false,
    'workspace blob records studioPanel.visible = false after close');
  // Scoped key from earlier slices must NOT appear under the new owner.
  assert.equal(localStorage.getItem('rga-shell-studio-panel-visible'), null,
    'legacy scoped key is not used as a primary writer after Slice 4');

  const persistedRaw = localStorage.getItem('rga-workspace-layout');

  // Session 2 — fresh DOM, fresh modules, seeded workspace blob.
  freshJSDOM(
    '<!DOCTYPE html><html><body>' +
    '<div id="center-column"><div id="bottom-panel"></div></div>' +
    '</body></html>'
  );
  fresh$Helpers();
  localStorage.setItem('rga-workspace-layout', persistedRaw);
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/workspace-state.js',
    '../../../renderer/js/shell/studio-panel.js',
    '../../../renderer/js/app-shell.js'
  ]);
  Rga = global.window.Rga;
  Rga.WorkspaceState.init();
  Rga.BottomPanel.init();
  // Session 2 boots with the panel hidden (persisted state).
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, false,
    'session 2 boots with hidden panel because session 1 persisted closed state');
  assert.equal(document.getElementById('center-column').classList.contains('bottom-collapsed'), true,
    'session 2 DOM matches persisted state');
});

test('A: switchTo(tabName) forces visible=true via the same single mutator surface', () => {
  freshJSDOM(
    '<!DOCTYPE html><html><body>' +
    '<div id="center-column" class="bottom-collapsed">' +
      '<div id="bottom-panel">' +
        '<button class="bp-tab" data-bp-tab="notes"></button>' +
        '<div class="bp-content" data-bp-tab="notes"></div>' +
      '</div>' +
    '</div>' +
    '</body></html>'
  );
  fresh$Helpers();
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/studio-panel.js',
    '../../../renderer/js/app-shell.js'
  ]);
  const Rga = global.window.Rga;
  // Slice 4 §A: simulate WorkspaceState having restored a closed
  // state. BottomPanel.init no longer reads the DOM as a fallback;
  // Layout is the SSOT.
  Rga.Shell.Layout.set({ studioPanel: { visible: false } });
  Rga.BottomPanel.init();
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, false,
    'pre-condition: Layout (restored by WorkspaceState in real boot) says closed');

  // switchTo opens via this.open() → Layout.set → DOM follows.
  Rga.BottomPanel.switchTo('notes');
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, true,
    'switchTo must open the panel via the Layout mutator');
  assert.equal(document.getElementById('center-column').classList.contains('bottom-collapsed'), false);
});

// ================================================================
// B — Draft mode ownership
// ================================================================

test('B: Flow → Draft → exitDraft → Flow round-trip with NO orphan body classes', () => {
  freshJSDOM('<!DOCTYPE html><html><body><div id="editor-container"></div></body></html>');

  // Real ViewManager (not a stub) so the body-class side effect runs.
  reloadModules([
    '../../../renderer/js/framework/view-manager.js',
    '../../../renderer/js/view-mode.js'
  ]);
  const Rga = global.window.Rga;
  Rga.ViewManager._reset && Rga.ViewManager._reset();
  Rga.ViewMode.init();

  // Initial: Flow (no body class).
  assert.equal(Rga.ViewMode.get(), 'flow');
  assert.equal(document.body.classList.contains('view-draft-active'), false);
  assert.equal(document.body.classList.contains('view-print-active'), false);

  // Activate Draft via the status-bar-style bypass (ViewManager directly).
  Rga.ViewManager.activate('draft');
  assert.equal(document.body.classList.contains('view-draft-active'), true, 'Draft activated → body class applied');

  // ViewMode tracked the change via onChange.
  assert.equal(Rga.ViewMode.get(), 'draft', 'ViewMode.current syncs from ViewManager');

  // Exit Draft via the public exitDraft API (Esc / X both hit this).
  Rga.ViewMode.exitDraft();
  assert.equal(Rga.ViewMode.get(), 'flow', 'exitDraft returns to flow');
  assert.equal(document.body.classList.contains('view-draft-active'), false,
    'exiting Draft must remove view-draft-active body class — no orphan');
});

test('B: status-bar-style cycle into Print and back leaves no orphan body classes', () => {
  freshJSDOM('<!DOCTYPE html><html><body><div id="editor-container"></div></body></html>');
  reloadModules([
    '../../../renderer/js/framework/view-manager.js',
    '../../../renderer/js/view-mode.js'
  ]);
  const Rga = global.window.Rga;
  Rga.ViewManager._reset && Rga.ViewManager._reset();
  Rga.ViewMode.init();

  Rga.ViewManager.activate('print');
  assert.equal(document.body.classList.contains('view-print-active'), true);
  assert.equal(document.body.classList.contains('view-draft-active'), false);

  Rga.ViewManager.activate('flow');
  assert.equal(document.body.classList.contains('view-print-active'), false,
    'returning to flow must clear view-print-active');
  assert.equal(document.body.classList.contains('view-draft-active'), false);
});

test('B: Escape key exits Draft without reload (handler attached to document.keydown)', () => {
  freshJSDOM('<!DOCTYPE html><html><body><div id="editor-container"></div></body></html>');
  // Slice 3 §B G1: ViewMode registers Escape via Rga.KeyboardRegistry
  // only (no document.keydown fallback). Load the registry first so
  // the registration lands.
  reloadModules([
    '../../../renderer/js/shell/keyboard-registry.js',
    '../../../renderer/js/framework/view-manager.js',
    '../../../renderer/js/view-mode.js'
  ]);
  const Rga = global.window.Rga;
  Rga.KeyboardRegistry._reset();
  Rga.KeyboardRegistry.init();
  Rga.ViewManager._reset && Rga.ViewManager._reset();
  Rga.ViewMode.init();
  Rga.ViewManager.activate('draft');
  assert.equal(Rga.ViewMode.get(), 'draft');

  // Dispatch a real Escape keydown — the registry's handler must fire
  // and call exitDraft via the `when` predicate.
  const ev = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.dispatchEvent(ev);
  assert.equal(Rga.ViewMode.get(), 'flow', 'Escape exited Draft');
  assert.equal(document.body.classList.contains('view-draft-active'), false);
});

// ================================================================
// C — Scene Navigator wiring (scale tests)
// ================================================================

function bootSceneNavigator(scenes, cursorPos) {
  freshJSDOM('<!DOCTYPE html><html><body><div id="rail"></div><div id="host"></div></body></html>');
  global.window.Rga = {};
  global.Rga = global.window.Rga;

  // Stub PM so the test can dispatch / assert without loading the
  // 400KB editor bundle. Same shape the scene-navigator panel reads.
  let lastDispatched = null;
  let focusCalls = 0;
  let nodeDOMScrollCalls = 0;
  global.window.RgaProseMirror = {
    TextSelection: {
      near: function($pos) { return { __selection: true, from: $pos.pos }; }
    }
  };
  const view = {
    state: {
      doc: {
        resolve: function(pos) { return { pos: pos, parent: { type: { name: 'scene' } } }; }
      },
      selection: { from: cursorPos != null ? cursorPos : 0, to: cursorPos != null ? cursorPos : 0, empty: true },
      tr: {
        setSelection: function(sel) { this._sel = sel; return this; },
        scrollIntoView: function() { this._scrolled = true; return this; }
      }
    },
    dispatch: function(tr) { lastDispatched = tr; },
    nodeDOM: function(pmPos) {
      return {
        scrollIntoView: function(opts) {
          nodeDOMScrollCalls += 1;
          this._lastOpts = opts;
        }
      };
    },
    focus: function() { focusCalls += 1; }
  };
  global.window.Rga.TabManager  = { activeDoc: function() { return null; }, _editorView: function() { return view; } };
  global.window.Rga.ViewManager = { current: function() { return 'flow'; }, onChange: function() { return function() {}; } };
  // Nav stub backed by the provided scenes array.
  global.window.Rga.Nav = {
    getIndex: function() { return { scenes: scenes, pages: [] }; },
    getPageMap: function() { return []; },
    findScene: function(doc, nodeId) {
      for (let i = 0; i < scenes.length; i += 1) {
        if (scenes[i].nodeId === nodeId) return scenes[i].pmPos;
      }
      return null;
    },
    getOutline: function() { return { statistics: { words: 0 } }; }
  };

  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/sidebar.js',
    '../../../renderer/js/shell/script-session.js',
    '../../../renderer/js/shell/panels/scene-navigator.js'
  ]);
  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  Rga.ScriptSession._reset();
  Rga.Shell.Sidebar.setHost(document.getElementById('host'));
  // Re-require scene-navigator so its IIFE re-registers after _reset.
  delete require.cache[require.resolve('../../../renderer/js/shell/panels/scene-navigator.js')];
  require('../../../renderer/js/shell/panels/scene-navigator.js');
  Rga.ScriptSession.init();
  Rga.Shell.Sidebar.activate('sceneNavigator');

  return {
    Rga: Rga,
    host: document.getElementById('host'),
    getDispatched: function() { return lastDispatched; },
    getFocusCalls: function() { return focusCalls; },
    getNodeDOMScrollCalls: function() { return nodeDOMScrollCalls; }
  };
}

function makeScenes(count) {
  const arr = [];
  let pos = 0;
  for (let i = 1; i <= count; i += 1) {
    const span = 50;
    arr.push({
      nodeId: 'sc-' + i,
      sceneNumber: i,
      headingDisplay: 'INT. SCENE ' + i + ' — DAY',
      pmPos: pos,
      pmEndPos: pos + span
    });
    pos += span;
  }
  return arr;
}

test('C: Scene 1 — click on first scene dispatches selection + scrolls + focuses', () => {
  const env = bootSceneNavigator(makeScenes(5));
  const row = env.host.querySelector('[data-scene-node-id="sc-1"]');
  assert.ok(row, 'row for sc-1 must render');
  row.click();
  const tr = env.getDispatched();
  assert.ok(tr, 'dispatch must have been called');
  assert.ok(tr._sel, 'transaction must carry a selection');
  assert.equal(tr._scrolled, true, 'transaction must request PM scrollIntoView');
  assert.equal(env.getNodeDOMScrollCalls(), 1, 'DOM scrollIntoView backup must run exactly once');
  assert.ok(env.getFocusCalls() >= 1, 'view.focus must be called so the editor receives keystrokes');
});

test('C: Scene 20 — mid-doc navigation in a 50-scene file', () => {
  const env = bootSceneNavigator(makeScenes(50));
  const row = env.host.querySelector('[data-scene-node-id="sc-20"]');
  assert.ok(row, 'row for sc-20 must render');
  row.click();
  const tr = env.getDispatched();
  assert.ok(tr, 'dispatch called');
  // Selection should land at pmPos+1 (cursor inside scene 20).
  // makeScenes uses span 50 per scene → sc-20 has pmPos = (20-1)*50 = 950.
  assert.equal(tr._sel.from, 950 + 1, 'selection lands at pmPos+1 for scene 20');
  assert.equal(env.getNodeDOMScrollCalls(), 1);
});

test('C: 100-scene file — clicking the last scene navigates correctly', () => {
  const env = bootSceneNavigator(makeScenes(100));
  const rows = env.host.querySelectorAll('[data-scene-node-id]');
  assert.equal(rows.length, 100, 'all 100 rows must render');
  const row = env.host.querySelector('[data-scene-node-id="sc-100"]');
  assert.ok(row, 'row for sc-100 must render');
  row.click();
  const tr = env.getDispatched();
  assert.ok(tr, 'dispatch called');
  assert.equal(tr._sel.from, (100 - 1) * 50 + 1, 'selection lands at pmPos+1 for scene 100');
  assert.equal(env.getNodeDOMScrollCalls(), 1, 'one DOM scrollIntoView backup per click');
});

test('C: scrollToScene with unknown nodeId returns false without dispatching', () => {
  const env = bootSceneNavigator(makeScenes(10));
  const ok = env.Rga.Shell.SceneNavigator.scrollToScene('does-not-exist');
  assert.equal(ok, false);
  assert.equal(env.getDispatched(), null, 'no dispatch for unknown nodeId');
});
