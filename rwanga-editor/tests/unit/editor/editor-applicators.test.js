// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Editor settings applicators — Slice 4A + S9.1.
//
// Wires editor.* settings (fontFamily, fontSize, lineHeight,
// spellcheck, scriptLanguage) through Rga.Settings.Applicators.
// editor.highlightCurrentLine remains wired by its own module from
// Slice 2/3D, consolidated into editor-applicators.js in 4A.
//
// S9.1 (2026-05-28) wires the previously-deferred trio:
//   - editor.wordWrap        → body[data-word-wrap]
//   - editor.autocomplete    → body[data-autocomplete] + stub flag
//   - editor.showLineNumbers → body.rga-no-line-numbers (CSS hides
//                              .flow-line-gutter); default flipped
//                              false → true to match the locked Flow
//                              gutter visible-default.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bootDom(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>',
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
  // Validators → Registry → Store → Applicators → editor-applicators.
  // Same order as renderer/index.html.
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

// ----------------------------------------------------------------
// §1 — Registered ids: every wired id present; every deferred id absent
// ----------------------------------------------------------------

test('Slice 4A + S9.1 — editor-applicators registers exactly the wired editor settings', async () => {
  bootDom();
  const S = loadAll();
  await S.Store.init();
  const ids = S.Applicators.registered().sort();
  // S9.1 (2026-05-28): autocomplete + wordWrap + showLineNumbers
  // promoted from PERSISTS_ONLY to REAL. The inventory now covers the
  // entire editor.* group in the registry.
  assert.deepEqual(ids, [
    'editor.autocomplete',
    'editor.fontFamily',
    'editor.fontSize',
    'editor.highlightCurrentLine',
    'editor.lineHeight',
    'editor.scriptLanguage',
    'editor.showLineNumbers',
    'editor.spellcheck',
    'editor.wordWrap'
  ], 'applicator inventory must match the S9.1 wired set');
});

test('S9.1 — previously-deferred editor settings are NOW registered', () => {
  bootDom();
  const S = loadAll();
  // S9.1 inverts the prior Slice-4A "NOT registered" assertion.
  ['editor.autocomplete', 'editor.wordWrap', 'editor.showLineNumbers']
    .forEach(function(id) {
      const a = S.Applicators.get(id);
      assert.ok(a, 'S9.1 id "' + id + '" must have a registered applicator');
      assert.equal(a.owner, 'editor', id + ': owner must be "editor"');
    });
});

test('Slice 4A — every wired id has an owner of "editor"', () => {
  bootDom();
  const S = loadAll();
  ['editor.fontFamily', 'editor.fontSize', 'editor.lineHeight',
   'editor.spellcheck', 'editor.highlightCurrentLine',
   'editor.scriptLanguage',
   // S9.1 additions
   'editor.autocomplete', 'editor.wordWrap', 'editor.showLineNumbers']
    .forEach(function(id) {
      const a = S.Applicators.get(id);
      assert.ok(a, id + ' must have an applicator');
      assert.equal(a.owner, 'editor', id + ': owner must be "editor"');
    });
});

// ----------------------------------------------------------------
// §2 — Each wired applicator pushes the value to #editor
// ----------------------------------------------------------------

test('Slice 4A — editor.fontFamily sets --font-editor on #editor', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.apply('editor.fontFamily', 'Noto Naskh Arabic');
  const v = dom.window.document.getElementById('editor').style.getPropertyValue('--font-editor');
  assert.ok(v.indexOf('Noto Naskh Arabic') >= 0,
    '--font-editor must contain the chosen face; got: ' + JSON.stringify(v));
});

test('Slice 4A — editor.fontSize sets --editor-font-size on #editor (with pt unit)', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.apply('editor.fontSize', 14);
  const v = dom.window.document.getElementById('editor').style.getPropertyValue('--editor-font-size');
  assert.equal(v, '14pt', '--editor-font-size must carry the pt unit');
});

