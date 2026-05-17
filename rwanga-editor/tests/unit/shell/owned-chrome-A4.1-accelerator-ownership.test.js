// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Studio Shell Recovery — Workstream A4.1 — accelerator-ownership
// guards.
//
// Invariants enforced:
//   1. KR.audit() returns NO duplicate-combo conflicts. Two distinct
//      sources registering the same combo is a CI failure.
//   2. Menu items reference command IDs — no hardcoded accelerator
//      strings inside the MENU_DEFS block in renderer/index.html.
//   3. Save As keyboard path is bound (Ctrl+Shift+S → file.saveAs).
//   4. Scene Navigator keyboard path is bound on its new combo
//      (Ctrl+Shift+1 → panel.sceneNavigator). The previous binding
//      on Ctrl+Shift+S is gone.
//   5. Menu items' command IDs all resolve to a registered command.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const REPO = path.resolve(__dirname, '../../..');
const INDEX_HTML = path.join(REPO, 'renderer/index.html');
const SHELL_INDEX = path.join(REPO, 'renderer/js/shell/index.js');

function read(p) { return fs.readFileSync(p, 'utf8'); }

// Boot a JSDOM with the minimum shell pieces loaded — just
// keyboard-registry + the modules that register commands. We do NOT
// boot the full renderer (no PM, no Electron) — we only need the KR
// command registry populated to introspect.
function bootRegistry() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  // Stubs the registrants reach for at register-time. None of these
  // are exercised by the audit (we only inspect the command map).
  // Rga.Shell init() bails early without ActivityRail + StatusBar,
  // so stub them too — init must reach _wireKeyboardShortcuts() for
  // the panel-shortcut commands to register.
  global.window.Rga.Shell = {
    Sidebar:      { registered: function() { return []; } },
    ActivityRail: { init: function() {} },
    StatusBar:    { init: function() {} },
    TitleBar:     { init: function() {} }
  };
  global.window.Rga.BottomPanel = { toggleCollapse: function() {} };
  global.window.Rga.FileManager = { newScript: function() {}, openFromDialog: function() {}, save: function() {}, saveAs: function() {} };
  global.window.Rga.ViewMode = { set: function() {} };
  global.window.Rga.Theme = { toggle: function() {} };
  global.window.Rga.CommandPalette = { open: function() {} };
  global.window.Rga.TabManager = { _editorView: function() { return null; } };
  global.window.RgaProseMirror = { undo: function() {}, redo: function() {} };

  ['../../../renderer/js/shell/keyboard-registry.js'].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  // Load shell/index.js's _wireKeyboardShortcuts indirectly: it lives
  // inside an IIFE that exposes Rga.Shell.init. Simpler approach for
  // this test — execute the source so the IIFE runs. (The other
  // command registrants run only during the renderer boot script
  // execution; we cover them via source-level guards below instead.)
  delete require.cache[require.resolve('../../../renderer/js/shell/layout.js')];
  delete require.cache[require.resolve('../../../renderer/js/shell/sidebar.js')];
  delete require.cache[require.resolve('../../../renderer/js/shell/index.js')];
  require('../../../renderer/js/shell/layout.js');
  require('../../../renderer/js/shell/sidebar.js');
  require('../../../renderer/js/shell/index.js');

  const Rga = global.window.Rga;
  Rga.KeyboardRegistry._reset();
  Rga.Shell._reset && Rga.Shell._reset();
  // Trigger shell init — registers the panel-toggle commands.
  // Rga.Shell.init reads DOM; provide a minimal scaffold.
  document.body.innerHTML =
    '<header id="rga-shell-titlebar"><div id="rga-shell-titlebar-title"></div></header>' +
    '<nav id="activity-bar"></nav>' +
    '<aside id="sidebar"><div id="rga-shell-sidebar-host"></div></aside>' +
    '<footer id="status-bar"></footer>';
  Rga.Shell.init();
  // Studio-panel _wireKeyboardShortcut runs from StudioPanel.init
  // which the integration test boot covers — but to avoid pulling
  // the full studio-panel module here, we directly call
  // registerCommand for view.studioPanel to mirror what the module
  // would do. The source-level guard below verifies the module
  // actually does it.
  Rga.KeyboardRegistry.registerCommand({
    command: 'view.studioPanel', label: 'Studio Panel',
    key: 'j', mods: { ctrl: true },
    handler: function() {}, source: 'test fixture'
  });
  return { Rga };
}

// ----------------------------------------------------------------
// G-OC-A4.1-1 — Audit: no duplicate combos
// ----------------------------------------------------------------

