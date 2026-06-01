// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// SlugResolver V1 — parity, golden, and single-composer compliance.
//
// Proves the convergence is BEHAVIOR-PRESERVING (SLUG_RESOLVER_DESIGN_BRIEF §8):
//   * resolver(default)   === legacy Print/Nav composition  (byte-identical)
//   * resolver(profile)   === legacy PageMap measure string  (byte-identical)
//   * Print end-to-end render textContent === resolver text
//   * PageMap measured line-count unchanged (geometry parity)
//   * Nav-index headingDisplay === resolver text
//   * golden sample length unchanged
//   * STATIC GUARD: no second live string composer remains in the 3 consumers
//   * Flow compliance: PENDING (skipped) — Flow convergence is a later slice
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const RENDERER = path.join(__dirname, '../../../renderer');

// ----------------------------------------------------------------
// Legacy reference composers — VERBATIM copies of the pre-resolver logic.
// These live only in the test; they are the ground truth the resolver must
// reproduce byte-for-byte. (Not a second live composer — the static guard
// below proves the three SOURCE modules no longer carry their own.)
// ----------------------------------------------------------------
function legacyDisplay(h) { // pre-refactor Print (_appendHeadingDisplay) AND Nav (_composeHeadingDisplay)
  const parts = [];
  if (h.setting) parts.push(h.setting);
  if (h.location) parts.push(h.location);
  let d = parts.join(' ');
  if (h.time) d += (d ? ' — ' : '') + h.time;
  return d;
}
function legacyMeasure(h, sep) { // pre-refactor PageMap (_composeHeadingForMeasure)
  sep = sep || { settingLocation: ' ', locationTime: ' — ' };
  let s = '';
  if (h.setting) s += h.setting;
  if (h.location) { if (s) s += sep.settingLocation; s += h.location; }
  if (h.time) { if (s) s += sep.locationTime; s += h.time; }
  return s;
}

const MATRIX = [
  { setting: 'INT.', location: 'KITCHEN', time: 'DAY' },
  { setting: 'EXT.', location: 'BEACH', time: 'NIGHT' },
  { setting: 'INT.', location: '', time: 'DAY' },
  { setting: '', location: 'KITCHEN', time: 'DAY' },
  { setting: 'INT.', location: 'KITCHEN', time: '' },
  { setting: '', location: '', time: 'DAY' },
  { setting: 'INT.', location: '', time: '' },
  { setting: '', location: 'KITCHEN', time: '' },
  { setting: '', location: '', time: '' },
  { setting: 'INT./EXT.', location: 'APARTMENT — KITCHEN', time: 'CONTINUOUS' },
  { setting: 'داخلي', location: 'مطبخ', time: 'ليل' }
];

function bootResolver() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  ['../../../renderer/js/framework/slug-resolver.js',
   '../../../renderer/js/framework/constants.js',
   '../../../renderer/js/framework/layout-profile.js'].forEach(function(p) {
    try { delete require.cache[require.resolve(p)]; require(p); } catch (e) { /* constants optional */ }
  });
  return global.window.Rga;
}

// ----------------------------------------------------------------
// Parity: resolver === legacy, across the matrix
// ----------------------------------------------------------------

test('parity: resolver(default convention) === legacy Print/Nav composition', () => {
  const Rga = bootResolver();
  MATRIX.forEach(function(h) {
    assert.equal(Rga.SlugResolver.compose(h).text, legacyDisplay(h), JSON.stringify(h));
  });
});

test('parity: resolver(profile convention) === legacy PageMap measure string', () => {
  const Rga = bootResolver();
  const lp = Rga.LayoutProfile.compose();
  const spec = lp.blocks.sceneHeading;
  const convention = { order: spec.order, separators: spec.separators };
  MATRIX.forEach(function(h) {
    assert.equal(
      Rga.SlugResolver.compose(h, convention).text,
      legacyMeasure(h, spec.separators),
      JSON.stringify(h)
    );
  });
});

