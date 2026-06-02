// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// RGA Memory Layer Phase 1 — Rga.Screenplay.Memory unit tests.
// Design: docs/Filmustageation/RGA_MEMORY_LAYER_PHASE1_DESIGN.md
//
// Two layers of coverage, per design §8:
//   A. Synthetic-index tests — hand-built idx (pure-function, no PM).
//   B. Fixture ground-truth tests — the REAL playground-the-last-light.rga
//      walked by the REAL nav-index over the REAL v3 schema. The audit's
//      findings (TAG_INTELLIGENCE_SCENE_LINKING_AUDIT.md) become executable
//      assertions: these tests ARE the honesty documentation.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// ----------------------------------------------------------------
// Boot A — synthetic: Memory + SceneCatalog only (no PM, no schema)
// ----------------------------------------------------------------
function bootSynthetic() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  [
    '../../../../renderer/js/doc-types/screenplay/scene-catalog.js',
    '../../../../renderer/js/doc-types/screenplay/memory.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  return global.window.Rga.Screenplay.Memory;
}

// Synthetic NavigationIndex builder (mirrors scene-catalog.test.js).
function makeIdx(spec) {
  spec = spec || {};
  const tags = {
    character: [], prop: [], wardrobe: [], location: [],
    sfx: [], vfx: [], vehicle: [], animal: [], custom: []
  };
  if (spec.tags) {
    Object.keys(spec.tags).forEach(function(k) { tags[k] = spec.tags[k].slice(); });
  }
  return {
    scenes: (spec.scenes || []).slice(),
    characters: (spec.characters || []).slice(),
    tags: tags,
    pages: (spec.pages || []).slice(),
    notes: (spec.notes || []).slice(),
    flags: (spec.flags || []).slice(),
    byPos: new Map(),
    byId:  new Map()
  };
}

// ----------------------------------------------------------------
// Boot B — fixture: real schema + real nav-index + real .rga body
// ----------------------------------------------------------------
const FIXTURE_PATH = path.resolve(__dirname, '..', '..', '..', 'fixtures', 'playground-the-last-light.rga');

function bootFixture() {
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
    Decoration:    PMview.Decoration,
    DecorationSet: PMview.DecorationSet
  };

  [
    '../../../../renderer/js/framework/base-outer-marks.js',
    '../../../../renderer/js/framework/document-outline.js',
    '../../../../renderer/js/framework/slug-resolver.js',
    '../../../../renderer/js/framework/nav-index.js',
    '../../../../renderer/js/doc-types/screenplay/schema-v3.js',
    '../../../../renderer/js/doc-types/screenplay/scene-catalog.js',
    '../../../../renderer/js/doc-types/screenplay/memory.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const sp = global.window.Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  const schema = sp.buildSchemaV3();

  const parsed = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const doc = schema.nodeFromJSON(parsed.body);
  const idx = global.window.Rga.Nav.buildIndex(doc, { tagRegistry: parsed.tag_registry });

  return { Memory: global.window.Rga.Screenplay.Memory, idx: idx, doc: doc, parsed: parsed };
}

// ================================================================
// A. API surface
// ================================================================

test('Memory: exposed on Rga.Screenplay with the five Phase 1 functions', () => {
  const Memory = bootSynthetic();
  assert.ok(Memory, 'Rga.Screenplay.Memory exists');
  assert.equal(typeof Memory.scene, 'function');
  assert.equal(typeof Memory.cuesForScene, 'function');
  assert.equal(typeof Memory.entity, 'function');
  assert.equal(typeof Memory.entities, 'function');
  assert.equal(typeof Memory.coverage, 'function');
});

// ================================================================
// A. entity() — entity-centric projection
// ================================================================

test('Memory.entity: returns the entity bundle for a known character (with cueCount)', () => {
  const Memory = bootSynthetic();
  const idx = makeIdx({
    scenes: [{ nodeId: 'sc-1', sceneNumber: 1 }, { nodeId: 'sc-2', sceneNumber: 2 }],
    characters: [
      { nodeId: 'e-john', name: 'JOHN', color: '#f00', cueCount: 3, mentionCount: 4, sceneAppearances: ['sc-1', 'sc-2'] }
    ],
    tags: {
      character: [
        { nodeId: 'e-john', name: 'JOHN', color: '#f00', mentionCount: 4, sceneAppearances: ['sc-1', 'sc-2'] }
      ]
    }
  });
  const e = Memory.entity('character', 'e-john', idx);
  assert.equal(e.entityId, 'e-john');
  assert.equal(e.tagType, 'character');
  assert.equal(e.name, 'JOHN');
  assert.equal(e.color, '#f00');
  assert.equal(e.mentionCount, 4);
  assert.equal(e.cueCount, 3, 'characters carry cueCount from idx.characters');
  assert.deepEqual(e.sceneIds, ['sc-1', 'sc-2']);
});

