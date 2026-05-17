// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 6 — ScreenplayNormalizer unit tests.
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
  global.window.RgaProseMirror = { Schema: PMmodel.Schema, PMNode: PMmodel.Node };

  const paths = [
    '../../../renderer/js/framework/base-outer-marks.js',
    '../../../renderer/js/framework/screenplay-normalizer.js',
    '../../../renderer/js/doc-types/screenplay/schema-v3.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  const sp = global.window.Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  return { Normalizer: global.window.Rga.Normalizer, schema: sp.buildSchemaV3() };
}

function scene(schema, id, opts) {
  opts = opts || {};
  // Use `in` so callers can pass explicit empty strings (testing the
  // "no setting / no time" composition path).
  const setting = ('setting' in opts) ? opts.setting : 'INT.';
  const time    = ('time'    in opts) ? opts.time    : 'DAY';
  const heading = schema.nodes.sceneHeading.create(
    { setting: setting, time: time, headingStyle: null },
    opts.location ? schema.text(opts.location) : null
  );
  const action = schema.nodes.action.create(null, schema.text(opts.action || 'Some action.'));
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

test('normalizer emits one block per body block; skips scene/body/doc wrappers', () => {
  const { Normalizer, schema } = boot();
  const out = Normalizer.normalize(doc(schema, [scene(schema, 'a', { location: 'A' })]));
  // sceneHeading + action + transition = 3 blocks.
  assert.equal(out.length, 3);
  assert.deepEqual(out.map(b => b.nodeType), ['sceneHeading', 'action', 'transition']);
});

test('sceneHeading is STRUCTURED (heading.setting/location/time), no composed display text', () => {
  const { Normalizer, schema } = boot();
  const out = Normalizer.normalize(doc(schema, [scene(schema, 'a', { setting: 'EXT.', time: 'NIGHT', location: 'OLD HOUSE' })]));
  assert.equal(out[0].nodeType, 'sceneHeading');
  assert.deepEqual(out[0].heading, { setting: 'EXT.', location: 'OLD HOUSE', time: 'NIGHT' });
  // No presentation-formatted `text` on sceneHeading — renderers compose
  // their own display string from the structured parts.
  assert.equal(out[0].text, undefined);
});

test('sceneHeading with missing parts preserves the empty parts; no fallback composition', () => {
  const { Normalizer, schema } = boot();
  const out = Normalizer.normalize(doc(schema, [scene(schema, 'a', { setting: '', time: '', location: 'JUST LOCATION' })]));
  assert.deepEqual(out[0].heading, { setting: '', location: 'JUST LOCATION', time: '' });
  assert.equal(out[0].text, undefined);
});

test('non-heading blocks still carry .text (action/dialogue/etc — those have no structured fields)', () => {
  const { Normalizer, schema } = boot();
  const out = Normalizer.normalize(doc(schema, [scene(schema, 'a', { action: 'Alex walks in.' })]));
  const action = out.find(b => b.nodeType === 'action');
  assert.equal(action.text, 'Alex walks in.');
  assert.equal(action.heading, undefined);
});

test('keep-with-next is true for sceneHeading + character; false for everything else', () => {
  const { Normalizer, schema } = boot();
  const sceneNode = schema.nodes.scene.create(
    { id: 'sc', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [
      schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
      schema.nodes.action.create(null, schema.text('Walks in.')),
      schema.nodes.character.create(null, schema.text('ALEX')),
      schema.nodes.parenthetical.create(null, schema.text('(softly)')),
      schema.nodes.dialogue.create(null, schema.text('Hi.')),
      schema.nodes.shot.create(null, schema.text('CLOSE')),
      schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'))
    ]
  );
  const out = Normalizer.normalize(doc(schema, [sceneNode]));
  const byType = Object.fromEntries(out.map(b => [b.nodeType, b]));
  assert.equal(byType.sceneHeading.keepWithNext, true);
  assert.equal(byType.character.keepWithNext, true);
  assert.equal(byType.action.keepWithNext, false);
  assert.equal(byType.parenthetical.keepWithNext, false);
  assert.equal(byType.dialogue.keepWithNext, false);
  assert.equal(byType.shot.keepWithNext, false);
  assert.equal(byType.transition.keepWithNext, false);
});

test('all blocks are splittable=false in V1 (per directive rule 6)', () => {
  const { Normalizer, schema } = boot();
  const out = Normalizer.normalize(doc(schema, [scene(schema, 'a')]));
  out.forEach(function(b) { assert.equal(b.splittable, false); });
});

test('pmFrom + pmTo capture the block boundaries; doc.nodeAt(pmFrom) returns the original node', () => {
  const { Normalizer, schema } = boot();
  const d = doc(schema, [scene(schema, 'a', { location: 'ROOM', action: 'Action text.' })]);
  const out = Normalizer.normalize(d);
  out.forEach(function(b) {
    const node = d.nodeAt(b.pmFrom);
    assert.ok(node, 'doc.nodeAt(pmFrom) resolves');
    assert.equal(node.type.name, b.nodeType);
    assert.equal(b.pmTo, b.pmFrom + node.nodeSize);
  });
});

test('sceneNodeId + sceneNumber + blockIndexInScene set for in-scene blocks; null for treatment blocks', () => {
  const { Normalizer, schema } = boot();
  // Treatment paragraph then a scene.
  const treatment = schema.nodes.paragraph.create(null, schema.text('Treatment text.'));
  const sc = scene(schema, 'sc-1', { location: 'A' });
  const body = schema.nodes.body.create(null, [treatment, sc]);
  const title = schema.nodes.titleStrip.create({ removable: true });
  const d = schema.nodes.doc.create(null, [title, body]);
  const out = Normalizer.normalize(d);
  const treat = out.find(b => b.nodeType === 'paragraph');
  assert.equal(treat.sceneNodeId, null);
  assert.equal(treat.sceneNumber, null);
  assert.equal(treat.blockIndexInScene, null);
  const heading = out.find(b => b.nodeType === 'sceneHeading');
  assert.equal(heading.sceneNodeId, 'sc-1');
  assert.equal(heading.sceneNumber, 1);
  assert.equal(heading.blockIndexInScene, 0);
  const action = out.find(b => b.nodeType === 'action');
  assert.equal(action.blockIndexInScene, 1);
});

test('multi-scene doc numbers scenes sequentially', () => {
  const { Normalizer, schema } = boot();
  const out = Normalizer.normalize(doc(schema, [
    scene(schema, 'a', { location: 'A' }),
    scene(schema, 'b', { location: 'B' }),
    scene(schema, 'c', { location: 'C' })
  ]));
  const headings = out.filter(b => b.nodeType === 'sceneHeading');
  assert.deepEqual(headings.map(h => h.sceneNumber), [1, 2, 3]);
  assert.deepEqual(headings.map(h => h.sceneNodeId), ['a', 'b', 'c']);
});

test('empty doc returns empty array', () => {
  const { Normalizer, schema } = boot();
  const d = schema.nodes.doc.create(null, [
    schema.nodes.titleStrip.create({ removable: true }),
    schema.nodes.body.create(null, [schema.nodes.paragraph.create()])
  ]);
  const out = Normalizer.normalize(d);
  // Just the one empty paragraph in body.
  assert.equal(out.length, 1);
  assert.equal(out[0].nodeType, 'paragraph');
});

test('null/undefined doc returns empty array (defensive)', () => {
  const { Normalizer } = boot();
  assert.deepEqual(Normalizer.normalize(null), []);
  assert.deepEqual(Normalizer.normalize(undefined), []);
});
