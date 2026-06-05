// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 9 — screenplay's selectSchema hook + full deserialize pipeline.
// v3 is the only supported path; v1.x / v2.x files load through the
// migration chain transparently.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function bootScreenplay() {
  // Fresh window + Rga; load registry, marks, schema-v3, then screenplay
  // doc-type config (which registers itself).
  global.window = {};
  global.window.RgaProseMirror = {
    Schema:       require('prosemirror-model').Schema,
    PMNode:       require('prosemirror-model').Node,
    Fragment:     require('prosemirror-model').Fragment
  };
  const paths = [
    '../../../../renderer/js/constants.js',
    '../../../../renderer/js/framework/doc-type-registry.js',
    '../../../../renderer/js/framework/base-outer-marks.js',
    '../../../../renderer/js/doc-types/screenplay/schema-v3.js',
    '../../../../renderer/js/doc-types/screenplay/migrations/v1-to-v2.js',
    '../../../../renderer/js/doc-types/screenplay/migrations/v2-to-v3.js',
    '../../../../renderer/js/doc-types/screenplay/migrations/index.js',
    '../../../../renderer/js/doc-types/screenplay/index.js'
  ];
  paths.forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  return global.window.Rga;
}

// ----------------------------------------------------------------
// selectSchema — v3 only
// ----------------------------------------------------------------

test('selectSchema returns the v3 schema for any screenplay doc', () => {
  const Rga = bootScreenplay();
  const schema = Rga.DocTypes.selectSchema({
    document_type: 'screenplay',
    metadata: { title: 'any v2-vintage doc' }
  });
  assert.ok(schema);
  assert.ok(schema.nodes.scene, 'v3 schema has `scene` node');
  assert.ok(schema.nodes.sceneHeading);
  assert.equal(schema.nodes.sceneFrame, undefined, 'v3 schema has no sceneFrame atom');
});

test('selectSchema is cached — repeat calls return the same Schema instance', () => {
  const Rga = bootScreenplay();
  const a = Rga.DocTypes.selectSchema({ document_type: 'screenplay' });
  const b = Rga.DocTypes.selectSchema({ document_type: 'screenplay' });
  assert.equal(a, b);
});

// ----------------------------------------------------------------
// Hand-authored v3 fixture loads via deserialize → v3 PM Node
// ----------------------------------------------------------------

test('hand-authored v3 fixture loads via deserialize', () => {
  const Rga = bootScreenplay();
  delete require.cache[require.resolve('../../../../renderer/js/doc.js')];
  require('../../../../renderer/js/doc.js');

  const fixturePath = path.join(__dirname, '..', '..', '..', 'fixtures', 'v3-sample-hand-authored.rga');
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const doc = Rga.Doc.deserialize(raw, fixturePath);

  assert.equal(doc.documentType, 'screenplay');
  assert.equal(doc.rgaVersion, '5.0');   // v3 fixture upgraded to latest on load (S0 v4 + Print Contract v5)
  assert.equal(doc.metadata.title, 'v3 Hand-Authored Sample');
  assert.equal(doc.metadata.screenplayProfile.language, 'en');

  assert.ok(doc.body, 'body PM Node should be present');
  assert.equal(doc.body.type.name, 'doc');
  let foundScene = null;
  let foundSceneFrame = null;
  doc.body.descendants(function(node) {
    if (node.type.name === 'scene')      foundScene = node;
    if (node.type.name === 'sceneFrame') foundSceneFrame = node;
  });
  assert.ok(foundScene, 'v3 doc has a `scene` node');
  assert.equal(foundSceneFrame, null, 'no `sceneFrame` atoms in v3');

  assert.equal(foundScene.attrs.id, 'scene-v3-001');
  assert.equal(foundScene.attrs.notes, 'Hand-authored scene to validate the v3 schema load path.');

  assert.equal(foundScene.firstChild.type.name, 'sceneHeading');
  assert.equal(foundScene.firstChild.attrs.setting, 'INT.');
  assert.equal(foundScene.firstChild.attrs.time, 'DAY');
  assert.equal(foundScene.firstChild.firstChild.text, 'TEST STAGE');

  assert.equal(foundScene.lastChild.type.name, 'transition');
  assert.equal(foundScene.lastChild.attrs.presetType, 'CUT');

  let foundTagMark = false;
  foundScene.descendants(function(n) {
    if (n.isText && n.marks.some(function(m) { return m.type.name === 'tag'; })) {
      foundTagMark = true;
    }
  });
  assert.equal(foundTagMark, true, 'character cue carries a tag mark on the text');
});

