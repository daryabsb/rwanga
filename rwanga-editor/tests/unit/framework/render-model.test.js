// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 7 — RenderModel builder unit tests.
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
  global.window.RgaProseMirror = { Schema: PMmodel.Schema, PMNode: PMmodel.Node };

  const paths = [
    '../../../renderer/js/framework/base-outer-marks.js',
    '../../../renderer/js/framework/screenplay-normalizer.js',
    '../../../renderer/js/framework/layout-profile.js',
    '../../../renderer/js/framework/pagemap-engine.js',
    '../../../renderer/js/framework/render-model.js',
    '../../../renderer/js/doc-types/screenplay/schema-v3.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const sp = global.window.Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  return {
    Normalizer: global.window.Rga.Normalizer,
    LP: global.window.Rga.LayoutProfile,
    Engine: global.window.Rga.PageMap,
    RM: global.window.Rga.RenderModel,
    schema: sp.buildSchemaV3()
  };
}

function scene(schema, id, opts) {
  opts = opts || {};
  const heading = schema.nodes.sceneHeading.create(
    { setting: opts.setting != null ? opts.setting : 'INT.',
      time:    opts.time    != null ? opts.time    : 'DAY',
      headingStyle: null },
    schema.text(opts.location || 'LOCATION ' + id)
  );
  const action = schema.nodes.action.create(null, schema.text(opts.action || 'Action text.'));
  const transition = schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'));
  return schema.nodes.scene.create(
    { id: id, notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [heading, action, transition]
  );
}

function buildDoc(schema, scenes) {
  const body = schema.nodes.body.create(null, scenes);
  const title = schema.nodes.titleStrip.create({ removable: true });
  return schema.nodes.doc.create(null, [title, body]);
}

function fullPipeline(boot, doc) {
  const { Normalizer, LP, Engine, RM } = boot;
  const profile = LP.compose(null, null);
  const blocks = Normalizer.normalize(doc);
  const pageMap = Engine.build(blocks, profile);
  return RM.build(doc, pageMap, blocks, profile);
}

// ----------------------------------------------------------------
// Shape
// ----------------------------------------------------------------

test('build returns RenderModel with pages + totalPages + layoutProfile', () => {
  const b = boot();
  const d = buildDoc(b.schema, [scene(b.schema, 'a')]);
  const model = fullPipeline(b, d);
  assert.ok(Array.isArray(model.pages));
  assert.equal(model.totalPages, model.pages.length);
  assert.ok(model.layoutProfile, 'layoutProfile passed through');
});

test('one-scene doc → single page with sceneHeading+action+transition blocks', () => {
  const b = boot();
  const d = buildDoc(b.schema, [scene(b.schema, 'a', { location: 'OLD HOUSE' })]);
  const model = fullPipeline(b, d);
  assert.equal(model.totalPages, 1);
  assert.equal(model.pages[0].pageNumber, 1);
  assert.deepEqual(model.pages[0].blocks.map(x => x.type), ['sceneHeading', 'action', 'transition']);
});

// ----------------------------------------------------------------
// Block shape — heading is structured, others carry text
// ----------------------------------------------------------------

test('sceneHeading block carries structured `heading`; no `text` field', () => {
  const b = boot();
  const d = buildDoc(b.schema, [scene(b.schema, 'a', { setting: 'EXT.', time: 'NIGHT', location: 'GARDEN' })]);
  const model = fullPipeline(b, d);
  const heading = model.pages[0].blocks[0];
  assert.equal(heading.type, 'sceneHeading');
  assert.deepEqual(heading.heading, { setting: 'EXT.', location: 'GARDEN', time: 'NIGHT' });
  assert.equal(heading.text, undefined);
});

test('non-heading blocks carry `text`; no `heading` field', () => {
  const b = boot();
  const d = buildDoc(b.schema, [scene(b.schema, 'a', { action: 'She arrives.' })]);
  const model = fullPipeline(b, d);
  const action = model.pages[0].blocks.find(x => x.type === 'action');
  assert.equal(action.text, 'She arrives.');
  assert.equal(action.heading, undefined);
});

// ----------------------------------------------------------------
// Inline runs (text + marks) — for renderer fidelity
// ----------------------------------------------------------------

test('action block carries inlineRuns with text + marks per text fragment', () => {
  const b = boot();
  const bold = b.schema.marks.bold.create();
  const action = b.schema.nodes.action.create(null, [
    b.schema.text('First '),
    b.schema.text('bold-bit', [bold]),
    b.schema.text(' tail.')
  ]);
  const sceneNode = b.schema.nodes.scene.create(
    { id: 's', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [
      b.schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
      action,
      b.schema.nodes.transition.create({ presetType: 'CUT' }, b.schema.text('CUT'))
    ]
  );
  const d = buildDoc(b.schema, [sceneNode]);
  const model = fullPipeline(b, d);
  const actionBlock = model.pages[0].blocks.find(x => x.type === 'action');
  assert.equal(actionBlock.inlineRuns.length, 3);
  assert.equal(actionBlock.inlineRuns[0].text, 'First ');
  assert.deepEqual(actionBlock.inlineRuns[0].marks, []);
  assert.equal(actionBlock.inlineRuns[1].text, 'bold-bit');
  assert.equal(actionBlock.inlineRuns[1].marks[0].type, 'bold');
  assert.equal(actionBlock.inlineRuns[2].text, ' tail.');
});

test('inline marks are serialized as { type, attrs } (no PM bindings exposed)', () => {
  const b = boot();
  const link = b.schema.marks.link.create({ href: 'https://example.com', title: '' });
  const action = b.schema.nodes.action.create(null, [
    b.schema.text('see ', []),
    b.schema.text('here', [link])
  ]);
  const sceneNode = b.schema.nodes.scene.create(
    { id: 's', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
    [
      b.schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
      action,
      b.schema.nodes.transition.create({ presetType: 'CUT' }, b.schema.text('CUT'))
    ]
  );
  const d = buildDoc(b.schema, [sceneNode]);
  const model = fullPipeline(b, d);
  const linkRun = model.pages[0].blocks.find(x => x.type === 'action').inlineRuns[1];
  assert.equal(linkRun.marks[0].type, 'link');
  assert.equal(linkRun.marks[0].attrs.href, 'https://example.com');
});

// ----------------------------------------------------------------
// PageMap → RenderModel page count fidelity
// ----------------------------------------------------------------

test('RenderModel.totalPages === PageMap.length for multi-page input', () => {
  const b = boot();
  const scenes = [];
  for (let i = 0; i < 30; i += 1) scenes.push(scene(b.schema, 'sc-' + i, { action: 'x'.repeat(60 * 4) }));
  const d = buildDoc(b.schema, scenes);
  const model = fullPipeline(b, d);
  assert.ok(model.totalPages >= 2, 'multi-page expected');
  // Each page in model has same pageNumber + block array length as PageMap.
  const { Normalizer, LP, Engine } = b;
  const pageMap = Engine.build(Normalizer.normalize(d), LP.compose(null, null));
  assert.equal(model.totalPages, pageMap.length);
  for (let i = 0; i < model.totalPages; i += 1) {
    assert.equal(model.pages[i].pageNumber, pageMap[i].pageNumber);
    assert.equal(model.pages[i].blocks.length, pageMap[i].blocks.length);
  }
});

// ----------------------------------------------------------------
// Defensive cases
// ----------------------------------------------------------------

test('build with empty pageMap returns empty pages array, totalPages=0', () => {
  const b = boot();
  const d = buildDoc(b.schema, []);
  const model = b.RM.build(d, [], [], b.LP.compose(null, null));
  assert.deepEqual(model.pages, []);
  assert.equal(model.totalPages, 0);
});

test('build with null inputs returns safe-empty RenderModel', () => {
  const b = boot();
  const m = b.RM.build(null, null, null, null);
  assert.equal(m.totalPages, 0);
  assert.deepEqual(m.pages, []);
});

// ----------------------------------------------------------------
// scene context carries through
// ----------------------------------------------------------------

test('block.sceneNodeId + block.sceneNumber preserved from NormalizedBlock', () => {
  const b = boot();
  const d = buildDoc(b.schema, [scene(b.schema, 'sc-1'), scene(b.schema, 'sc-2')]);
  const model = fullPipeline(b, d);
  const blocksOnPage1 = model.pages[0].blocks;
  const first = blocksOnPage1.find(x => x.type === 'sceneHeading');
  assert.equal(first.sceneNodeId, 'sc-1');
  assert.equal(first.sceneNumber, 1);
});
