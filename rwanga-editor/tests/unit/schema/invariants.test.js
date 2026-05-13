// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

function buildSchema() {
  return new Schema({
    nodes: {
      doc: { content: 'titleStrip? body' },
      titleStrip: { content: 'text*', attrs: { removable: { default: true } }, toDOM() { return ['div', 0]; } },
      body: { content: 'block*', toDOM() { return ['div', 0]; } },
      paragraph: { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      heading: { content: 'inline*', group: 'block', attrs: { level: { default: 1 } }, toDOM(n) { return ['h' + n.attrs.level, 0]; } },
      quote: { content: 'inline*', group: 'block', toDOM() { return ['blockquote', 0]; } },
      bulletList: { content: 'listItem+', group: 'block', toDOM() { return ['ul', 0]; } },
      orderedList: { content: 'listItem+', group: 'block', attrs: { start: { default: 1 } }, toDOM() { return ['ol', 0]; } },
      listItem: { content: 'paragraph block*', toDOM() { return ['li', 0]; } },
      horizontalRule: { group: 'block', toDOM() { return ['hr']; } },
      pageBreak: { group: 'block', attrs: { manual: { default: true } }, toDOM() { return ['div']; } },
      scene: {
        content: 'sceneLine (action | character | dialogue | parenthetical | transition | shot | inlineFreeText)*',
        group: 'block',
        attrs: { id: { default: null }, number: { default: null }, notes: { default: '' }, revisionFlag: { default: null } },
        toDOM() { return ['div', 0]; }
      },
      sceneLine: { content: 'inline*', group: 'screenplay', attrs: { setting: { default: 'INT' }, location: { default: '' }, time: { default: 'DAY' } }, toDOM() { return ['div', 0]; } },
      action: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      character: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      dialogue: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      parenthetical: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      transition: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      shot: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      inlineFreeText: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      text: { group: 'inline' }
    },
    marks: {}
  });
}

test('invariant 1: scene without sceneLine fails to construct', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('scene', null, [
      s.node('action', null, [s.text('No scene line.')])
    ]);
  }, /Invalid content/);
});

test('invariant 1: scene with sceneLine succeeds', () => {
  const s = buildSchema();
  const scene = s.node('scene', null, [
    s.node('sceneLine', null, [s.text('INT. X')]),
    s.node('action', null, [s.text('Y')])
  ]);
  assert.equal(scene.firstChild.type.name, 'sceneLine');
});

test('invariant 2: action at body top level is rejected', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('body', null, [
      s.node('action', null, [s.text('orphan')])
    ]);
  }, /Invalid content/);
});

test('invariant 2: dialogue at body top level is rejected', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('body', null, [
      s.node('dialogue', null, [s.text('orphan')])
    ]);
  }, /Invalid content/);
});

test('invariant 3: paragraph inside scene is rejected', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('scene', null, [
      s.node('sceneLine', null, [s.text('INT. X')]),
      s.node('paragraph', null, [s.text('orphan')])
    ]);
  }, /Invalid content/);
});

test('invariant 3: heading inside scene is rejected', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('scene', null, [
      s.node('sceneLine', null, [s.text('INT. X')]),
      s.node('heading', null, [s.text('orphan')])
    ]);
  }, /Invalid content/);
});

test('invariant 4: titleStrip after body is rejected', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('doc', null, [
      s.node('body', null, []),
      s.node('titleStrip', null, [s.text('Late title')])
    ]);
  }, /Invalid content/);
});

test('invariant 4: two titleStrips rejected', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('doc', null, [
      s.node('titleStrip', null, [s.text('A')]),
      s.node('titleStrip', null, [s.text('B')]),
      s.node('body', null, [])
    ]);
  }, /Invalid content/);
});
