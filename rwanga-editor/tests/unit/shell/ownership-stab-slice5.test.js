// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Runtime Ownership Stabilization Slice 5 — regression tests.
// Covers §A (StatusBar / ScriptMetrics) and §B (Sidebar activePanel).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function freshJSDOM(html) {
  const dom = new JSDOM(html || '<!DOCTYPE html><html><body></body></html>',
                        { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  global.window.Rga = {};
  global.Rga = global.window.Rga;
  global.window.Rga.$  = function(sel, root) { return (root || document).querySelector(sel); };
  global.window.Rga.$$ = function(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  return dom;
}

function reloadModules(paths) {
  paths.forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
}

// ================================================================
// §A — StatusBar / ScriptMetrics
// ================================================================

test('§A: Rga.ScriptMetrics exists with the documented public API', () => {
  freshJSDOM();
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/sidebar.js',
    '../../../renderer/js/shell/script-session.js',
    '../../../renderer/js/shell/script-metrics.js'
  ]);
  const Rga = global.window.Rga;
  assert.ok(Rga.ScriptMetrics, 'Rga.ScriptMetrics must exist (top-level alias)');
  assert.ok(Rga.Shell.ScriptMetrics, 'Rga.Shell.ScriptMetrics must exist (namespaced)');
  assert.equal(Rga.ScriptMetrics, Rga.Shell.ScriptMetrics);
  assert.equal(typeof Rga.ScriptMetrics.get, 'function');
  assert.equal(typeof Rga.ScriptMetrics.subscribe, 'function');
});

test('§A: ScriptMetrics.get() snapshot has the documented shape (live + reserved fields)', () => {
  freshJSDOM();
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/sidebar.js',
    '../../../renderer/js/shell/script-session.js',
    '../../../renderer/js/shell/script-metrics.js'
  ]);
  const Rga = global.window.Rga;
  const snap = Rga.ScriptMetrics.get();
  // Live fields (delegated to ScriptSession; null until an active
  // view exists). Reserved fields default to null forever until a
  // future slice derives them.
  ['wordCount', 'currentBlockType',
   'dialogueWords', 'actionWords', 'sceneCount', 'estimatedRuntime'].forEach(function(f) {
    assert.ok(f in snap, 'ScriptMetrics snapshot must include "' + f + '"');
    assert.equal(snap[f], null, '"' + f + '" defaults to null on first read');
  });
});

test('§A: ScriptMetrics.subscribe fires ONLY when an analytics field changes', () => {
  freshJSDOM();
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/sidebar.js',
    '../../../renderer/js/shell/script-session.js',
    '../../../renderer/js/shell/script-metrics.js'
  ]);
  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  Rga.ScriptSession._reset();
  // Stub ScriptSession's upstream so we can synthesise snapshots
  // without a real editor view.
  Rga.TabManager  = { activeDoc: function() { return null; }, _editorView: function() { return null; } };
  Rga.ViewManager = { current: function() { return 'flow'; }, onChange: function() { return function() {}; } };
  Rga.Nav = {
    getIndex: function() { return { scenes: [], pages: [] }; },
    getPageMap: function() { return []; },
    findScene: function() { return null; },
    getOutline: function() { return { statistics: { words: 0 } }; }
  };
  Rga.ScriptSession.init();

  const events = [];
  Rga.ScriptMetrics.subscribe(function(next, prev) { events.push({ next: next, prev: prev }); });

  // Force a ScriptSession recompute when nothing analytics-relevant
  // changed (no view): should NOT fire ScriptMetrics subscribers.
  Rga.ScriptSession._recompute();
  assert.equal(events.length, 0,
    'analytics did not change → ScriptMetrics subscriber must NOT fire');
});

