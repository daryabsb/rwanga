// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Registry Integrity Slice B1 — scoped Rga.Doc registry merge APIs.
// Design: docs/Filmustageation/SCOPED_REGISTRY_MERGE_API_DESIGN.md §1, §2, §5.1
// Policy: docs/Filmustageation/IDENTITY_MERGE_POLICY_AUDIT.md (approved D1–D5)
//
// The controlled registry-mutation surface for entity merging:
//   markEntityMerged / foldEntityMetadata / appendMergeLog   (mutation)
//   isEntityMerged / resolveEntityId / liveEntities          (read)
//   doc.mergeLog ↔ merge_log                                 (format mapping)
//
// Everything here runs against the REAL doc.js — no stubs.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

global.window = global.window || {};
require('../../renderer/js/constants.js');
require('../../renderer/js/doc.js');
const Doc = global.window.Rga.Doc;

const FIXTURE_PATH = path.resolve(__dirname, '..', 'fixtures', 'playground-the-last-light.rga');

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

// Fresh doc with characters seeded through the real addEntity.
function docWithCharacters(entities) {
  const doc = Doc.create();
  (entities || []).forEach(function(e) { Doc.addEntity(doc, 'character', e); });
  return doc;
}

// Push a raw entity object into the registry — simulates file-loaded
// state (deserialize passes registry entries through by reference, so
// tombstones / unknown fields arrive exactly like this).
function pushRaw(doc, registryKey, entity) {
  doc.tagRegistry[registryKey].push(entity);
  return entity;
}

function findIn(doc, registryKey, id) {
  return doc.tagRegistry[registryKey].find(function(e) { return e.id === id; });
}

// ================================================================
// §0 — API surface exists
// ================================================================

test('B1: the six merge APIs exist on Rga.Doc', () => {
  assert.equal(typeof Doc.markEntityMerged,   'function');
  assert.equal(typeof Doc.foldEntityMetadata, 'function');
  assert.equal(typeof Doc.appendMergeLog,     'function');
  assert.equal(typeof Doc.isEntityMerged,     'function');
  assert.equal(typeof Doc.resolveEntityId,    'function');
  assert.equal(typeof Doc.liveEntities,       'function');
});

// ================================================================
// §1 — markEntityMerged validation matrix
// ================================================================

test('B1: markEntityMerged — loser not found → false, no change', () => {
  const doc = docWithCharacters([{ id: 'ent-a', name: 'NALI' }]);
  assert.equal(Doc.markEntityMerged(doc, 'character', 'missing', 'ent-a'), false);
  assert.equal(doc.tagRegistry.characters.length, 1);
  assert.equal(findIn(doc, 'characters', 'ent-a').merged_into, undefined);
});

test('B1: markEntityMerged — survivor not found → false, no change', () => {
  const doc = docWithCharacters([{ id: 'ent-a', name: 'NALI' }]);
  assert.equal(Doc.markEntityMerged(doc, 'character', 'ent-a', 'missing'), false);
  assert.equal(findIn(doc, 'characters', 'ent-a').merged_into, undefined);
});

test('B1: markEntityMerged — self-merge (loser === survivor) → false', () => {
  const doc = docWithCharacters([{ id: 'ent-a', name: 'NALI' }]);
  assert.equal(Doc.markEntityMerged(doc, 'character', 'ent-a', 'ent-a'), false);
  assert.equal(findIn(doc, 'characters', 'ent-a').merged_into, undefined);
});

test('B1: markEntityMerged — survivor itself tombstoned → false (the API never creates chains)', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI' },
    { id: 'ent-b', name: 'NALI' },
    { id: 'ent-c', name: 'NALI' }
  ]);
  // b is already merged into a.
  assert.equal(Doc.markEntityMerged(doc, 'character', 'ent-b', 'ent-a'), true);
  // Merging c INTO b (a tombstone) must be refused.
  assert.equal(Doc.markEntityMerged(doc, 'character', 'ent-c', 'ent-b'), false);
  assert.equal(findIn(doc, 'characters', 'ent-c').merged_into, undefined);
});

test('B1: markEntityMerged — re-merge into the SAME survivor → true, idempotent no-op', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI' },
    { id: 'ent-b', name: 'NALI' }
  ]);
  assert.equal(Doc.markEntityMerged(doc, 'character', 'ent-b', 'ent-a'), true);
  assert.equal(Doc.markEntityMerged(doc, 'character', 'ent-b', 'ent-a'), true,
    're-running the same merge must be a successful no-op (re-runnability)');
  assert.equal(findIn(doc, 'characters', 'ent-b').merged_into, 'ent-a');
});

