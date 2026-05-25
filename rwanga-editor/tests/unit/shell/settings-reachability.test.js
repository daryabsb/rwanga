// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings reachability — owned tests.
//
// Proves the three real-app entry points all open the Settings
// workspace through the same canonical opener:
//
//   1. Rail bottom button click  → Rga.SettingsWorkspace.open()
//   2. Tools → Settings menu     → invokes 'view.openSettings'
//                                  command which calls .open()
//   3. Ctrl+,                    → KR command 'view.openSettings'
//                                  which calls .open()
//
// And proves the dead-end legacy paths cannot render a competing
// surface:
//
//   - panels/settings.js mount() does NOT render an empty-state
//   - panels/settings.js mount() redirects to the canonical opener
//
// Singleton behavior is owned by TabManager.openWorkspace and
// covered by the Settings workspace's own integration spec.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// ----------------------------------------------------------------
// DOM + module boot helpers
// ----------------------------------------------------------------

function bootRendererDom() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
      '<div id="tab-content-host"></div>' +
      '<div id="rail"></div>' +
      '<div id="sidebar-host"></div>' +
    '</body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  dom.window.Rga = {};
  dom.window.rwanga = {
    prefs: {
      read:  async function() { return {}; },
      write: async function() { return {}; }
    }
  };
  return dom;
}

function loadWorkspaceStack() {
  ['../../../renderer/js/shell/layout.js',
   '../../../renderer/js/shell/sidebar.js',
   '../../../renderer/js/shell/activity-rail.js',
   '../../../renderer/js/shell/keyboard-registry.js',
   '../../../renderer/js/shell/settings-validators.js',
   '../../../renderer/js/shell/settings-registry.js',
   '../../../renderer/js/shell/settings-layout.js',
   '../../../renderer/js/shell/settings-search.js',
   '../../../renderer/js/shell/settings-store.js',
   '../../../renderer/js/shell/workspaces.js',
   '../../../renderer/js/shell/workspaces/settings-workspace.js',
   '../../../renderer/js/shell/panels/settings.js'
  ].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  return global.window.Rga;
}

// Stub the parts of TabManager that openWorkspace needs. We don't
// want to pull in the full tab-manager.js (it depends on a lot of
// editor scaffolding); for reachability we only need to confirm that
// .open() routes through TabManager.openWorkspace('settings').
function stubTabManager(Rga) {
  const calls = [];
  Rga.TabManager = {
    _calls: calls,
    openWorkspace: function(kind) {
      calls.push(kind);
      return { id: 'fake-tab', kind: 'workspace', workspaceKind: kind };
    },
    activeDoc: function() { return null; }
  };
  return calls;
}

// ----------------------------------------------------------------
// §1 — Canonical opener exists and routes through TabManager
// ----------------------------------------------------------------

test('reachability — Rga.SettingsWorkspace.open is a function exposed on window.Rga', () => {
  bootRendererDom();
  const Rga = loadWorkspaceStack();
  assert.ok(Rga.SettingsWorkspace,
    'Rga.SettingsWorkspace must exist on the global namespace');
  assert.equal(typeof Rga.SettingsWorkspace.open, 'function',
    'Rga.SettingsWorkspace.open must be a function');
});

test('reachability — Rga.SettingsWorkspace.open() calls TabManager.openWorkspace("settings")', () => {
  bootRendererDom();
  const Rga = loadWorkspaceStack();
  const calls = stubTabManager(Rga);
  Rga.SettingsWorkspace.open();
  assert.deepEqual(calls, ['settings']);
});

test('reachability — Rga.SettingsWorkspace.open() returns the tab from TabManager.openWorkspace', () => {
  bootRendererDom();
  const Rga = loadWorkspaceStack();
  stubTabManager(Rga);
  const tab = Rga.SettingsWorkspace.open();
  assert.ok(tab);
  assert.equal(tab.workspaceKind, 'settings');
});

// ----------------------------------------------------------------
// §2 — Ctrl+, routes through the canonical opener
// ----------------------------------------------------------------

test('reachability — KR command "view.openSettings" routes through Rga.SettingsWorkspace.open()', () => {
  bootRendererDom();
  const Rga = loadWorkspaceStack();
  const calls = stubTabManager(Rga);
  const ok = Rga.KeyboardRegistry.invokeCommand('view.openSettings');
  assert.equal(ok, true, 'invokeCommand must return true for the registered id');
  assert.deepEqual(calls, ['settings'],
    'view.openSettings must call TabManager.openWorkspace("settings")');
});

test('reachability — Ctrl+, accelerator label is registered on the command', () => {
  bootRendererDom();
  const Rga = loadWorkspaceStack();
  const label = Rga.KeyboardRegistry.commandAccelerator('view.openSettings');
  assert.equal(label, 'Ctrl+,',
    'view.openSettings must carry the Ctrl+, accelerator so the menu can show it');
});

// ----------------------------------------------------------------
// §3 — Rail click routes through the canonical opener
// ----------------------------------------------------------------

