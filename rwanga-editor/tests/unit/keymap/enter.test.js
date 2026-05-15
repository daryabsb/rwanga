// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSchema, stateWithCursorIn, applyCmd, loadKeymap } = require('./helpers');

const internals = loadKeymap();
const s = buildSchema();

function sceneWithBlock(blockType, content) {
  const children = content ? [s.text(content)] : [];
  return s.node('doc', null, [
    s.node('body', null, [
      s.node('scene', null, [
        s.node('sceneLine', null, [s.text('INT. X — DAY')]),
        s.node(blockType, null, children)
      ])
    ])
  ]);
}

// ---- Enter behavior ----

test('Enter on action with content → new action inserted below', () => {
  const doc = sceneWithBlock('action', 'Sarah walks in.');
  const state = stateWithCursorIn(s, doc, 'action');
  const cmd = internals.enterBehavior(s);
  const next = applyCmd(state, cmd);
  assert.ok(next);
  const scene = next.doc.firstChild.firstChild;
  // scene: sceneLine, action(content), action(new empty)
  assert.equal(scene.childCount, 3);
  assert.equal(scene.child(1).type.name, 'action');
  assert.equal(scene.child(2).type.name, 'action');
  assert.equal(scene.child(2).content.size, 0);
  // Cursor in the new action
  assert.equal(next.selection.$head.parent.type.name, 'action');
});

test('Enter on character → new dialogue below', () => {
  const doc = sceneWithBlock('character', 'AHMED');
  const state = stateWithCursorIn(s, doc, 'character');
  const cmd = internals.enterBehavior(s);
  const next = applyCmd(state, cmd);
  const scene = next.doc.firstChild.firstChild;
  assert.equal(scene.child(2).type.name, 'dialogue');
  assert.equal(next.selection.$head.parent.type.name, 'dialogue');
});

test('Enter on dialogue → new action below', () => {
  const doc = sceneWithBlock('dialogue', 'Hello there.');
  const state = stateWithCursorIn(s, doc, 'dialogue');
  const cmd = internals.enterBehavior(s);
  const next = applyCmd(state, cmd);
  const scene = next.doc.firstChild.firstChild;
  assert.equal(scene.child(2).type.name, 'action');
});

test('Enter on parenthetical → new dialogue below', () => {
  const doc = sceneWithBlock('parenthetical', '(softly)');
  const state = stateWithCursorIn(s, doc, 'parenthetical');
  const cmd = internals.enterBehavior(s);
  const next = applyCmd(state, cmd);
  const scene = next.doc.firstChild.firstChild;
  assert.equal(scene.child(2).type.name, 'dialogue');
});

test('Enter on transition → new action below', () => {
  const doc = sceneWithBlock('transition', 'CUT TO:');
  const state = stateWithCursorIn(s, doc, 'transition');
  const cmd = internals.enterBehavior(s);
  const next = applyCmd(state, cmd);
  const scene = next.doc.firstChild.firstChild;
  assert.equal(scene.child(2).type.name, 'action');
});

test('Enter on shot → new action below', () => {
  const doc = sceneWithBlock('shot', 'CLOSE ON:');
  const state = stateWithCursorIn(s, doc, 'shot');
  const cmd = internals.enterBehavior(s);
  const next = applyCmd(state, cmd);
  const scene = next.doc.firstChild.firstChild;
  assert.equal(scene.child(2).type.name, 'action');
});

test('Enter on sceneLine → new action below sceneLine', () => {
  const doc = sceneWithBlock('action');
  const state = stateWithCursorIn(s, doc, 'sceneLine');
  const cmd = internals.enterBehavior(s);
  const next = applyCmd(state, cmd);
  const scene = next.doc.firstChild.firstChild;
  // Now has: sceneLine, new action, old action
  assert.equal(scene.child(1).type.name, 'action');
  assert.equal(scene.child(1).content.size, 0);
});