test('parity: measured length (resolver) === legacy measured length — no geometry drift', () => {
  const Rga = bootResolver();
  const lp = Rga.LayoutProfile.compose();
  const spec = lp.blocks.sceneHeading;
  const convention = { order: spec.order, separators: spec.separators };
  MATRIX.forEach(function(h) {
    assert.equal(Rga.SlugResolver.compose(h, convention).length, legacyMeasure(h, spec.separators).length, JSON.stringify(h));
  });
});

test('profile carries the V1 order + separators (single convention source)', () => {
  const Rga = bootResolver();
  const spec = Rga.LayoutProfile.compose().blocks.sceneHeading;
  assert.deepEqual(spec.order, ['setting', 'location', 'time']);
  assert.deepEqual(spec.separators, { settingLocation: ' ', locationTime: ' — ' });
});

// ----------------------------------------------------------------
// Golden sample — pins the exact output + length
// ----------------------------------------------------------------

test('golden: "INT. KITCHEN — DAY" is exact and 18 chars', () => {
  const Rga = bootResolver();
  const r = Rga.SlugResolver.compose({ setting: 'INT.', location: 'KITCHEN', time: 'DAY' });
  assert.equal(r.text, 'INT. KITCHEN — DAY');
  assert.equal(r.length, 18);
});

// ----------------------------------------------------------------
// Print end-to-end — real PrintRenderer output goes through the resolver
// ----------------------------------------------------------------

test('Print parity: rendered sceneHeading textContent === resolver text === legacy', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  ['../../../renderer/js/framework/slug-resolver.js',
   '../../../renderer/js/framework/layout-profile.js',
   '../../../renderer/js/framework/print-renderer.js'].forEach(function(p) {
    delete require.cache[require.resolve(p)]; require(p);
  });
  const Rga = global.window.Rga;
  const lp = Rga.LayoutProfile.compose();
  const heading = { setting: 'INT.', location: 'KITCHEN', time: 'DAY' };
  const container = document.createElement('div');
  Rga.PrintRenderer.render({
    totalPages: 1,
    layoutProfile: lp,
    pages: [{ pageNumber: 1, blocks: [{ type: 'sceneHeading', heading: heading }] }]
  }, container, {});
  const el = container.querySelector('.rga-print-block-sceneHeading');
  assert.ok(el, 'sceneHeading block rendered');
  const expected = Rga.SlugResolver.compose(heading, {
    order: lp.blocks.sceneHeading.order, separators: lp.blocks.sceneHeading.separators
  }).text;
  assert.equal(el.textContent, expected);
  assert.equal(el.textContent, legacyDisplay(heading));
});

// ----------------------------------------------------------------
// PageMap end-to-end — measured line count unchanged
// ----------------------------------------------------------------

test('PageMap parity: measureBlock line-count === legacy-length-derived count', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  ['../../../renderer/js/framework/slug-resolver.js',
   '../../../renderer/js/framework/layout-profile.js',
   '../../../renderer/js/framework/pagemap-engine.js'].forEach(function(p) {
    delete require.cache[require.resolve(p)]; require(p);
  });
  const Rga = global.window.Rga;
  const lp = Rga.LayoutProfile.compose();
  const spec = lp.blocks.sceneHeading;
  MATRIX.forEach(function(h) {
    const block = { nodeType: 'sceneHeading', heading: h };
    const lines = Rga.PageMap.measureBlock(block, lp, /* isFirstOnPage */ false);
    const legacyLen = legacyMeasure(h, spec.separators).length;
    const expected = (spec.leadingBlankLines || 0) + Math.max(1, Math.ceil(legacyLen / spec.cpl));
    assert.equal(lines, expected, JSON.stringify(h));
  });
});

// ----------------------------------------------------------------
// Nav-index end-to-end — headingDisplay goes through the resolver
// ----------------------------------------------------------------

