// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation SN-Helper-1 — Rga.Screenplay.SceneCatalog unit tests.
// Pure-function tests against a hand-built nav-index shape. No PM, no
// EditorView, no DOM. Covers the brief's five required cases plus
// defensive edges (missing idx, malformed idx, unknown sceneId).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  delete require.cache[require.resolve('../../../../renderer/js/doc-types/screenplay/scene-catalog.js')];
  require('../../../../renderer/js/doc-types/screenplay/scene-catalog.js');
  return global.window.Rga.Screenplay.SceneCatalog;
}

// Build a synthetic NavigationIndex shape matching what
// renderer/js/framework/nav-index.js produces, but assembled directly
// so tests are pure-function and not dependent on a PM doc walk.
function makeIdx(spec) {
  spec = spec || {};
  const tags = {
    character: [], prop: [], wardrobe: [], location: [],
    sfx: [], vfx: [], vehicle: [], animal: [], custom: []
  };
  if (spec.tags) {
    Object.keys(spec.tags).forEach(function(k) {
      tags[k] = spec.tags[k].slice();
    });
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
// API surface
// ----------------------------------------------------------------

test('SN-Helper-1: SceneCatalog.byScene is exposed on Rga.Screenplay', () => {
  const SC = boot();
  assert.ok(SC);
  assert.equal(typeof SC.byScene, 'function');
  // _TAG_KEY_MAP is exposed read-only for tests + future helpers.
  assert.ok(Array.isArray(SC._TAG_KEY_MAP));
  assert.equal(SC._TAG_KEY_MAP.length, 9, 'all 9 screenplay tag types are mapped');
});

// ----------------------------------------------------------------
// 1. Aggregation returns correct scene-level entities
// ----------------------------------------------------------------

test('SN-Helper-1: aggregation returns characters / props / locations filtered by sceneAppearances', () => {
  const SC = boot();
  const idx = makeIdx({
    scenes: [
      { nodeId: 'sc-1', sceneNumber: 1, headingDisplay: 'INT. HOUSE — NIGHT' },
      { nodeId: 'sc-2', sceneNumber: 2, headingDisplay: 'EXT. STREET — DAY' }
    ],
    tags: {
      character: [
        { nodeId: 'e-john',  name: 'JOHN',  color: '#f00', mentionCount: 4, sceneAppearances: ['sc-1', 'sc-2'] },
        { nodeId: 'e-sara',  name: 'SARA',  color: '#0f0', mentionCount: 2, sceneAppearances: ['sc-1'] },
        { nodeId: 'e-paul',  name: 'PAUL',  color: '#00f', mentionCount: 1, sceneAppearances: ['sc-2'] }
      ],
      prop: [
        { nodeId: 'e-knife', name: 'KNIFE', color: '#888', mentionCount: 2, sceneAppearances: ['sc-1'] }
      ],
      location: [
        { nodeId: 'e-house', name: 'HOUSE', color: '#aaa', mentionCount: 5, sceneAppearances: ['sc-1'] }
      ]
    }
  });
  const sc1 = SC.byScene('sc-1', idx);
  // Scene 1: JOHN + SARA in characters, KNIFE in props, HOUSE in locations.
  assert.deepEqual(sc1.characters.map(function(e) { return e.name; }).sort(), ['JOHN', 'SARA']);
  assert.deepEqual(sc1.props.map(function(e) { return e.name; }),     ['KNIFE']);
  assert.deepEqual(sc1.locations.map(function(e) { return e.name; }), ['HOUSE']);
  // Empty tagTypes return [].
  assert.deepEqual(sc1.wardrobe, []);
  assert.deepEqual(sc1.sfx,      []);
  assert.deepEqual(sc1.vehicles, []);
  assert.deepEqual(sc1.animals,  []);
  assert.deepEqual(sc1.custom,   []);
});

// ----------------------------------------------------------------
// 2. Aggregation returns notes + flags when available
// ----------------------------------------------------------------

test('SN-Helper-1: aggregation returns notes and flags filtered by sceneNodeId', () => {
  const SC = boot();
  const idx = makeIdx({
    scenes: [
      { nodeId: 'sc-1', sceneNumber: 1, headingDisplay: 'A' },
      { nodeId: 'sc-2', sceneNumber: 2, headingDisplay: 'B' }
    ],
    notes: [
      { id: 'n-1', color: 'yellow', text: 'check this',   status: 'open',     sceneNodeId: 'sc-1', sceneNumber: 1, markedText: 'KITCHEN' },
      { id: 'n-2', color: null,     text: 'pickup',       status: 'resolved', sceneNodeId: 'sc-1', sceneNumber: 1, markedText: 'counter' },
      { id: 'n-3', color: 'blue',   text: 'over the top', status: 'open',     sceneNodeId: 'sc-2', sceneNumber: 2, markedText: 'STREET' }
    ],
    flags: [
      { id: 'f-1', color: 'pink', reason: 'rewrite', status: 'open', sceneNodeId: 'sc-1', sceneNumber: 1, markedText: 'first beat' }
    ]
  });
  const sc1 = SC.byScene('sc-1', idx);
  assert.equal(sc1.notes.length, 2, 'sc-1 has two inline notes');
  assert.deepEqual(sc1.notes.map(function(n) { return n.id; }).sort(), ['n-1', 'n-2']);
  assert.equal(sc1.notes[0].markedText, 'KITCHEN');
  assert.equal(sc1.notes[1].status, 'resolved');
  assert.equal(sc1.flags.length, 1, 'sc-1 has one revision flag');
  assert.equal(sc1.flags[0].reason, 'rewrite');
});

// ----------------------------------------------------------------
// 3. Empty scene returns stable empty collections
// ----------------------------------------------------------------

test('SN-Helper-1: scene with no entities returns stable empty bundle (arrays not undefined)', () => {
  const SC = boot();
  const idx = makeIdx({
    scenes: [{ nodeId: 'sc-empty', sceneNumber: 5, headingDisplay: 'INT. WHITE ROOM — DAY' }]
  });
  const bundle = SC.byScene('sc-empty', idx);
  // Scalars populated correctly.
  assert.equal(bundle.sceneId,     'sc-empty');
  assert.equal(bundle.sceneNumber, 5);
  assert.equal(bundle.title,       'INT. WHITE ROOM — DAY');
  // Every collection is an empty array (never undefined).
  ['notes', 'flags', 'characters', 'props', 'wardrobe', 'locations',
   'sfx', 'vfx', 'vehicles', 'animals', 'custom'].forEach(function(k) {
    assert.ok(Array.isArray(bundle[k]), k + ' must be an array');
    assert.equal(bundle[k].length, 0, k + ' must be empty for a no-entity scene');
  });
  // pageInfo is always shaped (pageNumber may be null).
  assert.deepEqual(bundle.pageInfo, { pageNumber: null });
});

test('SN-Helper-1: missing sceneNodeId / missing idx returns the empty bundle (no throw)', () => {
  const SC = boot();
  const idx = makeIdx({ scenes: [{ nodeId: 'sc-1', sceneNumber: 1, headingDisplay: 'A' }] });
  // Null sceneNodeId → fully empty bundle (no id to echo).
  const a = SC.byScene(null, idx);
  assert.equal(a.sceneId,     null);
  assert.equal(a.sceneNumber, null);
  assert.equal(a.title,       '');
  assert.deepEqual(a.characters, []);
  // Missing idx with a well-formed sceneNodeId → empty bundle with
  // sceneId echoed (consistent with the "scene-not-in-idx" branch —
  // consumers titling "what's in scene X" can still title honestly
  // even if the lookup failed because the index isn't built yet).
  const b = SC.byScene('sc-1', null);
  assert.equal(b.sceneId,     'sc-1');
  assert.equal(b.sceneNumber, null);
  assert.deepEqual(b.notes,   []);
  assert.deepEqual(b.characters, []);
  // Non-string sceneNodeId → fully empty bundle (no id to echo).
  const c = SC.byScene(42, idx);
  assert.equal(c.sceneId, null);
});

test('SN-Helper-1: well-formed sceneNodeId not in idx echoes sceneId, otherwise empty', () => {
  const SC = boot();
  const idx = makeIdx({ scenes: [{ nodeId: 'sc-1', sceneNumber: 1, headingDisplay: 'A' }] });
  const bundle = SC.byScene('sc-does-not-exist', idx);
  // sceneId is echoed so a consumer titling "what's in scene X" works.
  assert.equal(bundle.sceneId, 'sc-does-not-exist');
  // Everything else is empty/null.
  assert.equal(bundle.sceneNumber, null);
  assert.equal(bundle.title,       '');
  assert.deepEqual(bundle.notes,      []);
  assert.deepEqual(bundle.characters, []);
});

// ----------------------------------------------------------------
// 4. Helper does NOT mutate source structures
// ----------------------------------------------------------------

test('SN-Helper-1: byScene does not mutate the input idx', () => {
  const SC = boot();
  const idx = makeIdx({
    scenes: [{ nodeId: 'sc-1', sceneNumber: 1, headingDisplay: 'INT. HOUSE — NIGHT' }],
    tags: {
      character: [{ nodeId: 'e-john', name: 'JOHN', color: '#f00', mentionCount: 3, sceneAppearances: ['sc-1'] }],
      prop:      [{ nodeId: 'e-knife', name: 'KNIFE', color: '#888', mentionCount: 1, sceneAppearances: ['sc-1'] }]
    },
    notes: [{ id: 'n-1', color: 'yellow', text: 't', status: 'open', sceneNodeId: 'sc-1', sceneNumber: 1, markedText: 'm' }],
    flags: [{ id: 'f-1', color: 'pink',   reason: 'r', status: 'open', sceneNodeId: 'sc-1', sceneNumber: 1, markedText: 'm' }],
    pages: [{ pageNumber: 3, sceneIds: ['sc-1'] }]
  });
  const before = JSON.stringify(idx);
  const bundle = SC.byScene('sc-1', idx);
  // The bundle reports the data correctly.
  assert.equal(bundle.characters.length, 1);
  assert.equal(bundle.notes.length,      1);
  assert.equal(bundle.flags.length,      1);
  // idx is byte-identical to its pre-call serialisation.
  assert.equal(JSON.stringify(idx), before, 'byScene must not mutate the input idx');
});

test('SN-Helper-1: mutating the returned bundle does not reach back into idx', () => {
  const SC = boot();
  const charEntity = { nodeId: 'e-john', name: 'JOHN', color: '#f00', mentionCount: 3, sceneAppearances: ['sc-1'] };
  const noteEntity = { id: 'n-1', color: 'yellow', text: 'original', status: 'open', sceneNodeId: 'sc-1', sceneNumber: 1, markedText: 'm' };
  const idx = makeIdx({
    scenes: [{ nodeId: 'sc-1', sceneNumber: 1, headingDisplay: 'A' }],
    tags:   { character: [charEntity] },
    notes:  [noteEntity]
  });
  const bundle = SC.byScene('sc-1', idx);
  // Mutate the bundle freely.
  bundle.characters[0].name = 'ALTERED';
  bundle.characters[0].sceneAppearances.push('sc-99');
  bundle.notes[0].text = 'ALTERED';
  bundle.notes.push({ id: 'n-rogue', text: 'rogue' });
  // The nav-index storage is untouched.
  assert.equal(charEntity.name, 'JOHN', 'entity name preserved in idx');
  assert.deepEqual(charEntity.sceneAppearances, ['sc-1'], 'entity sceneAppearances preserved in idx');
  assert.equal(noteEntity.text, 'original', 'note text preserved in idx');
  assert.equal(idx.notes.length, 1, 'idx.notes length not affected by bundle push');
});

// ----------------------------------------------------------------
// 5. Multiple scenes isolate data correctly
// ----------------------------------------------------------------

test('SN-Helper-1: byScene isolates per-scene data — different sceneIds return different bundles', () => {
  const SC = boot();
  const idx = makeIdx({
    scenes: [
      { nodeId: 'sc-1', sceneNumber: 1, headingDisplay: 'INT. HOUSE — NIGHT' },
      { nodeId: 'sc-2', sceneNumber: 2, headingDisplay: 'EXT. STREET — DAY' },
      { nodeId: 'sc-3', sceneNumber: 3, headingDisplay: 'INT. CAFÉ — DAY' }
    ],
    tags: {
      character: [
        { nodeId: 'e-john', name: 'JOHN', color: '#f00', mentionCount: 5, sceneAppearances: ['sc-1', 'sc-3'] },
        { nodeId: 'e-sara', name: 'SARA', color: '#0f0', mentionCount: 3, sceneAppearances: ['sc-2'] }
      ],
      prop: [
        { nodeId: 'e-knife', name: 'KNIFE', color: '#888', mentionCount: 1, sceneAppearances: ['sc-1'] },
        { nodeId: 'e-letter', name: 'LETTER', color: '#fc0', mentionCount: 2, sceneAppearances: ['sc-3'] }
      ]
    },
    notes: [
      { id: 'n-1', color: 'y', text: 'in scene 1', status: 'open', sceneNodeId: 'sc-1', sceneNumber: 1, markedText: 'a' },
      { id: 'n-2', color: 'y', text: 'in scene 2', status: 'open', sceneNodeId: 'sc-2', sceneNumber: 2, markedText: 'b' }
    ],
    pages: [
      { pageNumber: 1, sceneIds: ['sc-1', 'sc-2'] },
      { pageNumber: 3, sceneIds: ['sc-3'] }
    ]
  });
  const a = SC.byScene('sc-1', idx);
  const b = SC.byScene('sc-2', idx);
  const c = SC.byScene('sc-3', idx);
  // Scene 1: JOHN + KNIFE + n-1 + p.1
  assert.deepEqual(a.characters.map(function(e) { return e.name; }), ['JOHN']);
  assert.deepEqual(a.props.map(function(e) { return e.name; }),      ['KNIFE']);
  assert.equal(a.notes.length, 1);
  assert.equal(a.notes[0].id,  'n-1');
  assert.equal(a.pageInfo.pageNumber, 1);
  // Scene 2: SARA, no props, n-2, p.1
  assert.deepEqual(b.characters.map(function(e) { return e.name; }), ['SARA']);
  assert.deepEqual(b.props, []);
  assert.equal(b.notes.length, 1);
  assert.equal(b.notes[0].id,  'n-2');
  assert.equal(b.pageInfo.pageNumber, 1);
  // Scene 3: JOHN + LETTER, no notes, p.3
  assert.deepEqual(c.characters.map(function(e) { return e.name; }), ['JOHN']);
  assert.deepEqual(c.props.map(function(e) { return e.name; }),      ['LETTER']);
  assert.deepEqual(c.notes, []);
  assert.equal(c.pageInfo.pageNumber, 3);
});

// ----------------------------------------------------------------
// Defensive: malformed idx
// ----------------------------------------------------------------

test('SN-Helper-1: tolerates idx with missing optional arrays (tags / notes / flags / pages)', () => {
  const SC = boot();
  // idx with ONLY scenes — no tags, no notes, no flags, no pages.
  const idx = { scenes: [{ nodeId: 'sc-1', sceneNumber: 1, headingDisplay: 'A' }] };
  const bundle = SC.byScene('sc-1', idx);
  assert.equal(bundle.sceneId, 'sc-1');
  ['notes', 'flags', 'characters', 'props', 'wardrobe', 'locations',
   'sfx', 'vfx', 'vehicles', 'animals', 'custom'].forEach(function(k) {
    assert.deepEqual(bundle[k], [], k + ' must be empty when source field is missing');
  });
  assert.deepEqual(bundle.pageInfo, { pageNumber: null });
});

test('SN-Helper-1: entity records with no sceneAppearances field are skipped, not crashed on', () => {
  const SC = boot();
  const idx = makeIdx({
    scenes: [{ nodeId: 'sc-1', sceneNumber: 1, headingDisplay: 'A' }],
    tags: {
      character: [
        { nodeId: 'e-broken', name: 'BROKEN', color: null, mentionCount: 0 /* no sceneAppearances */ },
        { nodeId: 'e-good',   name: 'GOOD',   color: null, mentionCount: 1, sceneAppearances: ['sc-1'] }
      ]
    }
  });
  const bundle = SC.byScene('sc-1', idx);
  assert.deepEqual(bundle.characters.map(function(e) { return e.name; }), ['GOOD']);
});

// ----------------------------------------------------------------
// Tag-key mapping matches the screenplay registry's plural / singular split.
// ----------------------------------------------------------------

test('SN-Helper-1: TAG_KEY_MAP mirrors the screenplay registry plural/singular split', () => {
  const SC = boot();
  const expected = [
    ['characters', 'character'],
    ['props',      'prop'],
    ['wardrobe',   'wardrobe'],
    ['locations',  'location'],
    ['sfx',        'sfx'],
    ['vfx',        'vfx'],
    ['vehicles',   'vehicle'],
    ['animals',    'animal'],
    ['custom',     'custom']
  ];
  const got = SC._TAG_KEY_MAP.map(function(m) { return [m.bundleKey, m.tagType]; });
  assert.deepEqual(got, expected);
});