test('B1: markEntityMerged — re-merge into a DIFFERENT survivor → false, original tombstone unchanged', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI' },
    { id: 'ent-b', name: 'NALI' },
    { id: 'ent-c', name: 'NALI' }
  ]);
  assert.equal(Doc.markEntityMerged(doc, 'character', 'ent-b', 'ent-a'), true);
  assert.equal(Doc.markEntityMerged(doc, 'character', 'ent-b', 'ent-c'), false,
    'conflicting re-merge must be refused, never overwritten');
  assert.equal(findIn(doc, 'characters', 'ent-b').merged_into, 'ent-a',
    'original tombstone target unchanged');
});

test('B1: markEntityMerged — success: tombstone written, survivor + loser other fields untouched', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI', color: '#4FC1FF', notes: 'Protagonist.' },
    { id: 'ent-b', name: 'Nali', color: null, notes: 'from scene 2' }
  ]);
  assert.equal(Doc.markEntityMerged(doc, 'character', 'ent-b', 'ent-a'), true);

  const loser = findIn(doc, 'characters', 'ent-b');
  assert.equal(loser.merged_into, 'ent-b' === loser.id ? 'ent-a' : loser.merged_into);
  assert.equal(loser.merged_into, 'ent-a');
  // Loser's own fields untouched (markEntityMerged does NOT fold).
  assert.equal(loser.name, 'Nali');
  assert.equal(loser.notes, 'from scene 2');
  // Survivor completely untouched.
  const survivor = findIn(doc, 'characters', 'ent-a');
  assert.deepEqual(survivor, { id: 'ent-a', name: 'NALI', color: '#4FC1FF', notes: 'Protagonist.', aliases: [] });
  // Nothing deleted.
  assert.equal(doc.tagRegistry.characters.length, 2);
});

test('B1: markEntityMerged — identity is type-scoped: same id in another type is untouched', () => {
  const doc = Doc.create();
  Doc.addEntity(doc, 'character', { id: 'shared-id', name: 'NALI' });
  Doc.addEntity(doc, 'prop',      { id: 'shared-id', name: 'NALI' });
  Doc.addEntity(doc, 'character', { id: 'ent-surv', name: 'NALI' });
  assert.equal(Doc.markEntityMerged(doc, 'character', 'shared-id', 'ent-surv'), true);
  assert.equal(findIn(doc, 'characters', 'shared-id').merged_into, 'ent-surv');
  assert.equal(findIn(doc, 'props', 'shared-id').merged_into, undefined,
    'the prop with the same id must not be tombstoned');
});

// ================================================================
// §2 — foldEntityMetadata rules
// ================================================================

test('B1: fold — color: survivor non-null stays; loser color ignored; color_moved null', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI', color: '#4FC1FF' },
    { id: 'ent-b', name: 'Nali', color: '#FF0000' }
  ]);
  const summary = Doc.foldEntityMetadata(doc, 'character', 'ent-a', 'ent-b');
  assert.ok(summary);
  assert.equal(findIn(doc, 'characters', 'ent-a').color, '#4FC1FF', 'survivor color never overwritten');
  assert.equal(summary.color_moved, null);
});

test('B1: fold — color: survivor null + loser has color → color moves, color_moved reports it', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI', color: null },
    { id: 'ent-b', name: 'Nali', color: '#FF0000' }
  ]);
  const summary = Doc.foldEntityMetadata(doc, 'character', 'ent-a', 'ent-b');
  assert.equal(findIn(doc, 'characters', 'ent-a').color, '#FF0000');
  assert.equal(summary.color_moved, '#FF0000');
});

test('B1: fold — color: both null → stays null, color_moved null', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI' },
    { id: 'ent-b', name: 'Nali' }
  ]);
  const summary = Doc.foldEntityMetadata(doc, 'character', 'ent-a', 'ent-b');
  assert.equal(findIn(doc, 'characters', 'ent-a').color, null);
  assert.equal(summary.color_moved, null);
});

