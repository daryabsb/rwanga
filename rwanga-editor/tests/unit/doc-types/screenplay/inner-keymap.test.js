// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');
const { EditorState, TextSelection } = require('prosemirror-state');

function loadInnerKeymap() {
  const path = require.resolve('../../../../renderer/js/doc-types/screenplay/inner-keymap.js');
  delete require.cache[path];

  const { keymap } = require('prosemirror-keymap');
  const { toggleMark, chainCommands } = require('prosemirror-commands');

  global.window = { Rga: { DocTypes: { screenplay: {} }, Framework: { baseOuterMarks: {} } } };
  global.window.RgaProseMirror = { keymap, toggleMark, chainCommands, Schema, TextSelection };

  require(path);
  return global.window.Rga.DocTypes.screenplay;
}

function buildInnerSchema() {
  return new Schema({
    nodes: {
      doc: { content: 'block+' },
      sceneLine: { content: 'inline*', group: 'block', attrs: { setting: { default: 'INT.' }, time: { default: 'DAY' } }, toDOM() { return ['div', 0]; } },
      action: { content: 'inline*', group: 'block', toDOM() { return ['div', 0]; } },
      character: { content: 'inline*', group: 'block', toDOM() { return ['div', 0]; } },
      dialogue: { content: 'inline*', group: 'block', toDOM() { return ['div', 0]; } },
      parenthetical: { content: 'inline*', group: 'block', toDOM() { return ['div', 0]; } },
      transition: { content: 'inline*', group: 'block', toDOM() { return ['div', 0]; } },
      shot: { content: 'inline*', group: 'block', toDOM() { return ['div', 0]; } },
      inlineFreeText: { content: 'inline*', group: 'block', toDOM() { return ['div', 0]; } },
      text: { group: 'inline' }
    },
    marks: {}
  });
}

function docWith(s, type, otherChildren) {
  const sceneLine = s.node('sceneLine', { setting: 'INT.', time: 'DAY' });
  const block = s.node(type);
  return s.node('doc', null, [sceneLine, block].concat(otherChildren || []));
}

// place cursor at start of the second child (the block we care about)
function stateAt(s, doc, childIndex) {
  // child 0 is sceneLine (nodeSize 2 for empty, content size 0)
  let pos = 0;
  for (let i = 0; i < childIndex; i += 1) {
    pos += doc.child(i).nodeSize;
  }
  // pos is now at the start of child[childIndex]; +1 to enter content
  const $pos = doc.resolve(pos + 1);
  return EditorState.create({ schema: s, doc, selection: TextSelection.near($pos) });
}

function applyTabForward(sp, state) {
  const cmd = sp._innerKeymapInternals.cycleForward(state.schema);
  let next = null;
  cmd(state, (tr) => { next = state.apply(tr); });
  return next;
}

function applyTabBackward(sp, state) {
  const cmd = sp._innerKeymapInternals.cycleBackward(state.schema);
  let next = null;
  cmd(state, (tr) => { next = state.apply(tr); });
  return next;
}

function applyEnter(sp, state) {
  const cmd = sp._innerKeymapInternals.enterBehavior(state.schema);
  let next = null;
  cmd(state, (tr) => { next = state.apply(tr); });
  return next;
}

test('buildInnerKeymap returns a plugin', () => {
  const sp = loadInnerKeymap();
  const plugin = sp.buildInnerKeymap(buildInnerSchema());
  assert.ok(plugin, 'plugin must be returned');
});

test('Tab on action → character', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'action');
  const state = stateAt(s, doc, 1);
  const next = applyTabForward(sp, state);
  assert.ok(next, 'command must dispatch');
  assert.equal(next.doc.child(1).type.name, 'character');
});

test('Tab on character → dialogue', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'character');
  const state = stateAt(s, doc, 1);
  const next = applyTabForward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'dialogue');
});

test('Tab on dialogue → parenthetical', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'dialogue');
  const state = stateAt(s, doc, 1);
  const next = applyTabForward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'parenthetical');
});

test('Tab on parenthetical → transition', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'parenthetical');
  const state = stateAt(s, doc, 1);
  const next = applyTabForward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'transition');
});

test('Tab on transition → shot', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'transition');
  const state = stateAt(s, doc, 1);
  const next = applyTabForward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'shot');
});

test('Tab on shot → inlineFreeText', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'shot');
  const state = stateAt(s, doc, 1);
  const next = applyTabForward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'inlineFreeText');
});

test('Tab on inlineFreeText → action (wraps)', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'inlineFreeText');
  const state = stateAt(s, doc, 1);
  const next = applyTabForward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'action');
});

