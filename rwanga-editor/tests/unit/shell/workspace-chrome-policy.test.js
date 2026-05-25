// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Workspace chrome ownership — owned tests.
//
// Proves:
//   - Rga.Workspaces.register({ chrome }) normalizes the chrome field
//     with per-field defaults of true.
//   - TabManager._applyChromePolicy(tab) toggles inline display on the
//     three editor-only chrome targets (#rga-shell-toolbar, #bottom-
//     panel, #inspector-panel) according to the policy.
//   - Document tabs always receive the full editor chrome.
//   - Workspace tabs receive whatever they declared at registration.
//   - Workspace tabs that did NOT declare a chrome field receive the
//     full editor chrome (backward compatibility).
//   - Settings workspace declares all three false.
//   - Restoring a tab whose policy is full editor clears any inline
//     display:none set by a prior workspace activation.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bootDom() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
      '<div id="rga-shell-toolbar"></div>' +
      '<div id="bottom-panel"></div>' +
      '<div id="inspector-panel"></div>' +
      '<div id="tab-content-host"></div>' +
      '<div id="tab-bar"></div>' +
      '<div id="editor"></div>' +
      '<div id="editor-container"></div>' +
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

test('chrome policy — document tab leaves all three targets visible (display cleared)', () => {
  bootDom();
  const Rga = loadStack();
  // Pre-set inline display:none on the three targets so we can confirm
  // _applyChromePolicy actively CLEARS them (not just leaves alone).
  ['rga-shell-toolbar', 'bottom-panel', 'inspector-panel'].forEach(function(id) {
    document.getElementById(id).style.display = 'none';
  });
  Rga.TabManager._applyChromePolicy({ kind: 'document' });
  assert.equal(document.getElementById('rga-shell-toolbar').style.display, '');
  assert.equal(document.getElementById('bottom-panel').style.display, '');
  assert.equal(document.getElementById('inspector-panel').style.display, '');
});

test('chrome policy — null tab (empty state) leaves all three visible', () => {
  bootDom();
  const Rga = loadStack();
  ['rga-shell-toolbar', 'bottom-panel', 'inspector-panel'].forEach(function(id) {
    document.getElementById(id).style.display = 'none';
  });
  Rga.TabManager._applyChromePolicy(null);
  assert.equal(document.getElementById('rga-shell-toolbar').style.display, '');
  assert.equal(document.getElementById('bottom-panel').style.display, '');
  assert.equal(document.getElementById('inspector-panel').style.display, '');
});

test('chrome policy — workspace tab without a chrome field keeps all three visible', () => {
  bootDom();
  const Rga = loadStack();
  Rga.Workspaces.register({
    kind: 'plain', title: 'Plain', mount: function() {}
  });
  const reg = Rga.Workspaces.get('plain');
  // Force display:none beforehand so a "no-op" wouldn't pass.
  document.getElementById('rga-shell-toolbar').style.display = 'none';
  Rga.TabManager._applyChromePolicy({ kind: 'workspace', _registration: reg });
  assert.equal(document.getElementById('rga-shell-toolbar').style.display, '');
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
  assert.equal(document.getElementById('rga-shell-toolbar').style.display, 'none');
  assert.equal(document.getElementById('bottom-panel').style.display, 'none');
  assert.equal(document.getElementById('inspector-panel').style.display, 'none');
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
  assert.equal(document.getElementById('rga-shell-toolbar').style.display, 'none');
  assert.equal(document.getElementById('bottom-panel').style.display, '');
  assert.equal(document.getElementById('inspector-panel').style.display, 'none');
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
  assert.equal(document.getElementById('rga-shell-toolbar').style.display, 'none');
  assert.equal(document.getElementById('bottom-panel').style.display, 'none');
  assert.equal(document.getElementById('inspector-panel').style.display, 'none');
  // Document active → all restored.
  Rga.TabManager._applyChromePolicy({ kind: 'document' });
  assert.equal(document.getElementById('rga-shell-toolbar').style.display, '');
  assert.equal(document.getElementById('bottom-panel').style.display, '');
  assert.equal(document.getElementById('inspector-panel').style.display, '');
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
  assert.equal(document.getElementById('rga-shell-toolbar').style.display, 'none');
  assert.equal(document.getElementById('bottom-panel').style.display, 'none');
  assert.equal(document.getElementById('inspector-panel').style.display, 'none');
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
