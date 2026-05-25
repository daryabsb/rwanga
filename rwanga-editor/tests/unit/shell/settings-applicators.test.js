// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Applicators — Slice 3D.
//
// A small registry that lets settings-aware modules say "when this
// setting changes (or at boot), call this handler with the new
// value." The registry handles Store.subscribe internally so each
// applicator module is one register() call, not its own init dance.
//
// Slice 3D scope: registration mechanics + apply / applyAll + boot
// integration. NO new applicator behaviors, NO Settings UI, NO
// applicator enforcement beyond a shape check.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bootDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>',
                        { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  dom.window.Rga = {};
  // Stub prefs IPC so Store.init() resolves cleanly.
  dom.window.rwanga = {
    prefs: {
      read:  async function() { return {}; },
      write: async function() { return {}; }
    }
  };
  // Stub TabManager.activeDoc so script tier lookups return null.
  dom.window.Rga.TabManager = { activeDoc: function() { return null; } };
  return dom;
}

function loadSubstrate() {
  // Same load order as renderer/index.html.
  ['../../../renderer/js/shell/settings-validators.js',
   '../../../renderer/js/shell/settings-registry.js',
   '../../../renderer/js/shell/settings-store.js',
   '../../../renderer/js/shell/settings-applicators.js'
  ].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  return global.window.Rga.Settings;
}

// ----------------------------------------------------------------
// §1 — Module presence + public API
// ----------------------------------------------------------------

test('Slice 3D — Rga.Settings.Applicators exposes the registry surface', () => {
  bootDom();
  const S = loadSubstrate();
  assert.equal(typeof S.Applicators, 'object');
  ['register', 'get', 'apply', 'applyAll', 'registered', '_reset']
    .forEach(function(fn) {
      assert.equal(typeof S.Applicators[fn], 'function',
        'Applicators.' + fn + ' must be a function');
    });
});

// ----------------------------------------------------------------
// §2 — register / get / registered
// ----------------------------------------------------------------

test('Slice 3D — register() stores a handler retrievable via get()', () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  const handler = function() {};
  S.Applicators.register('editor.highlightCurrentLine', handler, { owner: 'editor' });
  const got = S.Applicators.get('editor.highlightCurrentLine');
  assert.ok(got, 'get() must return an object for a registered id');
  assert.equal(got.handler, handler);
  assert.equal(got.owner, 'editor');
});

test('Slice 3D — get() returns null for an unregistered id', () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  assert.equal(S.Applicators.get('not.registered'), null);
});

test('Slice 3D — registered() lists every registered id', () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  S.Applicators.register('editor.highlightCurrentLine', function() {});
  S.Applicators.register('editor.fontSize', function() {});
  const ids = S.Applicators.registered().sort();
  assert.deepEqual(ids, ['editor.fontSize', 'editor.highlightCurrentLine']);
});

test('Slice 3D — register() ignores invalid input (non-string id / non-function handler)', () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  S.Applicators.register(null, function() {});
  S.Applicators.register('editor.highlightCurrentLine', 'not-a-function');
  assert.deepEqual(S.Applicators.registered(), [],
    'invalid registrations must not populate the registry');
});

test('Slice 3D — re-registering the same id replaces the prior handler', () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  let firstCalls = 0, secondCalls = 0;
  S.Applicators.register('editor.highlightCurrentLine', function() { firstCalls += 1; });
  S.Applicators.register('editor.highlightCurrentLine', function() { secondCalls += 1; });
  S.Applicators.apply('editor.highlightCurrentLine', true);
  assert.equal(firstCalls,  0, 'replaced handler must not fire');
  assert.equal(secondCalls, 1, 'replacement handler must fire');
});

test('Slice 3D — many ids may share a single handler function', () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  const seen = [];
  const handler = function(v, id) { seen.push({ id, v }); };
  S.Applicators.register('editor.fontSize', handler);
  S.Applicators.register('editor.fontFamily', handler);
  S.Applicators.apply('editor.fontSize',   14);
  S.Applicators.apply('editor.fontFamily', 'Courier New');
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[0], { id: 'editor.fontSize',   v: 14 });
  assert.deepEqual(seen[1], { id: 'editor.fontFamily', v: 'Courier New' });
});

