// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 1 — Rga.Shell.Sidebar unit tests (plan §3.2, §8.2).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="host"></div></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  delete require.cache[require.resolve('../../../renderer/js/shell/sidebar.js')];
  require('../../../renderer/js/shell/sidebar.js');
  const Sidebar = global.window.Rga.Shell.Sidebar;
  Sidebar._reset();
  Sidebar.setHost(document.getElementById('host'));
  return { Sidebar, host: document.getElementById('host') };
}

function makePanel(id, log) {
  return {
    id: id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    icon: '🔹',
    available: true,
    mount: function(container) {
      log.push('mount:' + id);
      if (container) container.innerHTML = '<div class="panel-' + id + '">' + id + '</div>';
    },
    unmount: function() { log.push('unmount:' + id); }
  };
}

test('registerPanel({id, mount, unmount}) accepts a valid controller', () => {
  const { Sidebar } = boot();
  const ok = Sidebar.registerPanel(makePanel('a', []));
  assert.equal(ok, true);
  assert.deepEqual(Sidebar.registered(), ['a']);
});

test('registerPanel rejects duplicate id', () => {
  const { Sidebar } = boot();
  Sidebar.registerPanel(makePanel('a', []));
  const ok = Sidebar.registerPanel(makePanel('a', []));
  assert.equal(ok, false);
});

test('registerPanel rejects malformed controller', () => {
  const { Sidebar } = boot();
  assert.equal(Sidebar.registerPanel(null), false);
  assert.equal(Sidebar.registerPanel({}), false);
  assert.equal(Sidebar.registerPanel({ id: '' }), false);
  assert.equal(Sidebar.registerPanel({ id: 42 }), false);
});

test('activate(id) calls panel.mount with the sidebar host container', () => {
  const { Sidebar, host } = boot();
  const log = [];
  Sidebar.registerPanel(makePanel('a', log));
  Sidebar.activate('a');
  assert.deepEqual(log, ['mount:a']);
  assert.ok(host.querySelector('.panel-a'), 'host received panel content');
});

test('activate(B) when A is current calls A.unmount then B.mount and clears host first', () => {
  const { Sidebar, host } = boot();
  const log = [];
  Sidebar.registerPanel(makePanel('a', log));
  Sidebar.registerPanel(makePanel('b', log));
  Sidebar.activate('a');
  Sidebar.activate('b');
  assert.deepEqual(log, ['mount:a', 'unmount:a', 'mount:b']);
  assert.equal(host.querySelectorAll('.panel-a').length, 0, 'old panel cleared');
  assert.ok(host.querySelector('.panel-b'));
});

test('activate(id) when id is current re-calls mount without unmount', () => {
  const { Sidebar } = boot();
  const log = [];
  Sidebar.registerPanel(makePanel('a', log));
  Sidebar.activate('a');
  Sidebar.activate('a');
  assert.deepEqual(log, ['mount:a', 'mount:a']);
});

test('activate(unknown) returns false; does not change current()', () => {
  const { Sidebar } = boot();
  Sidebar.registerPanel(makePanel('a', []));
  Sidebar.activate('a');
  const ok = Sidebar.activate('ghost');
  assert.equal(ok, false);
  assert.equal(Sidebar.current(), 'a');
});

test('deactivate() calls current panel.unmount, clears host, and clears current()', () => {
  const { Sidebar, host } = boot();
  const log = [];
  Sidebar.registerPanel(makePanel('a', log));
  Sidebar.activate('a');
  Sidebar.deactivate();
  assert.deepEqual(log, ['mount:a', 'unmount:a']);
  assert.equal(Sidebar.current(), null);
  assert.equal(host.children.length, 0, 'host cleared after deactivate');
});

test('current() returns null on first boot', () => {
  const { Sidebar } = boot();
  assert.equal(Sidebar.current(), null);
});

test('isActive(id) reflects current()', () => {
  const { Sidebar } = boot();
  Sidebar.registerPanel(makePanel('a', []));
  Sidebar.registerPanel(makePanel('b', []));
  Sidebar.activate('a');
  assert.equal(Sidebar.isActive('a'), true);
  assert.equal(Sidebar.isActive('b'), false);
});

test('onChange fires (newId, prevId) on every activate / deactivate', () => {
  const { Sidebar } = boot();
  const events = [];
  Sidebar.onChange(function(n, p) { events.push([n, p]); });
  Sidebar.registerPanel(makePanel('a', []));
  Sidebar.registerPanel(makePanel('b', []));
  Sidebar.activate('a');
  Sidebar.activate('b');
  Sidebar.deactivate();
  assert.deepEqual(events, [['a', null], ['b', 'a'], [null, 'b']]);
});

test('onChange unsubscribe stops further notifications', () => {
  const { Sidebar } = boot();
  let count = 0;
  const off = Sidebar.onChange(function() { count += 1; });
  Sidebar.registerPanel(makePanel('a', []));
  Sidebar.activate('a');
  off();
  Sidebar.deactivate();
  assert.equal(count, 1);
});

test('registered() returns ids in registration order', () => {
  const { Sidebar } = boot();
  Sidebar.registerPanel(makePanel('z', []));
  Sidebar.registerPanel(makePanel('a', []));
  Sidebar.registerPanel(makePanel('m', []));
  assert.deepEqual(Sidebar.registered(), ['z', 'a', 'm']);
});

test('unregisterPanel of the current view deactivates it first', () => {
  const { Sidebar } = boot();
  const log = [];
  Sidebar.registerPanel(makePanel('a', log));
  Sidebar.activate('a');
  Sidebar.unregisterPanel('a');
  assert.equal(Sidebar.current(), null);
  assert.deepEqual(log, ['mount:a', 'unmount:a']);
});

test('_reset() clears registry, listeners, current', () => {
  const { Sidebar } = boot();
  Sidebar.registerPanel(makePanel('a', []));
  Sidebar.activate('a');
  Sidebar.onChange(function() {});
  Sidebar._reset();
  assert.equal(Sidebar.current(), null);
  assert.deepEqual(Sidebar.registered(), []);
});
