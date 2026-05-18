// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Final Micro Polish (Shell Lock pre-flight) — invariant guards.
//
// §A — Tab readability: preferred width bumped so normal filenames
//      don't ellipsize too early. Shrink behaviour intact.
// §B — Toolbar instrument weight: resting color promoted to
//      --text-primary; base font-weight: 500. No geometry change.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const COMPONENTS_CSS = path.join(REPO, 'renderer/css/components.css');
const SHELL_CSS      = path.join(REPO, 'renderer/css/shell.css');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function ruleBody(css, selector) {
  const re = new RegExp(selector.source + '\\s*\\{([^}]*)\\}');
  const m = css.match(re);
  return m ? m[1] : null;
}

// ----------------------------------------------------------------
// §A — Tab readability
// ----------------------------------------------------------------

test('Polish §A: .tab min-width bumped to 160px (readable baseline; ≥ 160 to allow future bumps)', () => {
  const css = read(COMPONENTS_CSS);
  const body = ruleBody(css, /\.tab(?![\w-])/);
  assert.ok(body, '.tab rule must exist');
  const minWidth = body.match(/min-width\s*:\s*(\d+)px/);
  assert.ok(minWidth, '.tab must declare min-width');
  assert.ok(parseInt(minWidth[1], 10) >= 160,
    '.tab min-width must be ≥ 160px (Polish §A — normal filenames should not truncate early). Got: ' + minWidth[1] + 'px');
});

test('Polish §A: .tab max-width bumped to 240px (natural ellipsis breakpoint; ≥ 240)', () => {
  const css = read(COMPONENTS_CSS);
  const body = ruleBody(css, /\.tab(?![\w-])/);
  assert.ok(body, '.tab rule must exist');
  const maxWidth = body.match(/max-width\s*:\s*(\d+)px/);
  assert.ok(maxWidth, '.tab must declare max-width');
  assert.ok(parseInt(maxWidth[1], 10) >= 240,
    '.tab max-width must be ≥ 240px (Polish §A — longer names ellipsize at a natural breakpoint). Got: ' + maxWidth[1] + 'px');
});

test('Polish §A: .tab keeps flex-shrink: 0 (multi-tab shrink behaviour intact via tab-bar scroll)', () => {
  const css = read(COMPONENTS_CSS);
  const body = ruleBody(css, /\.tab(?![\w-])/);
  assert.ok(body);
  assert.ok(/flex-shrink\s*:\s*0/.test(body),
    '.tab must keep flex-shrink: 0 — multi-tab pressure spills via #tab-bar overflow-x: auto, not by squeezing tabs below min-width');
});

test('Polish §A: .tab-title still truncates (single line, ellipsis preserved)', () => {
  const css = read(COMPONENTS_CSS);
  const body = ruleBody(css, /\.tab-title/);
  assert.ok(body, '.tab-title rule must exist');
  assert.ok(/overflow\s*:\s*hidden/.test(body), '.tab-title must keep overflow: hidden');
  assert.ok(/text-overflow\s*:\s*ellipsis/.test(body), '.tab-title must keep text-overflow: ellipsis');
  assert.ok(/white-space\s*:\s*nowrap/.test(body), '.tab-title must keep white-space: nowrap');
});

test('Polish §A: .tab-dirty marker preserved (dirty indicator not collapsed)', () => {
  const css = read(COMPONENTS_CSS);
  const body = ruleBody(css, /\.tab-dirty/);
  assert.ok(body, '.tab-dirty rule must still exist after width bump');
});

// ----------------------------------------------------------------
// §B — Toolbar instrument visual weight
// ----------------------------------------------------------------

