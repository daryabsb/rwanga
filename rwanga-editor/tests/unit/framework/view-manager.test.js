// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 7 correction — Rga.ViewManager unit tests + integration with
// PrintPreview and a ViewMode-style flow/draft pair.
//
// Acceptance:
//   ✓ register / activate / current / isActive / registered / unregister
//   ✓ mutual exclusion — activating B deactivates A
//   ✓ body class is a side effect applied by the manager (not by callers)
//   ✓ re-activating the current id re-runs activate without deactivate
//   ✓ deactivate() clears current + removes body class
//   ✓ PrintPreview.show/hide route through ViewManager
//   ✓ closing PrintPreview restores the previous view (Flow/Draft)
//   ✓ ViewMode-style flow + draft fit naturally alongside PrintPreview
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div><div id="editor-container"></div></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};

  const PMstate = require('prosemirror-state');
  const PMview  = require('prosemirror-view');
  const PMmodel = require('prosemirror-model');
  global.window.RgaProseMirror = {
    EditorState:   PMstate.EditorState,
    EditorView:    PMview.EditorView,
    Schema:        PMmodel.Schema,
    PMNode:        PMmodel.Node,
    Plugin:        PMstate.Plugin,
    PluginKey:     PMstate.PluginKey,
    TextSelection: PMstate.TextSelection,
    Decoration:    PMview.Decoration,
    DecorationSet: PMview.DecorationSet
  };

  const paths = [
    '../../../renderer/js/framework/base-outer-marks.js',
    '../../../renderer/js/framework/screenplay-normalizer.js',
    '../../../renderer/js/framework/layout-profile.js',
    '../../../renderer/js/framework/pagemap-engine.js',
    '../../../renderer/js/framework/document-outline.js',
    '../../../renderer/js/framework/nav-index.js',
    '../../../renderer/js/framework/view-manager.js',
    '../../../renderer/js/framework/render-model.js',
    '../../../renderer/js/framework/print-renderer.js',
    '../../../renderer/js/framework/print-preview.js',
    '../../../renderer/js/doc-types/screenplay/schema-v3.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const sp = global.window.Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  return { Rga: global.window.Rga, schema: sp.buildSchemaV3(), PM: global.window.RgaProseMirror };
}

function buildViewFor1Scene(boot) {
  const { Rga, schema, PM } = boot;
  const heading = schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }, schema.text('ROOM'));
  const action = schema.nodes.action.create(null, schema.text('Alex enters.'));
  const transition = schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'));
  const sceneNode = schema.nodes.scene.create(
    { id: 'sc', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [heading, action, transition]
  );
  const body = schema.nodes.body.create(null, [sceneNode]);
  const title = schema.nodes.titleStrip.create({ removable: true });
  const doc = schema.nodes.doc.create(null, [title, body]);
  const state = PM.EditorState.create({ schema: schema, doc: doc, plugins: [] });
  const editorEl = document.getElementById('editor');
  return new PM.EditorView(editorEl, { state: state });
}

function freshVM(boot) {
  // PrintPreview self-registers on load; reset so each test starts clean.
  boot.Rga.ViewManager._reset();
  return boot.Rga.ViewManager;
}

// ----------------------------------------------------------------
// Core API
// ----------------------------------------------------------------

test('register + activate + current + isActive happy path', () => {
  const b = boot();
  const VM = freshVM(b);
  let activated = 0;
  VM.register('alpha', { activate: function() { activated += 1; } });
  assert.equal(VM.current(), null);
  VM.activate('alpha');
  assert.equal(VM.current(), 'alpha');
  assert.equal(VM.isActive('alpha'), true);
  assert.equal(activated, 1);
});

test('activating unknown id returns false; does not change current', () => {
  const b = boot();
  const VM = freshVM(b);
  VM.register('alpha', { activate: function() {} });
  VM.activate('alpha');
  const ok = VM.activate('ghost');
  assert.equal(ok, false);
  assert.equal(VM.current(), 'alpha');
});

