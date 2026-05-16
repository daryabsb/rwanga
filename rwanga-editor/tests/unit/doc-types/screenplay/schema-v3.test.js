// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 1 acceptance tests for the v3 screenplay schema.
// Spec: docs/phase0-final-schema-contract.md (signed 2026-05-16).
//
// Coverage:
//   - schema constructs without errors
//   - every node type the contract requires is present
//   - all 12 marks present and attach to inline content in eligible blocks
//   - scene has ONLY id/notes/revisionFlag/metadata attrs (NO number)
//   - sceneHeading + transition accept inline content (not leaf, not atom)
//   - parenthetical accepts inline content
//   - hand-authored one-scene v3 doc validates
//   - mark exclusion rules apply on the new block types
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
global.window.RgaProseMirror = {
  Schema: require('prosemirror-model').Schema
};
// Load order matters: marks first, then schema-v3.
delete require.cache[require.resolve('../../../../renderer/js/framework/base-outer-marks.js')];
delete require.cache[require.resolve('../../../../renderer/js/doc-types/screenplay/schema-v3.js')];
require('../../../../renderer/js/framework/base-outer-marks.js');
require('../../../../renderer/js/doc-types/screenplay/schema-v3.js');

// Reset cache so each test that wants a fresh schema gets one.
const sp = global.window.Rga.DocTypes.screenplay;
sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
const schema = sp.buildSchemaV3();

// ----------------------------------------------------------------
// Construction
// ----------------------------------------------------------------

test('v3 schema constructs without errors', () => {
  assert.ok(schema, 'schema should be returned');
  assert.equal(typeof schema.nodes, 'object');
  assert.equal(typeof schema.marks, 'object');
});

test('cached factory returns the same instance on second call', () => {
  const a = sp.buildSchemaV3();
  const b = sp.buildSchemaV3();
  assert.equal(a, b);
});

// ----------------------------------------------------------------
// Required node types (per §2 of the contract)
// ----------------------------------------------------------------

test('all required node types present', () => {
  const required = [
    'doc', 'titleStrip', 'body',
    'heading', 'paragraph',
    'scene', 'sceneHeading',
    'action', 'character', 'dialogue', 'parenthetical', 'shot', 'transition',
    'text'
  ];
  required.forEach(function(name) {
    assert.ok(schema.nodes[name], 'missing node type: ' + name);
  });
});

test('legacy sceneFrame is NOT in v3 schema', () => {
  // v3 is a clean schema — no sceneFrame atom.
  assert.equal(schema.nodes.sceneFrame, undefined);
  assert.equal(schema.nodes.sceneLine, undefined);
});

// ----------------------------------------------------------------
// All 12 marks present (per contract §2 marks section)
// ----------------------------------------------------------------

test('all 12 marks present', () => {
  const required = [
    'bold', 'italic', 'underline', 'strikethrough',
    'color', 'highlight', 'fontFamily', 'fontSize',
    'link',
    'annotation', 'tag', 'revisionFlag'
  ];
  required.forEach(function(name) {
    assert.ok(schema.marks[name], 'missing mark: ' + name);
  });
});

// ----------------------------------------------------------------
// scene attrs — only id/notes/revisionFlag/metadata (NO number)
// ----------------------------------------------------------------

test('scene has exactly id, notes, revisionFlag, metadata attrs', () => {
  const sceneSpec = schema.nodes.scene.spec;
  const attrNames = Object.keys(sceneSpec.attrs).sort();
  assert.deepEqual(attrNames, ['id', 'metadata', 'notes', 'revisionFlag']);
});

test('scene must NOT have number attr (derived in v3)', () => {
  const sceneSpec = schema.nodes.scene.spec;
  assert.equal(sceneSpec.attrs.number, undefined,
    'scene.attrs.number is forbidden in v3 — display numbers are derived via NavigationIndex');
});

