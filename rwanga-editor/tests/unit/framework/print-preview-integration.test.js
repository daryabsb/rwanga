// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 7 — PrintPreview integration tests.
//
// End-to-end gates:
//   ✓ one-page fixture renders one fixed sheet
//   ✓ overflow fixture renders two fixed sheets
//   ✓ 100-scene fixture renders many sheets
//   ✓ backspace/add text changes content distribution, not sheet height
//   ✓ PrintPreview reads from RenderModel (no editor-DOM cloning)
//   ✓ Flow mode still works (editor not destroyed by preview lifecycle)
//   ✓ NavigationIndex.pages still matches PageMap
//   ✓ Outline.statistics.pages still matches rendered sheet count
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot(options) {
  options = options || {};
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>');
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
  return {
    Rga:     global.window.Rga,
    schema:  sp.buildSchemaV3(),
    PM:      global.window.RgaProseMirror,
    sp:      sp,
    dom:     dom
  };
}

function scene(schema, id, opts) {
  opts = opts || {};
  const heading = schema.nodes.sceneHeading.create(
    { setting: opts.setting != null ? opts.setting : 'INT.',
      time:    opts.time    != null ? opts.time    : 'DAY',
      headingStyle: null },
    schema.text(opts.location || 'LOCATION ' + id)
  );
  const action = schema.nodes.action.create(null, schema.text(opts.action || 'Action.'));
  const transition = schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'));
  return schema.nodes.scene.create(
    { id: id, notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [heading, action, transition]
  );
}

function buildEditor(schema, scenes, PM, plugins) {
  const body = schema.nodes.body.create(null, scenes);
  const title = schema.nodes.titleStrip.create({ removable: true });
  const doc = schema.nodes.doc.create(null, [title, body]);
  const state = PM.EditorState.create({ schema: schema, doc: doc, plugins: plugins || [] });
  const editorEl = document.getElementById('editor');
  return new PM.EditorView(editorEl, { state: state });
}

// ----------------------------------------------------------------
// buildModel — Pure pipeline (no DOM mount)
// ----------------------------------------------------------------

test('buildModel from a 1-scene view returns 1 page', () => {
  const { Rga, schema, PM } = boot();
  const view = buildEditor(schema, [scene(schema, 'a')], PM);
  const model = Rga.PrintPreview.buildModel(view);
  assert.equal(model.totalPages, 1);
  view.destroy();
});

test('buildModel from a multi-page-worth view returns >=2 pages', () => {
  const { Rga, schema, PM } = boot();
  const scenes = [];
  for (let i = 0; i < 30; i += 1) scenes.push(scene(schema, 'sc-' + i, { action: 'x'.repeat(60 * 4) }));
  const view = buildEditor(schema, scenes, PM);
  const model = Rga.PrintPreview.buildModel(view);
  assert.ok(model.totalPages >= 2);
  view.destroy();
});

test('buildModel returns null when view is missing', () => {
  const { Rga } = boot();
  assert.equal(Rga.PrintPreview.buildModel(null), null);
});

// ----------------------------------------------------------------
// show/hide lifecycle
// ----------------------------------------------------------------

test('show mounts preview root + sets body.view-print-preview-active', () => {
  const { Rga, schema, PM } = boot();
  const view = buildEditor(schema, [scene(schema, 'a')], PM);
  const ok = Rga.PrintPreview.show(view);
  assert.equal(ok, true);
  assert.equal(Rga.PrintPreview.isActive(), true);
  assert.equal(document.body.classList.contains('view-print-preview-active'), true);
  const root = document.getElementById('rga-print-preview-root');
  assert.ok(root);
  assert.equal(root.querySelectorAll('.rga-page-sheet').length, 1);
  Rga.PrintPreview.hide();
  view.destroy();
});

test('hide removes preview root + body class; editor remains alive afterwards', () => {
  const { Rga, schema, PM } = boot();
  const view = buildEditor(schema, [scene(schema, 'a')], PM);
  Rga.PrintPreview.show(view);
  Rga.PrintPreview.hide();
  assert.equal(document.body.classList.contains('view-print-preview-active'), false);
  assert.equal(document.getElementById('rga-print-preview-root'), null);
  assert.equal(Rga.PrintPreview.isActive(), false);
  // Editor still mounted — Flow mode unaffected.
  assert.equal(view.dom.isConnected, true);
  view.destroy();
});

test('show is idempotent — calling twice re-renders into the same root, no duplicate roots', () => {
  const { Rga, schema, PM } = boot();
  const view = buildEditor(schema, [scene(schema, 'a')], PM);
  Rga.PrintPreview.show(view);
  Rga.PrintPreview.show(view);
  const roots = document.querySelectorAll('#rga-print-preview-root');
  assert.equal(roots.length, 1);
  Rga.PrintPreview.hide();
  view.destroy();
});

// ----------------------------------------------------------------
// Acceptance gates: page-sheet count tracks PageMap
// ----------------------------------------------------------------

test('one-page fixture → 1 mounted .rga-page-sheet', () => {
  const { Rga, schema, PM } = boot();
  const view = buildEditor(schema, [scene(schema, 'a')], PM);
  Rga.PrintPreview.show(view);
  const root = document.getElementById('rga-print-preview-root');
  assert.equal(root.querySelectorAll('.rga-page-sheet').length, 1);
  Rga.PrintPreview.hide();
  view.destroy();
});

test('overflow fixture → 2+ mounted sheets', () => {
  const { Rga, schema, PM } = boot();
  const scenes = [];
  for (let i = 0; i < 30; i += 1) scenes.push(scene(schema, 'sc-' + i, { action: 'x'.repeat(60 * 4) }));
  const view = buildEditor(schema, scenes, PM);
  Rga.PrintPreview.show(view);
  const root = document.getElementById('rga-print-preview-root');
  assert.ok(root.querySelectorAll('.rga-page-sheet').length >= 2);
  Rga.PrintPreview.hide();
  view.destroy();
});

test('100-scene fixture → many sheets, count matches PageMap', () => {
  const { Rga, schema, PM } = boot();
  const scenes = [];
  for (let i = 1; i <= 100; i += 1) scenes.push(scene(schema, 'sc-' + i));
  const view = buildEditor(schema, scenes, PM);
  // Compute the expected count via the same pipeline.
  const expected = Rga.PrintPreview.buildModel(view).totalPages;
  Rga.PrintPreview.show(view);
  const root = document.getElementById('rga-print-preview-root');
  assert.equal(root.querySelectorAll('.rga-page-sheet').length, expected);
  assert.ok(expected >= 5, 'expected 100 scenes to span multiple pages, got ' + expected);
  Rga.PrintPreview.hide();
  view.destroy();
});

// ----------------------------------------------------------------
// "Sheet heights are fixed" — content change shifts distribution, not size
// ----------------------------------------------------------------

test('content insertion changes sheet COUNT; sheet height stays uniform (from layoutProfile)', () => {
  // UPDATED 2026-05-19: Contract changed — P0 dual-ownership collapse.
  // Sheet height is now written INLINE from layoutProfile.pageSize.h (not CSS-only).
  // All sheets must carry the SAME inline height (uniform paper size); content
  // changes the number of sheets, not the individual sheet height.
  const { Rga, schema, PM } = boot();
  const scenes = [];
  for (let i = 0; i < 10; i += 1) scenes.push(scene(schema, 'sc-' + i, { action: 'x'.repeat(60 * 3) }));
  const view = buildEditor(schema, scenes, PM);
  Rga.PrintPreview.show(view);
  const root = document.getElementById('rga-print-preview-root');
  const sheetsBefore = root.querySelectorAll('.rga-page-sheet');
  const countBefore = sheetsBefore.length;
  // Every sheet must carry a non-empty inline height from layoutProfile (single owner).
  // All sheets on the same render pass must have the SAME inline height.
  let heightBefore = null;
  sheetsBefore.forEach(function(s) {
    assert.ok(s.style.height !== '', 'sheet must carry inline height from layoutProfile.pageSize.h');
    if (heightBefore === null) { heightBefore = s.style.height; }
    assert.equal(s.style.height, heightBefore, 'all sheets must have uniform inline height');
  });

  // Insert 10 more scenes via PM transaction; re-show preview.
  const titleSize = view.state.doc.child(0).nodeSize;
  const bodyStart = titleSize + 1;
  for (let i = 100; i < 110; i += 1) {
    const tr = view.state.tr.insert(bodyStart, scene(schema, 'inj-' + i, { action: 'x'.repeat(60 * 3) }));
    view.dispatch(tr);
  }
  Rga.PrintPreview.show(view);
  const sheetsAfter = root.querySelectorAll('.rga-page-sheet');
  // More content → more (or same) sheets; each sheet still has the same uniform height.
  assert.ok(sheetsAfter.length >= countBefore, 'sheet count grows or stays — does not shrink unexpectedly');
  sheetsAfter.forEach(function(s) {
    assert.equal(s.style.height, heightBefore, 'sheet height unchanged after content insertion (same layoutProfile)');
  });
  Rga.PrintPreview.hide();
  view.destroy();
});

// ----------------------------------------------------------------
// "PrintPreview reads from RenderModel, not editor DOM"
// ----------------------------------------------------------------

test('PrintPreview source files have no editor-DOM access (.ProseMirror, .rga-scene-v3 queries, etc.)', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.resolve(__dirname, '../../../renderer/js/framework');
  ['render-model.js', 'print-renderer.js', 'print-preview.js'].forEach(function(file) {
    const code = fs.readFileSync(path.join(root, file), 'utf8')
      .split('\n')
      .map(function(line) { const i = line.indexOf('//'); return i >= 0 ? line.slice(0, i) : line; })
      .join('\n');
    // No querying the editor's surfaces.
    assert.equal(/\.ProseMirror\b/.test(code), false, file + ' references .ProseMirror');
    assert.equal(/\brga-scene-v3\b/.test(code), false, file + ' references .rga-scene-v3 (editor chrome)');
    assert.equal(/getBoundingClientRect\s*\(/.test(code), false, file + ' calls getBoundingClientRect');
    assert.equal(/\boffsetHeight\b|\boffsetWidth\b/.test(code), false, file + ' reads offsetHeight/Width');
    assert.equal(/\bclientHeight\b|\bclientWidth\b/.test(code), false, file + ' reads clientHeight/Width');
  });
});

// ----------------------------------------------------------------
// Cross-phase invariants — Phase 5/6 still pass
// ----------------------------------------------------------------

test('NavigationIndex.pages count matches what PrintPreview renders (one source of truth)', () => {
  const { Rga, schema, PM } = boot();
  const scenes = [];
  for (let i = 0; i < 30; i += 1) scenes.push(scene(schema, 'sc-' + i, { action: 'x'.repeat(60 * 4) }));
  const plugin = Rga.Nav.buildIndexPlugin();
  const view = buildEditor(schema, scenes, PM, [plugin]);
  const idx = Rga.Nav.getIndex(view.state);
  const model = Rga.PrintPreview.buildModel(view);
  assert.equal(idx.pages.length, model.totalPages);
  view.destroy();
});

test('Outline.statistics.pages matches sheet count when preview is shown', () => {
  const { Rga, schema, PM } = boot();
  const scenes = [];
  for (let i = 0; i < 30; i += 1) scenes.push(scene(schema, 'sc-' + i, { action: 'x'.repeat(60 * 4) }));
  const plugin = Rga.Nav.buildIndexPlugin();
  const view = buildEditor(schema, scenes, PM, [plugin]);
  const outline = Rga.Nav.getOutline(view.state);
  Rga.PrintPreview.show(view);
  const root = document.getElementById('rga-print-preview-root');
  const sheetCount = root.querySelectorAll('.rga-page-sheet').length;
  assert.equal(outline.statistics.pages, sheetCount, 'outline.statistics.pages == rendered sheet count');
  Rga.PrintPreview.hide();
  view.destroy();
});
