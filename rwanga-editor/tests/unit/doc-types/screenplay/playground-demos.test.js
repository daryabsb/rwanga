// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Playground Script Modernization — the modern v4 demo set must always load
// through the REAL deserialize pipeline (migrate → v3 schema → nodeFromJSON) and
// the Semantic Entity demo must resolve its aliases. This guards the demos as
// living, loadable reference documents — not stale prose.
// Audit: docs/Filmustageation/PLAYGROUND_SCRIPT_MODERNIZATION_AUDIT.md
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DEMO_DIR = path.resolve(__dirname, '..', '..', '..', 'fixtures', 'playground');

function boot() {
  global.window = {};
  global.document = { addEventListener: function() {} };  // tags.js load-time listener
  global.window.RgaProseMirror = {
    Schema:   require('prosemirror-model').Schema,
    PMNode:   require('prosemirror-model').Node,
    Fragment: require('prosemirror-model').Fragment
  };
  const paths = [
    '../../../../renderer/js/constants.js',
    '../../../../renderer/js/framework/doc-type-registry.js',
    '../../../../renderer/js/framework/base-outer-marks.js',
    '../../../../renderer/js/doc-types/screenplay/schema-v3.js',
    '../../../../renderer/js/doc-types/screenplay/migrations/v1-to-v2.js',
    '../../../../renderer/js/doc-types/screenplay/migrations/v2-to-v3.js',
    '../../../../renderer/js/doc-types/screenplay/migrations/v3-to-v4.js',
    '../../../../renderer/js/doc-types/screenplay/migrations/index.js',
    '../../../../renderer/js/doc-types/screenplay/index.js',
    '../../../../renderer/js/doc.js',
    '../../../../renderer/js/doc-types/screenplay/plugins/tags.js',
    '../../../../renderer/js/doc-types/screenplay/plugins/alias-marker.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  return global.window.Rga;
}

function loadDemo(Rga, name) {
  const raw = fs.readFileSync(path.join(DEMO_DIR, name), 'utf8');
  return Rga.Doc.deserialize(raw, path.join(DEMO_DIR, name));
}

function sceneCount(doc) {
  let n = 0;
  doc.body.descendants(function(node) { if (node.type.name === 'scene') n += 1; });
  return n;
}

// ----------------------------------------------------------------
// Every demo loads through the real pipeline and lands at the latest
// version (v5 — Print Contract V1 migrates v4 demos forward on load).
// ----------------------------------------------------------------
['demo-writer.rga', 'demo-semantic-entities.rga', 'demo-rtl.rga'].forEach(function(name) {
  test('playground demo loads + migrates to v5: ' + name, () => {
    const Rga = boot();
    const doc = loadDemo(Rga, name);
    assert.equal(doc.rgaVersion, '5.0', name + ' loads at v5');
    assert.ok(doc.body, name + ' has a PM body');
    assert.ok(sceneCount(doc) >= 1, name + ' has at least one scene');
  });
});

// ----------------------------------------------------------------
// Writer demo — multiple entity TYPES, a flag, scene notes.
// ----------------------------------------------------------------
test('Writer demo exercises multiple entity types + notes + a flag', () => {
  const Rga = boot();
  const doc = loadDemo(Rga, 'demo-writer.rga');
  const reg = doc.tagRegistry;
  assert.ok(reg.characters.length >= 2, 'two or more characters');
  assert.ok(reg.props.length >= 1 || reg.locations.length >= 1, 'at least one prop or location');
  assert.ok((doc.flagLog || []).length >= 1, 'at least one revision flag logged');
  let noted = false;
  doc.body.descendants(function(node) {
    if (node.type.name === 'scene' && node.attrs.notes) noted = true;
  });
  assert.ok(noted, 'at least one scene carries a note');
});

// ----------------------------------------------------------------
// Semantic Entity demo — the headline: one identity, many names.
// ----------------------------------------------------------------
test('Semantic Entity demo: Nali carries aliases and they resolve to one id', () => {
  const Rga = boot();
  const doc = loadDemo(Rga, 'demo-semantic-entities.rga');
  const nali = doc.tagRegistry.characters.find(function(e) { return e.id === 'ent-nali'; });
  assert.ok(nali, 'Nali entity present');
  assert.deepEqual(nali.aliases.slice().sort(), ['The Poet', 'The Teacher']);

  // The resolver routes every alias surface to the ONE canonical id.
  assert.equal(Rga.Tags.findOrCreateEntity(doc, 'character', 'The Teacher'), 'ent-nali');
  assert.equal(Rga.Tags.findOrCreateEntity(doc, 'character', 'the poet'),    'ent-nali');
  assert.equal(Rga.Tags.findOrCreateEntity(doc, 'character', 'Nali'),        'ent-nali');

  // The derived marker classifies alias surfaces (dotted) vs canonical (solid).
  assert.equal(Rga.AliasMarker.isAliasSurface(doc, 'character', 'ent-nali', 'The Teacher'), true);
  assert.equal(Rga.AliasMarker.isAliasSurface(doc, 'character', 'ent-nali', 'Nali'),        false);

  // A second aliased entity proves it is not a one-off.
  const baban = doc.tagRegistry.characters.find(function(e) { return e.id === 'ent-baban'; });
  assert.ok(baban && baban.aliases.indexOf('The Butcher') !== -1, 'Baban has an alias too');
});

test('Semantic Entity demo: alias mentions actually appear in the body (repeated references)', () => {
  const Rga = boot();
  const doc = loadDemo(Rga, 'demo-semantic-entities.rga');
  let naliMentions = 0;
  doc.body.descendants(function(node) {
    if (!node.isText || !Array.isArray(node.marks)) return;
    node.marks.forEach(function(m) {
      if (m.type.name === 'tag' && m.attrs.entityId === 'ent-nali') naliMentions += 1;
    });
  });
  assert.ok(naliMentions >= 3, 'Nali is referenced under several surface forms (>=3 mentions)');
});

// ----------------------------------------------------------------
// RTL demo — right-to-left screenplay profile.
// ----------------------------------------------------------------
test('RTL demo declares an rtl screenplay profile and loads', () => {
  const Rga = boot();
  const doc = loadDemo(Rga, 'demo-rtl.rga');
  assert.equal(doc.metadata.screenplayProfile.direction, 'rtl');
  assert.ok(sceneCount(doc) >= 1);
});
