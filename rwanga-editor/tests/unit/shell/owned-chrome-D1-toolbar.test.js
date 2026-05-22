// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Studio Shell Recovery — Workstream D, Slice D1 (owned toolbar Row 3
// — Text-tools group only).
//
// Invariants:
//   1. #rga-shell-toolbar exists in index.html, between #rga-shell-menubar
//      and #workspace.
//   2. The inline #format-toolbar (pre-§D1) is gone.
//   3. Eight Text-tools buttons live inside the toolbar with
//      data-command="text.{bold,italic,underline,strikethrough,color,
//      highlight,link,clear}".
//   4. Toolbar declares -webkit-app-region: drag; every button declares
//      -webkit-app-region: no-drag (drag-island invariant — extends
//      §A's G-OC-6 to the new surface).
//   5. Draft + Print Preview hide rules cover the new toolbar.
//   6. #app grid template grew one track (auto auto auto 1fr STATUS).
//   7. KR.registerCommand calls for the 8 text commands exist in
//      format-toolbar.js.
//   8. Button click delegation invokes via KR.invokeCommand (no
//      hardcoded mark→handler tables on the new toolbar).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const INDEX_HTML = path.join(REPO, 'renderer/index.html');
const SHELL_CSS  = path.join(REPO, 'renderer/css/shell.css');
const FORMAT_TOOLBAR_JS = path.join(REPO, 'renderer/js/format-toolbar.js');

function read(p) { return fs.readFileSync(p, 'utf8'); }

const TEXT_COMMANDS = [
  'text.bold', 'text.italic', 'text.underline', 'text.strikethrough',
  'text.color', 'text.highlight', 'text.link', 'text.clear'
];

// ----------------------------------------------------------------
// 1. Row 3 surface
// ----------------------------------------------------------------

test('§D1: #rga-shell-toolbar exists in index.html with role="toolbar"', () => {
  const html = read(INDEX_HTML);
  assert.ok(/<div\s+id="rga-shell-toolbar"[^>]*role="toolbar"/.test(html),
    'index.html must declare <div id="rga-shell-toolbar" role="toolbar" …>');
  assert.ok(/aria-label\s*=\s*['"][^'"]+['"]/.test(html.match(/<div\s+id="rga-shell-toolbar"[^>]*>/)[0]),
    'toolbar must declare an aria-label');
});

test('§D1: Row 3 sits BETWEEN #rga-shell-menubar and #workspace in DOM order', () => {
  const html = read(INDEX_HTML);
  const menubarIdx  = html.indexOf('id="rga-shell-menubar"');
  const toolbarIdx  = html.indexOf('id="rga-shell-toolbar"');
  const workspaceIdx = html.indexOf('id="workspace"');
  assert.ok(menubarIdx > 0 && toolbarIdx > 0 && workspaceIdx > 0);
  assert.ok(menubarIdx < toolbarIdx,  '#rga-shell-toolbar must appear AFTER #rga-shell-menubar');
  assert.ok(toolbarIdx < workspaceIdx, '#rga-shell-toolbar must appear BEFORE #workspace');
});

// ----------------------------------------------------------------
// 2. The inline #format-toolbar pre-§D1 element is gone
// ----------------------------------------------------------------

test('§D1: inline <div id="format-toolbar"> is deleted (replaced by Row 3)', () => {
  const html = read(INDEX_HTML);
  assert.equal(/<div\s+id="format-toolbar"/.test(html), false,
    'pre-§D1 inline <div id="format-toolbar"> must be deleted — text tools live in #rga-shell-toolbar (Row 3) now');
});

// ----------------------------------------------------------------
// 3. Eight Text-tools buttons exist with the expected commands
// ----------------------------------------------------------------

