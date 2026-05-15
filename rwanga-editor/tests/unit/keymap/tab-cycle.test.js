// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSchema, posInNode, stateWithCursorIn, applyCmd, loadKeymap } = require('./helpers');
const { EditorState, TextSelection } = require('prosemirror-state');

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

// ---- Tab (forward cycle) ----

test('Tab: action → character', () => {
  const doc = sceneWithBlock('action');
  const state = stateWithCursorIn(s, doc, 'action');
  const cmd = internals.cycleBlockTypeForward(s);
  const next = applyCmd(state, cmd);
  assert.ok(next, 'command should be handled');
  // The scene's second child should now be character
  const scene = next.doc.firstChild.firstChild;
  assert.equal(scene.child(1).type.name, 'character');
});

test('Tab: character → dialogue', () => {
  const doc = sceneWithBlock('character');
  const state = stateWithCursorIn(s, doc, 'character');
  const cmd = internals.cycleBlockTypeForward(s);
  const next = applyCmd(state, cmd);
  assert.equal(next.doc.firstChild.firstChild.child(1).type.name, 'dialogue');
});

test('Tab: dialogue → action', () => {
  const doc = sceneWithBlock('dialogue');
  const state = stateWithCursorIn(s, doc, 'dialogue');
  const cmd = internals.cycleBlockTypeForward(s);
  const next = applyCmd(state, cmd);
  assert.equal(next.doc.firstChild.firstChild.child(1).type.name, 'action');
});

test('Tab: parenthetical → transition', () => {
  const doc = sceneWithBlock('parenthetical');
  const state = stateWithCursorIn(s, doc, 'parenthetical');
  const cmd = internals.cycleBlockTypeForward(s);
  const next = applyCmd(state, cmd);
  assert.equal(next.doc.firstChild.firstChild.child(1).type.name, 'transition');
});

test('Tab: transition → shot', () => {
  const doc = sceneWithBlock('transition');
  const state = stateWithCursorIn(s, doc, 'transition');
  const cmd = internals.cycleBlockTypeForward(s);
  const next = applyCmd(state, cmd);
  assert.equal(next.doc.firstChild.firstChild.child(1).type.name, 'shot');
});

test('Tab: shot → action', () => {
  const doc = sceneWithBlock('shot');
  const state = stateWithCursorIn(s, doc, 'shot');
  const cmd = internals.cycleBlockTypeForward(s);
  const next = applyCmd(state, cmd);
  assert.equal(next.doc.firstChild.firstChild.child(1).type.name, 'action');
});

test('Tab: sceneLine → no-op (returns false)', () => {
  const doc = sceneWithBlock('action');
  const state = stateWithCursorIn(s, doc, 'sceneLine');
  const cmd = internals.cycleBlockTypeForward(s);
  const handled = cmd(state, () => {});
  assert.equal(handled, false);
});

test('Tab: outside scene → no-op (returns false)', () => {
  const doc = s.node('doc', null, [
    s.node('body', null, [s.node('paragraph', null, [s.text('outside')])])
  ]);
  const state = stateWithCursorIn(s, doc, 'paragraph');
  const cmd = internals.cycleBlockTypeForward(s);
  const handled = cmd(state, () => {});
  assert.equal(handled, false);
});

// ---- Shift-Tab (backward cycle) ----

test('Shift-Tab: character → action', () => {
  const doc = sceneWithBlock('character');
  const state = stateWithCursorIn(s, doc, 'character');
  const cmd = internals.cycleBlockTypeBackward(s);
  const next = applyCmd(state, cmd);
  assert.equal(next.doc.firstChild.firstChild.child(1).type.name, 'action');
});

test('Shift-Tab: dialogue → character', () => {
  const doc = sceneWithBlock('dialogue');
  const state = stateWithCursorIn(s, doc, 'dialogue');
  const cmd = internals.cycleBlockTypeBackward(s);
  const next = applyCmd(state, cmd);
  assert.equal(next.doc.firstChild.firstChild.child(1).type.name, 'character');
});

test('Shift-Tab: transition → parenthetical', () => {
  const doc = sceneWithBlock('transition');
  const state = stateWithCursorIn(s, doc, 'transition');
  const cmd = internals.cycleBlockTypeBackward(s);
  const next = applyCmd(state, cmd);
  assert.equal(next.doc.firstChild.firstChild.child(1).type.name, 'parenthetical');
});

