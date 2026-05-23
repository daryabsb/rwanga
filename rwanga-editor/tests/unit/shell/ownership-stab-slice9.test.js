// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Runtime Ownership Stabilization Slice 9 — regression tests.
// Covers §A (StudioPanel migration: BottomPanel / Inspector /
// SceneNotesConnector → Rga.Shell.StudioPanel + shims).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function freshJSDOM(html) {
  const dom = new JSDOM(html ||
    '<!DOCTYPE html><html><body>' +
    '<div id="workspace"><aside id="inspector-panel"></aside></div>' +
    '<div id="center-column"><div id="bottom-panel">' +
    '<button class="bp-tab" data-bp-tab="scene">Scene</button>' +
    '<button class="bp-tab" data-bp-tab="notes">Notes</button>' +
    '<button class="bp-tab" data-bp-tab="flags">Flags</button>' +
    '<div class="bp-content" data-bp-tab="scene"></div>' +
    '<div class="bp-content" data-bp-tab="notes"></div>' +
    '<div class="bp-content" data-bp-tab="flags"></div>' +
    '</div></div>' +
    '<button id="btn-close-bottom-panel"></button>' +
    '</body></html>',
    { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  global.window.Rga = {};
  global.Rga = global.window.Rga;
  global.window.Rga.$  = function(sel, root) { return (root || document).querySelector(sel); };
  global.window.Rga.$$ = function(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  global.window.Rga.Keyboard = { register: function() {} };
  return dom;
}

function bootStudioStack() {
  freshJSDOM();
  // Load order: Layout → WorkspaceState → StudioPanel → app-shell (shims).
  [
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/workspace-state.js',
    '../../../renderer/js/shell/studio-panel.js',
    '../../../renderer/js/app-shell.js'
  ].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.WorkspaceState._reset();
  Rga.Shell.StudioPanel._reset();
  Rga.WorkspaceState.init();
  Rga.Shell.StudioPanel.init();
  return Rga;
}

// ================================================================
// §A — StudioPanel public API + ownership
// ================================================================

test('§A: Rga.Shell.StudioPanel exists with the documented public API', () => {
  freshJSDOM();
  [
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/studio-panel.js'
  ].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  const Rga = global.window.Rga;
  assert.ok(Rga.Shell.StudioPanel, 'Rga.Shell.StudioPanel must exist');
  ['init', 'show', 'hide', 'toggle', 'switchTo', 'activeTab',
   'toggleInspector', 'openInspector'].forEach(function(name) {
    assert.equal(typeof Rga.Shell.StudioPanel[name], 'function',
      'Rga.Shell.StudioPanel.' + name + ' must be a function');
  });
});

// ================================================================
// §A — BottomPanel shim → StudioPanel
// ================================================================

test('§A: Rga.BottomPanel.toggleCollapse routes through StudioPanel → Layout (SSOT)', () => {
  const Rga = bootStudioStack();
  // Initial: open (DEFAULTS.studioPanel.visible = true).
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, true);
  Rga.BottomPanel.toggleCollapse();
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, false,
    'shim → StudioPanel.toggle → Layout flipped');
  assert.equal(document.getElementById('center-column').classList.contains('bottom-collapsed'), true,
    'DOM followed Layout via StudioPanel subscriber');
  Rga.BottomPanel.toggleCollapse();
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, true);
  assert.equal(document.getElementById('center-column').classList.contains('bottom-collapsed'), false);
});

test('§A: Rga.BottomPanel.switchTo (engine API) forces open + sets active tab + persists', () => {
  const Rga = bootStudioStack();
  Rga.BottomPanel.toggleCollapse();  // close first
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, false);

  // Engine plugin call shape.
  Rga.BottomPanel.switchTo('notes');
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, true,
    'switchTo forces visible: true');
  assert.equal(Rga.Shell.Layout.get().studioPanel.activeTab, 'notes',
    'activeTab persisted to Layout (Slice 9 §A — was lost on reload pre-Slice-9)');
  // DOM follows.
  assert.equal(document.querySelector('.bp-tab[data-bp-tab="notes"]').classList.contains('active'), true);
  assert.equal(document.querySelector('.bp-content[data-bp-tab="notes"]').classList.contains('active'), true);
  // The other tabs are NOT active.
  assert.equal(document.querySelector('.bp-tab[data-bp-tab="scene"]').classList.contains('active'), false);
});

