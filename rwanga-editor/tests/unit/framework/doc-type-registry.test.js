// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function loadRegistry() {
  const modPath = require.resolve('../../../renderer/js/framework/doc-type-registry.js');
  delete require.cache[modPath];
  global.window = { Rga: {} };
  require(modPath);
  return global.window.Rga.DocTypes;
}

test('register stores a config that get returns', () => {
  const reg = loadRegistry();
  const config = { outerNodes: { foo: {} } };
  reg.register('test-type', config);
  assert.equal(reg.get('test-type'), config);
});

test('register throws on duplicate name', () => {
  const reg = loadRegistry();
  reg.register('dup', { outerNodes: {} });
  assert.throws(() => reg.register('dup', { outerNodes: {} }), /already registered/);
});

test('get throws on unknown name', () => {
  const reg = loadRegistry();
  assert.throws(() => reg.get('not-registered'), /unknown doc-type/i);
});

test('has returns false for unregistered, true after register', () => {
  const reg = loadRegistry();
  assert.equal(reg.has('xyz'), false);
  reg.register('xyz', { outerNodes: {} });
  assert.equal(reg.has('xyz'), true);
});