test('reachability — rail button for "settings" calls SettingsWorkspace.open and NOT Sidebar.activate', () => {
  bootRendererDom();
  const Rga = loadWorkspaceStack();
  const calls = stubTabManager(Rga);
  const Sidebar = Rga.Shell.Sidebar;
  const ActivityRail = Rga.Shell.ActivityRail;

  // panels/settings.js registered 'settings' during loadWorkspaceStack.
  // Do NOT reset Sidebar here (would wipe the registration). Just point
  // the host at our DOM and init the rail.
  Sidebar.setHost(document.getElementById('sidebar-host'));
  ActivityRail.init(document.getElementById('rail'));

  // Spy on Sidebar.activate to confirm it is NEVER called for 'settings'.
  let activatedWith = null;
  const realActivate = Sidebar.activate;
  Sidebar.activate = function(id) { activatedWith = id; return realActivate.call(this, id); };
  try {
    const btn = document.querySelector(
      '.rga-shell-rail-item[data-panel-id="settings"]');
    assert.ok(btn, 'rail must render a settings button (from sidebar-panel registration)');
    btn.click();

    assert.deepEqual(calls, ['settings'],
      'rail click on settings must call TabManager.openWorkspace("settings")');
    assert.equal(activatedWith, null,
      'rail click on settings must NOT call Sidebar.activate (no sidebar surface)');
  } finally {
    Sidebar.activate = realActivate;
  }
});

// ----------------------------------------------------------------
// §4 — Legacy sidebar panel cannot render a competing surface
// ----------------------------------------------------------------

test('reachability — panels/settings.js mount() redirects to SettingsWorkspace.open() and renders no UI', () => {
  bootRendererDom();
  const Rga = loadWorkspaceStack();
  const calls = stubTabManager(Rga);
  const Sidebar = Rga.Shell.Sidebar;
  const host = document.getElementById('sidebar-host');
  Sidebar.setHost(host);

  // Belt-and-suspenders path: force the mount to run via direct
  // Sidebar.activate (a programmatic call that bypasses the rail
  // short-circuit). The panel's mount must still redirect.
  Sidebar.activate('settings');

  assert.deepEqual(calls, ['settings'],
    'panels/settings.js mount must call the canonical opener even on direct activate');
  // The sidebar host must NOT contain any rendered settings UI
  // (no empty-state, no title, no description).
  assert.equal(host.children.length, 0,
    'sidebar host must remain empty — the legacy panel has no surface');
  assert.equal(host.innerHTML.trim(), '',
    'sidebar host innerHTML must be empty after the redirect mount');
});

test('reachability — panels/settings.js registration is metadata-only (label/icon for the rail)', () => {
  bootRendererDom();
  const Rga = loadWorkspaceStack();
  const controller = Rga.Shell.Sidebar.getController('settings');
  assert.ok(controller, 'settings panel must remain registered (rail button source)');
  assert.equal(controller.id, 'settings');
  assert.equal(controller.label, 'Settings');
  // available:false is the explicit "not a real surface" flag.
  assert.equal(controller.available, false,
    'legacy panel must declare available:false to signal "shim only"');
});

// ----------------------------------------------------------------
// §5 — Menu wiring: renderer Tools → Settings command id
// ----------------------------------------------------------------
// MENU_DEFS lives inline in renderer/index.html. A unit test cannot
// import it; we grep the file for the wiring at source-level. This
// is the same pattern the source-audit tests use for HTML/template
// asserts.

test('reachability — renderer Tools menu "Settings" row points at view.openSettings', () => {
  const indexHtml = fs.readFileSync(
    path.resolve(__dirname, '../../../renderer/index.html'), 'utf8');
  // Match the exact MENU_DEFS row regardless of formatting whitespace.
  const re = /label:\s*['"]Settings['"]\s*,\s*command:\s*['"]view\.openSettings['"]/;
  assert.ok(re.test(indexHtml),
    'renderer index.html MENU_DEFS.tools must contain { label: "Settings", command: "view.openSettings" }');
  // And the disabled-stub form must NOT appear (no Settings row with disabled:true).
  const disabledRe = /label:\s*['"]Settings['"]\s*,\s*disabled:\s*true/;
  assert.equal(disabledRe.test(indexHtml), false,
    'renderer index.html must NOT contain a disabled Settings menu row anymore');
});

// ----------------------------------------------------------------
// §6 — Electron native menu (macOS): Preferences sends view.openSettings
// ----------------------------------------------------------------

test('reachability — electron/menu.js macOS app menu sends view.openSettings as Preferences action', () => {
  const menuJs = fs.readFileSync(
    path.resolve(__dirname, '../../../electron/menu.js'), 'utf8');
  // The Preferences row appears in the isMac branch and calls
  // sendMenuAction(mainWindow, 'view.openSettings'). The renderer
  // IPC handler at renderer/index.html ~1426 routes any menu.action
  // through KR.invokeCommand, so the same canonical opener fires.
  const re = /label:\s*['"]Preferences…?['"][\s\S]{0,200}?'view\.openSettings'/;
  assert.ok(re.test(menuJs),
    'electron/menu.js must include a Preferences menu item that sends "view.openSettings"');
});

// ----------------------------------------------------------------
// §7 — Singleton: opening twice does not stack tabs
// ----------------------------------------------------------------
// The singleton contract lives in TabManager.openWorkspace itself
// (see renderer/js/tab-manager.js ~line 194). The integration spec
// covers it end-to-end. Here we just confirm SettingsWorkspace.open
// makes exactly one call per invocation — no fan-out.

test('reachability — each Rga.SettingsWorkspace.open() invocation calls TabManager exactly once', () => {
  bootRendererDom();
  const Rga = loadWorkspaceStack();
  const calls = stubTabManager(Rga);
  Rga.SettingsWorkspace.open();
  Rga.SettingsWorkspace.open();
  Rga.SettingsWorkspace.open();
  assert.deepEqual(calls, ['settings', 'settings', 'settings'],
    'each open() call must invoke TabManager exactly once (singleton enforcement lives in TabManager)');
});
