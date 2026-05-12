// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('../../renderer/js/constants.js');
require('../../renderer/js/doc.js');
const { Doc } = global.window.Rga;

test('Doc.create produces an Untitled doc with dirty=false', () => {
  const doc = Doc.create();
  assert.equal(doc.handle, null);
  assert.equal(doc.origin, 'untitled');
  assert.equal(doc.dirty, false);
  assert.match(doc.displayName, /^Untitled/);
  assert.equal(doc.body.rga_version, '1.1');
});

test('Doc.create seeds metadata defaults from optional seedDefaults', () => {
  const doc = Doc.create({ seedDefaults: { language: 'ku', production_type: 'short', author: 'Darya' } });
  assert.equal(doc.body.metadata.language, 'ku');
  assert.equal(doc.body.metadata.production_type, 'short');
  assert.equal(doc.body.metadata.author, 'Darya');
});

test('Doc.serialize then Doc.deserialize round-trips losslessly', () => {
  const doc = Doc.create({ seedDefaults: { language: 'en', production_type: 'feature' } });
  doc.body.metadata.title = 'Round Trip Test';
  doc.body.scenes = [{ id: 'sc-1', number: 1, setting: 'INT', location: 'CAFÉ', time: 'NIGHT', elements: [] }];
  const str = Doc.serialize(doc);
  const reloaded = Doc.deserialize(str, '/fake/path.rga');
  assert.equal(reloaded.body.metadata.title, 'Round Trip Test');
  assert.equal(reloaded.body.scenes[0].location, 'CAFÉ');
  assert.equal(reloaded.handle, '/fake/path.rga');
  assert.equal(reloaded.origin, 'disk');
  assert.equal(reloaded.dirty, false);
});

test('Doc.deserialize accepts v1.0 and backfills production_type=untyped', () => {
  const v10 = JSON.stringify({
    rga_version: '1.0',
    metadata: { title: 'Old', author: 'X', language: 'en', genre: '', logline: '' },
    settings: {},
    scenes: [],
    tag_registry: { characters: [], props: [], wardrobe: [], locations: [], sfx: [], vfx: [], vehicles: [], animals: [], custom: [] },
    export_settings: {},
  });
  const doc = Doc.deserialize(v10, '/old.rga');
  assert.equal(doc.body.rga_version, '1.0');
  assert.equal(doc.body.metadata.production_type, 'untyped');
  assert.deepEqual(doc.body.runtime, undefined);
});

test('Doc.deserialize rejects a newer rga_version', () => {
  const future = JSON.stringify({ rga_version: '2.0', metadata: {}, scenes: [] });
  assert.throws(() => Doc.deserialize(future, '/future.rga'), /newer Rwanga/);
});

test('Doc.deserialize rejects invalid JSON', () => {
  assert.throws(() => Doc.deserialize('{not json', '/bad.rga'), /corrupt|invalid/i);
});

test('markDirty sets the flag; clearDirty resets', () => {
  const doc = Doc.create();
  Doc.markDirty(doc);
  assert.equal(doc.dirty, true);
  Doc.clearDirty(doc, Date.now());
  assert.equal(doc.dirty, false);
  assert.ok(doc.lastSavedAt > 0);
});

test('Two Docs are independent — mutating one does not affect the other', () => {
  const a = Doc.create();
  const b = Doc.create();
  a.body.metadata.title = 'A';
  b.body.metadata.title = 'B';
  assert.notEqual(a.body.metadata.title, b.body.metadata.title);
  assert.notEqual(a.docId, b.docId);
});