test('Shift-Tab: action (empty) → cursor at end of sceneLine; action deleted', () => {
  const doc = sceneWithBlock('action'); // empty action
  const state = stateWithCursorIn(s, doc, 'action');
  const cmd = internals.cycleBlockTypeBackward(s);
  const next = applyCmd(state, cmd);
  // Scene should now only have sceneLine (empty action was deleted)
  const scene = next.doc.firstChild.firstChild;
  assert.equal(scene.childCount, 1);
  assert.equal(scene.child(0).type.name, 'sceneLine');
  // Cursor should be inside sceneLine
  const $head = next.selection.$head;
  assert.equal($head.parent.type.name, 'sceneLine');
});

test('Shift-Tab: action (with content) → cursor moves to sceneLine; action kept', () => {
  const doc = sceneWithBlock('action', 'Sarah walks in.');
  const state = stateWithCursorIn(s, doc, 'action');
  const cmd = internals.cycleBlockTypeBackward(s);
  const next = applyCmd(state, cmd);
  // Action should still be there (had content)
  const scene = next.doc.firstChild.firstChild;
  assert.equal(scene.childCount, 2);
  assert.equal(scene.child(1).type.name, 'action');
  // Cursor should be inside sceneLine
  const $head = next.selection.$head;
  assert.equal($head.parent.type.name, 'sceneLine');
});

test('Shift-Tab: sceneLine cursor not at start → no-op (returns false)', () => {
  // Cursor placed at END of "INT. X — DAY" content (not start) → no-op
  const locText = s.text('INT. X — DAY');
  const doc = s.node('doc', null, [
    s.node('body', null, [
      s.node('scene', null, [
        s.node('sceneLine', null, [locText]),
        s.node('action')
      ])
    ])
  ]);
  const base = EditorState.create({ schema: s, doc });
  const slPos = posInNode(doc, 'sceneLine');
  const endPos = slPos + locText.nodeSize;
  const state = base.apply(base.tr.setSelection(TextSelection.near(base.doc.resolve(endPos))));
  const cmd = internals.cycleBlockTypeBackward(s);
  const handled = cmd(state, () => {});
  assert.equal(handled, false);
});

test('Tab: sceneLine cursor at end → activates time zone (returns true)', () => {
  const locText = s.text('CAFÉ');
  const doc = s.node('doc', null, [
    s.node('body', null, [
      s.node('scene', null, [
        s.node('sceneLine', null, [locText]),
        s.node('action')
      ])
    ])
  ]);
  const base = EditorState.create({ schema: s, doc });
  const slPos = posInNode(doc, 'sceneLine');
  const endPos = slPos + locText.nodeSize;
  const state = base.apply(base.tr.setSelection(TextSelection.near(base.doc.resolve(endPos))));
  let capturedZone = null;
  const mockView = { nodeDOM() { return { _rgaNodeView: { activateZone(z) { capturedZone = z; } } }; } };
  const cmd = internals.cycleBlockTypeForward(s);
  const handled = cmd(state, () => {}, mockView);
  assert.equal(handled, true);
  assert.equal(capturedZone, 'time');
});

test('Shift-Tab: sceneLine cursor at start → activates setting zone (returns true)', () => {
  // stateWithCursorIn places cursor at pos+1 = offset 0 (start)
  const doc = sceneWithBlock('action');
  const state = stateWithCursorIn(s, doc, 'sceneLine');
  let capturedZone = null;
  const mockView = { nodeDOM() { return { _rgaNodeView: { activateZone(z) { capturedZone = z; } } }; } };
  const cmd = internals.cycleBlockTypeBackward(s);
  const handled = cmd(state, () => {}, mockView);
  assert.equal(handled, true);
  assert.equal(capturedZone, 'setting');
});

test('Tab: sceneLine cursor not at end → no-op (returns false)', () => {
  // Cursor at start of non-empty content — NOT at end → no-op
  const doc = sceneWithBlock('action');
  const state = stateWithCursorIn(s, doc, 'sceneLine');
  const cmd = internals.cycleBlockTypeForward(s);
  const handled = cmd(state, () => {});
  assert.equal(handled, false);
});
