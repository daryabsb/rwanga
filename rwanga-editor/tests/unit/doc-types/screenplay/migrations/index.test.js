// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 2 — migrations framework (detectVersion + chain).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function boot() {
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  ['v1-to-v2', 'v2-to-v3', 'index'].forEach(function(name) {
    const p = require.resolve('../../../../../renderer/js/doc-types/screenplay/migrations/' + name + '.js');
    delete require.cache[p];
    require(p);
  });
  return global.window.Rga.Migrations;
}

test('detectVersion reads parsed.rga_version', () => {
  const M = boot();
  assert.equal(M.detectVersion({ rga_version: '1.0' }), '1.0');
  assert.equal(M.detectVersion({ rga_version: '2.0' }), '2.0');
  assert.equal(M.detectVersion({ rga_version: '3.0' }), '3.0');
});

test('detectVersion handles missing version (legacy → 1.0)', () => {
  const M = boot();
  assert.equal(M.detectVersion({}), '1.0');
  assert.equal(M.detectVersion({ rga_version: '' }), '1.0');
});

test('detectVersion handles numeric rga_version', () => {
  const M = boot();
  assert.equal(M.detectVersion({ rga_version: 2 }), '2');
});

test('detectVersion returns null for non-objects', () => {
  const M = boot();
  assert.equal(M.detectVersion(null), null);
  assert.equal(M.detectVersion(undefined), null);
  assert.equal(M.detectVersion('not an object'), null);
});

test('migrate(null) and migrate(undefined) pass through', () => {
  const M = boot();
  assert.equal(M.migrate(null), null);
  assert.equal(M.migrate(undefined), undefined);
});

test('migrate on a v3 doc returns it unchanged', () => {
  const M = boot();
  const v3 = { rga_version: '3.0', metadata: { title: 'x' }, body: { type: 'doc', content: [] } };
  const out = M.migrate(v3);
  assert.equal(out.rga_version, '3.0');
  assert.equal(out.metadata.title, 'x');
});

test('migrate v1 → v2 → v3 chains through both steps', () => {
  const M = boot();
  const v1 = {
    rga_version: '1.0',
    document_type: 'screenplay',
    metadata: { title: 't', language: 'en' },
    body: {
      type: 'doc',
      content: [{
        type: 'body',
        content: [{
          type: 'scene',
          attrs: { id: 'scene-001', number: 1, notes: 'x' },
          content: [
            { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY', location: 'KITCHEN' } },
            { type: 'action', content: [{ type: 'text', text: 'hi.' }] },
            { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
          ]
        }]
      }]
    }
  };
  const out = M.migrate(v1);
  assert.equal(out.rga_version, '3.0');
  // After v3: body[0] is the body wrapper; its content[0] is a scene
  const body = out.body.content[0];
  assert.equal(body.type, 'body');
  const scene = body.content[0];
  assert.equal(scene.type, 'scene');
  assert.equal(scene.attrs.id, 'scene-001');
  // Number must NOT be in v3 attrs (correction A); migration drops it.
  assert.equal(scene.attrs.number, undefined);
  // sceneHeading at index 0
  assert.equal(scene.content[0].type, 'sceneHeading');
  // screenplayProfile derived
  assert.equal(out.metadata.screenplayProfile.language, 'en');
  assert.equal(out.metadata.screenplayProfile.direction, 'ltr');
});

test('migrate caps iterations to avoid infinite loops', () => {
  const M = boot();
  // Simulate a buggy step that forgets to bump version.
  const original = M._steps.v2toV3;
  M._steps.v2toV3 = function(parsed) {
    // Returns unchanged version → would loop forever without the cap.
    return Object.assign({}, parsed, { rga_version: '2.0' });
  };
  try {
    const out = M.migrate({ rga_version: '2.0' });
    // Should return *something* (the cap kicks in), not freeze.
    assert.ok(out);
  } finally {
    M._steps.v2toV3 = original;
  }
});

test('migrate preserves unknown top-level fields', () => {
  const M = boot();
  const input = {
    rga_version: '2.0',
    metadata: { title: 't' },
    body: { type: 'doc', content: [{ type: 'body', content: [] }] },
    custom_extension_field: { keep: 'me' }
  };
  const out = M.migrate(input);
  assert.deepEqual(out.custom_extension_field, { keep: 'me' });
});

test('migrate preserves unknown metadata fields', () => {
  const M = boot();
  const input = {
    rga_version: '2.0',
    metadata: { title: 't', language: 'en', custom_meta: 42 },
    body: { type: 'doc', content: [{ type: 'body', content: [] }] }
  };
  const out = M.migrate(input);
  assert.equal(out.metadata.custom_meta, 42);
});

test('does NOT mutate the input object', () => {
  const M = boot();
  const input = { rga_version: '2.0', metadata: { title: 't', language: 'en' }, body: { type: 'doc', content: [{ type: 'body', content: [] }] } };
  const inputSnapshot = JSON.parse(JSON.stringify(input));
  M.migrate(input);
  assert.deepEqual(input, inputSnapshot, 'input should not be mutated');
});
