// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Store substrate — Slice 2.
//
// Foundation only: tier resolution, effective value, subscribe/emit,
// persistence behavior. NO registry, NO migration, NO validators.
// The one proof setting is `editor.highlightCurrentLine`.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// ----------------------------------------------------------------
// Test fixtures
// ----------------------------------------------------------------

function bootDom(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
                        { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  dom.window.Rga = {};

  // Fake prefs IPC. Defaults to an empty pref file; tests can pass a
  // seed via opts.seedPrefs to simulate a prior session's persisted state.
  const _store = Object.assign({}, opts.seedPrefs || {});
  const _writes = [];
  dom.window.rwanga = {
    prefs: {
      read: async function() { return JSON.parse(JSON.stringify(_store)); },
      write: async function(partial) {
        _writes.push(partial);
        Object.assign(_store, partial);
        return _store;
      }
    }
  };
  // Expose so tests can introspect.
  dom.window.__prefsStore = _store;
  dom.window.__prefsWrites = _writes;

  // Fake TabManager so the script-tier path has somewhere to look.
  // Tests that exercise script tier replace activeDoc() per-call.
  dom.window.Rga.TabManager = { activeDoc: function() { return null; } };

  return dom;
}

function loadStore() {
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-store.js')];
  require('../../../renderer/js/shell/settings-store.js');
  return global.window.Rga.Settings.Store;
}

// Tiny helper: settle pending microtasks (prefs.read returns a Promise).
function tick() { return new Promise((r) => setImmediate(r)); }

// ----------------------------------------------------------------
// Tier resolution + built-in defaults
// ----------------------------------------------------------------

test('Slice 2 — effective() returns the built-in default when no tier has been set', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  // Slice 2 ships a single proof setting whose built-in default is true.
  assert.equal(S.effective('editor.highlightCurrentLine'), true);
});

test('Slice 2 — effective() returns undefined for an unknown id', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  assert.equal(S.effective('not.a.real.setting'), undefined);
});

test('Slice 2 — set() with no opts defaults to the user tier', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  S.set('editor.highlightCurrentLine', false);
  assert.equal(S.get('editor.highlightCurrentLine', 'user'), false);
  assert.equal(S.effective('editor.highlightCurrentLine'), false);
});

test('Slice 2 — session tier overrides user tier in effective()', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  S.set('editor.highlightCurrentLine', false, { tier: 'user' });
  S.set('editor.highlightCurrentLine', true,  { tier: 'session' });
  assert.equal(S.effective('editor.highlightCurrentLine'), true,
    'session wins over user');
});

test('Slice 2 — script tier reads from the active doc.settings (overrides user)', async () => {
  const dom = bootDom();
  const S = loadStore();
  await S.init();
  S.set('editor.highlightCurrentLine', false, { tier: 'user' });
  // Active doc has the setting at script tier.
  dom.window.Rga.TabManager.activeDoc = function() {
    return { settings: { 'editor.highlightCurrentLine': true } };
  };
  assert.equal(S.effective('editor.highlightCurrentLine'), true,
    'script-tier (doc.settings) wins over user');
});

test('Slice 2 — project tier set is a no-op (returns undefined at that tier)', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  S.set('editor.highlightCurrentLine', false, { tier: 'project' });
  assert.equal(S.get('editor.highlightCurrentLine', 'project'), undefined,
    'project tier is a stub — writes are dropped, reads return undefined');
  // Effective falls back to built-in default since user/script/session are empty.
  assert.equal(S.effective('editor.highlightCurrentLine'), true);
});

// ----------------------------------------------------------------
// Persistence behavior
// ----------------------------------------------------------------

test('Slice 2 — init() hydrates user tier from window.rwanga.prefs.read()', async () => {
  bootDom({ seedPrefs: { 'editor.highlightCurrentLine': false } });
  const S = loadStore();
  await S.init();
  assert.equal(S.get('editor.highlightCurrentLine', 'user'), false,
    'init() must read existing user-tier values from prefs storage');
  assert.equal(S.effective('editor.highlightCurrentLine'), false);
});

