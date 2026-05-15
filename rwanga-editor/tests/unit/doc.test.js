// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

global.window = global.window || {};
require('../../renderer/js/constants.js');
require('../../renderer/js/doc.js');
const { Doc } = global.window.Rga;

// Minimal PM schema usable in Node.js tests for round-trip testing
function buildTestSchema() {
  return new Schema({
    nodes: {
      doc: { content: 'titleStrip? body' },
      titleStrip: { content: 'text*', attrs: { removable: { default: true } }, toDOM() { return ['div', 0]; } },
      body: { content: 'block*', toDOM() { return ['div', 0]; } },
      paragraph: { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      text: { group: 'inline' }
    },
    marks: {
      bold: { toDOM() { return ['strong', 0]; } }
    }
  });
}

test('Doc.create produces an Untitled doc with dirty=false and rgaVersion=2.0', () => {
  const doc = Doc.create();
  assert.equal(doc.handle, null);
  assert.equal(doc.origin, 'untitled');
  assert.equal(doc.dirty, false);
  assert.match(doc.displayName, /^Untitled/);
  assert.equal(doc.rgaVersion, '2.0');
  assert.equal(doc.body, null);   // PM Node not set until tab-manager mounts
});

test('Doc.create seeds metadata defaults from optional seedDefaults', () => {
  const doc = Doc.create({ seedDefaults: { language: 'ku', production_type: 'short', author: 'Darya' } });
  assert.equal(doc.metadata.language, 'ku');
  assert.equal(doc.metadata.production_type, 'short');
  assert.equal(doc.metadata.author, 'Darya');
});

test('Doc.serialize then Doc.deserialize round-trips metadata losslessly (v2.0)', () => {
  const schema = buildTestSchema();
  const doc = Doc.create({ seedDefaults: { language: 'en', production_type: 'feature' } });
  doc.metadata.title = 'Round Trip Test';
  doc.body = schema.node('doc', null, [
    schema.node('body', null, [schema.node('paragraph', null, [schema.text('Hello.')])])
  ]);
  const str = Doc.serialize(doc);
  const reloaded = Doc.deserialize(str, '/fake/path.rga', { schema });
  assert.equal(reloaded.metadata.title, 'Round Trip Test');
  assert.equal(reloaded.handle, '/fake/path.rga');
  assert.equal(reloaded.origin, 'disk');
  assert.equal(reloaded.dirty, false);
  assert.ok(reloaded.body, 'body should be a PM Node');
  assert.equal(reloaded.body.type.name, 'doc');
});

test('Doc.serialize produces valid v2.0 JSON with PM tree in body field', () => {
  const schema = buildTestSchema();
  const doc = Doc.create();
  doc.metadata.title = 'Café';
  doc.body = schema.node('doc', null, [
    schema.node('body', null, [schema.node('paragraph')])
  ]);
  const parsed = JSON.parse(Doc.serialize(doc));
  assert.equal(parsed.rga_version, '2.0');
  assert.equal(parsed.document_type, 'screenplay');
  assert.equal(parsed.metadata.title, 'Café');
  assert.equal(parsed.body.type, 'doc');
  assert.ok(parsed.body.content, 'body.content should exist');
});

test('Doc.deserialize accepts v1.x and backfills production_type=untyped; body is null', () => {
  const v11 = JSON.stringify({
    rga_version: '1.1',
    metadata: { title: 'Old', author: 'X', language: 'en', genre: '', logline: '' },
    settings: {},
    scenes: [],
    tag_registry: { characters: [], props: [], wardrobe: [], locations: [], sfx: [], vfx: [], vehicles: [], animals: [], custom: [] },
    export_settings: {},
    runtime: {}
  });
  const doc = Doc.deserialize(v11, '/old.rga');
  assert.equal(doc.rgaVersion, '2.0');          // always upgraded on load
  assert.equal(doc.metadata.production_type, 'untyped');
  assert.equal(doc.body, null);                  // no PM body from v1.x
});

test('Doc.deserialize rejects a newer rga_version', () => {
  const future = JSON.stringify({ rga_version: '3.0', metadata: {}, body: null });
  assert.throws(() => Doc.deserialize(future, '/future.rga'), /newer Rwanga/);
});

test('Doc.deserialize rejects invalid JSON', () => {
  assert.throws(() => Doc.deserialize('{not json', '/bad.rga'), /corrupt|invalid/i);
});

test('markDirty sets the flag and updates metadata.modified; clearDirty resets', () => {
  const doc = Doc.create();
  const before = doc.metadata.modified;
  Doc.markDirty(doc);
  assert.equal(doc.dirty, true);
  assert.ok(doc.metadata.modified >= before);
  Doc.clearDirty(doc, Date.now());
  assert.equal(doc.dirty, false);
  assert.ok(doc.lastSavedAt > 0);
});

test('Two Docs are independent — mutating one does not affect the other', () => {
  const a = Doc.create();
  const b = Doc.create();
  a.metadata.title = 'A';
  b.metadata.title = 'B';
  assert.notEqual(a.metadata.title, b.metadata.title);
  assert.notEqual(a.docId, b.docId);
});

test('Doc.create includes pageSetup in settings with Letter defaults', () => {
  const doc = Doc.create();
  assert.equal(doc.settings.pageSetup.paperSize, 'Letter');
  assert.deepEqual(doc.settings.pageSetup.margins, { top: 1, right: 1, bottom: 1, left: 1.5 });
});

test('Doc.serialize/deserialize round-trips pageSetup', () => {
  const schema = buildTestSchema();
  const doc = Doc.create();
  doc.settings.pageSetup.paperSize = 'A4';
  doc.settings.pageSetup.margins.left = 2;
  const reloaded = Doc.deserialize(Doc.serialize(doc), '/p.rga', { schema });
  assert.equal(reloaded.settings.pageSetup.paperSize, 'A4');
  assert.equal(reloaded.settings.pageSetup.margins.left, 2);
});

test('Doc.deserialize backfills pageSetup when an older v2.0 file lacks it', () => {
  const schema = buildTestSchema();
  const noPageSetup = JSON.stringify({
    rga_version: '2.0',
    metadata: { title: 'X' },
    settings: { theme: 'dark', font_size: 12 },
    body: null
  });
  const doc = Doc.deserialize(noPageSetup, '/old2.rga', { schema });
  assert.equal(doc.settings.pageSetup.paperSize, 'Letter');
  assert.deepEqual(doc.settings.pageSetup.margins, { top: 1, right: 1, bottom: 1, left: 1.5 });
});

test('Doc settings include vocabulary with default settings/times', () => {
  const doc = Doc.create();
  assert.ok(doc.settings.vocabulary, 'vocabulary key must exist');
  assert.ok(Array.isArray(doc.settings.vocabulary.settings), 'settings is an array');
  assert.ok(doc.settings.vocabulary.settings.includes('INT.'), 'INT. is present');
  assert.ok(Array.isArray(doc.settings.vocabulary.times), 'times is an array');
  assert.ok(doc.settings.vocabulary.times.includes('DAY'), 'DAY is present');
});

test('Doc settings include sceneHeadingStyle', () => {
  const doc = Doc.create();
  assert.equal(doc.settings.sceneHeadingStyle, 'twoLine');
});

test('Doc.deserialize backfills vocabulary on old file', () => {
  const schema = buildTestSchema();
  const noVocab = JSON.stringify({
    rga_version: '2.0',
    metadata: { title: 'X' },
    settings: { theme: 'dark', font_size: 12 },
    body: null
  });
  const doc = Doc.deserialize(noVocab, '/old3.rga', { schema });
  assert.ok(doc.settings.vocabulary, 'vocabulary must be backfilled');
  assert.equal(doc.settings.sceneHeadingStyle, 'twoLine');
});

test('Doc.deserialize migrates old sceneLine location attr to inline text content', () => {
  const { Schema } = require('prosemirror-model');
  const newSchema = new Schema({
    nodes: {
      doc:        { content: 'body' },
      body:       { content: 'block*', toDOM() { return ['div', 0]; } },
      paragraph:  { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      sceneFrame: {
        group: 'block', atom: true,
        attrs: { id: { default: null }, number: { default: null }, headingStyle: { default: null }, innerDoc: { default: null } },
        toDOM() { return ['div', 0]; }
      },
      text: { group: 'inline' }
    },
    marks: {}
  });

  const fileJson = {
    rga_version: '2.0',
    document_type: 'screenplay',
    metadata: {},
    settings: {},
    body: {
      type: 'doc',
      content: [{
        type: 'body',
        content: [{
          type: 'scene',
          attrs: { id: 's1', number: 1, notes: '', revisionFlag: null, headingStyle: null },
          content: [
            { type: 'sceneLine',
              attrs: { setting: 'INT', location: 'CAFÉ', time: 'DAY' },
              content: [] },
            { type: 'action', content: [] }
          ]
        }]
      }]
    },
    tag_registry: {},
    flag_log: [],
    export_settings: {},
    runtime: {}
  };

  const reloaded = Doc.deserialize(JSON.stringify(fileJson), null, { schema: newSchema });
  const frame = reloaded.body.firstChild.firstChild;
  assert.equal(frame.type.name, 'sceneFrame');
  assert.equal(frame.attrs.id, 's1');
  const sceneLine = frame.attrs.innerDoc.content[0];
  assert.equal(sceneLine.type, 'sceneLine');
  assert.equal(sceneLine.attrs.setting, 'INT');
  assert.equal(sceneLine.attrs.time, 'DAY');
  assert.equal(sceneLine.attrs.location, undefined);
  assert.equal(sceneLine.content[0].text, 'CAFÉ');
});
