// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

// Minimal schema with the three writer-driven marks
function buildSchema() {
  return new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: { content: 'inline*', toDOM() { return ['p', 0]; } },
      text: { group: 'inline' },
    },
    marks: {
      annotation: {
        attrs: { id: {}, text: { default: '' }, color: { default: '#FFE08A' }, createdAt: { default: null }, author: { default: null } },
        inclusive: false,
        excludes: '',
        toDOM() { return ['span', { class: 'rga-annotation' }, 0]; },
      },
      tag: {
        attrs: { tagType: {}, entityId: {} },
        inclusive: false,
        excludes: '',
        toDOM() { return ['span', { class: 'rga-tag' }, 0]; },
      },
      revisionFlag: {
        attrs: { reason: { default: '' }, createdAt: { default: null }, status: { default: 'open' } },
        inclusive: false,
        excludes: '',
        toDOM() { return ['span', { class: 'rga-revision-flag' }, 0]; },
      },
    },
  });
}

test('all three marks can stack on a single text node', () => {
  const schema = buildSchema();
  const text = schema.text('SARAH', [
    schema.mark('annotation', { id: 'note-1', text: "Make her funnier" }),
    schema.mark('tag', { tagType: 'character', entityId: 'ent-sarah' }),
    schema.mark('revisionFlag', { reason: 'punchier', status: 'open' }),
  ]);
  assert.equal(text.marks.length, 3);
  const types = text.marks.map(function(m) { return m.type.name; }).sort();
  assert.deepEqual(types, ['annotation', 'revisionFlag', 'tag']);
});

test('annotation mark does not exclude tag mark', () => {
  const schema = buildSchema();
  const annotMark = schema.mark('annotation', { id: 'a1' });
  const tagMark = schema.mark('tag', { tagType: 'prop', entityId: 'prop-1' });
  // excludes: '' means marks co-exist
  assert.equal(annotMark.type.excludes(tagMark.type), false);
  assert.equal(tagMark.type.excludes(annotMark.type), false);
});

test('revisionFlag mark does not exclude annotation mark', () => {
  const schema = buildSchema();
  const flagMark = schema.mark('revisionFlag', { reason: 'needs work' });
  const annotMark = schema.mark('annotation', { id: 'a2', text: 'a note' });
  assert.equal(flagMark.type.excludes(annotMark.type), false);
});

test('adding annotation mark via transaction preserves tag mark', () => {
  const { EditorState } = require('prosemirror-state');
  const schema = buildSchema();

  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('SARAH', [schema.mark('tag', { tagType: 'character', entityId: 'ent-sarah' })]),
    ]),
  ]);

  const state = EditorState.create({ schema, doc });

  // Add annotation mark over the same range (positions 1..6)
  const tr = state.tr.addMark(1, 6, schema.mark('annotation', { id: 'n1', text: 'note' }));
  const newState = state.apply(tr);

  // The text node should carry both marks
  const para = newState.doc.firstChild;
  const textNode = para.firstChild;
  assert.equal(textNode.marks.length, 2);
  const names = textNode.marks.map(function(m) { return m.type.name; }).sort();
  assert.deepEqual(names, ['annotation', 'tag']);
});

test('adding revisionFlag mark via transaction preserves existing annotation + tag', () => {
  const { EditorState } = require('prosemirror-state');
  const schema = buildSchema();

  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('SARAH', [
        schema.mark('tag', { tagType: 'character', entityId: 'ent-sarah' }),
        schema.mark('annotation', { id: 'n1', text: 'note' }),
      ]),
    ]),
  ]);

  const state = EditorState.create({ schema, doc });
  const tr = state.tr.addMark(1, 6, schema.mark('revisionFlag', { reason: 'punchier' }));
  const newState = state.apply(tr);

  const textNode = newState.doc.firstChild.firstChild;
  assert.equal(textNode.marks.length, 3);
});

test('removing tag mark leaves annotation and revisionFlag intact', () => {
  const { EditorState } = require('prosemirror-state');
  const schema = buildSchema();

  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('SARAH', [
        schema.mark('tag', { tagType: 'character', entityId: 'ent-sarah' }),
        schema.mark('annotation', { id: 'n1', text: 'note' }),
        schema.mark('revisionFlag', { reason: 'punchier' }),
      ]),
    ]),
  ]);

  const state = EditorState.create({ schema, doc });
  const tr = state.tr.removeMark(1, 6, schema.marks.tag);
  const newState = state.apply(tr);

  const textNode = newState.doc.firstChild.firstChild;
  assert.equal(textNode.marks.length, 2);
  const names = textNode.marks.map(function(m) { return m.type.name; }).sort();
  assert.deepEqual(names, ['annotation', 'revisionFlag']);
});
