// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 2 — v1-to-v2 migration step. Coverage is intentionally focused;
// the same transformation is also covered in tests/unit/doc.test.js (via
// the legacy doc.js helpers). This file tests the EXTRACTED module's
// pure-function shape and equivalence with the legacy behavior.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function boot() {
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  const p = require.resolve('../../../../../renderer/js/doc-types/screenplay/migrations/v1-to-v2.js');
  delete require.cache[p];
  require(p);
  return global.window.Rga.Migrations._steps;
}

test('migrateV1toV2 bumps rga_version to "2.0"', () => {
  const S = boot();
  const out = S.v1toV2({ rga_version: '1.0', body: null });
  assert.equal(out.rga_version, '2.0');
});

test('migrateV1toV2 converts v1 scene → v2 sceneFrame', () => {
  const S = boot();
  const v1 = {
    rga_version: '1.0',
    body: {
      type: 'doc',
      content: [{
        type: 'body',
        content: [{
          type: 'scene',
          attrs: { id: 's1', number: 1, headingStyle: null, notes: 'note', revisionFlag: null },
          content: [
            { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY', location: 'KITCHEN' } },
            { type: 'action', content: [{ type: 'text', text: 'A.' }] }
          ]
        }]
      }]
    }
  };
  const out = S.v1toV2(v1);
  const sceneFrame = out.body.content[0].content[0];
  assert.equal(sceneFrame.type, 'sceneFrame');
  assert.equal(sceneFrame.attrs.id, 's1');
  assert.equal(sceneFrame.attrs.innerDoc.type, 'doc');
  assert.equal(sceneFrame.attrs.innerDoc.attrs.notes, 'note');
  // sceneLine location attr migrated into content
  const sceneLine = sceneFrame.attrs.innerDoc.content[0];
  assert.equal(sceneLine.attrs.location, undefined);
  assert.equal(sceneLine.content[0].text, 'KITCHEN');
});

test('migrateV1toV2 leaves null body untouched', () => {
  const S = boot();
  const out = S.v1toV2({ rga_version: '1.0', body: null });
  assert.equal(out.body, null);
  assert.equal(out.rga_version, '2.0');
});

test('migrateV1toV2 does NOT mutate input', () => {
  const S = boot();
  const v1 = {
    rga_version: '1.0',
    body: { type: 'doc', content: [{ type: 'body', content: [
      { type: 'scene', attrs: { id: 's1', notes: 'n' }, content: [
        { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY', location: 'X' } }
      ]}
    ]}]}
  };
  const snapshot = JSON.parse(JSON.stringify(v1));
  S.v1toV2(v1);
  assert.deepEqual(v1, snapshot);
});

test('migrateV1toV2 returns input unchanged for non-objects', () => {
  const S = boot();
  assert.equal(S.v1toV2(null), null);
  assert.equal(S.v1toV2(undefined), undefined);
});
