// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('../../renderer/js/constants.js');
require('../../renderer/js/doc.js');
const { Doc } = global.window.Rga;

test('addEntity returns an id and stores entity in tagRegistry', () => {
  const doc = Doc.create();
  const id = Doc.addEntity(doc, 'character', { name: 'SARAH', color: '#4FC1FF' });
  assert.ok(typeof id === 'string' && id.length > 0);
  assert.equal(doc.tagRegistry.characters.length, 1);
  assert.equal(doc.tagRegistry.characters[0].name, 'SARAH');
  assert.equal(doc.tagRegistry.characters[0].id, id);
});

test('addEntity uses caller-supplied id when provided', () => {
  const doc = Doc.create();
  const id = Doc.addEntity(doc, 'prop', { id: 'prop-1', name: 'Sword' });
  assert.equal(id, 'prop-1');
  assert.equal(doc.tagRegistry.props[0].id, 'prop-1');
});

test('addEntity handles wardrobe registry key correctly', () => {
  const doc = Doc.create();
  Doc.addEntity(doc, 'wardrobe', { name: 'Ball gown' });
  assert.equal(doc.tagRegistry.wardrobe.length, 1);
});

test('addEntity handles sfx and vfx keys correctly', () => {
  const doc = Doc.create();
  Doc.addEntity(doc, 'sfx', { name: 'Gunshot' });
  Doc.addEntity(doc, 'vfx', { name: 'Explosion' });
  assert.equal(doc.tagRegistry.sfx.length, 1);
  assert.equal(doc.tagRegistry.vfx.length, 1);
});

test('addEntity handles custom key correctly', () => {
  const doc = Doc.create();
  Doc.addEntity(doc, 'custom', { name: 'My type' });
  assert.equal(doc.tagRegistry.custom.length, 1);
});

test('findEntity returns the entity by id', () => {
  const doc = Doc.create();
  const id = Doc.addEntity(doc, 'location', { name: 'INT. CAFE' });
  const found = Doc.findEntity(doc, 'location', id);
  assert.ok(found);
  assert.equal(found.name, 'INT. CAFE');
});

test('findEntity returns null when entity does not exist', () => {
  const doc = Doc.create();
  const found = Doc.findEntity(doc, 'character', 'nonexistent-id');
  assert.equal(found, null);
});

test('removeEntity removes the entity and returns true', () => {
  const doc = Doc.create();
  const id = Doc.addEntity(doc, 'character', { name: 'JOHN' });
  const result = Doc.removeEntity(doc, 'character', id);
  assert.equal(result, true);
  assert.equal(doc.tagRegistry.characters.length, 0);
});

test('removeEntity returns false when entity not found', () => {
  const doc = Doc.create();
  const result = Doc.removeEntity(doc, 'character', 'ghost-id');
  assert.equal(result, false);
});

test('multiple entities in same type are managed independently', () => {
  const doc = Doc.create();
  const id1 = Doc.addEntity(doc, 'character', { name: 'SARAH' });
  const id2 = Doc.addEntity(doc, 'character', { name: 'JOHN' });
  assert.equal(doc.tagRegistry.characters.length, 2);
  Doc.removeEntity(doc, 'character', id1);
  assert.equal(doc.tagRegistry.characters.length, 1);
  assert.equal(doc.tagRegistry.characters[0].id, id2);
});
