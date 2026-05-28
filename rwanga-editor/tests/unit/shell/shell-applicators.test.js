// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Shell / appearance settings applicators — Slice 4B + S9.1.
//
// Wired (Slice 4B):
//   - appearance.editorDeskColor → --editor-bg on documentElement
//   - appearance.statusBar       → rga-no-status-bar class on <body>
//
// Wired (S9.1, 2026-05-28):
//   - appearance.editorPageShadow → body[data-page-shadow]
//   - appearance.sidebarPosition  → body[data-sidebar-position]
//   - appearance.activityBar      → body.rga-no-activity-bar
//   - appearance.formatToolbar    → body.rga-no-format-toolbar
//   - autosave.enabled            → body[data-autosave] + Autosave.setEnabled
//   - autosave.interval           → body[data-autosave-interval-seconds] + Autosave.setInterval
//   - confirmBeforeClose          → body[data-confirm-close] + CloseGuard.setConfirmEnabled
//
// Still deferred:
//   - appearance.minimap          → overview engine does not exist.
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

test('Slice 4B + S9.1 — shell-applicators registers exactly the wired appearance settings', async () => {
  bootDom();
  const S = loadAll();
  await S.Store.init();
  const wired = S.Applicators.registered()
    .filter(function(id) { return id.indexOf('appearance.') === 0 || id === 'theme'; })
    .sort();
  assert.deepEqual(wired, [
    'appearance.activityBar',        // S9.1
    'appearance.editorDeskColor',
    'appearance.editorPageShadow',   // S9.1
    'appearance.formatToolbar',      // S9.1
    'appearance.sidebarPosition',    // S9.1
    'appearance.statusBar',
    'theme'                          // H2 (post-S12)
  ], 'shell-applicators inventory must match the wired appearance.* + theme set');
});

test('S9.1 — previously-deferred appearance settings are NOW registered', () => {
  bootDom();
  const S = loadAll();
  ['appearance.sidebarPosition',
   'appearance.activityBar',
   'appearance.formatToolbar',
   'appearance.editorPageShadow'
  ].forEach(function(id) {
    const a = S.Applicators.get(id);
    assert.ok(a, 'S9.1 id "' + id + '" must have a registered applicator');
    assert.equal(a.owner, 'appearance', id + ': owner must be "appearance"');
  });
});

test('S9.1 — autosave.* and confirmBeforeClose are registered with the right owners', () => {
  bootDom();
  const S = loadAll();
  const autosaveEnabled = S.Applicators.get('autosave.enabled');
  const autosaveInterval = S.Applicators.get('autosave.interval');
  const confirmClose = S.Applicators.get('confirmBeforeClose');
  assert.ok(autosaveEnabled, 'autosave.enabled must have an applicator');
  assert.equal(autosaveEnabled.owner, 'autosave');
  assert.ok(autosaveInterval, 'autosave.interval must have an applicator');
  assert.equal(autosaveInterval.owner, 'autosave');
  assert.ok(confirmClose, 'confirmBeforeClose must have an applicator');
  assert.equal(confirmClose.owner, 'general');
});

test('Slice 4B + S9.1 — appearance.minimap remains DEFERRED (engine doesn\'t exist)', () => {
  bootDom();
  const S = loadAll();
  assert.equal(S.Applicators.get('appearance.minimap'), null,
    'appearance.minimap must remain unregistered until an overview engine ships');
});

test('Slice 4B — every wired id has the expected owner', () => {
  bootDom();
  const S = loadAll();
  const expected = {
    'appearance.editorDeskColor':  'appearance',
    'appearance.statusBar':        'appearance',
    'appearance.editorPageShadow': 'appearance',   // S9.1
    'appearance.sidebarPosition':  'appearance',   // S9.1
    'appearance.activityBar':      'appearance',   // S9.1
    'appearance.formatToolbar':    'appearance',   // S9.1
    'autosave.enabled':            'autosave',     // S9.1
    'autosave.interval':           'autosave',     // S9.1
    'confirmBeforeClose':          'general'       // S9.1
  };
  Object.keys(expected).forEach(function(id) {
    const a = S.Applicators.get(id);
    assert.ok(a, id + ' must have an applicator');
    assert.equal(a.owner, expected[id], id + ': owner mismatch');
  });
});

// ----------------------------------------------------------------
// §2 — editorDeskColor pushes --editor-bg onto :root
// ----------------------------------------------------------------

test('Slice 4B — editorDeskColor sets --editor-bg on documentElement when user has set a value', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  // Set via Store so the user-tier override exists; the applicator
  // gate (post-5B drift fix) only pushes the inline var when a non-
  // builtin tier carries a value.
  S.Store.set('appearance.editorDeskColor', '#1a1a2e');
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

test('Slice 4B drift guard — applyAll() at boot does NOT inline --editor-bg when there is no user override', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.applyAll();
  // Registry default for editorDeskColor is '#141414'. Pushing it
  // inline at boot would override [data-theme="light"]'s desk token
  // (#d6d6d6) and turn light theme black. With the post-5B gate,
  // applyAll must leave the inline value empty so theme tokens win.
  assert.equal(
    dom.window.document.documentElement.style.getPropertyValue('--editor-bg'),
    '',
    'No inline --editor-bg may be set at boot when there is no user override');
  // statusBar applicator is a class toggle whose default state (no
  // class added) already matches the unstyled surface — no drift.
  assert.equal(
    dom.window.document.body.classList.contains('rga-no-status-bar'),
    false, 'default statusBar=true must NOT add the hide class');
});