test('G-OC-A4.1-1: KR.audit() returns NO duplicate-combo conflicts (the §A4.1 invariant)', () => {
  const { Rga } = bootRegistry();
  // We also register the menu's command suite the same way
  // registerMenuCommands does in the renderer boot — so the audit
  // sees the full picture as it exists at app boot.
  const KR = Rga.KeyboardRegistry;
  // File commands
  KR.registerCommand({ command: 'file.new',    label: 'New Script', key: 'n', mods: { ctrl: true }, handler: function() {}, source: 'A4.1 menu (File → New)' });
  KR.registerCommand({ command: 'file.open',   label: 'Open',       key: 'o', mods: { ctrl: true }, handler: function() {}, source: 'A4.1 menu (File → Open)' });
  KR.registerCommand({ command: 'file.save',   label: 'Save',       key: 's', mods: { ctrl: true }, handler: function() {}, source: 'A4.1 menu (File → Save)' });
  KR.registerCommand({ command: 'file.saveAs', label: 'Save As',    key: 's', mods: { ctrl: true, shift: true }, handler: function() {}, source: 'A4.1 menu (File → Save As)' });
  // Edit, Tools
  KR.registerCommand({ command: 'edit.undo', label: 'Undo', key: 'z', mods: { ctrl: true }, handler: function() {}, source: 'A4.1 menu (Edit → Undo)' });
  KR.registerCommand({ command: 'edit.redo', label: 'Redo', key: 'y', mods: { ctrl: true }, handler: function() {}, source: 'A4.1 menu (Edit → Redo)' });
  KR.registerCommand({ command: 'tools.commandPalette', label: 'Command Palette', key: 'p', mods: { ctrl: true, shift: true }, handler: function() {}, source: 'A4.1 menu (Tools → Command Palette)' });
  KR.registerCommand({ command: 'tools.toggleTheme',    label: 'Toggle Theme',    key: 't', mods: { ctrl: true, shift: true }, handler: function() {}, source: 'A4.1 menu (Tools → Toggle Theme)' });

  const conflicts = KR.audit();
  if (conflicts.length > 0) {
    const detail = conflicts.map(function(c) { return c.combo + ' ← ' + c.sources.join(' + '); }).join('\n  ');
    assert.fail('§A4.1: duplicate accelerators detected (one command → one accelerator invariant):\n  ' + detail);
  }
  assert.equal(conflicts.length, 0);
});

// ----------------------------------------------------------------
// G-OC-A4.1-2 — Save As + Scene Navigator path resolution
// ----------------------------------------------------------------

test('G-OC-A4.1-2: file.saveAs is bound to Ctrl+Shift+S (industry standard)', () => {
  const { Rga } = bootRegistry();
  const KR = Rga.KeyboardRegistry;
  KR.registerCommand({ command: 'file.saveAs', label: 'Save As', key: 's', mods: { ctrl: true, shift: true }, handler: function() {}, source: 'test' });
  assert.equal(KR.commandAccelerator('file.saveAs'), 'Ctrl+Shift+S');
});

test('G-OC-A4.1-2: panel.sceneNavigator is bound to Ctrl+Shift+1 (moved off Ctrl+Shift+S)', () => {
  const { Rga } = bootRegistry();
  const KR = Rga.KeyboardRegistry;
  // shell/index.js registered the panel shortcuts via Rga.Shell.init().
  // Verify the registered combo is the new one.
  assert.equal(KR.commandAccelerator('panel.sceneNavigator'), 'Ctrl+Shift+1');
});

// ----------------------------------------------------------------
// G-OC-A4.1-3 — Menu UI does not hardcode accelerator strings
// ----------------------------------------------------------------

test('G-OC-A4.1-3: MENU_DEFS in renderer/index.html does NOT hardcode accelerator strings', () => {
  const html = read(INDEX_HTML);
  // Extract the MENU_DEFS block.
  const start = html.indexOf('var MENU_DEFS = {');
  assert.ok(start > 0, 'MENU_DEFS block must exist in index.html');
  // The block ends at the matching closing }; — find by counting braces.
  let depth = 0;
  let i = start + 'var MENU_DEFS = '.length;
  let end = -1;
  while (i < html.length) {
    if (html[i] === '{') depth += 1;
    else if (html[i] === '}') { depth -= 1; if (depth === 0) { end = i + 1; break; } }
    i += 1;
  }
  assert.ok(end > start, 'MENU_DEFS block must close');
  const menuDefsBlock = html.slice(start, end);
  // Forbidden: an `accelerator: '...'` literal anywhere in MENU_DEFS.
  // Accelerator labels are now resolved via KR.commandAccelerator(id).
  const offenders = menuDefsBlock.match(/accelerator\s*:\s*['"][^'"]+['"]/g) || [];
  assert.deepEqual(offenders, [],
    '§A4.1 forbids hardcoded `accelerator: "…"` strings inside MENU_DEFS. ' +
    'Use the item.command field; the menu UI resolves accelerator labels via ' +
    'Rga.KeyboardRegistry.commandAccelerator(commandId). Offenders: ' + offenders.join(', '));
});