test('Polish §B: .rga-shell-toolbar-btn rests at --text-primary (resting color promoted from --text-secondary)', () => {
  const css = read(SHELL_CSS);
  // Match the base .rga-shell-toolbar-btn rule (not :hover / .active /
  // [data-command=...] variants).
  const body = ruleBody(css, /\.rga-shell-toolbar-btn(?![-:\.\[])/);
  assert.ok(body, '.rga-shell-toolbar-btn base rule must exist');
  // The first color declaration in the base rule is what applies at
  // rest. Must reference --text-primary.
  const colorDecl = body.match(/color\s*:\s*[^;]+;/);
  assert.ok(colorDecl, '.rga-shell-toolbar-btn must declare a base color');
  assert.ok(/var\(\s*--text-primary\b/.test(colorDecl[0]),
    '.rga-shell-toolbar-btn must rest at var(--text-primary) so glyphs read against the chrome — Polish §B. Got: ' + colorDecl[0].trim());
});

test('Polish §B: .rga-shell-toolbar-btn base font-weight: 500 (medium; bold override still wins for B)', () => {
  const css = read(SHELL_CSS);
  const body = ruleBody(css, /\.rga-shell-toolbar-btn(?![-:\.\[])/);
  assert.ok(body, '.rga-shell-toolbar-btn base rule must exist');
  const fontWeight = body.match(/font-weight\s*:\s*(\d+)/);
  assert.ok(fontWeight, '.rga-shell-toolbar-btn must declare base font-weight');
  assert.equal(parseInt(fontWeight[1], 10), 500,
    '.rga-shell-toolbar-btn must declare font-weight: 500 (medium — Polish §B visual weight bump)');
  // Bold button override must still exist (text.bold = 700).
  assert.ok(/data-command="text\.bold"\][\s\S]{0,80}font-weight\s*:\s*700/.test(css),
    'text.bold button must still declare font-weight: 700 — overrides the base 500 medium');
});

test('Polish §B: toolbar geometry unchanged (button still 30×30, font-size 14px, --text variant 13px, toolbar 36px)', () => {
  const css = read(SHELL_CSS);
  const body = ruleBody(css, /\.rga-shell-toolbar-btn(?![-:\.\[])/);
  assert.ok(body);
  assert.ok(/width\s*:\s*30px/.test(body),
    '.rga-shell-toolbar-btn must still declare width: 30px (no geometry change)');
  assert.ok(/height\s*:\s*30px/.test(body),
    '.rga-shell-toolbar-btn must still declare height: 30px (no geometry change)');
  assert.ok(/font-size\s*:\s*14px/.test(body),
    '.rga-shell-toolbar-btn must still declare font-size: 14px (no geometry change)');
  // --text variant: still 13px.
  const textBody = ruleBody(css, /\.rga-shell-toolbar-btn--text/);
  assert.ok(textBody);
  assert.ok(/font-size\s*:\s*13px/.test(textBody),
    '.rga-shell-toolbar-btn--text must still declare font-size: 13px (no geometry change)');
  // Toolbar shell still 36px tall.
  const shellBody = ruleBody(css, /#rga-shell-toolbar\.rga-shell-toolbar/);
  assert.ok(shellBody);
  assert.ok(/height\s*:\s*36px/.test(shellBody),
    '#rga-shell-toolbar must still declare height: 36px (no toolbar geometry regression)');
});

test('Polish §B: .rga-shell-toolbar-inner manuscript alignment preserved', () => {
  const css = read(SHELL_CSS);
  const body = ruleBody(css, /\.rga-shell-toolbar-inner/);
  assert.ok(body);
  assert.ok(/var\(\s*--page-width/.test(body),
    '.rga-shell-toolbar-inner must still consume var(--page-width) — manuscript alignment preserved');
  assert.ok(/grid-column\s*:\s*4/.test(body),
    '.rga-shell-toolbar-inner must still declare grid-column: 4 — manuscript alignment preserved');
});

// ----------------------------------------------------------------
// Final Final Polish — content-aware sizing for three classes
// ----------------------------------------------------------------

test('Final Final Polish: text instruments get breathing-room padding (≥ 14px each side)', () => {
  const css = read(SHELL_CSS);
  const body = ruleBody(css, /\.rga-shell-toolbar-btn--text/);
  assert.ok(body, '.rga-shell-toolbar-btn--text rule must exist');
  const padding = body.match(/padding\s*:\s*0\s+(\d+)px/);
  assert.ok(padding, '.rga-shell-toolbar-btn--text must declare padding shorthand "0 Npx"');
  assert.ok(parseInt(padding[1], 10) >= 14,
    'text instruments must have horizontal padding ≥ 14px so + Scene / Note / Flag / Undo / Redo / Screenplay / Text feel centred. Got: ' + padding[1] + 'px');
});

test('Final Final Polish: dropdown instruments promoted to --text-primary (color harmony with icons/text)', () => {
  const css = read(SHELL_CSS);
  ['rga-shell-toolbar-blocktype', 'rga-shell-toolbar-tag'].forEach(function(cls) {
    const body = ruleBody(css, new RegExp('\\.' + cls + '(?![-\\w])'));
    assert.ok(body, '.' + cls + ' rule must exist');
    const colorDecl = body.match(/color\s*:\s*[^;]+;/);
    assert.ok(colorDecl, '.' + cls + ' must declare a color');
    assert.ok(/var\(\s*--text-primary\b/.test(colorDecl[0]),
      '.' + cls + ' must rest at var(--text-primary) — visual harmony with icon + text instruments. Got: ' + colorDecl[0].trim());
  });
});

test('Final Final Polish: dropdown instruments get content-aware padding (≥ 8px each side)', () => {
  const css = read(SHELL_CSS);
  ['rga-shell-toolbar-blocktype', 'rga-shell-toolbar-tag'].forEach(function(cls) {
    const body = ruleBody(css, new RegExp('\\.' + cls + '(?![-\\w])'));
    assert.ok(body);
    const padding = body.match(/padding\s*:\s*0\s+(\d+)px/);
    assert.ok(padding, '.' + cls + ' must declare padding shorthand "0 Npx"');
    assert.ok(parseInt(padding[1], 10) >= 8,
      '.' + cls + ' must have horizontal padding ≥ 8px — Block ▾ + Tag ▾ need room for their content + native chrome arrow. Got: ' + padding[1] + 'px');
  });
});

test('Final Final Polish: dropdown font-size harmonised with text instruments (13px)', () => {
  const css = read(SHELL_CSS);
  ['rga-shell-toolbar-blocktype', 'rga-shell-toolbar-tag'].forEach(function(cls) {
    const body = ruleBody(css, new RegExp('\\.' + cls + '(?![-\\w])'));
    assert.ok(body);
    const fontSize = body.match(/font-size\s*:\s*(\d+)px/);
    assert.ok(fontSize, '.' + cls + ' must declare font-size');
    assert.equal(parseInt(fontSize[1], 10), 13,
      '.' + cls + ' must declare font-size: 13px — matches the text-variant buttons for visual harmony');
  });
});

test('Toolbar single-line: .rga-shell-toolbar-btn declares white-space: nowrap (prevents "+ Scene" two-line wrap)', () => {
  const css = read(SHELL_CSS);
  const body = ruleBody(css, /\.rga-shell-toolbar-btn(?![-:\.\[])/);
  assert.ok(body, '.rga-shell-toolbar-btn base rule must exist');
  assert.ok(/white-space\s*:\s*nowrap/.test(body),
    '.rga-shell-toolbar-btn must declare white-space: nowrap so text labels stay on one line ("+ Scene" was wrapping inside the 30px button height)');
});

test('Toolbar Tag dropdown: constrained width closes the placeholder-to-arrow gap', () => {
  const css = read(SHELL_CSS);
  const body = ruleBody(css, /\.rga-shell-toolbar-tag(?![-\w])/);
  assert.ok(body, '.rga-shell-toolbar-tag rule must exist');
  // Native <select> auto-width = widest option (~96px for "Wardrobe");
  // an explicit width caps the displayed select to placeholder size
  // while the popup list still expands to natural option widths.
  const widthDecl = body.match(/(?:^|[\s;])width\s*:\s*(\d+)px/);
  assert.ok(widthDecl,
    '.rga-shell-toolbar-tag must declare an explicit pixel width to constrain the native <select> from sizing to its widest option');
  const w = parseInt(widthDecl[1], 10);
  assert.ok(w >= 70 && w <= 100,
    '.rga-shell-toolbar-tag width must be ~80px (room for "Tag…" placeholder + native arrow). Got: ' + w + 'px');
});

test('Final Final Polish: toolbar HEIGHT unchanged (36px) — no geometry regression', () => {
  const css = read(SHELL_CSS);
  const shellBody = ruleBody(css, /#rga-shell-toolbar\.rga-shell-toolbar/);
  assert.ok(shellBody);
  assert.ok(/height\s*:\s*36px/.test(shellBody),
    '#rga-shell-toolbar must still declare height: 36px (no toolbar height regression after content-aware sizing)');
  const btnBody = ruleBody(css, /\.rga-shell-toolbar-btn(?![-:\.\[])/);
  assert.ok(btnBody);
  assert.ok(/height\s*:\s*30px/.test(btnBody),
    '.rga-shell-toolbar-btn must still declare height: 30px (only horizontal sizing varies between classes)');
});
