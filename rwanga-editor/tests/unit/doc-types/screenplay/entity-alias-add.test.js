// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Semantic Entity Layer S1 — Rga.Doc.addAlias mutation.
// Brief: SEMANTIC_ENTITY_LAYER_ALIAS_UX_RECONCILIATION.md §3 (S1 build #1)
// Doctrine: SEMANTIC_ENTITY_LAYER_DOCTRINE_LOCK.md §3 (uniqueness over names ∪
// aliases per type), Invariant IX (Alias ≠ Merge — no tombstone, no second entity).
//
// REAL doc.js registry, no stubs.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function boot() {
  global.window = { Rga: {} };
  ['../../../../renderer/js/constants.js',
   '../../../../renderer/js/doc.js'
  ].forEach(function(f) {
    const p = require.resolve(f);
    delete require.cache[p];
    require(p);
  });
  return global.window.Rga;
}

function pushRaw(doc, key, entity) {
  if (!doc.tagRegistry[key]) doc.tagRegistry[key] = [];
  doc.tagRegistry[key].push(entity);
  return entity;
}

// ----------------------------------------------------------------
test('S1 addAlias: adds a distinctive alias to the live entity (trimmed surface)', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali', aliases: [] });
  const r = Rga.Doc.addAlias(doc, 'character', 'nali', '  The Teacher ');
  assert.equal(r.added, true);
  assert.deepEqual(doc.tagRegistry.characters[0].aliases, ['The Teacher']);
});

test('S1 addAlias: dedupe — existing alias (case-insensitive) is not re-added', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali', aliases: ['The Teacher'] });
  const r = Rga.Doc.addAlias(doc, 'character', 'nali', 'the teacher');
  assert.equal(r.added, false);
  assert.equal(r.reason, 'duplicate');
  assert.deepEqual(doc.tagRegistry.characters[0].aliases, ['The Teacher']);
});

test('S1 addAlias: refuses to alias the canonical name itself', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali', aliases: [] });
  const r = Rga.Doc.addAlias(doc, 'character', 'nali', 'NALI');
  assert.equal(r.added, false);
  assert.equal(r.reason, 'is-name');
  assert.deepEqual(doc.tagRegistry.characters[0].aliases, []);
});

test('S1 addAlias: uniqueness — refuses a surface that is ANOTHER live entity\'s NAME', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali',  name: 'Nali',  aliases: [] });
  pushRaw(doc, 'characters', { id: 'baban', name: 'Baban', aliases: [] });
  const r = Rga.Doc.addAlias(doc, 'character', 'nali', 'Baban');
  assert.equal(r.added, false);
  assert.equal(r.reason, 'collision');
  assert.deepEqual(doc.tagRegistry.characters[0].aliases, []);
});

test('S1 addAlias: uniqueness — refuses a surface that is ANOTHER live entity\'s ALIAS', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali',  name: 'Nali',  aliases: [] });
  pushRaw(doc, 'characters', { id: 'baban', name: 'Baban', aliases: ['The Butcher'] });
  const r = Rga.Doc.addAlias(doc, 'character', 'nali', 'the butcher');
  assert.equal(r.added, false);
  assert.equal(r.reason, 'collision');
});

test('S1 addAlias: live only — refuses to alias onto a tombstoned entity', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali', aliases: [] });
  pushRaw(doc, 'characters', { id: 'ghost', name: 'Ghost', aliases: [], merged_into: 'nali' });
  const r = Rga.Doc.addAlias(doc, 'character', 'ghost', 'The Spirit');
  assert.equal(r.added, false);
  assert.equal(r.reason, 'tombstoned');
});

test('S1 addAlias: empty surface refused', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali', aliases: [] });
  assert.equal(Rga.Doc.addAlias(doc, 'character', 'nali', '   ').added, false);
  assert.equal(Rga.Doc.addAlias(doc, 'character', 'nali', '   ').reason, 'empty');
});

test('S1 addAlias: unknown entity refused', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  const r = Rga.Doc.addAlias(doc, 'character', 'nope', 'The Teacher');
  assert.equal(r.added, false);
  assert.equal(r.reason, 'no-entity');
});

test('S1 addAlias: NEVER creates a tombstone or a second entity (Alias ≠ Merge)', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali', aliases: [] });
  Rga.Doc.addAlias(doc, 'character', 'nali', 'The Teacher');
  assert.equal(doc.tagRegistry.characters.length, 1);            // no new entity
  assert.equal(doc.tagRegistry.characters[0].merged_into, undefined); // no tombstone
  assert.deepEqual(doc.mergeLog || [], []);                      // no merge logged
});

test('S1 addAlias: tolerates an entity with NO aliases field (initializes it)', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali' }); // no aliases key
  const r = Rga.Doc.addAlias(doc, 'character', 'nali', 'The Teacher');
  assert.equal(r.added, true);
  assert.deepEqual(doc.tagRegistry.characters[0].aliases, ['The Teacher']);
});

test('S1 addAlias: type-scoped — Character and Prop are independent', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali', aliases: [] });
  pushRaw(doc, 'props',      { id: 'knife', name: 'Knife', aliases: [] });
  // "Knife" is a prop name; aliasing it onto a CHARACTER must not collide.
  const r = Rga.Doc.addAlias(doc, 'character', 'nali', 'Knife');
  assert.equal(r.added, true);
});
