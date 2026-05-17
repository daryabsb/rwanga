// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 5 — 100-scene scale gate.
// Builds a 100-scene v3 doc with annotation / tag / revisionFlag marks
// scattered through, runs buildIndex + Outline.build, asserts:
//   - all scenes / marks counted correctly
//   - end-to-end pure-function index build under a budget so the doc-state
//     pipeline stays responsive at scale
// No EditorView. Pure JSON → walk → index/outline.
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
    '../../../renderer/js/framework/nav-index.js',
    '../../../renderer/js/doc-types/screenplay/schema-v3.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const sp = global.window.Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  return {
    Nav:     global.window.Rga.Nav,
    Outline: global.window.Rga.Outline,
    schema:  sp.buildSchemaV3()
  };
}

function makeScene100(schema, i) {
  const setting = i % 2 === 0 ? 'INT.' : 'EXT.';
  const time = i % 3 === 0 ? 'NIGHT' : 'DAY';
  const heading = schema.nodes.sceneHeading.create(
    { setting: setting, time: time, headingStyle: null },
    schema.text('LOCATION ' + i)
  );

  // Inline mark builder helpers.
  function withTag(text, entityId) {
    return schema.text(text, [schema.marks.tag.create({ tagType: 'character', entityId: entityId })]);
  }
  function withAnnotation(text, id) {
    return schema.text(text, [schema.marks.annotation.create({
      id: id, color: '#FFE08A', text: 'note ' + id, status: 'open',
      createdAt: '2026-01-01', author: null
    })]);
  }
  function withFlag(text, id) {
    return schema.text(text, [schema.marks.revisionFlag.create({
      id: id, color: '#f00', reason: 'fix', status: 'open', createdAt: '2026-01-01'
    })]);
  }

  // Every 5th scene gets an annotation on its action text.
  // Every 7th scene gets a revisionFlag.
  // Every scene gets a character cue (NALI vs ALEX alternating).
  const actionContent = [schema.text('Scene ' + i + ' action. ')];
  if (i % 5 === 0) actionContent.push(withAnnotation('important', 'note-' + i));
  else             actionContent.push(schema.text('important'));
  actionContent.push(schema.text(' content '));
  if (i % 7 === 0) actionContent.push(withFlag('rewrite this', 'flag-' + i));
  else             actionContent.push(schema.text('passable'));
  actionContent.push(schema.text('.'));
  const action = schema.nodes.action.create(null, actionContent);

  const characterText = i % 2 === 0 ? 'NALI' : 'ALEX';
  const entityId = i % 2 === 0 ? 'ent-nali' : 'ent-alex';
  const character = schema.nodes.character.create(null, withTag(characterText, entityId));
  const dialogue = schema.nodes.dialogue.create(null, schema.text('Some dialogue ' + i + '.'));

  const transition = schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'));

  return schema.nodes.scene.create(
    { id: 'sc-' + i, notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [heading, action, character, dialogue, transition]
  );
}

function build100SceneDoc(schema) {
  const scenes = [];
  for (let i = 1; i <= 100; i += 1) scenes.push(makeScene100(schema, i));
  const body = schema.nodes.body.create(null, scenes);
  const title = schema.nodes.titleStrip.create({ removable: true },
    schema.nodes.heading.create(null, schema.text('100-Scene Stress'))
  );
  return schema.nodes.doc.create(null, [title, body]);
}

// ----------------------------------------------------------------
// Correctness
// ----------------------------------------------------------------

test('100-scene fixture: NavigationIndex carries 100 scenes + correct mark counts', () => {
  const { Nav, schema } = boot();
  const doc = build100SceneDoc(schema);
  const idx = Nav.buildIndex(doc, {
    tagRegistry: { characters: [
      { id: 'ent-nali', name: 'NALI', color: '#4FC1FF' },
      { id: 'ent-alex', name: 'ALEX', color: '#FFB86C' }
    ]}
  });
  assert.equal(idx.scenes.length, 100);
  assert.equal(idx.scenes[0].sceneNumber, 1);
  assert.equal(idx.scenes[99].sceneNumber, 100);
  // Notes: every 5th scene of 100 → 20 annotations.
  assert.equal(idx.notes.length, 20);
  // Flags: every 7th of 100 → floor(100/7) = 14 flags.
  assert.equal(idx.flags.length, 14);
  // Two characters in registry. Both have cueCount = 50.
  assert.equal(idx.characters.length, 2);
  const nali = idx.characters.find(function(c) { return c.nodeId === 'ent-nali'; });
  const alex = idx.characters.find(function(c) { return c.nodeId === 'ent-alex'; });
  assert.equal(nali.cueCount, 50);
  assert.equal(alex.cueCount, 50);
  assert.equal(nali.name, 'NALI');
});

test('100-scene fixture: DocumentOutline statistics + characters', () => {
  const { Outline, schema } = boot();
  const doc = build100SceneDoc(schema);
  const out = Outline.build(doc, {
    tagRegistry: { characters: [
      { id: 'ent-nali', name: 'NALI', color: '#4FC1FF' },
      { id: 'ent-alex', name: 'ALEX', color: '#FFB86C' }
    ]}
  });
  assert.equal(out.statistics.sceneCount, 100);
  assert.equal(out.scenes.length, 100);
  assert.equal(out.characters.length, 2);
  // Each character appears in 50 scenes.
  out.characters.forEach(function(c) { assert.equal(c.appearances, 50); });
  assert.ok(out.statistics.words > 0);
  assert.ok(out.statistics.actionWords > 0);
  assert.ok(out.statistics.dialogueWords > 0);
});

// ----------------------------------------------------------------
// Performance budget
// ----------------------------------------------------------------

test('100-scene fixture: buildIndex completes well under 200ms (responsiveness gate)', () => {
  const { Nav, schema } = boot();
  const doc = build100SceneDoc(schema);
  // Warm the schema / decoration paths.
  Nav.buildIndex(doc);
  const start = Date.now();
  // Run several times and take the median to absorb GC jitter.
  const samples = [];
  for (let i = 0; i < 5; i += 1) {
    const t0 = Date.now();
    Nav.buildIndex(doc);
    samples.push(Date.now() - t0);
  }
  samples.sort(function(a, b) { return a - b; });
  const median = samples[Math.floor(samples.length / 2)];
  const total = Date.now() - start;
  // Loose budget — at 100 scenes a pure-JS walk should be tens of ms.
  // We only fail if it crosses 200ms (≈ a third of a typing frame budget).
  assert.ok(median < 200, 'median buildIndex was ' + median + 'ms (samples ' + samples.join(',') + ', total ' + total + 'ms)');
});

test('100-scene fixture: Outline.build completes under 400ms', () => {
  const { Outline, schema } = boot();
  const doc = build100SceneDoc(schema);
  // Outline internally calls buildIndex once and adds a stats walk + per-scene summary.
  Outline.build(doc);
  const samples = [];
  for (let i = 0; i < 5; i += 1) {
    const t0 = Date.now();
    Outline.build(doc);
    samples.push(Date.now() - t0);
  }
  samples.sort(function(a, b) { return a - b; });
  const median = samples[Math.floor(samples.length / 2)];
  assert.ok(median < 400, 'median Outline.build was ' + median + 'ms (samples ' + samples.join(',') + ')');
});