test('Memory.entity: non-character types get cueCount null (honest, not 0)', () => {
  const Memory = bootSynthetic();
  const idx = makeIdx({
    tags: { prop: [{ nodeId: 'e-knife', name: 'KNIFE', color: null, mentionCount: 2, sceneAppearances: ['sc-1'] }] }
  });
  const e = Memory.entity('prop', 'e-knife', idx);
  assert.equal(e.cueCount, null);
  assert.equal(e.mentionCount, 2);
  assert.deepEqual(e.sceneIds, ['sc-1']);
});

test('Memory.entity: unknown entity returns null; malformed input returns null', () => {
  const Memory = bootSynthetic();
  const idx = makeIdx({});
  assert.equal(Memory.entity('character', 'nope', idx), null);
  assert.equal(Memory.entity('not-a-type', 'e-1', idx), null);
  assert.equal(Memory.entity('character', 'e-1', null), null);
  assert.equal(Memory.entity(null, null, idx), null);
});

// ================================================================
// A. entities() — the brain's table of contents
// ================================================================

test('Memory.entities: returns all 9 plural-keyed groups including registry orphans', () => {
  const Memory = bootSynthetic();
  const idx = makeIdx({
    characters: [
      { nodeId: 'e-john', name: 'JOHN', color: null, cueCount: 1, mentionCount: 2, sceneAppearances: ['sc-1'] }
    ],
    tags: {
      character: [{ nodeId: 'e-john', name: 'JOHN', color: null, mentionCount: 2, sceneAppearances: ['sc-1'] }],
      prop:      [{ nodeId: 'e-orphan', name: 'GHOST PROP', color: null, mentionCount: 0, sceneAppearances: [] }]
    }
  });
  const all = Memory.entities(idx);
  const keys = Object.keys(all).sort();
  assert.deepEqual(keys, ['animals', 'characters', 'custom', 'locations', 'props', 'sfx', 'vehicles', 'vfx', 'wardrobe'].sort());
  assert.equal(all.characters.length, 1);
  assert.equal(all.characters[0].cueCount, 1);
  // Orphan entity (registry entry, zero occurrences) is present, not hidden.
  assert.equal(all.props.length, 1);
  assert.equal(all.props[0].name, 'GHOST PROP');
  assert.deepEqual(all.props[0].sceneIds, []);
  // Empty types are [] not undefined.
  assert.deepEqual(all.wardrobe, []);
});

// ================================================================
// A. scene() — delegation to SceneCatalog + cues field semantics
// ================================================================

test('Memory.scene: without doc, returns the SceneCatalog bundle plus cues === null (never [])', () => {
  const Memory = bootSynthetic();
  const idx = makeIdx({
    scenes: [{ nodeId: 'sc-1', sceneNumber: 1, headingDisplay: 'INT. HOUSE — NIGHT', hasNotes: true, hasRevisionFlag: false }],
    notes:  [{ id: 'n1', color: null, text: 'a note', status: 'open', sceneNodeId: 'sc-1', sceneNumber: 1, markedText: 'x' }],
    tags: {
      character: [{ nodeId: 'e-john', name: 'JOHN', color: null, mentionCount: 1, sceneAppearances: ['sc-1'] }]
    }
  });
  const b = Memory.scene('sc-1', idx);
  // SceneCatalog fields delegated through.
  assert.equal(b.sceneId, 'sc-1');
  assert.equal(b.sceneNumber, 1);
  assert.equal(b.title, 'INT. HOUSE — NIGHT');
  assert.equal(b.notes.length, 1);
  assert.deepEqual(b.characters.map(function(e) { return e.name; }), ['JOHN']);
  // cues: null means "not derived" (no doc supplied) — explicitly NOT [].
  assert.equal(b.cues, null);
});

