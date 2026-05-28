// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.4 — Rga.Shell.StatusBar contribution API.
//
// Locks the new register/unregister/registered surface, the CORE-only
// segment subset (4 segments when no plugin contributes), and the
// failsafe behaviour the brief mandates: invalid input is rejected,
// duplicates are rejected, mount throws are contained, plugin unload
// works, CORE keeps rendering when ScriptSession/ScriptMetrics/Theme
// are absent.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><footer id="status-bar"></footer></body></html>',
    { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.window.Rga = {};

  // Minimal stubs — segments will subscribe to whatever exists.
  if (!opts.noStubs) {
    const viewListeners = new Set();
    global.window.Rga.TabManager = {
      activeDoc: function() { return opts.activeDoc || null; },
      _editorView: function() { return null; }
    };
    global.window.Rga.ScriptSession = {
      get: function() { return opts.session || { currentView: 'flow' }; },
      subscribe: function(fn) { viewListeners.add(fn); return function() { viewListeners.delete(fn); }; },
      _viewListeners: viewListeners
    };
    global.window.Rga.ScriptMetrics = {
      get: function() { return opts.metrics || { wordCount: null, currentBlockType: null }; }
    };
    const themeListeners = new Set();
    global.window.Rga.Theme = {
      current: opts.theme || 'dark',
      onChange: function(fn) { themeListeners.add(fn); return function() { themeListeners.delete(fn); }; },
      _themeListeners: themeListeners
    };
    global.window.Rga.SettingsTheme = { toggle: function() {} };
  }

  // Always load CORE; opt into screenplay contribution via opts.screenplay.
  const files = ['../../../renderer/js/shell/status-bar.js'];
  if (opts.screenplay) files.push('../../../renderer/js/doc-types/screenplay/status-bar.js');
  files.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const SB = global.window.Rga.Shell.StatusBar;
  SB._reset();
  if (!opts.skipInit) SB.init(document.getElementById('status-bar'));
  return { Rga: global.window.Rga, StatusBar: SB, status: document.getElementById('status-bar') };
}

// ----------------------------------------------------------------
// §1 — Public API surface
// ----------------------------------------------------------------

test('F1A.4 — Rga.Shell.StatusBar exposes the documented public API', () => {
  const { StatusBar } = boot();
  ['init', 'refresh', 'registerSegment', 'unregisterSegment', 'registered', '_reset']
    .forEach(function(fn) {
      assert.equal(typeof StatusBar[fn], 'function', fn + ' must be a function');
    });
});

// ----------------------------------------------------------------
// §2 — CORE-only mode renders exactly 4 segments
// ----------------------------------------------------------------

test('F1A.4 — CORE-only boot renders exactly 4 segments (no screenplay contribution loaded)', () => {
  const { status, StatusBar } = boot();
  const ids = Array.from(status.querySelectorAll('.rga-shell-status-segment'))
                .map(function(el) { return el.getAttribute('data-segment'); });
  assert.deepEqual(ids.sort(), ['offline', 'theme', 'viewMode', 'wordCount'].sort());
  // Registry mirrors the DOM.
  assert.deepEqual(StatusBar.registered().sort(),
    ['offline', 'theme', 'viewMode', 'wordCount'].sort());
});

test('F1A.4 — CORE LEFT/CENTER/RIGHT split is honest without screenplay', () => {
  const { status } = boot();
  const left   = Array.from(status.querySelectorAll(
    '.rga-shell-statusbar-left .rga-shell-status-segment'))
    .map(function(el) { return el.getAttribute('data-segment'); });
  const center = Array.from(status.querySelectorAll(
    '.rga-shell-statusbar-center .rga-shell-status-segment'))
    .map(function(el) { return el.getAttribute('data-segment'); });
  const right  = Array.from(status.querySelectorAll(
    '.rga-shell-statusbar-right .rga-shell-status-segment'))
    .map(function(el) { return el.getAttribute('data-segment'); });
  // CORE-only: LEFT has just offline (no scene); CENTER is empty
  // (no blockType + no page); RIGHT has wordCount/viewMode/theme
  // (no language).
  assert.deepEqual(left,   ['offline']);
  assert.deepEqual(center, []);
  assert.deepEqual(right,  ['wordCount', 'viewMode', 'theme']);
});

// ----------------------------------------------------------------
// §3 — Plugin contributions land in the right (section, order) slot
// ----------------------------------------------------------------

