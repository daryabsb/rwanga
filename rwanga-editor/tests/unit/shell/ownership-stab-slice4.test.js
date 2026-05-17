// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Runtime Ownership Stabilization Slice 4 — regression tests.
// Covers acceptance for §A (Workspace persistence ownership / OI-3).
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
  global.window.Rga.$  = function(sel, root) { return (root || document).querySelector(sel); };
  global.window.Rga.$$ = function(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  return dom;
}

function reloadModules(paths) {
  paths.forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
}

const HTML_WORKSPACE =
  '<!DOCTYPE html><html><body>' +
  '<div id="center-column"><div id="bottom-panel"></div></div>' +
  '<aside id="sidebar"><div id="rga-shell-sidebar-host"></div></aside>' +
  '<aside id="inspector-panel"></aside>' +
  '<div class="resize-handle" data-resize="sidebar"></div>' +
  '<div class="resize-handle" data-resize="inspector"></div>' +
  '<div class="resize-handle" data-resize="bottom-panel"></div>' +
  '</body></html>';

// ----------------------------------------------------------------
// §A — Workspace persistence ownership
// ----------------------------------------------------------------

test('§A: Rga.WorkspaceState exists with the documented public API', () => {
  freshJSDOM();
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/workspace-state.js'
  ]);
  const Rga = global.window.Rga;
  assert.ok(Rga.WorkspaceState, 'Rga.WorkspaceState must exist (top-level alias)');
  assert.ok(Rga.Shell.WorkspaceState, 'Rga.Shell.WorkspaceState must exist (namespaced)');
  assert.equal(Rga.WorkspaceState, Rga.Shell.WorkspaceState, 'top-level alias must equal namespaced');
  ['init', '_save', '_hydrate', '_reset'].forEach(function(name) {
    assert.equal(typeof Rga.WorkspaceState[name], 'function',
      'Rga.WorkspaceState.' + name + ' must be a function');
  });
  assert.equal(Rga.WorkspaceState._STORAGE_KEY, 'rga-workspace-layout',
    'storage key must be the canonical workspace key');
});

test('§A: close + reopen + reload restores sidebar / studio panel / inspector / active panel / sizes', () => {
  // Session 1 — mutate every persisted field via Layout.set, then
  // verify the blob is written.
  freshJSDOM(HTML_WORKSPACE);
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/workspace-state.js'
  ]);
  let Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.WorkspaceState._reset();
  Rga.WorkspaceState.init();

  Rga.Shell.Layout.set({
    sidebar:     { visible: false, width: 320, activePanel: 'outline' },
    studioPanel: { visible: false, height: 280, activeTab: 'notes' },
    inspector:   { visible: false, width: 240 }
  });

  const blob = JSON.parse(localStorage.getItem('rga-workspace-layout'));
  assert.equal(blob.sidebar.visible, false);
  assert.equal(blob.sidebar.width, 320);
  assert.equal(blob.sidebar.activePanel, 'outline');
  assert.equal(blob.studioPanel.visible, false);
  assert.equal(blob.studioPanel.height, 280);
  assert.equal(blob.studioPanel.activeTab, 'notes');
  assert.equal(blob.inspector.visible, false);
  assert.equal(blob.inspector.width, 240);

  const persistedRaw = localStorage.getItem('rga-workspace-layout');

  // Session 2 — fresh DOM, fresh modules, seeded localStorage.
  freshJSDOM(HTML_WORKSPACE);
  localStorage.setItem('rga-workspace-layout', persistedRaw);
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/workspace-state.js'
  ]);
  Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.WorkspaceState._reset();
  Rga.WorkspaceState.init();

  const restored = Rga.Shell.Layout.get();
  assert.equal(restored.sidebar.visible, false,    'sidebar.visible restored');
  assert.equal(restored.sidebar.width, 320,        'sidebar.width restored');
  assert.equal(restored.sidebar.activePanel, 'outline', 'sidebar.activePanel restored');
  assert.equal(restored.studioPanel.visible, false, 'studioPanel.visible restored');
  assert.equal(restored.studioPanel.height, 280,    'studioPanel.height restored');
  assert.equal(restored.studioPanel.activeTab, 'notes', 'studioPanel.activeTab restored');
  assert.equal(restored.inspector.visible, false,   'inspector.visible restored');
  assert.equal(restored.inspector.width, 240,       'inspector.width restored');
});

