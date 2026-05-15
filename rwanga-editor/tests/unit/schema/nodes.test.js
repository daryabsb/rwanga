// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

function buildSchema() {
  return new Schema({
    nodes: {
      doc:        { content: 'titleStrip? body' },
      titleStrip: { content: 'text*', attrs: { removable: { default: true } }, toDOM() { return ['div', { class: 'rga-title-strip' }, 0]; } },
      body:       { content: 'block*', toDOM() { return ['div', { class: 'rga-body' }, 0]; } },
      paragraph:  { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      heading:    { content: 'inline*', group: 'block', attrs: { level: { default: 1 } }, toDOM(n) { return ['h' + n.attrs.level, 0]; } },
      blockquote: { content: 'inline*', group: 'block', toDOM() { return ['blockquote', 0]; } },
      bulletList:  { content: 'listItem+', group: 'block', toDOM() { return ['ul', 0]; } },
      orderedList: { content: 'listItem+', group: 'block', attrs: { start: { default: 1 } }, toDOM() { return ['ol', 0]; } },
      listItem:    { content: 'paragraph block*', toDOM() { return ['li', 0]; } },
      horizontalRule: { group: 'block', toDOM() { return ['hr']; } },
      pageBreak:  { group: 'block', attrs: { manual: { default: true } }, toDOM() { return ['div', { class: 'rga-page-break' }]; } },
      sceneFrame: {
        group: 'block',
        atom: true,
        attrs: {
          id:           { default: null },
          number:       { default: null },
          headingStyle: { default: null },
          innerDoc:     { default: null }
        },
        toDOM(node) {
          return ['div', { class: 'rga-scene-frame', 'data-scene-id': node.attrs.id || '', 'data-scene-number': node.attrs.number == null ? '' : String(node.attrs.number) }];
        }
      },
      text: { group: 'inline' }
    },
    marks: {}
  });
}

test('outer schema constructs without errors', () => {
  const s = buildSchema();
  assert.ok(s.nodes.paragraph);
  assert.ok(s.nodes.sceneFrame);
});

test('sceneFrame can sit as a body block alongside paragraphs', () => {
  const s = buildSchema();
  const frame = s.node('sceneFrame', { id: 's1', number: 1, headingStyle: null, innerDoc: null });
  const doc = s.node('doc', null, [
    s.node('body', null, [
      s.node('paragraph', null, [s.text('hello')]),
      frame,
      s.node('paragraph', null, [s.text('world')])
    ])
  ]);
  assert.equal(doc.firstChild.child(1).type.name, 'sceneFrame');
});
