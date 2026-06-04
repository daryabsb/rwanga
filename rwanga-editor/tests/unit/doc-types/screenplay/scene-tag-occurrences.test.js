// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Scene Navigator Tags v1.1 — Rga.SceneTagOccurrences derivation tests.
//
// The scene-subtree occurrence reader behind the navigator's hybrid model.
// Everything under test is REAL: real base-outer-marks (the `tag` mark),
// real v3 schema, real prosemirror doc + positions. This is where the
// position math, snippet wording, count, scene-isolation and
// duplicate-separation contracts are proven.
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
    '../../../../renderer/js/doc-types/screenplay/plugins/scene-tag-occurrences.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  const sp = Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  const schema = sp.buildSchemaV3();
  return { Rga: Rga, schema: schema };
}

// scene 1 action: "<NALI:a> stands by the PHOTOGRAPH:p. <NALI:a> smiles."
//   NALI (ent-a) tagged twice, PHOTOGRAPH (ent-p, prop) once.
// scene 2 action: "<NALI:a> sees <NALI:b>."  (a once, b once — dup name)
function buildDoc(schema) {
  const tag = schema.marks.tag;
  const ch = (text, id) => schema.text(text, [tag.create({ tagType: 'character', entityId: id })]);
  const pr = (text, id) => schema.text(text, [tag.create({ tagType: 'prop', entityId: id })]);
  const heading = () => schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null });
  const transition = () => schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'));

  const action1 = schema.nodes.action.create(null, [
    ch('NALI', 'ent-a'), schema.text(' stands by the '), pr('PHOTOGRAPH', 'ent-p'),
    schema.text('. '), ch('NALI', 'ent-a'), schema.text(' smiles.')
  ]);
  const scene1 = schema.nodes.scene.create(
    { id: 'sc-1', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [heading(), action1, transition()]);

  const action2 = schema.nodes.action.create(null, [
    ch('NALI', 'ent-a'), schema.text(' sees '), ch('NALI', 'ent-b'), schema.text('.')
  ]);
  const scene2 = schema.nodes.scene.create(
    { id: 'sc-2', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [heading(), action2, transition()]);

  const body = schema.nodes.body.create(null, [scene1, scene2]);
  const title = schema.nodes.titleStrip.create({ removable: true });
  return schema.nodes.doc.create(null, [title, body]);
}

// Find a scene node's PM position by attrs.id.
function scenePos(doc, id) {
  let found = null;
  doc.descendants(function(node, pos) {
    if (found != null) return false;
    if (node.type.name === 'scene' && node.attrs.id === id) { found = pos; return false; }
    return true;
  });
  return found;
}

// A minimal index: name + color per entity (the mark carries neither).
function idxFixture() {
  return { tags: {
    character: [
      { nodeId: 'ent-a', name: 'NALI',  color: '#c2185b' },
      { nodeId: 'ent-b', name: 'NALI',  color: '#7b1fa2' }
    ],
    prop: [
      { nodeId: 'ent-p', name: 'PHOTOGRAPH', color: '#388e3c' }
    ]
  } };
}

test('SceneTagOccurrences: groups scene-local tags by category, with per-scene counts', () => {
  const { Rga, schema } = boot();
  const doc = buildDoc(schema);
  const groups = Rga.SceneTagOccurrences.forScene(doc, scenePos(doc, 'sc-1'), idxFixture());
  const labels = groups.map((g) => g.label);
  assert.deepEqual(labels, ['Characters', 'Props'], 'canonical category order, only non-empty');
  const chars = groups[0].entities;
  assert.equal(chars.length, 1, 'one character entity tagged in scene 1');
  assert.equal(chars[0].name, 'NALI');
  assert.equal(chars[0].count, 2, 'NALI is tagged twice in this scene');
  const props = groups[1].entities;
  assert.equal(props[0].name, 'PHOTOGRAPH');
  assert.equal(props[0].count, 1);
});

test('SceneTagOccurrences: each occurrence carries the original screenplay wording + a snippet', () => {
  const { Rga, schema } = boot();
  const doc = buildDoc(schema);
  const groups = Rga.SceneTagOccurrences.forScene(doc, scenePos(doc, 'sc-1'), idxFixture());
  const nali = groups[0].entities[0];
  assert.equal(nali.occurrences.length, 2);
  // Original tagged text preserved verbatim.
  assert.equal(nali.occurrences[0].text, 'NALI');
  // The snippet shows the surrounding screenplay wording around the tag.
  assert.equal(nali.occurrences[0].snippet.match, 'NALI');
  assert.match(nali.occurrences[0].snippet.after, /stands by the/,
    'snippet carries the words that follow the tag');
  assert.match(nali.occurrences[1].snippet.before, /smiles|PHOTOGRAPH|\./,
    'the second occurrence snippet carries its own surrounding wording');
});

test('SceneTagOccurrences: occurrence positions resolve to the tagged text in the doc', () => {
  const { Rga, schema } = boot();
  const doc = buildDoc(schema);
  const groups = Rga.SceneTagOccurrences.forScene(doc, scenePos(doc, 'sc-1'), idxFixture());
  const occ = groups[0].entities[0].occurrences[0];
  // The from/to must bound exactly the tagged run in the live document.
  assert.equal(doc.textBetween(occ.from, occ.to), 'NALI', 'positions bound the tagged run');
});

test('SceneTagOccurrences: duplicate same-named entities stay SEPARATE (by entityId)', () => {
  const { Rga, schema } = boot();
  const doc = buildDoc(schema);
  // Scene 2 has NALI(ent-a) and NALI(ent-b) — same name, different ids.
  const groups = Rga.SceneTagOccurrences.forScene(doc, scenePos(doc, 'sc-2'), idxFixture());
  const chars = groups[0].entities;
  assert.equal(chars.length, 2, 'two separate NALI entities — never collapsed');
  const ids = chars.map((e) => e.entityId).sort();
  assert.deepEqual(ids, ['ent-a', 'ent-b']);
  assert.ok(chars.every((e) => e.count === 1), 'each NALI tagged once in scene 2');
});

test('SceneTagOccurrences: only entities tagged IN this scene appear (no global leakage)', () => {
  const { Rga, schema } = boot();
  const doc = buildDoc(schema);
  // ent-b (the second NALI) is tagged ONLY in scene 2 — it must not show
  // up in scene 1's occurrences even though it is a live registry entity.
  const s1 = Rga.SceneTagOccurrences.forScene(doc, scenePos(doc, 'sc-1'), idxFixture());
  const s1ids = s1[0].entities.map((e) => e.entityId);
  assert.ok(s1ids.indexOf('ent-b') < 0, 'ent-b (tagged only in scene 2) is absent from scene 1');
  // And the prop ent-p is absent from scene 2 (tagged only in scene 1).
  const s2 = Rga.SceneTagOccurrences.forScene(doc, scenePos(doc, 'sc-2'), idxFixture());
  assert.equal(s2.length, 1, 'scene 2 has only the Characters category');
  assert.equal(s2[0].label, 'Characters');
});

test('SceneTagOccurrences: a scene with no tagged marks returns []', () => {
  const { Rga, schema } = boot();
  // A bare scene, no tags.
  const heading = schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null });
  const action = schema.nodes.action.create(null, schema.text('Nothing tagged here at all.'));
  const scene = schema.nodes.scene.create(
    { id: 'sc-x', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [heading, action]);
  const body = schema.nodes.body.create(null, [scene]);
  const title = schema.nodes.titleStrip.create({ removable: true });
  const doc = schema.nodes.doc.create(null, [title, body]);
  assert.deepEqual(Rga.SceneTagOccurrences.forScene(doc, scenePos(doc, 'sc-x'), idxFixture()), []);
});

test('SceneTagOccurrences: degrades safely on a non-walkable doc / bad position', () => {
  const { Rga } = boot();
  assert.deepEqual(Rga.SceneTagOccurrences.forScene(null, 0, {}), []);
  assert.deepEqual(Rga.SceneTagOccurrences.forScene({}, 0, {}), []);
  assert.deepEqual(Rga.SceneTagOccurrences.forScene({ nodeAt: function() { return null; }, nodesBetween: function() {} }, 'x', {}), []);
});