test('scene default attrs are sensible', () => {
  // Create a scene with required children to satisfy content rule.
  const sceneHeading = schema.nodes.sceneHeading.create();
  const action = schema.nodes.action.create();
  const sceneNode = schema.nodes.scene.create(null, [sceneHeading, action]);
  assert.equal(sceneNode.attrs.id, null);
  assert.equal(sceneNode.attrs.notes, '');
  assert.equal(sceneNode.attrs.revisionFlag, null);
  // metadata defaults to null per the implementation note (object-defaults
  // share refs in PM; helpers populate { linkedScenes, references,
  // production } when creating new scenes).
  assert.equal(sceneNode.attrs.metadata, null);
});

// ----------------------------------------------------------------
// sceneHeading — content-bearing (correction 1)
// ----------------------------------------------------------------

test('sceneHeading is NOT a leaf node (accepts inline content)', () => {
  const heading = schema.nodes.sceneHeading;
  assert.notEqual(heading.spec.content, '',
    'sceneHeading must accept inline content per correction 1');
  // Build a sceneHeading with text content (location).
  const node = heading.create({ setting: 'EXT.', time: 'DAWN' },
                              schema.text('OLD HOUSE — ROSE GARDEN'));
  assert.equal(node.childCount, 1);
  assert.equal(node.firstChild.text, 'OLD HOUSE — ROSE GARDEN');
});

test('sceneHeading has setting/time/headingStyle attrs', () => {
  const attrs = Object.keys(schema.nodes.sceneHeading.spec.attrs).sort();
  assert.deepEqual(attrs, ['headingStyle', 'setting', 'time']);
});

test('sceneHeading does NOT carry location in attrs (per correction 1)', () => {
  const attrs = schema.nodes.sceneHeading.spec.attrs;
  assert.equal(attrs.location, undefined,
    'location lives in content, not attrs (correction 1)');
});

// ----------------------------------------------------------------
// transition — content-bearing, NOT atom (correction 2)
// ----------------------------------------------------------------

test('transition is NOT atom (per correction 2)', () => {
  const trans = schema.nodes.transition;
  assert.notEqual(trans.spec.atom, true,
    'transition must not be atom — free-form content allowed');
});

test('transition accepts inline content (custom transitions like "MATCH CUT TO: BLACK")', () => {
  const transNode = schema.nodes.transition.create(
    { presetType: null },
    schema.text('MATCH CUT TO: BLACK')
  );
  assert.equal(transNode.childCount, 1);
  assert.equal(transNode.firstChild.text, 'MATCH CUT TO: BLACK');
});

test('transition presetType attr defaults to null', () => {
  const trans = schema.nodes.transition.create(null, schema.text('CUT'));
  assert.equal(trans.attrs.presetType, null);
});

test('transition presetType can be set for known presets', () => {
  const trans = schema.nodes.transition.create({ presetType: 'FADE OUT' }, schema.text('FADE OUT'));
  assert.equal(trans.attrs.presetType, 'FADE OUT');
});

// ----------------------------------------------------------------
// parenthetical — accepts inline content
// ----------------------------------------------------------------

test('parenthetical accepts inline content', () => {
  // Per correction 3, the text INCLUDES the parens.
  const p = schema.nodes.parenthetical.create(null, schema.text('(barely a whisper)'));
  assert.equal(p.firstChild.text, '(barely a whisper)');
});

// ----------------------------------------------------------------
// All 12 marks attach to inline content in eligible blocks
// ----------------------------------------------------------------

const INLINE_BLOCKS = [
  'heading', 'paragraph',
  'sceneHeading', 'action', 'character', 'dialogue', 'parenthetical', 'shot', 'transition',
  'titleStrip'
];

INLINE_BLOCKS.forEach(function(blockType) {
  test('block ' + blockType + ' accepts text with bold mark', () => {
    const boldMark = schema.marks.bold.create();
    const text = schema.text('Hello', [boldMark]);
    // Some blocks require specific attrs; provide minimums where needed.
    let attrs = null;
    if (blockType === 'sceneHeading') attrs = { setting: 'INT.', time: 'DAY' };
    if (blockType === 'transition')   attrs = { presetType: null };
    if (blockType === 'heading')      attrs = { level: 2 };
    const node = schema.nodes[blockType].create(attrs, text);
    assert.equal(node.firstChild.marks.length, 1);
    assert.equal(node.firstChild.marks[0].type.name, 'bold');
  });
});