test('Memory.scene: unknown sceneId echoes the id (SceneCatalog contract preserved)', () => {
  const Memory = bootSynthetic();
  const idx = makeIdx({ scenes: [{ nodeId: 'sc-1', sceneNumber: 1 }] });
  const b = Memory.scene('sc-unknown', idx);
  assert.equal(b.sceneId, 'sc-unknown');
  assert.equal(b.sceneNumber, null);
  assert.deepEqual(b.characters, []);
  assert.equal(b.cues, null);
});

// ================================================================
// A. coverage() — honesty metrics (without doc)
// ================================================================

test('Memory.coverage: counts scenes/tags/notes/flags and lists orphans; cue fields null without doc', () => {
  const Memory = bootSynthetic();
  const idx = makeIdx({
    scenes: [
      { nodeId: 'sc-1', sceneNumber: 1, hasNotes: true,  hasRevisionFlag: false },
      { nodeId: 'sc-2', sceneNumber: 2, hasNotes: false, hasRevisionFlag: true },
      { nodeId: 'sc-3', sceneNumber: 3, hasNotes: false, hasRevisionFlag: false }
    ],
    tags: {
      character: [{ nodeId: 'e-john', name: 'JOHN', color: null, mentionCount: 1, sceneAppearances: ['sc-1'] }],
      prop:      [
        { nodeId: 'e-knife',  name: 'KNIFE',  color: null, mentionCount: 1, sceneAppearances: ['sc-1'] },
        { nodeId: 'e-orphan', name: 'GHOST',  color: null, mentionCount: 0, sceneAppearances: [] }
      ]
    }
  });
  const c = Memory.coverage(idx);
  assert.equal(c.sceneCount, 3);
  assert.equal(c.scenesWithTags, 1, 'sc-1 is the only scene with any tagged entity');
  assert.equal(c.scenesWithNotes, 1);
  assert.equal(c.scenesWithFlags, 1);
  assert.equal(c.orphanEntities.length, 1);
  assert.deepEqual(c.orphanEntities[0], { tagType: 'prop', entityId: 'e-orphan', name: 'GHOST' });
  // Cue metrics need the doc — null means "not derived", never 0.
  assert.equal(c.cueBlocks, null);
  assert.equal(c.taggedCueBlocks, null);
});

// ================================================================
// A. Non-mutation guarantees
// ================================================================

test('Memory: no function mutates the input idx', () => {
  const Memory = bootSynthetic();
  const idx = makeIdx({
    scenes: [{ nodeId: 'sc-1', sceneNumber: 1, hasNotes: true, hasRevisionFlag: false }],
    characters: [{ nodeId: 'e-john', name: 'JOHN', color: null, cueCount: 1, mentionCount: 2, sceneAppearances: ['sc-1'] }],
    tags: { character: [{ nodeId: 'e-john', name: 'JOHN', color: null, mentionCount: 2, sceneAppearances: ['sc-1'] }] },
    notes: [{ id: 'n1', color: null, text: 'n', status: 'open', sceneNodeId: 'sc-1', sceneNumber: 1, markedText: '' }]
  });
  const before = JSON.stringify(idx, function(k, v) { return v instanceof Map ? null : v; });
  Memory.scene('sc-1', idx);
  Memory.entity('character', 'e-john', idx);
  Memory.entities(idx);
  Memory.coverage(idx);
  const after = JSON.stringify(idx, function(k, v) { return v instanceof Map ? null : v; });
  assert.equal(after, before, 'idx must be byte-identical after all Memory reads');
});

test('Memory: returned bundles are freshly allocated — mutating them does not corrupt later reads', () => {
  const Memory = bootSynthetic();
  const idx = makeIdx({
    tags: { character: [{ nodeId: 'e-john', name: 'JOHN', color: null, mentionCount: 2, sceneAppearances: ['sc-1'] }] }
  });
  const first = Memory.entity('character', 'e-john', idx);
  first.name = 'CORRUPTED';
  first.sceneIds.push('sc-fake');
  const second = Memory.entity('character', 'e-john', idx);
  assert.equal(second.name, 'JOHN');
  assert.deepEqual(second.sceneIds, ['sc-1']);
});

// ================================================================
// A. Defensive edges
// ================================================================