test('mutual exclusion — activating B deactivates A (calls A.deactivate)', () => {
  const b = boot();
  const VM = freshVM(b);
  const log = [];
  VM.register('A', { activate: function() { log.push('A:act'); }, deactivate: function() { log.push('A:de'); } });
  VM.register('B', { activate: function() { log.push('B:act'); }, deactivate: function() { log.push('B:de'); } });
  VM.activate('A');
  VM.activate('B');
  assert.deepEqual(log, ['A:act', 'A:de', 'B:act']);
  assert.equal(VM.current(), 'B');
});

test('re-activating the current id re-runs activate without deactivate', () => {
  const b = boot();
  const VM = freshVM(b);
  const log = [];
  VM.register('A', {
    activate: function(arg) { log.push('act:' + arg); },
    deactivate: function() { log.push('de'); }
  });
  VM.activate('A', 'first');
  VM.activate('A', 'second');
  assert.deepEqual(log, ['act:first', 'act:second']);  // no 'de' between
});

test('deactivate clears current; second deactivate is a no-op', () => {
  const b = boot();
  const VM = freshVM(b);
  let deactivated = 0;
  VM.register('A', { activate: function() {}, deactivate: function() { deactivated += 1; } });
  VM.activate('A');
  VM.deactivate();
  assert.equal(VM.current(), null);
  assert.equal(deactivated, 1);
  VM.deactivate();  // no-op
  assert.equal(deactivated, 1);
});

test('registered() returns all registered ids', () => {
  const b = boot();
  const VM = freshVM(b);
  VM.register('a', { activate: function() {} });
  VM.register('b', { activate: function() {} });
  VM.register('c', { activate: function() {} });
  assert.deepEqual(VM.registered().sort(), ['a', 'b', 'c']);
});

test('unregister the current view deactivates it', () => {
  const b = boot();
  const VM = freshVM(b);
  let deactivated = 0;
  VM.register('A', { activate: function() {}, deactivate: function() { deactivated += 1; }, bodyClass: 'va' });
  VM.activate('A');
  assert.equal(document.body.classList.contains('va'), true);
  VM.unregister('A');
  assert.equal(VM.current(), null);
  assert.equal(deactivated, 1);
  assert.equal(document.body.classList.contains('va'), false);
});

// ----------------------------------------------------------------
// Body class as side effect
// ----------------------------------------------------------------

test('bodyClass is applied on activate + removed on deactivate', () => {
  const b = boot();
  const VM = freshVM(b);
  VM.register('A', { bodyClass: 'va', activate: function() {}, deactivate: function() {} });
  VM.activate('A');
  assert.equal(document.body.classList.contains('va'), true);
  VM.deactivate();
  assert.equal(document.body.classList.contains('va'), false);
});

test('bodyClass swap on mutual exclusion — A removed, B added in one step', () => {
  const b = boot();
  const VM = freshVM(b);
  VM.register('A', { bodyClass: 'va', activate: function() {}, deactivate: function() {} });
  VM.register('B', { bodyClass: 'vb', activate: function() {}, deactivate: function() {} });
  VM.activate('A');
  assert.equal(document.body.classList.contains('va'), true);
  VM.activate('B');
  assert.equal(document.body.classList.contains('va'), false);
  assert.equal(document.body.classList.contains('vb'), true);
});

test('controllers without bodyClass do not pollute body', () => {
  const b = boot();
  const VM = freshVM(b);
  const initialClasses = Array.from(document.body.classList).join('|');
  VM.register('A', { activate: function() {}, deactivate: function() {} });   // no bodyClass
  VM.activate('A');
  assert.equal(Array.from(document.body.classList).join('|'), initialClasses);
});

// ----------------------------------------------------------------
// onChange listeners
// ----------------------------------------------------------------

test('onChange fires (newId, prevId) on every activate / deactivate', () => {
  const b = boot();
  const VM = freshVM(b);
  const events = [];
  VM.onChange(function(n, p) { events.push([n, p]); });
  VM.register('A', { activate: function() {} });
  VM.register('B', { activate: function() {} });
  VM.activate('A');
  VM.activate('B');
  VM.deactivate();
  assert.deepEqual(events, [['A', null], ['B', 'A'], [null, 'B']]);
});

test('onChange unsubscribe stops further notifications', () => {
  const b = boot();
  const VM = freshVM(b);
  let count = 0;
  const off = VM.onChange(function() { count += 1; });
  VM.register('A', { activate: function() {} });
  VM.activate('A');
  off();
  VM.deactivate();
  assert.equal(count, 1);
});