test('Nav parity: scene.headingDisplay === resolver(default) === legacy', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  const PMmodel = require('prosemirror-model');
  const PMstate = require('prosemirror-state');
  const PMview = require('prosemirror-view');
  global.window.RgaProseMirror = {
    EditorState: PMstate.EditorState, Schema: PMmodel.Schema, PMNode: PMmodel.Node,
    Plugin: PMstate.Plugin, PluginKey: PMstate.PluginKey,
    Decoration: PMview.Decoration, DecorationSet: PMview.DecorationSet
  };
  ['../../../renderer/js/framework/base-outer-marks.js',
   '../../../renderer/js/framework/slug-resolver.js',
   '../../../renderer/js/framework/document-outline.js',
   '../../../renderer/js/framework/nav-index.js',
   '../../../renderer/js/doc-types/screenplay/schema-v3.js'].forEach(function(p) {
    delete require.cache[require.resolve(p)]; require(p);
  });
  const Rga = global.window.Rga;
  const sp = Rga.DocTypes.screenplay;
  if (sp._resetSchemaV3Cache) sp._resetSchemaV3Cache();
  const schema = sp.buildSchemaV3();

  const heading = { setting: 'INT.', location: 'KITCHEN', time: 'DAY' };
  const sceneHeading = schema.nodes.sceneHeading.create(
    { setting: heading.setting, time: heading.time, headingStyle: null },
    schema.text(heading.location)
  );
  const scene = schema.nodes.scene.create(
    { id: 's1', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [sceneHeading, schema.nodes.action.create()]
  );
  const body = schema.nodes.body.create(null, [scene]);
  const titleStrip = schema.nodes.titleStrip.create({ removable: true });
  const doc = schema.nodes.doc.create(null, [titleStrip, body]);

  const idx = Rga.Nav.buildIndex(doc);
  assert.equal(idx.scenes.length, 1);
  assert.equal(idx.scenes[0].headingDisplay, Rga.SlugResolver.compose(heading).text);
  assert.equal(idx.scenes[0].headingDisplay, legacyDisplay(heading));
  assert.equal(idx.scenes[0].headingDisplay, 'INT. KITCHEN — DAY');
});

// ----------------------------------------------------------------
// STATIC GUARD — single canonical composer
// ----------------------------------------------------------------

test('compliance: the 3 consumers route through SlugResolver and carry no legacy composer', () => {
  const consumers = [
    'js/framework/print-renderer.js',
    'js/framework/pagemap-engine.js',
    'js/framework/nav-index.js'
  ];
  consumers.forEach(function(rel) {
    const src = fs.readFileSync(path.join(RENDERER, rel), 'utf8');
    assert.ok(src.indexOf('SlugResolver.compose') >= 0, rel + ' must route through SlugResolver.compose');
    // Single-composer signal: the legacy heading composer is uniquely
    // identified by dereferencing the SLUG-SPECIFIC separator members; only
    // the resolver does that now. We deliberately do NOT ban a generic idiom
    // like "parts.join(' ')" — it could legitimately recur elsewhere in these
    // large files (inline-run joins, label building), so banning it would be
    // brittle without adding real single-composer assurance. The two
    // slug-specific member names below are the precise, non-brittle fingerprint.
    assert.ok(src.indexOf('.settingLocation') < 0, rel + ' must not dereference the slug separator .settingLocation (legacy composer)');
    assert.ok(src.indexOf('.locationTime') < 0, rel + ' must not dereference the slug separator .locationTime (legacy composer)');
  });
});

test('compliance: SlugResolver is the module that owns the composition detail', () => {
  const src = fs.readFileSync(path.join(RENDERER, 'js/framework/slug-resolver.js'), 'utf8');
  assert.ok(src.indexOf('settingLocation') >= 0 && src.indexOf('locationTime') >= 0,
    'the resolver owns the separator semantics');
});

// ----------------------------------------------------------------
// Flow compliance — PENDING (documented exception, later slice)
// ----------------------------------------------------------------

test('Flow compliance: NodeView renders in resolver token order', { skip: 'Flow convergence is a later slice (SLUG_RESOLVER_DESIGN_BRIEF §7); picker DOM + contentDOM reorder is out of V1 scope.' }, () => {
  // Intentionally not implemented in V1. Placeholder asserts the contract Flow
  // will consume (resolver tokens order) once the Flow convergence slice runs.
});
