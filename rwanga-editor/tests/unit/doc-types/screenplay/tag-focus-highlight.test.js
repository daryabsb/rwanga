// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Tags Panel V1.3 — Rga.TagFocusHighlight plugin unit tests.
//
// The decoration engine behind "click an entity → its tagged occurrences
// light up in the editor". Mirrors the SearchHighlight plugin contract:
// transient, content-safe (decoration only, never a document mutation),
// meta-driven, composes additively. Differences: N ranges (not one),
// matched by entityId, distinct class (.rga-tag-focus-active).
//
// Everything under test is REAL: real base-outer-marks (the `tag` mark),
// real v3 schema, real prosemirror-state/view, real plugin.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
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
    TextSelection: PMstate.TextSelection,
    Decoration:    PMview.Decoration,
    DecorationSet: PMview.DecorationSet
  };

  [
    '../../../../renderer/js/framework/base-outer-marks.js',
    '../../../../renderer/js/doc-types/screenplay/schema-v3.js',
    '../../../../renderer/js/doc-types/screenplay/plugins/tag-focus-highlight.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  const sp = Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  const schema = sp.buildSchemaV3();
  return { Rga: Rga, schema: schema, PM: global.window.RgaProseMirror, PMstate: PMstate };
}

// Build a doc with three tagged text runs:
//   scene 1 action: "<NALI:A> meets <BABAN:C>."
//   scene 2 action: "<NALI:A> sees <NALI:B>."   (A appears twice, B once)
// entityId A = 'ent-a', B = 'ent-b' (duplicate name NALI), C = 'ent-c' (BABAN).
function buildTaggedDoc(schema) {
  const tag = schema.marks.tag;
  const mk = (text, entityId) => schema.text(text, entityId ? [tag.create({ tagType: 'character', entityId: entityId })] : null);

  const heading = () => schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null });
  const transition = () => schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'));

  const action1 = schema.nodes.action.create(null, [ mk('NALI', 'ent-a'), schema.text(' meets '), mk('BABAN', 'ent-c'), schema.text('.') ]);
  const scene1 = schema.nodes.scene.create(
    { id: 'sc-1', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [heading(), action1, transition()]);

  const action2 = schema.nodes.action.create(null, [ mk('NALI', 'ent-a'), schema.text(' sees '), mk('NALI', 'ent-b'), schema.text('.') ]);
  const scene2 = schema.nodes.scene.create(
    { id: 'sc-2', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [heading(), action2, transition()]);

  const body = schema.nodes.body.create(null, [scene1, scene2]);
  const title = schema.nodes.titleStrip.create({ removable: true });
  return schema.nodes.doc.create(null, [title, body]);
}

function makeView(boot, doc) {
  const plugin = boot.Rga.TagFocusHighlight.buildPlugin();
  let state = boot.PMstate.EditorState.create({ schema: boot.schema, doc: doc, plugins: plugin ? [plugin] : [] });
  return {
    get state() { return state; },
    dispatch: function(tr) { state = state.apply(tr); }
  };
}

// Expected ranges of an entity's tag marks, computed independently of the
// module under test (ground truth for comparison).
function expectedRanges(doc, schema, entityId) {
  const out = [];
  doc.descendants(function(node, pos) {
    if (!node.isText) return;
    for (let i = 0; i < node.marks.length; i += 1) {
      const m = node.marks[i];
      if (m.type === schema.marks.tag && m.attrs.entityId === entityId) {
        out.push({ from: pos, to: pos + node.nodeSize });
      }
    }
  });
  return out;
}

// ================================================================
// API surface
// ================================================================

test('TagFocusHighlight: exposed with buildPlugin / setEntity / clear / rangesForEntity', () => {
  const b = boot();
  const H = b.Rga.TagFocusHighlight;
  assert.ok(H);
  assert.equal(typeof H.buildPlugin, 'function');
  assert.equal(typeof H.setEntity, 'function');
  assert.equal(typeof H.clear, 'function');
  assert.equal(typeof H.rangesForEntity, 'function');
});

// ================================================================
// rangesForEntity — pure walk
// ================================================================

test('TagFocusHighlight.rangesForEntity: returns every tag-mark range for the entityId', () => {
  const b = boot();
  const doc = buildTaggedDoc(b.schema);
  const ranges = b.Rga.TagFocusHighlight.rangesForEntity(doc, 'ent-a');
  assert.deepEqual(ranges, expectedRanges(doc, b.schema, 'ent-a'));
  assert.equal(ranges.length, 2, 'ent-a (NALI) is tagged twice');
});

test('TagFocusHighlight.rangesForEntity: zero occurrences → empty array, no throw', () => {
  const b = boot();
  const doc = buildTaggedDoc(b.schema);
  assert.deepEqual(b.Rga.TagFocusHighlight.rangesForEntity(doc, 'ent-untagged'), []);
});

// ================================================================
// 1. setEntity applies decorations to ALL of an entity's occurrences
// ================================================================

test('V1.3 #1: setEntity highlights every tagged occurrence for the entity', () => {
  const b = boot();
  const doc = buildTaggedDoc(b.schema);
  const view = makeView(b, doc);
  const count = b.Rga.TagFocusHighlight.setEntity(view, 'ent-a');
  assert.equal(count, 2, 'returns the number of ranges painted');
  const decos = b.Rga.TagFocusHighlight._decorations(view.state);
  assert.deepEqual(decos.sort((x, y) => x.from - y.from),
    expectedRanges(doc, b.schema, 'ent-a').sort((x, y) => x.from - y.from));
});

// ================================================================
// 2. Duplicate-entity isolation: ent-a's marks only, never ent-b's
// ================================================================

test('V1.3 #2: duplicate NALI — highlighting ent-a does NOT touch ent-b marks', () => {
  const b = boot();
  const doc = buildTaggedDoc(b.schema);
  const view = makeView(b, doc);
  b.Rga.TagFocusHighlight.setEntity(view, 'ent-a');
  const decos = b.Rga.TagFocusHighlight._decorations(view.state);
  const bRanges = expectedRanges(doc, b.schema, 'ent-b');
  // None of ent-a's highlighted ranges may coincide with ent-b's mark.
  const overlapsB = decos.some(function(d) {
    return bRanges.some(function(r) { return r.from === d.from && r.to === d.to; });
  });
  assert.equal(overlapsB, false, 'ent-b (the OTHER NALI) is not highlighted');
  assert.equal(decos.length, 2, 'only ent-a\'s two marks');
});

// ================================================================
// 3. setEntity replaces the previous entity's highlight
// ================================================================

test('V1.3 #3: selecting another entity REPLACES the highlight', () => {
  const b = boot();
  const doc = buildTaggedDoc(b.schema);
  const view = makeView(b, doc);
  b.Rga.TagFocusHighlight.setEntity(view, 'ent-a');
  b.Rga.TagFocusHighlight.setEntity(view, 'ent-c');   // BABAN
  const decos = b.Rga.TagFocusHighlight._decorations(view.state);
  assert.deepEqual(decos, expectedRanges(doc, b.schema, 'ent-c'));
  assert.equal(decos.length, 1, 'only ent-c now — ent-a highlight is gone');
});

// ================================================================
// 4. Zero-occurrence entity: no highlight, no crash
// ================================================================

test('V1.3 #4: zero-occurrence entity paints nothing and does not throw', () => {
  const b = boot();
  const doc = buildTaggedDoc(b.schema);
  const view = makeView(b, doc);
  const count = b.Rga.TagFocusHighlight.setEntity(view, 'ent-curated-untagged');
  assert.equal(count, 0);
  assert.equal(b.Rga.TagFocusHighlight._decorations(view.state).length, 0);
});

// ================================================================
// 6a. clear removes the highlight
// ================================================================

test('V1.3 #6: clear() removes all highlight decorations', () => {
  const b = boot();
  const doc = buildTaggedDoc(b.schema);
  const view = makeView(b, doc);
  b.Rga.TagFocusHighlight.setEntity(view, 'ent-a');
  assert.equal(b.Rga.TagFocusHighlight._decorations(view.state).length, 2);
  b.Rga.TagFocusHighlight.clear(view);
  assert.equal(b.Rga.TagFocusHighlight._decorations(view.state).length, 0);
});

// ================================================================
// 6b. Transient: a document edit drops the highlight (no drift)
// ================================================================

test('V1.3: highlight is transient — a document change clears it', () => {
  const b = boot();
  const doc = buildTaggedDoc(b.schema);
  const view = makeView(b, doc);
  b.Rga.TagFocusHighlight.setEntity(view, 'ent-a');
  assert.equal(b.Rga.TagFocusHighlight._decorations(view.state).length, 2);
  // Any content change drops it rather than letting it drift onto shifted text.
  view.dispatch(view.state.tr.insertText('x', 1));
  assert.equal(b.Rga.TagFocusHighlight._decorations(view.state).length, 0);
});

// ================================================================
// Highlight survives a selection-only change (the jump path)
// ================================================================

test('V1.3: highlight SURVIVES a selection-only transaction (jump does not clear it)', () => {
  const b = boot();
  const doc = buildTaggedDoc(b.schema);
  const view = makeView(b, doc);
  b.Rga.TagFocusHighlight.setEntity(view, 'ent-a');
  // A jump is a selection move with no doc change.
  const $pos = view.state.doc.resolve(2);
  view.dispatch(view.state.tr.setSelection(b.PMstate.TextSelection.near($pos)));
  assert.equal(b.Rga.TagFocusHighlight._decorations(view.state).length, 2,
    'selection change keeps the focus highlight');
});

// ================================================================
// Content safety: decorations never mutate the document
// ================================================================

test('V1.3 #6: setEntity does not change document content', () => {
  const b = boot();
  const doc = buildTaggedDoc(b.schema);
  const view = makeView(b, doc);
  const before = view.state.doc;
  b.Rga.TagFocusHighlight.setEntity(view, 'ent-a');
  assert.ok(before.eq(view.state.doc), 'document is byte-identical after highlighting');
});

// ================================================================
// Decoration class is the V1.3-distinct focus class (not the search class)
// ================================================================

test('V1.3: focus decorations use .rga-tag-focus-active (distinct from search-match)', () => {
  const b = boot();
  const doc = buildTaggedDoc(b.schema);
  const view = makeView(b, doc);
  b.Rga.TagFocusHighlight.setEntity(view, 'ent-a');
  const k = b.Rga.TagFocusHighlight._key();
  const set = k.getState(view.state);
  const specs = set.find().map(function(d) { return d.type && d.type.attrs ? d.type.attrs.class : null; });
  assert.ok(specs.every(function(c) { return c === 'rga-tag-focus-active'; }));
});
