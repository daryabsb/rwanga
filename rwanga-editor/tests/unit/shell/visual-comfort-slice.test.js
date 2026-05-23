// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Visual Comfort Slice — inspection-blocker fixes (A / B / C / D), Pass 3.
//
// Source-level guards (the repo idiom for CSS + chrome verification).
// Pass 3 re-targets the four root causes the forensic identified:
//   A — windowed root-zone composition (wider controls + a real gap),
//       not only the maximize-overflow path.
//   B — one direction owner; the RTL gutter is absolutely positioned
//       (no flex-direction → no double reversal), zero manuscript-width.
//   C — the page-transition mask band uses a PX height (the marker's
//       font-size:0 collapsed the previous em height to 0).
//   D — non-collapsing separation via PADDING (margins were absorbed).
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
// literal string. `\s*\{` anchors to the rule, so e.g. ".rga-scene-v3"
// matches ".rga-scene-v3 {" but not ".rga-scene-v3-content {".
function ruleBody(css, selectorLiteral) {
  const esc = selectorLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(esc + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}

// ================================================================
// A — window controls: windowed composition + maximize safety
// ================================================================

test('A: title-bar.js keeps the DPI-aware overflow floor on all four edges', () => {
  const src = read(TITLE_BAR_JS);
  assert.ok(/_safeOverflowFloor/.test(src) && /devicePixelRatio/.test(src),
    '_safeOverflowFloor must scale by window.devicePixelRatio');
  const fn = src.match(/function _applyMaximizeOverflow[\s\S]*?\n  \}/);
  assert.ok(fn && /Math\.max\(/.test(fn[0]) && /_safeOverflowFloor\(\)/.test(fn[0]),
    '_applyMaximizeOverflow must clamp each edge to the floor');
  assert.ok(/setProperty\(\s*['"]--rga-max-overflow-top['"]/.test(fn[0]),
    '_applyMaximizeOverflow must cover the top edge');
});

test('A: the maximized titlebar compensation is additive (base + overflow) + top', () => {
  const css = read(SHELL_CSS);
  const body = ruleBody(css, 'body.window-maximized #rga-shell-titlebar');
  assert.ok(body, 'body.window-maximized #rga-shell-titlebar rule must exist');
  assert.ok(/padding-right\s*:\s*calc\(\s*12px\s*\+\s*var\(\s*--rga-max-overflow-right/.test(body),
    'padding-right must be additive — calc(12px + var(--rga-max-overflow-right…))');
  assert.ok(/padding-top\s*:\s*var\(\s*--rga-max-overflow-top/.test(body),
    'the maximized titlebar must compensate the top overflow');
});

test('A: window controls are widened to the Windows-standard width (windowed-visible)', () => {
  const css = read(SHELL_CSS);
  const body = ruleBody(css, '.rga-shell-window-control');
  assert.ok(body, '.rga-shell-window-control rule must exist');
  assert.ok(/width\s*:\s*46px/.test(body),
    'window controls must be 46px wide (38px read as cramped) — always-on, not maximize-dependent');
});

test('A: the window-control trio is set off from the app-actions by a clear gap', () => {
  const css = read(SHELL_CSS);
  const body = ruleBody(css, '#rga-shell-window-min');
  assert.ok(body && /margin-inline-start\s*:\s*16px/.test(body),
    '#rga-shell-window-min must declare margin-inline-start: 16px (clear separation from theme/avatar)');
});

// ================================================================
// B — RTL gutter: one owner, absolute, no double reversal
// ================================================================

test('B: the RTL gutter rule keys off #editor[dir="rtl"] via :has() — no dead ancestor selector', () => {
  const css = read(EDITOR_PM_CSS);
  assert.ok(/\.rga-page-row:has\(\s*>\s*#editor\[dir="rtl"\]\s*\)/.test(css),
    '.rga-page-row must use :has(> #editor[dir="rtl"]) — the single document-owned direction signal');
  assert.ok(!/\[dir="rtl"\]\s+#editor-container\.view-flow\s+\.rga-page-row\s*\{/.test(css),
    'the dead ancestor [dir="rtl"] selector must not be present');
});

test('B: the RTL gutter is absolutely positioned — no flex-direction, no double reversal', () => {
  const css = read(EDITOR_PM_CSS);
  const gutter = css.match(/:has\(\s*>\s*#editor\[dir="rtl"\]\s*\)\s+\.flow-line-gutter\s*\{([^}]*)\}/);
  assert.ok(gutter, 'the RTL .flow-line-gutter rule must exist');
  assert.ok(/position\s*:\s*absolute/.test(gutter[1]),
    'the RTL gutter must be position:absolute (taken out of the flex row — zero manuscript-width cost)');
  assert.ok(/left\s*:\s*calc\(/.test(gutter[1]),
    'the RTL gutter must be placed by a physical `left` calc (direction-immune — no double reversal)');
  assert.ok(/direction\s*:\s*rtl/.test(gutter[1]),
    'the RTL gutter must be direction:rtl so the numbers hug the editor-facing edge');
  assert.ok(!/flex-direction/.test(gutter[1]),
    'the RTL gutter rule must NOT use flex-direction (that caused the row-reverse double reversal)');
  // The page-row rule under :has() must only establish a positioning
  // context — no flex-direction reversal.
  const row = css.match(/\.rga-page-row:has\([^)]*\)\s*\{([^}]*)\}/);
  assert.ok(row && /position\s*:\s*relative/.test(row[1]) && !/flex-direction/.test(row[1]),
    'the RTL .rga-page-row rule must set position:relative and NOT flex-direction');
});

test('B: Slice 4 — vertical scene rail retired; .rga-scene-v3 declares no inline-start border or rail padding', () => {
  const css = read(EDITOR_PM_CSS);
  const body = ruleBody(css, '.rga-scene-v3');
  assert.ok(body, '.rga-scene-v3 rule must exist');
  assert.ok(!/border-inline-start\s*:/.test(body) && !/border-left\s*:/.test(body),
    '.rga-scene-v3 must declare no vertical scene rail (Slice 4 retirement — no border-inline-start, no border-left)');
  assert.ok(!/padding-inline-start\s*:/.test(body) && !/padding-left\s*:/.test(body),
    '.rga-scene-v3 must declare no rail-specific inline-start padding (Slice 4 — manuscript text sits directly inside #editor padding)');
});

// ================================================================
// C — page-transition mask band: PX height (font-size:0 safe)
// ================================================================

test('C: Slice 4 — page-transition mask band RETIRED; no ::before rule on the Flow page marker', () => {
  const css = read(EDITOR_PM_CSS);
  const body = ruleBody(css, '#editor-container.view-flow .rga-page-marker::before');
  assert.equal(body, null,
    'the Flow .rga-page-marker::before mask rule must be removed — it was painting page-colour over manuscript text adjacent to each page break');
});

test('C: Visual Comfort CLOSED (Option A) — the "Page N" label sits as a quiet hint in the page inline-end chrome, NOT as a deliberate break marker', () => {
  const css = read(EDITOR_PM_CSS);
  const body = ruleBody(css, '#editor-container.view-flow .rga-page-marker .rga-page-marker-begin');
  assert.ok(body, 'the Flow .rga-page-marker-begin rule must exist');
  // Placement: still in the chrome zone, opposite the line gutter.
  assert.ok(/inset-inline-end\s*:\s*-0\.5in/.test(body),
    'the label must be tucked into the page inline-end chrome via inset-inline-end');
  assert.ok(/inset-inline-start\s*:\s*auto/.test(body),
    'the label must override the base rule\'s `left: 50%`');
  assert.ok(/translateY\s*\(\s*-50%\s*\)/.test(body),
    'the label must translateY(-50%) — vertically aligned on the boundary');
  // Hint, not chrome: no capsule signals.
  assert.ok(/background\s*:\s*transparent/.test(body),
    'the label must be transparent — no background fill (capsule retired per Option A doctrine)');
  assert.ok(!/border\s*:\s*\d+px/.test(body),
    'the label must declare no border (capsule retired per Option A doctrine)');
  assert.ok(!/border-radius\s*:/.test(body),
    'the label must declare no border-radius (capsule retired per Option A doctrine)');
  assert.ok(!/text-transform\s*:\s*uppercase/.test(body),
    'the label must NOT be uppercase (uppercase reads as chrome assertion — Option A demands hint voice)');
  // No editor-page-bg mask (the Slice 3 rule that hid text).
  assert.ok(!/background\s*:\s*var\(\s*--editor-page-bg/.test(body),
    'the label must NOT paint with --editor-page-bg (that was the Slice 3 mask colour that hid manuscript text)');
});

test('C: Visual Comfort CLOSED (Option A) — no horizontal hairline crosses the manuscript in Flow', () => {
  const css = read(EDITOR_PM_CSS);
  const body = ruleBody(css, '#editor-container.view-flow .rga-page-marker .rga-page-marker-rule');
  assert.equal(body, null,
    'the Flow .rga-page-marker-rule rule must be removed — a 1px line crossing the manuscript reads as a page seam, which contradicts Option A (Flow is a continuous drafting surface; page truth lives in Print Preview)');
});

// ================================================================
// D — scene hierarchy: non-collapsing padding separation
// ================================================================

test('D: scene separation uses non-collapsing padding (px), not collapse-prone margins', () => {
  const css = read(EDITOR_PM_CSS);
  const scene = ruleBody(css, '.rga-scene-v3');
  assert.ok(scene && /padding\s*:\s*18px\s+0/.test(scene),
    '.rga-scene-v3 must use padding: 18px 0 — guaranteed, non-collapsing separation');
  const content = ruleBody(css, '.rga-scene-v3-content');
  assert.ok(content && /padding-top\s*:\s*\d+px/.test(content),
    '.rga-scene-v3-content must use a px padding-top — non-collapsing gap below the scene heading');
});
