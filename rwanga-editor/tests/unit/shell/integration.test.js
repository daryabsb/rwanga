// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 1 — Rga.Shell.init integration tests (plan §3.6, §8.2, §10).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot(opts) {
  opts = opts || {};
  const html = opts.html != null ? opts.html :
    '<!DOCTYPE html><html><body>' +
    '<header id="rga-shell-titlebar"><div id="rga-shell-titlebar-title">Rwanga</div></header>' +
    '<nav id="activity-bar"></nav>' +
    '<aside id="sidebar"><div id="rga-shell-sidebar-host"></div></aside>' +
    '<div id="editor"></div>' +
    '<footer id="status-bar"></footer>' +
    '</body></html>';
  const dom = new JSDOM(html, { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.window.Rga = {};

  // Stub engine + view-manager surface ScriptSession needs.
  global.window.Rga.TabManager = { activeDoc: function() { return null; }, _editorView: function() { return null; } };
  global.window.Rga.ViewManager = { current: function() { return 'flow'; }, onChange: function() { return function() {}; } };
  global.window.Rga.Nav = { getIndex: function() { return { scenes: [], pages: [] }; }, getPageMap: function() { return []; }, findScene: function() { return null; } };

  ['../../../renderer/js/shell/layout.js',
   '../../../renderer/js/shell/sidebar.js',
   '../../../renderer/js/shell/activity-rail.js',
   '../../../renderer/js/shell/script-session.js',
   '../../../renderer/js/shell/status-bar.js',
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
  if (Rga.Shell.StatusBar && Rga.Shell.StatusBar._reset) Rga.Shell.StatusBar._reset();
  Rga.Shell._reset();
  // Re-run panel registrations (IIFE ran once at require-time; _reset drops them).
  ['scene-navigator', 'script-workspace', 'outline', 'characters', 'search', 'revisions', 'settings'].forEach(function(file) {
    delete require.cache[require.resolve('../../../renderer/js/shell/panels/' + file + '.js')];
    require('../../../renderer/js/shell/panels/' + file + '.js');
  });
  return { Rga, dom: dom };
}

test('Rga.Shell.init returns true when all required containers are present', () => {
  const { Rga } = boot();
  assert.equal(Rga.Shell.init(), true);
});

test('Rga.Shell.init returns false when #activity-bar is missing', () => {
  const { Rga } = boot({
    html: '<!DOCTYPE html><html><body><aside id="rga-shell-sidebar-host"></aside></body></html>'
  });
  assert.equal(Rga.Shell.init(), false);
});

test('Rga.Shell.init returns false when #rga-shell-sidebar-host is missing', () => {
  const { Rga } = boot({
    html: '<!DOCTYPE html><html><body><nav id="activity-bar"></nav></body></html>'
  });
  assert.equal(Rga.Shell.init(), false);
});

test('after init, all 7 rail buttons are present in Activity Rail Doctrine order (Top: SceneNav, ScriptWorkspace, Outline, Search · Middle: Characters, Revisions · Bottom: Settings)', () => {
  const { Rga } = boot();
  Rga.Shell.init();
  const ids = Array.from(document.querySelectorAll('#activity-bar .rga-shell-rail-item'))
                   .map(function(b) { return b.getAttribute('data-panel-id'); });
  // Order is now doctrine-prescribed, not registration-order — see
  // docs/rwanga-activity-rail-doctrine.md §Rule 3.
  assert.deepEqual(ids, [
    'sceneNavigator', 'scriptWorkspace', 'outline', 'search',
    'characters', 'revisions',
    'settings'
  ]);
});

test('after init, the Scene Navigator is the active panel and sidebar.visible is true', () => {
  const { Rga } = boot();
  Rga.Shell.init();
  assert.equal(Rga.Shell.Sidebar.current(), 'sceneNavigator');
  assert.equal(Rga.Shell.Layout.get().sidebar.visible, true);
  assert.equal(Rga.Shell.Layout.get().sidebar.activePanel, 'sceneNavigator');
});

test('after init, the sidebar host has the Scene Navigator mounted', () => {
  const { Rga } = boot();
  Rga.Shell.init();
  const host = document.getElementById('rga-shell-sidebar-host');
  assert.ok(host.querySelector('.rga-shell-scene-navigator'),
            'Scene Navigator rendered into sidebar host');
});

test('clicking the Outline rail button activates the Outline panel (real in Slice 2)', () => {
  const { Rga } = boot();
  Rga.Shell.init();
  const btn = document.querySelector('#activity-bar .rga-shell-rail-item[data-panel-id="outline"]');
  assert.ok(btn);
  btn.click();
  assert.equal(Rga.Shell.Sidebar.current(), 'outline');
  const host = document.getElementById('rga-shell-sidebar-host');
  // Slice 2: real Outline panel renders a .rga-shell-outline wrapper with 4 sections.
  assert.ok(host.querySelector('.rga-shell-outline'));
  assert.equal(host.querySelectorAll('.rga-shell-outline-section').length, 4);
});

test('clicking the active rail button toggles the sidebar off', () => {
  const { Rga } = boot();
  Rga.Shell.init();
  const btn = document.querySelector('#activity-bar .rga-shell-rail-item[data-panel-id="sceneNavigator"]');
  btn.click();  // toggle off
  assert.equal(Rga.Shell.Sidebar.current(), null);
  assert.equal(Rga.Shell.Layout.get().sidebar.visible, false);
});

test('Rga.Shell.init is idempotent — second call is a no-op', () => {
  const { Rga } = boot();
  Rga.Shell.init();
  const railHTMLBefore = document.getElementById('activity-bar').innerHTML;
  Rga.Shell.init();
  const railHTMLAfter = document.getElementById('activity-bar').innerHTML;
  assert.equal(railHTMLBefore, railHTMLAfter, 'second init does not re-render');
});

test('ScriptSession is initialized before the default panel mounts (panel sees a populated snapshot)', () => {
  const { Rga } = boot();
  // Pre-init: snapshot empty.
  assert.equal(Rga.ScriptSession.get().activeScript, null);
  // Stub the active doc so init's first recompute picks it up.
  Rga.TabManager.activeDoc = function() { return { docId: 'd', displayName: 'X.rga', dirty: false }; };
  Rga.Shell.init();
  // After init: ScriptSession populated, panel mounted.
  assert.equal(Rga.ScriptSession.get().activeScript.displayName, 'X.rga');
  assert.equal(Rga.Shell.Sidebar.current(), 'sceneNavigator');
});

// ----------------------------------------------------------------
// Slice 2 — final integration sweep
// ----------------------------------------------------------------

test('Slice 2: after init the legacy #sidebar-header / #status-words selectors return null (entries #1 + #3 resolved)', () => {
  const { Rga } = boot();
  Rga.Shell.init();
  assert.equal(document.getElementById('sidebar-header'), null);
  assert.equal(document.getElementById('sidebar-header-text'), null);
  assert.equal(document.getElementById('status-words'), null);
  assert.equal(document.getElementById('status-pages'), null);
  assert.equal(document.getElementById('status-scene'), null);
  assert.equal(document.getElementById('status-block-type'), null);
});

test('Slice 2: status bar mounts into #status-bar (no #rga-shell-statusbar indirection)', () => {
  const { Rga } = boot({
    html: '<!DOCTYPE html><html><body>' +
          '<header id="rga-shell-titlebar"><div id="rga-shell-titlebar-title">Rwanga</div></header>' +
          '<nav id="activity-bar"></nav>' +
          '<aside id="sidebar"><div id="rga-shell-sidebar-host"></div></aside>' +
          '<div id="editor"></div>' +
          '<footer id="status-bar"></footer>' +
          '</body></html>'
  });
  Rga.Shell.init();
  const statusBar = document.getElementById('status-bar');
  assert.ok(statusBar.classList.contains('rga-shell-statusbar'), 'StatusBar attached class to #status-bar');
  // Studio Shell Recovery §F: 7 preserved segments + 1 new theme
  // instrument (reads existing Rga.Theme SSOT). See
  // tests/unit/shell/studio-shell-F-status-bar.test.js for the
  // grouping invariants.
  assert.equal(statusBar.querySelectorAll('.rga-shell-status-segment').length, 8);
});

test('Slice 7 §A: ScriptSession snapshot has NO analytics fields (moved to Rga.ScriptMetrics)', () => {
  const { Rga } = boot();
  Rga.Shell.init();
  const snap = Rga.ScriptSession.get();
  // Slice 7 §A moved wordCount + currentBlockType out of ScriptSession's
  // snapshot. They now live on Rga.ScriptMetrics. The ScriptSession
  // snapshot is locked to its 7 writer-context fields per
  // Rga.SessionBoundary.
  assert.equal('wordCount'        in snap, false, 'wordCount must not appear on ScriptSession');
  assert.equal('currentBlockType' in snap, false, 'currentBlockType must not appear on ScriptSession');
});

test('Slice 2: Outline panel click routes through Scene Navigator (cross-panel integration)', () => {
  const { Rga } = boot();
  Rga.Shell.init();
  // Activate Outline panel via its rail button.
  const outlineBtn = document.querySelector('#activity-bar [data-panel-id="outline"]');
  outlineBtn.click();
  assert.equal(Rga.Shell.Sidebar.current(), 'outline');
  // Outline + ScriptSession have a contract via SceneNavigator's API surface.
  // We can't fully simulate a click without engine state, but we can verify
  // the API exists for outline.js to call.
  assert.equal(typeof Rga.Shell.SceneNavigator.scrollToScene, 'function');
  assert.equal(typeof Rga.Shell.SceneNavigator.focusRow, 'function');
});

test('Slice 2: Script Workspace renders empty state when no active script (real panel, not placeholder)', async () => {
  const { Rga } = boot();
  Rga.Shell.init();
  const wsBtn = document.querySelector('#activity-bar [data-panel-id="scriptWorkspace"]');
  wsBtn.click();
  // Allow microtask flush for async render.
  await new Promise(function(r) { setTimeout(r, 0); });
  const host = document.getElementById('rga-shell-sidebar-host');
  // Real Script Workspace renders a .rga-shell-workspace wrapper (no longer a placeholder).
  assert.ok(host.querySelector('.rga-shell-workspace'), 'Workspace wrapper rendered');
  assert.equal(host.querySelectorAll('.rga-shell-panel-placeholder').length, 0, 'placeholder gone');
});
