// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Focused tests for context-menu viewport clamping.
//
// The right-click context menu must always stay fully inside the app
// viewport, even when the click lands near the right or bottom edge (the
// reported bug: tagging the last words of a long line opened the menu
// off-screen). The positioning math is extracted into a pure helper so it
// can be verified without a layout engine (jsdom does no layout).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Load the module once. Its IIFE runs on first require and attaches
// Rga.ContextMenu to the window present at that moment; the clamp helpers are
// pure (no window/layout dependency), so one reference serves every test.
let _api = null;
function loadApi() {
  if (_api) return _api;
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="context-menu" hidden></div></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  // The plugin factory touches window.RgaProseMirror lazily (only inside
  // contextMenuPlugin), so the module loads fine without it.
  require('../../../../renderer/js/doc-types/screenplay/plugins/context-menu.js');
  _api = global.window.Rga.ContextMenu;
  assert.equal(typeof _api._clampPosition, 'function', 'expected _clampPosition to be exposed');
  assert.equal(typeof _api._clampSubmenuPosition, 'function', 'expected _clampSubmenuPosition to be exposed');
  return _api;
}
function loadClamp() { return loadApi()._clampPosition; }
function loadSubmenuClamp() { return loadApi()._clampSubmenuPosition; }

const VW = 1280;
const VH = 800;
const MENU_W = 200;
const MENU_H = 260;

test('normal middle-of-line click keeps the click point', () => {
  const clamp = loadClamp();
  const r = clamp(400, 300, MENU_W, MENU_H, VW, VH);
  assert.equal(r.x, 400);
  assert.equal(r.y, 300);
});

test('right-edge click pulls the menu fully inside the viewport', () => {
  const clamp = loadClamp();
  const r = clamp(VW - 4, 300, MENU_W, MENU_H, VW, VH);
  assert.ok(r.x + MENU_W <= VW, 'menu right edge must be inside viewport');
  assert.ok(r.x >= 0, 'menu must not go off the left edge');
});

test('bottom-edge click pulls the menu fully inside the viewport', () => {
  const clamp = loadClamp();
  const r = clamp(400, VH - 4, MENU_W, MENU_H, VW, VH);
  assert.ok(r.y + MENU_H <= VH, 'menu bottom edge must be inside viewport');
  assert.ok(r.y >= 0, 'menu must not go off the top edge');
});

test('tall menu near the bottom is clamped by real height, not a hardcoded 200', () => {
  const clamp = loadClamp();
  const tallH = 500;
  const r = clamp(400, VH - 10, MENU_W, tallH, VW, VH);
  assert.ok(r.y + tallH <= VH, 'a 500px-tall menu must still fit; old code used a hardcoded 200');
});

test('click in extreme corner never produces a negative coordinate', () => {
  const clamp = loadClamp();
  const r = clamp(VW + 50, VH + 50, MENU_W, MENU_H, VW, VH);
  assert.ok(r.x >= 0 && r.y >= 0);
  assert.ok(r.x + MENU_W <= VW && r.y + MENU_H <= VH);
});

test('tiny viewport (RTL/narrow) still clamps to a non-negative margin', () => {
  const clamp = loadClamp();
  const r = clamp(5, 5, MENU_W, MENU_H, 320, 240);
  assert.ok(r.x >= 0 && r.y >= 0);
});

// ---- submenu clamp (the reported bug: "Tag as" submenu spilled off-screen) ----

const SUB_W = 150;
const SUB_H = 290;

test('submenu opens to the right when there is room', () => {
  const sub = loadSubmenuClamp();
  // parent menu well left of center; plenty of room on the right.
  const r = sub({ left: 200, right: 380, top: 300 }, SUB_W, SUB_H, VW, VH);
  assert.equal(r.openRight, true);
});

test('submenu flips left when opening right would overflow the viewport', () => {
  const sub = loadSubmenuClamp();
  // parent menu hugging the right edge — right side cannot fit the submenu.
  const r = sub({ left: VW - 200, right: VW - 8, top: 300 }, SUB_W, SUB_H, VW, VH);
  assert.equal(r.openRight, false, 'submenu must open to the LEFT so it stays on-screen');
});

test('left-opening submenu stays inside the left edge', () => {
  const sub = loadSubmenuClamp();
  const parent = { left: VW - 200, right: VW - 8, top: 300 };
  const r = sub(parent, SUB_W, SUB_H, VW, VH);
  // openRight=false => submenu right edge sits at parent.left, left edge at parent.left - SUB_W
  assert.equal(r.openRight, false);
  assert.ok(parent.left - SUB_W >= 0, 'left-opening submenu must not cross the left edge');
});

test('submenu near the bottom shifts up so its bottom stays inside', () => {
  const sub = loadSubmenuClamp();
  const parentTop = VH - 40; // "Tag as" near the bottom
  const r = sub({ left: 200, right: 380, top: parentTop }, SUB_W, SUB_H, VW, VH);
  const submenuTop = parentTop + r.topOffset;
  assert.ok(submenuTop + SUB_H <= VH, 'submenu bottom must be inside the viewport');
  assert.ok(submenuTop >= 0, 'submenu top must be inside the viewport');
});

test('submenu in a tight viewport picks the side with more room', () => {
  const sub = loadSubmenuClamp();
  // Narrow viewport where neither side fully fits; parent slightly right of center.
  const vw = 360;
  const r = sub({ left: 150, right: 330, top: 100 }, SUB_W, SUB_H, vw, 400);
  // room right = 360-330 = 30; room left = 150 => open left.
  assert.equal(r.openRight, false);
});