test('Enter on empty action → exits scene (inserts paragraph after scene)', () => {
  const doc = sceneWithBlock('action'); // empty action
  const state = stateWithCursorIn(s, doc, 'action');
  const cmd = internals.enterBehavior(s);
  const next = applyCmd(state, cmd);
  // Body should now have scene + paragraph
  const body = next.doc.firstChild;
  assert.equal(body.childCount, 2);
  assert.equal(body.child(1).type.name, 'paragraph');
  // Cursor in the new paragraph
  assert.equal(next.selection.$head.parent.type.name, 'paragraph');
});

test('Enter outside scene → returns false', () => {
  const doc = s.node('doc', null, [
    s.node('body', null, [s.node('paragraph', null, [s.text('outside')])])
  ]);
  const state = stateWithCursorIn(s, doc, 'paragraph');
  const cmd = internals.enterBehavior(s);
  const handled = cmd(state, () => {});
  assert.equal(handled, false);
});

// ---- Esc / exitScene ----

test('Esc in scene → inserts paragraph after scene; cursor in paragraph', () => {
  const doc = sceneWithBlock('action', 'Some content.');
  const state = stateWithCursorIn(s, doc, 'action');
  const cmd = internals.exitScene(s);
  const next = applyCmd(state, cmd);
  const body = next.doc.firstChild;
  assert.equal(body.childCount, 2);
  assert.equal(body.child(0).type.name, 'scene');
  assert.equal(body.child(1).type.name, 'paragraph');
  assert.equal(next.selection.$head.parent.type.name, 'paragraph');
});

test('Esc outside scene → returns false', () => {
  const doc = s.node('doc', null, [
    s.node('body', null, [s.node('paragraph', null, [s.text('out')])])
  ]);
  const state = stateWithCursorIn(s, doc, 'paragraph');
  const cmd = internals.exitScene(s);
  const handled = cmd(state, () => {});
  assert.equal(handled, false);
});

// ---- Ctrl+Enter / newSceneAfterCurrent ----

test('Ctrl+Enter from inside scene → new scene inserted after current; cursor in sceneLine', () => {
  const doc = sceneWithBlock('action', 'Something happens.');
  const state = stateWithCursorIn(s, doc, 'action');
  const cmd = internals.newSceneAfterCurrent(s);
  const next = applyCmd(state, cmd);
  const body = next.doc.firstChild;
  assert.equal(body.childCount, 2);
  assert.equal(body.child(1).type.name, 'scene');
  // New scene has sceneLine + action
  assert.equal(body.child(1).childCount, 2);
  assert.equal(body.child(1).child(0).type.name, 'sceneLine');
  // Cursor in the new sceneLine
  assert.equal(next.selection.$head.parent.type.name, 'sceneLine');
});

test('Ctrl+Enter from paragraph outside scene → new scene after paragraph', () => {
  const doc = s.node('doc', null, [
    s.node('body', null, [
      s.node('paragraph', null, [s.text('Preamble')])
    ])
  ]);
  const state = stateWithCursorIn(s, doc, 'paragraph');
  const cmd = internals.newSceneAfterCurrent(s);
  const next = applyCmd(state, cmd);
  const body = next.doc.firstChild;
  assert.equal(body.childCount, 2);
  assert.equal(body.child(0).type.name, 'paragraph');
  assert.equal(body.child(1).type.name, 'scene');
  assert.equal(next.selection.$head.parent.type.name, 'sceneLine');
});

test('Ctrl+Enter: new sceneLine has empty content (no prefill text) and setting attr', () => {
  const doc = s.node('doc', null, [
    s.node('body', null, [
      s.node('paragraph', null, [s.text('Preamble')])
    ])
  ]);
  const state = stateWithCursorIn(s, doc, 'paragraph');
  const cmd = internals.newSceneAfterCurrent(s);
  const next = applyCmd(state, cmd);
  const sceneLine = next.doc.firstChild.lastChild.child(0);
  assert.equal(sceneLine.type.name, 'sceneLine');
  assert.equal(sceneLine.content.size, 0, 'sceneLine content must be empty — no prefill text');
  assert.ok(sceneLine.attrs.setting, 'sceneLine must have a setting attr');
  assert.ok(sceneLine.attrs.time, 'sceneLine must have a time attr');
});
