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
  // Phase C correction: single-label design contract checks.
  if (markers.length > 0) {
    const m = markers[0];
    // data-page-number preserved for Print view's CSS ::after rule.
    assert.equal(m.dataset.pageNumber, '2',
      'data-page-number must equal the page beginning below the marker (2 for the first boundary)');
    // Phase C attributes carry both sides of the transition.
    assert.equal(m.dataset.pageEnds, '1',
      'data-page-ends must equal the page that just ended (1 for the first boundary)');
    assert.equal(m.dataset.pageBegins, '2',
      'data-page-begins must equal the page that is beginning (2 for the first boundary)');
    // Single-label design: NO end-of-page span (Phase C correction).
    const endSpan   = m.querySelector('.rga-page-marker-end');
    const beginSpan = m.querySelector('.rga-page-marker-begin');
    assert.strictEqual(endSpan, null,
      'no end-of-page label per corrected single-label design');
    assert.ok(beginSpan, '.rga-page-marker-begin span must exist');
    assert.equal(beginSpan.textContent, 'Page 2',
      '.rga-page-marker-begin text must be "Page N+1" (the page being entered)');
    // aria-label uses the simpler "entering" form.
    assert.ok(/Entering page 2/.test(m.getAttribute('aria-label')),
      'aria-label must use the "Entering page N+1" form');
    // Old dashes format must NOT appear anywhere in the marker.
    assert.ok(!/— Page \d+ —/.test(m.textContent),
      'Phase C removes the old "— Page N —" dash format');
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

// ----------------------------------------------------------------
// Phase C — page-marker widget DOM contract (two-side band)
// ----------------------------------------------------------------

test('Phase C: page-marker widget has data-page-ends and data-page-begins as consecutive integers', () => {
  const { Nav, schema, PM } = boot();
  const plugin = Nav.buildIndexPlugin();
  const scenes = [];
  for (let i = 0; i < 25; i += 1) scenes.push(scene(schema, 'sc-' + i, { action: 'x'.repeat(60 * 5) }));
  const d = doc(schema, scenes);
  const state = PM.EditorState.create({ schema: schema, doc: d, plugins: [plugin] });
  const editorEl = document.getElementById('editor');
  const view = new PM.EditorView(editorEl, { state: state });

  const markers = editorEl.querySelectorAll('.rga-page-marker');
  assert.ok(markers.length > 0, 'must have at least one marker for this fixture');
  for (let i = 0; i < markers.length; i += 1) {
    const m = markers[i];
    const ends   = parseInt(m.dataset.pageEnds, 10);
    const begins = parseInt(m.dataset.pageBegins, 10);
    assert.ok(!isNaN(ends),   'marker[' + i + '] data-page-ends must be a number');
    assert.ok(!isNaN(begins), 'marker[' + i + '] data-page-begins must be a number');
    assert.equal(begins, ends + 1,
      'marker[' + i + ']: data-page-begins must equal data-page-ends + 1 (consecutive pages)');
  }
  view.destroy();
});

test('Phase C: page-marker widget preserves data-page-number equal to data-page-begins (Print view compat)', () => {
  const { Nav, schema, PM } = boot();
  const plugin = Nav.buildIndexPlugin();
  const scenes = [];
  for (let i = 0; i < 25; i += 1) scenes.push(scene(schema, 'sc-' + i, { action: 'x'.repeat(60 * 5) }));
  const d = doc(schema, scenes);
  const state = PM.EditorState.create({ schema: schema, doc: d, plugins: [plugin] });
  const editorEl = document.getElementById('editor');
  const view = new PM.EditorView(editorEl, { state: state });

  const markers = editorEl.querySelectorAll('.rga-page-marker');
  assert.ok(markers.length > 0, 'must have at least one marker for this fixture');
  for (let i = 0; i < markers.length; i += 1) {
    const m = markers[i];
    assert.equal(m.dataset.pageNumber, m.dataset.pageBegins,
      'marker[' + i + ']: data-page-number must equal data-page-begins ' +
      '(Print view CSS uses attr(data-page-number) — must stay in sync)');
  }
  view.destroy();
});

test('Phase C correction: page-marker has exactly rule + begin spans; NO end-of-page label (single-label design)', () => {
  const { Nav, schema, PM } = boot();
  const plugin = Nav.buildIndexPlugin();
  const scenes = [];
  for (let i = 0; i < 25; i += 1) scenes.push(scene(schema, 'sc-' + i, { action: 'x'.repeat(60 * 5) }));
  const d = doc(schema, scenes);
  const state = PM.EditorState.create({ schema: schema, doc: d, plugins: [plugin] });
  const editorEl = document.getElementById('editor');
  const view = new PM.EditorView(editorEl, { state: state });

  const markers = editorEl.querySelectorAll('.rga-page-marker');
  assert.ok(markers.length > 0, 'must have at least one marker for this fixture');
  for (let i = 0; i < markers.length; i += 1) {
    const m         = markers[i];
    const endSpan   = m.querySelector('.rga-page-marker-end');
    const ruleSpan  = m.querySelector('.rga-page-marker-rule');
    const beginSpan = m.querySelector('.rga-page-marker-begin');
    // The end-of-page span was removed in the Phase C correction.
    assert.strictEqual(endSpan, null,
      'marker[' + i + '] must NOT contain .rga-page-marker-end span (single-label design)');
    assert.ok(ruleSpan,  'marker[' + i + '] must contain .rga-page-marker-rule span (hairline)');
    assert.ok(beginSpan, 'marker[' + i + '] must contain .rga-page-marker-begin span (page label)');
    const begins = m.dataset.pageBegins;
    assert.equal(beginSpan.textContent, 'Page ' + begins,
      'marker[' + i + '] begin span must say "Page ' + begins + '" (the page being entered)');
  }
  view.destroy();
});

test('Phase C correction: page-marker aria-label uses "Entering page N+1" form', () => {
  const { Nav, schema, PM } = boot();
  const plugin = Nav.buildIndexPlugin();
  const scenes = [];
  for (let i = 0; i < 25; i += 1) scenes.push(scene(schema, 'sc-' + i, { action: 'x'.repeat(60 * 5) }));
  const d = doc(schema, scenes);
  const state = PM.EditorState.create({ schema: schema, doc: d, plugins: [plugin] });
  const editorEl = document.getElementById('editor');
  const view = new PM.EditorView(editorEl, { state: state });

  const markers = editorEl.querySelectorAll('.rga-page-marker');
  assert.ok(markers.length > 0, 'must have at least one marker for this fixture');
  for (let i = 0; i < markers.length; i += 1) {
    const m      = markers[i];
    const label  = m.getAttribute('aria-label') || '';
    const begins = m.dataset.pageBegins;
    // Corrected single-label design: aria-label names only the page being entered.
    assert.ok(label.toLowerCase().includes('entering page ' + begins),
      'aria-label must use "Entering page N+1" form for marker[' + i + ']; got: ' + label);
  }
  view.destroy();
});

test('Phase C: page-marker does NOT set aria-hidden (otherwise aria-label is silently ignored)', () => {
  const { Nav, schema, PM } = boot();
  const plugin = Nav.buildIndexPlugin();
  const scenes = [];
  for (let i = 0; i < 25; i += 1) scenes.push(scene(schema, 'sc-' + i, { action: 'x'.repeat(60 * 5) }));
  const d = doc(schema, scenes);
  const state = PM.EditorState.create({ schema: schema, doc: d, plugins: [plugin] });
  const editorEl = document.getElementById('editor');
  const view = new PM.EditorView(editorEl, { state: state });

  const markers = editorEl.querySelectorAll('.rga-page-marker');
  assert.ok(markers.length > 0, 'must have at least one marker for this fixture');
  for (let i = 0; i < markers.length; i += 1) {
    const marker = markers[i];
    assert.ok(!marker.hasAttribute('aria-hidden'),
      'page-marker must not set aria-hidden — would mask aria-label');
  }
  view.destroy();
});

// ----------------------------------------------------------------
// Phase C correction — single-label design (no end-of-page span)
// ----------------------------------------------------------------

test('Correction: page-marker has NO end-of-page label (single-label design)', () => {
  // Regression guard: after the Phase C correction, no marker in any
  // paginated doc must contain a .rga-page-marker-end element.
  // The end-of-page label was removed because it added noise to the
  // writer's mental model. data-page-ends attribute is still set; only
  // the rendered <span> is absent.
  const { Nav, schema, PM } = boot();
  const plugin = Nav.buildIndexPlugin();
  const scenes = [];
  for (let i = 0; i < 25; i += 1) scenes.push(scene(schema, 'sc-' + i, { action: 'x'.repeat(60 * 5) }));
  const d = doc(schema, scenes);
  const state = PM.EditorState.create({ schema: schema, doc: d, plugins: [plugin] });
  const editorEl = document.getElementById('editor');
  const view = new PM.EditorView(editorEl, { state: state });

  const markers = editorEl.querySelectorAll('.rga-page-marker');
  assert.ok(markers.length > 0, 'must have at least one marker for this fixture');
  for (let i = 0; i < markers.length; i += 1) {
    assert.strictEqual(
      markers[i].querySelector('.rga-page-marker-end'),
      null,
      'no end-of-page label per corrected single-label design (marker[' + i + '])'
    );
  }
  view.destroy();
});