test('§A: StatusBar reads wordCount + currentBlockType via ScriptMetrics (not ScriptSession)', () => {
  // Source audit — narrow read-the-file check. F1A.4 split the
  // status-bar into a contribution API: wordCount stays a CORE
  // segment (shell/status-bar.js:95-103 reads
  // window.Rga.ScriptMetrics.get()); the blockType segment moved to
  // the screenplay plugin (doc-types/screenplay/status-bar.js:82-87,
  // also reading ScriptMetrics). The boundary being asserted —
  // analytics come from ScriptMetrics, never ScriptSession — is
  // unchanged, just enforced at both owners.
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../../renderer/js/shell/status-bar.js'), 'utf8');
  // wordCount — window.Rga.ScriptMetrics guard+read, status-bar.js:96-98.
  assert.ok(/window\.Rga\.ScriptMetrics\s*&&\s*typeof\s+window\.Rga\.ScriptMetrics\.get\s*===\s*['"]function['"]/.test(src),
    'status-bar.js must consult window.Rga.ScriptMetrics for wordCount');
  // _renderWordCount derives the value from the ScriptMetrics snapshot
  // ONLY — ScriptSession may appear solely as the subscribe trigger
  // (documented at status-bar.js:83-90), never as the value source.
  const wcBody = src.match(/function _renderWordCount\(spanEl\) \{[\s\S]*?\n  \}/);
  assert.ok(wcBody, '_renderWordCount must exist in shell/status-bar.js');
  assert.ok(/ScriptMetrics\.get/.test(wcBody[0]),
    '_renderWordCount must read the ScriptMetrics snapshot');
  assert.equal(/ScriptSession/.test(wcBody[0]), false,
    '_renderWordCount must NOT read ScriptSession (analytics stay on ScriptMetrics)');
  // blockType — moved to the screenplay plugin per F1A.4
  // (doc-types/screenplay/status-bar.js:82-87).
  const pluginSrc = fs.readFileSync(
    path.resolve(__dirname, '../../../renderer/js/doc-types/screenplay/status-bar.js'), 'utf8');
  const btBody = pluginSrc.match(/function _renderBlockType\(spanEl\) \{[\s\S]*?\n  \}/);
  assert.ok(btBody, '_renderBlockType must exist in doc-types/screenplay/status-bar.js');
  assert.ok(/ScriptMetrics/.test(btBody[0]) && /currentBlockType/.test(btBody[0]),
    '_renderBlockType must read currentBlockType from the ScriptMetrics snapshot, not ScriptSession');
  assert.equal(/ScriptSession/.test(btBody[0]), false,
    '_renderBlockType must NOT read ScriptSession (analytics stay on ScriptMetrics)');
});

// ================================================================
// §B — Sidebar activePanel persistence round-trip
// ================================================================

const SIDEBAR_HTML =
  '<!DOCTYPE html><html><body>' +
  '<nav id="activity-bar"></nav>' +
  '<aside id="sidebar"><div id="rga-shell-sidebar-host"></div></aside>' +
  '<div id="editor"></div>' +
  '</body></html>';

function bootShellWithThreePanels() {
  freshJSDOM(SIDEBAR_HTML);
  global.window.Rga.TabManager  = { activeDoc: function() { return null; }, _editorView: function() { return null; } };
  global.window.Rga.ViewManager = { current: function() { return 'flow'; }, onChange: function() { return function() {}; } };
  global.window.Rga.Nav = { getIndex: function() { return { scenes: [], pages: [] }; },
                            getPageMap: function() { return []; },
                            findScene: function() { return null; } };

  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/workspace-state.js',
    '../../../renderer/js/shell/sidebar.js',
    '../../../renderer/js/shell/keyboard-registry.js',
    '../../../renderer/js/shell/activity-rail.js',
    '../../../renderer/js/shell/script-session.js',
    '../../../renderer/js/shell/script-metrics.js',
    '../../../renderer/js/shell/panels/scene-navigator.js',
    '../../../renderer/js/shell/panels/script-workspace.js',
    '../../../renderer/js/shell/panels/outline.js',
    '../../../renderer/js/shell/panels/characters.js',
    '../../../renderer/js/shell/panels/search.js',
    '../../../renderer/js/shell/panels/revisions.js',
    '../../../renderer/js/shell/panels/settings.js',
    '../../../renderer/js/shell/index.js'
  ]);
  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  Rga.Shell.ActivityRail._reset();
  Rga.ScriptSession._reset();
  Rga.KeyboardRegistry._reset();
  Rga.WorkspaceState._reset();
  Rga.Shell.SceneNavigator._reset();
  Rga.Shell._reset();
  // Re-register panels after _reset wipes the registry.
  ['scene-navigator', 'script-workspace', 'outline', 'characters', 'search', 'revisions', 'settings']
    .forEach(function(p) {
      delete require.cache[require.resolve('../../../renderer/js/shell/panels/' + p + '.js')];
      require('../../../renderer/js/shell/panels/' + p + '.js');
    });
  Rga.KeyboardRegistry.init();
  Rga.WorkspaceState.init();
  Rga.Shell.init();
  return Rga;
}

test('§B: Sidebar.activate updates Layout.sidebar.activePanel (Slice 5 §B sync invariant)', () => {
  const Rga = bootShellWithThreePanels();
  // Boot default: sceneNavigator.
  assert.equal(Rga.Shell.Sidebar.current(), 'sceneNavigator');
  assert.equal(Rga.Shell.Layout.get().sidebar.activePanel, 'sceneNavigator',
    'Layout mirror matches Sidebar.current() after boot');

  // User clicks a different panel.
  Rga.Shell.Sidebar.activate('outline');
  assert.equal(Rga.Shell.Sidebar.current(), 'outline');
  assert.equal(Rga.Shell.Layout.get().sidebar.activePanel, 'outline',
    'Sidebar.activate must update Layout.sidebar.activePanel — pre-Slice-5 this DIDN\'T happen');
});

