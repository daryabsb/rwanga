// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 3 — Rga.DocTypes.detect + selectSchema (registry-level helpers).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function bootRegistry() {
  // Fresh registry per test — re-require the module.
  delete require.cache[require.resolve('../../../renderer/js/framework/doc-type-registry.js')];
  global.window = {};
  require('../../../renderer/js/framework/doc-type-registry.js');
  return global.window.Rga.DocTypes;
}

test('detect: default to "screenplay" for empty/missing input', () => {
  const DT = bootRegistry();
  assert.equal(DT.detect(null), 'screenplay');
  assert.equal(DT.detect(undefined), 'screenplay');
  assert.equal(DT.detect({}), 'screenplay');
  assert.equal(DT.detect({ document_type: null }), 'screenplay');
  assert.equal(DT.detect({ document_type: '' }), 'screenplay');
});

test('detect: returns parsed.document_type when set', () => {
  const DT = bootRegistry();
  assert.equal(DT.detect({ document_type: 'screenplay' }), 'screenplay');
  assert.equal(DT.detect({ document_type: 'novel' }), 'novel');
});

test('detect: preserves unknown document types verbatim (no validation)', () => {
  const DT = bootRegistry();
  assert.equal(DT.detect({ document_type: 'future-stage-play' }), 'future-stage-play');
});

test('selectSchema: throws for unknown doc-types', () => {
  const DT = bootRegistry();
  // No doc-types registered → screenplay default lookup fails
  assert.throws(function() {
    DT.selectSchema({ document_type: 'screenplay' });
  }, /unknown doc-type/);
});

test('selectSchema: returns null when config has no selectSchema hook', () => {
  const DT = bootRegistry();
  DT.register('plain', { outerNodes: {} });
  assert.equal(DT.selectSchema({ document_type: 'plain' }), null);
});

test('selectSchema: delegates to per-doctype config.selectSchema', () => {
  const DT = bootRegistry();
  const fakeSchema = { _kind: 'fake-schema' };
  DT.register('custom', {
    outerNodes: {},
    selectSchema: function(parsed) { return parsed.metadata && parsed.metadata.flag ? fakeSchema : null; }
  });
  // With flag → returns the fake schema
  assert.equal(
    DT.selectSchema({ document_type: 'custom', metadata: { flag: true } }),
    fakeSchema
  );
  // Without flag → returns null
  assert.equal(
    DT.selectSchema({ document_type: 'custom', metadata: {} }),
    null
  );
});

test('selectSchema: routes via detect() so document_type drives the lookup', () => {
  const DT = bootRegistry();
  let calledWith = null;
  DT.register('routed', {
    outerNodes: {},
    selectSchema: function(parsed) { calledWith = parsed; return null; }
  });
  DT.selectSchema({ document_type: 'routed', metadata: { flag: 'x' } });
  assert.ok(calledWith);
  assert.equal(calledWith.metadata.flag, 'x');
});