test('Slice 4A — editor.lineHeight sets --editor-line-height on #editor (unitless) when user has chosen a value', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  // Route via Store so the user-tier override exists; the post-5B
  // drift gate only pushes the inline value when a non-builtin tier
  // carries a value.
  S.Store.set('editor.lineHeight', '1.5');
  const v = dom.window.document.getElementById('editor').style.getPropertyValue('--editor-line-height');
  assert.equal(v, '1.5');
});

test('Slice 4A — editor.spellcheck toggles the spellcheck attribute on #editor', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.apply('editor.spellcheck', true);
  assert.equal(dom.window.document.getElementById('editor').getAttribute('spellcheck'), 'true');
  S.Applicators.apply('editor.spellcheck', false);
  assert.equal(dom.window.document.getElementById('editor').getAttribute('spellcheck'), 'false');
});

// ----------------------------------------------------------------
// S9.1 — new applicators push to <body> + (autocomplete) stub flag
// ----------------------------------------------------------------

test('S9.1 — editor.wordWrap writes data-word-wrap on <body> (page | viewport | off)', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.apply('editor.wordWrap', 'page');
  assert.equal(dom.window.document.body.getAttribute('data-word-wrap'), 'page');
  S.Applicators.apply('editor.wordWrap', 'viewport');
  assert.equal(dom.window.document.body.getAttribute('data-word-wrap'), 'viewport');
  S.Applicators.apply('editor.wordWrap', 'off');
  assert.equal(dom.window.document.body.getAttribute('data-word-wrap'), 'off');
  // Defensive: unknown values normalise to 'page'.
  S.Applicators.apply('editor.wordWrap', 'bogus');
  assert.equal(dom.window.document.body.getAttribute('data-word-wrap'), 'page');
});

test('S9.1 — editor.autocomplete writes data-autocomplete on <body> + calls stub setEnabled when present', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  // Install a stub Rga.Autocomplete so the applicator's hook is exercised.
  const calls = [];
  dom.window.Rga.Autocomplete = { setEnabled: function(v) { calls.push(v); } };
  S.Applicators.apply('editor.autocomplete', true);
  assert.equal(dom.window.document.body.getAttribute('data-autocomplete'), 'on');
  S.Applicators.apply('editor.autocomplete', false);
  assert.equal(dom.window.document.body.getAttribute('data-autocomplete'), 'off');
  assert.deepEqual(calls, [true, false], 'stub flag must mirror Store value');
});

test('S9.1 — editor.autocomplete is tolerant when Rga.Autocomplete is absent (engine ships later)', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  delete dom.window.Rga.Autocomplete;
  S.Applicators.apply('editor.autocomplete', true);  // must not throw
  assert.equal(dom.window.document.body.getAttribute('data-autocomplete'), 'on');
});

test('S9.1 — editor.showLineNumbers toggles .rga-no-line-numbers on <body> (inverse polarity)', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.apply('editor.showLineNumbers', true);
  assert.equal(dom.window.document.body.classList.contains('rga-no-line-numbers'), false,
    'ON → class absent (gutter visible via .view-flow rule)');
  S.Applicators.apply('editor.showLineNumbers', false);
  assert.equal(dom.window.document.body.classList.contains('rga-no-line-numbers'), true,
    'OFF → class present (CSS hides .flow-line-gutter)');
});

test('Slice 4A — editor.highlightCurrentLine still toggles rga-line-highlight-on (regression)', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.apply('editor.highlightCurrentLine', true);
  assert.equal(
    dom.window.document.getElementById('editor').classList.contains('rga-line-highlight-on'),
    true);
  S.Applicators.apply('editor.highlightCurrentLine', false);
  assert.equal(
    dom.window.document.getElementById('editor').classList.contains('rga-line-highlight-on'),
    false);
});

// ----------------------------------------------------------------
// §3 — Store.set → applicator fires (the live subscription path)
// ----------------------------------------------------------------

test('Slice 4A — Store.set("editor.fontSize", 16) applies through the registered applicator', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  const ok = S.Store.set('editor.fontSize', 16);
  assert.equal(ok, true);
  assert.equal(
    dom.window.document.getElementById('editor').style.getPropertyValue('--editor-font-size'),
    '16pt');
});

