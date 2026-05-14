// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

function buildSchemaWithMarks() {
  return new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: { content: 'inline*', toDOM() { return ['p', 0]; } },
      text: { group: 'inline' }
    },
    marks: {
      bold: { toDOM() { return ['strong', 0]; } },
      italic: { toDOM() { return ['em', 0]; } },
      underline: { toDOM() { return ['u', 0]; } },
      strikethrough: { toDOM() { return ['s', 0]; } },
      color: { attrs: { value: {} }, toDOM(m) { return ['span', { style: 'color:' + m.attrs.value }, 0]; } },
      highlight: { attrs: { value: {} }, toDOM(m) { return ['span', { style: 'background-color:' + m.attrs.value }, 0]; } },
      fontFamily: { attrs: { value: {} }, toDOM(m) { return ['span', { style: 'font-family:' + m.attrs.value }, 0]; } },
      fontSize: { attrs: { value: {} }, toDOM(m) { return ['span', { style: 'font-size:' + m.attrs.value }, 0]; } },
      link: { attrs: { href: {}, title: { default: null } }, inclusive: false, toDOM(m) { return ['a', { href: m.attrs.href }, 0]; } },
      annotation: { attrs: { id: {}, text: { default: '' }, color: { default: '#FFE08A' }, createdAt: { default: null }, author: { default: null } }, inclusive: false, excludes: 'tag revisionFlag', toDOM() { return ['span', 0]; } },
      tag: { attrs: { tagType: {}, entityId: {} }, inclusive: false, excludes: 'annotation revisionFlag', toDOM() { return ['span', 0]; } },
      revisionFlag: { attrs: { reason: { default: '' }, color: { default: '#F44747' }, createdAt: { default: null }, status: { default: 'open' } }, inclusive: false, excludes: 'annotation tag', toDOM() { return ['span', 0]; } }
    }
  });
}

test('all 12 spec marks exist', () => {
  const s = buildSchemaWithMarks();
  const required = ['bold', 'italic', 'underline', 'strikethrough', 'color', 'highlight', 'fontFamily', 'fontSize', 'link', 'annotation', 'tag', 'revisionFlag'];
  required.forEach(name => assert.ok(s.marks[name], `missing mark: ${name}`));
});

test('annotation mark with id and text', () => {
  const s = buildSchemaWithMarks();
  const m = s.mark('annotation', { id: 'note-1', text: 'A note', color: '#FFE08A' });
  assert.equal(m.attrs.id, 'note-1');
  assert.equal(m.attrs.text, 'A note');
});

test('tag mark with tagType and entityId', () => {
  const s = buildSchemaWithMarks();
  const m = s.mark('tag', { tagType: 'character', entityId: 'ent-sarah' });
  assert.equal(m.attrs.tagType, 'character');
  assert.equal(m.attrs.entityId, 'ent-sarah');
});

test('revisionFlag mark default status is open', () => {
  const s = buildSchemaWithMarks();
  const m = s.mark('revisionFlag', { reason: 'punchier' });
  assert.equal(m.attrs.status, 'open');
});

test('formatting marks (bold) can stack with writer marks', () => {
  const s = buildSchemaWithMarks();
  // bold is a formatting mark and does not exclude writer marks
  const text = s.text('Sarah', [
    s.mark('bold'),
    s.mark('tag', { tagType: 'character', entityId: 'ent-sarah' }),
  ]);
  assert.equal(text.marks.length, 2);
});

test('revisionFlag mark has color attr defaulting to red', () => {
  const s = buildSchemaWithMarks();
  const m = s.mark('revisionFlag', { reason: 'fix this' });
  assert.equal(m.attrs.color, '#F44747');
});
