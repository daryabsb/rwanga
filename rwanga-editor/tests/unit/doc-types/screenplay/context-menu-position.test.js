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
// Rga.ContextMenu to the window present at that moment; the clamp helper is
// pure (no window/layout dependency), so one reference serves every test.
let _clamp = null;
function loadClamp() {
  if (_clamp) return _clamp;
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="context-menu" hidden></div></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  // The plugin factory touches window.RgaProseMirror lazily (only inside
  // contextMenuPlugin), so the module loads fine without it.
  require('../../../../renderer/js/doc-types/screenplay/plugins/context-menu.js');
  _clamp = global.window.Rga.ContextMenu._clampPosition;
  assert.equal(typeof _clamp, 'function', 'expected Rga.ContextMenu._clampPosition to be exposed');
  return _clamp;
}

const VW = 1280;
const VH = 800;
const MENU_W = 200;
const MENU_H = 260;

test('normal middle-of-line click keeps the click point', () => {
  const clamp = loadClamp();
  const r = clamp(400, 300, MENU_W, MENU_H, VW, VH);
  assert.equal(r.x, 400);
  assert.equal(r.y, 300);
  assert.equal(r.flipSubmenu, false);
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

test('submenu flips to the left when the menu sits near the right edge', () => {
  const clamp = loadClamp();
  const r = clamp(VW - 4, 300, MENU_W, MENU_H, VW, VH);
  assert.equal(r.flipSubmenu, true, 'submenu must flip so "Tag as ▶" stays reachable');
});

test('submenu does not flip when there is room to the right', () => {
  const clamp = loadClamp();
  const r = clamp(100, 300, MENU_W, MENU_H, VW, VH);
  assert.equal(r.flipSubmenu, false);
});

test('tiny viewport (RTL/narrow) still clamps to a non-negative margin', () => {
  const clamp = loadClamp();
  const r = clamp(5, 5, MENU_W, MENU_H, 320, 240);
  assert.ok(r.x >= 0 && r.y >= 0);
});
