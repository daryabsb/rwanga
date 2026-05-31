// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Registry — Slice 3A.
//
// Pure declarative truth: every setting in the product has a registry
// entry with a fixed 16-field shape. The Settings Store reads defaults
// from this registry instead of an inline BUILTINS map.
//
// Slice 3A scope: shape only. No applicators, no UI, no validators
// beyond registry-shape enforcement.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// The 16 required fields, in the order the spec lists them.
const REQUIRED_FIELDS = [
  'id', 'label', 'description', 'type', 'default', 'scope',
  'persistsTo', 'owner', 'restartRequired', 'experimental',
  'dependencies', 'requiresPro', 'keywords', 'aliases',
  'previewKind', 'requiresOnboarding'
];

// Valid enumerations. Defining them here in the test (not importing
// from the registry module) keeps the test independent — if the
// registry shrinks the valid set, the test catches the drift.
const VALID_TYPES        = ['toggle', 'select', 'number', 'text',
                            'slider', 'color', 'shortcut', 'margins', 'radio'];
const VALID_SCOPES       = ['flow', 'print', 'export', 'all'];
const VALID_PERSISTS_TO  = ['user', 'script', 'project', 'session'];
const VALID_OWNERS       = ['general', 'editor', 'screenplay', 'pageSetup',
                            'printExport', 'autosave', 'appearance',
                            'shortcuts', 'advanced'];
const VALID_PREVIEW      = ['none', 'page'];
const BOOLEAN_FIELDS     = ['restartRequired', 'experimental',
                            'requiresPro', 'requiresOnboarding'];
const ARRAY_FIELDS       = ['dependencies', 'keywords', 'aliases'];

// ----------------------------------------------------------------
// Test fixtures
// ----------------------------------------------------------------

function bootDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
                        { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = {};
  return dom;
}

function loadRegistry() {
  // Validators must load before the registry (Slice 3C — registry
  // load-time check consults Validators.validateValue on every default).
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-validators.js')];
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-registry.js')];
  require('../../../renderer/js/shell/settings-validators.js');
  require('../../../renderer/js/shell/settings-registry.js');
  return global.window.Rga.Settings.Registry;
}

// ----------------------------------------------------------------
// §1 — Module presence + public API
// ----------------------------------------------------------------

test('Slice 3A — Rga.Settings.Registry exists with required public API', () => {
  bootDom();
  const R = loadRegistry();
  assert.equal(typeof R, 'object', 'Registry must be exposed on Rga.Settings.Registry');
  assert.equal(typeof R.has,        'function', 'Registry.has must be a function');
  assert.equal(typeof R.get,        'function', 'Registry.get must be a function');
  assert.equal(typeof R.getDefault, 'function', 'Registry.getDefault must be a function');
  assert.equal(typeof R.all,        'function', 'Registry.all must be a function');
  assert.equal(typeof R.ids,        'function', 'Registry.ids must be a function');
});

// ----------------------------------------------------------------
// §2 — Registry contents
// ----------------------------------------------------------------

test('Slice 3A — registry contains the full settings inventory (~64 entries post-S12)', () => {
  bootDom();
  const R = loadRegistry();
  const all = R.all();
  assert.ok(Array.isArray(all), 'Registry.all() must return an array');
  // Inventory grew from 62 → 64 in S12: `units` (user-tier) and
  // `editor.scriptLanguage` (script-tier) were promoted from legacy
  // localStorage modules into the Settings Store. Filmustageation F7
  // (2026-05-31) added `editor.pageColor` (Flow paper colour) → 65. If an
  // entry is added or removed, update this guard explicitly so the count
  // change is reviewed, not silent.
  assert.equal(all.length, 65,
    'Registry size must equal the documented inventory (65 settings post-F7)');
});

test('Slice 3A — every registry entry has all 16 required fields', () => {
  bootDom();
  const R = loadRegistry();
  R.all().forEach(function(entry) {
    REQUIRED_FIELDS.forEach(function(f) {
      assert.ok(Object.prototype.hasOwnProperty.call(entry, f),
        'Setting "' + entry.id + '" is missing required field "' + f + '"');
    });
  });
});

test('Slice 3A — registry ids are unique', () => {
  bootDom();
  const R = loadRegistry();
  const ids = R.ids();
  const set = new Set(ids);
  assert.equal(ids.length, set.size,
    'Registry must not contain duplicate ids');
});

test('Slice 3A — registry ids are non-empty strings', () => {
  bootDom();
  const R = loadRegistry();
  R.all().forEach(function(entry) {
    assert.equal(typeof entry.id, 'string', 'id must be a string');
    assert.ok(entry.id.length > 0, 'id must be non-empty');
  });
});

// ----------------------------------------------------------------
// §3 — Field-value validity
// ----------------------------------------------------------------

test('Slice 3A — every entry.type is a valid type', () => {
  bootDom();
  const R = loadRegistry();
  R.all().forEach(function(entry) {
    assert.ok(VALID_TYPES.indexOf(entry.type) >= 0,
      'Setting "' + entry.id + '" has invalid type "' + entry.type +
      '" (allowed: ' + VALID_TYPES.join(', ') + ')');
  });
});

