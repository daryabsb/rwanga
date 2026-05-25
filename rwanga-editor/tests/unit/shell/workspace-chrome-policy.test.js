// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Workspace chrome ownership — owned tests.
//
// Proves:
//   - Rga.Workspaces.register({ chrome }) normalizes the chrome field
//     with per-field defaults of true.
//   - TabManager._applyChromePolicy(tab) toggles the
//     `rga-hidden-by-workspace-policy` class on the three editor-only
//     chrome targets (#rga-shell-toolbar, #bottom-panel, #inspector-
//     panel) according to the policy. The class is PRESENT when the
//     surface is hidden by policy and ABSENT otherwise — no inline
//     display is mutated, so user-collapse / minimized / mode CSS
//     remain in charge of their own visibility levers.
//   - Document tabs always receive the full editor chrome.
//   - Workspace tabs receive whatever they declared at registration.
//   - Workspace tabs that did NOT declare a chrome field receive the
//     full editor chrome (backward compatibility).
//   - Settings workspace declares all three false.
//   - Switching from a hide-policy workspace back to a document tab
//     removes the class from every previously-hidden target.
'use strict';

const HIDDEN_CLASS = 'rga-hidden-by-workspace-policy';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bootDom() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
      '<div id="rga-shell-toolbar"></div>' +
      // Layout containers — TabManager._applyChromePolicy also toggles
      // grid-track-collapse classes on these (rga-workspace-hides-*).
      '<div id="workspace">' +
        '<div id="center-column">' +
          '<div id="editor-container">' +
            '<div id="tab-content-host"></div>' +
            '<div id="editor"></div>' +
          '</div>' +
          '<div id="bottom-panel"></div>' +
        '</div>' +
        '<div id="inspector-panel"></div>' +
      '</div>' +
      '<div id="tab-bar"></div>' +
    '</body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  dom.window.Rga = {};
  return dom;
}

function loadStack() {
  ['../../../renderer/js/shell/workspaces.js',
   '../../../renderer/js/tab-manager.js'
  ].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  return global.window.Rga;
}

// ----------------------------------------------------------------
// §1 — Rga.Workspaces.register normalizes chrome
// ----------------------------------------------------------------

test('chrome — register({}) without a chrome field gets all-true defaults', () => {
  bootDom();
  const Rga = loadStack();
  Rga.Workspaces.register({
    kind: 'plain', title: 'Plain', mount: function() {}
  });
  const reg = Rga.Workspaces.get('plain');
  assert.deepEqual(reg.chrome, { toolbar: true, bottomPanel: true, inspector: true });
});

test('chrome — register({ chrome: { toolbar: false } }) merges with defaults', () => {
  bootDom();
  const Rga = loadStack();
  Rga.Workspaces.register({
    kind: 'mixed', title: 'Mixed', mount: function() {},
    chrome: { toolbar: false }
  });
  const reg = Rga.Workspaces.get('mixed');
  assert.deepEqual(reg.chrome, { toolbar: false, bottomPanel: true, inspector: true });
});

test('chrome — register coerces truthy/falsy to strict booleans', () => {
  bootDom();
  const Rga = loadStack();
  Rga.Workspaces.register({
    kind: 'coerce', title: 'Coerce', mount: function() {},
    chrome: { toolbar: 0, bottomPanel: 1, inspector: '' }
  });
  const reg = Rga.Workspaces.get('coerce');
  assert.equal(reg.chrome.toolbar, false);
  assert.equal(reg.chrome.bottomPanel, true);
  assert.equal(reg.chrome.inspector, false);
});

