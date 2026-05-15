// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function loadDoc() {
  const modPath = require.resolve('../../../../renderer/js/doc.js');
  delete require.cache[modPath];
  global.window = { Rga: {} };
  require('../../../../renderer/js/constants.js');
  require(modPath);
  return global.window.Rga.Doc;
}

test('_migrateScenesToFrames converts a scene with full attrs', () => {
  const Doc = loadDoc();
  const input = {
    type: 'scene',
    attrs: { id: 's1', number: 1, notes: 'mood', revisionFlag: null, headingStyle: 'band' },
    content: [
      { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' },
        content: [{ type: 'text', text: 'CAFÉ' }] },
      { type: 'action', content: [{ type: 'text', text: 'A door opens.' }] }
    ]
  };
  const out = Doc._migrateScenesToFrames(input);
  assert.equal(out.type, 'sceneFrame');
  assert.equal(out.attrs.id, 's1');
  assert.equal(out.attrs.number, 1);
  assert.equal(out.attrs.headingStyle, 'band');
  assert.ok(out.attrs.innerDoc);
  assert.equal(out.attrs.innerDoc.type, 'doc');
  assert.equal(out.attrs.innerDoc.attrs.notes, 'mood');
  assert.equal(out.attrs.innerDoc.attrs.revisionFlag, null);
  assert.equal(out.attrs.innerDoc.content.length, 2);
  assert.equal(out.attrs.innerDoc.content[0].type, 'sceneLine');
  assert.equal(out.attrs.innerDoc.content[1].type, 'action');
});

test('_migrateScenesToFrames handles a scene with default/missing attrs', () => {
  const Doc = loadDoc();
  const out = Doc._migrateScenesToFrames({ type: 'scene', attrs: {}, content: [] });
  assert.equal(out.type, 'sceneFrame');
  assert.equal(out.attrs.id, null);
  assert.equal(out.attrs.number, null);
  assert.equal(out.attrs.headingStyle, null);
  assert.equal(out.attrs.innerDoc.content.length, 0);
  assert.equal(out.attrs.innerDoc.attrs.notes, '');
  assert.equal(out.attrs.innerDoc.attrs.revisionFlag, null);
});

test('_migrateScenesToFrames recurses into doc/body wrappers', () => {
  const Doc = loadDoc();
  const input = {
    type: 'doc',
    content: [{
      type: 'body',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'pre' }] },
        { type: 'scene', attrs: { id: 's1' },
          content: [{ type: 'sceneLine', attrs: { setting: 'INT.' }, content: [] }] }
      ]
    }]
  };
  const out = Doc._migrateScenesToFrames(input);
  assert.equal(out.content[0].content[0].type, 'paragraph');
  assert.equal(out.content[0].content[1].type, 'sceneFrame');
  assert.equal(out.content[0].content[1].attrs.id, 's1');
});

test('_migrateScenesToFrames leaves non-scene nodes untouched', () => {
  const Doc = loadDoc();
  const para = { type: 'paragraph', content: [{ type: 'text', text: 'hello' }] };
  assert.deepEqual(Doc._migrateScenesToFrames(para), para);
});

test('_migrateScenesToFrames is idempotent on already-migrated content', () => {
  const Doc = loadDoc();
  const alreadyMigrated = {
    type: 'sceneFrame',
    attrs: { id: 'a', number: 1, headingStyle: null, innerDoc: { type: 'doc', attrs: {}, content: [] } }
  };
  assert.deepEqual(Doc._migrateScenesToFrames(alreadyMigrated), alreadyMigrated);
});
