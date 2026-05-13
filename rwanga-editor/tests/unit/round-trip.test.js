// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Schema } = require('prosemirror-model');

// Re-build the full screenplay schema (mirrors schema.js without browser globals)
function buildScreenplaySchema() {
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
    marks: {
      bold: { toDOM() { return ['strong', 0]; } },
      italic: { toDOM() { return ['em', 0]; } },
      underline: { toDOM() { return ['u', 0]; } },
      strikethrough: { toDOM() { return ['s', 0]; } },
      color: { attrs: { value: {} }, toDOM(m) { return ['span', { style: 'color:' + m.attrs.value }, 0]; } },
      highlight: { attrs: { value: {} }, toDOM(m) { return ['span', { style: 'background-color:' + m.attrs.value }, 0]; } },
      fontFamily: { attrs: { value: {} }, toDOM(m) { return ['span', 0]; } },
      fontSize: { attrs: { value: {} }, toDOM(m) { return ['span', 0]; } },
      link: { attrs: { href: {}, title: { default: null } }, inclusive: false, toDOM(m) { return ['a', { href: m.attrs.href }, 0]; } },
      annotation: { attrs: { id: {}, text: { default: '' }, color: { default: '#FFE08A' }, createdAt: { default: null }, author: { default: null } }, inclusive: false, excludes: '', toDOM() { return ['span', 0]; } },
      tag: { attrs: { tagType: {}, entityId: {} }, inclusive: false, excludes: '', toDOM() { return ['span', 0]; } },
      revisionFlag: { attrs: { reason: { default: '' }, createdAt: { default: null }, status: { default: 'open' } }, inclusive: false, excludes: '', toDOM() { return ['span', 0]; } }
    }
  });
}

global.window = global.window || {};
require('../../renderer/js/constants.js');
require('../../renderer/js/doc.js');
const { Doc } = global.window.Rga;

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'v2.0-sample.rga');

test('v2.0 fixture deserializes to a valid PM doc', () => {
  const schema = buildScreenplaySchema();
  const content = fs.readFileSync(FIXTURE, 'utf8');
  const doc = Doc.deserialize(content, FIXTURE, { schema });
  assert.ok(doc.body, 'body should be a PM Node');
  assert.equal(doc.body.type.name, 'doc');
  assert.equal(doc.metadata.title, 'The Coffee Order');
  assert.equal(doc.documentType, 'screenplay');
});

test('v2.0 fixture round-trips losslessly', () => {
  const schema = buildScreenplaySchema();
  const content = fs.readFileSync(FIXTURE, 'utf8');
  const doc = Doc.deserialize(content, FIXTURE, { schema });

  // Re-serialize
  const reserialized = Doc.serialize(doc);
  const reparsed = JSON.parse(reserialized);

  // Top-level fields preserved
  assert.equal(reparsed.rga_version, '2.0');
  assert.equal(reparsed.document_type, 'screenplay');
  assert.equal(reparsed.metadata.title, 'The Coffee Order');

  // PM tree structure preserved
  assert.equal(reparsed.body.type, 'doc');

  // Re-deserialize from re-serialized and check body is still valid
  const doc2 = Doc.deserialize(reserialized, null, { schema });
  assert.ok(doc2.body);
  assert.deepEqual(doc.body.toJSON(), doc2.body.toJSON());
});

test('scene structure survives the round-trip', () => {
  const schema = buildScreenplaySchema();
  const content = fs.readFileSync(FIXTURE, 'utf8');
  const doc = Doc.deserialize(content, FIXTURE, { schema });

  const bodyNode = doc.body.firstChild;  // titleStrip or body
  // Find the body node
  let bodyContent = null;
  doc.body.forEach(child => {
    if (child.type.name === 'body') bodyContent = child;
  });
  assert.ok(bodyContent, 'body node should exist');

  // Find the scene node
  let sceneNode = null;
  bodyContent.forEach(child => {
    if (child.type.name === 'scene') sceneNode = child;
  });
  assert.ok(sceneNode, 'scene node should exist');
  assert.equal(sceneNode.firstChild.type.name, 'sceneLine');
  assert.equal(sceneNode.attrs.id, 'scene-7f2a');
});