test('Memory: malformed/missing idx returns safe shapes everywhere', () => {
  const Memory = bootSynthetic();
  assert.equal(Memory.scene('sc-1', null).sceneId, 'sc-1');
  assert.equal(Memory.scene(null, null).sceneId, null);
  assert.equal(Memory.entity('character', 'x', undefined), null);
  const all = Memory.entities(null);
  assert.deepEqual(all.characters, []);
  const c = Memory.coverage(null);
  assert.equal(c.sceneCount, 0);
  assert.deepEqual(c.orphanEntities, []);
  assert.equal(Memory.cuesForScene('sc-1', null, null), null);
});

// ================================================================
// B. Fixture ground truth — playground-the-last-light.rga
//    (the audit's findings as executable assertions)
// ================================================================

test('Fixture: entity ent-nali is tagged in scenes 003 and 005 ONLY (not all 5 she appears in)', () => {
  const { Memory, idx } = bootFixture();
  const nali = Memory.entity('character', 'ent-nali', idx);
  assert.ok(nali, 'curated NALI entity exists in the index');
  assert.equal(nali.name, 'NALI');
  assert.deepEqual(nali.sceneIds.slice().sort(), ['scene-003', 'scene-005'],
    'tagged occurrences only — the audit-documented undercount, asserted as it is');
  // Her cues (scene 3) are UNTAGGED → cueCount 0 despite 2 mentions.
  assert.equal(nali.cueCount, 0, 'ent-nali has zero TAGGED cues (scene-3 cues carry no mark)');
  assert.equal(nali.mentionCount, 2);
});

test('Fixture: the duplicate-identity problem — second NALI entity covers scene 002', () => {
  const { Memory, idx } = bootFixture();
  const dupNali = Memory.entity('character', '15201fa6-09cf-4786-a384-3c0bbd973dd8', idx);
  assert.ok(dupNali, 'duplicate NALI entity exists');
  assert.equal(dupNali.name, 'NALI');
  assert.deepEqual(dupNali.sceneIds, ['scene-002']);
  assert.equal(dupNali.cueCount, 1, 'the scene-2 NALI cue is tagged against the DUPLICATE id');
});

test('Fixture: scene-004 has zero tagged characters but FOUR cues, all tier untagged', () => {
  const { Memory, idx, doc } = bootFixture();
  const b = Memory.scene('scene-004', idx, doc);
  assert.deepEqual(b.characters, [], 'no tag marks anywhere in scene 4');
  assert.ok(Array.isArray(b.cues), 'cues derived because doc was supplied');
  assert.equal(b.cues.length, 4);
  assert.deepEqual(b.cues.map(function(c) { return c.text; }), ['BABAN', 'NALI', 'BABAN', 'NALI']);
  assert.ok(b.cues.every(function(c) { return c.tier === 'untagged'; }));
  assert.ok(b.cues.every(function(c) { return c.entityId === null && c.entityName === null; }));
});

test('Fixture: scene-002 cues are tagged — entityId + entityName resolved, blockIndex correct', () => {
  const { Memory, idx, doc } = bootFixture();
  const cues = Memory.cuesForScene('scene-002', idx, doc);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, 'BABAN');
  assert.equal(cues[0].tier, 'tagged');
  assert.equal(cues[0].entityId, '47a05ccf-a967-4d5c-9f65-aa62f2542158');
  assert.equal(cues[0].entityName, 'BABAN');
  assert.equal(cues[0].blockIndex, 2, 'scene 2: heading(0), action(1), character(2)');
  assert.equal(cues[1].text, 'NALI');
  assert.equal(cues[1].tier, 'tagged');
  assert.equal(cues[1].entityId, '15201fa6-09cf-4786-a384-3c0bbd973dd8');
  assert.equal(cues[1].blockIndex, 5);
});

test('Fixture: scene with no cues returns [] (derived-empty), unknown scene returns null (not derivable)', () => {
  const { Memory, idx, doc } = bootFixture();
  assert.deepEqual(Memory.cuesForScene('scene-001', idx, doc), [], 'scene 1 has no character cues');
  assert.equal(Memory.cuesForScene('scene-does-not-exist', idx, doc), null);
  assert.equal(Memory.cuesForScene('scene-002', idx, null), null, 'no doc → not derivable → null');
});

