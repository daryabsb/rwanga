// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Tests that writer marks (annotation, tag, revisionFlag) are mutually exclusive.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');
const { EditorState } = require('prosemirror-state');

// Schema with the three writer marks configured as mutually exclusive
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
        excludes: 'tag revisionFlag',
        toDOM() { return ['span', { class: 'rga-annotation' }, 0]; },
      },
      tag: {
        attrs: { tagType: {}, entityId: {} },
        inclusive: false,
        excludes: 'annotation revisionFlag',
        toDOM() { return ['span', { class: 'rga-tag' }, 0]; },
      },
      revisionFlag: {
        attrs: { reason: { default: '' }, color: { default: '#F44747' }, createdAt: { default: null }, status: { default: 'open' } },
        inclusive: false,
        excludes: 'annotation tag',
        toDOM() { return ['span', { class: 'rga-revision-flag' }, 0]; },
      },
    },
  });
}

test('annotation mark excludes tag and revisionFlag', () => {
  const schema = buildSchema();
  const annot = schema.marks.annotation;
  assert.equal(annot.excludes(schema.marks.tag), true);
  assert.equal(annot.excludes(schema.marks.revisionFlag), true);
});

test('tag mark excludes annotation and revisionFlag', () => {
  const schema = buildSchema();
  const tag = schema.marks.tag;
  assert.equal(tag.excludes(schema.marks.annotation), true);
  assert.equal(tag.excludes(schema.marks.revisionFlag), true);
});

test('revisionFlag mark excludes annotation and tag', () => {
  const schema = buildSchema();
  const flag = schema.marks.revisionFlag;
  assert.equal(flag.excludes(schema.marks.annotation), true);
  assert.equal(flag.excludes(schema.marks.tag), true);
});

test('adding annotation via transaction removes an existing tag mark', () => {
  const schema = buildSchema();
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('SARAH', [schema.mark('tag', { tagType: 'character', entityId: 'ent-sarah' })]),
    ]),
  ]);

  const state = EditorState.create({ schema, doc });
  const tr = state.tr.addMark(1, 6, schema.mark('annotation', { id: 'n1' }));
  const newState = state.apply(tr);

  const textNode = newState.doc.firstChild.firstChild;
  // Must have only the annotation mark — tag should be gone
  assert.equal(textNode.marks.length, 1);
  assert.equal(textNode.marks[0].type.name, 'annotation');
});

test('adding tag via transaction removes an existing annotation mark', () => {
  const schema = buildSchema();
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('SARAH', [schema.mark('annotation', { id: 'n1' })]),
    ]),
  ]);

  const state = EditorState.create({ schema, doc });
  const tr = state.tr.addMark(1, 6, schema.mark('tag', { tagType: 'character', entityId: 'ent-sarah' }));
  const newState = state.apply(tr);

  const textNode = newState.doc.firstChild.firstChild;
  assert.equal(textNode.marks.length, 1);
  assert.equal(textNode.marks[0].type.name, 'tag');
});

test('adding revisionFlag via transaction removes an existing tag mark', () => {
  const schema = buildSchema();
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('pistol', [schema.mark('tag', { tagType: 'prop', entityId: 'ent-pistol' })]),
    ]),
  ]);

  const state = EditorState.create({ schema, doc });
  const tr = state.tr.addMark(1, 7, schema.mark('revisionFlag', { reason: 'fix this' }));
  const newState = state.apply(tr);

  const textNode = newState.doc.firstChild.firstChild;
  assert.equal(textNode.marks.length, 1);
  assert.equal(textNode.marks[0].type.name, 'revisionFlag');
});

test('revisionFlag has a color attr (default red)', () => {
  const schema = buildSchema();
  const m = schema.mark('revisionFlag', { reason: 'punchier' });
  assert.equal(m.attrs.color, '#F44747');
  assert.equal(m.attrs.status, 'open');
});

test('revisionFlag color can be set to yellow or green', () => {
  const schema = buildSchema();
  const yellow = schema.mark('revisionFlag', { color: '#F5A623' });
  const green  = schema.mark('revisionFlag', { color: '#4EC9B0' });
  assert.equal(yellow.attrs.color, '#F5A623');
  assert.equal(green.attrs.color,  '#4EC9B0');
});