// ----------------------------------------------------------------
// v2 fixture loads through the migration chain → v3
// ----------------------------------------------------------------

test('v2 fixture loads through Migrations chain into the v3 schema', () => {
  const Rga = bootScreenplay();
  delete require.cache[require.resolve('../../../../renderer/js/doc.js')];
  require('../../../../renderer/js/doc.js');

  const fixturePath = path.join(__dirname, '..', '..', '..', 'fixtures', 'sample-the-last-light.rga');
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const doc = Rga.Doc.deserialize(raw, fixturePath);

  // After migration the file is v5 (v2 → v3 → v4 → v5 chain; S0 adds aliases,
  // Print Contract V1 adds the contract stamp).
  assert.equal(doc.rgaVersion, '5.0');
  assert.equal(doc.metadata.screenplayProfile.language, 'en');
  assert.equal(doc.metadata.screenplayProfile.direction, 'ltr');
  assert.equal(doc.metadata.language, undefined, 'flat language replaced by screenplayProfile');

  // Body is v3 PM Node — scene structural nodes, no sceneFrame atoms.
  let sceneCount = 0;
  let sceneFrameCount = 0;
  doc.body.descendants(function(n) {
    if (n.type.name === 'scene')      sceneCount += 1;
    if (n.type.name === 'sceneFrame') sceneFrameCount += 1;
  });
  assert.equal(sceneCount, 5, '5 scenes after migration');
  assert.equal(sceneFrameCount, 0, 'no v2 sceneFrame atoms after migration');

  // All character-tag marks survived end-to-end.
  let tagMarkCount = 0;
  doc.body.descendants(function(n) {
    if (n.isText) tagMarkCount += n.marks.filter(function(m) { return m.type.name === 'tag'; }).length;
  });
  assert.equal(tagMarkCount, 6, '6 character-tag marks preserved through migration + load');

  // Per-scene structural assertions.
  let scenesSeen = [];
  doc.body.descendants(function(n) {
    if (n.type.name === 'scene') scenesSeen.push(n);
  });
  scenesSeen.forEach(function(scene) {
    assert.equal(scene.firstChild.type.name, 'sceneHeading');
    assert.equal(scene.lastChild.type.name, 'transition');
    assert.ok(scene.attrs.id, 'scene has id');
    assert.deepEqual(scene.attrs.metadata, { linkedScenes: [], references: [], production: {} });
  });
});

// ----------------------------------------------------------------
// Deserialize returns the canonical Doc shape regardless of input version
// ----------------------------------------------------------------

test('deserialize returns the canonical Doc shape (all fields populated)', () => {
  const Rga = bootScreenplay();
  delete require.cache[require.resolve('../../../../renderer/js/doc.js')];
  require('../../../../renderer/js/doc.js');

  const fixturePath = path.join(__dirname, '..', '..', '..', 'fixtures', 'v3-sample-hand-authored.rga');
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const doc = Rga.Doc.deserialize(raw, fixturePath);

  ['docId', 'handle', 'displayName', 'origin', 'dirty', 'lastSavedAt',
   'rgaVersion', 'documentType', 'metadata', 'settings', 'tagRegistry',
   'flagLog', 'exportSettings', 'runtime', 'body'].forEach(function(field) {
    assert.notEqual(doc[field], undefined, 'Doc missing field: ' + field);
  });
  assert.equal(doc.documentType, 'screenplay');
  assert.equal(typeof doc.body.type.name, 'string');
});
