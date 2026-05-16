// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Tests for Rga.Annotations — addAnnotation event firing, resolve/restore flow.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { Schema } = require('prosemirror-model');
const { EditorState } = require('prosemirror-state');

function bootDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  if (!global.crypto || typeof global.crypto.randomUUID !== 'function') {
    try {
      Object.defineProperty(global, 'crypto', {
        value: { randomUUID: () => 'uuid-' + Math.random().toString(36).slice(2) },
        configurable: true
      });
    } catch (_) { /* already defined as non-writable getter — that's fine */ }
  }
}

function buildSchema() {
  return new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: { content: 'inline*', toDOM() { return ['p', 0]; } },
      text: { group: 'inline' }
    },
    marks: {
      annotation: {
        attrs: {
          id: {},
          text: { default: '' },
          color: { default: '#FFE08A' },
          createdAt: { default: null },
          author: { default: null },
          status: { default: 'open' }
        },
        inclusive: false,
        toDOM() { return ['span', 0]; }
      }
    }
  });
}

function makeView(state) {
  return {
    state: state,
    dispatch(tr) { this.state = this.state.apply(tr); },
    focus() {}
  };
}

function loadAnnotations() {
  delete require.cache[require.resolve('../../renderer/js/doc-types/screenplay/plugins/annotations.js')];
  require('../../renderer/js/doc-types/screenplay/plugins/annotations.js');
  return global.window.Rga.Annotations;
}

function withAnnotation(text, attrs) {
  const schema = buildSchema();
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text(text, [schema.mark('annotation', Object.assign({ id: 'n1' }, attrs))])
    ])
  ]);
  return { schema, state: EditorState.create({ schema, doc }) };
}

test('addAnnotation fires editor.annotationAdded with markedText', () => {
  bootDom();
  const A = loadAnnotations();
  const schema = buildSchema();
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text('hello world')])
  ]);
  let state = EditorState.create({ schema, doc });
  // Selection: characters 1..6 = "hello"
  const PM = require('prosemirror-state');
  state = state.apply(state.tr.setSelection(PM.TextSelection.create(state.doc, 1, 6)));
  const view = makeView(state);

  let received = null;
  document.addEventListener('editor.annotationAdded', function(e) { received = e.detail; });

  A.addAnnotation(view, { id: 'note-x', text: 'first', color: '#FFE08A' });

  assert.ok(received, 'event should fire');
  assert.equal(received.id, 'note-x');
  assert.equal(received.markedText, 'hello');
  assert.equal(received.status, 'open');
});

test('resolveAnnotation flips status to resolved and fires event', () => {
  bootDom();
  const A = loadAnnotations();
  const { schema, state } = withAnnotation('flagged text', {});
  const view = makeView(state);

  let received = null;
  document.addEventListener('editor.annotationResolved', function(e) { received = e.detail; });

  A.resolveAnnotation(view, 'n1');

  const textNode = view.state.doc.firstChild.firstChild;
  const mark = textNode.marks.find(function(m) { return m.type === schema.marks.annotation; });
  assert.ok(mark);
  assert.equal(mark.attrs.status, 'resolved');
  assert.ok(received && received.id === 'n1');
});

test('restoreAnnotation flips status back to open and fires event', () => {
  bootDom();
  const A = loadAnnotations();
  const { schema, state } = withAnnotation('flagged text', { status: 'resolved' });
  const view = makeView(state);

  let received = null;
  document.addEventListener('editor.annotationRestored', function(e) { received = e.detail; });

  A.restoreAnnotation(view, 'n1');

  const textNode = view.state.doc.firstChild.firstChild;
  const mark = textNode.marks.find(function(m) { return m.type === schema.marks.annotation; });
  assert.equal(mark.attrs.status, 'open');
  assert.ok(received && received.id === 'n1');
});

test('resolveAnnotation is a no-op when already resolved', () => {
  bootDom();
  const A = loadAnnotations();
  const { state } = withAnnotation('already resolved', { status: 'resolved' });
  const view = makeView(state);

  let fired = false;
  document.addEventListener('editor.annotationResolved', function() { fired = true; });

  A.resolveAnnotation(view, 'n1');
  assert.equal(fired, false, 'no event when status is unchanged');
});

test('removeAnnotation strips the mark and fires removed event', () => {
  bootDom();
  const A = loadAnnotations();
  const { schema, state } = withAnnotation('to remove', {});
  const view = makeView(state);

  let received = null;
  document.addEventListener('editor.annotationRemoved', function(e) { received = e.detail; });

  A.removeAnnotation(view, 'n1');

  const textNode = view.state.doc.firstChild.firstChild;
  const hasMark = textNode.marks.some(function(m) { return m.type === schema.marks.annotation; });
  assert.equal(hasMark, false);
  assert.ok(received && received.id === 'n1');
});