test('chrome — settings workspace ships chrome:{false,false,false}', () => {
  bootDom();
  // settings-workspace.js depends on the full settings substrate,
  // workspaces, and keyboard-registry chain. Load them in order.
  ['../../../renderer/js/shell/keyboard-registry.js',
   '../../../renderer/js/shell/settings-validators.js',
   '../../../renderer/js/shell/settings-registry.js',
   '../../../renderer/js/shell/settings-layout.js',
   '../../../renderer/js/shell/settings-search.js',
   '../../../renderer/js/shell/settings-store.js',
   '../../../renderer/js/shell/workspaces.js',
   '../../../renderer/js/shell/workspaces/settings-workspace.js'
  ].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  const reg = global.window.Rga.Workspaces.get('settings');
  assert.ok(reg, 'settings workspace must be registered');
  assert.deepEqual(reg.chrome,
    { toolbar: false, bottomPanel: false, inspector: false },
    'settings must declare all three editor-chrome surfaces hidden');
});

// ----------------------------------------------------------------
// §2 — TabManager._applyChromePolicy toggles inline display
// ----------------------------------------------------------------

function hasHidden(id) {
  return document.getElementById(id).classList.contains(HIDDEN_CLASS);
}

test('chrome policy — document tab leaves all three targets visible (class absent)', () => {
  bootDom();
  const Rga = loadStack();
  // Pre-add the hidden class on the three targets so we can confirm
  // _applyChromePolicy actively REMOVES it (not just leaves alone).
  ['rga-shell-toolbar', 'bottom-panel', 'inspector-panel'].forEach(function(id) {
    document.getElementById(id).classList.add(HIDDEN_CLASS);
  });
  Rga.TabManager._applyChromePolicy({ kind: 'document' });
  assert.equal(hasHidden('rga-shell-toolbar'),  false);
  assert.equal(hasHidden('bottom-panel'),       false);
  assert.equal(hasHidden('inspector-panel'),    false);
});

test('chrome policy — null tab (empty state) leaves all three visible', () => {
  bootDom();
  const Rga = loadStack();
  ['rga-shell-toolbar', 'bottom-panel', 'inspector-panel'].forEach(function(id) {
    document.getElementById(id).classList.add(HIDDEN_CLASS);
  });
  Rga.TabManager._applyChromePolicy(null);
  assert.equal(hasHidden('rga-shell-toolbar'),  false);
  assert.equal(hasHidden('bottom-panel'),       false);
  assert.equal(hasHidden('inspector-panel'),    false);
});

test('chrome policy — workspace tab without a chrome field keeps all three visible', () => {
  bootDom();
  const Rga = loadStack();
  Rga.Workspaces.register({
    kind: 'plain', title: 'Plain', mount: function() {}
  });
  const reg = Rga.Workspaces.get('plain');
  // Pre-add the hidden class so a "no-op" wouldn't pass.
  document.getElementById('rga-shell-toolbar').classList.add(HIDDEN_CLASS);
  Rga.TabManager._applyChromePolicy({ kind: 'workspace', _registration: reg });
  assert.equal(hasHidden('rga-shell-toolbar'), false);
});

test('chrome policy — workspace tab with chrome:{false,false,false} hides all three', () => {
  bootDom();
  const Rga = loadStack();
  Rga.Workspaces.register({
    kind: 'blanker', title: 'Blanker', mount: function() {},
    chrome: { toolbar: false, bottomPanel: false, inspector: false }
  });
  const reg = Rga.Workspaces.get('blanker');
  Rga.TabManager._applyChromePolicy({ kind: 'workspace', _registration: reg });
  assert.equal(hasHidden('rga-shell-toolbar'),  true);
  assert.equal(hasHidden('bottom-panel'),       true);
  assert.equal(hasHidden('inspector-panel'),    true);
});

test('chrome policy — workspace tab with mixed policy hides only the declared-false targets', () => {
  bootDom();
  const Rga = loadStack();
  Rga.Workspaces.register({
    kind: 'mixed', title: 'Mixed', mount: function() {},
    chrome: { toolbar: false, bottomPanel: true, inspector: false }
  });
  const reg = Rga.Workspaces.get('mixed');
  Rga.TabManager._applyChromePolicy({ kind: 'workspace', _registration: reg });
  assert.equal(hasHidden('rga-shell-toolbar'),  true);
  assert.equal(hasHidden('bottom-panel'),       false);
  assert.equal(hasHidden('inspector-panel'),    true);
});