test('B1: fold — notes: loser empty → survivor notes unchanged, notes_appended false', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI', notes: 'Protagonist.' },
    { id: 'ent-b', name: 'Nali', notes: '' }
  ]);
  const summary = Doc.foldEntityMetadata(doc, 'character', 'ent-a', 'ent-b');
  assert.equal(findIn(doc, 'characters', 'ent-a').notes, 'Protagonist.');
  assert.equal(summary.notes_appended, false);
});

test('B1: fold — notes: both have notes → concatenated with attribution, nothing lost', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI', notes: 'Protagonist.' },
    { id: 'ent-b', name: 'Nali', notes: 'Carries the film.' }
  ]);
  const summary = Doc.foldEntityMetadata(doc, 'character', 'ent-a', 'ent-b');
  const notes = findIn(doc, 'characters', 'ent-a').notes;
  assert.ok(notes.startsWith('Protagonist.'), 'survivor notes come first');
  assert.ok(notes.includes('merged from "Nali" (ent-b)'), 'attribution names the loser');
  assert.ok(notes.endsWith('Carries the film.'), 'loser notes preserved in full');
  assert.equal(summary.notes_appended, true);
});

test('B1: fold — notes: survivor empty + loser has notes → attribution + loser notes', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI', notes: '' },
    { id: 'ent-b', name: 'Nali', notes: 'Carries the film.' }
  ]);
  const summary = Doc.foldEntityMetadata(doc, 'character', 'ent-a', 'ent-b');
  const notes = findIn(doc, 'characters', 'ent-a').notes;
  assert.ok(notes.includes('merged from "Nali" (ent-b)'), 'attribution present even with empty survivor notes');
  assert.ok(notes.endsWith('Carries the film.'));
  assert.equal(summary.notes_appended, true);
});

test('B1: fold — survivor name and id are never touched; loser name reported', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI' },
    { id: 'ent-b', name: 'Nali' }
  ]);
  const summary = Doc.foldEntityMetadata(doc, 'character', 'ent-a', 'ent-b');
  const survivor = findIn(doc, 'characters', 'ent-a');
  assert.equal(survivor.name, 'NALI');
  assert.equal(survivor.id, 'ent-a');
  assert.equal(summary.loser_name, 'Nali');
});

test('B1: fold — unknown loser fields: reported in summary, NOT copied to survivor', () => {
  const doc = docWithCharacters([{ id: 'ent-a', name: 'NALI' }]);
  // Loser arrives with unknown fields, as a hand-edited / future-version file would deliver it.
  pushRaw(doc, 'characters', { id: 'ent-b', name: 'Nali', color: null, notes: '',
    aliases: ['NALI', 'Nali'], custom_field: 42 });

  const summary = Doc.foldEntityMetadata(doc, 'character', 'ent-a', 'ent-b');
  const survivor = findIn(doc, 'characters', 'ent-a');
  // aliases is now a KNOWN field (S0): folded (unioned, case-insensitive dedup),
  // not reported as unknown. 'NALI'/'Nali' collapse to the first form.
  assert.deepEqual(survivor.aliases, ['NALI'], 'known aliases field folded into survivor');
  // custom_field is still genuinely unknown — reported, never copied.
  assert.equal(survivor.custom_field, undefined);
  assert.deepEqual(summary.unknown_fields, { custom_field: 42 },
    'only truly-unknown fields are preserved in the summary so the log loses nothing');
});

test('B1: fold — no unknown loser fields → unknown_fields is null', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI' },
    { id: 'ent-b', name: 'Nali' }
  ]);
  const summary = Doc.foldEntityMetadata(doc, 'character', 'ent-a', 'ent-b');
  assert.equal(summary.unknown_fields, null);
});

test('B1: fold — loser already tombstoned → null, no change (double-fold prevention)', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI', notes: 'Original.' },
    { id: 'ent-b', name: 'Nali', notes: 'Loser notes.' }
  ]);
  // Correct order first time: fold then mark.
  Doc.foldEntityMetadata(doc, 'character', 'ent-a', 'ent-b');
  Doc.markEntityMerged(doc, 'character', 'ent-b', 'ent-a');
  const notesAfterFirst = findIn(doc, 'characters', 'ent-a').notes;

  // Re-running fold (crash-recovery re-run) must NOT concatenate again.
  const second = Doc.foldEntityMetadata(doc, 'character', 'ent-a', 'ent-b');
  assert.equal(second, null);
  assert.equal(findIn(doc, 'characters', 'ent-a').notes, notesAfterFirst,
    'notes must not be appended twice');
});

