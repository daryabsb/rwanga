// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.1 — Rga.Platform helper unit tests.
//
// The Electron contextBridge prevents renderer-side mutation of
// window.rwanga, so the Playwright smoke spec covers only the
// standalone (absence) path. These jsdom tests prove the helper's
// behaviour when a platform host IS present — the future-compat
// scenario where the preload exposes window.rwanga.platform.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bootDomWithPlatform(platformObj) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
                        { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = {};
  // Simulate the Electron preload's window.rwanga surface (plain object
  // here — jsdom doesn't enforce the contextBridge freeze).
  dom.window.rwanga = { platform: platformObj };
  return dom;
}

function bootDomWithoutPlatform() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
                        { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = {};
  dom.window.rwanga = {};   // bridge present, but no .platform.
  return dom;
}

function bootDomNoBridge() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
                        { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = {};
  // No window.rwanga at all (e.g., a future non-Electron host that
  // never installed the bridge).
  return dom;
}

function loadHelper() {
  const p = '../../renderer/js/platform.js';
  delete require.cache[require.resolve(p)];
  require(p);
  return global.window.Rga.Platform;
}

// ----------------------------------------------------------------
// §1 — Standalone mode (no platform): every probe returns falsy.
// ----------------------------------------------------------------

test('F1A.1 — Rga.Platform.has() = false when window.rwanga.platform is undefined', () => {
  bootDomWithoutPlatform();
  const P = loadHelper();
  assert.equal(P.has(), false);
  assert.equal(P.has('anything'), false);
  assert.equal(P.invoke('anything'), undefined);
  assert.equal(P.get('user.id'), undefined);
  assert.equal(P._raw(), null);
});

test('F1A.1 — Rga.Platform tolerates an absent window.rwanga bridge entirely', () => {
  bootDomNoBridge();
  const P = loadHelper();
  assert.equal(P.has(), false);
  assert.equal(P.invoke('anything'), undefined);
  assert.equal(P.get('user.id'), undefined);
  assert.equal(P._raw(), null);
});

// ----------------------------------------------------------------
// §2 — has() with a present platform.
// ----------------------------------------------------------------

test('F1A.1 — has() returns true / false based on platform feature presence', () => {
  bootDomWithPlatform({
    shareScript: function() {},
    user:        { id: 'u-1' },
    nestedFlag:  true,
    falseyFlag:  false,
    nullFlag:    null,
    zeroFlag:    0
  });
  const P = loadHelper();
  assert.equal(P.has(), true,                 'platform exists → has() with no args is true');
  assert.equal(P.has('shareScript'), true,    'function feature → true');
  assert.equal(P.has('user'), true,           'object feature → true');
  assert.equal(P.has('nestedFlag'), true,     'truthy primitive → true');
  // Defined-but-falsy values still count as "present" (typeof !== 'undefined').
  assert.equal(P.has('falseyFlag'), true,     'false-valued property still present');
  assert.equal(P.has('nullFlag'), true,       'null-valued property still present');
  assert.equal(P.has('zeroFlag'), true,       '0-valued property still present');
  assert.equal(P.has('missing'), false,       'missing property → false');
});

test('F1A.1 — has() with non-string args is defensive', () => {
  bootDomWithPlatform({ a: 1 });
  const P = loadHelper();
  assert.equal(P.has(''), true,           'empty string → existence probe (no specific feature)');
  assert.equal(P.has(undefined), true,    'undefined → existence probe');
  assert.equal(P.has({}), true,           'object → existence probe');
  assert.equal(P.has(42), true,           'number → existence probe');
});

// ----------------------------------------------------------------
// §3 — invoke() routes through the platform's method.
// ----------------------------------------------------------------

