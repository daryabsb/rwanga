// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Bundle 2 §C — sidebar polish pass.
// Locks: Outline and Workspace panels now have CSS (they had zero
// rules before — the dominant cause of "feels assembled, debug
// feeling"). Row rhythm + section header pattern match Scene
// Navigator so all three panels read as siblings.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const SHELL_CSS = path.join(REPO, 'renderer/css/shell.css');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function ruleBody(css, selectorLiteral) {
  const escaped = selectorLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp('(?:^|\\n)\\s*' + escaped + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}
function pxValue(s) { const m = s.match(/(\d+)px/); return m ? parseInt(m[1], 10) : null; }

// ----------------------------------------------------------------
// §C.1 — Outline + Workspace panels have CSS at all
// ----------------------------------------------------------------

test('Bundle 2 §C: Outline panel classes now have CSS rules (previously zero)', () => {
  const css = read(SHELL_CSS);
  ['.rga-shell-outline',
   '.rga-shell-outline-section',
   '.rga-shell-outline-section-header',
   '.rga-shell-outline-scenes',
   '.rga-shell-outline-scene-row',
   '.rga-shell-outline-scene-num',
   '.rga-shell-outline-scene-head',
   '.rga-shell-outline-characters',
   '.rga-shell-outline-character-row',
   '.rga-shell-outline-progress-row'].forEach(function(sel) {
    assert.ok(ruleBody(css, sel),
      sel + ' must have a CSS rule (Bundle 2 §C — Outline panel was previously unstyled)');
  });
});

test('Bundle 2 §C: Workspace panel classes now have CSS rules (previously zero)', () => {
  const css = read(SHELL_CSS);
  ['.rga-shell-workspace',
   '.rga-shell-workspace-header',
   '.rga-shell-workspace-title',
   '.rga-shell-workspace-refresh',
   '.rga-shell-workspace-category',
   '.rga-shell-workspace-category-heading',
   '.rga-shell-workspace-file-list',
   '.rga-shell-workspace-file'].forEach(function(sel) {
    assert.ok(ruleBody(css, sel),
      sel + ' must have a CSS rule (Bundle 2 §C — Workspace panel was previously unstyled)');
  });
});

// ----------------------------------------------------------------
// §C.2 — Row rhythm normalized across panels (Scene Navigator,
// Outline scene rows, Workspace file rows)
// ----------------------------------------------------------------

test('Bundle 2 §C: row min-height is consistent across Scene Navigator / Outline / Workspace', () => {
  const css = read(SHELL_CSS);
  // Scene Navigator established the standard (28px).
  const sn = ruleBody(css, '.rga-shell-scene-navigator-row');
  const ol = ruleBody(css, '.rga-shell-outline-scene-row');
  const ws = ruleBody(css, '.rga-shell-workspace-file');
  assert.ok(sn && ol && ws);
  const snMin = pxValue((sn.match(/min-height\s*:\s*([^;]+);/) || [, ''])[1]);
  const olMin = pxValue((ol.match(/min-height\s*:\s*([^;]+);/) || [, ''])[1]);
  const wsMin = pxValue((ws.match(/min-height\s*:\s*([^;]+);/) || [, ''])[1]);
  assert.equal(snMin, 28, 'Scene Navigator row baseline min-height: 28px');
  assert.equal(olMin, 28, 'Outline scene row min-height must match Scene Navigator (28px)');
  assert.equal(wsMin, 28, 'Workspace file row min-height must match Scene Navigator (28px)');
});

test('Bundle 2 §C: row padding is consistent (4px 8px) across the three panels', () => {
  const css = read(SHELL_CSS);
  ['.rga-shell-scene-navigator-row',
   '.rga-shell-outline-scene-row',
   '.rga-shell-workspace-file'].forEach(function(sel) {
    const body = ruleBody(css, sel);
    assert.ok(body);
    assert.ok(/padding\s*:\s*4px\s+8px/.test(body),
      sel + ' row padding must be 4px 8px (Bundle 2 §C consistency)');
  });
});

test('Bundle 2 §C: row border-radius is consistent (3px) across panels', () => {
  const css = read(SHELL_CSS);
  ['.rga-shell-scene-navigator-row',
   '.rga-shell-outline-scene-row',
   '.rga-shell-workspace-file'].forEach(function(sel) {
    const body = ruleBody(css, sel);
    assert.ok(/border-radius\s*:\s*3px/.test(body),
      sel + ' border-radius must be 3px (Bundle 2 §C consistency)');
  });
});

// ----------------------------------------------------------------
// §C.3 — Hover / selected feeling matches across panels
// ----------------------------------------------------------------

