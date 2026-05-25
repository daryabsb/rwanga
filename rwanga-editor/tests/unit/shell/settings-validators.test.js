// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Validators — Slice 3C.
//
// Pure value validators. No I/O, no side effects, no awareness of
// the store or registry — each function returns boolean.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bootDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
                        { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = {};
  return dom;
}

function loadValidators() {
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-validators.js')];
  require('../../../renderer/js/shell/settings-validators.js');
  return global.window.Rga.Settings.Validators;
}

// ----------------------------------------------------------------
// §1 — Module presence + public API
// ----------------------------------------------------------------

test('Slice 3C — Rga.Settings.Validators exposes the validator surface', () => {
  bootDom();
  const V = loadValidators();
  assert.equal(typeof V, 'object');
  ['boolean', 'number', 'integer', 'string', 'select',
   'color', 'shortcut', 'path', 'marginGroup', 'validateValue']
    .forEach(function(fn) {
      assert.equal(typeof V[fn], 'function', 'V.' + fn + ' must be a function');
    });
});

// ----------------------------------------------------------------
// §2 — boolean
// ----------------------------------------------------------------

test('Slice 3C — boolean accepts true / false; rejects everything else', () => {
  bootDom();
  const V = loadValidators();
  assert.equal(V.boolean(true),  true);
  assert.equal(V.boolean(false), true);
  ['', 'true', 1, 0, null, undefined, [], {}].forEach(function(v) {
    assert.equal(V.boolean(v), false, 'boolean must reject ' + JSON.stringify(v));
  });
});

// ----------------------------------------------------------------
// §3 — number / integer
// ----------------------------------------------------------------

test('Slice 3C — number accepts finite numbers; rejects NaN, Infinity, strings', () => {
  bootDom();
  const V = loadValidators();
  [0, 1, -1, 1.5, -3.14, 100].forEach(function(v) {
    assert.equal(V.number(v), true, 'number must accept ' + v);
  });
  [NaN, Infinity, -Infinity, '1', null, undefined, true].forEach(function(v) {
    assert.equal(V.number(v), false, 'number must reject ' + JSON.stringify(v));
  });
});

test('Slice 3C — integer accepts whole numbers only', () => {
  bootDom();
  const V = loadValidators();
  [0, 1, -1, 100].forEach(function(v) {
    assert.equal(V.integer(v), true, 'integer must accept ' + v);
  });
  [1.5, -3.14, NaN, '1', null].forEach(function(v) {
    assert.equal(V.integer(v), false, 'integer must reject ' + JSON.stringify(v));
  });
});

// ----------------------------------------------------------------
// §4 — string / select / path
// ----------------------------------------------------------------

test('Slice 3C — string accepts any string including empty', () => {
  bootDom();
  const V = loadValidators();
  ['', 'x', 'hello world'].forEach(function(v) {
    assert.equal(V.string(v), true);
  });
  [1, null, undefined, [], {}].forEach(function(v) {
    assert.equal(V.string(v), false);
  });
});

test('Slice 3C — select accepts values present in options array', () => {
  bootDom();
  const V = loadValidators();
  assert.equal(V.select('en', ['en', 'ku', 'ar']), true);
  assert.equal(V.select('fr', ['en', 'ku', 'ar']), false);
  assert.equal(V.select(1,    ['en']), false);
  assert.equal(V.select('en', null),   false, 'select with no options must reject');
  assert.equal(V.select('en', []),     false, 'select with empty options must reject');
});

test('Slice 3C — path accepts any string (empty allowed; full OS validation is out of scope)', () => {
  bootDom();
  const V = loadValidators();
  assert.equal(V.path(''),                        true);
  assert.equal(V.path('/home/user/Documents'),    true);
  assert.equal(V.path('C:\\Users\\me\\Scripts'),  true);
  assert.equal(V.path(123),                        false);
  assert.equal(V.path(null),                       false);
});

// ----------------------------------------------------------------
// §5 — color
// ----------------------------------------------------------------

test('Slice 3C — color accepts 6-digit hex (#RRGGBB); rejects everything else', () => {
  bootDom();
  const V = loadValidators();
  ['#141414', '#1a1a2e', '#FFFFFF', '#000000'].forEach(function(v) {
    assert.equal(V.color(v), true, 'color must accept ' + v);
  });
  ['#fff', '#ffff', '#ffggff', 'red', '141414', '#', '', null, 0].forEach(function(v) {
    assert.equal(V.color(v), false, 'color must reject ' + JSON.stringify(v));
  });
});

// ----------------------------------------------------------------
// §6 — shortcut
// ----------------------------------------------------------------