test('B1: fold — survivor tombstoned → null, no change', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI' },
    { id: 'ent-b', name: 'NALI' },
    { id: 'ent-c', name: 'Nali', notes: 'x' }
  ]);
  Doc.markEntityMerged(doc, 'character', 'ent-a', 'ent-b');  // a is now a tombstone
  assert.equal(Doc.foldEntityMetadata(doc, 'character', 'ent-a', 'ent-c'), null,
    'folding INTO a tombstone is refused');
});

test('B1: fold — survivor or loser not found → null', () => {
  const doc = docWithCharacters([{ id: 'ent-a', name: 'NALI' }]);
  assert.equal(Doc.foldEntityMetadata(doc, 'character', 'ent-a', 'missing'), null);
  assert.equal(Doc.foldEntityMetadata(doc, 'character', 'missing', 'ent-a'), null);
});

// ================================================================
// §3 — appendMergeLog
// ================================================================

function validRecord() {
  return {
    tag_type: 'character',
    survivor: { id: 'ent-a', name: 'NALI' },
    losers: [{ id: 'ent-b', name: 'Nali', color: null, notes: '', mark_count: 1 }],
    metadata_moved: { color_moved: null, notes_appended: false, unknown_fields: null }
  };
}

test('B1: appendMergeLog — valid record → appended, merged_at stamped, record returned', () => {
  const doc = Doc.create();
  const result = Doc.appendMergeLog(doc, validRecord());
  assert.ok(result);
  assert.equal(doc.mergeLog.length, 1);
  assert.equal(doc.mergeLog[0], result);
  assert.match(result.merged_at, /^\d{4}-\d{2}-\d{2}T/, 'ISO timestamp stamped');
});

test('B1: appendMergeLog — caller-supplied merged_at is preserved, not overwritten', () => {
  const doc = Doc.create();
  const rec = validRecord();
  rec.merged_at = '2026-01-01T00:00:00.000Z';
  const result = Doc.appendMergeLog(doc, rec);
  assert.equal(result.merged_at, '2026-01-01T00:00:00.000Z');
});

test('B1: appendMergeLog — malformed records → null, nothing appended', () => {
  const doc = Doc.create();

  const noTagType = validRecord(); delete noTagType.tag_type;
  assert.equal(Doc.appendMergeLog(doc, noTagType), null);

  const noSurvivor = validRecord(); delete noSurvivor.survivor;
  assert.equal(Doc.appendMergeLog(doc, noSurvivor), null);

  const noSurvivorId = validRecord(); delete noSurvivorId.survivor.id;
  assert.equal(Doc.appendMergeLog(doc, noSurvivorId), null);

  const emptyLosers = validRecord(); emptyLosers.losers = [];
  assert.equal(Doc.appendMergeLog(doc, emptyLosers), null);

  const losersNotArray = validRecord(); losersNotArray.losers = 'ent-b';
  assert.equal(Doc.appendMergeLog(doc, losersNotArray), null);

  assert.equal(Doc.appendMergeLog(doc, null), null);

  assert.equal(doc.mergeLog.length, 0, 'no malformed record ever lands in the log');
});

test('B1: appendMergeLog — lazy-initializes mergeLog when absent (defensive, mirrors addFlagLogEntry)', () => {
  const doc = Doc.create();
  delete doc.mergeLog;  // simulate a doc object from a code path that never knew about merge
  const result = Doc.appendMergeLog(doc, validRecord());
  assert.ok(result);
  assert.equal(doc.mergeLog.length, 1);
});

// ================================================================
// §4 — Read APIs
// ================================================================

test('B1: isEntityMerged — null for unknown entity, false for live, true for tombstone', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI' },
    { id: 'ent-b', name: 'Nali' }
  ]);
  Doc.markEntityMerged(doc, 'character', 'ent-b', 'ent-a');

  assert.equal(Doc.isEntityMerged(doc, 'character', 'missing'), null);
  assert.equal(Doc.isEntityMerged(doc, 'character', 'ent-a'), false);
  assert.equal(Doc.isEntityMerged(doc, 'character', 'ent-b'), true);
});

test('B1: resolveEntityId — live entity resolves to its own id', () => {
  const doc = docWithCharacters([{ id: 'ent-a', name: 'NALI' }]);
  assert.equal(Doc.resolveEntityId(doc, 'character', 'ent-a'), 'ent-a');
});