test('tag mark attaches to text in character block (canonical case)', () => {
  const tagMark = schema.marks.tag.create({ tagType: 'character', entityId: 'ent-nali' });
  const text = schema.text('NALI', [tagMark]);
  const charBlock = schema.nodes.character.create(null, text);
  assert.equal(charBlock.firstChild.marks[0].type.name, 'tag');
  assert.equal(charBlock.firstChild.marks[0].attrs.entityId, 'ent-nali');
});

test('annotation mark attaches to text in dialogue block', () => {
  const annot = schema.marks.annotation.create({ id: 'note-1', text: 'thought', color: '#FFE08A' });
  const text = schema.text('Hi.', [annot]);
  const block = schema.nodes.dialogue.create(null, text);
  assert.equal(block.firstChild.marks[0].type.name, 'annotation');
  assert.equal(block.firstChild.marks[0].attrs.id, 'note-1');
});

test('revisionFlag mark attaches to text in action block', () => {
  const flag = schema.marks.revisionFlag.create({ id: 'flag-1', reason: 'rewrite', color: '#F44747' });
  const text = schema.text('action text', [flag]);
  const block = schema.nodes.action.create(null, text);
  assert.equal(block.firstChild.marks[0].type.name, 'revisionFlag');
});

// ----------------------------------------------------------------
// Mark exclusion rules apply on new block types
// ----------------------------------------------------------------

test('annotation excludes tag (same as v2)', () => {
  const annot = schema.marks.annotation;
  assert.equal(annot.excludes(schema.marks.tag), true);
});

test('tag excludes annotation and revisionFlag', () => {
  const tag = schema.marks.tag;
  assert.equal(tag.excludes(schema.marks.annotation), true);
  assert.equal(tag.excludes(schema.marks.revisionFlag), true);
});

test('revisionFlag excludes annotation and tag', () => {
  const flag = schema.marks.revisionFlag;
  assert.equal(flag.excludes(schema.marks.annotation), true);
  assert.equal(flag.excludes(schema.marks.tag), true);
});

test('bold + tag can stack (formatting + writer marks coexist)', () => {
  const bold = schema.marks.bold.create();
  const tag = schema.marks.tag.create({ tagType: 'character', entityId: 'ent-x' });
  const text = schema.text('SARAH', [bold, tag]);
  // Both should be retained — bold doesn't exclude tag and vice versa.
  assert.equal(text.marks.length, 2);
});

// ----------------------------------------------------------------
// Hand-authored one-scene v3 doc validates
// ----------------------------------------------------------------

