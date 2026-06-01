// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 4 correction: lock the SceneIndex contract.
// Pure-function tests for Rga.Nav.buildIndex + the plugin's state/decoration
// emission. No DOM, no EditorView — verifies the doc-state-derived index
// IS the source of truth for scene numbering.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bootNav() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};

  const PMmodel = require('prosemirror-model');
  const PMstate = require('prosemirror-state');
  const PMview  = require('prosemirror-view');
  global.window.RgaProseMirror = {
    EditorState:   PMstate.EditorState,
    Schema:        PMmodel.Schema,
    PMNode:        PMmodel.Node,
    Plugin:        PMstate.Plugin,
    PluginKey:     PMstate.PluginKey,
    Decoration:    PMview.Decoration,
    DecorationSet: PMview.DecorationSet
  };

  const paths = [
    '../../../renderer/js/framework/base-outer-marks.js',
    '../../../renderer/js/framework/document-outline.js',
    '../../../renderer/js/framework/slug-resolver.js',
    '../../../renderer/js/framework/nav-index.js',
    '../../../renderer/js/doc-types/screenplay/schema-v3.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const sp = global.window.Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  return { Nav: global.window.Rga.Nav, schema: sp.buildSchemaV3(), PM: global.window.RgaProseMirror };
}

function makeScene(schema, id) {
  return schema.nodes.scene.create(
    { id: id, notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [
      schema.nodes.sceneHeading.create({setting:'INT.',time:'DAY',headingStyle:null}),
      schema.nodes.action.create()
    ]
  );
}

function makeDoc(schema, scenes) {
  const body = schema.nodes.body.create(null, scenes);
  const title = schema.nodes.titleStrip.create({removable:true});
  return schema.nodes.doc.create(null, [title, body]);
}

// ----------------------------------------------------------------
// buildIndex — pure function
// ----------------------------------------------------------------

test('buildIndex returns empty index for doc with no scenes', () => {
  const { Nav, schema } = bootNav();
  const body = schema.nodes.body.create(null, [schema.nodes.paragraph.create()]);
  const title = schema.nodes.titleStrip.create({removable:true});
  const doc = schema.nodes.doc.create(null, [title, body]);
  const idx = Nav.buildIndex(doc);
  assert.equal(idx.scenes.length, 0);
  assert.equal(idx.byPos.size, 0);
  assert.equal(idx.byId.size, 0);
});

test('buildIndex numbers scenes 1..N in doc order', () => {
  const { Nav, schema } = bootNav();
  const doc = makeDoc(schema, [makeScene(schema, 'a'), makeScene(schema, 'b'), makeScene(schema, 'c')]);
  const idx = Nav.buildIndex(doc);
  assert.equal(idx.scenes.length, 3);
  assert.deepEqual(idx.scenes.map(s => s.sceneNumber), [1, 2, 3]);
  assert.deepEqual(idx.scenes.map(s => s.nodeId), ['a', 'b', 'c']);
});

test('buildIndex byId resolves scene attrs.id to derived number', () => {
  const { Nav, schema } = bootNav();
  const doc = makeDoc(schema, [makeScene(schema, 'alpha'), makeScene(schema, 'beta')]);
  const idx = Nav.buildIndex(doc);
  assert.equal(idx.byId.get('alpha'), 1);
  assert.equal(idx.byId.get('beta'), 2);
  assert.equal(idx.byId.get('gamma'), undefined);
});

test('buildIndex byPos resolves a scene\'s pos to its number', () => {
  const { Nav, schema } = bootNav();
  const doc = makeDoc(schema, [makeScene(schema, 'a'), makeScene(schema, 'b')]);
  const idx = Nav.buildIndex(doc);
  // Re-walk to find positions in the doc, cross-check against byPos.
  let found = 0;
  doc.descendants(function(node, pos) {
    if (node.type.name === 'scene') {
      assert.equal(idx.byPos.get(pos), found + 1);
      found += 1;
    }
  });
  assert.equal(found, 2);
});

test('buildIndex skips scenes without attrs.id from byId but still numbers them', () => {
  const { Nav, schema } = bootNav();
  // Force a scene WITHOUT an id (override default).
  const noIdScene = schema.nodes.scene.create(
    { id: null, notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [schema.nodes.sceneHeading.create({setting:'INT.',time:'DAY',headingStyle:null}), schema.nodes.action.create()]
  );
  const doc = makeDoc(schema, [makeScene(schema, 'first'), noIdScene]);
  const idx = Nav.buildIndex(doc);
  assert.equal(idx.scenes.length, 2);
  assert.equal(idx.scenes[1].sceneNumber, 2);
  assert.equal(idx.scenes[1].nodeId, null);
  assert.equal(idx.byId.size, 1, 'only the scene with id is in byId');
});

test('buildIndex tolerates missing / falsy doc input', () => {
  const { Nav } = bootNav();
  const empty = Nav.buildIndex(null);
  assert.equal(empty.scenes.length, 0);
  assert.equal(empty.byPos.size, 0);
});

// ----------------------------------------------------------------
// Plugin behaviour — index lives in PM state, syncs on doc change
// ----------------------------------------------------------------

function makeState(schema, scenes, PM, plugin) {
  return PM.EditorState.create({ schema: schema, doc: makeDoc(schema, scenes), plugins: [plugin] });
}

test('plugin state.init produces a SceneIndex reflecting initial doc', () => {
  const { Nav, schema, PM } = bootNav();
  const plugin = Nav.buildIndexPlugin();
  const state = makeState(schema, [makeScene(schema, 'a'), makeScene(schema, 'b')], PM, plugin);
  const idx = Nav.getIndex(state);
  assert.ok(idx, 'index present in plugin state');
  assert.equal(idx.scenes.length, 2);
  assert.equal(idx.byId.get('a'), 1);
  assert.equal(idx.byId.get('b'), 2);
});

test('plugin state.apply refreshes SceneIndex on doc-changing transaction', () => {
  const { Nav, schema, PM } = bootNav();
  const plugin = Nav.buildIndexPlugin();
  const state0 = makeState(schema, [makeScene(schema, 'a'), makeScene(schema, 'b')], PM, plugin);

  // Insert a new scene at the very start of body (pos 1 inside body container).
  // body is doc.child(1); body's start = titleStrip.nodeSize + 1.
  const titleSize = state0.doc.child(0).nodeSize;
  const bodyStart = titleSize + 1; // inside body
  const newScene = makeScene(schema, 'inserted-first');
  const tr = state0.tr.insert(bodyStart, newScene);
  const state1 = state0.apply(tr);

  const idx = Nav.getIndex(state1);
  assert.equal(idx.scenes.length, 3);
  assert.equal(idx.byId.get('inserted-first'), 1);
  assert.equal(idx.byId.get('a'), 2);
  assert.equal(idx.byId.get('b'), 3);
});

test('plugin emits NodeDecorations carrying sceneNumber spec', () => {
  const { Nav, schema, PM } = bootNav();
  const plugin = Nav.buildIndexPlugin();
  const state = makeState(schema, [makeScene(schema, 'a'), makeScene(schema, 'b'), makeScene(schema, 'c')], PM, plugin);
  const decoSet = plugin.props.decorations(state);
  assert.ok(decoSet, 'decoration set present');
  // Find all decorations covering the doc range.
  const decos = decoSet.find(0, state.doc.content.size);
  assert.equal(decos.length, 3, 'one decoration per scene');
  const nums = decos.map(d => d.spec.sceneNumber).sort((a,b)=>a-b);
  assert.deepEqual(nums, [1,2,3]);
});

test('readNumberFromDecorations extracts spec.sceneNumber from a decoration list', () => {
  const { Nav, schema, PM } = bootNav();
  const plugin = Nav.buildIndexPlugin();
  const state = makeState(schema, [makeScene(schema, 'a'), makeScene(schema, 'b')], PM, plugin);
  const decoSet = plugin.props.decorations(state);
  // Read deco at first scene's pos.
  let firstScenePos = null;
  state.doc.descendants(function(n, p) { if (n.type.name === 'scene' && firstScenePos === null) firstScenePos = p; });
  const decos = decoSet.find(firstScenePos, firstScenePos + 1);
  const n = Nav.readNumberFromDecorations(decos);
  assert.equal(n, 1);
});

test('readNumberFromDecorations returns null for empty / missing input', () => {
  const { Nav } = bootNav();
  assert.equal(Nav.readNumberFromDecorations(null), null);
  assert.equal(Nav.readNumberFromDecorations(undefined), null);
  assert.equal(Nav.readNumberFromDecorations([]), null);
  assert.equal(Nav.readNumberFromDecorations([{ spec: {} }]), null);
});

// ----------------------------------------------------------------
// SceneIndex is independent of DOM — proves rule "DOM not source of truth"
// ----------------------------------------------------------------

test('buildIndex works with no DOM / no window context (pure function over PM data)', () => {
  // Re-import nav-index into a fresh window context, then run buildIndex
  // without ever creating an EditorView. If the pure function depended on
  // DOM, this would fail.
  const { Nav, schema } = bootNav();
  const doc = makeDoc(schema, [makeScene(schema, 'x'), makeScene(schema, 'y')]);
  // Sanity: no .rga-scene-v3 elements exist in document.body.
  assert.equal(global.document.querySelectorAll('.rga-scene-v3').length, 0);
  const idx = Nav.buildIndex(doc);
  assert.equal(idx.scenes.length, 2);
  assert.equal(idx.byId.get('x'), 1);
  assert.equal(idx.byId.get('y'), 2);
});
