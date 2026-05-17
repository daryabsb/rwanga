// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Bundle 1 §B — sidebar consistency pass.
// Locks: one unified empty-state class/DOM/CSS pattern across every
// sidebar panel; copy revisions remove debug/version wording.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const SHELL_CSS = path.join(REPO, 'renderer/css/shell.css');
const PANELS_DIR = path.join(REPO, 'renderer/js/shell/panels');
const SIDEBAR_JS = path.join(REPO, 'renderer/js/shell/sidebar.js');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function ruleBody(css, selectorLiteral) {
  const escaped = selectorLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp('(?:^|\\n)\\s*' + escaped + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}

// ----------------------------------------------------------------
// §B.1 — One unified CSS pattern
// ----------------------------------------------------------------

test('Bundle 1 §B: unified .rga-shell-panel-empty CSS rule exists with title/body/actions sub-classes', () => {
  const css = read(SHELL_CSS);
  ['.rga-shell-panel-empty',
   '.rga-shell-panel-empty-title',
   '.rga-shell-panel-empty-body',
   '.rga-shell-panel-empty-actions',
   '.rga-shell-panel-empty-action'].forEach(function(sel) {
    assert.ok(ruleBody(css, sel),
      'shell.css must define ' + sel + ' (Bundle 1 §B unified empty-state pattern)');
  });
});

test('Bundle 1 §B: deleted .rga-shell-scene-navigator-empty CSS rule (subsumed by unified pattern)', () => {
  const css = read(SHELL_CSS);
  assert.equal(ruleBody(css, '.rga-shell-scene-navigator-empty'), null,
    '.rga-shell-scene-navigator-empty rule must be removed — its job is now the unified .rga-shell-panel-empty');
});

test('Bundle 1 §B: unified empty-state uses existing tokens only (no new ones, no raw colors outside fallbacks)', () => {
  const css = read(SHELL_CSS);
  const body = ruleBody(css, '.rga-shell-panel-empty');
  assert.ok(body);
  // color: must use var(--text-*) tokens; raw hex is only acceptable
  // as a fallback to var() (the comma-form `var(--x, #fallback)`).
  const colorDecl = body.match(/color\s*:\s*([^;]+);/);
  assert.ok(colorDecl, '.rga-shell-panel-empty must declare a color');
  assert.ok(/var\(\s*--text-/.test(colorDecl[1]),
    '.rga-shell-panel-empty color must use a --text-* token (no new colors). Got: ' + colorDecl[1]);
});

// ----------------------------------------------------------------
// §B.2 — Sidebar owns the helper
// ----------------------------------------------------------------

test('Bundle 1 §B: Rga.Shell.Sidebar.renderEmpty is the single owner of the empty-state DOM shape', () => {
  const src = read(SIDEBAR_JS);
  assert.ok(/function\s+renderEmpty\b/.test(src),
    'sidebar.js must define renderEmpty (the unified DOM builder)');
  assert.ok(/Rga\.Shell\.Sidebar\.renderEmpty\s*=\s*renderEmpty/.test(src),
    'sidebar.js must export renderEmpty on Rga.Shell.Sidebar (so panels can call it)');
  // The builder emits the .rga-shell-panel-empty-* class set.
  assert.ok(/rga-shell-panel-empty-title/.test(src),
    'renderEmpty must build the .rga-shell-panel-empty-title segment');
  assert.ok(/rga-shell-panel-empty-body/.test(src),
    'renderEmpty must build the .rga-shell-panel-empty-body segment');
  assert.ok(/rga-shell-panel-empty-action/.test(src),
    'renderEmpty must build optional .rga-shell-panel-empty-action buttons (Workspace Retry consumer)');
});

// ----------------------------------------------------------------
// §B.3 — Every panel uses the helper (no inline empty-state DOM)
// ----------------------------------------------------------------

test('Bundle 1 §B: every panel call site uses Rga.Shell.Sidebar.renderEmpty (no inline duplication)', () => {
  // Panels that have an empty/unavailable/error path.
  const PANELS_WITH_EMPTY = [
    'search.js', 'characters.js', 'revisions.js', 'settings.js',
    'scene-navigator.js', 'script-workspace.js'
  ];
  PANELS_WITH_EMPTY.forEach(function(file) {
    const src = read(path.join(PANELS_DIR, file));
    assert.ok(/Rga\.Shell\.Sidebar\.renderEmpty\(/.test(src),
      file + ' must call Rga.Shell.Sidebar.renderEmpty (Bundle 1 §B: unified call site)');
  });
});

test('Bundle 1 §B: no panel still emits the deprecated empty-state class names', () => {
  const PANEL_FILES = fs.readdirSync(PANELS_DIR).filter(function(f) {
    return f.endsWith('.js');
  });
  const DEPRECATED = [
    'rga-shell-panel-placeholder',
    'rga-shell-scene-navigator-empty',
    'rga-shell-workspace-empty',
    'rga-shell-workspace-error',
    'rga-shell-workspace-retry'
  ];
  PANEL_FILES.forEach(function(file) {
    const src = read(path.join(PANELS_DIR, file));
    DEPRECATED.forEach(function(cls) {
      assert.equal(src.indexOf(cls), -1,
        file + ' must not reference the deprecated class "' + cls + '"');
    });
  });
});

// ----------------------------------------------------------------
// §B.4 — Copy rules: no debug/version/internal-cross-reference wording
// ----------------------------------------------------------------

test('Bundle 1 §B: no panel copy contains "arrives in 0.2" or "coming in 0.2"', () => {
  const PANEL_FILES = fs.readdirSync(PANELS_DIR).filter(function(f) {
    return f.endsWith('.js');
  });
  const FORBIDDEN = [
    /arrives in 0\.2/i,
    /coming in 0\.2/i,
    /comes in 0\.2/i,
    /0\.2/i,
    /0\.3\+/i
  ];
  PANEL_FILES.forEach(function(file) {
    const src = read(path.join(PANELS_DIR, file));
    // Strip JS comments before checking — version notes in /* */ blocks
    // (e.g., Outline panel's "no AI judgment" comment) are not user copy.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    FORBIDDEN.forEach(function(re) {
      assert.equal(re.test(stripped), false,
        file + ' must not contain ' + re + ' in user-visible strings (Bundle 1 §B copy rules)');
    });
  });
});

test('Bundle 1 §B: removed cross-references — "Breakdown tab in the Bottom Panel" / "Storage in Settings" / "~/.rwanga/settings.json"', () => {
  const PANEL_FILES = fs.readdirSync(PANELS_DIR).filter(function(f) {
    return f.endsWith('.js');
  });
  const FORBIDDEN = [
    /Breakdown tab in the Bottom Panel/,
    /Storage in Settings/,
    /~\/\.rwanga\/settings\.json/
  ];
  PANEL_FILES.forEach(function(file) {
    const src = read(path.join(PANELS_DIR, file));
    FORBIDDEN.forEach(function(re) {
      assert.equal(re.test(src), false,
        file + ' must not contain the cross-reference ' + re + ' (Bundle 1 §B copy rules)');
    });
  });
});

test('Bundle 1 §B: writer-voice copy adopted per the plan table', () => {
  const expected = {
    'search.js':     /Search across your scripts will live here/,
    'characters.js': /Your characters will appear here as you write/,
    'revisions.js':  /Revisions will let you see every change you made/,
    'settings.js':   /Settings will live here/
  };
  Object.keys(expected).forEach(function(file) {
    const src = read(path.join(PANELS_DIR, file));
    assert.ok(expected[file].test(src),
      file + ' must use the approved writer-voice copy (Bundle 1 §B copy rules)');
  });
});
