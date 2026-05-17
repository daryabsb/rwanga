// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Runtime Ownership Stabilization Slice 6 — regression tests.
// Covers §A (ViewManager single owner of view-* body classes +
// round-trip via every entry point + reload preserves current view).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function freshJSDOM(html) {
  const dom = new JSDOM(html || '<!DOCTYPE html><html><body><div id="editor-container"></div></body></html>',
                        { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  global.KeyboardEvent = dom.window.KeyboardEvent;
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

// Always boot ViewManager + ViewMode + KeyboardRegistry together.
// (Post-Slice-6, view-mode.js no longer has a body-class fallback;
// ViewManager MUST be loaded for view activation to have any DOM
// effect.)
function bootViewStack() {
  freshJSDOM();
  reloadModules([
    '../../../renderer/js/framework/view-manager.js',
    '../../../renderer/js/shell/keyboard-registry.js',
    '../../../renderer/js/view-mode.js'
  ]);
  const Rga = global.window.Rga;
  Rga.ViewManager._reset && Rga.ViewManager._reset();
  Rga.KeyboardRegistry._reset();
  Rga.KeyboardRegistry.init();
  Rga.ViewMode.init();
  return Rga;
}

// ================================================================
// §A — Round-trips through every entry point
// ================================================================

test('§A: Flow → Draft → Flow via ViewMode.set leaves no orphan body classes', () => {
  const Rga = bootViewStack();
  assert.equal(Rga.ViewMode.get(), 'flow');
  assert.equal(document.body.classList.contains('view-draft-active'), false);

  Rga.ViewMode.set('draft');
  assert.equal(Rga.ViewMode.get(), 'draft');
  assert.equal(document.body.classList.contains('view-draft-active'), true,
    'Draft activated → view-draft-active applied by ViewManager controller');

  Rga.ViewMode.set('flow');
  assert.equal(Rga.ViewMode.get(), 'flow');
  assert.equal(document.body.classList.contains('view-draft-active'), false,
    'returning to flow → ViewManager.deactivate removed view-draft-active');
  assert.equal(document.body.classList.contains('view-print-active'), false);
  assert.equal(document.body.classList.contains('view-print-preview-active'), false);
});

test('§A: Flow → Print → Flow round-trip clears view-print-active', () => {
  const Rga = bootViewStack();
  Rga.ViewMode.set('print');
  assert.equal(document.body.classList.contains('view-print-active'), true,
    'Print activated → view-print-active applied');
  Rga.ViewMode.set('flow');
  assert.equal(document.body.classList.contains('view-print-active'), false,
    'returning to flow → view-print-active removed');
});

test('§A: Esc exits Draft via KeyboardRegistry (registered with when-predicate)', () => {
  const Rga = bootViewStack();
  Rga.ViewMode.set('draft');
  assert.equal(Rga.ViewMode.get(), 'draft');

  const ev = new global.KeyboardEvent('keydown',
    { key: 'Escape', bubbles: true, cancelable: true });
  document.dispatchEvent(ev);
  assert.equal(Rga.ViewMode.get(), 'flow', 'Escape exited Draft');
  assert.equal(document.body.classList.contains('view-draft-active'), false);
});

test('§A: status-bar-style ViewManager.activate bypass keeps ViewMode + body classes in sync', () => {
  const Rga = bootViewStack();
  // Simulate status-bar viewMode click: calls ViewManager.activate
  // directly, NOT ViewMode.set. ViewMode subscribes to onChange and
  // keeps its `current` in sync.
  Rga.ViewManager.activate('draft');
  assert.equal(document.body.classList.contains('view-draft-active'), true,
    'body class applied via ViewManager controller');
  assert.equal(Rga.ViewMode.get(), 'draft',
    'ViewMode.current synced from ViewManager via onChange');

  // Now exit via ViewMode.exitDraft — works because current === 'draft'.
  Rga.ViewMode.exitDraft();
  assert.equal(Rga.ViewMode.get(), 'flow');
  assert.equal(document.body.classList.contains('view-draft-active'), false,
    'exitDraft cleared the body class via ViewManager.deactivate');
});

test('§A: ViewMode.cycle walks flow → print → draft → flow (no orphan classes at any step)', () => {
  const Rga = bootViewStack();
  // flow → print
  Rga.ViewMode.cycle();
  assert.equal(Rga.ViewMode.get(), 'print');
  assert.equal(document.body.classList.contains('view-print-active'), true);
  assert.equal(document.body.classList.contains('view-draft-active'), false);

  // print → draft
  Rga.ViewMode.cycle();
  assert.equal(Rga.ViewMode.get(), 'draft');
  assert.equal(document.body.classList.contains('view-print-active'), false,
    'print → draft must clear view-print-active');
  assert.equal(document.body.classList.contains('view-draft-active'), true);

  // draft → flow
  Rga.ViewMode.cycle();
  assert.equal(Rga.ViewMode.get(), 'flow');
  assert.equal(document.body.classList.contains('view-draft-active'), false);
  assert.equal(document.body.classList.contains('view-print-active'), false);
});

// ================================================================
// §A — Reload preserves current view (persistence round-trip)
// ================================================================

test('§A: reload preserves flow/print/draft via rga-view-mode (two-session simulation)', () => {
  // Session 1 — set to Draft.
  let Rga = bootViewStack();
  Rga.ViewMode.set('draft');
  assert.equal(localStorage.getItem('rga-view-mode'), 'draft',
    'rga-view-mode persisted by ViewMode._persist');
  const persistedRaw = localStorage.getItem('rga-view-mode');

  // Session 2 — fresh DOM + modules; seed localStorage; verify load.
  freshJSDOM();
  localStorage.setItem('rga-view-mode', persistedRaw);
  reloadModules([
    '../../../renderer/js/framework/view-manager.js',
    '../../../renderer/js/shell/keyboard-registry.js',
    '../../../renderer/js/view-mode.js'
  ]);
  Rga = global.window.Rga;
  Rga.ViewManager._reset && Rga.ViewManager._reset();
  Rga.KeyboardRegistry._reset();
  Rga.KeyboardRegistry.init();
  Rga.ViewMode.init();

  assert.equal(Rga.ViewMode.get(), 'draft',
    'session 2 must boot in the persisted mode (draft)');
  assert.equal(document.body.classList.contains('view-draft-active'), true,
    'session 2 body class applied on init');
});

test('§A: PrintPreview state is intentionally NOT persisted (reverts to last flow/print/draft on reload)', () => {
  // PrintPreview is registered with ViewManager but not in ViewMode.MODES,
  // so ViewMode's onChange filter rejects it. The persisted value stays
  // at the most recent flow/print/draft. This is documented behavior
  // (runtime audit §1.7 / §1.10 open risks).
  let Rga = bootViewStack();
  Rga.ViewMode.set('print');
  assert.equal(localStorage.getItem('rga-view-mode'), 'print');

  // Now register a printPreview controller (simulating Rga.PrintPreview)
  // and activate it via ViewManager directly.
  Rga.ViewManager.register('printPreview', {
    bodyClass: 'view-print-preview-active',
    activate: function() {},
    deactivate: function() {}
  });
  Rga.ViewManager.activate('printPreview');
  // Persisted value is still 'print' — ViewMode didn't update because
  // 'printPreview' is not in MODES.
  assert.equal(localStorage.getItem('rga-view-mode'), 'print',
    'PrintPreview activation does not overwrite rga-view-mode');
  // Body class is applied by ViewManager regardless.
  assert.equal(document.body.classList.contains('view-print-preview-active'), true);

  // Session 2 simulation — reload restores 'print' (not 'printPreview').
  const persistedRaw = localStorage.getItem('rga-view-mode');
  freshJSDOM();
  localStorage.setItem('rga-view-mode', persistedRaw);
  reloadModules([
    '../../../renderer/js/framework/view-manager.js',
    '../../../renderer/js/shell/keyboard-registry.js',
    '../../../renderer/js/view-mode.js'
  ]);
  Rga = global.window.Rga;
  Rga.ViewManager._reset && Rga.ViewManager._reset();
  Rga.KeyboardRegistry._reset();
  Rga.KeyboardRegistry.init();
  Rga.ViewMode.init();
  assert.equal(Rga.ViewMode.get(), 'print',
    'reload from printPreview reverts to the last persisted flow/print/draft (print)');
});

// ================================================================
// §A — view-mode.js has no shell-side body-class writer
// ================================================================

test('§A: view-mode.js _activate has no document.body.classList toggle (Slice 6 §A fallback removal)', () => {
  // Source audit — confirms the Slice-6 fallback removal stuck.
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../../renderer/js/view-mode.js'), 'utf8');
  // Strip comments so the explanatory note about the removal doesn't
  // trigger a false positive.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.equal(/document\.body\.classList/.test(code), false,
    'view-mode.js must not contain any document.body.classList write after Slice 6 §A');
});