test('F1A.1 — invoke() calls platform method with args and returns its value', () => {
  const calls = [];
  bootDomWithPlatform({
    add:   function(a, b) { calls.push(['add', a, b]); return a + b; },
    say:   function() { return 'hello'; },
    inert: 42        // not callable — invoke should return undefined.
  });
  const P = loadHelper();
  assert.equal(P.invoke('add', 2, 3), 5);
  assert.equal(P.invoke('say'), 'hello');
  assert.equal(P.invoke('inert'), undefined,    'non-function feature → undefined');
  assert.equal(P.invoke('missing'), undefined,  'absent feature → undefined');
  assert.deepEqual(calls, [['add', 2, 3]]);
});

test('F1A.1 — invoke() preserves `this` binding to the platform object', () => {
  bootDomWithPlatform({
    nameProp: 'Plat',
    getName:  function() { return this.nameProp; }
  });
  const P = loadHelper();
  assert.equal(P.invoke('getName'), 'Plat',
    'platform method called with platform as `this` — can read sibling props');
});

test('F1A.1 — invoke() wraps thrown errors (editor never crashes on platform bugs)', () => {
  bootDomWithPlatform({
    boom: function() { throw new Error('platform-side bug'); }
  });
  const P = loadHelper();
  // Capture console.error so we confirm the helper logs the boundary
  // crossing without re-throwing.
  const originalError = console.error;
  const logged = [];
  console.error = function() { logged.push(Array.from(arguments)); };
  try {
    const v = P.invoke('boom');
    assert.equal(v, undefined,                       'thrown errors → invoke returns undefined');
    assert.ok(logged.length >= 1,                    'console.error called once');
    assert.ok(/platform\.boom/.test(logged[0][0]),   'log message names the feature');
  } finally {
    console.error = originalError;
  }
});

// ----------------------------------------------------------------
// §4 — get() reads dotted paths.
// ----------------------------------------------------------------

test('F1A.1 — get() reads top-level + nested paths; missing paths → undefined', () => {
  bootDomWithPlatform({
    user:  { id: 'u-1', profile: { name: 'A', age: 30 } },
    flag:  true,
    array: [1, 2, 3]
  });
  const P = loadHelper();
  assert.equal(P.get('flag'), true);
  assert.equal(P.get('user.id'), 'u-1');
  assert.equal(P.get('user.profile.name'), 'A');
  assert.equal(P.get('user.profile.age'), 30);
  // Walking past a leaf — returns undefined cleanly.
  assert.equal(P.get('flag.nope'), undefined);
  assert.equal(P.get('user.missing.deeper'), undefined);
  assert.equal(P.get('completely.unknown.path'), undefined);
});

test('F1A.1 — get() with invalid input returns undefined cleanly', () => {
  bootDomWithPlatform({ a: 1 });
  const P = loadHelper();
  assert.equal(P.get(''), undefined,         'empty string → undefined');
  assert.equal(P.get(undefined), undefined,  'undefined → undefined');
  assert.equal(P.get(null), undefined,       'null → undefined');
  assert.equal(P.get(42), undefined,         'number → undefined');
});

// ----------------------------------------------------------------
// §5 — Helper re-reads each call (no caching of absence/presence).
//      A future platform installed AFTER boot is observable.
// ----------------------------------------------------------------

test('F1A.1 — helper observes a platform installed after boot (no cached absence)', () => {
  const dom = bootDomWithoutPlatform();
  const P = loadHelper();
  assert.equal(P.has(), false);
  // Simulate a late-loading platform (in jsdom we can assign freely —
  // the contextBridge restriction doesn't apply outside Electron).
  dom.window.rwanga.platform = { lateFeature: function() { return 'late'; } };
  assert.equal(P.has(), true);
  assert.equal(P.has('lateFeature'), true);
  assert.equal(P.invoke('lateFeature'), 'late');
});

test('F1A.1 — helper observes a platform removed after boot (no cached presence)', () => {
  const dom = bootDomWithPlatform({ x: function() { return 1; } });
  const P = loadHelper();
  assert.equal(P.has(), true);
  delete dom.window.rwanga.platform;
  assert.equal(P.has(), false);
  assert.equal(P.invoke('x'), undefined);
});
