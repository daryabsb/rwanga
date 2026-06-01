// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 5 tests for the extended NavigationIndex shape (per Phase 0
// contract §6.1 + directive additions: notes, flags). All tests are
// pure-function / plugin-state checks — no DOM, no EditorView.
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

  const paths = [
    '../../../renderer/js/framework/base-outer-marks.js',
    '../../../renderer/js/framework/document-outline.js',
    '../../../renderer/js/framework/slug-resolver.js',
    '../../../renderer/js/framework/nav-index.js',
    '../../../renderer/js/doc-types/screenplay/schema-v3.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const sp = global.window.Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  return {
    Nav:     global.window.Rga.Nav,
    Outline: global.window.Rga.Outline,
    schema:  sp.buildSchemaV3(),
    PM:      global.window.RgaProseMirror
  };
}

// ----------------------------------------------------------------
// Test fixture builders
// ----------------------------------------------------------------
function makeScene(schema, opts) {
  opts = opts || {};
  const headingMarkers = {
    setting: opts.setting || 'INT.',
    time: opts.time || 'DAY',
    headingStyle: null
  };
  const heading = schema.nodes.sceneHeading.create(
    headingMarkers,
    opts.locationText ? schema.text(opts.locationText) : null
  );
  const action = schema.nodes.action.create(null, opts.action ? schema.text(opts.action) : null);
  const transition = opts.transitionText
    ? schema.nodes.transition.create({ presetType: opts.transitionPresetType || null }, schema.text(opts.transitionText))
    : schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'));

  const children = [heading, action];
  if (opts.extraChildren) opts.extraChildren.forEach(function(c) { children.push(c); });
  children.push(transition);

  return schema.nodes.scene.create({
    id: opts.id || null,
    notes: opts.notes || '',
    revisionFlag: opts.revisionFlag != null ? opts.revisionFlag : null,
    metadata: { linkedScenes: [], references: [], production: {} }
  }, children);
}

function makeDoc(schema, scenes) {
  const body = schema.nodes.body.create(null, scenes);
  const title = schema.nodes.titleStrip.create({ removable: true },
    schema.nodes.heading.create(null, schema.text('The Last Light'))
  );
  return schema.nodes.doc.create(null, [title, body]);
}

function textWithMark(schema, markName, attrs, text) {
  const mark = schema.marks[markName].create(attrs);
  return schema.text(text, [mark]);
}

// ----------------------------------------------------------------
// Scene-entry richer fields
// ----------------------------------------------------------------

test('scene entry carries nodeId / sceneNumber / pmPos / pmEndPos / headingDisplay / setting / locationText / time / transitionDisplay / transitionPresetType / blockCount / hasNotes / hasRevisionFlag', () => {
  const { Nav, schema } = boot();
  const scene = makeScene(schema, {
    id: 's-1',
    setting: 'EXT.',
    time: 'NIGHT',
    locationText: 'OLD HOUSE',
    action: 'Alex walks in.',
    transitionText: 'FADE OUT',
    transitionPresetType: 'FADE OUT',
    notes: 'Director: revisit',
    revisionFlag: 'red'
  });
  const doc = makeDoc(schema, [scene]);
  const idx = Nav.buildIndex(doc);
  assert.equal(idx.scenes.length, 1);
  const s = idx.scenes[0];
  assert.equal(s.nodeId, 's-1');
  assert.equal(s.sceneNumber, 1);
  assert.equal(typeof s.pmPos, 'number');
  assert.equal(typeof s.pmEndPos, 'number');
  assert.ok(s.pmEndPos > s.pmPos);
  assert.equal(s.setting, 'EXT.');
  assert.equal(s.time, 'NIGHT');
  assert.equal(s.locationText, 'OLD HOUSE');
  assert.equal(s.headingDisplay, 'EXT. OLD HOUSE — NIGHT');
  assert.equal(s.transitionDisplay, 'FADE OUT');
  assert.equal(s.transitionPresetType, 'FADE OUT');
  assert.equal(s.blockCount, 1, 'one action block between heading + transition');
  assert.equal(s.hasNotes, true);
  assert.equal(s.hasRevisionFlag, true);
});

