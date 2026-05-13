// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { Schema } = require('prosemirror-model');
const { EditorState } = require('prosemirror-state');
const { EditorView } = require('prosemirror-view');

const minimalSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
    text: { group: 'inline' }
  },
  marks: {
    bold: { toDOM() { return ['strong', 0]; } }
  }
});

test('EditorState creates a document with one empty paragraph by default', () => {
  const state = EditorState.create({
    schema: minimalSchema,
    doc: minimalSchema.node('doc', null, [minimalSchema.node('paragraph')])
  });
  assert.equal(state.doc.childCount, 1);
  assert.equal(state.doc.firstChild.type.name, 'paragraph');
});

test('EditorView renders into a DOM container', () => {
  const dom = new JSDOM('<!DOCTYPE html><div id="host"></div>');
  global.window = dom.window;
  global.document = dom.window.document;

  const container = dom.window.document.getElementById('host');
  const state = EditorState.create({
    schema: minimalSchema,
    doc: minimalSchema.node('doc', null, [minimalSchema.node('paragraph')])
  });
  const view = new EditorView(container, { state });

  assert.ok(container.querySelector('.ProseMirror'), 'editor surface mounted');
  assert.equal(container.querySelectorAll('p').length, 1);

  view.destroy();
});