test('Slice 3C — shortcut accepts canonical chord forms', () => {
  bootDom();
  const V = loadValidators();
  // All defaults from the registry are accepted.
  ['Ctrl+S', 'Ctrl+Shift+P', 'Ctrl+Shift+S', 'Ctrl+F', 'Ctrl+H',
   'Ctrl+B', 'Ctrl+Shift+T', 'Ctrl+Shift+E', 'Ctrl+P'].forEach(function(v) {
    assert.equal(V.shortcut(v), true, 'shortcut must accept registry default ' + v);
  });
  // Other valid chords.
  ['F1', 'Ctrl+F12', 'Alt+Tab', 'Meta+Space', 'Shift+Enter',
   'Ctrl+Alt+Shift+0'].forEach(function(v) {
    assert.equal(V.shortcut(v), true, 'shortcut must accept ' + v);
  });
});

test('Slice 3C — shortcut rejects malformed strings', () => {
  bootDom();
  const V = loadValidators();
  ['', '+', 'Ctrl+', '+S', 'Shift',           // empty / orphan
   'foo bar', 'CTRL+S',                       // wrong case / spaces
   'Ctrl++S', 'Ctrl+Ctrl+A',                  // empty / duplicate modifiers
   'Ctrl+nope', 'Ctrl+Shift',                 // unknown / no terminal key
   null, 1, undefined                         // wrong type
  ].forEach(function(v) {
    assert.equal(V.shortcut(v), false, 'shortcut must reject ' + JSON.stringify(v));
  });
});

// ----------------------------------------------------------------
// §7 — marginGroup
// ----------------------------------------------------------------

test('Slice 3C — marginGroup accepts {top,bottom,left,right} of non-negative numbers', () => {
  bootDom();
  const V = loadValidators();
  assert.equal(V.marginGroup({ top: 1, bottom: 1, left: 1.5, right: 1 }), true);
  assert.equal(V.marginGroup({ top: 0, bottom: 0, left: 0,   right: 0 }), true);
});

test('Slice 3C — marginGroup rejects malformed margins', () => {
  bootDom();
  const V = loadValidators();
  assert.equal(V.marginGroup(null), false);
  assert.equal(V.marginGroup({}),   false, 'missing keys must reject');
  assert.equal(V.marginGroup({ top: 1, bottom: 1, left: 1 }), false, 'missing right must reject');
  assert.equal(V.marginGroup({ top: -1, bottom: 1, left: 1, right: 1 }), false, 'negative must reject');
  assert.equal(V.marginGroup({ top: '1', bottom: 1, left: 1, right: 1 }), false, 'string must reject');
  assert.equal(V.marginGroup({ top: NaN, bottom: 1, left: 1, right: 1 }), false, 'NaN must reject');
});

// ----------------------------------------------------------------
// §8 — validateValue(entry, value) dispatcher
// ----------------------------------------------------------------

test('Slice 3C — validateValue dispatches by entry.type', () => {
  bootDom();
  const V = loadValidators();
  // Build minimal registry-shaped entries.
  const toggle  = { id: 't', type: 'toggle' };
  const number  = { id: 'n', type: 'number' };
  const slider  = { id: 'sl', type: 'slider' };
  const text    = { id: 's', type: 'text' };
  const color   = { id: 'c', type: 'color' };
  const sc      = { id: 'k', type: 'shortcut' };
  const m       = { id: 'm', type: 'margins' };
  const sel     = { id: 'se', type: 'select', options: ['a', 'b'] };
  const radio   = { id: 'r',  type: 'radio',  options: ['x', 'y'] };

  assert.equal(V.validateValue(toggle, true),  true);
  assert.equal(V.validateValue(toggle, 'x'),   false);
  assert.equal(V.validateValue(number, 1.5),   true);
  assert.equal(V.validateValue(number, '1'),   false);
  assert.equal(V.validateValue(slider, 100),   true);
  assert.equal(V.validateValue(text,   ''),    true);
  assert.equal(V.validateValue(color,  '#141414'), true);
  assert.equal(V.validateValue(color,  '#fff'),    false);
  assert.equal(V.validateValue(sc,     'Ctrl+S'), true);
  assert.equal(V.validateValue(sc,     'foo'),    false);
  assert.equal(V.validateValue(m, { top: 1, bottom: 1, left: 1.5, right: 1 }), true);
  assert.equal(V.validateValue(m, { top: 1 }),    false);
  assert.equal(V.validateValue(sel,   'a'),       true);
  assert.equal(V.validateValue(sel,   'c'),       false);
  assert.equal(V.validateValue(radio, 'x'),       true);
  assert.equal(V.validateValue(radio, 'z'),       false);
});

test('Slice 3C — validateValue rejects unknown entry.type', () => {
  bootDom();
  const V = loadValidators();
  assert.equal(V.validateValue({ id: 'x', type: 'mystery' }, 'anything'), false);
  assert.equal(V.validateValue({ id: 'x' }, 'anything'), false, 'missing type must reject');
});
