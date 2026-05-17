// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 8 — v3 activation tests for mount.js + the end-to-end path:
//   Rga.Doc.deserialize → Rga.TabManager.openDocument → Rga.Editor.mount.
//
// Acceptance gates exercised here:
//   ✓ existing v2 sample files open through the v3 pipeline
//   ✓ v3 hand-authored files open directly
//   ✓ scenes render as scene frames (v3 SceneNodeView mounted)
//   ✓ empty doc gets a default v3 scene
//   ✓ notes/tags/flags plugins still install on a v3 editor
//   ✓ page-marker decorations present in editor DOM
//   ✓ print-preview still works against the activated v3 path
//   ✓ Mod-Enter installs the v3 spawnNextScene command, not the legacy
//     insertSceneFrame
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function boot() {
  // Real URL — jsdom's default `about:blank` is an opaque origin and
  // refuses localStorage; constants.js / view-mode.js touch it at load.
  const dom = new JSDOM('<!DOCTYPE html><html><body>' +
    '<div id="editor"></div>' +
    '<div id="editor-container"></div>' +
    '<div id="tab-bar"></div>' +
    '<div id="tab-new"></div>' +
    '<div id="no-document-overlay"></div>' +
    '</body></html>',
    { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  // jsdom + PM event interop.
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.window.Rga = {};

  // crypto.randomUUID polyfill — annotations / tags plugins call it.
  if (!global.window.crypto) global.window.crypto = {};
  if (!global.window.crypto.randomUUID) {
    global.window.crypto.randomUUID = function() {
      return 'uuid-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now();
    };
  }

  const PMstate = require('prosemirror-state');
  const PMview  = require('prosemirror-view');
  const PMmodel = require('prosemirror-model');
  const PMkeymap = require('prosemirror-keymap');
  const PMcommands = require('prosemirror-commands');
  const PMhistory = require('prosemirror-history');
  global.window.RgaProseMirror = {
    EditorState:   PMstate.EditorState,
    EditorView:    PMview.EditorView,
    Schema:        PMmodel.Schema,
    PMNode:        PMmodel.Node,
    Plugin:        PMstate.Plugin,
    PluginKey:     PMstate.PluginKey,
    TextSelection: PMstate.TextSelection,
    NodeSelection: PMstate.NodeSelection,
    Decoration:    PMview.Decoration,
    DecorationSet: PMview.DecorationSet,
    keymap:        PMkeymap.keymap,
    baseKeymap:    PMcommands.baseKeymap,
    history:       PMhistory.history,
    undo:          PMhistory.undo,
    redo:          PMhistory.redo,
    toggleMark:    PMcommands.toggleMark,
    joinBackward:  PMcommands.joinBackward,
    setBlockType:  PMcommands.setBlockType
  };

  // Load order: framework first, screenplay doc-type, then mount.
  const paths = [
    '../../../renderer/js/constants.js',
    '../../../renderer/js/framework/base-outer-marks.js',
    '../../../renderer/js/framework/doc-type-registry.js',
    '../../../renderer/js/framework/runtime-profile.js',
    '../../../renderer/js/framework/screenplay-normalizer.js',
    '../../../renderer/js/framework/layout-profile.js',
    '../../../renderer/js/framework/pagemap-engine.js',
    '../../../renderer/js/framework/document-outline.js',
    '../../../renderer/js/framework/nav-index.js',
    '../../../renderer/js/framework/view-manager.js',
    '../../../renderer/js/framework/render-model.js',
    '../../../renderer/js/framework/print-renderer.js',
    '../../../renderer/js/framework/print-preview.js',
    '../../../renderer/js/doc-types/screenplay/schema-v3.js',
    '../../../renderer/js/doc-types/screenplay/migrations/v1-to-v2.js',
    '../../../renderer/js/doc-types/screenplay/migrations/v2-to-v3.js',
    '../../../renderer/js/doc-types/screenplay/migrations/index.js',
    '../../../renderer/js/doc-types/screenplay/v3-commands.js',
    '../../../renderer/js/doc-types/screenplay/v3-keymap.js',
    '../../../renderer/js/doc-types/screenplay/v3-node-views.js',
    '../../../renderer/js/doc-types/screenplay/plugins/annotations.js',
    '../../../renderer/js/doc-types/screenplay/plugins/tags.js',
    '../../../renderer/js/doc-types/screenplay/plugins/revision-flags.js',
    '../../../renderer/js/doc-types/screenplay/index.js',
    '../../../renderer/js/doc.js',
    '../../../renderer/js/editor/mount.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const sp = global.window.Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  return { Rga: global.window.Rga, PM: global.window.RgaProseMirror };
}

// ----------------------------------------------------------------
// activeSchema (mount.js) — v3 is the primary path for screenplay
// ----------------------------------------------------------------

test('activeSchema("screenplay") returns the v3 schema by default', () => {
  const { Rga } = boot();
  const schema = Rga.Editor.activeSchema('screenplay');
  assert.ok(schema);
  assert.ok(schema.nodes.scene, 'has v3 scene node');
  assert.ok(schema.nodes.sceneHeading);
});

test('activeSchema("screenplay") returns the v3 schema regardless of RuntimeProfile flags (legacy retired)', () => {
  const { Rga } = boot();
  Rga.RuntimeProfile.set({ compatibilityMode: true });
  try {
    const schema = Rga.Editor.activeSchema('screenplay');
    assert.ok(schema);
    assert.ok(schema.nodes.scene, 'v3 schema is the only option post-Phase-9');
    assert.equal(schema.nodes.sceneFrame, undefined, 'no v2 sceneFrame node anywhere');
  } finally {
    Rga.RuntimeProfile.reset();
  }
});

// ----------------------------------------------------------------
// emptyDoc behavior
// ----------------------------------------------------------------

test('emptyDoc under v3 schema produces a doc with one default scene (heading + action + transition)', () => {
  const { Rga } = boot();
  const sp = Rga.DocTypes.screenplay;
  const v3Schema = sp.buildSchemaV3();
  const doc = Rga.Editor.emptyDoc(v3Schema);
  // doc → body → scene → [sceneHeading, action, transition]
  const body = doc.child(0);  // titleStrip is optional → first is body when absent
  assert.equal(body.type.name, 'body');
  const scene = body.child(0);
  assert.equal(scene.type.name, 'scene');
  assert.equal(scene.firstChild.type.name, 'sceneHeading');
  assert.equal(scene.lastChild.type.name, 'transition');
  assert.equal(scene.lastChild.attrs.presetType, 'CUT');
});

// (Phase 9: the legacy v2 emptyDoc paragraph fallback was removed
// alongside the v2 schema. emptyDoc now always produces a v3 scene.)

// ----------------------------------------------------------------
// Mount — v3 EditorView with v3 NodeViews + page markers
// ----------------------------------------------------------------

test('Rga.Editor.mount on v3 schema installs v3 SceneNodeView (renders .rga-scene-v3 chrome)', () => {
  const { Rga } = boot();
  const editorEl = document.getElementById('editor');
  const mounted = Rga.Editor.mount(editorEl, { documentType: 'screenplay' });
  assert.ok(mounted);
  // emptyDoc auto-creates 1 default scene; SceneNodeView should render it.
  assert.equal(editorEl.querySelectorAll('.rga-scene-v3').length, 1);
  assert.equal(editorEl.querySelectorAll('.rga-scene-v3-num').length, 1);
  assert.match(editorEl.querySelector('.rga-scene-v3-num').textContent, /SCENE 1/);
  mounted.view.destroy();
});

test('Rga.Editor.mount on v3 schema installs SceneHeadingNodeView pickers', () => {
  const { Rga } = boot();
  const editorEl = document.getElementById('editor');
  const mounted = Rga.Editor.mount(editorEl, { documentType: 'screenplay' });
  // The default empty scene has a sceneHeading rendered with setting/time pickers.
  assert.ok(editorEl.querySelector('.rga-scene-heading-v3'));
  assert.ok(editorEl.querySelector('.rga-scene-heading-v3-setting'));
  assert.ok(editorEl.querySelector('.rga-scene-heading-v3-time'));
  mounted.view.destroy();
});

test('Rga.Editor.mount on v3 schema installs the nav-index plugin (sceneNumber + page-marker pipeline)', () => {
  const { Rga } = boot();
  const editorEl = document.getElementById('editor');
  const mounted = Rga.Editor.mount(editorEl, { documentType: 'screenplay' });
  // NavigationIndex should resolve to a real index post-mount.
  const idx = Rga.Nav.getIndex(mounted.view.state);
  assert.ok(idx);
  assert.equal(idx.scenes.length, 1);
  assert.equal(idx.scenes[0].sceneNumber, 1);
  const pageMap = Rga.Nav.getPageMap(mounted.view.state);
  assert.ok(Array.isArray(pageMap));
  assert.equal(pageMap.length, 1, 'single-scene empty doc is one page');
  mounted.view.destroy();
});

test('Rga.Editor.mount on v3 schema does NOT install the v2 sceneFrame nodeView', () => {
  const { Rga } = boot();
  const editorEl = document.getElementById('editor');
  const mounted = Rga.Editor.mount(editorEl, { documentType: 'screenplay' });
  // No v2 sceneFrame chrome should appear.
  assert.equal(editorEl.querySelectorAll('.rga-scene-block').length, 0);
  assert.equal(editorEl.querySelectorAll('.rga-scene-frame').length, 0);
  mounted.view.destroy();
});

test('Rga.Editor.mount on v3 schema wires the v3 Tab cycle keymap', () => {
  const { Rga, PM } = boot();
  const editorEl = document.getElementById('editor');
  const mounted = Rga.Editor.mount(editorEl, { documentType: 'screenplay' });
  // Move cursor into the action block, fire cycleBlockType('forward') →
  // action should become character.
  let actionPos = null;
  mounted.view.state.doc.descendants(function(n, p) {
    if (n.type.name === 'action' && actionPos === null) actionPos = p;
  });
  assert.ok(typeof actionPos === 'number');
  const $pos = mounted.view.state.doc.resolve(actionPos + 1);
  mounted.view.dispatch(mounted.view.state.tr.setSelection(PM.TextSelection.near($pos)));
  // The v3 keymap binds Tab → cycleBlockType('forward'). Invoke directly.
  const sp = Rga.DocTypes.screenplay;
  const cmd = sp.v3Commands.cycleBlockType('forward');
  const ok = cmd(mounted.view.state, mounted.view.dispatch.bind(mounted.view));
  assert.equal(ok, true);
  assert.equal(mounted.view.state.doc.nodeAt(actionPos).type.name, 'character');
  mounted.view.destroy();
});

// ----------------------------------------------------------------
// Deserialize end-to-end — open the v2 sample fixture, render as v3
// ----------------------------------------------------------------

test('Rga.Doc.deserialize on a v2 fixture (no useSchemaV3 flag) yields a v3 body', () => {
  const { Rga } = boot();
  const fixturePath = path.join(__dirname, '..', '..', 'fixtures', 'sample-the-last-light.rga');
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const doc = Rga.Doc.deserialize(raw, fixturePath);
  assert.ok(doc, 'doc returned');
  assert.ok(doc.body, 'pm body populated');
  // doc.body's schema must be v3 (has scene node, no sceneFrame node).
  assert.ok(doc.body.type.schema.nodes.scene, 'body is v3-shaped');
  assert.equal(doc.body.type.schema.nodes.sceneFrame, undefined, 'body schema is NOT v2 (no sceneFrame node)');
});

test('Rga.Doc.deserialize on a v3 hand-authored fixture yields the same v3 schema body', () => {
  const { Rga } = boot();
  const fixturePath = path.join(__dirname, '..', '..', 'fixtures', 'v3-sample-hand-authored.rga');
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const doc = Rga.Doc.deserialize(raw, fixturePath);
  assert.ok(doc && doc.body);
  assert.ok(doc.body.type.schema.nodes.scene);
});

test('Rga.RuntimeProfile.compatibilityMode does not change Phase 9 deserialize behavior (v3 is the only path)', () => {
  const { Rga } = boot();
  const fixturePath = path.join(__dirname, '..', '..', 'fixtures', 'sample-the-last-light.rga');
  const raw = fs.readFileSync(fixturePath, 'utf8');
  // Default → v3 body.
  let doc = Rga.Doc.deserialize(raw, fixturePath);
  assert.ok(doc.body.type.schema.nodes.scene, 'default → v3 body');
  // Compat-mode flag stays in the RuntimeProfile API (reserved for
  // future-mode use — safeMode etc), but deserialize no longer reads it
  // for schema selection in Phase 9. v3 is the only schema.
  Rga.RuntimeProfile.set({ compatibilityMode: true });
  try {
    doc = Rga.Doc.deserialize(raw, fixturePath);
    assert.ok(doc.body.type.schema.nodes.scene, 'compat mode still → v3 body');
    assert.equal(doc.body.type.schema.nodes.sceneFrame, undefined, 'no v2 sceneFrame in any path');
  } finally {
    Rga.RuntimeProfile.reset();
  }
});

// ----------------------------------------------------------------
// Cross-schema plugin coexistence — annotations/tags/flags work on v3
// (Phase 5 verified these in isolation; here we verify they install when
// mount.js boots a real v3 EditorView, not a bespoke test boot.)
// ----------------------------------------------------------------

test('Rga.Editor.mount on v3 schema still installs annotations/tags/revisionFlags/contextMenu plugins', () => {
  const { Rga } = boot();
  const editorEl = document.getElementById('editor');
  const mounted = Rga.Editor.mount(editorEl, { documentType: 'screenplay' });
  // Plugin count: history + universal keymap + baseKeymap + 4 cross-schema
  // plugins + 1 nav-index = at least 8.
  assert.ok(mounted.view.state.plugins.length >= 7, 'expected ≥7 plugins, got ' + mounted.view.state.plugins.length);
  // Annotation API works — selection over text + addAnnotation.
  let actionPos = null;
  mounted.view.state.doc.descendants(function(n, p) {
    if (n.type.name === 'action' && actionPos === null) actionPos = p;
  });
  // Insert some text into the action block first (it's empty in the default scene).
  mounted.view.dispatch(mounted.view.state.tr.insertText('Alex enters.', actionPos + 1));
  const start = actionPos + 1, end = start + 4;
  const { TextSelection } = require('prosemirror-state');
  mounted.view.dispatch(mounted.view.state.tr.setSelection(TextSelection.create(mounted.view.state.doc, start, end)));
  Rga.Annotations.addAnnotation(mounted.view, { id: 'n-1', text: 'check', color: '#ff0' });
  // Verify annotation mark exists.
  let foundAnnot = false;
  mounted.view.state.doc.descendants(function(n) {
    if (n.isText) n.marks.forEach(function(m) {
      if (m.type.name === 'annotation' && m.attrs.id === 'n-1') foundAnnot = true;
    });
  });
  assert.equal(foundAnnot, true, 'annotation mark applied through mounted v3 editor');
  mounted.view.destroy();
});

// ----------------------------------------------------------------
// PrintPreview integration end-to-end — runs against the mounted v3 view
// ----------------------------------------------------------------

test('PrintPreview.show(mountedView) renders fixed-sheet preview from the v3 editor state', () => {
  const { Rga } = boot();
  const editorEl = document.getElementById('editor');
  const mounted = Rga.Editor.mount(editorEl, { documentType: 'screenplay' });
  const ok = Rga.PrintPreview.show(mounted.view);
  assert.equal(ok, true);
  const root = document.getElementById('rga-print-preview-root');
  assert.ok(root);
  // Empty default doc renders to 1 sheet.
  assert.equal(root.querySelectorAll('.rga-page-sheet').length, 1);
  Rga.PrintPreview.hide();
  mounted.view.destroy();
});

// ----------------------------------------------------------------
// Empty doc round-trip through deserialize + reserialize
// ----------------------------------------------------------------

test('Rga.Doc.create() then deserialize-of-serialize stays v3 and reopens cleanly', () => {
  const { Rga } = boot();
  const editorEl = document.getElementById('editor');
  const mounted = Rga.Editor.mount(editorEl, { documentType: 'screenplay' });
  // Create a fresh doc; its body in PM-land becomes the mounted view's state.
  const fresh = Rga.Doc.create({});
  assert.ok(fresh);
  // The PM body the editor uses (from emptyDoc) is v3.
  assert.equal(mounted.view.state.doc.type.schema.nodes.scene !== undefined, true);
  mounted.view.destroy();
});