test('§D1: toolbar declares 8 Text-tools buttons via data-command', () => {
  const html = read(INDEX_HTML);
  // Extract the toolbar root and its inner content.
  const toolbarMatch = html.match(/<div\s+id="rga-shell-toolbar"[\s\S]*?<\/div>\s*<\/div>/);
  // Just collect every data-command attribute under .rga-shell-toolbar-btn — order matters.
  const re = /<button[^>]*class="[^"]*rga-shell-toolbar-btn[^"]*"[^>]*data-command="([^"]+)"/g;
  const commands = [];
  let m;
  while ((m = re.exec(html)) !== null) commands.push(m[1]);
  // The 8 text commands must all be present (order within the toolbar
  // is not asserted beyond data-command presence — visual order is
  // checked manually).
  TEXT_COMMANDS.forEach(function(cmd) {
    assert.ok(commands.indexOf(cmd) >= 0,
      'toolbar must include a button with data-command="' + cmd + '"');
  });
});

// ----------------------------------------------------------------
// 4. Drag region + no-drag islands (G-OC-6 extended to Row 3)
// ----------------------------------------------------------------

test('§D1: toolbar declares -webkit-app-region: drag', () => {
  const css = read(SHELL_CSS);
  const m = css.match(/#rga-shell-toolbar\.rga-shell-toolbar\s*\{[^}]*-webkit-app-region\s*:\s*drag/);
  assert.ok(m,
    '#rga-shell-toolbar must declare -webkit-app-region: drag (G-OC-6 — drag surface)');
});

test('§D1: .rga-shell-toolbar-btn declares -webkit-app-region: no-drag (drag-island invariant)', () => {
  const css = read(SHELL_CSS);
  const m = css.match(/\.rga-shell-toolbar-btn\s*\{[^}]*-webkit-app-region\s*:\s*no-drag/);
  assert.ok(m,
    '.rga-shell-toolbar-btn must declare -webkit-app-region: no-drag (G-OC-6 invariant)');
});

// ----------------------------------------------------------------
// 5. Hide rules for Draft + Print Preview
// ----------------------------------------------------------------

test('§D1: Draft view hides Row 3 toolbar', () => {
  const css = read(SHELL_CSS);
  assert.ok(/body\.view-draft-active\s+#rga-shell-toolbar\s*\{[^}]*display\s*:\s*none/.test(css),
    'Draft view must hide #rga-shell-toolbar (distraction-free promise)');
});

test('§D1: Print Preview hides Row 3 toolbar', () => {
  const css = read(SHELL_CSS);
  assert.ok(/body\.view-print-preview-active\s+#rga-shell-toolbar\s*\{[^}]*display\s*:\s*none/.test(css),
    'Print Preview must hide #rga-shell-toolbar (preview is the sole foreground)');
});

// ----------------------------------------------------------------
// 6. #app grid template grew one track
// ----------------------------------------------------------------

test('§D1: #app grid template has 5 tracks (auto auto auto 1fr STATUS)', () => {
  const css = read(SHELL_CSS);
  const ruleMatch = css.match(/#app\s*\{[^}]*\}/);
  assert.ok(ruleMatch, '#app rule must exist');
  const tplMatch = ruleMatch[0].match(/grid-template-rows\s*:\s*([^;]+);/);
  assert.ok(tplMatch, '#app must declare grid-template-rows');
  const value = tplMatch[1].trim();
  // Count tracks (var(...) groups count as one).
  let depth = 0, buf = '', tracks = [];
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ' ' && depth === 0) { if (buf.trim()) tracks.push(buf.trim()); buf = ''; }
    else buf += ch;
  }
  if (buf.trim()) tracks.push(buf.trim());
  assert.equal(tracks.length, 5,
    '#app must have 5 grid tracks (titlebar / menubar / toolbar / workspace 1fr / status). Got: [' + value + ']');
  // First three must be auto (chrome rows owned by their elements' heights).
  assert.equal(tracks[0], 'auto');
  assert.equal(tracks[1], 'auto');
  assert.equal(tracks[2], 'auto');
  // Fourth = 1fr (workspace expansion).
  assert.equal(tracks[3], '1fr');
});

