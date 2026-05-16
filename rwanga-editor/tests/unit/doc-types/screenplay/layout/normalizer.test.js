// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('../../../../../renderer/js/doc-types/screenplay/layout/normalizer.js');
const { normalize, _sceneSlugText } = global.window.Rga.DocTypes.screenplay.layout;

function mkScene(setting, time, location, blocks) {
  return {
    type: 'sceneFrame',
    attrs: {
      id: 'scene-' + setting.toLowerCase() + '-' + Date.now() + Math.random(),
      number: 1,
      innerDoc: {
        type: 'doc',
        content: [
          { type: 'sceneLine', attrs: { setting: setting, time: time }, content: location ? [{ type: 'text', text: location }] : [] }
        ].concat(blocks || [])
      }
    }
  };
}

function mkBlock(type, text) {
  return { type: type, content: text ? [{ type: 'text', text: text }] : [] };
}

function mkOuterDoc(content) {
  return {
    type: 'doc',
    content: [{ type: 'body', content: content }]
  };
}

test('empty doc → empty block list', () => {
  assert.deepEqual(normalize({ type: 'doc', content: [] }), []);
});

test('treatment paragraph normalizes to treatmentParagraph block', () => {
  const doc = mkOuterDoc([
    { type: 'paragraph', content: [{ type: 'text', text: 'Hello world.' }] }
  ]);
  const blocks = normalize(doc);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'treatmentParagraph');
  assert.equal(blocks[0].text, 'Hello world.');
});

test('treatment heading normalizes to treatmentHeading', () => {
  const doc = mkOuterDoc([
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Logline' }] }
  ]);
  const blocks = normalize(doc);
  assert.equal(blocks[0].type, 'treatmentHeading');
  assert.equal(blocks[0].text, 'Logline');
});

test('empty paragraph normalizes to blank', () => {
  const doc = mkOuterDoc([{ type: 'paragraph' }]);
  const blocks = normalize(doc);
  assert.equal(blocks[0].type, 'blank');
});

test('scene with slug + 2 action blocks produces 3 blocks', () => {
  const doc = mkOuterDoc([
    mkScene('EXT.', 'DAWN', 'OLD HOUSE', [
      mkBlock('action', 'A beat-up car rolls to a stop.'),
      mkBlock('action', 'She does not move.')
    ])
  ]);
  const blocks = normalize(doc);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, 'sceneHeading');
  assert.equal(blocks[1].type, 'action');
  assert.equal(blocks[2].type, 'action');
});

test('sceneHeading text format: SETTING LOCATION — TIME', () => {
  const doc = mkOuterDoc([
    mkScene('INT.', 'NIGHT', 'BABAN BEDROOM', [])
  ]);
  const blocks = normalize(doc);
  assert.equal(blocks[0].text, 'INT. BABAN BEDROOM — NIGHT');
});

test('sceneHeading without location', () => {
  const doc = mkOuterDoc([mkScene('EXT.', 'DAY', '', [])]);
  const blocks = normalize(doc);
  assert.equal(blocks[0].text, 'EXT. — DAY');
});

test('character + dialogue + parenthetical', () => {
  const doc = mkOuterDoc([
    mkScene('INT.', 'DAY', 'ROOM', [
      mkBlock('character', 'NALI'),
      mkBlock('parenthetical', '(barely a whisper)'),
      mkBlock('dialogue', 'You came.')
    ])
  ]);
  const blocks = normalize(doc);
  assert.deepEqual(blocks.map(b => b.type), [
    'sceneHeading', 'character', 'parenthetical', 'dialogue'
  ]);
});

test('transition normalizes to transition', () => {
  const doc = mkOuterDoc([
    mkScene('INT.', 'DAY', 'X', [
      mkBlock('action', 'A.'),
      mkBlock('transition', 'CUT TO:')
    ])
  ]);
  const blocks = normalize(doc);
  assert.equal(blocks[2].type, 'transition');
});

test('sceneId, sceneIndex, blockIndexInScene populated', () => {
  const doc = mkOuterDoc([
    mkScene('INT.', 'DAY', 'ROOM 1', [mkBlock('action', 'one')]),
    mkScene('EXT.', 'NIGHT', 'STREET', [mkBlock('action', 'two')])
  ]);
  const blocks = normalize(doc);
  // Scene 1: slug + action; Scene 2: slug + action.
  assert.equal(blocks[0].sceneIndex, 0);
  assert.equal(blocks[0].blockIndexInScene, 0);
  assert.equal(blocks[1].sceneIndex, 0);
  assert.equal(blocks[1].blockIndexInScene, 1);
  assert.equal(blocks[2].sceneIndex, 1);
  assert.equal(blocks[3].sceneIndex, 1);
  assert.equal(blocks[3].blockIndexInScene, 1);
});

test('treatment block sceneIndex is null', () => {
  const doc = mkOuterDoc([
    { type: 'paragraph', content: [{ type: 'text', text: 'logline.' }] }
  ]);
  const blocks = normalize(doc);
  assert.equal(blocks[0].sceneIndex, null);
  assert.equal(blocks[0].sceneId, null);
});

test('every block gets a stable id', () => {
  const doc = mkOuterDoc([
    mkScene('INT.', 'DAY', 'X', [
      mkBlock('action', 'a'),
      mkBlock('character', 'b'),
      mkBlock('dialogue', 'c')
    ])
  ]);
  const blocks = normalize(doc);
  const ids = blocks.map(b => b.id);
  assert.equal(new Set(ids).size, blocks.length, 'all ids unique');
  ids.forEach(id => assert.match(id, /^blk_\d{4}$/));
});

test('mixed: treatment + scenes + blank spacer', () => {
  const doc = mkOuterDoc([
    { type: 'paragraph', content: [{ type: 'text', text: 'Logline here.' }] },
    { type: 'paragraph' },                        // blank
    mkScene('INT.', 'DAY', 'BEDROOM', [
      mkBlock('action', 'Karen wakes.')
    ]),
    { type: 'paragraph' },                        // blank
    mkScene('EXT.', 'NIGHT', 'STREET', [
      mkBlock('action', 'Rain.')
    ])
  ]);
  const blocks = normalize(doc);
  // Expected: treatmentParagraph, blank, sceneHeading, action, blank, sceneHeading, action
  assert.deepEqual(blocks.map(b => b.type), [
    'treatmentParagraph', 'blank',
    'sceneHeading', 'action',
    'blank',
    'sceneHeading', 'action'
  ]);
});

test('_sceneSlugText with no time/setting falls back to INT./DAY', () => {
  // Direct unit on the helper.
  assert.equal(_sceneSlugText({ type: 'sceneLine', attrs: {}, content: [{ type: 'text', text: 'foo' }] }), 'INT. foo — DAY');
});