// ----------------------------------------------------------------
// §3 — Switching back restores chrome
// ----------------------------------------------------------------

test('chrome policy — activating doc after a chrome-hiding workspace restores all three', () => {
  bootDom();
  const Rga = loadStack();
  Rga.Workspaces.register({
    kind: 'blanker2', title: 'Blanker', mount: function() {},
    chrome: { toolbar: false, bottomPanel: false, inspector: false }
  });
  const reg = Rga.Workspaces.get('blanker2');
  // Workspace active → all hidden.
  Rga.TabManager._applyChromePolicy({ kind: 'workspace', _registration: reg });
  assert.equal(hasHidden('rga-shell-toolbar'),  true);
  assert.equal(hasHidden('bottom-panel'),       true);
  assert.equal(hasHidden('inspector-panel'),    true);
  // Document active → all restored.
  Rga.TabManager._applyChromePolicy({ kind: 'document' });
  assert.equal(hasHidden('rga-shell-toolbar'),  false);
  assert.equal(hasHidden('bottom-panel'),       false);
  assert.equal(hasHidden('inspector-panel'),    false);
});

// ----------------------------------------------------------------
// §4 — Idempotent application (calling twice does not toggle)
// ----------------------------------------------------------------

test('chrome policy — repeated application is idempotent', () => {
  bootDom();
  const Rga = loadStack();
  Rga.Workspaces.register({
    kind: 'idem', title: 'Idem', mount: function() {},
    chrome: { toolbar: false, bottomPanel: false, inspector: false }
  });
  const reg = Rga.Workspaces.get('idem');
  const synthetic = { kind: 'workspace', _registration: reg };
  Rga.TabManager._applyChromePolicy(synthetic);
  Rga.TabManager._applyChromePolicy(synthetic);
  Rga.TabManager._applyChromePolicy(synthetic);
  assert.equal(hasHidden('rga-shell-toolbar'),  true);
  assert.equal(hasHidden('bottom-panel'),       true);
  assert.equal(hasHidden('inspector-panel'),    true);
});

// ----------------------------------------------------------------
// §4b — Follow-up patch: class ownership semantics
// ----------------------------------------------------------------
// The single assertion explicitly required by the patch authorization:
// `rga-hidden-by-workspace-policy` is added when a workspace policy
// says hide, and removed when the next-active tab's policy says show.
// Plus a guard that the class never collides with sibling visibility
// classes (StudioPanel collapse, inspector-collapsed, mode toggles).

test('chrome policy (patch) — class is added on hide-policy then removed on show-policy', () => {
  bootDom();
  const Rga = loadStack();
  const toolbar = document.getElementById('rga-shell-toolbar');
  // Start clean: class is absent.
  assert.equal(toolbar.classList.contains(HIDDEN_CLASS), false,
    'pre-condition: hidden class absent');

  // Apply a hide-policy workspace tab — class must be ADDED.
  Rga.Workspaces.register({
    kind: 'hide-it', title: 'Hide It', mount: function() {},
    chrome: { toolbar: false, bottomPanel: false, inspector: false }
  });
  Rga.TabManager._applyChromePolicy({
    kind: 'workspace',
    _registration: Rga.Workspaces.get('hide-it')
  });
  assert.equal(toolbar.classList.contains(HIDDEN_CLASS), true,
    'hide-policy must ADD the rga-hidden-by-workspace-policy class');

  // Then activate a document tab — class must be REMOVED.
  Rga.TabManager._applyChromePolicy({ kind: 'document' });
  assert.equal(toolbar.classList.contains(HIDDEN_CLASS), false,
    'document tab must REMOVE the rga-hidden-by-workspace-policy class');
});