// ----------------------------------------------------------------
// 7. KR.registerCommand for the 8 text commands
// ----------------------------------------------------------------

test('§D1: format-toolbar.js registers the 8 text commands via KR.registerCommand', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  TEXT_COMMANDS.forEach(function(cmd) {
    const re = new RegExp("registerCommand\\(\\{[^}]*command:\\s*['\"]" + cmd.replace('.', '\\.') + "['\"]");
    assert.ok(re.test(src),
      'format-toolbar.js must call registerCommand({ command: "' + cmd + '", ... })');
  });
});

test('§D1: text.bold + text.italic declare displayAccelerator (PM keymap binds the actual keys)', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  // The PM editor keymap binds Mod-b / Mod-i (renderer/js/editor/mount.js).
  // KR registration uses displayAccelerator so the toolbar shows the
  // label without conflicting with view.toggleSidebar (Ctrl+B).
  assert.ok(/command:\s*['"]text\.bold['"][\s\S]{0,200}displayAccelerator:\s*['"]Ctrl\+B['"]/.test(src),
    'text.bold must declare displayAccelerator: "Ctrl+B"');
  assert.ok(/command:\s*['"]text\.italic['"][\s\S]{0,200}displayAccelerator:\s*['"]Ctrl\+I['"]/.test(src),
    'text.italic must declare displayAccelerator: "Ctrl+I"');
});

// ----------------------------------------------------------------
// 8. Click delegation routes through KR.invokeCommand
// ----------------------------------------------------------------

test('§D1: Row 3 click delegation routes to Rga.KeyboardRegistry.invokeCommand', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  // The init() function attaches ONE click listener to the toolbar
  // root, reading data-command and dispatching via KR.
  assert.ok(/getElementById\(\s*['"]rga-shell-toolbar['"]\s*\)/.test(src),
    'format-toolbar.js must reference the new #rga-shell-toolbar element');
  assert.ok(/btn\.dataset\.command/.test(src),
    'click delegation must read btn.dataset.command');
  assert.ok(/KR\.invokeCommand\s*\(\s*btn\.dataset\.command\s*\)/.test(src),
    'click handler must call KR.invokeCommand(btn.dataset.command) — §A4.1 SSOT routing');
});

// ----------------------------------------------------------------
// 9. §A4.1 accelerator audit still passes (no duplicates introduced)
// ----------------------------------------------------------------

test('§D1: no text command claims a KR keyboard binding (Ctrl+B is PM-owned; KR ownership would conflict with view.toggleSidebar)', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  // The 8 text commands must NOT pass `key:` to registerCommand —
  // displayAccelerator is the label channel; no KR keyboard binding.
  TEXT_COMMANDS.forEach(function(cmd) {
    const block = src.match(new RegExp("registerCommand\\(\\{[^}]*command:\\s*['\"]" + cmd.replace('.', '\\.') + "['\"][^}]*\\}\\)"));
    if (!block) return;  // command not present is caught by an earlier test
    assert.equal(/\bkey\s*:\s*['"]/.test(block[0]), false,
      'text command "' + cmd + '" must NOT declare a KR keyboard binding (key: …) — PM keymap owns Ctrl+B/I; the others have no accelerator. KR-side binding would conflict with another command in the registry.');
  });
});

// ----------------------------------------------------------------
// §D1.1 — Manuscript-alignment correction (toolbar inner band)
// ----------------------------------------------------------------

test('§D1.1: --page-width token is the single source of manuscript geometry', () => {
  const TOKENS_CSS = path.join(REPO, 'renderer/css/tokens.css');
  const tokensCss  = read(TOKENS_CSS);
  // Token defined in :root / dark theme block (no light-theme override
  // needed — geometry doesn't theme).
  assert.ok(/--page-width\s*:\s*8\.5in/.test(tokensCss),
    'tokens.css must define --page-width: 8.5in');
});

test('§D1.1: #editor consumes --page-width (no hardcoded 8.5in literal)', () => {
  const EDITOR_CSS = path.join(REPO, 'renderer/css/editor-prosemirror.css');
  const css = read(EDITOR_CSS);
  // Fork A (Brick 4+5): #editor (no longer the `.rga-page` paper class) is
  // the manuscript column; its width must still come from var(--page-width).
  const baseRule = css.match(/(?:^|\n)\s*#editor\s*\{[^}]*\}/);
  assert.ok(baseRule, '#editor rule must exist');
  assert.ok(/width\s*:\s*var\(\s*--page-width/.test(baseRule[0]),
    '#editor must consume var(--page-width) instead of a hardcoded literal');
});

test('§D1.1: toolbar inner band exists and consumes --page-width', () => {
  const html = read(INDEX_HTML);
  assert.ok(/class="rga-shell-toolbar-inner"/.test(html),
    'index.html must wrap toolbar groups in <div class="rga-shell-toolbar-inner">');
  const shellCss = read(SHELL_CSS);
  const innerRule = shellCss.match(/(?:^|\n)\s*\.rga-shell-toolbar-inner\s*\{[^}]*\}/);
  assert.ok(innerRule, '.rga-shell-toolbar-inner rule must exist');
  assert.ok(/var\(\s*--page-width/.test(innerRule[0]),
    '.rga-shell-toolbar-inner must consume var(--page-width) — single geometry source with .rga-page');
});

test('§D1.1: toolbar uses workspace-style grid columns (alignment with editor-area)', () => {
  const css = read(SHELL_CSS);
  const toolbarRule = css.match(/#rga-shell-toolbar\.rga-shell-toolbar\s*\{[^}]*\}/);
  assert.ok(toolbarRule);
  // Must be a CSS grid mirroring workspace's column template.
  assert.ok(/display\s*:\s*grid/.test(toolbarRule[0]),
    '#rga-shell-toolbar must be display: grid (column-mirror of #workspace)');
  // Columns reference the same tokens workspace uses.
  ['--activity-bar-width', '--sidebar-width', '--inspector-width'].forEach(function(t) {
    assert.ok(toolbarRule[0].indexOf(t) >= 0,
      '#rga-shell-toolbar grid-template-columns must reference ' + t + ' (mirror workspace)');
  });
  // 1fr column for the editor track.
  assert.ok(/1fr/.test(toolbarRule[0]),
    '#rga-shell-toolbar grid must include a 1fr track (the editor column the toolbar inner lives in)');
});

test('§D1.1: toolbar inner lives in grid-column 4 (the 1fr editor track) and centres horizontally', () => {
  const css = read(SHELL_CSS);
  const innerRule = css.match(/\.rga-shell-toolbar-inner\s*\{[^}]*\}/);
  assert.ok(innerRule);
  assert.ok(/grid-column\s*:\s*4/.test(innerRule[0]),
    '.rga-shell-toolbar-inner must declare grid-column: 4 (the editor column)');
  assert.ok(/justify-self\s*:\s*center/.test(innerRule[0]),
    '.rga-shell-toolbar-inner must declare justify-self: center');
});

test('§D1.1: collapsed-state mirrors keep the toolbar synced with workspace via :has()', () => {
  const css = read(SHELL_CSS);
  // Sidebar-collapsed mirror.
  assert.ok(/#app:has\(#workspace\.sidebar-collapsed\)\s+#rga-shell-toolbar/.test(css),
    'CSS must mirror #workspace.sidebar-collapsed onto #rga-shell-toolbar via :has()');
  // Inspector-hidden mirror.
  assert.ok(/#app:has\(#workspace\.inspector-hidden\)\s+#rga-shell-toolbar/.test(css),
    'CSS must mirror #workspace.inspector-hidden onto #rga-shell-toolbar via :has()');
});
