// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Studio Shell Recovery — Workstream F (Status Bar) guards.
//
// Locks the three-section grouping (left / center / right), the
// theme-instrument behaviour (reads existing Rga.Theme SSOT, toggles
// via Rga.Theme.toggle, no new button strip), and the negative
// invariants from the mission brief (no new validation source, no
// new sync source, preserved information).
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

  // Stubs — every SSOT the status bar reads must exist before the
  // module loads (Slice-2 contract).
  const stub = {
    activeDoc: opts.activeDoc || null,
    viewMode: opts.viewMode || 'flow',
    viewListeners: new Set(),
    index: opts.index || { scenes: [], pages: [] },
    pageMap: opts.pageMap || [],
    outline: opts.outline || null,
    themeToggleCount: 0
  };
  global.window.Rga.TabManager = {
    activeDoc: function() { return stub.activeDoc; },
    _editorView: function() { return null; }
  };
  global.window.Rga.ViewManager = {
    current: function() { return stub.viewMode; },
    onChange: function(fn) { stub.viewListeners.add(fn); return function() { stub.viewListeners.delete(fn); }; },
    activate: function(id) { stub.viewMode = id; stub.viewListeners.forEach(function(fn) { fn(); }); }
  };
  global.window.Rga.ViewMode = {
    set: function(mode) {
      stub.viewMode = mode;
      stub.viewListeners.forEach(function(fn) { fn(); });
    },
    get: function() { return stub.viewMode; }
  };
  global.window.Rga.Nav = {
    getIndex: function() { return stub.index; },
    getPageMap: function() { return stub.pageMap; },
    getOutline: function() { return stub.outline || { statistics: { words: 0, sceneCount: 0, pages: 0 } }; }
  };
  // Theme stub — mirrors Rga.Theme (the rendered theme owner).
  const themeListeners = new Set();
  global.window.Rga.Theme = {
    current: opts.theme || 'dark',
    toggle: function() {
      stub.themeToggleCount += 1;
      this.current = this.current === 'dark' ? 'light' : 'dark';
      themeListeners.forEach(function(fn) { try { fn(); } catch (_) {} });
    },
    onChange: function(fn) {
      themeListeners.add(fn);
      return function() { themeListeners.delete(fn); };
    }
  };
  // SettingsTheme stub (H2B): the constitutional helper that all
  // production theme-toggle callers route through.
  stub.settingsThemeToggleCount = 0;
  global.window.Rga.SettingsTheme = {
    toggle: function() {
      stub.settingsThemeToggleCount += 1;
      // Mimic the real helper's effect via the Theme stub so the
      // status-bar segment subscriber updates.
      global.window.Rga.Theme.toggle();
    }
  };

  ['../../../renderer/js/shell/layout.js',
   '../../../renderer/js/shell/sidebar.js',
   '../../../renderer/js/shell/script-session.js',
   '../../../renderer/js/shell/script-metrics.js',
   '../../../renderer/js/shell/status-bar.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  Rga.ScriptSession._reset();
  Rga.Shell.StatusBar._reset();
  Rga.ScriptSession.init();
  Rga.Shell.StatusBar.init(document.getElementById('status-bar'));
  return { Rga, stub, status: document.getElementById('status-bar') };
}

// ----------------------------------------------------------------
// §F.1 — Three-section layout
// ----------------------------------------------------------------

test('§F: status bar has exactly three sections (left, center, right)', () => {
  const { status } = boot();
  assert.ok(status.querySelector('.rga-shell-statusbar-left'),
    'left section wrapper must exist');
  assert.ok(status.querySelector('.rga-shell-statusbar-center'),
    'center section wrapper must exist');
  assert.ok(status.querySelector('.rga-shell-statusbar-right'),
    'right section wrapper must exist');
  // No fourth section.
  const sections = status.querySelectorAll('.rga-shell-statusbar-section');
  assert.equal(sections.length, 3,
    'exactly three sections — no fourth (the brief says group only, do not introduce new groups)');
});

test('§F: every segment lives inside one of the three sections (no orphan segments)', () => {
  const { status } = boot();
  const segments = status.querySelectorAll('.rga-shell-status-segment');
  segments.forEach(function(seg) {
    const inLeft   = !!seg.closest('.rga-shell-statusbar-left');
    const inCenter = !!seg.closest('.rga-shell-statusbar-center');
    const inRight  = !!seg.closest('.rga-shell-statusbar-right');
    assert.equal(Number(inLeft) + Number(inCenter) + Number(inRight), 1,
      'segment [' + seg.getAttribute('data-segment') + '] must live in exactly one section');
  });
});

// ----------------------------------------------------------------
// §F.2 — Per-section content (preserves all existing information)
// ----------------------------------------------------------------

