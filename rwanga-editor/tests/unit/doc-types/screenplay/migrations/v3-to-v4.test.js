// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Semantic Entity Layer S0 — v3 → v4 migration.
// Brief: docs/Filmustageation/SEMANTIC_ENTITY_LAYER_S0_IMPLEMENTATION_BRIEF.md §6,§7
//
// v4 adds entity.aliases (string[]). The migration defaults aliases:[] on every
// registry entity (incl. tombstones), preserves everything else, is idempotent,
// and the chain dispatcher must actually carry a v1/v2/v3 doc to "4.0".
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// Boot JUST the v3→v4 step (mirrors v2-to-v3.test.js).
function bootStep() {
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  const p = require.resolve('../../../../../renderer/js/doc-types/screenplay/migrations/v3-to-v4.js');
  delete require.cache[p];
  require(p);
  return global.window.Rga.Migrations._steps;
}

// Boot the WHOLE chain (constants + every step + index dispatcher), fresh.
function bootChain() {
  global.window = { Rga: {} };
  const files = [
    '../../../../../renderer/js/constants.js',
    '../../../../../renderer/js/doc-types/screenplay/migrations/v1-to-v2.js',
    '../../../../../renderer/js/doc-types/screenplay/migrations/v2-to-v3.js',
    '../../../../../renderer/js/doc-types/screenplay/migrations/v3-to-v4.js',
    '../../../../../renderer/js/doc-types/screenplay/migrations/index.js',
  ];
  files.forEach(function(f) {
    const p = require.resolve(f);
    delete require.cache[p];
    require(p);
  });
  return global.window.Rga;
}

function v3Doc(characters) {
  return {
    rga_version: '3.0',
    document_type: 'screenplay',
    metadata: { title: 't' },
    body: { type: 'doc', content: [] },
    tag_registry: { characters: characters || [] },
  };
}

// ----------------------------------------------------------------
// Test 1 — migration default
// ----------------------------------------------------------------
test('S0: v3toV4 defaults aliases:[] on every entity and bumps to 4.0', () => {
  const S = bootStep();
  const out = S.v3toV4(v3Doc([
    { id: 'a', name: 'Nali', color: null, notes: '', extra: 'keepme' },
    { id: 'b', name: 'Baban', merged_into: 'a' },   // tombstone gets aliases too
  ]));
  assert.equal(out.rga_version, '4.0');
  assert.deepEqual(out.tag_registry.characters[0].aliases, []);
  assert.deepEqual(out.tag_registry.characters[1].aliases, []);
  // unknown / existing fields preserved
  assert.equal(out.tag_registry.characters[0].extra, 'keepme');
  assert.equal(out.tag_registry.characters[1].merged_into, 'a');
});

// ----------------------------------------------------------------
// Test 2 — idempotent; existing aliases untouched
// ----------------------------------------------------------------
test('S0: v3toV4 is idempotent and never overwrites existing aliases', () => {
  const S = bootStep();
  const first = S.v3toV4(v3Doc([{ id: 'a', name: 'Nali', aliases: ['the teacher'] }]));
  const second = S.v3toV4(first);
  assert.deepEqual(second.tag_registry.characters[0].aliases, ['the teacher']);
  assert.equal(second.rga_version, '4.0');
});

// ----------------------------------------------------------------
// Test 3 — the CHAIN reaches 4.0 (proves index.js dispatcher, not just the step)
// ----------------------------------------------------------------
test('S0: migrate() carries a v3 doc all the way to 4.0', () => {
  const Rga = bootChain();
  const out = Rga.Migrations.migrate(v3Doc([{ id: 'a', name: 'Nali' }]));
  assert.equal(out.rga_version, '4.0');
  assert.deepEqual(out.tag_registry.characters[0].aliases, []);
});

// LATEST_VERSION is a global dispatcher fact — Print Contract V1 advanced it to
// 5.0. (This boot intentionally loads only through v3→v4, so migrate() itself
// stops at 4.0 above; the constant still reports the chain's latest known step.)
test('S0: migrate() exposes LATEST_VERSION 5.0', () => {
  const Rga = bootChain();
  assert.equal(Rga.Migrations.LATEST_VERSION, '5.0');
});

test('S0: constants bumped — CURRENT 5.0, SUPPORTED includes 4.0', () => {
  const Rga = bootChain();
  assert.equal(Rga.Constants.CURRENT_RGA_VERSION, '5.0');
  assert.ok(Rga.Constants.SUPPORTED_RGA_VERSIONS.indexOf('4.0') !== -1);
});