test('§B: active panel restored across reload (two-session simulation)', () => {
  // Session 1 — boot, switch to outline, capture localStorage.
  let Rga = bootShellWithThreePanels();
  Rga.Shell.Sidebar.activate('outline');
  const persistedRaw = localStorage.getItem('rga-workspace-layout');
  assert.ok(persistedRaw, 'workspace blob written');
  const parsed = JSON.parse(persistedRaw);
  assert.equal(parsed.sidebar.activePanel, 'outline',
    'Layout.sidebar.activePanel was persisted by WorkspaceState');

  // Session 2 — fresh DOM, fresh modules, seeded localStorage.
  // freshJSDOM creates a new localStorage; pre-seed before Shell.init.
  const Rga2 = (function() {
    freshJSDOM(SIDEBAR_HTML);
    localStorage.setItem('rga-workspace-layout', persistedRaw);
    return bootShellWithThreePanels();
  })();
  // Wait — bootShellWithThreePanels calls freshJSDOM again, wiping
  // the localStorage we just set. We need to set it AFTER freshJSDOM
  // but BEFORE WorkspaceState.init.

  // Manual two-session sequence so we can seed localStorage at the
  // right moment.
  freshJSDOM(SIDEBAR_HTML);
  localStorage.setItem('rga-workspace-layout', persistedRaw);
  global.window.Rga.TabManager  = { activeDoc: function() { return null; }, _editorView: function() { return null; } };
  global.window.Rga.ViewManager = { current: function() { return 'flow'; }, onChange: function() { return function() {}; } };
  global.window.Rga.Nav = { getIndex: function() { return { scenes: [], pages: [] }; },
                            getPageMap: function() { return []; },
                            findScene: function() { return null; } };
  reloadModules([
    '../../../renderer/js/shell/layout.js',
    '../../../renderer/js/shell/workspace-state.js',
    '../../../renderer/js/shell/sidebar.js',
    '../../../renderer/js/shell/keyboard-registry.js',
    '../../../renderer/js/shell/activity-rail.js',
    '../../../renderer/js/shell/script-session.js',
    '../../../renderer/js/shell/script-metrics.js',
    '../../../renderer/js/shell/panels/scene-navigator.js',
    '../../../renderer/js/shell/panels/script-workspace.js',
    '../../../renderer/js/shell/panels/outline.js',
    '../../../renderer/js/shell/panels/characters.js',
    '../../../renderer/js/shell/panels/search.js',
    '../../../renderer/js/shell/panels/revisions.js',
    '../../../renderer/js/shell/panels/settings.js',
    '../../../renderer/js/shell/index.js'
  ]);
  const Rga3 = global.window.Rga;
  Rga3.Shell.Layout._reset();
  Rga3.Shell.Sidebar._reset();
  Rga3.Shell.ActivityRail._reset();
  Rga3.ScriptSession._reset();
  Rga3.KeyboardRegistry._reset();
  Rga3.WorkspaceState._reset();
  Rga3.Shell.SceneNavigator._reset();
  Rga3.Shell._reset();
  ['scene-navigator', 'script-workspace', 'outline', 'characters', 'search', 'revisions', 'settings']
    .forEach(function(p) {
      delete require.cache[require.resolve('../../../renderer/js/shell/panels/' + p + '.js')];
      require('../../../renderer/js/shell/panels/' + p + '.js');
    });
  Rga3.KeyboardRegistry.init();
  Rga3.WorkspaceState.init();
  Rga3.Shell.init();

  assert.equal(Rga3.Shell.Sidebar.current(), 'outline',
    'session 2 must boot with the persisted active panel (outline), not the default (sceneNavigator)');
  assert.equal(Rga3.Shell.Layout.get().sidebar.activePanel, 'outline',
    'Layout mirror matches restored value');
});

test('§B: deactivate does NOT clear Layout.sidebar.activePanel (preserved for next show)', () => {
  const Rga = bootShellWithThreePanels();
  Rga.Shell.Sidebar.activate('outline');
  assert.equal(Rga.Shell.Layout.get().sidebar.activePanel, 'outline');

  Rga.Shell.Sidebar.deactivate();
  // Layout.sidebar.activePanel preserved — only visibility (a
  // separate field) reflects the hide. The next reopen restores
  // the same panel.
  assert.equal(Rga.Shell.Layout.get().sidebar.activePanel, 'outline',
    'deactivate must NOT clear activePanel');
  // (Visibility — Layout.sidebar.visible — is owned by the caller
  // that hides the sidebar (rail toggle, Cmd-B), not by deactivate.)
});
