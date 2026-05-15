// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

function loadOuterSchemaAdditions() {
  const modPath = require.resolve('../../../../renderer/js/doc-types/screenplay/outer-schema-additions.js');
  delete require.cache[modPath];
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  global.window.Rga.DocTypes = global.window.Rga.DocTypes || {};
  global.window.Rga.DocTypes.screenplay = global.window.Rga.DocTypes.screenplay || {};
  require(modPath);
  return global.window.Rga.DocTypes.screenplay.outerNodes;
}

function buildSchema(outerNodes) {
  return new Schema({
    nodes: Object.assign({
      doc:        { content: 'block+' },
      paragraph:  { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      text:       { group: 'inline' }
    }, outerNodes),
    marks: {}
  });
}

test('outer-schema-additions exports a sceneFrame node spec', () => {
  const outerNodes = loadOuterSchemaAdditions();
  assert.ok(outerNodes, 'outerNodes must exist');
  assert.ok(outerNodes.sceneFrame, 'sceneFrame must be present');
});

test('sceneFrame node has the four expected attrs with correct defaults', () => {
  const outerNodes = loadOuterSchemaAdditions();
  const spec = outerNodes.sceneFrame;
  assert.deepEqual(Object.keys(spec.attrs).sort(),
    ['headingStyle', 'id', 'innerDoc', 'number']);
  assert.equal(spec.attrs.id.default, null);
  assert.equal(spec.attrs.number.default, null);
  assert.equal(spec.attrs.headingStyle.default, null);
  assert.equal(spec.attrs.innerDoc.default, null);
});

test('sceneFrame is atomic and in the block group', () => {
  const outerNodes = loadOuterSchemaAdditions();
  const spec = outerNodes.sceneFrame;
  assert.equal(spec.atom, true);
  assert.equal(spec.group, 'block');
});

test('schema with sceneFrame constructs and a doc with one sceneFrame is valid', () => {
  const outerNodes = loadOuterSchemaAdditions();
  const s = buildSchema(outerNodes);
  const node = s.node('sceneFrame', { id: 'a', number: 1, headingStyle: null, innerDoc: null });
  const doc = s.node('doc', null, [node]);
  assert.equal(doc.firstChild.type.name, 'sceneFrame');
  assert.equal(doc.firstChild.attrs.id, 'a');
  assert.equal(doc.firstChild.attrs.number, 1);
});

test('sceneFrame.toDOM produces the expected element', () => {
  const outerNodes = loadOuterSchemaAdditions();
  const s = buildSchema(outerNodes);
  const node = s.node('sceneFrame', { id: 'x', number: 3, headingStyle: null, innerDoc: null });
  const dom = outerNodes.sceneFrame.toDOM(node);
  assert.deepEqual(dom, ['div', {
    class: 'rga-scene-frame',
    'data-scene-id': 'x',
    'data-scene-number': '3'
  }]);
});

function loadPlaceholder() {
  const modPath = require.resolve('../../../../renderer/js/doc-types/screenplay/scene-frame-placeholder.js');
  delete require.cache[modPath];
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  global.window.Rga.DocTypes = global.window.Rga.DocTypes || {};
  global.window.Rga.DocTypes.screenplay = global.window.Rga.DocTypes.screenplay || {};
  global.document = { createElement: function() { return { setAttribute() {}, appendChild() {}, removeChild() {}, dataset: {}, get firstChild() { return null; } }; } };
  require(modPath);
  return global.window.Rga.DocTypes.screenplay._slugPreview;
}

test('_slugPreview: returns formatted slug from a sceneLine with content', () => {
  const slug = loadPlaceholder();
  const innerDoc = {
    type: 'doc',
    content: [
      { type: 'sceneLine',
        attrs: { setting: 'INT.', time: 'NIGHT' },
        content: [{ type: 'text', text: 'CAFÉ' }] }
    ]
  };
  assert.equal(slug(innerDoc), 'INT. CAFÉ — NIGHT');
});

test('_slugPreview: empty location falls back to "SETTING — TIME"', () => {
  const slug = loadPlaceholder();
  const innerDoc = {
    type: 'doc',
    content: [{ type: 'sceneLine', attrs: { setting: 'EXT.', time: 'DAY' }, content: [] }]
  };
  assert.equal(slug(innerDoc), 'EXT. — DAY');
});

test('_slugPreview: null innerDoc returns null', () => {
  const slug = loadPlaceholder();
  assert.equal(slug(null), null);
});

test('_slugPreview: missing setting/time defaults to INT./DAY', () => {
  const slug = loadPlaceholder();
  const innerDoc = {
    type: 'doc',
    content: [{ type: 'sceneLine', attrs: {}, content: [{ type: 'text', text: 'PARK' }] }]
  };
  assert.equal(slug(innerDoc), 'INT. PARK — DAY');
});
