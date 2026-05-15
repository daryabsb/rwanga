// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function loadModule() {
  const path = require.resolve('../../../../renderer/js/doc-types/screenplay/inner-zone-key-plugin.js');
  delete require.cache[path];
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  global.window.Rga.DocTypes = global.window.Rga.DocTypes || {};
  global.window.Rga.DocTypes.screenplay = global.window.Rga.DocTypes.screenplay || {};
  // Provide a minimal Plugin class
  global.window.RgaProseMirror = { Plugin: class Plugin { constructor(spec) { this.spec = spec; } } };
  require(path);
  return global.window.Rga.DocTypes.screenplay;
}

test('buildZoneKeyPlugin is exported as a function', () => {
  const sp = loadModule();
  assert.equal(typeof sp.buildZoneKeyPlugin, 'function');
});

test('buildZoneKeyPlugin returns a Plugin instance with handleKeyDown', () => {
  const sp = loadModule();
  const plugin = sp.buildZoneKeyPlugin();
  assert.ok(plugin);
  assert.ok(plugin.spec.props.handleKeyDown, 'plugin must expose handleKeyDown');
  assert.equal(typeof plugin.spec.props.handleKeyDown, 'function');
});

// ── helpers ────────────────────────────────────────────────────────────────

function makeNodeView(activeZone) {
  const nv = {
    _activeZone: activeZone,
    calls: [],
    activateZone(z) { this._activeZone = z; this.calls.push(['activateZone', z]); },
    _showPicker(z)  { this.calls.push(['_showPicker', z]); }
  };
  return nv;
}

function makeDom(activeZone) {
  // Minimal DOM stub: querySelector returns a node with _rgaNodeView backref
  const nv = makeNodeView(activeZone);
  const el = { _rgaNodeView: nv };
  const dom = {
    querySelector(sel) {
      const match = sel.match(/data-active-zone="([^"]+)"/);
      if (match && match[1] === activeZone) return el;
      return null;
    }
  };
  return { dom, nv };
}

function makeView(activeZone, parentOffset, contentSize) {
  const { dom, nv } = makeDom(activeZone);
  const view = {
    dom,
    state: {
      selection: {
        $head: {
          parent: { type: { name: 'sceneLine' }, content: { size: contentSize || 10 } },
          parentOffset: parentOffset !== undefined ? parentOffset : 0
        }
      }
    }
  };
  return { view, nv };
}

function makeEvent(key, shiftKey) {
  return { key, shiftKey: !!shiftKey, ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
}

function getHandler() {
  const sp = loadModule();
  const plugin = sp.buildZoneKeyPlugin();
  return plugin.spec.props.handleKeyDown;
}

// ── Case A: non-location zone active ───────────────────────────────────────

test('Escape from setting zone calls activateZone(location) and returns true', () => {
  const h = getHandler();
  const { view, nv } = makeView('setting', 0, 0);
  const event = makeEvent('Escape');
  const result = h(view, event);
  assert.equal(result, true);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(nv.calls, [['activateZone', 'location']]);
});

test('Escape from time zone calls activateZone(location) and returns true', () => {
  const h = getHandler();
  const { view, nv } = makeView('time', 0, 0);
  const event = makeEvent('Escape');
  const result = h(view, event);
  assert.equal(result, true);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(nv.calls, [['activateZone', 'location']]);
});

test('Tab from setting zone calls activateZone(location) and returns true', () => {
  const h = getHandler();
  const { view, nv } = makeView('setting', 0, 0);
  const event = makeEvent('Tab');
  const result = h(view, event);
  assert.equal(result, true);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(nv.calls, [['activateZone', 'location']]);
});

test('ArrowRight from time zone calls activateZone(location) and returns true', () => {
  const h = getHandler();
  const { view, nv } = makeView('time', 0, 0);
  const event = makeEvent('ArrowRight');
  const result = h(view, event);
  assert.equal(result, true);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(nv.calls, [['activateZone', 'location']]);
});

test('Letter key while setting active is blocked (returns true, defaultPrevented)', () => {
  const h = getHandler();
  const { view } = makeView('setting', 0, 0);
  const event = makeEvent('a');
  const result = h(view, event);
  assert.equal(result, true);
  assert.equal(event.defaultPrevented, true);
});

test('Letter key while time active is blocked', () => {
  const h = getHandler();
  const { view } = makeView('time', 0, 0);
  const event = makeEvent('z');
  const result = h(view, event);
  assert.equal(result, true);
  assert.equal(event.defaultPrevented, true);
});

// ── Case B: cursor in location zone ────────────────────────────────────────

test('Tab at end of location activates time zone', () => {
  const h = getHandler();
  // activeZone='location', cursor at end (parentOffset === contentSize)
  const { view, nv } = makeView('location', 10, 10);
  const event = makeEvent('Tab', false);
  const result = h(view, event);
  assert.equal(result, true);
  assert.equal(event.defaultPrevented, true);
  assert.ok(nv.calls.some(c => c[0] === 'activateZone' && c[1] === 'time'));
});

test('ArrowRight at end of location activates time zone', () => {
  const h = getHandler();
  const { view, nv } = makeView('location', 10, 10);
  const event = makeEvent('ArrowRight', false);
  const result = h(view, event);
  assert.equal(result, true);
  assert.equal(event.defaultPrevented, true);
  assert.ok(nv.calls.some(c => c[0] === 'activateZone' && c[1] === 'time'));
});

test('Shift-Tab at start of location activates setting zone', () => {
  const h = getHandler();
  const { view, nv } = makeView('location', 0, 10);
  const event = makeEvent('Tab', true);
  const result = h(view, event);
  assert.equal(result, true);
  assert.equal(event.defaultPrevented, true);
  assert.ok(nv.calls.some(c => c[0] === 'activateZone' && c[1] === 'setting'));
});

test('ArrowLeft at start of location activates setting zone', () => {
  const h = getHandler();
  const { view, nv } = makeView('location', 0, 10);
  const event = makeEvent('ArrowLeft', false);
  const result = h(view, event);
  assert.equal(result, true);
  assert.equal(event.defaultPrevented, true);
  assert.ok(nv.calls.some(c => c[0] === 'activateZone' && c[1] === 'setting'));
});

test('Tab at start of location (not at end) returns false — no transition', () => {
  const h = getHandler();
  // cursor at start, Tab forward — not at end so no action
  const { view } = makeView('location', 0, 10);
  const event = makeEvent('Tab', false);
  const result = h(view, event);
  assert.equal(result, false);
  assert.equal(event.defaultPrevented, false);
});

test('ArrowLeft in middle of location returns false', () => {
  const h = getHandler();
  const { view } = makeView('location', 5, 10);
  const event = makeEvent('ArrowLeft', false);
  const result = h(view, event);
  assert.equal(result, false);
  assert.equal(event.defaultPrevented, false);
});
