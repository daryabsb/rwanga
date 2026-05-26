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
  // Validators → Registry → Store. Same load order as
  // renderer/index.html. The store validates writes through the
  // validators module (Slice 3C); the registry consults validators
  // during its own load-time shape check.
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-validators.js')];
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-registry.js')];
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-store.js')];
  require('../../../renderer/js/shell/settings-validators.js');
  require('../../../renderer/js/shell/settings-registry.js');
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
  // H2B: this test exercises the script-tier-overrides-user pattern.
  // Per the Settings Constitution, that pattern is allowed ONLY for
  // entries whose registry says `persistsTo: 'script'`. We swap the
  // proof setting from editor.highlightCurrentLine (persistsTo:'user',
  // now constitutionally locked) to screenplay.sceneNumbering, which
  // is per-script by design.
  const dom = bootDom();
  const S = loadStore();
  await S.init();
  S.set('screenplay.sceneNumbering', false, { tier: 'user' });
  // Active doc has the setting at script tier.
  dom.window.Rga.TabManager.activeDoc = function() {
    return { settings: { 'screenplay.sceneNumbering': true } };
  };
  assert.equal(S.effective('screenplay.sceneNumbering'), true,
    'script-tier (doc.settings) wins over user for persistsTo:script entries');
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
  // H2B note: the Settings Constitution forbids script-tier shadowing
  // of user-tier ids. This test must use a `persistsTo:'script'` entry
  // to exercise the cascade legitimately. screenplay.sceneNumbering
  // (toggle, default true) is per-script by design.
  const dom = bootDom();
  const S = loadStore();
  await S.init();
  const seen = [];
  S.subscribe('screenplay.sceneNumbering', function(newVal, oldVal) {
    seen.push({ newVal, oldVal });
  });
  // Doc A has script-tier override `false`; activate it.
  dom.window.Rga.TabManager.activeDoc = function() {
    return { settings: { 'screenplay.sceneNumbering': false } };
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

test('H2B — constitutional: per-script settings cannot shadow user-tier ids', async () => {
  // Even if a legacy .rga doc has `theme` baked into its settings blob,
  // the Store must not let it override the user's choice. This is the
  // direct fix for the close/reopen reversion bug.
  const dom = bootDom();
  const S = loadStore();
  await S.init();
  S.set('theme', 'light');                          // user tier
  dom.window.Rga.TabManager.activeDoc = function() {
    return { settings: { theme: 'dark' } };         // legacy script-tier override
  };
  assert.equal(S.effective('theme'), 'light',
    'user-tier MUST win over per-script for persistsTo:user ids');
  assert.equal(S.get('theme', 'script'), undefined,
    'script tier read MUST return undefined for persistsTo:user ids');
});

// ----------------------------------------------------------------
// Slice 3C — set() validation policy
//
// Policy: set() returns boolean. true = write succeeded; false =
// rejected. Rejection causes: unknown id, value fails the entry's
// type validator, unknown tier, project tier (stub), script tier
// with no active doc. On rejection: console.warn, no mutation, no
// emit, no persist.
// ----------------------------------------------------------------

test('Slice 3C — set() returns true on a valid write', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  assert.equal(S.set('editor.highlightCurrentLine', false), true);
  assert.equal(S.effective('editor.highlightCurrentLine'), false);
});

test('Slice 3C — set() returns false when the value fails the boolean validator', async () => {
  const dom = bootDom();
  const S = loadStore();
  await S.init();
  // editor.highlightCurrentLine is a toggle → boolean validator.
  const result = S.set('editor.highlightCurrentLine', 'true');
  assert.equal(result, false, 'set must return false on invalid value');
  // No mutation: effective remains the registry default (true).
  assert.equal(S.effective('editor.highlightCurrentLine'), true);
  // No persist.
  assert.equal(dom.window.__prefsWrites.length, 0);
});

test('Slice 3C — set() returns false when a number setting receives a non-number', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  assert.equal(S.set('editor.fontSize', '12pt'), false);
  // effective stays at the registry default.
  assert.equal(S.effective('editor.fontSize'), 12);
});

test('Slice 3C — set() returns false when a select receives a value not in options', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  assert.equal(S.set('language', 'fr'), false);
  assert.equal(S.effective('language'), 'en');
});

test('Slice 3C — set() returns false when a color receives an invalid hex', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  assert.equal(S.set('appearance.editorDeskColor', 'red'),       false);
  assert.equal(S.set('appearance.editorDeskColor', '#fff'),      false);
  assert.equal(S.set('appearance.editorDeskColor', '#141414'),   true,
    'valid 6-hex must be accepted');
});

test('Slice 3C — set() returns false when a shortcut receives a malformed chord', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  assert.equal(S.set('kb.save', 'foo bar'), false);
  assert.equal(S.set('kb.save', 'Ctrl+'),   false);
  assert.equal(S.set('kb.save', 'Ctrl+X'),  true);
});

test('Slice 3C — set() returns false when margins receive a malformed object', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  assert.equal(S.set('pageSetup.margins', { top: 1 }),                       false);
  assert.equal(S.set('pageSetup.margins', { top: -1, bottom: 1, left: 1, right: 1 }), false);
  assert.equal(S.set('pageSetup.margins', { top: 1, bottom: 1, left: 1, right: 1 }),  true);
});

test('Slice 3C — set() returns false for an unknown registry id', async () => {
  const dom = bootDom();
  const S = loadStore();
  await S.init();
  assert.equal(S.set('not.a.real.setting', true), false);
  assert.equal(dom.window.__prefsWrites.length, 0);
});

test('Slice 3C — invalid set() does NOT notify subscribers', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  const seen = [];
  S.subscribe('editor.highlightCurrentLine', function(n, o) { seen.push({ n, o }); });
  // Invalid type: subscriber must remain idle.
  const result = S.set('editor.highlightCurrentLine', 'not-a-boolean');
  assert.equal(result, false);
  assert.equal(seen.length, 0,
    'subscribers must not fire when set() was rejected');
});

test('Slice 3C — invalid set() does NOT persist to user-tier prefs', async () => {
  const dom = bootDom();
  const S = loadStore();
  await S.init();
  S.set('editor.highlightCurrentLine', 'nope');
  await tick();
  assert.equal(dom.window.__prefsWrites.length, 0,
    'rejected set must not call prefs.write');
});

test('Slice 3C — set() at session tier also validates and rejects invalid values', async () => {
  bootDom();
  const S = loadStore();
  await S.init();
  assert.equal(S.set('editor.highlightCurrentLine', 1, { tier: 'session' }), false);
  // No session-tier mutation: effective falls back to registry default.
  assert.equal(S.effective('editor.highlightCurrentLine'), true);
});
