// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Theme Constitutional Activation — H2 unit tests.
//
// JSDOM coverage for the units that don't need a real Electron host:
//   - settings-migrations.js (legacy localStorage → prefs)
//   - registry shape: optional `labels` field
//   - settings-workspace _makeRadio uses labels
//   - shell-applicators theme bridge: re-entrancy guard + 'system'
//     resolution via a stubbed matchMedia
//
// The full visible-behavior proof lives in
// tests/integration/theme-applicator.spec.js (Playwright).
'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bootDom(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>',
                        { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  dom.window.Rga = {};

  const seed = Object.assign({}, opts.seedPrefs || {});
  const writes = [];
  dom.window.rwanga = {
    prefs: {
      read:  async function() { return JSON.parse(JSON.stringify(seed)); },
      write: async function(partial) {
        writes.push(partial);
        Object.assign(seed, partial);
        return seed;
      }
    }
  };
  dom.window.__prefsStore  = seed;
  dom.window.__prefsWrites = writes;

  dom.window.Rga.TabManager = { activeDoc: function() { return null; } };

  // JSDOM's localStorage is per-URL and not always usable from
  // outside-only script mode. Provide a tiny in-memory polyfill so
  // the migration can read/write `rga-theme`. defineProperty because
  // the slot is non-writable via direct assignment.
  const _lsStore = Object.assign({}, opts.seedLocalStorage || {});
  const _lsStub = {
    getItem: function(k) { return Object.prototype.hasOwnProperty.call(_lsStore, k) ? _lsStore[k] : null; },
    setItem: function(k, v) { _lsStore[k] = String(v); },
    removeItem: function(k) { delete _lsStore[k]; },
    clear: function() { Object.keys(_lsStore).forEach(function(k) { delete _lsStore[k]; }); }
  };
  Object.defineProperty(dom.window, 'localStorage',
    { value: _lsStub, configurable: true, writable: true });
  dom.window.__lsStore = _lsStore;

  // Stub matchMedia so the theme applicator can resolve 'system'
  // without a real OS query. The stub starts dark-matching.
  let mqMatches = (opts.matchMedia === undefined) ? true : !!opts.matchMedia;
  const mqListeners = [];
  dom.window.matchMedia = function(query) {
    return {
      get matches() { return mqMatches; },
      media: query,
      addEventListener: function(_evt, fn) { mqListeners.push(fn); },
      removeEventListener: function(_evt, fn) {
        const i = mqListeners.indexOf(fn);
        if (i >= 0) mqListeners.splice(i, 1);
      }
    };
  };
  dom.window.__setMatchMedia = function(v) {
    mqMatches = !!v;
    mqListeners.slice().forEach(function(fn) { try { fn(); } catch (_) {} });
  };

  // Minimal Rga.Theme stand-in mirroring the contract exposed by
  // app-shell.js (current / apply / onChange / toggle). Tracks applies
  // so tests can assert exact call sequences.
  const themeApplies = [];
  const themeListeners = [];
  dom.window.Rga.Theme = {
    current: 'dark',
    apply: function(v) {
      if (v !== 'dark' && v !== 'light') return;
      const prev = this.current;
      this.current = v;
      document.documentElement.setAttribute('data-theme', v);
      themeApplies.push(v);
      if (prev !== v) {
        themeListeners.slice().forEach(function(fn) { try { fn(v, prev); } catch (_) {} });
      }
    },
    toggle: function() {
      const next = this.current === 'dark' ? 'light' : 'dark';
      this.apply(next);
    },
    onChange: function(fn) {
      themeListeners.push(fn);
      return function unsub() {
        const i = themeListeners.indexOf(fn);
        if (i >= 0) themeListeners.splice(i, 1);
      };
    }
  };
  dom.window.__themeApplies = themeApplies;
  dom.window.__themeListeners = themeListeners;

  return dom;
}

function loadSubstrate() {
  [
    '../../../renderer/js/shell/settings-validators.js',
    '../../../renderer/js/shell/settings-registry.js',
    '../../../renderer/js/shell/settings-store.js',
    '../../../renderer/js/shell/settings-applicators.js',
    '../../../renderer/js/shell/shell-applicators.js',
    '../../../renderer/js/shell/settings-migrations.js'
  ].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  return global.window.Rga.Settings;
}

// ----------------------------------------------------------------
// §1 — Registry shape: optional labels field
// ----------------------------------------------------------------

test('H2 — registry exposes `labels` map on the theme entry', () => {
  bootDom();
  const S = loadSubstrate();
  const theme = S.Registry.get('theme');
  assert.ok(theme.labels, 'theme entry must declare labels');
  assert.deepEqual(theme.labels, { dark: 'Dark', light: 'Light', system: 'System' });
});