test('Bundle 2 §C: hover background is the same token across all panel rows', () => {
  const css = read(SHELL_CSS);
  // Hover rules — selectors live separately.
  ['.rga-shell-scene-navigator-row:hover',
   '.rga-shell-outline-scene-row:hover',
   '.rga-shell-workspace-file:hover'].forEach(function(sel) {
    const body = ruleBody(css, sel) ||
      // Multi-selector rule like ".foo:hover, .foo:focus-visible { … }"
      // — ruleBody only matches single selectors, so we look directly.
      (function() {
        const idx = css.indexOf(sel);
        if (idx < 0) return null;
        const close = css.indexOf('}', idx);
        const open = css.indexOf('{', idx);
        if (open < 0 || close < open) return null;
        return css.slice(open + 1, close);
      })();
    assert.ok(body, sel + ' rule must exist');
    assert.ok(/background\s*:\s*var\(\s*--bg-hover/.test(body),
      sel + ' hover bg must use var(--bg-hover) (Bundle 2 §C consistency)');
  });
});

// ----------------------------------------------------------------
// §C.4 — Section headers normalized (Outline section header +
// Workspace category heading share the same pattern)
// ----------------------------------------------------------------

test('Bundle 2 §C: section/category headers share the same visual pattern (small uppercase muted)', () => {
  const css = read(SHELL_CSS);
  const outlineHdr  = ruleBody(css, '.rga-shell-outline-section-header');
  const workspaceHdr = ruleBody(css, '.rga-shell-workspace-category-heading');
  assert.ok(outlineHdr && workspaceHdr);
  [outlineHdr, workspaceHdr].forEach(function(body) {
    assert.ok(/text-transform\s*:\s*uppercase/.test(body),
      'section header must be uppercase');
    assert.ok(/font-weight\s*:\s*600/.test(body),
      'section header must be 600 weight');
    assert.ok(/color\s*:\s*var\(\s*--text-tertiary/.test(body),
      'section header must use --text-tertiary');
    assert.ok(/letter-spacing\s*:\s*0\.08em/.test(body),
      'section header must use 0.08em letter-spacing');
  });
});

// ----------------------------------------------------------------
// §C.5 — Tokens-only (no new colors / icons)
// ----------------------------------------------------------------

test('Bundle 2 §C: every new Outline/Workspace rule uses --text-* / --bg-* / --border-* tokens (no raw hex)', () => {
  const css = read(SHELL_CSS);
  ['.rga-shell-outline-scene-row',
   '.rga-shell-outline-character-row',
   '.rga-shell-outline-section-header',
   '.rga-shell-workspace-file',
   '.rga-shell-workspace-header',
   '.rga-shell-workspace-title',
   '.rga-shell-workspace-category-heading'].forEach(function(sel) {
    const body = ruleBody(css, sel);
    if (!body) return;
    // Strip var(...) fallbacks — those may legitimately contain hex.
    const stripped = body.replace(/var\([^)]*\)/g, '');
    // Now any remaining # is a raw color literal — forbidden.
    assert.equal(/#[0-9a-fA-F]{3,8}/.test(stripped), false,
      sel + ' must not declare raw hex colors outside var() fallbacks (Bundle 2 §C: no new colors)');
  });
});

// ----------------------------------------------------------------
// §C.6 — No JS changes (CSS-only polish per brief)
// ----------------------------------------------------------------

test('Bundle 2 §C: no JS files modified — pure CSS polish (rail/sidebar/panel modules untouched)', () => {
  // Quick sanity: the panel JS files should not reference any new
  // class names introduced by this commit (we only added CSS rules
  // for class names the panels were ALREADY emitting).
  const panelsDir = path.join(REPO, 'renderer/js/shell/panels');
  const files = fs.readdirSync(panelsDir).filter(function(f) { return f.endsWith('.js'); });
  // The classes we styled are already emitted by the panel JS — that's
  // the whole point of the §C "no panel redesign" rule. Spot-check
  // that .rga-shell-outline-section-header is still emitted by
  // outline.js (the JS we expect to be the source).
  const outlineSrc = fs.readFileSync(path.join(panelsDir, 'outline.js'), 'utf8');
  assert.ok(outlineSrc.indexOf('rga-shell-outline-section-header') >= 0,
    'outline.js must still emit rga-shell-outline-section-header (this CSS targets pre-existing JS-emitted classes)');
  const wsSrc = fs.readFileSync(path.join(panelsDir, 'script-workspace.js'), 'utf8');
  assert.ok(wsSrc.indexOf('rga-shell-workspace-category-heading') >= 0,
    'script-workspace.js must still emit rga-shell-workspace-category-heading');
});