test('hand-authored one-scene v3 doc validates and round-trips', () => {
  // Build the full document tree manually.
  const titleStrip = schema.nodes.titleStrip.create(
    { removable: true },
    schema.text('The Last Light')
  );
  const heading = schema.nodes.heading.create(
    { level: 2 },
    schema.text('Logline')
  );
  const para = schema.nodes.paragraph.create(
    null,
    schema.text('On the morning of her grandmother\'s death, a young woman returns home.')
  );
  const sceneHeading = schema.nodes.sceneHeading.create(
    { setting: 'EXT.', time: 'DAWN', headingStyle: null },
    schema.text('OLD HOUSE — ROSE GARDEN')
  );
  const action1 = schema.nodes.action.create(
    null,
    schema.text('A beat-up car rolls to a stop at the end of a long gravel drive.')
  );
  const tagMark = schema.marks.tag.create({ tagType: 'character', entityId: 'ent-nali' });
  // Multi-text-node action block (mark in the middle) — mirrors the v2
  // sample's pattern. PM disallows empty text nodes via schema.text(''),
  // so the leading empty fragment from v2 serialization is omitted here.
  const action2 = schema.nodes.action.create(null, [
    schema.text('NALI', [tagMark]),
    schema.text(' (28) steps out, holding a thin coat against the cold.')
  ]);
  const char = schema.nodes.character.create(null, schema.text('NALI'));
  const paren = schema.nodes.parenthetical.create(null, schema.text('(barely a whisper)'));
  const dialogue = schema.nodes.dialogue.create(null, schema.text('I came back.'));
  const trans = schema.nodes.transition.create(
    { presetType: 'CUT' },
    schema.text('CUT')
  );

  const scene = schema.nodes.scene.create(
    {
      id: 'scene-001',
      notes: 'Open quiet. Mist as a character.',
      revisionFlag: null,
      metadata: { linkedScenes: [], references: [], production: {} }
    },
    [sceneHeading, action1, action2, char, paren, dialogue, trans]
  );

  const body = schema.nodes.body.create(null, [heading, para, scene]);
  const doc = schema.nodes.doc.create(null, [titleStrip, body]);

  // Sanity: structure is what we expected.
  assert.equal(doc.firstChild.type.name, 'titleStrip');
  assert.equal(doc.lastChild.type.name, 'body');
  assert.equal(doc.lastChild.lastChild.type.name, 'scene');
  assert.equal(doc.lastChild.lastChild.attrs.id, 'scene-001');
  assert.equal(doc.lastChild.lastChild.attrs.notes, 'Open quiet. Mist as a character.');
  assert.deepEqual(doc.lastChild.lastChild.attrs.metadata,
    { linkedScenes: [], references: [], production: {} });

  // JSON round-trip via PM.
  const json = doc.toJSON();
  const roundTripped = schema.nodeFromJSON(json);
  assert.deepEqual(roundTripped.toJSON(), json);

  // Verify the tagged text mark survives the round trip.
  const actionTextNodes = [];
  roundTripped.descendants(function(node) {
    if (node.isText) actionTextNodes.push(node);
  });
  const naliMarkedText = actionTextNodes.find(function(t) {
    return t.text === 'NALI' && t.marks.some(function(m) { return m.type.name === 'tag'; });
  });
  assert.ok(naliMarkedText, 'tag-marked NALI text survives round trip');
  const naliTag = naliMarkedText.marks.find(function(m) { return m.type.name === 'tag'; });
  assert.equal(naliTag.attrs.tagType, 'character');
  assert.equal(naliTag.attrs.entityId, 'ent-nali');
});

// ----------------------------------------------------------------
// Schema content rules — scene structure enforcement
// ----------------------------------------------------------------

test('scene rejects construction without sceneHeading as first child', () => {
  // scene content rule is 'sceneHeading sceneBody+' — must start with heading.
  // PM's Node.create skips content validation; createChecked enforces it.
  const action = schema.nodes.action.create();
  assert.throws(function() {
    schema.nodes.scene.createChecked(null, [action]); // no heading first
  }, /Invalid content/);
});

test('scene requires at least one sceneBody block', () => {
  const heading = schema.nodes.sceneHeading.create();
  assert.throws(function() {
    schema.nodes.scene.createChecked(null, [heading]); // no body blocks
  }, /Invalid content/);
});

test('scene accepts heading + 1 body block (minimum valid)', () => {
  const heading = schema.nodes.sceneHeading.create();
  const action = schema.nodes.action.create();
  const scene = schema.nodes.scene.create(null, [heading, action]);
  assert.equal(scene.childCount, 2);
});

test('body accepts mixed heading + paragraph + scene siblings', () => {
  const h = schema.nodes.heading.create({ level: 2 }, schema.text('Title'));
  const p = schema.nodes.paragraph.create(null, schema.text('Para.'));
  const heading = schema.nodes.sceneHeading.create();
  const action = schema.nodes.action.create();
  const scene = schema.nodes.scene.create(null, [heading, action]);
  const body = schema.nodes.body.create(null, [h, p, scene]);
  assert.equal(body.childCount, 3);
  assert.equal(body.child(2).type.name, 'scene');
});