// ----------------------------------------------------------------
// PrintPreview integration via ViewManager
// ----------------------------------------------------------------

test('PrintPreview registers itself with ViewManager on load', () => {
  const b = boot();
  // No _reset() here — verify the on-load registration is present.
  assert.ok(b.Rga.ViewManager.registered().indexOf('printPreview') !== -1);
});

test('PrintPreview.show routes through ViewManager.activate("printPreview")', () => {
  const b = boot();
  const view = buildViewFor1Scene(b);
  b.Rga.PrintPreview.show(view);
  assert.equal(b.Rga.ViewManager.current(), 'printPreview');
  assert.equal(b.Rga.PrintPreview.isActive(), true);
  assert.equal(document.body.classList.contains('view-print-preview-active'), true);
  b.Rga.PrintPreview.hide();
  view.destroy();
});

test('PrintPreview.hide deactivates AND restores the previous view if one was active', () => {
  const b = boot();
  const VM = b.Rga.ViewManager;
  // Register a fake Flow view to act as the "previous" view.
  VM.register('flow', { bodyClass: null, activate: function() {}, deactivate: function() {} });
  VM.activate('flow');
  const view = buildViewFor1Scene(b);
  b.Rga.PrintPreview.show(view);
  assert.equal(VM.current(), 'printPreview');
  b.Rga.PrintPreview.hide();
  assert.equal(VM.current(), 'flow', 'closing PrintPreview restores Flow');
  view.destroy();
});

test('PrintPreview.hide without a previous view leaves ViewManager.current() = null', () => {
  const b = boot();
  // PrintPreview self-registered at load; activate it directly (no prior view).
  const view = buildViewFor1Scene(b);
  b.Rga.PrintPreview.show(view);
  b.Rga.PrintPreview.hide();
  assert.equal(b.Rga.ViewManager.current(), null);
  view.destroy();
});

// ----------------------------------------------------------------
// Flow + Draft + PrintPreview together — "future Focus/Split fit naturally"
// ----------------------------------------------------------------

test('Flow + Draft + PrintPreview cohabit a single registry without collisions', () => {
  const b = boot();
  const VM = b.Rga.ViewManager;
  // Flow/Draft (analogous to what view-mode.js registers in the app).
  VM.register('flow',  { bodyClass: null,                 activate: function() {}, deactivate: function() {} });
  VM.register('draft', { bodyClass: 'view-draft-active',  activate: function() {}, deactivate: function() {} });
  // Cycle through them; assert body class follows.
  const view = buildViewFor1Scene(b);
  VM.activate('flow');
  assert.equal(VM.current(), 'flow');
  assert.equal(document.body.classList.contains('view-draft-active'), false);
  VM.activate('draft');
  assert.equal(document.body.classList.contains('view-draft-active'), true);
  // Now open preview — Draft body class removed, preview body class added.
  b.Rga.PrintPreview.show(view);
  assert.equal(document.body.classList.contains('view-draft-active'), false);
  assert.equal(document.body.classList.contains('view-print-preview-active'), true);
  // Close preview → Draft restored.
  b.Rga.PrintPreview.hide();
  assert.equal(VM.current(), 'draft');
  assert.equal(document.body.classList.contains('view-draft-active'), true);
  assert.equal(document.body.classList.contains('view-print-preview-active'), false);
  view.destroy();
});

test('future Focus/Split modes register the same way (extensibility smoke)', () => {
  const b = boot();
  const VM = freshVM(b);
  let focusActivated = 0;
  VM.register('focus', { bodyClass: 'view-focus-active', activate: function() { focusActivated += 1; } });
  VM.register('split', { bodyClass: 'view-split-active', activate: function() {} });
  VM.activate('focus');
  assert.equal(VM.isActive('focus'), true);
  assert.equal(document.body.classList.contains('view-focus-active'), true);
  assert.equal(focusActivated, 1);
  VM.activate('split');
  assert.equal(document.body.classList.contains('view-focus-active'), false);
  assert.equal(document.body.classList.contains('view-split-active'), true);
});
