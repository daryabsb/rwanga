// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Bundle 1 §A — guards for the native View menu wiring.
// Static source-level assertions: the Electron menu module is not
// runtime-loadable under node --test (no Electron available), so we
// assert the menu definition + IPC plumbing by reading source.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const MENU_JS    = path.join(REPO, 'electron/menu.js');
const MAIN_JS    = path.join(REPO, 'electron/main.js');
const PRELOAD_JS = path.join(REPO, 'electron/preload.js');
const INDEX_HTML = path.join(REPO, 'renderer/index.html');

function read(p) { return fs.readFileSync(p, 'utf8'); }

test('Bundle 1 §A: native View menu defines Flow / Draft / Print radio items', () => {
  const src = read(MENU_JS);
  ['view.flow', 'view.draft', 'view.print'].forEach(function(id) {
    const re = new RegExp("id:\\s*['\"]" + id.replace('.', '\\.') + "['\"]");
    assert.ok(re.test(src), 'menu.js must declare an item with id: ' + id);
  });
  // type: 'radio' is the affordance that makes "current view" visible
  // in the menu — required by the acceptance criterion "current mode
  // visibly selected".
  const radioCount = (src.match(/type:\s*'radio'/g) || []).length;
  assert.ok(radioCount >= 3,
    'menu.js must declare at least 3 type: \'radio\' items (Flow / Draft / Print). Got ' + radioCount);
});

test('Bundle 1 §A: each View menu item routes through sendMenuAction with the correct action id', () => {
  const src = read(MENU_JS);
  ['view.flow', 'view.draft', 'view.print'].forEach(function(id) {
    const re = new RegExp("sendMenuAction\\(mainWindow,\\s*['\"]" + id.replace('.', '\\.') + "['\"]\\)");
    assert.ok(re.test(src),
      'menu.js must call sendMenuAction(mainWindow, ' + id + ') in the click handler');
  });
});

test('Bundle 1 §A: menu.js exports the setViewMenuRadio + registerIpc helpers (renderer sync surface)', () => {
  const src = read(MENU_JS);
  assert.ok(/function\s+setViewMenuRadio\b/.test(src),
    'menu.js must define setViewMenuRadio (toggles the radio when renderer-side state changes)');
  assert.ok(/function\s+registerIpc\b/.test(src),
    'menu.js must define registerIpc (binds the menu.setViewMode IPC handler)');
  assert.ok(/module\.exports\s*=\s*\{[^}]*setViewMenuRadio[^}]*\}/.test(src),
    'menu.js must export setViewMenuRadio');
  assert.ok(/module\.exports\s*=\s*\{[^}]*registerIpc[^}]*\}/.test(src),
    'menu.js must export registerIpc');
});

test('Bundle 1 §A: main.js calls registerMenuIpc on app ready (so the channel is alive before the renderer pushes)', () => {
  const src = read(MAIN_JS);
  assert.ok(/registerIpc:\s*registerMenuIpc/.test(src),
    'main.js must import registerIpc as registerMenuIpc');
  assert.ok(/registerMenuIpc\(\s*\)/.test(src),
    'main.js must invoke registerMenuIpc() in the app.whenReady block');
});

test('Bundle 1 §A: preload exposes window.rwanga.menu.setViewMode → invokes menu.setViewMode', () => {
  const src = read(PRELOAD_JS);
  assert.ok(/menu:\s*\{/.test(src), 'preload must expose a menu: namespace');
  assert.ok(/setViewMode:\s*\(mode\)\s*=>\s*ipcRenderer\.invoke\(\s*['"]menu\.setViewMode['"]/.test(src),
    'preload must invoke menu.setViewMode over the menu.setViewMode channel');
});

test('Bundle 1 §A: renderer routes view.* menu actions through Rga.ViewMode.set (not ViewManager.activate)', () => {
  const src = read(INDEX_HTML);
  ['view.flow', 'view.draft', 'view.print'].forEach(function(id) {
    const mode = id.split('.')[1];
    const re = new RegExp("case\\s+['\"]" + id.replace('.', '\\.') + "['\"]:\\s*if\\s*\\(Rga\\.ViewMode\\)\\s*Rga\\.ViewMode\\.set\\(['\"]" + mode + "['\"]\\)");
    assert.ok(re.test(src),
      'renderer index.html must route ' + id + ' to Rga.ViewMode.set(\'' + mode + '\')');
  });
  // Negative guard: the menu-action switch must NOT route to
  // Rga.ViewManager.activate for view modes — that would bypass the
  // SSOT (Bundle 1 §A "one owner only, no duplicate logic").
  const switchBlock = src.match(/case 'view\.flow':[\s\S]*?case 'view\.print':[^\n]*break;/);
  assert.ok(switchBlock, 'view.* switch block must exist');
  assert.equal(/Rga\.ViewManager\.activate/.test(switchBlock[0]), false,
    'view.* menu actions must NOT call Rga.ViewManager.activate directly — must route through Rga.ViewMode.set');
});

test('Bundle 1 §A: renderer subscribes to Rga.ViewMode.onChange and pushes to window.rwanga.menu.setViewMode', () => {
  const src = read(INDEX_HTML);
  assert.ok(/Rga\.ViewMode\.onChange\(function\(mode\)\s*\{[\s\S]{0,300}window\.rwanga\.menu\.setViewMode\(mode\)/.test(src),
    'index.html must subscribe to Rga.ViewMode.onChange and push the new mode to window.rwanga.menu.setViewMode (menu radio sync)');
});
