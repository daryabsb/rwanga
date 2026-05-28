// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.5 — Rga.SceneNotes shared source unit tests.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function loadSource() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
                        { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  const modPath = require.resolve(
    '../../../../renderer/js/doc-types/screenplay/scene-notes.js');
  delete require.cache[modPath];
  require(modPath);
  const SN = global.window.Rga.SceneNotes;
  SN._reset();
  return SN;
}

// ----------------------------------------------------------------
// §1 — Public API
// ----------------------------------------------------------------

test('F1A.5 — Rga.SceneNotes exposes the documented public API', () => {
  const SN = loadSource();
  ['get', 'set', 'currentSceneId', 'currentSceneName', 'setCurrentScene',
   'subscribe', '_reset']
    .forEach(function(fn) {
      assert.equal(typeof SN[fn], 'function', fn + ' must be a function');
    });
});

// ----------------------------------------------------------------
// §2 — get / set
// ----------------------------------------------------------------

test('F1A.5 — get() returns empty string for unknown scene', () => {
  const SN = loadSource();
  assert.equal(SN.get('s1'), '');
  assert.equal(SN.get(''), '');
  assert.equal(SN.get(null), '');
  assert.equal(SN.get(undefined), '');
  assert.equal(SN.get(42), '');
});

test('F1A.5 — set() stores notes; get() returns them', () => {
  const SN = loadSource();
  SN.set('s1', 'first note');
  assert.equal(SN.get('s1'), 'first note');
  SN.set('s1', 'second note');
  assert.equal(SN.get('s1'), 'second note');
  // Different scene gets its own value.
  SN.set('s2', 'note two');
  assert.equal(SN.get('s2'), 'note two');
  assert.equal(SN.get('s1'), 'second note');
});

test('F1A.5 — set() coerces non-string values to strings', () => {
  const SN = loadSource();
  SN.set('s1', 42);
  assert.equal(SN.get('s1'), '42');
  SN.set('s1', null);
  assert.equal(SN.get('s1'), '');   // null → falsy → ''
  SN.set('s1', undefined);
  assert.equal(SN.get('s1'), '');
});

test('F1A.5 — set() with invalid sceneId is a safe no-op', () => {
  const SN = loadSource();
  SN.set('', 'x');
  SN.set(null, 'x');
  SN.set(undefined, 'x');
  SN.set(42, 'x');
  assert.equal(SN.get('s1'), '');
});

// ----------------------------------------------------------------
// §3 — currentSceneId / setCurrentScene
// ----------------------------------------------------------------

test('F1A.5 — currentSceneId() returns null on fresh boot', () => {
  const SN = loadSource();
  assert.equal(SN.currentSceneId(), null);
  assert.equal(SN.currentSceneName(), null);
});

test('F1A.5 — setCurrentScene updates the tracked scene + name', () => {
  const SN = loadSource();
  SN.setCurrentScene('s1', 'INT. KITCHEN — NIGHT');
  assert.equal(SN.currentSceneId(), 's1');
  assert.equal(SN.currentSceneName(), 'INT. KITCHEN — NIGHT');
});

test('F1A.5 — setCurrentScene(null) clears the current scene', () => {
  const SN = loadSource();
  SN.setCurrentScene('s1', 'A');
  SN.setCurrentScene(null, '');
  assert.equal(SN.currentSceneId(), null);
});

test('F1A.5 — setCurrentScene rejects empty/non-string ids by clearing', () => {
  const SN = loadSource();
  SN.setCurrentScene('', 'name');
  assert.equal(SN.currentSceneId(), null);
  SN.setCurrentScene('s1', 'A');
  SN.setCurrentScene(42, 'name');
  assert.equal(SN.currentSceneId(), null);
});

// ----------------------------------------------------------------
// §4 — subscribe / notifications
// ----------------------------------------------------------------

test('F1A.5 — subscribe receives "notes" events with sceneId + value', () => {
  const SN = loadSource();
  const events = [];
  SN.subscribe(function(e, p) { events.push([e, p]); });
  SN.set('s1', 'hello');
  assert.equal(events.length, 1);
  assert.equal(events[0][0], 'notes');
  assert.deepEqual(events[0][1], { sceneId: 's1', value: 'hello' });
});

test('F1A.5 — subscribe receives "current" events on setCurrentScene', () => {
  const SN = loadSource();
  const events = [];
  SN.subscribe(function(e, p) { events.push([e, p]); });
  SN.setCurrentScene('s1', 'A');
  assert.equal(events.length, 1);
  assert.equal(events[0][0], 'current');
  assert.deepEqual(events[0][1], { sceneId: 's1', sceneName: 'A' });
});

test('F1A.5 — no-op writes do NOT fire notifications', () => {
  const SN = loadSource();
  SN.set('s1', 'x');
  const events = [];
  SN.subscribe(function(e, p) { events.push([e, p]); });
  SN.set('s1', 'x');           // same value → no event
  SN.setCurrentScene(null);    // already null → no event
  assert.equal(events.length, 0);
});

test('F1A.5 — subscribe returns unsubscribe; unsubscribe stops further events', () => {
  const SN = loadSource();
  const events = [];
  const off = SN.subscribe(function(e) { events.push(e); });
  SN.set('s1', 'a');
  off();
  SN.set('s1', 'b');
  assert.equal(events.length, 1);
});

test('F1A.5 — a throwing listener does not break dispatch to others', () => {
  const originalError = console.error;
  console.error = function() {};
  try {
    const SN = loadSource();
    const reached = [];
    SN.subscribe(function() { throw new Error('listener-boom'); });
    SN.subscribe(function(e) { reached.push(e); });
    SN.set('s1', 'x');
    assert.deepEqual(reached, ['notes']);
  } finally {
    console.error = originalError;
  }
});

// ----------------------------------------------------------------
// §5 — _reset
// ----------------------------------------------------------------

test('F1A.5 — _reset clears notes, current scene, and listeners', () => {
  const SN = loadSource();
  let calls = 0;
  SN.subscribe(function() { calls += 1; });
  SN.set('s1', 'x');
  SN.setCurrentScene('s1', 'A');
  assert.equal(calls, 2);
  SN._reset();
  assert.equal(SN.get('s1'), '');
  assert.equal(SN.currentSceneId(), null);
  // Old listener is gone — further changes do not fire it.
  SN.set('s2', 'y');
  assert.equal(calls, 2);
});
