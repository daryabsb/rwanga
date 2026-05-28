// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.6 — Rga.Shell.Toolbar registry unit tests.
//
// Locks the new public API, the order-based mount placement, the
// fail-safe behaviour, and the F1A.6 dormancy expectation (no group
// is registered when CORE alone is loaded).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Mirrors the post-F1A.6 toolbar inner band: a content slot between
// text and writing groups. Plugin contributions mount inside the slot.
const HTML = '<!DOCTYPE html><html><body>' +
  '<div id="rga-shell-toolbar">' +
    '<div class="rga-shell-toolbar-inner">' +
      '<div class="rga-shell-toolbar-group" data-group="text">[text]</div>' +
      '<div class="rga-shell-toolbar-content-slot" data-toolbar-slot="content"></div>' +
      '<div class="rga-shell-toolbar-group-sep"></div>' +
      '<div class="rga-shell-toolbar-group" data-group="writing">[writing]</div>' +
    '</div>' +
  '</div>' +
  '</body></html>';

function boot() {
  const dom = new JSDOM(HTML, { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  const modPath = require.resolve('../../../renderer/js/shell/toolbar.js');
  delete require.cache[modPath];
  require(modPath);
  const TB = global.window.Rga.Shell.Toolbar;
  TB._reset();
  return { Rga: global.window.Rga, Toolbar: TB, dom };
}

function fakeGroup(opts) {
  opts = opts || {};
  return {
    id: opts.id || 'fake',
    order: opts.order != null ? opts.order : 0,
    dataGroup: opts.dataGroup,
    className: opts.className,
    mount: function(el) {
      this.mountCalls = (this.mountCalls || 0) + 1;
      this.lastMountEl = el;
      if (opts.mountThrows) throw new Error('mount-boom');
      if (opts.mountHtml) el.innerHTML = opts.mountHtml;
      return opts.cleanup;
    },
    unmount: function(el) {
      this.unmountCalls = (this.unmountCalls || 0) + 1;
      this.lastUnmountEl = el;
      if (opts.unmountThrows) throw new Error('unmount-boom');
    }
  };
}

function slot(dom) {
  return dom.window.document.querySelector('[data-toolbar-slot="content"]');
}

// ----------------------------------------------------------------
// §1 — Public API surface
// ----------------------------------------------------------------

test('F1A.6 — Rga.Shell.Toolbar exposes the documented public API', () => {
  const { Toolbar } = boot();
  ['setHost', 'getHost', 'registerGroup', 'unregisterGroup',
   'registered', 'getController', '_reset'].forEach(function(fn) {
    assert.equal(typeof Toolbar[fn], 'function', fn + ' must be a function');
  });
});

test('F1A.6 — fresh boot: registered() is empty (frame-only API; no production groups in this module)', () => {
  const { Toolbar } = boot();
  assert.deepEqual(Toolbar.registered(), []);
});

// ----------------------------------------------------------------
// §2 — Registration semantics
// ----------------------------------------------------------------

test('F1A.6 — registerGroup returns true for a valid controller', () => {
  const { Toolbar } = boot();
  assert.equal(Toolbar.registerGroup(fakeGroup({ id: 'a', order: 100 })), true);
  assert.deepEqual(Toolbar.registered(), ['a']);
});

test('F1A.6 — duplicate id rejected (Sidebar/Inspector parity)', () => {
  const { Toolbar } = boot();
  assert.equal(Toolbar.registerGroup(fakeGroup({ id: 'dup' })), true);
  assert.equal(Toolbar.registerGroup(fakeGroup({ id: 'dup' })), false);
  assert.deepEqual(Toolbar.registered(), ['dup']);
});

test('F1A.6 — invalid controllers rejected without throwing', () => {
  const { Toolbar } = boot();
  assert.equal(Toolbar.registerGroup(null), false);
  assert.equal(Toolbar.registerGroup(undefined), false);
  assert.equal(Toolbar.registerGroup({}), false);
  assert.equal(Toolbar.registerGroup({ id: '' }), false);
  assert.equal(Toolbar.registerGroup({ id: 42 }), false);
  assert.equal(Toolbar.registerGroup({ id: 'no-mount' }), false);
  assert.equal(Toolbar.registerGroup({ id: 'bad', mount: 'not-fn' }), false);
  assert.equal(Toolbar.registerGroup(
    { id: 'bad-order', mount: function() {}, order: 'not-number' }), false);
  assert.deepEqual(Toolbar.registered(), []);
});

test('F1A.6 — getController returns the registered controller; null for unknown', () => {
  const { Toolbar } = boot();
  const g = fakeGroup({ id: 'a' });
  Toolbar.registerGroup(g);
  assert.equal(Toolbar.getController('a'), g);
  assert.equal(Toolbar.getController('unknown'), null);
  assert.equal(Toolbar.getController(null), null);
});

// ----------------------------------------------------------------
// §3 — Pre-init queue: groups register BEFORE setHost, mount on setHost
// ----------------------------------------------------------------

test('F1A.6 — groups registered BEFORE setHost mount when setHost runs', () => {
  const { Toolbar, dom } = boot();
  const g = fakeGroup({ id: 'scene', order: 200, mountHtml: '<span>scene-content</span>' });
  Toolbar.registerGroup(g);
  assert.equal(g.mountCalls, undefined, 'mount NOT called before setHost');
  Toolbar.setHost(slot(dom));
  assert.equal(g.mountCalls, 1);
  assert.ok(slot(dom).querySelector('[data-toolbar-group-id="scene"]'));
  assert.ok(slot(dom).querySelector('span').textContent === 'scene-content');
});

test('F1A.6 — groups registered AFTER setHost mount immediately', () => {
  const { Toolbar, dom } = boot();
  Toolbar.setHost(slot(dom));
  const g = fakeGroup({ id: 'scene', order: 200, mountHtml: '<span>S</span>' });
  Toolbar.registerGroup(g);
  assert.equal(g.mountCalls, 1);
  assert.ok(slot(dom).querySelector('[data-toolbar-group-id="scene"]'));
});

// ----------------------------------------------------------------
// §4 — Mounted DOM shape — leading separator + group element
// ----------------------------------------------------------------

test('F1A.6 — mount inserts a leading separator + group element into the slot', () => {
  const { Toolbar, dom } = boot();
  Toolbar.setHost(slot(dom));
  Toolbar.registerGroup(fakeGroup({ id: 'scene', order: 200, mountHtml: 'X' }));
  const children = Array.from(slot(dom).children);
  assert.equal(children.length, 2);
  assert.ok(children[0].classList.contains('rga-shell-toolbar-group-sep'));
  assert.equal(children[1].getAttribute('data-toolbar-group-id'), 'scene');
  assert.equal(children[1].getAttribute('data-group'), 'scene');
  assert.ok(children[1].classList.contains('rga-shell-toolbar-group'));
});

test('F1A.6 — dataGroup override is honored; className appended', () => {
  const { Toolbar, dom } = boot();
  Toolbar.setHost(slot(dom));
  Toolbar.registerGroup(fakeGroup({
    id: 'custom',
    dataGroup: 'overridden-data-group',
    className: 'rga-shell-toolbar-mode',
    mount: function() {}
  }));
  const el = slot(dom).querySelector('[data-toolbar-group-id="custom"]');
  assert.equal(el.getAttribute('data-group'), 'overridden-data-group');
  assert.ok(el.classList.contains('rga-shell-toolbar-mode'));
  assert.ok(el.classList.contains('rga-shell-toolbar-group'));
});

// ----------------------------------------------------------------
// §5 — Order-based placement
// ----------------------------------------------------------------

test('F1A.6 — multiple groups mount in order ascending', () => {
  const { Toolbar, dom } = boot();
  Toolbar.setHost(slot(dom));
  // Intentionally register in a non-sorted order.
  Toolbar.registerGroup(fakeGroup({ id: 'mid', order: 200 }));
  Toolbar.registerGroup(fakeGroup({ id: 'first', order: 100 }));
  Toolbar.registerGroup(fakeGroup({ id: 'last', order: 300 }));
  const ids = Array.from(slot(dom).querySelectorAll('[data-toolbar-group-id]'))
                .map(function(el) { return el.getAttribute('data-toolbar-group-id'); });
  assert.deepEqual(ids, ['first', 'mid', 'last']);
});

test('F1A.6 — equal order ties broken by registration order', () => {
  const { Toolbar, dom } = boot();
  Toolbar.setHost(slot(dom));
  Toolbar.registerGroup(fakeGroup({ id: 'a', order: 100 }));
  Toolbar.registerGroup(fakeGroup({ id: 'b', order: 100 }));
  Toolbar.registerGroup(fakeGroup({ id: 'c', order: 100 }));
  const ids = Array.from(slot(dom).querySelectorAll('[data-toolbar-group-id]'))
                .map(function(el) { return el.getAttribute('data-toolbar-group-id'); });
  assert.deepEqual(ids, ['a', 'b', 'c']);
});

// ----------------------------------------------------------------
// §6 — unregisterGroup
// ----------------------------------------------------------------

test('F1A.6 — unregisterGroup removes the leading sep + group DOM and runs cleanup + unmount', () => {
  const { Toolbar, dom } = boot();
  Toolbar.setHost(slot(dom));
  let cleanupCalls = 0;
  const g = fakeGroup({
    id: 'scene',
    cleanup: function() { cleanupCalls += 1; }
  });
  Toolbar.registerGroup(g);
  assert.equal(slot(dom).children.length, 2, 'sep + group mounted');
  assert.equal(Toolbar.unregisterGroup('scene'), true);
  assert.equal(slot(dom).children.length, 0, 'sep + group removed cleanly');
  assert.equal(cleanupCalls, 1);
  assert.equal(g.unmountCalls, 1);
  assert.equal(Toolbar.registered().indexOf('scene'), -1);
});

test('F1A.6 — unregisterGroup is safe for unknown / invalid ids', () => {
  const { Toolbar } = boot();
  assert.equal(Toolbar.unregisterGroup('nope'), false);
  assert.equal(Toolbar.unregisterGroup(''), false);
  assert.equal(Toolbar.unregisterGroup(undefined), false);
  assert.equal(Toolbar.unregisterGroup(42), false);
});

test('F1A.6 — unregister of one group leaves the other groups intact', () => {
  const { Toolbar, dom } = boot();
  Toolbar.setHost(slot(dom));
  Toolbar.registerGroup(fakeGroup({ id: 'a', order: 100 }));
  Toolbar.registerGroup(fakeGroup({ id: 'b', order: 200 }));
  Toolbar.registerGroup(fakeGroup({ id: 'c', order: 300 }));
  Toolbar.unregisterGroup('b');
  const ids = Array.from(slot(dom).querySelectorAll('[data-toolbar-group-id]'))
                .map(function(el) { return el.getAttribute('data-toolbar-group-id'); });
  assert.deepEqual(ids, ['a', 'c']);
});

// ----------------------------------------------------------------
// §7 — Fail-safe mount / unmount
// ----------------------------------------------------------------

test('F1A.6 — a throwing mount does not block other registrations', () => {
  const originalError = console.error;
  console.error = function() {};
  try {
    const { Toolbar, dom } = boot();
    Toolbar.setHost(slot(dom));
    Toolbar.registerGroup(fakeGroup({ id: 'boom', order: 100, mountThrows: true }));
    Toolbar.registerGroup(fakeGroup({ id: 'ok', order: 200, mountHtml: 'OK' }));
    // Both group div elements exist in the DOM (boom mounts as an
    // empty placeholder — its content failed but the chrome survived).
    assert.ok(slot(dom).querySelector('[data-toolbar-group-id="boom"]'));
    assert.ok(slot(dom).querySelector('[data-toolbar-group-id="ok"]'));
  } finally {
    console.error = originalError;
  }
});

test('F1A.6 — a throwing cleanup during unregister does not block removal', () => {
  const originalError = console.error;
  console.error = function() {};
  try {
    const { Toolbar, dom } = boot();
    Toolbar.setHost(slot(dom));
    Toolbar.registerGroup(fakeGroup({
      id: 'badcleanup',
      cleanup: function() { throw new Error('cleanup-boom'); }
    }));
    assert.equal(Toolbar.unregisterGroup('badcleanup'), true);
    assert.equal(slot(dom).querySelector('[data-toolbar-group-id="badcleanup"]'), null);
  } finally {
    console.error = originalError;
  }
});

// ----------------------------------------------------------------
// §8 — _reset behavior — soft reset, preserves registry
// ----------------------------------------------------------------

test('F1A.6 — _reset clears mounted DOM + cleanups, preserves registry (same pattern as F1A.4 status bar)', () => {
  const { Toolbar, dom } = boot();
  Toolbar.setHost(slot(dom));
  Toolbar.registerGroup(fakeGroup({ id: 'a', order: 100 }));
  Toolbar.registerGroup(fakeGroup({ id: 'b', order: 200 }));
  assert.equal(slot(dom).children.length, 4, 'two groups → 2 (sep+group) pairs');
  Toolbar.registered();   // captures the registry
  Toolbar._reset();
  // Slot is cleared.
  assert.equal(slot(dom).children.length, 0);
  // Registry preserved — _reset does NOT drop plugin IIFE-registered
  // groups (same model as F1A.4 status-bar contribution API).
  assert.deepEqual(Toolbar.registered().sort(), ['a', 'b']);
});

test('F1A.6 — after _reset, a fresh setHost re-mounts everything', () => {
  const { Toolbar, dom } = boot();
  Toolbar.setHost(slot(dom));
  Toolbar.registerGroup(fakeGroup({ id: 'a', order: 100 }));
  Toolbar._reset();
  // New host scenario (eg. a JSDOM test re-using the module).
  Toolbar.setHost(slot(dom));
  // The 'a' group must re-mount automatically.
  assert.ok(slot(dom).querySelector('[data-toolbar-group-id="a"]'));
});