test('Slice 3A — every entry.scope is a valid scope', () => {
  bootDom();
  const R = loadRegistry();
  R.all().forEach(function(entry) {
    assert.ok(VALID_SCOPES.indexOf(entry.scope) >= 0,
      'Setting "' + entry.id + '" has invalid scope "' + entry.scope +
      '" (allowed: ' + VALID_SCOPES.join(', ') + ')');
  });
});

test('Slice 3A — every entry.persistsTo is a valid tier', () => {
  bootDom();
  const R = loadRegistry();
  R.all().forEach(function(entry) {
    assert.ok(VALID_PERSISTS_TO.indexOf(entry.persistsTo) >= 0,
      'Setting "' + entry.id + '" has invalid persistsTo "' + entry.persistsTo +
      '" (allowed: ' + VALID_PERSISTS_TO.join(', ') + ')');
  });
});

test('Slice 3A — every entry.owner is a valid section id', () => {
  bootDom();
  const R = loadRegistry();
  R.all().forEach(function(entry) {
    assert.ok(VALID_OWNERS.indexOf(entry.owner) >= 0,
      'Setting "' + entry.id + '" has invalid owner "' + entry.owner +
      '" (allowed: ' + VALID_OWNERS.join(', ') + ')');
  });
});

test('Slice 3A — every entry.previewKind is a valid preview kind', () => {
  bootDom();
  const R = loadRegistry();
  R.all().forEach(function(entry) {
    assert.ok(VALID_PREVIEW.indexOf(entry.previewKind) >= 0,
      'Setting "' + entry.id + '" has invalid previewKind "' + entry.previewKind +
      '" (allowed: ' + VALID_PREVIEW.join(', ') + ')');
  });
});

test('Slice 3A — boolean fields are actual booleans', () => {
  bootDom();
  const R = loadRegistry();
  R.all().forEach(function(entry) {
    BOOLEAN_FIELDS.forEach(function(f) {
      assert.equal(typeof entry[f], 'boolean',
        'Setting "' + entry.id + '" field "' + f + '" must be boolean, got ' + typeof entry[f]);
    });
  });
});

test('Slice 3A — array fields are actual arrays', () => {
  bootDom();
  const R = loadRegistry();
  R.all().forEach(function(entry) {
    ARRAY_FIELDS.forEach(function(f) {
      assert.ok(Array.isArray(entry[f]),
        'Setting "' + entry.id + '" field "' + f + '" must be an array');
    });
  });
});

test('Slice 3A — label and description are non-empty strings', () => {
  bootDom();
  const R = loadRegistry();
  R.all().forEach(function(entry) {
    assert.equal(typeof entry.label, 'string', entry.id + ': label must be string');
    assert.ok(entry.label.length > 0, entry.id + ': label must be non-empty');
    assert.equal(typeof entry.description, 'string', entry.id + ': description must be string');
    assert.ok(entry.description.length > 0, entry.id + ': description must be non-empty');
  });
});

// ----------------------------------------------------------------
// §4 — Lookup behavior
// ----------------------------------------------------------------

test('Slice 3A — Registry.has() returns true for a known id', () => {
  bootDom();
  const R = loadRegistry();
  assert.equal(R.has('editor.highlightCurrentLine'), true);
});

test('Slice 3A — Registry.has() returns false for an unknown id', () => {
  bootDom();
  const R = loadRegistry();
  assert.equal(R.has('not.a.real.setting'), false);
});

test('Slice 3A — Registry.get() returns the entry for a known id', () => {
  bootDom();
  const R = loadRegistry();
  const entry = R.get('editor.highlightCurrentLine');
  assert.equal(entry.id, 'editor.highlightCurrentLine');
  assert.equal(entry.default, true,
    'editor.highlightCurrentLine default must remain true (preserves Slice 2 proof setting)');
});

test('Slice 3A — Registry.get() returns null for an unknown id', () => {
  bootDom();
  const R = loadRegistry();
  assert.equal(R.get('not.a.real.setting'), null);
});

test('Slice 3A — Registry.getDefault() returns the default for a known id', () => {
  bootDom();
  const R = loadRegistry();
  assert.equal(R.getDefault('editor.highlightCurrentLine'), true);
});

test('Slice 3A — Registry.getDefault() returns undefined for an unknown id', () => {
  bootDom();
  const R = loadRegistry();
  assert.equal(R.getDefault('not.a.real.setting'), undefined);
});

// ----------------------------------------------------------------
// §5 — Registry × Settings Store wiring
// ----------------------------------------------------------------
// Slice 3A's only behavior change: the Settings Store reads defaults
// from the registry instead of its inline BUILTINS map. These tests
// assert the wiring without asserting anything new about user-visible
// behavior — existing settings-store tests still cover that.

function loadStoreWithRegistry() {
  // Validators → Registry → Store. Same load order as
  // renderer/index.html. The store's set() consults validators at
  // write time (Slice 3C); the registry consults validators at load.
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-validators.js')];
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-registry.js')];
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-store.js')];
  require('../../../renderer/js/shell/settings-validators.js');
  require('../../../renderer/js/shell/settings-registry.js');
  require('../../../renderer/js/shell/settings-store.js');
  return global.window.Rga.Settings;
}

