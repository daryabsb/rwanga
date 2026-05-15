// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

function loadInnerSchemaModule() {
  // Reset module cache so each test gets a fresh load
  const path = require.resolve('../../../../renderer/js/doc-types/screenplay/inner-schema.js');
  delete require.cache[path];

  global.window = { Rga: { DocTypes: { screenplay: {} }, Framework: {} } };
  // Minimal mark set the inner schema will reuse
  global.window.Rga.Framework.baseOuterMarks = {
    bold: { toDOM() { return ['strong', 0]; } },
    italic: { toDOM() { return ['em', 0]; } },
    underline: { toDOM() { return ['u', 0]; } },
    strikethrough: { toDOM() { return ['s', 0]; } },
    tag: { attrs: { tagType: {}, entityId: {} }, inclusive: false, excludes: '', toDOM() { return ['span', 0]; } },
    annotation: { attrs: { id: {}, text: { default: '' }, color: { default: '#FFE08A' }, createdAt: { default: null }, author: { default: null } }, inclusive: false, excludes: '', toDOM() { return ['span', 0]; } },
    revisionFlag: { attrs: { id: { default: null }, reason: { default: '' }, color: { default: '#F44747' }, createdAt: { default: null }, status: { default: 'open' } }, inclusive: false, excludes: '', toDOM() { return ['span', 0]; } }
  };
  // Stub PM Schema constructor onto the global the module reads from
  global.window.RgaProseMirror = { Schema: Schema };

  require(path);
  return global.window.Rga.DocTypes.screenplay;
}

test('innerSchema is a Schema instance', () => {
  const sp = loadInnerSchemaModule();
  assert.ok(sp.innerSchema, 'innerSchema must exist');
  assert.ok(sp.innerSchema instanceof Schema, 'innerSchema must be a prosemirror Schema');
});

test('innerSchema has all required nodes', () => {
  const sp = loadInnerSchemaModule();
  const names = Object.keys(sp.innerSchema.nodes).sort();
  for (const required of ['doc', 'sceneLine', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'shot', 'inlineFreeText', 'text']) {
    assert.ok(names.includes(required), 'missing node: ' + required);
  }
});

test('sceneLine has setting and time attrs with defaults', () => {
  const sp = loadInnerSchemaModule();
  const sl = sp.innerSchema.nodes.sceneLine;
  assert.equal(sl.spec.attrs.setting.default, 'INT.');
  assert.equal(sl.spec.attrs.time.default, 'DAY');
});

test('all block nodes are in the block group', () => {
  const sp = loadInnerSchemaModule();
  for (const name of ['sceneLine', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'shot', 'inlineFreeText']) {
    const spec = sp.innerSchema.nodes[name].spec;
    assert.equal(spec.group, 'block', name + ' must be in block group');
  }
});

test('emptyInnerDoc returns a doc with sceneLine + action', () => {
  const sp = loadInnerSchemaModule();
  const doc = sp.emptyInnerDoc(sp.innerSchema);
  assert.equal(doc.type.name, 'doc');
  assert.equal(doc.childCount, 2);
  assert.equal(doc.child(0).type.name, 'sceneLine');
  assert.equal(doc.child(1).type.name, 'action');
});

test('innerSchema can deserialize a minimal sceneLine + action structure', () => {
  const sp = loadInnerSchemaModule();
  const node = sp.innerSchema.nodeFromJSON({
    type: 'doc',
    content: [
      { type: 'sceneLine', attrs: { setting: 'EXT.', time: 'NIGHT' }, content: [{ type: 'text', text: 'PARK' }] },
      { type: 'action', content: [{ type: 'text', text: 'A man walks.' }] }
    ]
  });
  assert.equal(node.firstChild.attrs.setting, 'EXT.');
  assert.equal(node.firstChild.textContent, 'PARK');
  assert.equal(node.lastChild.type.name, 'action');
  assert.equal(node.lastChild.textContent, 'A man walks.');
});
