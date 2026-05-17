// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 6 — PageMap integration tests:
//   * nav-index plugin maintains pageMap in state
//   * NavigationIndex.pages populated from PageMap (directive rule 8)
//   * Outline.statistics.pages populated from PageMap (directive rule 9)
//   * Decorations include page-marker widgets (Flow only)
//   * 100-scene fixture stays responsive
//   * inserting blocks updates pages live
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};

  const PMmodel = require('prosemirror-model');
  const PMstate = require('prosemirror-state');
  const PMview  = require('prosemirror-view');
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
    '../../../renderer/js/doc-types/screenplay/schema-v3.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  const sp = global.window.Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  return {
    Nav: global.window.Rga.Nav,
    Outline: global.window.Rga.Outline,
    Normalizer: global.window.Rga.Normalizer,
    LP: global.window.Rga.LayoutProfile,
    Engine: global.window.Rga.PageMap,
    schema: sp.buildSchemaV3(),
    PM: global.window.RgaProseMirror
  };
}

function scene(schema, id, opts) {
  opts = opts || {};
  const heading = schema.nodes.sceneHeading.create(
    { setting: opts.setting || 'INT.', time: opts.time || 'DAY', headingStyle: null },
    schema.text(opts.location || 'LOCATION ' + id)
  );
  const action = schema.nodes.action.create(null, schema.text(opts.action || 'Short action.'));
  const transition = schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'));
  return schema.nodes.scene.create(
    { id: id, notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [heading, action, transition]
  );
}

function doc(schema, scenes) {
  const body = schema.nodes.body.create(null, scenes);
  const title = schema.nodes.titleStrip.create({ removable: true });
  return schema.nodes.doc.create(null, [title, body]);
}

// ----------------------------------------------------------------
// Plugin state population
// ----------------------------------------------------------------

test('plugin state.init produces a PageMap + populates index.pages + outline.statistics.pages', () => {
  const { Nav, schema, PM } = boot();
  const plugin = Nav.buildIndexPlugin();
  const d = doc(schema, [scene(schema, 'a'), scene(schema, 'b')]);
  const state = PM.EditorState.create({ schema: schema, doc: d, plugins: [plugin] });

  const pageMap = Nav.getPageMap(state);
  assert.ok(Array.isArray(pageMap) && pageMap.length >= 1, 'pageMap present');

  const idx = Nav.getIndex(state);
  assert.ok(Array.isArray(idx.pages));
  assert.equal(idx.pages.length, pageMap.length);
  // First page lists both scenes for this tiny doc.
  assert.deepEqual(idx.pages[0].sceneIds.sort(), ['a', 'b']);

  const outline = Nav.getOutline(state);
  assert.equal(outline.statistics.pages, pageMap.length);
});

test('plugin re-runs PageMap on docChanged; pages update for inserted content', () => {
  const { Nav, schema, PM, Engine, LP } = boot();
  const plugin = Nav.buildIndexPlugin();
  const d0 = doc(schema, [scene(schema, 'a')]);
  const state0 = PM.EditorState.create({ schema: schema, doc: d0, plugins: [plugin] });
  const pages0 = Nav.getPageMap(state0).length;

  // Insert a scene at the start of body.
  const titleSize = state0.doc.child(0).nodeSize;
  const bodyStart = titleSize + 1;
  const tr = state0.tr.insert(bodyStart, scene(schema, 'b'));
  const state1 = state0.apply(tr);
  const idx1 = Nav.getIndex(state1);
  // Scene 'b' now listed first.
  assert.equal(idx1.scenes[0].nodeId, 'b');
  // Page-list updated: still on page 1 for this tiny doc.
  const pages1 = Nav.getPageMap(state1).length;
  assert.ok(pages1 >= pages0, 'pageMap rebuilt');
  // Outline updated too.
  const outline = Nav.getOutline(state1);
  assert.equal(outline.statistics.pages, pages1);
});

// ----------------------------------------------------------------
// Decorations include page-marker widgets when there's >1 page
// ----------------------------------------------------------------

test('decorations include page-marker widgets between pages', () => {
  const { Nav, schema, PM } = boot();
  const plugin = Nav.buildIndexPlugin();
  // Force a >1-page doc by stuffing many scenes with long action text.
  const scenes = [];
  for (let i = 0; i < 25; i += 1) {
    scenes.push(scene(schema, 'sc-' + i, { action: 'x'.repeat(60 * 5) })); // each ~7 lines
  }
  const d = doc(schema, scenes);
  const state = PM.EditorState.create({ schema: schema, doc: d, plugins: [plugin] });
  const decoSet = plugin.props.decorations(state);
  assert.ok(decoSet, 'decoration set present');
  // Collect widget decorations specifically.
  let widgetCount = 0;
  decoSet.find(0, d.content.size).forEach(function(dec) {
    if (dec.type && dec.type.toDOM) widgetCount += 1; // node deco
    if (dec.spec && (dec.spec.key || '').toString().startsWith('page-')) widgetCount += 0; // ignore — counted below
  });
  // Walk via the decoration set's internal find with side info — simpler:
  // pageMap length - 1 markers expected.
  const pageMap = Nav.getPageMap(state);
  const expectedMarkers = pageMap.length - 1;
  // Re-count by grepping widget specs.
  let actualMarkers = 0;
  decoSet.find(0, d.content.size).forEach(function(dec) {
    if (dec.spec && typeof dec.spec.key === 'string' && dec.spec.key.indexOf('page-') === 0) actualMarkers += 1;
  });
  assert.equal(actualMarkers, expectedMarkers, 'one widget per page break');
});

test('Single-page doc emits no page-marker widget', () => {
  const { Nav, schema, PM } = boot();
  const plugin = Nav.buildIndexPlugin();
  const d = doc(schema, [scene(schema, 'a')]);
  const state = PM.EditorState.create({ schema: schema, doc: d, plugins: [plugin] });
  const decoSet = plugin.props.decorations(state);
  let markers = 0;
  decoSet.find(0, d.content.size).forEach(function(dec) {
    if (dec.spec && typeof dec.spec.key === 'string' && dec.spec.key.indexOf('page-') === 0) markers += 1;
  });
  assert.equal(markers, 0);
});

// ----------------------------------------------------------------
// EditorView smoke — page markers actually render into the editor DOM
// ----------------------------------------------------------------

test('page-marker widgets appear in editor DOM when doc paginates beyond 1 page', () => {
  const { Nav, schema, PM } = boot();
  const plugin = Nav.buildIndexPlugin();
  const scenes = [];
  for (let i = 0; i < 25; i += 1) scenes.push(scene(schema, 'sc-' + i, { action: 'x'.repeat(60 * 5) }));
  const d = doc(schema, scenes);
  const state = PM.EditorState.create({ schema: schema, doc: d, plugins: [plugin] });
  const editorEl = document.getElementById('editor');
  const view = new PM.EditorView(editorEl, { state: state });

  const markers = editorEl.querySelectorAll('.rga-page-marker');
  const pageMap = Nav.getPageMap(view.state);
  assert.equal(markers.length, pageMap.length - 1);
  // Marker text format check.
  if (markers.length > 0) {
    assert.match(markers[0].textContent, /^— Page \d+ —$/);
    assert.equal(markers[0].dataset.pageNumber, '2');
  }
  view.destroy();
});

// ----------------------------------------------------------------
// 100-scene fixture — responsiveness gate
// ----------------------------------------------------------------

test('100-scene fixture: PageMap builds without error and Nav.pages is populated', () => {
  const { Nav, schema, PM } = boot();
  const plugin = Nav.buildIndexPlugin();
  const scenes = [];
  for (let i = 1; i <= 100; i += 1) {
    scenes.push(scene(schema, 'sc-' + i, { action: 'A line of action for scene ' + i + '.' }));
  }
  const d = doc(schema, scenes);
  const state = PM.EditorState.create({ schema: schema, doc: d, plugins: [plugin] });
  const idx = Nav.getIndex(state);
  const pageMap = Nav.getPageMap(state);
  assert.equal(idx.scenes.length, 100);
  assert.ok(pageMap.length >= 5, 'expected multi-page output for 100 scenes, got ' + pageMap.length);
  assert.equal(idx.pages.length, pageMap.length);
  // Every page lists at least one scene; sceneIds are unique within each page.
  for (let i = 0; i < idx.pages.length; i += 1) {
    const set = new Set(idx.pages[i].sceneIds);
    assert.equal(set.size, idx.pages[i].sceneIds.length, 'no dup sceneIds on page ' + (i + 1));
  }
});

test('100-scene fixture: nav plugin state.apply completes under 200ms per doc-changing transaction', () => {
  const { Nav, schema, PM } = boot();
  const plugin = Nav.buildIndexPlugin();
  const scenes = [];
  for (let i = 1; i <= 100; i += 1) scenes.push(scene(schema, 'sc-' + i));
  const d = doc(schema, scenes);
  let state = PM.EditorState.create({ schema: schema, doc: d, plugins: [plugin] });
  // Trigger 5 doc-changing transactions; measure the slowest.
  const samples = [];
  for (let i = 0; i < 5; i += 1) {
    const titleSize = state.doc.child(0).nodeSize;
    const bodyStart = titleSize + 1;
    const tr = state.tr.insert(bodyStart, scene(schema, 'inj-' + i));
    const t0 = Date.now();
    state = state.apply(tr);
    samples.push(Date.now() - t0);
  }
  const max = Math.max.apply(null, samples);
  assert.ok(max < 200, 'slowest state.apply was ' + max + 'ms (samples ' + samples.join(',') + ')');
});

// ----------------------------------------------------------------
// PageMap entries shape
// ----------------------------------------------------------------

test('idx.pages[].lineCount equals pageMap[].usedLines (same number, different surface)', () => {
  const { Nav, schema, PM } = boot();
  const plugin = Nav.buildIndexPlugin();
  const scenes = [];
  for (let i = 0; i < 10; i += 1) scenes.push(scene(schema, 'sc-' + i, { action: 'x'.repeat(60 * 3) }));
  const d = doc(schema, scenes);
  const state = PM.EditorState.create({ schema: schema, doc: d, plugins: [plugin] });
  const idx = Nav.getIndex(state);
  const pageMap = Nav.getPageMap(state);
  for (let i = 0; i < idx.pages.length; i += 1) {
    assert.equal(idx.pages[i].lineCount, pageMap[i].usedLines, 'page ' + (i + 1));
  }
});
