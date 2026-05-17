// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 1 — Rga.Shell.ActivityRail unit tests (plan §3.3, §8.2).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="rail"></div><div id="host"></div></body></html>',
    { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  ['../../../renderer/js/shell/layout.js',
   '../../../renderer/js/shell/sidebar.js',
   '../../../renderer/js/shell/activity-rail.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  const { Layout, Sidebar, ActivityRail } = global.window.Rga.Shell;
  Layout._reset();
  Sidebar._reset();
  ActivityRail._reset();
  Sidebar.setHost(document.getElementById('host'));
  return { Layout, Sidebar, ActivityRail,
           rail: document.getElementById('rail'),
           host: document.getElementById('host') };
}

function registerThree(Sidebar) {
  // Use IDs documented in Rga.Shell.ActivityRail._RAIL_GROUPS so the
  // post-doctrine three-group layout puts them in known positions.
  // sceneNavigator + scriptWorkspace are in the Top group; settings
  // is pinned to Bottom.
  [
    { id: 'sceneNavigator', label: 'Scene Navigator' },
    { id: 'scriptWorkspace', label: 'Script Workspace' },
    { id: 'settings', label: 'Settings' }
  ].forEach(function(spec) {
    Sidebar.registerPanel({
      id: spec.id, label: spec.label, icon: spec.id.charAt(0).toUpperCase(),
      available: true,
      mount: function(c) { if (c) c.innerHTML = '<div data-panel="' + spec.id + '"></div>'; },
      unmount: function() {}
    });
  });
}

test('init builds one button per registered panel in Activity Rail Doctrine order', () => {
  const { Sidebar, ActivityRail, rail } = boot();
  registerThree(Sidebar);
  ActivityRail.init(rail);
  const buttons = rail.querySelectorAll('.rga-shell-rail-item');
  assert.equal(buttons.length, 3);
  assert.deepEqual(
    Array.from(buttons).map(b => b.getAttribute('data-panel-id')),
    ['sceneNavigator', 'scriptWorkspace', 'settings'],
    'doctrine order: Top group (SceneNav, ScriptWorkspace) then Bottom (Settings); middle absent because none registered'
  );
});

test('each button has aria-label from panel.label', () => {
  const { Sidebar, ActivityRail, rail } = boot();
  registerThree(Sidebar);
  ActivityRail.init(rail);
  const first = rail.querySelector('.rga-shell-rail-item');
  assert.equal(first.getAttribute('aria-label'), 'Scene Navigator');
});

test('button title includes shortcut when provided', () => {
  const { Sidebar, ActivityRail, rail } = boot();
  Sidebar.registerPanel({
    id: 'scenes', label: 'Scenes', icon: '📋', shortcut: 'Cmd-Shift-S',
    available: true, mount: function() {}, unmount: function() {}
  });
  ActivityRail.init(rail);
  const btn = rail.querySelector('.rga-shell-rail-item');
  assert.equal(btn.getAttribute('title'), 'Scenes (Cmd-Shift-S)');
});

test('clicking an inactive button calls Sidebar.activate(id) and sets Layout sidebar.visible=true', () => {
  const { Layout, Sidebar, ActivityRail, rail } = boot();
  // Start with sidebar hidden.
  Layout.set({ sidebar: { visible: false } });
  registerThree(Sidebar);
  ActivityRail.init(rail);
  const btn = rail.querySelector('[data-panel-id="scriptWorkspace"]');
  btn.click();
  assert.equal(Sidebar.current(), 'scriptWorkspace');
  assert.equal(Layout.get().sidebar.visible, true);
});

test('clicking the active button toggles off — deactivate + Layout sidebar.visible=false', () => {
  const { Layout, Sidebar, ActivityRail, rail } = boot();
  registerThree(Sidebar);
  ActivityRail.init(rail);
  const btn = rail.querySelector('[data-panel-id="sceneNavigator"]');
  btn.click();  // activate
  assert.equal(Sidebar.current(), 'sceneNavigator');
  assert.equal(Layout.get().sidebar.visible, true);
  btn.click();  // toggle off
  assert.equal(Sidebar.current(), null);
  assert.equal(Layout.get().sidebar.visible, false);
});

test('rail\'s visual .active state syncs after Sidebar.onChange fires (driven externally)', () => {
  const { Sidebar, ActivityRail, rail } = boot();
  registerThree(Sidebar);
  ActivityRail.init(rail);
  // Activate via the Sidebar API directly (no click).
  Sidebar.activate('scriptWorkspace');
  const btn = rail.querySelector('[data-panel-id="scriptWorkspace"]');
  assert.ok(btn.classList.contains('rga-shell-rail-item-active'));
  assert.equal(btn.getAttribute('aria-pressed'), 'true');
  // Switch.
  Sidebar.activate('sceneNavigator');
  assert.ok(!btn.classList.contains('rga-shell-rail-item-active'));
  assert.equal(rail.querySelector('[data-panel-id="sceneNavigator"]').classList.contains('rga-shell-rail-item-active'), true);
});

test('refresh() re-renders from the current panel registry', () => {
  const { Sidebar, ActivityRail, rail } = boot();
  Sidebar.registerPanel({ id: 'a', label: 'A', icon: 'A', available: true, mount: function() {}, unmount: function() {} });
  ActivityRail.init(rail);
  assert.equal(rail.querySelectorAll('.rga-shell-rail-item').length, 1);
  Sidebar.registerPanel({ id: 'b', label: 'B', icon: 'B', available: true, mount: function() {}, unmount: function() {} });
  ActivityRail.refresh();
  assert.equal(rail.querySelectorAll('.rga-shell-rail-item').length, 2);
});

test('init with no container returns false safely', () => {
  const { ActivityRail } = boot();
  assert.equal(ActivityRail.init(null), false);
});
