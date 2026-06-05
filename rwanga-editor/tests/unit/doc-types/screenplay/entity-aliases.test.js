// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Semantic Entity Layer S0 — aliases as data + one resolver.
// Brief: docs/Filmustageation/SEMANTIC_ENTITY_LAYER_S0_IMPLEMENTATION_BRIEF.md §4,§5,§7
// Doctrine: docs/Filmustageation/SEMANTIC_ENTITY_LAYER_DOCTRINE_LOCK.md
//
// REAL doc.js registry + REAL plugins/tags.js findOrCreateEntity. No stubs on
// the path under test (findOrCreateEntity needs only doc + Rga.Doc helpers;
// RgaProseMirror is referenced only inside tagging functions, not here).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function boot() {
  global.window = { Rga: {} };
  // tags.js registers a load-time document.addEventListener('editor.tagApplied').
  // findOrCreateEntity itself never touches the DOM, so a no-op stub suffices.
  global.document = { addEventListener: function() {} };
  ['../../../../renderer/js/constants.js',
   '../../../../renderer/js/doc.js',
   '../../../../renderer/js/doc-types/screenplay/plugins/tags.js'
  ].forEach(function(f) {
    const p = require.resolve(f);
    delete require.cache[p];
    require(p);
  });
  return global.window.Rga;
}

// Push a raw entity straight into the registry — simulates file-loaded state
// (deserialize passes entries through by reference), so we control exact
// fields, including a deliberately MISSING aliases key.
function pushRaw(doc, key, entity) {
  if (!doc.tagRegistry[key]) doc.tagRegistry[key] = [];
  doc.tagRegistry[key].push(entity);
  return entity;
}

// ================================================================
// Resolver — findOrCreateEntity consults name AND aliases (§4)
// ================================================================

test('S0: resolver returns the entity id when text matches an ALIAS (no new entity)', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali', aliases: ['the teacher'] });
  const id = Rga.Tags.findOrCreateEntity(doc, 'character', 'The Teacher'); // case-insensitive
  assert.equal(id, 'nali');
  assert.equal(doc.tagRegistry.characters.length, 1); // nothing minted
});

test('S0: resolver still reuses by canonical NAME (regression guard)', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali', aliases: ['the teacher'] });
  const id = Rga.Tags.findOrCreateEntity(doc, 'character', 'nali');
  assert.equal(id, 'nali');
  assert.equal(doc.tagRegistry.characters.length, 1);
});

test('S0: resolver creates exactly one new entity on no match (unchanged path)', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali', aliases: ['the teacher'] });
  const id = Rga.Tags.findOrCreateEntity(doc, 'character', 'Baban');
  assert.notEqual(id, 'nali');
  assert.equal(doc.tagRegistry.characters.length, 2);
});

test('S0: resolver tolerates an entity with NO aliases field (resolves by name, no throw)', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'solo', name: 'Solo' }); // no aliases key
  const id = Rga.Tags.findOrCreateEntity(doc, 'character', 'Solo');
  assert.equal(id, 'solo');
  assert.equal(doc.tagRegistry.characters.length, 1);
});

test('S0: resolver is defensive on alias collision — never silently picks one (§3)', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  // Hand-built corruption: two LIVE entities claim the same alias. Uniqueness
  // is enforced at authoring time (not in S0); a hand-edited .rga must not be
  // able to make the resolver mis-resolve identity.
  pushRaw(doc, 'characters', { id: 'a', name: 'Aaa', aliases: ['shadow'] });
  pushRaw(doc, 'characters', { id: 'b', name: 'Bbb', aliases: ['shadow'] });
  const id = Rga.Tags.findOrCreateEntity(doc, 'character', 'shadow');
  assert.notEqual(id, 'a');
  assert.notEqual(id, 'b'); // did not silently pick either claimant
  assert.equal(doc.tagRegistry.characters.length, 3); // fell through to create
});

// ================================================================
// Merge fold — survivor keeps the UNION of aliases (§5)
// ================================================================

test('S0: foldEntityMetadata unions aliases (dedup, case-insensitive); loser name NOT promoted', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'surv', name: 'Nali',  aliases: ['the teacher', 'shared'] });
  pushRaw(doc, 'characters', { id: 'lose', name: 'NALI',  aliases: ['the tutor', 'SHARED'] });
  Rga.Doc.foldEntityMetadata(doc, 'character', 'surv', 'lose');
  const survivor = doc.tagRegistry.characters.find(function(e) { return e.id === 'surv'; });
  const lower = survivor.aliases.map(function(a) { return a.toLowerCase(); }).sort();
  assert.deepEqual(lower, ['shared', 'the teacher', 'the tutor']); // 'SHARED' deduped
  assert.equal(survivor.aliases.indexOf('NALI'), -1);              // loser name not added
});

test('S0: foldEntityMetadata tolerates missing aliases on either side', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'surv', name: 'Nali' });               // no aliases
  pushRaw(doc, 'characters', { id: 'lose', name: 'X', aliases: ['nick'] });
  Rga.Doc.foldEntityMetadata(doc, 'character', 'surv', 'lose');
  const survivor = doc.tagRegistry.characters.find(function(e) { return e.id === 'surv'; });
  assert.deepEqual(survivor.aliases, ['nick']);
});

test('S0: addEntity initializes aliases:[] for consistency', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  Rga.Doc.addEntity(doc, 'character', { id: 'k', name: 'Karim' });
  const e = doc.tagRegistry.characters.find(function(x) { return x.id === 'k'; });
  assert.deepEqual(e.aliases, []);
});

// ================================================================
// Round-trip — aliases survive serialize (§7 test 4)
// ================================================================

test('S0: aliases survive serialize round-trip', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali', aliases: ['the teacher'] });
  const json = JSON.parse(Rga.Doc.serialize(doc));
  assert.deepEqual(json.tag_registry.characters[0].aliases, ['the teacher']);
});