test('Slice 4A — Store.set("editor.fontFamily", "Courier New") applies through the registered applicator', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  const ok = S.Store.set('editor.fontFamily', 'Courier New');
  assert.equal(ok, true);
  const v = dom.window.document.getElementById('editor').style.getPropertyValue('--font-editor');
  assert.ok(v.indexOf('Courier New') >= 0);
});

// ----------------------------------------------------------------
// §4 — Invalid values are still rejected (Slice 3C policy survives)
// ----------------------------------------------------------------

test('Slice 4A — invalid editor.fontSize ("12pt") is rejected and the DOM is untouched', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  // Reset the var to the empty string before the test so we can
  // confirm the rejected write did not leak through.
  dom.window.document.getElementById('editor').style.removeProperty('--editor-font-size');
  const ok = S.Store.set('editor.fontSize', '12pt');  // string, not number
  assert.equal(ok, false);
  const v = dom.window.document.getElementById('editor').style.getPropertyValue('--editor-font-size');
  assert.equal(v, '', 'rejected set() must not reach the applicator');
});

test('Slice 4A — invalid editor.fontFamily (not in options) is rejected and the DOM is untouched', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  dom.window.document.getElementById('editor').style.removeProperty('--font-editor');
  const ok = S.Store.set('editor.fontFamily', 'Comic Sans');
  assert.equal(ok, false);
  assert.equal(
    dom.window.document.getElementById('editor').style.getPropertyValue('--font-editor'),
    '');
});

// ----------------------------------------------------------------
// §5 — applyAll() at boot pushes defaults (drift-aware)
// ----------------------------------------------------------------

test('Slice 4A — applyAll() at boot pushes class/attribute defaults onto #editor', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.applyAll();
  const el = dom.window.document.getElementById('editor');
  // Class/attribute applicators have default states (spellcheck="true",
  // .rga-line-highlight-on) that match the prior surface — they push
  // at boot without drift risk.
  assert.equal(el.getAttribute('spellcheck'), 'true');
  assert.equal(el.classList.contains('rga-line-highlight-on'), true);
  // Font-family / font-size matched the existing CSS chain even with
  // the inline override in place — still pushed unconditionally.
  assert.ok(el.style.getPropertyValue('--font-editor').indexOf('Courier Prime') >= 0);
  assert.equal(el.style.getPropertyValue('--editor-font-size'), '12pt');
});

test('Slice 4A drift guard — applyAll() at boot does NOT inline --editor-line-height when there is no user override', async () => {
  const dom = bootDom();
  const S = loadAll();
  await S.Store.init();
  S.Applicators.applyAll();
  // Registry default for editor.lineHeight is '1.0'. Pushing it
  // inline at boot would override the CSS fallback (1.5) and change
  // the visible line-height without user authorization. With the
  // post-5B gate, applyAll must leave the inline value empty so the
  // existing CSS rule (line-height: var(--editor-line-height, 1.5))
  // resolves to its 1.5 fallback.
  const el = dom.window.document.getElementById('editor');
  assert.equal(el.style.getPropertyValue('--editor-line-height'), '',
    'No inline --editor-line-height may be set at boot with no override');
});

test('Slice 4A drift guard — once user sets editor.lineHeight, applyAll DOES inline it', async () => {
  const dom = bootDom({ seedPrefs: { 'editor.lineHeight': '2.0' } });
  const S = loadAll();
  await S.Store.init();
  S.Applicators.applyAll();
  assert.equal(
    dom.window.document.getElementById('editor').style.getPropertyValue('--editor-line-height'),
    '2.0');
});

// ----------------------------------------------------------------
// §6 — Persisted user-tier value rehydrates at boot
//      (the slice-required "beyond highlightCurrentLine" check)
// ----------------------------------------------------------------

test('Slice 4A — persisted editor.fontSize hydrates from prefs and applies on boot', async () => {
  const dom = bootDom({ seedPrefs: { 'editor.fontSize': 18 } });
  const S = loadAll();
  await S.Store.init();
  S.Applicators.applyAll();
  assert.equal(
    dom.window.document.getElementById('editor').style.getPropertyValue('--editor-font-size'),
    '18pt',
    'persisted user-tier value must apply on boot, not the registry default');
});