test('F1A.4 — with screenplay contribution, all 8 segments render in order', () => {
  const { status, StatusBar } = boot({ screenplay: true });
  const ids = Array.from(status.querySelectorAll('.rga-shell-status-segment'))
                .map(function(el) { return el.getAttribute('data-segment'); });
  assert.deepEqual(ids,
    ['offline', 'scene', 'blockType', 'page', 'wordCount', 'viewMode', 'language', 'theme']);
  assert.equal(StatusBar.registered().length, 8);
});

test('F1A.4 — registering a segment AFTER init mounts it in the right slot', () => {
  const { status, StatusBar } = boot();
  StatusBar.registerSegment({
    id: 'lateSegment',
    section: 'center',
    order: 999,
    className: 'rga-shell-status-late',
    mount: function(span) { span.textContent = 'LATE'; }
  });
  const center = Array.from(status.querySelectorAll(
    '.rga-shell-statusbar-center .rga-shell-status-segment'))
    .map(function(el) { return el.getAttribute('data-segment'); });
  assert.deepEqual(center, ['lateSegment']);
  assert.equal(status.querySelector('[data-segment="lateSegment"]').textContent, 'LATE');
});

test('F1A.4 — late-registered segment with order between existing ones inserts mid-section', () => {
  const { status, StatusBar } = boot({ screenplay: true });
  StatusBar.registerSegment({
    id: 'middleNote',
    section: 'right',
    order: 115,                      // between viewMode (110) and language (120)
    mount: function(s) { s.textContent = 'M'; }
  });
  const right = Array.from(status.querySelectorAll(
    '.rga-shell-statusbar-right .rga-shell-status-segment'))
    .map(function(el) { return el.getAttribute('data-segment'); });
  assert.deepEqual(right, ['wordCount', 'viewMode', 'middleNote', 'language', 'theme']);
});

// ----------------------------------------------------------------
// §4 — Validation + duplicate rejection
// ----------------------------------------------------------------

test('F1A.4 — registerSegment returns false for invalid controllers without throwing', () => {
  const { StatusBar } = boot();
  assert.equal(StatusBar.registerSegment(null), false);
  assert.equal(StatusBar.registerSegment(undefined), false);
  assert.equal(StatusBar.registerSegment({}), false);                              // no id
  assert.equal(StatusBar.registerSegment({ id: '' }), false);                      // empty id
  assert.equal(StatusBar.registerSegment({ id: 42 }), false);                      // non-string id
  assert.equal(StatusBar.registerSegment({ id: 'x' }), false);                     // no section
  assert.equal(StatusBar.registerSegment({ id: 'x', section: 'left' }), false);    // no mount
  assert.equal(StatusBar.registerSegment(
    { id: 'x', section: 'top', mount: function() {} }), false);                    // bad section
  assert.equal(StatusBar.registerSegment(
    { id: 'x', section: 'left', mount: 'not-fn' }), false);                        // mount not callable
  assert.equal(StatusBar.registerSegment(
    { id: 'x', section: 'left', mount: function() {}, order: 'not-number' }), false);
  // Registry untouched.
  assert.deepEqual(StatusBar.registered().sort(),
    ['offline', 'theme', 'viewMode', 'wordCount'].sort());
});

test('F1A.4 — duplicate id rejected (no second registration overrides the first)', () => {
  const { status, StatusBar } = boot();
  assert.equal(StatusBar.registerSegment({
    id: 'dup', section: 'left', order: 50, mount: function(s) { s.textContent = 'A'; }
  }), true);
  assert.equal(StatusBar.registerSegment({
    id: 'dup', section: 'left', order: 50, mount: function(s) { s.textContent = 'B'; }
  }), false);
  assert.equal(status.querySelector('[data-segment="dup"]').textContent, 'A');
});

// ----------------------------------------------------------------
// §5 — Fail-safe mount + unmount
// ----------------------------------------------------------------

test('F1A.4 — a throwing mount does not break the surrounding bar', () => {
  const originalError = console.error;
  console.error = function() {};
  try {
    const { status, StatusBar } = boot();
    const ok = StatusBar.registerSegment({
      id: 'boom',
      section: 'left',
      order: 5,
      mount: function() { throw new Error('mount-boom'); }
    });
    assert.equal(ok, true);
    // The span is still in the DOM (placeholder); the next segment in
    // the same section renders normally.
    assert.ok(status.querySelector('[data-segment="boom"]'));
    assert.ok(status.querySelector('[data-segment="offline"]'));
  } finally {
    console.error = originalError;
  }
});