test('Shift-Tab on character → action', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'character');
  const state = stateAt(s, doc, 1);
  const next = applyTabBackward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'action');
});

test('Shift-Tab on inlineFreeText → shot', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'inlineFreeText');
  const state = stateAt(s, doc, 1);
  const next = applyTabBackward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'shot');
});

test('Enter on action inserts a new action after', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'action');
  const state = stateAt(s, doc, 1);
  const next = applyEnter(sp, state);
  assert.ok(next, 'Enter must dispatch');
  // doc was [sceneLine, action] (2 children) — after Enter we expect [sceneLine, action, action]
  assert.equal(next.doc.childCount, 3);
  assert.equal(next.doc.child(2).type.name, 'action');
  assert.equal(next.selection.$head.parent.type.name, 'action');
});

test('Enter on character inserts a new dialogue after', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'character');
  const state = stateAt(s, doc, 1);
  const next = applyEnter(sp, state);
  assert.equal(next.doc.childCount, 3);
  assert.equal(next.doc.child(2).type.name, 'dialogue');
});

test('Enter on dialogue inserts a new action after', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'dialogue');
  const state = stateAt(s, doc, 1);
  const next = applyEnter(sp, state);
  assert.equal(next.doc.childCount, 3);
  assert.equal(next.doc.child(2).type.name, 'action');
});

test('Enter on parenthetical inserts a new dialogue after', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'parenthetical');
  const state = stateAt(s, doc, 1);
  const next = applyEnter(sp, state);
  assert.equal(next.doc.child(2).type.name, 'dialogue');
});

test('Enter on transition inserts a new action after', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'transition');
  const state = stateAt(s, doc, 1);
  const next = applyEnter(sp, state);
  assert.equal(next.doc.child(2).type.name, 'action');
});

test('Enter on shot inserts a new action after', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'shot');
  const state = stateAt(s, doc, 1);
  const next = applyEnter(sp, state);
  assert.equal(next.doc.child(2).type.name, 'action');
});

test('Enter on inlineFreeText inserts a new inlineFreeText after', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'inlineFreeText');
  const state = stateAt(s, doc, 1);
  const next = applyEnter(sp, state);
  assert.equal(next.doc.child(2).type.name, 'inlineFreeText');
});

test('Shift-Tab on action moves cursor to end of sceneLine (no type change)', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'action');
  const state = stateAt(s, doc, 1);
  const next = applyTabBackward(sp, state);
  assert.ok(next, 'command must dispatch');
  // Block at index 1 is still action (no type change)
  assert.equal(next.doc.child(1).type.name, 'action');
  // Cursor is now inside the sceneLine
  assert.equal(next.selection.$head.parent.type.name, 'sceneLine');
});

test('Enter on sceneLine: existing action present → cursor moves into it', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  // Doc: [sceneLine, action] — cursor in sceneLine
  const doc = s.node('doc', null, [
    s.node('sceneLine', { setting: 'INT.', time: 'DAY' }),
    s.node('action')
  ]);
  const state = stateAt(s, doc, 0);
  const next = applyEnter(sp, state);
  assert.ok(next, 'Enter must dispatch');
  // No new action inserted — still 2 children
  assert.equal(next.doc.childCount, 2);
  // Cursor inside the existing action
  assert.equal(next.selection.$head.parent.type.name, 'action');
});

test('Enter on sceneLine: no action present → creates one and moves cursor', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  // Doc: just [sceneLine] (no action)
  const doc = s.node('doc', null, [
    s.node('sceneLine', { setting: 'INT.', time: 'DAY' })
  ]);
  const state = stateAt(s, doc, 0);
  const next = applyEnter(sp, state);
  assert.ok(next, 'Enter must dispatch');
  // Action inserted — doc now has 2 children
  assert.equal(next.doc.childCount, 2);
  assert.equal(next.doc.child(1).type.name, 'action');
  // Cursor inside the new action
  assert.equal(next.selection.$head.parent.type.name, 'action');
});

test('Shift-Tab on dialogue → character', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'dialogue');
  const state = stateAt(s, doc, 1);
  const next = applyTabBackward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'character');
});

test('Shift-Tab on parenthetical → dialogue', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'parenthetical');
  const state = stateAt(s, doc, 1);
  const next = applyTabBackward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'dialogue');
});

test('Shift-Tab on transition → parenthetical', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'transition');
  const state = stateAt(s, doc, 1);
  const next = applyTabBackward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'parenthetical');
});

test('Shift-Tab on shot → transition', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'shot');
  const state = stateAt(s, doc, 1);
  const next = applyTabBackward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'transition');
});
