// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 1 — keyboard shortcuts tests (plan §6.3, §11.4) +
// the critical Tab-not-swallowed regression guard.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
    '<nav id="activity-bar"></nav>' +
    '<aside id="sidebar"><div id="rga-shell-sidebar-host"></div></aside>' +
    '<div id="editor"></div>' +
    '</body></html>',
    { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.KeyboardEvent = dom.window.KeyboardEvent;
  global.window.Rga = {};
  global.window.Rga.TabManager = { activeDoc: function() { return null; }, _editorView: function() { return null; } };
  global.window.Rga.ViewManager = { current: function() { return 'flow'; }, onChange: function() { return function() {}; } };
  global.window.Rga.Nav = { getIndex: function() { return { scenes: [], pages: [] }; }, getPageMap: function() { return []; }, findScene: function() { return null; } };

  ['../../../renderer/js/shell/layout.js',
   '../../../renderer/js/shell/sidebar.js',
   // Slice 2: KeyboardRegistry is the SSOT every shell shortcut
   // registers against. Must load before shell/index.js so the
   // registrations land.
   '../../../renderer/js/shell/keyboard-registry.js',
   '../../../renderer/js/shell/activity-rail.js',
   '../../../renderer/js/shell/script-session.js',
   '../../../renderer/js/shell/panels/scene-navigator.js',
   '../../../renderer/js/shell/panels/script-workspace.js',
   '../../../renderer/js/shell/panels/outline.js',
   '../../../renderer/js/shell/panels/characters.js',
   '../../../renderer/js/shell/panels/search.js',
   '../../../renderer/js/shell/panels/revisions.js',
   '../../../renderer/js/shell/panels/settings.js',
   '../../../renderer/js/shell/index.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  Rga.Shell.ActivityRail._reset();
  Rga.ScriptSession._reset();
  Rga.Shell.SceneNavigator._reset();
  Rga.KeyboardRegistry._reset();
  Rga.Shell._reset();
  ['scene-navigator', 'script-workspace', 'outline', 'characters', 'search', 'revisions', 'settings'].forEach(function(file) {
    delete require.cache[require.resolve('../../../renderer/js/shell/panels/' + file + '.js')];
    require('../../../renderer/js/shell/panels/' + file + '.js');
  });
  Rga.KeyboardRegistry.init();
  Rga.Shell.init();
  return { Rga };
}

function fireKey(opts) {
  const e = new KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, opts));
  document.dispatchEvent(e);
  return e;
}

test('Cmd-Shift-O activates the Outline panel', () => {
  const { Rga } = boot();
  assert.equal(Rga.Shell.Sidebar.current(), 'sceneNavigator');
  fireKey({ key: 'o', metaKey: true, shiftKey: true });
  assert.equal(Rga.Shell.Sidebar.current(), 'outline');
});

test('Cmd-Shift-C activates the Characters panel', () => {
  const { Rga } = boot();
  fireKey({ key: 'c', metaKey: true, shiftKey: true });
  assert.equal(Rga.Shell.Sidebar.current(), 'characters');
});

test('Cmd-Shift-S toggles the Scene Navigator off when it is currently active', () => {
  const { Rga } = boot();
  assert.equal(Rga.Shell.Sidebar.current(), 'sceneNavigator');
  fireKey({ key: 's', metaKey: true, shiftKey: true });
  assert.equal(Rga.Shell.Sidebar.current(), null);
  assert.equal(Rga.Shell.Layout.get().sidebar.visible, false);
});

test('Cmd-Shift-S re-activates the Scene Navigator when it was toggled off', () => {
  const { Rga } = boot();
  fireKey({ key: 's', metaKey: true, shiftKey: true });  // toggle off
  fireKey({ key: 's', metaKey: true, shiftKey: true });  // toggle on
  assert.equal(Rga.Shell.Sidebar.current(), 'sceneNavigator');
  assert.equal(Rga.Shell.Layout.get().sidebar.visible, true);
});

test('Cmd-B toggles sidebar visibility without changing the active panel', () => {
  const { Rga } = boot();
  assert.equal(Rga.Shell.Layout.get().sidebar.visible, true);
  fireKey({ key: 'b', metaKey: true });
  assert.equal(Rga.Shell.Layout.get().sidebar.visible, false);
  // Active panel unchanged.
  assert.equal(Rga.Shell.Sidebar.current(), 'sceneNavigator');
});

test('Cmd-, activates the Settings panel', () => {
  const { Rga } = boot();
  fireKey({ key: ',', metaKey: true });
  assert.equal(Rga.Shell.Sidebar.current(), 'settings');
});

test('REGRESSION GUARD: bare Tab is NOT consumed by the shell keyboard handler', () => {
  boot();
  // Fire Tab with no modifiers.
  const e = fireKey({ key: 'Tab' });
  // If the shell consumed it, preventDefault / stopPropagation would have run.
  // assertion: the event was NOT prevented by the shell.
  assert.equal(e.defaultPrevented, false, 'shell must NOT preventDefault on bare Tab');
});

test('REGRESSION GUARD: bare Enter is NOT consumed by the shell keyboard handler', () => {
  boot();
  const e = fireKey({ key: 'Enter' });
  assert.equal(e.defaultPrevented, false);
});

test('REGRESSION GUARD: Mod-Enter is NOT consumed (engine owns spawnNextScene)', () => {
  boot();
  const e = fireKey({ key: 'Enter', metaKey: true });
  assert.equal(e.defaultPrevented, false);
});

test('REGRESSION GUARD: bare Backspace is NOT consumed by the shell', () => {
  boot();
  const e = fireKey({ key: 'Backspace' });
  assert.equal(e.defaultPrevented, false);
});
