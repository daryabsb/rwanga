// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Tests for Phase 5 widget-menu insert commands.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');
const { EditorState, TextSelection } = require('prosemirror-state');

// ---------------------------------------------------------------
// Screenplay schema (subset sufficient for insert-command tests)
// ---------------------------------------------------------------
function buildSchema() {
  return new Schema({
    nodes: {
      doc:          { content: 'titleStrip? body' },
      titleStrip:   { content: 'text*', attrs: { removable: { default: true } }, toDOM() { return ['div', 0]; } },
      body:         { content: 'block*', toDOM() { return ['div', 0]; } },
      paragraph:    { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      heading:      { content: 'inline*', group: 'block', attrs: { level: { default: 1 } }, toDOM(n) { return ['h' + n.attrs.level, 0]; } },
      quote:        { content: 'inline*', group: 'block', toDOM() { return ['blockquote', 0]; } },
      bulletList:   { content: 'listItem+', group: 'block', toDOM() { return ['ul', 0]; } },
      orderedList:  { content: 'listItem+', group: 'block', attrs: { start: { default: 1 } }, toDOM() { return ['ol', 0]; } },
      listItem:     { content: 'paragraph block*', toDOM() { return ['li', 0]; } },
      horizontalRule: { group: 'block', toDOM() { return ['hr']; } },
      pageBreak:    { group: 'block', attrs: { manual: { default: true } }, toDOM() { return ['div']; } },
      scene: {
        content: 'sceneLine (action | inlineFreeText)*',
        group: 'block',
        attrs: { id: { default: null }, number: { default: null }, notes: { default: '' }, revisionFlag: { default: null } },
        toDOM() { return ['div', 0]; }
      },
      sceneLine:     { content: 'inline*', group: 'screenplay', attrs: { setting: { default: 'INT' }, location: { default: '' }, time: { default: 'DAY' } }, toDOM() { return ['div', 0]; } },
      action:        { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      inlineFreeText:{ content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      text:          { group: 'inline' }
    },
    marks: {}
  });
}

// ---------------------------------------------------------------
// Minimal EditorView mock
// ---------------------------------------------------------------
function makeView(schema, bodyContent) {
  // Wire TextSelection for widget-menu.js
  global.window = global.window || {};
  global.window.RgaProseMirror = { TextSelection };

  const doc = schema.node('doc', null, [
    schema.node('body', null, bodyContent)
  ]);
  let state = EditorState.create({ schema, doc });

  const view = {
    get state() { return state; },
    dispatch(tr) { state = state.apply(tr); },
    focus() {}
  };
  return view;
}

// View with cursor positioned at the start of a specific node by depth-first index.
function makeViewAt(schema, bodyContent, paragraphIndex) {
  const view = makeView(schema, bodyContent);
  // Move cursor to start of the requested block
  const body = view.state.doc.child(0); // body is first (no titleStrip)
  let offset = view.state.doc.resolve(0).posAtIndex(0) + 1; // inside doc
  // pos inside body: 1 (doc-open) + 1 (body-open) = 2 = first pos in body
  let pos = 2; // position inside body (start of first block)
  for (let i = 0; i < paragraphIndex; i++) {
    pos += body.child(i).nodeSize;
  }
  pos += 1; // inside the block at index paragraphIndex
  const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, pos));
  view.dispatch(tr);
  return view;
}

// Load the module once after globals are set.
global.window = global.window || {};
global.window.RgaProseMirror = { TextSelection };
global.window.Rga = global.window.Rga || {};
require('../../renderer/js/editor/widget-menu.js');
const WM = global.window.Rga.WidgetMenu;

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

test('OUTSIDE_SCENE_ITEMS contains all 10 specified items', () => {
  const ids = WM.OUTSIDE_SCENE_ITEMS.map(function(i) { return i.id; });
  const required = ['title','heading1','heading2','paragraph','quote',
                    'bulletList','orderedList','horizontalRule','pageBreak','scene'];
  required.forEach(function(id) {
    assert.ok(ids.includes(id), 'missing item: ' + id);
  });
  assert.equal(WM.OUTSIDE_SCENE_ITEMS.length, 10);
});

test('INSIDE_SCENE_ITEMS contains inlineFreeText', () => {
  assert.equal(WM.INSIDE_SCENE_ITEMS.length, 1);
  assert.equal(WM.INSIDE_SCENE_ITEMS[0].id, 'inlineFreeText');
});

test('cmdParagraph inserts a paragraph node after the current block', () => {
  const schema = buildSchema();
  const view = makeView(schema, [schema.nodes.paragraph.createAndFill()]);
  WM.cmdParagraph(view);
  const body = view.state.doc.child(0);
  assert.equal(body.childCount, 2, 'should have 2 blocks after insert');
  assert.equal(body.child(1).type.name, 'paragraph');
});

test('cmdQuote inserts a quote after the current block', () => {
  const schema = buildSchema();
  const view = makeView(schema, [schema.nodes.paragraph.createAndFill()]);
  WM.cmdQuote(view);
  const body = view.state.doc.child(0);
  assert.equal(body.child(1).type.name, 'quote');
});

test('cmdScene inserts a scene with sceneLine and action children', () => {
  const schema = buildSchema();
  const view = makeView(schema, [schema.nodes.paragraph.createAndFill()]);
  WM.cmdScene(view);
  const body = view.state.doc.child(0);
  assert.equal(body.child(1).type.name, 'scene');
  const scene = body.child(1);
  assert.equal(scene.child(0).type.name, 'sceneLine');
  assert.equal(scene.child(1).type.name, 'action');
});

test('cmdBulletList inserts a bulletList containing a listItem', () => {
  const schema = buildSchema();
  const view = makeView(schema, [schema.nodes.paragraph.createAndFill()]);
  WM.cmdBulletList(view);
  const body = view.state.doc.child(0);
  assert.equal(body.child(1).type.name, 'bulletList');
  assert.equal(body.child(1).child(0).type.name, 'listItem');
});

test('cmdOrderedList inserts an orderedList', () => {
  const schema = buildSchema();
  const view = makeView(schema, [schema.nodes.paragraph.createAndFill()]);
  WM.cmdOrderedList(view);
  const body = view.state.doc.child(0);
  assert.equal(body.child(1).type.name, 'orderedList');
});

test('cmdScene places cursor inside the new sceneLine', () => {
  const schema = buildSchema();
  const view = makeView(schema, [schema.nodes.paragraph.createAndFill()]);
  WM.cmdScene(view);
  const { $from } = view.state.selection;
  // Cursor should be inside the scene (ancestor at some depth)
  let insideScene = false;
  for (let d = 0; d <= $from.depth; d++) {
    if ($from.node(d).type.name === 'scene') { insideScene = true; break; }
  }
  assert.ok(insideScene, 'cursor should be inside the new scene');
});

test('cmdInlineFreeText inserts inlineFreeText inside a scene', () => {
  const schema = buildSchema();
  // Start with doc containing a scene with sceneLine + action
  const sceneLine = schema.nodes.sceneLine.createAndFill();
  const action = schema.nodes.action.createAndFill();
  const scene = schema.nodes.scene.create(null, [sceneLine, action]);
  const view = makeView(schema, [scene]);

  // Place cursor inside the action (scene's second child)
  // pos: 1(doc) + 1(body) + 1(scene) + sceneLine.nodeSize + 1(action start) = 2 + 1 + 2 + 1 = ...
  // easier: just use TextSelection to get inside the action
  const bodyStart = 2; // inside body
  const sceneStart = bodyStart + 1; // inside scene
  const sceneLineEnd = sceneStart + schema.nodes.sceneLine.createAndFill().nodeSize;
  const actionContentStart = sceneLineEnd; // pos inside action (sceneLineEnd is already inside action's opening tag)
  const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, actionContentStart));
  view.dispatch(tr);

  WM.cmdInlineFreeText(view);

  const sceneNode = view.state.doc.child(0).child(0); // body -> scene
  assert.ok(sceneNode.childCount >= 3, 'scene should have sceneLine + action + inlineFreeText');
  assert.equal(sceneNode.child(2).type.name, 'inlineFreeText');
});

test('insert after second block targets correct position', () => {
  const schema = buildSchema();
  // Two paragraphs; cursor in first
  const p1 = schema.nodes.paragraph.create(null, [schema.text('first')]);
  const p2 = schema.nodes.paragraph.create(null, [schema.text('second')]);
  const view = makeView(schema, [p1, p2]);
  // cursor is at start of first paragraph by default (pos 3)
  WM.cmdQuote(view);
  const body = view.state.doc.child(0);
  // quote inserted after p1 (before p2)
  assert.equal(body.child(0).type.name, 'paragraph');
  assert.equal(body.child(1).type.name, 'quote');
  assert.equal(body.child(2).type.name, 'paragraph');
  assert.equal(body.child(2).textContent, 'second');
});