// ----------------------------------------------------------------
// §3 — apply() — single-id invocation
// ----------------------------------------------------------------

test('Slice 3D — apply(id, value) invokes the registered handler with (value, id)', () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  let seenVal, seenId;
  S.Applicators.register('editor.highlightCurrentLine', function(v, id) {
    seenVal = v; seenId = id;
  });
  S.Applicators.apply('editor.highlightCurrentLine', false);
  assert.equal(seenVal, false);
  assert.equal(seenId, 'editor.highlightCurrentLine');
});

test('Slice 3D — apply(id) with no value reads the effective from Store', async () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  await S.Store.init();
  let seen;
  S.Applicators.register('editor.highlightCurrentLine', function(v) { seen = v; });
  S.Applicators.apply('editor.highlightCurrentLine');
  // Registry default is true; no overrides; effective = true.
  assert.equal(seen, true);
});

test('Slice 3D — apply() on an unregistered id is a silent no-op (no console.warn)', () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  const warnCalls = [];
  const origWarn = global.window.console.warn;
  global.window.console.warn = function() { warnCalls.push(Array.from(arguments)); };
  try {
    S.Applicators.apply('not.registered', 'anything');
    assert.equal(warnCalls.length, 0,
      'missing applicator must NOT emit a console.warn');
  } finally {
    global.window.console.warn = origWarn;
  }
});

test('Slice 3D — handler errors are caught (one bad applicator does not block others)', () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  S.Applicators.register('a.bad', function() { throw new Error('boom'); });
  let okFired = false;
  S.Applicators.register('a.good', function() { okFired = true; });
  // No throw to caller.
  assert.doesNotThrow(function() {
    S.Applicators.apply('a.bad', 'x');
    S.Applicators.apply('a.good', 'y');
  });
  assert.equal(okFired, true);
});

// ----------------------------------------------------------------
// §4 — applyAll() — boot-time fanout
// ----------------------------------------------------------------

test('Slice 3D — applyAll() invokes every registered handler with effective values', async () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  await S.Store.init();
  const seen = {};
  S.Applicators.register('editor.highlightCurrentLine', function(v) { seen.hl = v; });
  S.Applicators.register('editor.fontSize',             function(v) { seen.fs = v; });
  S.Applicators.applyAll();
  // Registry defaults.
  assert.equal(seen.hl, true);
  assert.equal(seen.fs, 12);
});

test('Slice 3D — applyAll() is safe with zero registrations', () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  assert.doesNotThrow(function() { S.Applicators.applyAll(); });
});

// ----------------------------------------------------------------
// §5 — Store change → applicator fires
// ----------------------------------------------------------------

test('Slice 3D — Store.set() of a known id calls the registered applicator with the new value', async () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  await S.Store.init();
  let last;
  S.Applicators.register('editor.highlightCurrentLine', function(v) { last = v; });
  S.Store.set('editor.highlightCurrentLine', false);
  assert.equal(last, false,
    'applicator must observe the Store change');
});

test('Slice 3D — invalid Store.set() does NOT call the applicator', async () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  await S.Store.init();
  let calls = 0;
  S.Applicators.register('editor.highlightCurrentLine', function() { calls += 1; });
  // Invalid type — Slice 3C policy rejects.
  const ok = S.Store.set('editor.highlightCurrentLine', 'not-a-boolean');
  assert.equal(ok, false);
  assert.equal(calls, 0, 'rejected set() must not reach applicators');
});

test('Slice 3D — re-register replaces the Store subscription cleanly (no double-fire)', async () => {
  bootDom();
  const S = loadSubstrate();
  S.Applicators._reset();
  await S.Store.init();
  let firstCalls = 0, secondCalls = 0;
  S.Applicators.register('editor.highlightCurrentLine', function() { firstCalls += 1; });
  S.Applicators.register('editor.highlightCurrentLine', function() { secondCalls += 1; });
  S.Store.set('editor.highlightCurrentLine', false);
  assert.equal(firstCalls,  0, 'replaced handler must not fire on subsequent Store changes');
  assert.equal(secondCalls, 1, 'replacement handler must fire once per change');
});