test('§F: LEFT section contains exactly sync/local state (offline) + scene position (scene)', () => {
  const { status } = boot();
  const ids = Array.from(status.querySelectorAll('.rga-shell-statusbar-left .rga-shell-status-segment'))
                   .map(function(el) { return el.getAttribute('data-segment'); });
  assert.deepEqual(ids, ['offline', 'scene']);
});

test('§F: CENTER section contains exactly current context (blockType) + page position (page)', () => {
  const { status } = boot();
  const ids = Array.from(status.querySelectorAll('.rga-shell-statusbar-center .rga-shell-status-segment'))
                   .map(function(el) { return el.getAttribute('data-segment'); });
  assert.deepEqual(ids, ['blockType', 'page']);
});

test('§F: RIGHT section contains exactly words + view mode + language + theme', () => {
  const { status } = boot();
  const ids = Array.from(status.querySelectorAll('.rga-shell-statusbar-right .rga-shell-status-segment'))
                   .map(function(el) { return el.getAttribute('data-segment'); });
  assert.deepEqual(ids, ['wordCount', 'viewMode', 'language', 'theme']);
});

test('§F: total segment count is 8 (preserved 7 + 1 new theme instrument reading existing SSOT)', () => {
  const { status } = boot();
  const segments = status.querySelectorAll('.rga-shell-status-segment');
  assert.equal(segments.length, 8);
  // The 7 preserved segments are all present.
  ['scene', 'page', 'blockType', 'wordCount', 'viewMode', 'language', 'offline'].forEach(function(id) {
    assert.ok(status.querySelector('[data-segment="' + id + '"]'),
      'preserved segment [' + id + '] must still exist');
  });
});

// ----------------------------------------------------------------
// §F.3 — Theme instrument
// ----------------------------------------------------------------

test('§F: theme instrument reads Rga.Theme.current and displays "Dark" / "Light" as text', () => {
  const { status } = boot({ theme: 'light' });
  assert.equal(status.querySelector('[data-segment="theme"]').textContent, 'Light');
});

test('§F: theme instrument re-renders when Rga.Theme changes (subscribes to onChange)', () => {
  const { Rga, status } = boot({ theme: 'dark' });
  assert.equal(status.querySelector('[data-segment="theme"]').textContent, 'Dark');
  Rga.Theme.toggle();
  assert.equal(status.querySelector('[data-segment="theme"]').textContent, 'Light');
});

test('§F: clicking the theme instrument routes through Rga.SettingsTheme.toggle (Settings is the SSOT — H2B constitution)', () => {
  const { status, stub } = boot();
  assert.equal(stub.settingsThemeToggleCount, 0);
  status.querySelector('[data-segment="theme"]').click();
  assert.equal(stub.settingsThemeToggleCount, 1,
    'click must invoke the constitutional helper, not Rga.Theme directly');
});

test('§F: theme instrument is a text segment, NOT a styled button (brief: no button strip)', () => {
  const { status } = boot();
  const themeSeg = status.querySelector('[data-segment="theme"]');
  // The instrument is a <span> (same tag as every other segment), not a <button>.
  assert.equal(themeSeg.tagName, 'SPAN',
    'theme instrument must be a <span> like every other segment, not a <button>');
  // It has the role + aria-label for a11y but visually remains a text segment.
  assert.equal(themeSeg.getAttribute('role'), 'button');
  assert.equal(themeSeg.getAttribute('aria-label'), 'Toggle theme');
});

// ----------------------------------------------------------------
// §F.4 — Negative invariants from the mission brief
// ----------------------------------------------------------------

test('§F: no "issues" segment introduced (brief: do not invent issues yet)', () => {
  const { status } = boot();
  assert.equal(status.querySelector('[data-segment="issues"]'), null,
    'no [data-segment="issues"] — the brief explicitly forbids inventing a new validation source');
});

test('§F: no new sync source — offline segment is the only sync surface, unchanged', () => {
  const { status } = boot();
  const offline = status.querySelector('[data-segment="offline"]');
  assert.equal(offline.textContent, 'Local',
    'offline segment text is unchanged ("Local") — no new sync derivation');
  // No second sync-like segment.
  const syncCandidates = status.querySelectorAll('[data-segment="sync"]');
  assert.equal(syncCandidates.length, 0);
});

test('§F: no buttons in any section — every segment is a <span> instrument (preserves "instruments not buttons" rule)', () => {
  const { status } = boot();
  const buttons = status.querySelectorAll('.rga-shell-status-segment button');
  // The viewMode segment legitimately contains a <select> (Bundle 1 §A);
  // a <select> is not a <button>. Allow that but forbid any <button>.
  assert.equal(buttons.length, 0,
    'no <button> elements inside any status-bar segment (brief: do not turn status bar into a button strip)');
});
