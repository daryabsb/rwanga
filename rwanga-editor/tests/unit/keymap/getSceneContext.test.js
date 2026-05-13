// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSchema, stateWithCursorIn, loadKeymap } = require('./helpers');

const internals = loadKeymap();
const { getSceneContext } = internals;
const s = buildSchema();

function docWithScene(blockType) {
  return s.node('doc', null, [
    s.node('body', null, [
      s.node('scene', null, [
        s.node('sceneLine', null, [s.text('INT. CAFÉ — DAY')]),
        s.node(blockType, null, [s.text('Some text')])
      ])
    ])
  ]);
}

test('getSceneContext: cursor in action returns inSide:true and correct types', () => {
  const doc = docWithScene('action');
  const state = stateWithCursorIn(s, doc, 'action');
  const ctx = getSceneContext(state);
  assert.equal(ctx.inSide, true);
  assert.equal(ctx.sceneNode.type.name, 'scene');
  assert.equal(ctx.sceneChildNode.type.name, 'action');
});

test('getSceneContext: cursor in sceneLine returns inSide:true', () => {
  const doc = docWithScene('action');
  const state = stateWithCursorIn(s, doc, 'sceneLine');
  const ctx = getSceneContext(state);
  assert.equal(ctx.inSide, true);
  assert.equal(ctx.sceneChildNode.type.name, 'sceneLine');
});

test('getSceneContext: cursor in paragraph outside scene returns inSide:false', () => {
  const doc = s.node('doc', null, [
    s.node('body', null, [
      s.node('paragraph', null, [s.text('Preamble')])
    ])
  ]);
  const state = stateWithCursorIn(s, doc, 'paragraph');
  const ctx = getSceneContext(state);
  assert.equal(ctx.inSide, false);
});

test('getSceneContext: sceneChildIndex is 0 for sceneLine (first child)', () => {
  const doc = docWithScene('action');
  const state = stateWithCursorIn(s, doc, 'sceneLine');
  const ctx = getSceneContext(state);
  assert.equal(ctx.sceneChildIndex, 0);
});

test('getSceneContext: sceneChildIndex is 1 for action (second child)', () => {
  const doc = docWithScene('action');
  const state = stateWithCursorIn(s, doc, 'action');
  const ctx = getSceneContext(state);
  assert.equal(ctx.sceneChildIndex, 1);
});