test('§A: first boot with no persisted blob uses Layout DEFAULTS', () => {
  freshJSDOM(HTML_WORKSPACE);
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/workspace-state.js'
  ]);
  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.WorkspaceState._reset();
  // No localStorage.setItem before init — pristine boot.
  Rga.WorkspaceState.init();

  const s = Rga.Shell.Layout.get();
  assert.equal(s.sidebar.visible, true);
  assert.equal(s.sidebar.activePanel, 'sceneNavigator');
  assert.equal(s.studioPanel.visible, true);
  assert.equal(s.inspector.visible, true);
});

test('§A: legacy `rga-shell-studio-panel-visible` is migrated to the workspace blob on first boot', () => {
  freshJSDOM(HTML_WORKSPACE);
  // Pre-seed the legacy scoped key (closed).
  localStorage.setItem('rga-shell-studio-panel-visible', '0');
  // No workspace blob exists yet.
  assert.equal(localStorage.getItem('rga-workspace-layout'), null);

  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/workspace-state.js'
  ]);
  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.WorkspaceState._reset();
  Rga.WorkspaceState.init();

  // After migration: blob carries studioPanel.visible = false; legacy
  // key removed.
  const blob = JSON.parse(localStorage.getItem('rga-workspace-layout'));
  assert.equal(blob.studioPanel.visible, false, 'legacy value carried into workspace blob');
  assert.equal(localStorage.getItem('rga-shell-studio-panel-visible'), null,
    'legacy scoped key removed after migration');
  // Layout reflects the migrated value.
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, false);
});

test('§A: WorkspaceState writes ONLY rga-workspace-layout, never the legacy scoped key', () => {
  freshJSDOM(HTML_WORKSPACE);
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/workspace-state.js'
  ]);
  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.WorkspaceState._reset();
  Rga.WorkspaceState.init();

  // Toggle visibility several times to exercise the writer path.
  Rga.Shell.Layout.set({ studioPanel: { visible: false } });
  Rga.Shell.Layout.set({ studioPanel: { visible: true } });
  Rga.Shell.Layout.set({ sidebar:     { width: 400 } });

  // Only the workspace key should exist.
  assert.ok(localStorage.getItem('rga-workspace-layout'),
    'workspace key was written');
  assert.equal(localStorage.getItem('rga-shell-studio-panel-visible'), null,
    'legacy scoped key was NOT written by WorkspaceState');
});

test('§A: no duplicate persistence writers — only the workspace key is written, with no scoped-key leakage', () => {
  // Spy on localStorage.setItem via the Storage prototype so EVERY
  // call (including those inside required modules) is captured.
  freshJSDOM(HTML_WORKSPACE);
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/workspace-state.js'
  ]);
  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.WorkspaceState._reset();
  Rga.WorkspaceState.init();

  // Patch on the Storage prototype — JSDOM Storage methods are
  // inherited, not own; replacing the prototype method captures
  // every renderer call regardless of which view of `localStorage`
  // it resolves through.
  const writes = [];
  const proto = Object.getPrototypeOf(global.localStorage);
  const original = proto.setItem;
  proto.setItem = function(k, v) {
    writes.push({ key: k, value: v });
    return original.call(this, k, v);
  };
  try {
    Rga.Shell.Layout.set({ studioPanel: { visible: false } });
    Rga.Shell.Layout.set({ sidebar:     { width: 333 } });
  } finally {
    proto.setItem = original;
  }

  // Every captured write must be the workspace key. No scoped-panel
  // key, no rogue keys.
  writes.forEach(function(w) {
    assert.equal(w.key, 'rga-workspace-layout',
      'unexpected write to "' + w.key + '" — only rga-workspace-layout is permitted');
  });
  // Each Layout.set yields one save (no debouncing yet; OK for
  // discrete actions like toggle / drag-end).
  assert.equal(writes.length, 2,
    'one Layout.set must produce exactly one workspace write (got ' + writes.length + ' for 2 sets)');
});