test('B1: resolveEntityId — tombstone resolves to its survivor', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI' },
    { id: 'ent-b', name: 'Nali' }
  ]);
  Doc.markEntityMerged(doc, 'character', 'ent-b', 'ent-a');
  assert.equal(Doc.resolveEntityId(doc, 'character', 'ent-b'), 'ent-a');
});

test('B1: resolveEntityId — follows a chain from a hand-edited file (A→B→C)', () => {
  const doc = Doc.create();
  // Chains can't be created by the API; simulate a hand-edited file.
  pushRaw(doc, 'characters', { id: 'ent-a', name: 'NALI', color: null, notes: '', merged_into: 'ent-b' });
  pushRaw(doc, 'characters', { id: 'ent-b', name: 'NALI', color: null, notes: '', merged_into: 'ent-c' });
  pushRaw(doc, 'characters', { id: 'ent-c', name: 'NALI', color: null, notes: '' });
  assert.equal(Doc.resolveEntityId(doc, 'character', 'ent-a'), 'ent-c');
});

test('B1: resolveEntityId — cycle in a hand-edited file → null (cannot resolve)', () => {
  const doc = Doc.create();
  pushRaw(doc, 'characters', { id: 'ent-a', name: 'NALI', color: null, notes: '', merged_into: 'ent-b' });
  pushRaw(doc, 'characters', { id: 'ent-b', name: 'NALI', color: null, notes: '', merged_into: 'ent-a' });
  assert.equal(Doc.resolveEntityId(doc, 'character', 'ent-a'), null);
});

test('B1: resolveEntityId — dangling merged_into target → null', () => {
  const doc = Doc.create();
  pushRaw(doc, 'characters', { id: 'ent-a', name: 'NALI', color: null, notes: '', merged_into: 'gone' });
  assert.equal(Doc.resolveEntityId(doc, 'character', 'ent-a'), null);
});

test('B1: resolveEntityId — unknown entity → null', () => {
  const doc = Doc.create();
  assert.equal(Doc.resolveEntityId(doc, 'character', 'missing'), null);
});

test('B1: liveEntities — filters tombstones, returns a fresh array of live entity references', () => {
  const doc = docWithCharacters([
    { id: 'ent-a', name: 'NALI' },
    { id: 'ent-b', name: 'Nali' },
    { id: 'ent-c', name: 'BABAN' }
  ]);
  Doc.markEntityMerged(doc, 'character', 'ent-b', 'ent-a');

  const live = Doc.liveEntities(doc, 'character');
  assert.deepEqual(live.map(function(e) { return e.id; }), ['ent-a', 'ent-c']);
  // Same object references (consistent with findEntity)…
  assert.equal(live[0], findIn(doc, 'characters', 'ent-a'));
  // …but a fresh array: mutating it never reaches the registry.
  live.push({ id: 'fake' });
  assert.equal(doc.tagRegistry.characters.length, 3);
});

test('B1: liveEntities — empty/unknown type → empty array', () => {
  const doc = Doc.create();
  assert.deepEqual(Doc.liveEntities(doc, 'character'), []);
});

// ================================================================
// §5 — Format mapping: doc.mergeLog ↔ merge_log
// ================================================================

test('B1: create() initializes mergeLog: []', () => {
  const doc = Doc.create();
  assert.deepEqual(doc.mergeLog, []);
});

test('B1: serialize writes merge_log; deserialize restores mergeLog', () => {
  const doc = Doc.create();
  Doc.addEntity(doc, 'character', { id: 'ent-a', name: 'NALI' });
  Doc.addEntity(doc, 'character', { id: 'ent-b', name: 'Nali' });
  Doc.foldEntityMetadata(doc, 'character', 'ent-a', 'ent-b');
  Doc.markEntityMerged(doc, 'character', 'ent-b', 'ent-a');
  Doc.appendMergeLog(doc, validRecord());

  const str = Doc.serialize(doc);
  const parsed = JSON.parse(str);
  assert.equal(parsed.rga_version, '5.0', 'version is the doc\'s CURRENT (5.0) — merge ops never bump it');
  assert.equal(parsed.merge_log.length, 1);
  assert.equal(parsed.merge_log[0].survivor.id, 'ent-a');

  const reloaded = Doc.deserialize(str, null);
  assert.equal(reloaded.mergeLog.length, 1);
  assert.equal(reloaded.mergeLog[0].survivor.id, 'ent-a');
});