test('Slice 2 — set(id, val) at user tier calls window.rwanga.prefs.write with the partial', async () => {
  const dom = bootDom();
  const S = loadStore();
  await S.init();
  S.set('editor.highlightCurrentLine', false);
  await tick();  // let the async prefs.write settle
  const writes = dom.window.__prefsWrites;
  assert.equal(writes.length, 1, 'one prefs.write should fire on one user-tier set');
  assert.deepEqual(writes[0], { 'editor.highlightCurrentLine': false });
});

test('Slice 2 — set() at session tier does NOT call prefs.write', async () => {
  const dom = bootDom();
  const S = loadStore();
  await S.init();
  S.set('editor.highlightCurrentLine', false, { tier: 'session' });
  await tick();
  assert.equal(dom.window.__prefsWrites.length, 0,
    'session tier is memory-only — must never touch user prefs storage');
});

// ----------------------------------------------------------------
// Subscriptions
// ----------------------------------------------------------------

test('Slice 2 — subscribe() fires the handler when effective changes', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  const seen = [];
  S.subscribe('editor.highlightCurrentLine', function(newVal, oldVal) {
    seen.push({ newVal, oldVal });
  });
  S.set('editor.highlightCurrentLine', false);
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], { newVal: false, oldVal: true });
});

test('Slice 2 — subscribe() does NOT fire when set value equals current effective', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  S.set('editor.highlightCurrentLine', false);  // first move: true → false
  const seen = [];
  S.subscribe('editor.highlightCurrentLine', function() { seen.push(true); });
  S.set('editor.highlightCurrentLine', false);  // same value — must not fire
  assert.equal(seen.length, 0);
});

test('Slice 2 — subscribe() returns an unsubscribe function', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  const seen = [];
  const off = S.subscribe('editor.highlightCurrentLine', function() { seen.push(true); });
  S.set('editor.highlightCurrentLine', false);
  assert.equal(seen.length, 1);
  off();  // unsubscribe
  S.set('editor.highlightCurrentLine', true);
  assert.equal(seen.length, 1, 'no further events after unsubscribe');
});

test('Slice 2 — unsubscribe(id, handler) also removes the handler', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  const seen = [];
  const handler = function() { seen.push(true); };
  S.subscribe('editor.highlightCurrentLine', handler);
  S.unsubscribe('editor.highlightCurrentLine', handler);
  S.set('editor.highlightCurrentLine', false);
  assert.equal(seen.length, 0);
});

test('Slice 2 — multiple subscribers all receive the event', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  let countA = 0, countB = 0;
  S.subscribe('editor.highlightCurrentLine', function() { countA += 1; });
  S.subscribe('editor.highlightCurrentLine', function() { countB += 1; });
  S.set('editor.highlightCurrentLine', false);
  assert.equal(countA, 1);
  assert.equal(countB, 1);
});

test('Slice 2 — tab activation re-emits when the script-tier value changes effective', async () => {
  const dom = bootDom();
  const S = loadStore();
  await S.init();
  const seen = [];
  S.subscribe('editor.highlightCurrentLine', function(newVal, oldVal) {
    seen.push({ newVal, oldVal });
  });
  // Doc A has script-tier override `false`; activate it.
  dom.window.Rga.TabManager.activeDoc = function() {
    return { settings: { 'editor.highlightCurrentLine': false } };
  };
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(
    'editor.tabActivated', { detail: { tabId: 'A' } }));
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], { newVal: false, oldVal: true });
  // Doc B has no override; activate it. Effective flips back to built-in.
  dom.window.Rga.TabManager.activeDoc = function() {
    return { settings: {} };
  };
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(
    'editor.tabActivated', { detail: { tabId: 'B' } }));
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[1], { newVal: true, oldVal: false });
});