test('Slice 3A — Store.effective() resolves the registry default for a known id', async () => {
  const dom = bootDom();
  dom.window.rwanga = { prefs: { read: async () => ({}), write: async () => ({}) } };
  dom.window.Rga.TabManager = { activeDoc: () => null };
  const S = loadStoreWithRegistry();
  await S.Store.init();
  // editor.highlightCurrentLine: default true via registry.
  assert.equal(S.Store.effective('editor.highlightCurrentLine'), true);
});

test('Slice 3A — Store.effective() returns undefined for an unknown id', async () => {
  const dom = bootDom();
  dom.window.rwanga = { prefs: { read: async () => ({}), write: async () => ({}) } };
  dom.window.Rga.TabManager = { activeDoc: () => null };
  const S = loadStoreWithRegistry();
  await S.Store.init();
  assert.equal(S.Store.effective('not.a.real.setting'), undefined);
});

test('Slice 3A — Store.effective() resolves a sampling of registry defaults', async () => {
  const dom = bootDom();
  dom.window.rwanga = { prefs: { read: async () => ({}), write: async () => ({}) } };
  dom.window.Rga.TabManager = { activeDoc: () => null };
  const S = loadStoreWithRegistry();
  await S.Store.init();
  // Spot-check defaults from across sections — proves the store
  // really is reading the registry, not the deleted single-entry
  // BUILTINS map.
  assert.equal(S.Store.effective('editor.fontFamily'), 'Courier Prime');
  assert.equal(S.Store.effective('editor.fontSize'), 12);
  assert.equal(S.Store.effective('pageSetup.paperSize'), 'letter');
  assert.equal(S.Store.effective('autosave.enabled'), true);
  assert.equal(S.Store.effective('advanced.debugMode'), false);
  assert.deepEqual(S.Store.effective('pageSetup.margins'),
    { top: 1, bottom: 1, left: 1.5, right: 1 });
});

test('Slice 3A — Store.set() at user tier still wins over registry default', async () => {
  const dom = bootDom();
  const _store = {};
  dom.window.rwanga = {
    prefs: {
      read:  async () => JSON.parse(JSON.stringify(_store)),
      write: async (partial) => { Object.assign(_store, partial); return _store; }
    }
  };
  dom.window.Rga.TabManager = { activeDoc: () => null };
  const S = loadStoreWithRegistry();
  await S.Store.init();
  // editor.highlightCurrentLine has registry default true; user
  // override flips it to false. This is the same cascade Slice 2
  // tested, re-verified after the registry source swap.
  S.Store.set('editor.highlightCurrentLine', false);
  assert.equal(S.Store.effective('editor.highlightCurrentLine'), false);
});

// ----------------------------------------------------------------
// §6 — Slice 3C: load-time validation against registered validators
// ----------------------------------------------------------------

test('Slice 3C — every registry default passes its type validator', () => {
  bootDom();
  // Validators must load before the registry so the registry's
  // load-time validation can call them.
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-validators.js')];
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-registry.js')];
  require('../../../renderer/js/shell/settings-validators.js');
  require('../../../renderer/js/shell/settings-registry.js');
  const S = global.window.Rga.Settings;
  S.Registry.all().forEach(function(entry) {
    assert.equal(S.Validators.validateValue(entry, entry.default), true,
      'Default for "' + entry.id + '" (type=' + entry.type +
      ') must pass its validator. Got default=' + JSON.stringify(entry.default));
  });
});

test('Slice 3C — every select/radio entry has options containing its default', () => {
  bootDom();
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-validators.js')];
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-registry.js')];
  require('../../../renderer/js/shell/settings-validators.js');
  require('../../../renderer/js/shell/settings-registry.js');
  const R = global.window.Rga.Settings.Registry;
  R.all().forEach(function(entry) {
    if (entry.type === 'select' || entry.type === 'radio') {
      assert.ok(Array.isArray(entry.options),
        entry.id + ': select/radio must declare an options array');
      assert.ok(entry.options.length > 0,
        entry.id + ': select/radio options must be non-empty');
      assert.ok(entry.options.indexOf(entry.default) >= 0,
        entry.id + ': default "' + entry.default + '" must appear in options ' +
        JSON.stringify(entry.options));
    }
  });
});

test('Slice 3C — every dependency.id references an existing registry id', () => {
  bootDom();
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-validators.js')];
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-registry.js')];
  require('../../../renderer/js/shell/settings-validators.js');
  require('../../../renderer/js/shell/settings-registry.js');
  const R = global.window.Rga.Settings.Registry;
  R.all().forEach(function(entry) {
    entry.dependencies.forEach(function(dep) {
      assert.ok(dep && typeof dep.id === 'string',
        entry.id + ': each dependency must be {id, ...}');
      assert.ok(R.has(dep.id),
        entry.id + ': dependency references unknown id "' + dep.id + '"');
    });
  });
});