test('B1: merged_into round-trips through serialize/deserialize (entity-level pass-through)', () => {
  const doc = Doc.create();
  Doc.addEntity(doc, 'character', { id: 'ent-a', name: 'NALI' });
  Doc.addEntity(doc, 'character', { id: 'ent-b', name: 'Nali' });
  Doc.markEntityMerged(doc, 'character', 'ent-b', 'ent-a');

  const reloaded = Doc.deserialize(Doc.serialize(doc), null);
  assert.equal(Doc.isEntityMerged(reloaded, 'character', 'ent-b'), true);
  assert.equal(Doc.resolveEntityId(reloaded, 'character', 'ent-b'), 'ent-a');
});

test('B1: old files (no merge_log) load with mergeLog: [] and nothing merged', () => {
  // A pre-Slice-B v3.0 file: no merge_log key anywhere.
  const oldFile = JSON.stringify({
    rga_version: '3.0',
    document_type: 'screenplay',
    metadata: { title: 'Old Script' },
    settings: {},
    body: null,
    tag_registry: { characters: [{ id: 'ent-a', name: 'NALI', color: null, notes: '' }],
      props: [], wardrobe: [], locations: [], sfx: [], vfx: [], vehicles: [], animals: [], custom: [] },
    flag_log: [],
    export_settings: {},
    runtime: {}
  });
  const doc = Doc.deserialize(oldFile, null);
  assert.deepEqual(doc.mergeLog, []);
  assert.equal(Doc.isEntityMerged(doc, 'character', 'ent-a'), false);
  assert.deepEqual(Doc.liveEntities(doc, 'character').map(function(e) { return e.id; }), ['ent-a']);
});

test('B1: unknown entity-level fields still round-trip (with and without merged_into)', () => {
  const fileWithExtras = JSON.stringify({
    rga_version: '3.0',
    document_type: 'screenplay',
    metadata: {},
    settings: {},
    body: null,
    tag_registry: {
      characters: [
        { id: 'ent-a', name: 'NALI', color: null, notes: '', aliases: ['Nali'], future_field: { x: 1 } },
        { id: 'ent-b', name: 'Nali', color: null, notes: '', merged_into: 'ent-a', loser_extra: true }
      ],
      props: [], wardrobe: [], locations: [], sfx: [], vfx: [], vehicles: [], animals: [], custom: []
    },
    flag_log: [],
    merge_log: [],
    export_settings: {},
    runtime: {}
  });
  const doc = Doc.deserialize(fileWithExtras, null);
  const out = JSON.parse(Doc.serialize(doc));
  assert.deepEqual(out.tag_registry.characters[0].aliases, ['Nali']);
  assert.deepEqual(out.tag_registry.characters[0].future_field, { x: 1 });
  assert.equal(out.tag_registry.characters[1].merged_into, 'ent-a');
  assert.equal(out.tag_registry.characters[1].loser_extra, true);
});

// ================================================================
// §6 — Fixture compat: the APIs change nothing until they are called
// ================================================================

test('B1: playground fixture — loads with mergeLog: [], every entity live, registry untouched', () => {
  const content = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const parsed = JSON.parse(content);
  const doc = Doc.deserialize(content, null);

  assert.deepEqual(doc.mergeLog, []);
  // Every entity in every type is live (no tombstones exist in the fixture).
  Object.keys(parsed.tag_registry).forEach(function(key) {
    const typeMap = { characters: 'character', props: 'prop', wardrobe: 'wardrobe',
      locations: 'location', sfx: 'sfx', vfx: 'vfx', vehicles: 'vehicle', animals: 'animal', custom: 'custom' };
    const live = Doc.liveEntities(doc, typeMap[key]);
    assert.equal(live.length, parsed.tag_registry[key].length,
      'all ' + key + ' entities are live');
  });
  // Registry passes through untouched.
  assert.deepEqual(doc.tagRegistry, parsed.tag_registry);
});

test('B1: playground fixture — serialize keeps tag_registry deep-equal and adds only merge_log: []', () => {
  const content = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const parsed = JSON.parse(content);
  const doc = Doc.deserialize(content, null);
  const out = JSON.parse(Doc.serialize(doc));

  assert.deepEqual(out.tag_registry, parsed.tag_registry,
    'loading + saving never alters the registry (Slice A guarantee still holds)');
  assert.deepEqual(out.merge_log, [], 'merge_log appears as an empty array, nothing else');
});
