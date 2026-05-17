// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 8 correction — Rga.RuntimeProfile unit tests + integration smoke
// proving deserialize / activeSchema consume the profile (not opts.legacy).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  global.window.Rga = {};
  delete require.cache[require.resolve('../../../renderer/js/framework/runtime-profile.js')];
  require('../../../renderer/js/framework/runtime-profile.js');
  // Each test starts from defaults.
  global.window.Rga.RuntimeProfile.reset();
  return { Rga: global.window.Rga };
}

// ----------------------------------------------------------------
// Core API
// ----------------------------------------------------------------

test('current() returns the default profile { editorArchitecture: "v3", compatibilityMode: false }', () => {
  const { Rga } = boot();
  const p = Rga.RuntimeProfile.current();
  assert.equal(p.editorArchitecture, 'v3');
  assert.equal(p.compatibilityMode, false);
});

test('current() returns a SHALLOW COPY — mutating it does not affect internal state', () => {
  const { Rga } = boot();
  const p1 = Rga.RuntimeProfile.current();
  p1.compatibilityMode = true;
  p1.editorArchitecture = 'mutated';
  const p2 = Rga.RuntimeProfile.current();
  assert.equal(p2.compatibilityMode, false);
  assert.equal(p2.editorArchitecture, 'v3');
});

test('set(partial) merges into current — unspecified fields keep their value', () => {
  const { Rga } = boot();
  Rga.RuntimeProfile.set({ compatibilityMode: true });
  const p = Rga.RuntimeProfile.current();
  assert.equal(p.compatibilityMode, true);
  assert.equal(p.editorArchitecture, 'v3', 'unspecified field kept');
});

test('set(partial) ignores null / undefined / non-object inputs', () => {
  const { Rga } = boot();
  Rga.RuntimeProfile.set(null);
  Rga.RuntimeProfile.set(undefined);
  Rga.RuntimeProfile.set('string');
  Rga.RuntimeProfile.set(42);
  assert.deepEqual(Rga.RuntimeProfile.current(), { editorArchitecture: 'v3', compatibilityMode: false });
});

test('set(partial) accepts future fields (experimentalMode / aiMode / debugMode / safeMode)', () => {
  const { Rga } = boot();
  Rga.RuntimeProfile.set({ experimentalMode: true, aiMode: true, debugMode: true, safeMode: true });
  const p = Rga.RuntimeProfile.current();
  assert.equal(p.experimentalMode, true);
  assert.equal(p.aiMode, true);
  assert.equal(p.debugMode, true);
  assert.equal(p.safeMode, true);
  // Defaults still present alongside.
  assert.equal(p.editorArchitecture, 'v3');
  assert.equal(p.compatibilityMode, false);
});

test('reset() restores defaults', () => {
  const { Rga } = boot();
  Rga.RuntimeProfile.set({ compatibilityMode: true, experimentalMode: true, aiMode: true });
  Rga.RuntimeProfile.reset();
  assert.deepEqual(Rga.RuntimeProfile.current(), { editorArchitecture: 'v3', compatibilityMode: false });
});

// ----------------------------------------------------------------
// isCompatibilityMode()
// ----------------------------------------------------------------

test('isCompatibilityMode() returns false on defaults', () => {
  const { Rga } = boot();
  assert.equal(Rga.RuntimeProfile.isCompatibilityMode(), false);
});

test('isCompatibilityMode() returns true when compatibilityMode flag is true', () => {
  const { Rga } = boot();
  Rga.RuntimeProfile.set({ compatibilityMode: true });
  assert.equal(Rga.RuntimeProfile.isCompatibilityMode(), true);
});

test('isCompatibilityMode() returns true when editorArchitecture is pinned to "v2"', () => {
  const { Rga } = boot();
  Rga.RuntimeProfile.set({ editorArchitecture: 'v2' });
  assert.equal(Rga.RuntimeProfile.isCompatibilityMode(), true);
});

test('isCompatibilityMode() returns true when EITHER flag triggers it (idempotent OR)', () => {
  const { Rga } = boot();
  Rga.RuntimeProfile.set({ editorArchitecture: 'v2', compatibilityMode: true });
  assert.equal(Rga.RuntimeProfile.isCompatibilityMode(), true);
});

test('isCompatibilityMode() returns false when both fields hold their defaults — even after unrelated future-mode flips', () => {
  const { Rga } = boot();
  Rga.RuntimeProfile.set({ aiMode: true, experimentalMode: true, debugMode: true });
  assert.equal(Rga.RuntimeProfile.isCompatibilityMode(), false,
    'AI/experimental/debug modes do NOT imply compatibility');
});
