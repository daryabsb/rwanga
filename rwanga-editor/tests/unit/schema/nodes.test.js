// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

function buildSchema() {
  return new Schema({
    nodes: {
      doc: { content: 'titleStrip? body' },
      titleStrip: { content: 'text*', attrs: { removable: { default: true } }, toDOM() { return ['div', { class: 'rga-title-strip' }, 0]; } },
      body: { content: 'block*', toDOM() { return ['div', { class: 'rga-body' }, 0]; } },
      paragraph: { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      heading: { content: 'inline*', group: 'block', attrs: { level: { default: 1 } }, toDOM(n) { return ['h' + n.attrs.level, 0]; } },
      quote: { content: 'inline*', group: 'block', toDOM() { return ['blockquote', 0]; } },
      bulletList: { content: 'listItem+', group: 'block', toDOM() { return ['ul', 0]; } },
      orderedList: { content: 'listItem+', group: 'block', attrs: { start: { default: 1 } }, toDOM() { return ['ol', 0]; } },
      listItem: { content: 'paragraph block*', toDOM() { return ['li', 0]; } },
      horizontalRule: { group: 'block', toDOM() { return ['hr']; } },
      pageBreak: { group: 'block', attrs: { manual: { default: true } }, toDOM() { return ['div', { class: 'rga-page-break' }]; } },
      scene: {
        content: 'sceneLine (action | character | dialogue | parenthetical | transition | shot | inlineFreeText)*',
        group: 'block',
        attrs: { id: { default: null }, number: { default: null }, notes: { default: '' }, revisionFlag: { default: null }, headingStyle: { default: null } },
        toDOM() { return ['div', { class: 'rga-scene' }, 0]; }
      },
      sceneLine: { content: 'inline*', group: 'screenplay', attrs: { setting: { default: 'INT.' }, time: { default: 'DAY' } }, toDOM() { return ['div', { class: 'rga-scene-line' }, 0]; } },
      action: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', { class: 'rga-action' }, 0]; } },
      character: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', { class: 'rga-character' }, 0]; } },
      dialogue: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', { class: 'rga-dialogue' }, 0]; } },
      parenthetical: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', { class: 'rga-parenthetical' }, 0]; } },
      transition: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', { class: 'rga-transition' }, 0]; } },
      shot: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', { class: 'rga-shot' }, 0]; } },
      inlineFreeText: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', { class: 'rga-inline-free-text' }, 0]; } },
      text: { group: 'inline' }
    },
    marks: {
      bold: { toDOM() { return ['strong', 0]; } },
      italic: { toDOM() { return ['em', 0]; } }
    }
  });
}

test('schema constructs without errors', () => {
  const s = buildSchema();
  assert.ok(s.nodes.scene);
  assert.ok(s.nodes.sceneLine);
});

test('all 20 spec node types exist', () => {
  const s = buildSchema();
  const required = [
    'doc', 'titleStrip', 'body', 'paragraph', 'heading', 'quote',
    'bulletList', 'orderedList', 'listItem', 'horizontalRule', 'pageBreak',
    'scene', 'sceneLine',
    'action', 'character', 'dialogue', 'parenthetical', 'transition', 'shot', 'inlineFreeText',
    'text'
  ];
  required.forEach(name => assert.ok(s.nodes[name], `missing node: ${name}`));
});

test('can build a valid screenplay doc', () => {
  const s = buildSchema();
  const doc = s.node('doc', null, [
    s.node('body', null, [
      s.node('scene', null, [
        s.node('sceneLine', null, [s.text('INT. CAFÉ — NIGHT')]),
        s.node('action', null, [s.text('Sarah enters.')])
      ])
    ])
  ]);
  assert.equal(doc.firstChild.type.name, 'body');
  assert.equal(doc.firstChild.firstChild.type.name, 'scene');
  assert.equal(doc.firstChild.firstChild.firstChild.type.name, 'sceneLine');
});
