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
