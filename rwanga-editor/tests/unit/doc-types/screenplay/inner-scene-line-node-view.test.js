// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function mockDom() {
  function el(tag) {
    const node = {
      tagName: tag.toUpperCase(),
      className: '',
      textContent: '',
      contentEditable: 'inherit',
      dataset: {},
      style: {},
      _children: [],
      _listeners: {},
      addEventListener: function(ev, fn) { this._listeners[ev] = this._listeners[ev] || []; this._listeners[ev].push(fn); },
      appendChild: function(c) { this._children.push(c); return c; },
      removeChild: function(c) { this._children = this._children.filter(function(x) { return x !== c; }); return c; },
      get firstChild() { return this._children[0] || null; },
      setAttribute: function() {},
      getBoundingClientRect: function() { return { left: 0, top: 0, width: 0, height: 0 }; }
    };
    return node;
  }
  global.document = { createElement: el };
}

function loadModule() {
  const path = require.resolve('../../../../renderer/js/doc-types/screenplay/inner-scene-line-node-view.js');
  delete require.cache[path];
  mockDom();
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  global.window.Rga.DocTypes = global.window.Rga.DocTypes || {};
  global.window.Rga.DocTypes.screenplay = global.window.Rga.DocTypes.screenplay || {};
  global.window.Rga.Constants = { DEFAULT_VOCABULARY: { settings: ['INT.', 'EXT.'], times: ['DAY', 'NIGHT'] } };
  require(path);
  return global.window.Rga.DocTypes.screenplay;
}

test('sceneLineNodeViewFactory is exported as a function', () => {
  const sp = loadModule();
  assert.equal(typeof sp.sceneLineNodeViewFactory, 'function');
});

test('factory(getSettings) returns a NodeView constructor', () => {
  const sp = loadModule();
  const factory = sp.sceneLineNodeViewFactory(function() { return null; });
  assert.equal(typeof factory, 'function');
});

test('NodeView constructor builds the 5-child slug DOM', () => {
  const sp = loadModule();
  const factory = sp.sceneLineNodeViewFactory(function() { return null; });
  const fakeNode = { attrs: { setting: 'INT.', time: 'DAY' }, type: { name: 'sceneLine' } };
  const nv = factory(fakeNode, null, function() { return 0; });
  assert.ok(nv.dom);
  assert.equal(nv.dom.className, 'rga-scene-line');
  assert.equal(nv.dom._children.length, 5);
  assert.equal(nv.dom._children[0].className, 'rga-slug-setting');
  assert.equal(nv.dom._children[0].textContent, 'INT.');
  assert.equal(nv.dom._children[2].className, 'rga-slug-location');  // contentDOM
  assert.equal(nv.dom._children[4].className, 'rga-slug-time');
  assert.equal(nv.dom._children[4].textContent, 'DAY');
});

test('contentDOM is the location span', () => {
  const sp = loadModule();
  const factory = sp.sceneLineNodeViewFactory(function() { return null; });
  const fakeNode = { attrs: { setting: 'INT.', time: 'DAY' }, type: { name: 'sceneLine' } };
  const nv = factory(fakeNode, null, function() { return 0; });
  assert.equal(nv.contentDOM.className, 'rga-slug-location');
});

test('activateZone updates data-active-zone', () => {
  const sp = loadModule();
  const factory = sp.sceneLineNodeViewFactory(function() { return null; });
  const fakeNode = { attrs: { setting: 'INT.', time: 'DAY' }, type: { name: 'sceneLine' } };
  const nv = factory(fakeNode, null, function() { return 0; });
  nv.activateZone('time');
  assert.equal(nv.dom.dataset.activeZone, 'time');
  assert.equal(nv._activeZone, 'time');
});

test('update(node) returns true and updates setting/time text', () => {
  const sp = loadModule();
  const factory = sp.sceneLineNodeViewFactory(function() { return null; });
  const fakeNode = { attrs: { setting: 'INT.', time: 'DAY' }, type: { name: 'sceneLine' } };
  const nv = factory(fakeNode, null, function() { return 0; });
  const newNode = { attrs: { setting: 'EXT.', time: 'NIGHT' }, type: { name: 'sceneLine' } };
  assert.equal(nv.update(newNode), true);
  assert.equal(nv._settingSpan.textContent, 'EXT.');
  assert.equal(nv._timeSpan.textContent, 'NIGHT');
});

test('update returns false for non-sceneLine node', () => {
  const sp = loadModule();
  const factory = sp.sceneLineNodeViewFactory(function() { return null; });
  const fakeNode = { attrs: { setting: 'INT.', time: 'DAY' }, type: { name: 'sceneLine' } };
  const nv = factory(fakeNode, null, function() { return 0; });
  assert.equal(nv.update({ type: { name: 'action' } }), false);
});

test('_pickerItems returns settings list for "setting" zone', () => {
  const sp = loadModule();
  // Module exports the helper for tests
  assert.deepEqual(sp._sceneLineNodeViewInternals._pickerItems('setting', null), ['INT.', 'EXT.']);
});

test('_pickerItems returns times list for "time" zone', () => {
  const sp = loadModule();
  assert.deepEqual(sp._sceneLineNodeViewInternals._pickerItems('time', null), ['DAY', 'NIGHT']);
});

test('_pickerItems uses doc-settings vocabulary when present', () => {
  const sp = loadModule();
  const settings = { vocabulary: { settings: ['INT.', 'EXT.', 'I/E'], times: ['DAY', 'NIGHT', 'DUSK'] } };
  assert.deepEqual(sp._sceneLineNodeViewInternals._pickerItems('setting', settings), ['INT.', 'EXT.', 'I/E']);
});
