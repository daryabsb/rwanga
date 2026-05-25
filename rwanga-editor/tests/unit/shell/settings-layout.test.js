// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Layout — Slice 3B.
//
// The layout is the presentation map: sections, section order, and
// ordered setting ids per section. It is independent of the registry
// (layout references registry ids; registry does not know layout
// exists). All registry ids must appear in some section OR be listed
// in the layout's HIDDEN_IDS array.
//
// Slice 3B scope: layout shape + cross-validation against the
// registry. No UI, no Settings tab content.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const REQUIRED_SECTION_FIELDS = [
  'id', 'label', 'description', 'icon', 'settingIds'
];

// 9 sections in the design file (docs/rwanga-settings/settings-data.jsx).
const EXPECTED_SECTION_IDS = [
  'general', 'editor', 'screenplay', 'pageSetup', 'printExport',
  'autosave', 'appearance', 'shortcuts', 'advanced'
];

function bootDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
                        { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = {};
  return dom;
}

function loadLayout() {
  // Registry must load first — the layout validates against it.
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-registry.js')];
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-layout.js')];
  require('../../../renderer/js/shell/settings-registry.js');
  require('../../../renderer/js/shell/settings-layout.js');
  return global.window.Rga.Settings;
}

// ----------------------------------------------------------------
// §1 — Module presence + public API
// ----------------------------------------------------------------

test('Slice 3B — Rga.Settings.Layout exists with required public API', () => {
  bootDom();
  const S = loadLayout();
  assert.equal(typeof S.Layout, 'object', 'Layout must be exposed on Rga.Settings.Layout');
  assert.equal(typeof S.Layout.sections,      'function');
  assert.equal(typeof S.Layout.getSection,    'function');
  assert.equal(typeof S.Layout.getSectionFor, 'function');
  assert.equal(typeof S.Layout.hiddenIds,     'function');
});

// ----------------------------------------------------------------
// §2 — Sections
// ----------------------------------------------------------------

test('Slice 3B — layout has 9 sections in the declared order', () => {
  bootDom();
  const S = loadLayout();
  const ids = S.Layout.sections().map(function(s) { return s.id; });
  assert.deepEqual(ids, EXPECTED_SECTION_IDS,
    'section order must match docs/rwanga-settings/settings-data.jsx');
});

test('Slice 3B — every section has all required fields', () => {
  bootDom();
  const S = loadLayout();
  S.Layout.sections().forEach(function(section) {
    REQUIRED_SECTION_FIELDS.forEach(function(f) {
      assert.ok(Object.prototype.hasOwnProperty.call(section, f),
        'Section "' + section.id + '" missing field "' + f + '"');
    });
    assert.equal(typeof section.label, 'string');
    assert.ok(section.label.length > 0, section.id + ': label must be non-empty');
    assert.equal(typeof section.description, 'string');
    assert.ok(section.description.length > 0, section.id + ': description must be non-empty');
    assert.equal(typeof section.icon, 'string');
    assert.ok(section.icon.length > 0, section.id + ': icon must be non-empty');
    assert.ok(Array.isArray(section.settingIds),
      section.id + ': settingIds must be an array');
    assert.ok(section.settingIds.length > 0,
      section.id + ': settingIds must be non-empty');
  });
});

test('Slice 3B — section ids are unique', () => {
  bootDom();
  const S = loadLayout();
  const ids = S.Layout.sections().map(function(s) { return s.id; });
  assert.equal(ids.length, new Set(ids).size,
    'section ids must be unique');
});

// ----------------------------------------------------------------
// §3 — Cross-validation against the registry
// ----------------------------------------------------------------

test('Slice 3B — every setting id in the layout exists in the registry', () => {
  bootDom();
  const S = loadLayout();
  S.Layout.sections().forEach(function(section) {
    section.settingIds.forEach(function(id) {
      assert.ok(S.Registry.has(id),
        'Section "' + section.id + '" references unknown registry id: ' + id);
    });
  });
});

test('Slice 3B — no setting id appears in more than one section', () => {
  bootDom();
  const S = loadLayout();
  const seen = new Map();
  S.Layout.sections().forEach(function(section) {
    section.settingIds.forEach(function(id) {
      if (seen.has(id)) {
        assert.fail('Setting "' + id + '" appears in both "' + seen.get(id) +
          '" and "' + section.id + '"');
      }
      seen.set(id, section.id);
    });
  });
});

test('Slice 3B — every registry id appears in some section OR in HIDDEN_IDS', () => {
  bootDom();
  const S = loadLayout();
  const hidden = new Set(S.Layout.hiddenIds());
  const placed = new Set();
  S.Layout.sections().forEach(function(section) {
    section.settingIds.forEach(function(id) { placed.add(id); });
  });
  S.Registry.ids().forEach(function(id) {
    const covered = placed.has(id) || hidden.has(id);
    assert.ok(covered,
      'Registry id "' + id + '" is neither in a layout section nor in HIDDEN_IDS');
  });
});

test('Slice 3B — HIDDEN_IDS entries (if any) exist in the registry', () => {
  bootDom();
  const S = loadLayout();
  S.Layout.hiddenIds().forEach(function(id) {
    assert.ok(S.Registry.has(id),
      'HIDDEN_IDS references unknown registry id: ' + id);
  });
});

test('Slice 3B — total setting ids across sections equals registry size minus hidden', () => {
  bootDom();
  const S = loadLayout();
  const placed = S.Layout.sections().reduce(function(n, s) {
    return n + s.settingIds.length;
  }, 0);
  const expected = S.Registry.all().length - S.Layout.hiddenIds().length;
  assert.equal(placed, expected,
    'sum(section.settingIds) + hiddenIds must equal registry size');
});

// ----------------------------------------------------------------
// §4 — Lookups
// ----------------------------------------------------------------

test('Slice 3B — getSection(id) returns the section for a known id', () => {
  bootDom();
  const S = loadLayout();
  const editor = S.Layout.getSection('editor');
  assert.ok(editor, 'editor section must be findable');
  assert.equal(editor.id, 'editor');
});

test('Slice 3B — getSection(id) returns null for an unknown id', () => {
  bootDom();
  const S = loadLayout();
  assert.equal(S.Layout.getSection('not.a.section'), null);
});

test('Slice 3B — getSectionFor(settingId) returns the owning section', () => {
  bootDom();
  const S = loadLayout();
  const sec = S.Layout.getSectionFor('editor.fontSize');
  assert.ok(sec);
  assert.equal(sec.id, 'editor');
});

test('Slice 3B — getSectionFor(settingId) returns null for an unknown id', () => {
  bootDom();
  const S = loadLayout();
  assert.equal(S.Layout.getSectionFor('not.a.setting'), null);
});

test('Slice 3B — sections() returns a fresh array (caller cannot mutate internal state)', () => {
  bootDom();
  const S = loadLayout();
  const a = S.Layout.sections();
  a.push({ id: 'forged' });
  const b = S.Layout.sections();
  assert.equal(b.length, EXPECTED_SECTION_IDS.length,
    'Internal section list must not be affected by caller mutation');
});
