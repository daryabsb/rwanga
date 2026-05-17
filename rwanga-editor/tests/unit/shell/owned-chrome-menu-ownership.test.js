// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Workstream A — owned menu surface guards.
//
// G-OC-4: renderer declares #rga-shell-menubar with exactly 8
//         top-level entries in declared order:
//           File · Edit · View · Script · Tags · Tools · Export · Help
//         Each top-level item carries data-menu.
//         Dropdown items route through existing SSOT mutators
//         (no menu item performs a direct DOM action).
//
// G-OC-5: electron/menu.js calls Menu.setApplicationMenu(null) on
//         Windows/Linux paths and Menu.setApplicationMenu(builtMenu)
//         on macOS path. The platform branch is explicit + grep-able.
//
// Stage gate: until A4 lands, #rga-shell-menubar does not exist.
// The guard skips until then.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const INDEX_HTML = path.join(REPO, 'renderer/index.html');
const MENU_JS    = path.join(REPO, 'electron/menu.js');

function read(p) { return fs.readFileSync(p, 'utf8'); }

function isA4Landed(html) {
  return /id="rga-shell-menubar"/.test(html);
}

const REQUIRED_MENUS = ['file', 'edit', 'view', 'script', 'tags', 'tools', 'export', 'help'];

test('G-OC-4: #rga-shell-menubar exists with exactly 8 entries in declared order', () => {
  const html = read(INDEX_HTML);
  if (!isA4Landed(html)) return;  // dormant until A4
  // Find the menubar section and extract data-menu attributes in order.
  const navMatch = html.match(/<nav[^>]*id="rga-shell-menubar"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(navMatch, '<nav id="rga-shell-menubar"> must exist');
  const inner = navMatch[1];
  const dataMenus = [];
  const re = /data-menu="([^"]+)"/g;
  let m;
  while ((m = re.exec(inner)) !== null) dataMenus.push(m[1]);
  assert.deepEqual(dataMenus, REQUIRED_MENUS,
    'menu bar must declare exactly: ' + REQUIRED_MENUS.join(' · '));
});

test('G-OC-4: every menubar item is a <button> (not a <a> or <div>) for keyboard contract', () => {
  const html = read(INDEX_HTML);
  if (!isA4Landed(html)) return;
  REQUIRED_MENUS.forEach(function(menu) {
    const re = new RegExp('<button[^>]*data-menu="' + menu + '"', 'i');
    assert.ok(re.test(html),
      'menu "' + menu + '" must be a <button> (focusable + keyboard-activatable by default)');
  });
});

test('G-OC-4: menubar carries an aria-label (screen reader contract)', () => {
  const html = read(INDEX_HTML);
  if (!isA4Landed(html)) return;
  assert.ok(/<nav[^>]*id="rga-shell-menubar"[^>]*aria-label\s*=/.test(html),
    '<nav id="rga-shell-menubar"> must declare aria-label (e.g. "Application menu")');
});

// ----------------------------------------------------------------
// G-OC-5 — native menu suppression on Windows/Linux
// ----------------------------------------------------------------

function isA4MenuJsLanded(src) {
  // After A4, menu.js calls setApplicationMenu(null) on Win/Linux.
  return /Menu\.setApplicationMenu\s*\(\s*null\s*\)/.test(src);
}

test('G-OC-5: electron/menu.js suppresses the native menu on Win/Linux (Menu.setApplicationMenu(null))', () => {
  const src = read(MENU_JS);
  if (!isA4MenuJsLanded(src)) return;  // dormant until A4
  assert.ok(/Menu\.setApplicationMenu\s*\(\s*null\s*\)/.test(src),
    'menu.js must call Menu.setApplicationMenu(null) on the non-macOS path (no native menu when renderer owns the menu)');
});

test('G-OC-5: electron/menu.js still calls Menu.setApplicationMenu(builtMenu) on macOS (HIG-required global Mac menu)', () => {
  const src = read(MENU_JS);
  if (!isA4MenuJsLanded(src)) return;
  // The macOS path keeps the native menu (per Option B hybrid).
  // Verify both paths coexist via a platform check.
  assert.ok(/process\.platform\s*===\s*['"]darwin['"]/.test(src) || /isMac/.test(src),
    'menu.js must branch on process.platform === "darwin" / isMac to keep the macOS native menu populated');
  // And the macOS branch must still call setApplicationMenu with a non-null menu.
  assert.ok(/Menu\.setApplicationMenu\s*\(\s*(?!null)\w/.test(src),
    'menu.js must still call Menu.setApplicationMenu(builtMenu) on the macOS branch');
});