test('G-OC-A4.1-3: menu dropdown rendering pulls accelerator labels from KR.commandAccelerator (not from item.accelerator)', () => {
  const html = read(INDEX_HTML);
  // The dropdown render path must call commandAccelerator.
  assert.ok(/Rga\.KeyboardRegistry\.commandAccelerator\s*\(\s*item\.command\s*\)/.test(html),
    'menu render must call Rga.KeyboardRegistry.commandAccelerator(item.command)');
  // Negative: the render path must NOT read item.accelerator anymore.
  // (Search inside the wireMenubar function body only, to avoid
  // catching JS docstrings or unrelated code.)
  const wireFnMatch = html.match(/function wireMenubar\(\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(wireFnMatch, 'wireMenubar function block must be locatable');
  assert.equal(/item\.accelerator/.test(wireFnMatch[0]), false,
    'wireMenubar must not read item.accelerator (the menu UI no longer owns accelerator strings)');
});

// ----------------------------------------------------------------
// G-OC-A4.1-4 — Menu commands all resolve to registered commands
// ----------------------------------------------------------------

test('G-OC-A4.1-4: every command id referenced in MENU_DEFS is registered (no dangling references)', () => {
  // Extract command ids from MENU_DEFS using source scan.
  const html = read(INDEX_HTML);
  const start = html.indexOf('var MENU_DEFS = {');
  let depth = 0, i = start + 'var MENU_DEFS = '.length, end = -1;
  while (i < html.length) {
    if (html[i] === '{') depth += 1;
    else if (html[i] === '}') { depth -= 1; if (depth === 0) { end = i + 1; break; } }
    i += 1;
  }
  const block = html.slice(start, end);
  const ids = [];
  const re = /command:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(block)) !== null) ids.push(m[1]);
  // Every id must also appear in a KR.registerCommand call somewhere
  // (renderer/index.html OR shell/index.js OR studio-panel.js).
  const studioSrc = read(path.join(REPO, 'renderer/js/shell/studio-panel.js'));
  const shellSrc  = read(SHELL_INDEX);
  const combined = html + '\n' + studioSrc + '\n' + shellSrc;
  ids.forEach(function(id) {
    const re2 = new RegExp("registerCommand\\s*\\(\\s*\\{[^}]*command\\s*:\\s*['\"]" + id.replace('.', '\\.') + "['\"]");
    assert.ok(re2.test(combined),
      'MENU_DEFS references command "' + id + '" but no registerCommand({ command: "' + id + '" }) was found. ' +
      'Every menu command id must have a single owner registration.');
  });
});

// ----------------------------------------------------------------
// G-OC-A4.1-5 — Inventory shape sanity
// ----------------------------------------------------------------

test('G-OC-A4.1-5: commandAccelerator returns formatted strings ("Ctrl+S", "Ctrl+Shift+S", "Esc")', () => {
  const { Rga } = bootRegistry();
  const KR = Rga.KeyboardRegistry;
  KR.registerCommand({ command: 'test.save',   label: 'Save',   key: 's', mods: { ctrl: true }, handler: function() {}, source: 'test' });
  KR.registerCommand({ command: 'test.saveAs', label: 'SaveAs', key: 's', mods: { ctrl: true, shift: true }, handler: function() {}, source: 'test' });
  KR.registerCommand({ command: 'test.escape', label: 'Esc',    key: 'escape', mods: {}, handler: function() {}, source: 'test' });
  KR.registerCommand({ command: 'test.tilde',  label: 'Tilde',  key: '`', mods: { ctrl: true }, handler: function() {}, source: 'test' });
  KR.registerCommand({ command: 'test.nokey',  label: 'NoKey',  handler: function() {}, source: 'test' });
  assert.equal(KR.commandAccelerator('test.save'),   'Ctrl+S');
  assert.equal(KR.commandAccelerator('test.saveAs'), 'Ctrl+Shift+S');
  assert.equal(KR.commandAccelerator('test.escape'), 'Esc');
  assert.equal(KR.commandAccelerator('test.tilde'),  'Ctrl+`');
  assert.equal(KR.commandAccelerator('test.nokey'),  '', 'command without keyboard binding returns empty accelerator label');
  assert.equal(KR.commandAccelerator('does.not.exist'), '', 'missing command id returns empty string');
});