test('Fixture: entities() lists registry orphans — PHOTOGRAPH has zero tagged occurrences', () => {
  const { Memory, idx } = bootFixture();
  const all = Memory.entities(idx);
  const photo = all.props.filter(function(e) { return e.entityId === 'ent-photo'; })[0];
  assert.ok(photo, 'PHOTOGRAPH registry entity appears in the table of contents');
  assert.equal(photo.name, 'PHOTOGRAPH');
  assert.deepEqual(photo.sceneIds, [], 'zero tagged occurrences (the word appears in 3 scenes — untagged, invisible)');
  // The curated BABAN entity is ALSO an orphan (scene 2 used a duplicate id).
  const curatedBaban = all.characters.filter(function(e) { return e.entityId === 'ent-baban'; })[0];
  assert.ok(curatedBaban);
  assert.deepEqual(curatedBaban.sceneIds, []);
});

test('Fixture: coverage() ground truth — 5 scenes, 3 with tags, 5 with notes, 0 flagged, 8 cues / 2 tagged', () => {
  const { Memory, idx, doc } = bootFixture();
  const c = Memory.coverage(idx, doc);
  assert.equal(c.sceneCount, 5);
  assert.equal(c.scenesWithTags, 3, 'scenes 002, 003, 005 carry tag marks');
  assert.equal(c.scenesWithNotes, 5, 'every scene has scene-level attrs.notes');
  assert.equal(c.scenesWithFlags, 0);
  assert.equal(c.cueBlocks, 8, 'total character-cue blocks across the script');
  assert.equal(c.taggedCueBlocks, 2, 'only scene-2 cues are tagged');
  // Orphans include curated-but-never-tagged entities across types.
  const orphanIds = c.orphanEntities.map(function(o) { return o.entityId; });
  assert.ok(orphanIds.indexOf('ent-baban') >= 0, 'curated BABAN is an orphan');
  assert.ok(orphanIds.indexOf('ent-photo') >= 0);
  assert.ok(orphanIds.indexOf('loc-house') >= 0);
  assert.ok(orphanIds.indexOf('veh-car') >= 0);
});

test('Fixture: cue memoisation — repeat calls are equal but freshly allocated (cache cannot be corrupted)', () => {
  const { Memory, idx, doc } = bootFixture();
  const a = Memory.cuesForScene('scene-004', idx, doc);
  const b = Memory.cuesForScene('scene-004', idx, doc);
  assert.deepEqual(a, b, 'memoised result is identical in content');
  assert.notEqual(a, b, 'but each call returns a fresh array (consumers cannot corrupt the cache)');
  a.push({ text: 'FAKE' });
  a[0].text = 'CORRUPTED';
  const c = Memory.cuesForScene('scene-004', idx, doc);
  assert.equal(c.length, 4, 'cache unaffected by consumer mutation');
  assert.equal(c[0].text, 'BABAN');
});

test('Fixture: scene() full-bundle integration — scene-002 has notes (annotation), tagged characters, and cues', () => {
  const { Memory, idx, doc } = bootFixture();
  const b = Memory.scene('scene-002', idx, doc);
  assert.equal(b.sceneNumber, 2);
  // The annotation mark in scene 2 surfaces as a note.
  assert.equal(b.notes.length, 1);
  assert.equal(b.notes[0].text, 'in months not years or days');
  assert.equal(b.notes[0].status, 'resolved');
  // Tagged characters (via the duplicate ids — asserted as reality is).
  const charIds = b.characters.map(function(e) { return e.nodeId; }).sort();
  assert.deepEqual(charIds, ['15201fa6-09cf-4786-a384-3c0bbd973dd8', '47a05ccf-a967-4d5c-9f65-aa62f2542158', 'e578a64f-e6d2-4d69-97ba-1771805b974d'].sort());
  // Cues present and tagged.
  assert.equal(b.cues.length, 2);
  assert.ok(b.cues.every(function(cue) { return cue.tier === 'tagged'; }));
});

test('Fixture: non-mutation holds against the real index too', () => {
  const { Memory, idx, doc } = bootFixture();
  const before = JSON.stringify(idx, function(k, v) { return v instanceof Map ? null : v; });
  Memory.scene('scene-002', idx, doc);
  Memory.entities(idx);
  Memory.coverage(idx, doc);
  Memory.cuesForScene('scene-004', idx, doc);
  const after = JSON.stringify(idx, function(k, v) { return v instanceof Map ? null : v; });
  assert.equal(after, before);
});