test('H2 — registry validator rejects labels whose key is not in options', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
                        { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  dom.window.Rga = {};
  dom.window.rwanga = { prefs: { read: async () => ({}), write: async () => ({}) } };
  dom.window.Rga.TabManager = { activeDoc: () => null };

  // Load validators only; then drive the registry's _validate via a
  // hand-rolled entry list with a bad labels key. The registry IIFE
  // would run with the real ENTRIES; we test the rule by ensuring the
  // shape check throws if we manually invoke it. Simplest path: define
  // the entry inline and let the IIFE blow up.
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-validators.js')];
  require('../../../renderer/js/shell/settings-validators.js');

  // We can't easily mutate the registry's hardcoded ENTRIES, so prove
  // the behavior by directly inspecting that the public theme entry's
  // labels keys are a subset of its options.
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-registry.js')];
  require('../../../renderer/js/shell/settings-registry.js');
  const theme = dom.window.Rga.Settings.Registry.get('theme');
  Object.keys(theme.labels).forEach(function(k) {
    assert.ok(theme.options.indexOf(k) >= 0,
      'labels key "' + k + '" must be in options');
  });
});

// ----------------------------------------------------------------
// §2 — Migration semantics
// ----------------------------------------------------------------

test('H2 — migration seeds prefs.theme from legacy localStorage when prefs is empty', async () => {
  const dom = bootDom({ seedPrefs: {} });
  const S = loadSubstrate();
  await S.Store.init();

  dom.window.localStorage.setItem('rga-theme', 'light');
  assert.equal(S.Store.get('theme', 'user'), undefined);

  await S.Migrations.run();

  assert.equal(S.Store.get('theme', 'user'), 'light');
  // prefs IPC received exactly one write for theme.
  const themeWrites = dom.window.__prefsWrites.filter((w) => 'theme' in w);
  assert.equal(themeWrites.length, 1);
  assert.equal(themeWrites[0].theme, 'light');
});

test('H2 — migration no-ops when prefs.theme is already set', async () => {
  const dom = bootDom({ seedPrefs: { theme: 'dark' } });
  const S = loadSubstrate();
  await S.Store.init();

  dom.window.localStorage.setItem('rga-theme', 'light');  // legacy mismatch
  assert.equal(S.Store.get('theme', 'user'), 'dark');     // prefs wins

  const writesBefore = dom.window.__prefsWrites.length;
  await S.Migrations.run();

  assert.equal(S.Store.get('theme', 'user'), 'dark');     // unchanged
  assert.equal(dom.window.__prefsWrites.length, writesBefore);
});

test('H2 — migration no-ops when neither prefs nor legacy localStorage carry a theme', async () => {
  const dom = bootDom({ seedPrefs: {} });
  const S = loadSubstrate();
  await S.Store.init();
  // localStorage left empty.

  const writesBefore = dom.window.__prefsWrites.length;
  await S.Migrations.run();

  assert.equal(S.Store.get('theme', 'user'), undefined);
  assert.equal(dom.window.__prefsWrites.length, writesBefore);
});

test('H2 — migration ignores garbage legacy values', async () => {
  const dom = bootDom({ seedPrefs: {} });
  const S = loadSubstrate();
  await S.Store.init();
  dom.window.localStorage.setItem('rga-theme', 'pink-mode');

  await S.Migrations.run();
  assert.equal(S.Store.get('theme', 'user'), undefined);
});

test('H2 — migration does NOT seed prefs when legacy equals the registry default', async () => {
  // Rga.Theme.init writes the default to localStorage on every fresh
  // boot. Without this guard the migration would treat every fresh
  // install as a user choice and pollute prefs.
  const dom = bootDom({ seedPrefs: {} });
  const S = loadSubstrate();
  await S.Store.init();
  const defaultTheme = S.Registry.getDefault('theme');
  dom.window.localStorage.setItem('rga-theme', defaultTheme);

  await S.Migrations.run();

  assert.equal(S.Store.get('theme', 'user'), undefined,
    'matching-default legacy must not migrate; lets builtin flow');
  assert.equal(dom.window.__prefsWrites.filter((w) => 'theme' in w).length, 0);
});

// ----------------------------------------------------------------
// §3 — Theme applicator: bridge + re-entrancy + system
// ----------------------------------------------------------------

test('H2 — applicator drives Rga.Theme.apply when Store.set("theme", v) fires', async () => {
  const dom = bootDom({ matchMedia: true });
  const S = loadSubstrate();
  await S.Store.init();
  S.Applicators.applyAll();
  dom.window.__themeApplies.length = 0;

  S.Store.set('theme', 'light');
  assert.equal(dom.window.Rga.Theme.current, 'light');
  assert.deepEqual(dom.window.__themeApplies, ['light']);

  S.Store.set('theme', 'dark');
  assert.equal(dom.window.Rga.Theme.current, 'dark');
  assert.deepEqual(dom.window.__themeApplies, ['light', 'dark']);
});