test('chrome policy (patch) — sibling visibility classes are untouched by the policy', () => {
  bootDom();
  const Rga = loadStack();
  const bottom = document.getElementById('bottom-panel');
  // Pre-seed sibling classes representing user-collapse / minimized /
  // mode state. The policy must not touch them in either direction.
  bottom.classList.add('bottom-collapsed', 'bottom-minimized', 'custom-mode');

  Rga.Workspaces.register({
    kind: 'sibling-check', title: 'Sibling', mount: function() {},
    chrome: { toolbar: true, bottomPanel: false, inspector: true }
  });
  Rga.TabManager._applyChromePolicy({
    kind: 'workspace',
    _registration: Rga.Workspaces.get('sibling-check')
  });
  // Hide class added, but sibling state preserved.
  assert.equal(bottom.classList.contains(HIDDEN_CLASS), true);
  assert.equal(bottom.classList.contains('bottom-collapsed'),  true);
  assert.equal(bottom.classList.contains('bottom-minimized'),  true);
  assert.equal(bottom.classList.contains('custom-mode'),       true);

  // Restore via doc tab. Hide class removed, sibling state still preserved.
  Rga.TabManager._applyChromePolicy({ kind: 'document' });
  assert.equal(bottom.classList.contains(HIDDEN_CLASS), false);
  assert.equal(bottom.classList.contains('bottom-collapsed'),  true);
  assert.equal(bottom.classList.contains('bottom-minimized'),  true);
  assert.equal(bottom.classList.contains('custom-mode'),       true);
});

// ----------------------------------------------------------------
// §5 — Missing target elements are tolerated
// ----------------------------------------------------------------

test('chrome policy — missing target elements do not throw', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = {};
  delete require.cache[require.resolve('../../../renderer/js/shell/workspaces.js')];
  delete require.cache[require.resolve('../../../renderer/js/tab-manager.js')];
  require('../../../renderer/js/shell/workspaces.js');
  require('../../../renderer/js/tab-manager.js');
  const Rga = global.window.Rga;
  Rga.Workspaces.register({
    kind: 'noop', title: 'No-op', mount: function() {},
    chrome: { toolbar: false, bottomPanel: false, inspector: false }
  });
  const reg = Rga.Workspaces.get('noop');
  // None of the three target ids exist — must not throw.
  assert.doesNotThrow(function() {
    Rga.TabManager._applyChromePolicy({ kind: 'workspace', _registration: reg });
  });
});

// ----------------------------------------------------------------
// §6 — Layout-track collapse classes on parent grid containers
// ----------------------------------------------------------------
// The per-element class hides the surface; the per-container classes
// collapse the fixed-size grid track that surface lives in, so the
// workspace renderer can grow into the freed space. Inspector lives
// in #workspace col 6 (var(--inspector-width)); bottom panel lives in
// #center-column row 3 (var(--bottom-panel-height)). Toolbar lives in
// an auto-sized row on #app and collapses naturally — no layout class.

const HIDES_INSPECTOR_CLASS    = 'rga-workspace-hides-inspector';
const HIDES_BOTTOM_PANEL_CLASS = 'rga-workspace-hides-bottom-panel';

test('layout policy — hide-all workspace adds both grid-collapse classes', () => {
  bootDom();
  const Rga = loadStack();
  Rga.Workspaces.register({
    kind: 'collapse-all', title: 'Collapse', mount: function() {},
    chrome: { toolbar: false, bottomPanel: false, inspector: false }
  });
  const reg = Rga.Workspaces.get('collapse-all');
  Rga.TabManager._applyChromePolicy({ kind: 'workspace', _registration: reg });

  const workspace    = document.getElementById('workspace');
  const centerColumn = document.getElementById('center-column');
  assert.equal(workspace.classList.contains(HIDES_INSPECTOR_CLASS),       true,
    '#workspace must carry rga-workspace-hides-inspector when inspector is hidden by policy');
  assert.equal(centerColumn.classList.contains(HIDES_BOTTOM_PANEL_CLASS), true,
    '#center-column must carry rga-workspace-hides-bottom-panel when bottomPanel is hidden by policy');
});