test('§A: active tab restored across reload (workspace blob round-trip)', () => {
  // Session 1 — switch to flags, capture blob.
  let Rga = bootStudioStack();
  Rga.BottomPanel.switchTo('flags');
  const persistedRaw = localStorage.getItem('rga-workspace-layout');
  const blob = JSON.parse(persistedRaw);
  assert.equal(blob.studioPanel.activeTab, 'flags',
    'WorkspaceState persisted the activeTab change driven by switchTo');

  // Session 2 — fresh DOM + modules, seeded localStorage.
  freshJSDOM();
  localStorage.setItem('rga-workspace-layout', persistedRaw);
  [
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/workspace-state.js',
    '../../../renderer/js/shell/studio-panel.js',
    '../../../renderer/js/app-shell.js'
  ].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.WorkspaceState._reset();
  Rga.Shell.StudioPanel._reset();
  Rga.WorkspaceState.init();
  Rga.Shell.StudioPanel.init();

  assert.equal(Rga.Shell.Layout.get().studioPanel.activeTab, 'flags',
    'session 2 boots with the persisted activeTab');
  assert.equal(Rga.Shell.StudioPanel.activeTab(), 'flags',
    'StudioPanel.activeTab() reflects the restored value');
  // DOM reflects the restored tab.
  assert.equal(document.querySelector('.bp-tab[data-bp-tab="flags"]').classList.contains('active'), true,
    'session 2 DOM shows the flags tab as active');
});

// ================================================================
// §A — Inspector shim → StudioPanel (open() is the new method)
// ================================================================

test('§A: Rga.Inspector.open opens the inspector (NEW API — pre-Slice-9 was a defensively-guarded no-op)', () => {
  const Rga = bootStudioStack();
  const ws = document.getElementById('workspace');
  // Start hidden so we can verify open clears the class.
  ws.classList.add('inspector-collapsed');
  assert.equal(ws.classList.contains('inspector-collapsed'), true);

  Rga.Inspector.open();
  assert.equal(ws.classList.contains('inspector-collapsed'), false,
    'Rga.Inspector.open must remove inspector-collapsed (engine consumer context-menu.js calls this)');
});

test('§A: Rga.Inspector.toggle still toggles', () => {
  const Rga = bootStudioStack();
  const ws = document.getElementById('workspace');
  // Initial: visible (no .inspector-collapsed).
  assert.equal(ws.classList.contains('inspector-collapsed'), false);
  Rga.Inspector.toggle();
  assert.equal(ws.classList.contains('inspector-collapsed'), true);
  Rga.Inspector.toggle();
  assert.equal(ws.classList.contains('inspector-collapsed'), false);
});

// ================================================================
// §A — SceneNotesConnector deleted (zero callers; folded into StudioPanel)
// ================================================================

test('§A: Rga.SceneNotesConnector no longer exists (deleted Slice 9 §A)', () => {
  bootStudioStack();
  assert.equal(typeof global.window.Rga.SceneNotesConnector, 'undefined',
    'Rga.SceneNotesConnector was deleted; its behavior lives in Rga.Shell.StudioPanel now');
});

// ================================================================
// §A — Plugin compatibility (engine consumers must remain functional)
// ================================================================

test('§A: engine-plugin call shape preserved — Rga.BottomPanel.switchTo("notes") and ("flags") both work', () => {
  const Rga = bootStudioStack();
  // Simulate annotations.js call.
  Rga.BottomPanel.switchTo('notes');
  assert.equal(Rga.Shell.Layout.get().studioPanel.activeTab, 'notes');
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, true);
  // Simulate revision-flags.js call.
  Rga.BottomPanel.switchTo('flags');
  assert.equal(Rga.Shell.Layout.get().studioPanel.activeTab, 'flags');
  // Active-tab DOM updated.
  assert.equal(document.querySelector('.bp-tab[data-bp-tab="flags"]').classList.contains('active'), true);
});

test('§A: engine-plugin call shape preserved — Rga.Inspector.open() works (defensive guard satisfied)', () => {
  const Rga = bootStudioStack();
  // Engine consumer context-menu.js does:
  //   if (Rga.Inspector && Rga.Inspector.open) Rga.Inspector.open();
  // Both checks must pass + the call must have a visible effect.
  assert.ok(Rga.Inspector, 'Rga.Inspector exists');
  assert.equal(typeof Rga.Inspector.open, 'function',
    'Rga.Inspector.open is a function (defensive guard satisfied)');
  const ws = document.getElementById('workspace');
  ws.classList.add('inspector-collapsed');
  Rga.Inspector.open();
  assert.equal(ws.classList.contains('inspector-collapsed'), false,
    'Rga.Inspector.open opens the inspector');
});