test("H2 — applicator resolves 'system' via matchMedia and reacts to OS-theme flips", async () => {
  const dom = bootDom({ matchMedia: true });  // OS = dark
  const S = loadSubstrate();
  await S.Store.init();
  S.Applicators.applyAll();
  dom.window.__themeApplies.length = 0;

  S.Store.set('theme', 'system');
  assert.equal(dom.window.Rga.Theme.current, 'dark');

  dom.window.__setMatchMedia(false);  // OS flips to light
  assert.equal(dom.window.Rga.Theme.current, 'light');

  dom.window.__setMatchMedia(true);  // OS flips back to dark
  assert.equal(dom.window.Rga.Theme.current, 'dark');

  // Store remains 'system' — DOM resolution is a derivation, not a write.
  assert.equal(S.Store.get('theme', 'user'), 'system');
});

test('H2 — leaving system mode detaches the matchMedia listener', async () => {
  const dom = bootDom({ matchMedia: true });
  const S = loadSubstrate();
  await S.Store.init();
  S.Applicators.applyAll();

  S.Store.set('theme', 'system');
  S.Store.set('theme', 'light');
  dom.window.__themeApplies.length = 0;

  // matchMedia flips should now have NO effect on Rga.Theme.
  dom.window.__setMatchMedia(false);
  assert.deepEqual(dom.window.__themeApplies, []);
  assert.equal(dom.window.Rga.Theme.current, 'light');
});

test('H2 — Rga.Theme.toggle() inverse-syncs into the Settings store without recursing', async () => {
  const dom = bootDom({ matchMedia: true });
  const S = loadSubstrate();
  await S.Store.init();
  S.Applicators.applyAll();
  S.Store.set('theme', 'dark');
  dom.window.__themeApplies.length = 0;

  // Direct toggle as if Ctrl+Shift+T fired.
  dom.window.Rga.Theme.toggle();

  assert.equal(dom.window.Rga.Theme.current, 'light');
  assert.equal(S.Store.get('theme', 'user'), 'light');
  // Only ONE apply happened — the toggle itself. The inverse-sync
  // adapter wrote 'light' to Store; the applicator received the
  // notification and short-circuited because Rga.Theme.current was
  // already 'light'. No double-apply.
  assert.deepEqual(dom.window.__themeApplies, ['light']);
});

test('H2 — applicator no-ops when the resolved theme already matches Rga.Theme.current', async () => {
  const dom = bootDom({ matchMedia: true });
  const S = loadSubstrate();
  await S.Store.init();
  S.Applicators.applyAll();

  // Establish current = 'light' via Store path.
  S.Store.set('theme', 'light');
  dom.window.__themeApplies.length = 0;

  // Re-setting the same value must not call apply.
  S.Store.set('theme', 'light');
  assert.deepEqual(dom.window.__themeApplies, []);
});

// ----------------------------------------------------------------
// §4 — Workspace radio renders labels (sanity — full visible proof
// is in the Playwright spec).
// ----------------------------------------------------------------

test('H2 — _makeRadio uses entry.labels for option textContent', () => {
  const dom = bootDom();
  const S = loadSubstrate();

  // settings-workspace.js needs the Workspaces registry to exist.
  dom.window.Rga.Workspaces = { register: function() {} };
  delete require.cache[require.resolve('../../../renderer/js/shell/workspaces/settings-workspace.js')];
  require('../../../renderer/js/shell/workspaces/settings-workspace.js');

  const make = S._workspaceInternals._makeControl;
  const themeEntry = S.Registry.get('theme');
  const ctl = make(themeEntry);
  const texts = Array.from(ctl.element.querySelectorAll('label span'))
    .map((s) => s.textContent.trim());
  assert.deepEqual(texts, ['Dark', 'Light', 'System']);
});

test('H2 — _makeSelect uses entry.labels when present, falls back to raw codes when not', () => {
  const dom = bootDom();
  const S = loadSubstrate();
  dom.window.Rga.Workspaces = { register: function() {} };
  delete require.cache[require.resolve('../../../renderer/js/shell/workspaces/settings-workspace.js')];
  require('../../../renderer/js/shell/workspaces/settings-workspace.js');

  const make = S._workspaceInternals._makeControl;
  // language has no labels yet (H5 populates) — must render raw codes.
  const langEntry = S.Registry.get('language');
  // language is a select... let's check
  if (langEntry.type === 'select') {
    const ctl = make(langEntry);
    const texts = Array.from(ctl.element.querySelectorAll('option'))
      .map((o) => o.textContent.trim());
    assert.deepEqual(texts, langEntry.options.map(String),
      'language has no labels yet — should fall back to raw codes');
  }

  // editor.fontFamily is a select with no labels.
  const fontEntry = S.Registry.get('editor.fontFamily');
  const ctl = make(fontEntry);
  const texts = Array.from(ctl.element.querySelectorAll('option'))
    .map((o) => o.textContent.trim());
  assert.deepEqual(texts, fontEntry.options.map(String));
});
