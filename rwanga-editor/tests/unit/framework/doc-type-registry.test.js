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

// ----------------------------------------------------------------
// F1A.2 — bootDefaultSidebarPanel + registered (insertion-order list)
// ----------------------------------------------------------------

test('F1A.2 — bootDefaultSidebarPanel returns null when no doc-type is registered', () => {
  const reg = loadRegistry();
  assert.equal(reg.bootDefaultSidebarPanel(), null);
});

test('F1A.2 — bootDefaultSidebarPanel returns null when registered doc-types declare no default', () => {
  const reg = loadRegistry();
  reg.register('plain', { outerNodes: {} });
  assert.equal(reg.bootDefaultSidebarPanel(), null);
});

test('F1A.2 — bootDefaultSidebarPanel returns the first registered doc-type\'s declared default', () => {
  const reg = loadRegistry();
  reg.register('screenplay', { outerNodes: {}, defaultSidebarPanel: 'sceneNavigator' });
  assert.equal(reg.bootDefaultSidebarPanel(), 'sceneNavigator');
});

test('F1A.2 — bootDefaultSidebarPanel walks registration order until a non-empty default appears', () => {
  const reg = loadRegistry();
  reg.register('plain',      { outerNodes: {} });                                      // no default
  reg.register('screenplay', { outerNodes: {}, defaultSidebarPanel: 'sceneNavigator' });
  reg.register('novel',      { outerNodes: {}, defaultSidebarPanel: 'chapterNavigator' });
  // screenplay registered before novel → its default wins.
  assert.equal(reg.bootDefaultSidebarPanel(), 'sceneNavigator');
});

test('F1A.2 — bootDefaultSidebarPanel ignores empty-string + non-string defaults', () => {
  const reg = loadRegistry();
  reg.register('a', { outerNodes: {}, defaultSidebarPanel: '' });        // empty
  reg.register('b', { outerNodes: {}, defaultSidebarPanel: 42 });        // non-string
  reg.register('c', { outerNodes: {}, defaultSidebarPanel: null });      // null
  reg.register('d', { outerNodes: {}, defaultSidebarPanel: 'realDefault' });
  assert.equal(reg.bootDefaultSidebarPanel(), 'realDefault');
});

test('F1A.2 — registered() returns the insertion-order list, never mutated by callers', () => {
  const reg = loadRegistry();
  reg.register('first',  { outerNodes: {} });
  reg.register('second', { outerNodes: {} });
  reg.register('third',  { outerNodes: {} });
  const list = reg.registered();
  assert.deepEqual(list, ['first', 'second', 'third']);
  // Mutation of the returned array must not affect the registry's
  // internal order.
  list.push('intruder');
  assert.deepEqual(reg.registered(), ['first', 'second', 'third']);
});

test('F1A.2 — defaultSidebarPanel is read via get() like any other config field', () => {
  const reg = loadRegistry();
  reg.register('screenplay', { outerNodes: {}, defaultSidebarPanel: 'sceneNavigator' });
  const cfg = reg.get('screenplay');
  assert.equal(cfg.defaultSidebarPanel, 'sceneNavigator');
});