test('scene without notes / revisionFlag reports hasNotes=false hasRevisionFlag=false', () => {
  const { Nav, schema } = boot();
  const idx = Nav.buildIndex(makeDoc(schema, [makeScene(schema, { id: 'plain', locationText: 'A' })]));
  assert.equal(idx.scenes[0].hasNotes, false);
  assert.equal(idx.scenes[0].hasRevisionFlag, false);
});

// ----------------------------------------------------------------
// Notes (annotation marks) collection
// ----------------------------------------------------------------

test('index.notes collects annotation marks with id/color/text/status/sceneNodeId/sceneNumber/markedText', () => {
  const { Nav, schema } = boot();
  const action = schema.nodes.action.create(null, [
    schema.text('Before '),
    textWithMark(schema, 'annotation', { id: 'note-1', color: '#ff0', text: 'check this', status: 'open' }, 'highlighted'),
    schema.text(' after.')
  ]);
  const scene = schema.nodes.scene.create(
    { id: 'sc', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [
      schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
      action,
      schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'))
    ]
  );
  const idx = Nav.buildIndex(makeDoc(schema, [scene]));
  assert.equal(idx.notes.length, 1);
  const n = idx.notes[0];
  assert.equal(n.id, 'note-1');
  assert.equal(n.color, '#ff0');
  assert.equal(n.text, 'check this');
  assert.equal(n.status, 'open');
  assert.equal(n.sceneNodeId, 'sc');
  assert.equal(n.sceneNumber, 1);
  assert.equal(n.markedText, 'highlighted');
  // Scene now flagged as hasNotes (via the annotation mark even though
  // scene.attrs.notes string is empty).
  assert.equal(idx.scenes[0].hasNotes, true);
});

test('multi-fragment annotation deduplicates by id (one entry per annotation)', () => {
  const { Nav, schema } = boot();
  const mark = schema.marks.annotation.create({ id: 'note-x', color: '#000', text: '', status: 'open' });
  const action = schema.nodes.action.create(null, [
    schema.text('First ', [mark]),
    schema.text('second ', [mark]),
    schema.text('third', [mark])
  ]);
  const scene = schema.nodes.scene.create(
    { id: 'sc', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [
      schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
      action,
      schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'))
    ]
  );
  const idx = Nav.buildIndex(makeDoc(schema, [scene]));
  assert.equal(idx.notes.length, 1);
});

// ----------------------------------------------------------------
// Flags (revisionFlag marks) collection
// ----------------------------------------------------------------

test('index.flags collects revisionFlag marks with id/color/reason/status/sceneNodeId/markedText', () => {
  const { Nav, schema } = boot();
  const action = schema.nodes.action.create(null, [
    textWithMark(schema, 'revisionFlag', { id: 'flag-1', color: '#f00', reason: 'rewrite', status: 'open' }, 'rough draft')
  ]);
  const scene = schema.nodes.scene.create(
    { id: 'sc-fl', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [
      schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
      action,
      schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'))
    ]
  );
  const idx = Nav.buildIndex(makeDoc(schema, [scene]));
  assert.equal(idx.flags.length, 1);
  const f = idx.flags[0];
  assert.equal(f.id, 'flag-1');
  assert.equal(f.color, '#f00');
  assert.equal(f.reason, 'rewrite');
  assert.equal(f.status, 'open');
  assert.equal(f.markedText, 'rough draft');
  assert.equal(f.sceneNodeId, 'sc-fl');
  assert.equal(idx.scenes[0].hasRevisionFlag, true);
});

// ----------------------------------------------------------------
// Characters + tags collection (with + without registry)
// ----------------------------------------------------------------

test('index.characters + index.tags collect from tag marks (no registry → name/color null)', () => {
  const { Nav, schema } = boot();
  const characterBlock = schema.nodes.character.create(null,
    textWithMark(schema, 'tag', { tagType: 'character', entityId: 'ent-nali' }, 'NALI')
  );
  const dialogue = schema.nodes.dialogue.create(null, [
    schema.text('Hi '),
    textWithMark(schema, 'tag', { tagType: 'character', entityId: 'ent-nali' }, 'me'),
    schema.text('.')
  ]);
  const scene = schema.nodes.scene.create(
    { id: 'sc', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [
      schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
      characterBlock,
      dialogue,
      schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'))
    ]
  );
  const idx = Nav.buildIndex(makeDoc(schema, [scene]));
  assert.equal(idx.characters.length, 1);
  const c = idx.characters[0];
  assert.equal(c.nodeId, 'ent-nali');
  assert.equal(c.name, null);
  assert.equal(c.color, null);
  assert.equal(c.cueCount, 1);
  assert.equal(c.mentionCount, 2, 'one tag inside character cue + one tag in dialogue');
  assert.deepEqual(c.sceneAppearances, ['sc']);
  assert.equal(idx.tags.character.length, 1);
});

test('index resolves name/color from tagRegistry when supplied', () => {
  const { Nav, schema } = boot();
  const characterBlock = schema.nodes.character.create(null,
    textWithMark(schema, 'tag', { tagType: 'character', entityId: 'ent-nali' }, 'NALI')
  );
  const scene = schema.nodes.scene.create(
    { id: 'sc', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [
      schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
      characterBlock,
      schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'))
    ]
  );
  const registry = { characters: [{ id: 'ent-nali', name: 'NALI', color: '#4FC1FF' }] };
  const idx = Nav.buildIndex(makeDoc(schema, [scene]), { tagRegistry: registry });
  assert.equal(idx.characters[0].name, 'NALI');
  assert.equal(idx.characters[0].color, '#4FC1FF');
});

test('registry entries with no tag-mark usage still appear in index.tags (mentionCount=0)', () => {
  const { Nav, schema } = boot();
  const idx = Nav.buildIndex(makeDoc(schema, [makeScene(schema, { id: 'sc' })]),
    { tagRegistry: { props: [{ id: 'p1', name: 'Lantern', color: '#fff' }] } }
  );
  assert.equal(idx.tags.prop.length, 1);
  assert.equal(idx.tags.prop[0].name, 'Lantern');
  assert.equal(idx.tags.prop[0].mentionCount, 0);
  assert.deepEqual(idx.tags.prop[0].sceneAppearances, []);
});

// ----------------------------------------------------------------
// pages — placeholder, populated by Phase 6
// ----------------------------------------------------------------
test('index.pages is empty (populated by Phase 6 pagination)', () => {
  const { Nav, schema } = boot();
  const idx = Nav.buildIndex(makeDoc(schema, [makeScene(schema, { id: 'a' })]));
  assert.ok(Array.isArray(idx.pages));
  assert.equal(idx.pages.length, 0);
});

// ----------------------------------------------------------------
// findScene resolver
// ----------------------------------------------------------------
test('findScene resolves stable nodeId to ephemeral pmPos', () => {
  const { Nav, schema } = boot();
  const doc = makeDoc(schema, [makeScene(schema, { id: 'a' }), makeScene(schema, { id: 'b' })]);
  const idx = Nav.buildIndex(doc);
  const aPos = Nav.findScene(doc, 'a');
  const bPos = Nav.findScene(doc, 'b');
  assert.equal(aPos, idx.scenes[0].pmPos);
  assert.equal(bPos, idx.scenes[1].pmPos);
  assert.equal(Nav.findScene(doc, 'missing'), null);
});

// ----------------------------------------------------------------
// DocumentOutline
// ----------------------------------------------------------------
test('Outline.build returns title + screenplayProfile + scenes summary + statistics', () => {
  const { Outline, schema } = boot();
  const scene1 = makeScene(schema, {
    id: 's1', locationText: 'ROSE GARDEN', action: 'Alex picks a rose. He smiles.'
  });
  const scene2 = makeScene(schema, {
    id: 's2', locationText: 'KITCHEN', action: 'He puts the rose in a vase.'
  });
  const doc = makeDoc(schema, [scene1, scene2]);
  const out = Outline.build(doc, { screenplayProfile: { language: 'en', direction: 'ltr', screenplayConvention: 'hollywood' } });
  assert.equal(out.title, 'The Last Light');
  assert.deepEqual(out.screenplayProfile, { language: 'en', direction: 'ltr', screenplayConvention: 'hollywood' });
  assert.equal(out.scenes.length, 2);
  assert.equal(out.scenes[0].nodeId, 's1');
  assert.equal(out.scenes[0].sceneNumber, 1);
  assert.ok(/ROSE GARDEN/.test(out.scenes[0].headingDisplay));
  assert.match(out.scenes[0].summary, /Alex picks a rose/);
  assert.equal(out.statistics.sceneCount, 2);
  assert.ok(out.statistics.words > 0);
  assert.ok(out.statistics.actionWords > 0);
});

test('Outline.statistics counts dialogue/action words separately', () => {
  const { Outline, schema } = boot();
  const scene = schema.nodes.scene.create(
    { id: 'sc', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [
      schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
      schema.nodes.action.create(null, schema.text('One two three.')),     // 3 action words
      schema.nodes.character.create(null, schema.text('ALEX')),
      schema.nodes.dialogue.create(null, schema.text('Hello there friend.')), // 3 dialogue words
      schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'))
    ]
  );
  const out = Outline.build(makeDoc(schema, [scene]));
  assert.equal(out.statistics.actionWords, 3);
  assert.equal(out.statistics.dialogueWords, 3);
});

test('Outline.scenes summary truncates at 120 chars with ellipsis', () => {
  const { Outline, schema } = boot();
  const longText = 'A'.repeat(200);
  const scene = makeScene(schema, { id: 'sc', action: longText });
  const out = Outline.build(makeDoc(schema, [scene]));
  assert.ok(out.scenes[0].summary.length <= 120);
  assert.match(out.scenes[0].summary, /…$/);
});

test('Outline.characters list = entityNodeId + name + appearances count', () => {
  const { Outline, schema } = boot();
  const characterBlock = schema.nodes.character.create(null,
    textWithMark(schema, 'tag', { tagType: 'character', entityId: 'nali' }, 'NALI')
  );
  const scene1 = schema.nodes.scene.create(
    { id: 'sc1', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [
      schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
      characterBlock,
      schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'))
    ]
  );
  const scene2 = makeScene(schema, { id: 'sc2' });
  const registry = { characters: [{ id: 'nali', name: 'NALI', color: '#fff' }] };
  const out = Outline.build(makeDoc(schema, [scene1, scene2]), { tagRegistry: registry });
  assert.equal(out.characters.length, 1);
  assert.equal(out.characters[0].nodeId, 'nali');
  assert.equal(out.characters[0].name, 'NALI');
  assert.equal(out.characters[0].appearances, 1);
});

// ----------------------------------------------------------------
// Plugin maintains both index AND outline in state
// ----------------------------------------------------------------
test('plugin state contains both index AND outline; both refresh on docChanged', () => {
  const { Nav, schema, PM } = boot();
  const plugin = Nav.buildIndexPlugin();
  const doc0 = makeDoc(schema, [makeScene(schema, { id: 'a' })]);
  const state0 = PM.EditorState.create({ schema: schema, doc: doc0, plugins: [plugin] });

  const idx0 = Nav.getIndex(state0);
  const out0 = Nav.getOutline(state0);
  assert.equal(idx0.scenes.length, 1);
  assert.equal(out0.scenes.length, 1);
  assert.equal(out0.statistics.sceneCount, 1);

  // Insert a second scene; both should refresh.
  const titleSize = state0.doc.child(0).nodeSize;
  const bodyStart = titleSize + 1;
  const tr = state0.tr.insert(bodyStart, makeScene(schema, { id: 'b' }));
  const state1 = state0.apply(tr);
  const idx1 = Nav.getIndex(state1);
  const out1 = Nav.getOutline(state1);
  assert.equal(idx1.scenes.length, 2);
  assert.equal(out1.scenes.length, 2);
  assert.equal(out1.statistics.sceneCount, 2);
});
