// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Semantic Entity Layer S1 — derived alias marker + picker decision.
// Brief: SEMANTIC_ENTITY_LAYER_ALIAS_UX_RECONCILIATION.md §3 (S1 build #2,#4)
//
// The alias marker is DERIVED at render time (surface text vs entity name/aliases)
// — it never reads a mark attribute (schema.marks.tag is untouched). These tests
// cover the pure classifier + range derivation + the picker's exact-match decision.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function boot() {
  global.window = { Rga: {} };
  global.document = { addEventListener: function() {} }; // tags.js load-time listener
  ['../../../../renderer/js/constants.js',
   '../../../../renderer/js/doc.js',
   '../../../../renderer/js/doc-types/screenplay/plugins/tags.js',
   '../../../../renderer/js/doc-types/screenplay/plugins/alias-marker.js'
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

// ================================================================
// isAliasSurface — the pure classifier
// ================================================================

test('S1 isAliasSurface: canonical name → false', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali', aliases: ['The Teacher'] });
  assert.equal(Rga.AliasMarker.isAliasSurface(doc, 'character', 'nali', 'Nali'), false);
  assert.equal(Rga.AliasMarker.isAliasSurface(doc, 'character', 'nali', 'nali'), false); // case-insensitive
});

test('S1 isAliasSurface: alias surface → true (case-insensitive)', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali', aliases: ['The Teacher'] });
  assert.equal(Rga.AliasMarker.isAliasSurface(doc, 'character', 'nali', 'The Teacher'), true);
  assert.equal(Rga.AliasMarker.isAliasSurface(doc, 'character', 'nali', 'the teacher'), true);
});

test('S1 isAliasSurface: unknown surface → false; missing entity → false', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali', name: 'Nali', aliases: ['The Teacher'] });
  assert.equal(Rga.AliasMarker.isAliasSurface(doc, 'character', 'nali', 'Somebody Else'), false);
  assert.equal(Rga.AliasMarker.isAliasSurface(doc, 'character', 'ghost', 'The Teacher'), false);
});

test('S1 isAliasSurface: resolves a tombstoned id to its survivor, then classifies', () => {
  const Rga = boot();
  const doc = Rga.Doc.create();
  pushRaw(doc, 'characters', { id: 'nali',  name: 'Nali', aliases: ['The Teacher'] });
  pushRaw(doc, 'characters', { id: 'dupe',  name: 'Nali', aliases: [], merged_into: 'nali' });
  // A mark left pointing at the tombstone still resolves to Nali → alias holds.
  assert.equal(Rga.AliasMarker.isAliasSurface(doc, 'character', 'dupe', 'The Teacher'), true);
});

// ================================================================
// aliasRanges — derive decoration ranges from a PM doc (fake)
// ================================================================

// Minimal fake PM doc: descendants(cb) over text nodes + textBetween(from,to).
function fakeDoc(nodes) {
  // nodes: [{ text, from, tagType, entityId }]
  return {
    descendants: function(cb) {
      nodes.forEach(function(n) {
        cb({
          isText: true,
          nodeSize: n.text.length,
          marks: [{ type: { name: 'tag' }, attrs: { tagType: n.tagType, entityId: n.entityId } }]
        }, n.from);
      });
    },
    textBetween: function(from, to) {
      const n = nodes.find(function(x) { return x.from === from; });
      return n ? n.text : '';
    }
  };
}

test('S1 aliasRanges: only alias mentions become ranges; canonical mentions do not', () => {
  const Rga = boot();
  const rga = Rga.Doc.create();
  pushRaw(rga, 'characters', { id: 'nali', name: 'Nali', aliases: ['The Teacher'] });
  const pm = fakeDoc([
    { text: 'Nali',        from: 5,  tagType: 'character', entityId: 'nali' }, // canonical
    { text: 'The Teacher', from: 40, tagType: 'character', entityId: 'nali' }  // alias
  ]);
  const ranges = Rga.AliasMarker.aliasRanges(pm, rga);
  assert.deepEqual(ranges, [{ from: 40, to: 51 }]); // 40 + 'The Teacher'.length(11)
});

test('S1 aliasRanges: no aliases anywhere → empty', () => {
  const Rga = boot();
  const rga = Rga.Doc.create();
  pushRaw(rga, 'characters', { id: 'nali', name: 'Nali', aliases: [] });
  const pm = fakeDoc([{ text: 'Nali', from: 5, tagType: 'character', entityId: 'nali' }]);
  assert.deepEqual(Rga.AliasMarker.aliasRanges(pm, rga), []);
});

// ================================================================
// pickerDecision — exact-match fast path vs picker candidates
// ================================================================

test('S1 pickerDecision: exact name match (case-insensitive) → exactMatchId set', () => {
  const Rga = boot();
  const live = [{ id: 'nali', name: 'Nali' }, { id: 'baban', name: 'Baban' }];
  const d = Rga.Tags.pickerDecision('nali', live);
  assert.equal(d.exactMatchId, 'nali');
});

test('S1 pickerDecision: no name match → exactMatchId null, all entities are candidates', () => {
  const Rga = boot();
  const live = [{ id: 'nali', name: 'Nali' }, { id: 'baban', name: 'Baban' }];
  const d = Rga.Tags.pickerDecision('The Teacher', live);
  assert.equal(d.exactMatchId, null);
  assert.equal(d.candidates.length, 2);
});

test('S1 pickerDecision: an existing ALIAS match is also a fast-path exact match', () => {
  const Rga = boot();
  const live = [{ id: 'nali', name: 'Nali', aliases: ['The Teacher'] }];
  // Re-tagging "The Teacher" should resolve to Nali silently, not re-open a picker.
  const d = Rga.Tags.pickerDecision('the teacher', live);
  assert.equal(d.exactMatchId, 'nali');
});