test('Slice 4B drift guard — once user sets editorDeskColor, applyAll DOES inline it', async () => {
  const dom = bootDom({ seedPrefs: { 'appearance.editorDeskColor': '#2d2520' } });
  const S = loadAll();
  await S.Store.init();
  S.Applicators.applyAll();
  // User-tier value present via seeded prefs → applicator pushes it.
  assert.equal(
    dom.window.document.documentElement.style.getPropertyValue('--editor-bg'),
    '#2d2520');
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

// ----------------------------------------------------------------
// §6 — S9.1 visible-DOM-delta proofs (one per new applicator)
// ----------------------------------------------------------------

test('S9.1 — appearance.editorPageShadow writes data-page-shadow on <body>', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.apply('appearance.editorPageShadow', true);
  assert.equal(dom.window.document.body.getAttribute('data-page-shadow'), 'on');
  S.Applicators.apply('appearance.editorPageShadow', false);
  assert.equal(dom.window.document.body.getAttribute('data-page-shadow'), 'off');
});

test('S9.1 — appearance.sidebarPosition writes data-sidebar-position on <body> (left | right)', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.apply('appearance.sidebarPosition', 'left');
  assert.equal(dom.window.document.body.getAttribute('data-sidebar-position'), 'left');
  S.Applicators.apply('appearance.sidebarPosition', 'right');
  assert.equal(dom.window.document.body.getAttribute('data-sidebar-position'), 'right');
  // Defensive: unknown values normalise to 'left'.
  S.Applicators.apply('appearance.sidebarPosition', 'bogus');
  assert.equal(dom.window.document.body.getAttribute('data-sidebar-position'), 'left');
});

test('S9.1 — appearance.activityBar toggles .rga-no-activity-bar on <body> (inverse polarity)', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.apply('appearance.activityBar', true);
  assert.equal(dom.window.document.body.classList.contains('rga-no-activity-bar'), false,
    'ON → class absent (rail visible)');
  S.Applicators.apply('appearance.activityBar', false);
  assert.equal(dom.window.document.body.classList.contains('rga-no-activity-bar'), true,
    'OFF → class present (rail hidden)');
});

test('S9.1 — appearance.formatToolbar toggles .rga-no-format-toolbar on <body> (inverse polarity)', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.apply('appearance.formatToolbar', true);
  assert.equal(dom.window.document.body.classList.contains('rga-no-format-toolbar'), false);
  S.Applicators.apply('appearance.formatToolbar', false);
  assert.equal(dom.window.document.body.classList.contains('rga-no-format-toolbar'), true);
});

test('S9.1 — autosave.enabled writes data-autosave + drives Rga.Autosave.setEnabled when present', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  const calls = [];
  dom.window.Rga.Autosave = { setEnabled: function(v) { calls.push(v); } };
  S.Applicators.apply('autosave.enabled', true);
  assert.equal(dom.window.document.body.getAttribute('data-autosave'), 'on');
  S.Applicators.apply('autosave.enabled', false);
  assert.equal(dom.window.document.body.getAttribute('data-autosave'), 'off');
  assert.deepEqual(calls, [true, false]);
});

test('S9.1 — autosave.enabled is tolerant when Rga.Autosave is absent', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  delete dom.window.Rga.Autosave;
  S.Applicators.apply('autosave.enabled', true);   // must not throw
  assert.equal(dom.window.document.body.getAttribute('data-autosave'), 'on');
});

test('S9.1 — autosave.interval writes data-autosave-interval-seconds + drives Autosave.setInterval', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  const calls = [];
  dom.window.Rga.Autosave = { setInterval: function(v) { calls.push(v); } };
  S.Applicators.apply('autosave.interval', 45);
  assert.equal(dom.window.document.body.getAttribute('data-autosave-interval-seconds'), '45');
  assert.deepEqual(calls, [45]);
  // Defensive: invalid values fall back to 30.
  S.Applicators.apply('autosave.interval', 'broken');
  assert.equal(dom.window.document.body.getAttribute('data-autosave-interval-seconds'), '30');
});

test('S9.1 — confirmBeforeClose writes data-confirm-close + drives CloseGuard.setConfirmEnabled', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  const calls = [];
  dom.window.Rga.CloseGuard = { setConfirmEnabled: function(v) { calls.push(v); } };
  S.Applicators.apply('confirmBeforeClose', true);
  assert.equal(dom.window.document.body.getAttribute('data-confirm-close'), 'on');
  S.Applicators.apply('confirmBeforeClose', false);
  assert.equal(dom.window.document.body.getAttribute('data-confirm-close'), 'off');
  assert.deepEqual(calls, [true, false]);
});
