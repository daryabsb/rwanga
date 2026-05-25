// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Shell / appearance settings applicators — Slice 4B.
//
// Wires the appearance.* settings that can land today via the
// applicator registry:
//   - appearance.editorDeskColor → --editor-bg on documentElement
//   - appearance.statusBar       → rga-no-status-bar class on <body>
//
// Out of Slice 4B: theme (Rga.Theme legacy localStorage SSOT
// conflict — needs migration), sidebarPosition (grid rework),
// activityBar / formatToolbar (parallel hide-pattern, deferred for
// pairing with their own verification), minimap (no engine),
// editorPageShadow (paper-view ownership), and the four
// candidate ids not yet in the registry (accentColor / uiDensity /
// reduceMotion / inspectorCollapseMode).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bootDom(opts) {
  opts = opts || {};
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="status-bar"></div><div id="editor"></div></body></html>',
    { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  dom.window.Rga = {};
  const _store = Object.assign({}, opts.seedPrefs || {});
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
   '../../../renderer/js/shell/shell-applicators.js'
  ].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  return global.window.Rga.Settings;
}

// ----------------------------------------------------------------
// §1 — Registered ids: only the wired ids appear
// ----------------------------------------------------------------

test('Slice 4B — shell-applicators registers exactly the wired appearance settings', async () => {
  bootDom();
  const S = loadAll();
  await S.Store.init();
  const wired = S.Applicators.registered()
    .filter(function(id) { return id.indexOf('appearance.') === 0 || id === 'theme'; })
    .sort();
  assert.deepEqual(wired,
    ['appearance.editorDeskColor', 'appearance.statusBar'],
    'shell-applicators inventory must match the 2 wired ids exactly');
});

test('Slice 4B — deferred appearance/shell settings are NOT registered', () => {
  bootDom();
  const S = loadAll();
  // theme + 5 others in the registry that this slice chose to defer
  // for substantive reasons. Wiring any of them without their
  // supporting work would violate the "Real behavior only" rule.
  ['theme',
   'appearance.sidebarPosition',
   'appearance.activityBar',
   'appearance.formatToolbar',
   'appearance.minimap',
   'appearance.editorPageShadow'
  ].forEach(function(id) {
    assert.equal(S.Applicators.get(id), null,
      'Deferred id "' + id + '" must NOT have a registered applicator');
  });
});

test('Slice 4B — every wired id has owner="appearance"', () => {
  bootDom();
  const S = loadAll();
  ['appearance.editorDeskColor', 'appearance.statusBar'].forEach(function(id) {
    const a = S.Applicators.get(id);
    assert.ok(a, id + ' must have an applicator');
    assert.equal(a.owner, 'appearance', id + ': owner must be "appearance"');
  });
});

// ----------------------------------------------------------------
// §2 — editorDeskColor pushes --editor-bg onto :root
// ----------------------------------------------------------------

test('Slice 4B — editorDeskColor sets --editor-bg on documentElement', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.apply('appearance.editorDeskColor', '#1a1a2e');
  const v = dom.window.document.documentElement.style.getPropertyValue('--editor-bg');
  assert.equal(v, '#1a1a2e');
});

test('Slice 4B — Store.set("appearance.editorDeskColor", hex) flows through applicator to --editor-bg', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  const ok = S.Store.set('appearance.editorDeskColor', '#2d2520');
  assert.equal(ok, true);
  assert.equal(
    dom.window.document.documentElement.style.getPropertyValue('--editor-bg'),
    '#2d2520');
});

test('Slice 4B — invalid editorDeskColor (not 6-hex) is rejected and --editor-bg untouched', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  dom.window.document.documentElement.style.removeProperty('--editor-bg');
  const ok = S.Store.set('appearance.editorDeskColor', 'red');
  assert.equal(ok, false);
  assert.equal(
    dom.window.document.documentElement.style.getPropertyValue('--editor-bg'),
    '', 'rejected set() must not reach the applicator');
});

// ----------------------------------------------------------------
// §3 — statusBar toggles rga-no-status-bar on <body>
// ----------------------------------------------------------------

test('Slice 4B — statusBar=true removes the rga-no-status-bar class on <body>', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  dom.window.document.body.classList.add('rga-no-status-bar');
  S.Applicators.apply('appearance.statusBar', true);
  assert.equal(dom.window.document.body.classList.contains('rga-no-status-bar'), false,
    'statusBar=true must REMOVE the hide class (status bar is visible)');
});

test('Slice 4B — statusBar=false adds the rga-no-status-bar class on <body>', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.apply('appearance.statusBar', false);
  assert.equal(dom.window.document.body.classList.contains('rga-no-status-bar'), true,
    'statusBar=false must ADD the hide class (status bar hidden)');
});

test('Slice 4B — Store.set("appearance.statusBar", false) flows through to the body class', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  const ok = S.Store.set('appearance.statusBar', false);
  assert.equal(ok, true);
  assert.equal(dom.window.document.body.classList.contains('rga-no-status-bar'), true);
});

test('Slice 4B — invalid statusBar (non-boolean) is rejected and body class unchanged', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  // Start from a known state (no hide class).
  dom.window.document.body.classList.remove('rga-no-status-bar');
  const ok = S.Store.set('appearance.statusBar', 'no');
  assert.equal(ok, false);
  assert.equal(dom.window.document.body.classList.contains('rga-no-status-bar'), false);
});

// ----------------------------------------------------------------
// §4 — applyAll() at boot pushes defaults to the surface
// ----------------------------------------------------------------

test('Slice 4B — applyAll() at boot applies registry defaults for the wired ids', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.applyAll();
  // Registry defaults: editorDeskColor='#141414', statusBar=true.
  assert.equal(
    dom.window.document.documentElement.style.getPropertyValue('--editor-bg'),
    '#141414');
  assert.equal(
    dom.window.document.body.classList.contains('rga-no-status-bar'),
    false, 'default statusBar=true must NOT add the hide class');
});

// ----------------------------------------------------------------
// §5 — Persisted user-tier value rehydrates at boot
//      (slice-required "beyond theme persists and rehydrates" check;
//       theme is deferred, so editorDeskColor stands in as the proof.)
// ----------------------------------------------------------------

test('Slice 4B — persisted appearance.editorDeskColor hydrates from prefs and applies on boot', async () => {
  const dom = bootDom({ seedPrefs: { 'appearance.editorDeskColor': '#2d2520' } });
  const S = loadAll();
  await S.Store.init();
  S.Applicators.applyAll();
  assert.equal(
    dom.window.document.documentElement.style.getPropertyValue('--editor-bg'),
    '#2d2520',
    'persisted hex must apply on boot, not the registry default #141414');
});
