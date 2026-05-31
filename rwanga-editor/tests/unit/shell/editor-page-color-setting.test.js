// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// editor.pageColor setting — Flow paper colour (Filmustageation F7).
//
// Unit test of the wired path: the registry entry exists with the right
// shape, the validator accepts only white|dark (no Sepia, no junk), and the
// applicator maps the Store value to data-flow-page-color on <body>. jsdom;
// asserts the Store→applicator contract, not pixels (the pixel/theme proof is
// the Playwright e2e spec flow-settings-page-color-line-numbers).
//
// (Distinct from editor-page-color.test.js, which guards the older Fix-2
// page-vs-desk CSS separation. This file owns the new F7 SELECT setting.)
//
// Harness mirrors tests/unit/editor/editor-applicators.test.js: global
// window+document, prefs stub, require with cache-busting. Load order is the
// same as index.html: validators → registry → store → applicators → editor.
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
  const _store = {};
  dom.window.rwanga = {
    prefs: {
      read:  async function() { return JSON.parse(JSON.stringify(_store)); },
      write: async function(partial) { Object.assign(_store, partial); return _store; }
    }
  };
  dom.window.Rga.TabManager = { activeDoc: function() { return null; } };
  return dom;
}

function loadAll() {
  ['../../../renderer/js/shell/settings-validators.js',
   '../../../renderer/js/shell/settings-registry.js',
   '../../../renderer/js/shell/settings-store.js',
   '../../../renderer/js/shell/settings-applicators.js',
   '../../../renderer/js/editor/editor-applicators.js'
  ].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  return global.window.Rga.Settings;
}

test('F7 editor.pageColor — registry entry exists with the right shape', function() {
  bootDom();
  const R = loadAll().Registry;
  assert.ok(R.has('editor.pageColor'), 'registry has editor.pageColor');
  const e = R.get('editor.pageColor');
  assert.equal(e.type, 'select');
  assert.equal(e.default, 'white');
  assert.equal(e.scope, 'flow');
  assert.equal(e.persistsTo, 'user');
  assert.deepEqual(e.options, ['white', 'dark']);
});

test('F7 editor.pageColor — default effective value is white', function() {
  bootDom();
  const S = loadAll();
  assert.equal(S.Store.effective('editor.pageColor'), 'white');
});

test('F7 editor.pageColor — applicator writes data-flow-page-color on <body>', function() {
  bootDom();
  const S = loadAll();
  S.Applicators.apply('editor.pageColor', 'dark');
  assert.equal(global.document.body.getAttribute('data-flow-page-color'), 'dark');
  S.Applicators.apply('editor.pageColor', 'white');
  assert.equal(global.document.body.getAttribute('data-flow-page-color'), 'white');
});

test('F7 editor.pageColor — junk value normalises to white (defensive)', function() {
  bootDom();
  const S = loadAll();
  // The applicator normalises an unknown value to 'white' so the body attr
  // never holds a junk token (parallels editor.wordWrap's normalisation).
  S.Applicators.apply('editor.pageColor', 'sepia');
  assert.equal(global.document.body.getAttribute('data-flow-page-color'), 'white');
});

test('F7 editor.pageColor — validator rejects non-enum values (no Sepia, no junk)', function() {
  bootDom();
  const S = loadAll();
  S.Store.set('editor.pageColor', 'dark');             // valid baseline
  assert.equal(S.Store.effective('editor.pageColor'), 'dark');
  // 'sepia' / numbers are out of scope; Store.set must reject (return false),
  // leaving effective unchanged.
  assert.equal(S.Store.set('editor.pageColor', 'sepia'), false);
  assert.equal(S.Store.effective('editor.pageColor'), 'dark');
  assert.equal(S.Store.set('editor.pageColor', 42), false);
  assert.equal(S.Store.effective('editor.pageColor'), 'dark');
});

test('F7 editor.pageColor — persists to the user tier (round-trips across reload)', function() {
  bootDom();
  const S = loadAll();
  S.Store.set('editor.pageColor', 'dark');
  assert.equal(S.Store.get('editor.pageColor', 'user'), 'dark');
});

test('F7 editor.pageColor — applicator is registered with owner "editor"', function() {
  bootDom();
  const S = loadAll();
  const a = S.Applicators.get('editor.pageColor');
  assert.ok(a, 'editor.pageColor must have a registered applicator');
  assert.equal(a.owner, 'editor');
});
