// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Visual Comfort Slice — inspection-blocker fixes (A / B / C / D).
//
// Source-level guards — the repo idiom for CSS + chrome verification
// (see flow-chrome.test.js and regression-fix-titlebar-maximize.test.js).
// They lock in the second-pass fixes:
//   A — the title-bar maximize compensation is additive (base + OS
//       overflow) and covers the top edge — window controls sit
//       identically placed normal vs maximized, DPI-safe, never
//       clipped; plus a breathing gap before the control trio.
//   B — the RTL line-number gutter consumes zero manuscript width
//       (no canyon, no inward displacement); LTR is provably untouched.
//   C — a zero-layout-cost page-colour mask band creates a breathing
//       region around the page-transition chrome.
//   D — the scene heading has hierarchy separation from the transition
//       region above and the action body below.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const TITLE_BAR_JS  = path.join(REPO, 'renderer/js/shell/title-bar.js');
const SHELL_CSS     = path.join(REPO, 'renderer/css/shell.css');
const EDITOR_PM_CSS = path.join(REPO, 'renderer/css/editor-prosemirror.css');

function read(p) { return fs.readFileSync(p, 'utf8'); }

// Extract the declaration block of a CSS rule given its selector as a
// literal string. Returns the text between { and }.
function ruleBody(css, selectorLiteral) {
  const esc = selectorLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(esc + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}

// ================================================================
// A — window controls: intentional placement, DPI-safe, never clipped
// ================================================================

test('A: title-bar.js defines a devicePixelRatio-aware overflow floor', () => {
  const src = read(TITLE_BAR_JS);
  assert.ok(/_safeOverflowFloor/.test(src),
    'title-bar.js must define _safeOverflowFloor (the DPI-aware minimum)');
  assert.ok(/devicePixelRatio/.test(src),
    '_safeOverflowFloor must scale by window.devicePixelRatio (8px @100%, 12 @150%, 16 @200%)');
});

test('A: _applyMaximizeOverflow clamps every edge to the floor and covers all four edges', () => {
  const src = read(TITLE_BAR_JS);
  const fn = src.match(/function _applyMaximizeOverflow[\s\S]*?\n  \}/);
  assert.ok(fn, '_applyMaximizeOverflow must exist');
  assert.ok(/Math\.max\(/.test(fn[0]) && /_safeOverflowFloor\(\)/.test(fn[0]),
    'every edge must be Math.max-clamped to _safeOverflowFloor() so a 0 measurement cannot pin a property to 0px');
  assert.ok(/setProperty\(\s*['"]--rga-max-overflow-top['"]/.test(fn[0]),
    '_applyMaximizeOverflow must set --rga-max-overflow-top (the top edge clips too on Win11 frameless-maximized)');
  assert.ok(/removeProperty\(\s*['"]--rga-max-overflow-top['"]/.test(fn[0]),
    'the unmaximized branch must remove --rga-max-overflow-top so the CSS fallback engages');
});

test('A: the maximized titlebar compensation is ADDITIVE (base + overflow) and covers the top edge', () => {
  const css = read(SHELL_CSS);
  const body = ruleBody(css, 'body.window-maximized #rga-shell-titlebar');
  assert.ok(body, 'body.window-maximized #rga-shell-titlebar rule must exist');
  assert.ok(/padding-right\s*:\s*calc\(\s*12px\s*\+\s*var\(\s*--rga-max-overflow-right/.test(body),
    'padding-right must ADD the overflow to the 12px base — calc(12px + var(--rga-max-overflow-right…)) — identical placement normal vs maximized');
  assert.ok(/padding-left\s*:\s*calc\(\s*12px\s*\+\s*var\(\s*--rga-max-overflow-left/.test(body),
    'padding-left must ADD the overflow to the 12px base');
  assert.ok(/padding-top\s*:\s*var\(\s*--rga-max-overflow-top/.test(body),
    'the maximized titlebar must compensate the top overflow (padding-top)');
  assert.ok(/height\s*:\s*calc\(\s*28px\s*\+\s*var\(\s*--rga-max-overflow-top/.test(body),
    'the maximized titlebar must grow its height by the top overflow so the visible band stays 28px');
});

test('A: the window-control trio has a breathing gap from the app-actions', () => {
  const css = read(SHELL_CSS);
  const body = ruleBody(css, '#rga-shell-window-min');
  assert.ok(body, '#rga-shell-window-min rule must exist');
  assert.ok(/margin-inline-start\s*:/.test(body),
    '#rga-shell-window-min must declare a margin-inline-start so the window controls are set off from the theme/avatar');
});

// ================================================================
// B — RTL line-number gutter: zero-width, no canyon, no displacement
// ================================================================

test('B: the RTL gutter rule keys off #editor[dir="rtl"] via :has() (not a dead ancestor selector)', () => {
  const css = read(EDITOR_PM_CSS);
  assert.ok(/\.rga-page-row:has\(\s*>\s*#editor\[dir="rtl"\]\s*\)/.test(css),
    '.rga-page-row must use :has(> #editor[dir="rtl"]) — #editor is a descendant, so an ancestor [dir=rtl] selector never matches');
  assert.ok(!/\[dir="rtl"\]\s+#editor-container\.view-flow\s+\.rga-page-row\s*\{/.test(css),
    'the dead ancestor selector [dir="rtl"] #editor-container.view-flow .rga-page-row must be removed');
});

test('B: the RTL gutter is width:0 (zero manuscript-width cost) and direction:rtl, page-row reverses', () => {
  const css = read(EDITOR_PM_CSS);
  const rowRule = css.match(/\.rga-page-row:has\([^)]*\)\s*\{([^}]*)\}/);
  assert.ok(rowRule && /flex-direction\s*:\s*row-reverse/.test(rowRule[1]),
    'RTL page-row must flex-direction: row-reverse (gutter on the right)');
  const gutterRule = css.match(/:has\(\s*>\s*#editor\[dir="rtl"\]\s*\)\s+\.flow-line-gutter\s*\{([^}]*)\}/);
  assert.ok(gutterRule, 'the RTL .flow-line-gutter rule must exist');
  assert.ok(/width\s*:\s*0\b/.test(gutterRule[1]),
    'the RTL gutter must be width:0 so it consumes no manuscript width — no canyon, no inward displacement');
  assert.ok(/direction\s*:\s*rtl/.test(gutterRule[1]),
    'the RTL gutter must be direction:rtl so .flow-line-num hugs the editor-facing edge');
});

test('B: the pink scene guide rail (.rga-scene-v3) uses logical inline-start, not physical left', () => {
  const css = read(EDITOR_PM_CSS);
  const body = ruleBody(css, '.rga-scene-v3');
  assert.ok(body, '.rga-scene-v3 rule must exist');
  assert.ok(/border-inline-start\s*:/.test(body) && /padding-inline-start\s*:/.test(body),
    '.rga-scene-v3 must use border-inline-start / padding-inline-start (follows RTL/LTR direction)');
  assert.ok(!/border-left\s*:/.test(body) && !/padding-left\s*:/.test(body),
    '.rga-scene-v3 must NOT use physical border-left / padding-left (the RTL bug)');
});

// ================================================================
// C — page-transition breathing region (zero-layout-cost mask band)
// ================================================================

test('C: the Flow page-number pill masks with --editor-page-bg, not the --editor-bg desk', () => {
  const css = read(EDITOR_PM_CSS);
  const body = ruleBody(css, '#editor-container.view-flow .rga-page-marker .rga-page-marker-begin');
  assert.ok(body, '.rga-page-marker-begin flow rule must exist');
  assert.ok(/background\s*:\s*var\(\s*--editor-page-bg/.test(body),
    'the page-number pill must mask with --editor-page-bg (the Flow surface colour)');
});

test('C: a zero-layout-cost page-colour mask band creates the transition breathing region', () => {
  const css = read(EDITOR_PM_CSS);
  const body = ruleBody(css, '#editor-container.view-flow .rga-page-marker::before');
  assert.ok(body, '.rga-page-marker::before mask band must exist');
  assert.ok(/position\s*:\s*absolute/.test(body),
    'the mask band must be position:absolute (zero layout cost — the marker stays zero-height)');
  assert.ok(/background\s*:\s*var\(\s*--editor-page-bg/.test(body),
    'the mask band must be page-coloured so it clears a calm strip around the transition chrome');
});

// ================================================================
// D — scene heading hierarchy separation
// ================================================================

test('D: the scene block and scene heading carry the widened separation margins', () => {
  const css = read(EDITOR_PM_CSS);
  const scene = ruleBody(css, '.rga-scene-v3');
  assert.ok(scene && /margin\s*:\s*2\.2em\s+0/.test(scene),
    '.rga-scene-v3 must use margin: 2.2em 0 — more air separating each scene from the transition region above');
  const heading = ruleBody(css, '.rga-scene-heading-v3');
  assert.ok(heading && /margin\s*:\s*1\.6em\s+0\s+1\.3em\s+0/.test(heading),
    '.rga-scene-heading-v3 must use margin: 1.6em 0 1.3em 0 — a wider gap below the slug separates it from the action body');
});