test('layout policy — document tab removes both grid-collapse classes', () => {
  bootDom();
  const Rga = loadStack();
  // Pre-seed the classes (simulating a prior workspace activation).
  document.getElementById('workspace').classList.add(HIDES_INSPECTOR_CLASS);
  document.getElementById('center-column').classList.add(HIDES_BOTTOM_PANEL_CLASS);
  Rga.TabManager._applyChromePolicy({ kind: 'document' });
  assert.equal(document.getElementById('workspace').classList.contains(HIDES_INSPECTOR_CLASS),       false);
  assert.equal(document.getElementById('center-column').classList.contains(HIDES_BOTTOM_PANEL_CLASS), false);
});

test('layout policy — mixed workspace policy toggles only the matching layout class', () => {
  bootDom();
  const Rga = loadStack();
  Rga.Workspaces.register({
    kind: 'mixed-layout', title: 'Mixed', mount: function() {},
    chrome: { toolbar: false, bottomPanel: true, inspector: false }
  });
  const reg = Rga.Workspaces.get('mixed-layout');
  Rga.TabManager._applyChromePolicy({ kind: 'workspace', _registration: reg });
  // inspector:false → collapse inspector column
  assert.equal(document.getElementById('workspace').classList.contains(HIDES_INSPECTOR_CLASS),       true);
  // bottomPanel:true → do NOT collapse the bottom row
  assert.equal(document.getElementById('center-column').classList.contains(HIDES_BOTTOM_PANEL_CLASS), false);
});

test('layout policy — toolbar has no parent layout class (auto-row collapses naturally)', () => {
  bootDom();
  const Rga = loadStack();
  // Hide only the toolbar.
  Rga.Workspaces.register({
    kind: 'toolbar-only', title: 'Toolbar Only', mount: function() {},
    chrome: { toolbar: false, bottomPanel: true, inspector: true }
  });
  const reg = Rga.Workspaces.get('toolbar-only');
  Rga.TabManager._applyChromePolicy({ kind: 'workspace', _registration: reg });
  // Per-element class on the toolbar — present.
  assert.equal(document.getElementById('rga-shell-toolbar').classList.contains(HIDDEN_CLASS), true);
  // No grid-collapse class on #app or anywhere else — the auto-sized
  // toolbar row on #app collapses to 0 once the toolbar is display:none.
  const app = document.getElementById('app');
  if (app) {
    assert.equal(app.className.indexOf('rga-workspace-hides') < 0, true,
      'no rga-workspace-hides-* class should land on #app');
  }
});

test('layout policy — switch back from collapse-all to document fully restores both layouts', () => {
  bootDom();
  const Rga = loadStack();
  Rga.Workspaces.register({
    kind: 'roundtrip', title: 'Roundtrip', mount: function() {},
    chrome: { toolbar: false, bottomPanel: false, inspector: false }
  });
  const reg = Rga.Workspaces.get('roundtrip');
  // Activate workspace.
  Rga.TabManager._applyChromePolicy({ kind: 'workspace', _registration: reg });
  assert.equal(document.getElementById('workspace').classList.contains(HIDES_INSPECTOR_CLASS),       true);
  assert.equal(document.getElementById('center-column').classList.contains(HIDES_BOTTOM_PANEL_CLASS), true);
  // Activate document.
  Rga.TabManager._applyChromePolicy({ kind: 'document' });
  assert.equal(document.getElementById('workspace').classList.contains(HIDES_INSPECTOR_CLASS),       false);
  assert.equal(document.getElementById('center-column').classList.contains(HIDES_BOTTOM_PANEL_CLASS), false);
  // Per-element classes also cleared.
  assert.equal(document.getElementById('rga-shell-toolbar').classList.contains(HIDDEN_CLASS), false);
  assert.equal(document.getElementById('bottom-panel').classList.contains(HIDDEN_CLASS),      false);
  assert.equal(document.getElementById('inspector-panel').classList.contains(HIDDEN_CLASS),   false);
});