test('F1A.4 — unregisterSegment removes the span and runs cleanup + unmount', () => {
  const { status, StatusBar } = boot();
  let cleanupCalls = 0;
  let unmountCalls = 0;
  StatusBar.registerSegment({
    id: 'rm',
    section: 'right',
    order: 200,
    mount: function() { return function() { cleanupCalls += 1; }; },
    unmount: function() { unmountCalls += 1; }
  });
  assert.ok(status.querySelector('[data-segment="rm"]'));
  assert.equal(StatusBar.unregisterSegment('rm'), true);
  assert.equal(status.querySelector('[data-segment="rm"]'), null);
  assert.equal(cleanupCalls, 1);
  assert.equal(unmountCalls, 1);
  assert.equal(StatusBar.registered().indexOf('rm'), -1);
});

test('F1A.4 — unregisterSegment is safe for unknown / invalid ids', () => {
  const { StatusBar } = boot();
  assert.equal(StatusBar.unregisterSegment('nope'), false);
  assert.equal(StatusBar.unregisterSegment(''), false);
  assert.equal(StatusBar.unregisterSegment(undefined), false);
  assert.equal(StatusBar.unregisterSegment(42), false);
});

test('F1A.4 — a throwing cleanup during unregister does not block removal', () => {
  const originalError = console.error;
  console.error = function() {};
  try {
    const { status, StatusBar } = boot();
    StatusBar.registerSegment({
      id: 'badCleanup',
      section: 'left',
      order: 99,
      mount: function() { return function() { throw new Error('cleanup-boom'); }; }
    });
    assert.equal(StatusBar.unregisterSegment('badCleanup'), true);
    assert.equal(status.querySelector('[data-segment="badCleanup"]'), null);
  } finally {
    console.error = originalError;
  }
});

// ----------------------------------------------------------------
// §6 — CORE keeps rendering when upstream SSOTs are absent
// ----------------------------------------------------------------

test('F1A.4 — CORE wordCount segment shows fallback when ScriptMetrics is absent', () => {
  const { status } = boot({ noStubs: true });
  // No Rga.ScriptMetrics — wordCount mount falls through to "— words".
  const wc = status.querySelector('[data-segment="wordCount"]');
  assert.equal(wc.textContent, '— words');
});

test('F1A.4 — CORE viewMode segment renders its select even when ScriptSession is absent', () => {
  const { status } = boot({ noStubs: true });
  const vm = status.querySelector('[data-segment="viewMode"]');
  assert.ok(vm);
  assert.ok(vm.querySelector('select.rga-shell-status-viewmode-select'));
});

test('F1A.4 — CORE theme segment shows the default "Dark" label when Rga.Theme is absent', () => {
  const { status } = boot({ noStubs: true });
  const t = status.querySelector('[data-segment="theme"]');
  assert.equal(t.textContent, 'Dark');
});

// ----------------------------------------------------------------
// §7 — CORE no longer reads screenplayProfile metadata directly
// ----------------------------------------------------------------

test('F1A.4 — CORE-only mode renders NO language segment (proves the screenplayProfile read moved out)', () => {
  // Behavioural drift guard for the F1A.4 brief's mandate: "Remove
  // direct CORE reads of screenplay metadata. After this slice: CORE
  // status bar should not read plugin-specific metadata directly."
  //
  // We give CORE a TabManager whose active doc carries a populated
  // screenplayProfile. Pre-F1A.4 the CORE _renderLanguage would have
  // picked it up and rendered "ku" in the language span. Post-F1A.4
  // there is no language span in CORE-only mode at all — the
  // screenplay contribution file is the only owner.
  const { status } = boot({
    activeDoc: { metadata: { screenplayProfile: { language: 'ku' } } }
  });
  assert.equal(status.querySelector('[data-segment="language"]'), null,
    'CORE alone must not render a language segment — screenplay owns it');
  // No other segment picked up the screenplayProfile read either.
  const allTexts = Array.from(status.querySelectorAll('.rga-shell-status-segment'))
                     .map(function(el) { return el.textContent; });
  assert.equal(allTexts.indexOf('ku'), -1,
    'no CORE segment displays the screenplayProfile.language value');
});

test('F1A.4 — with screenplay loaded, language segment renders the screenplayProfile value', () => {
  // Round-trip: when the screenplay contribution IS loaded, the
  // language span DOES appear and shows the metadata value. This
  // proves the read moved — it didn't disappear.
  const { status } = boot({
    screenplay: true,
    activeDoc: { metadata: { screenplayProfile: { language: 'ku' } } }
  });
  const lang = status.querySelector('[data-segment="language"]');
  assert.ok(lang, 'screenplay contribution registers the language segment');
  assert.equal(lang.textContent, 'ku');
});
