// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// GAP-3-5 guard — keyboard-shortcut default collisions (S3.4F).
//
// The S3.3 console audit (docs/plans/evidence/S3.3-console-audit.md) found
// three genuine collisions between DIFFERENT features claiming the same
// default keyboard combo. Rga.KeyboardRegistry is last-wins, so one loser in
// each pair has no working shortcut at all — while Settings, for the
// Settings-registry pair, still displays the dead combo next to the loser's
// label (a Settings-honesty violation per the Settings Constitution).
//
//   1. kb.saveAs vs kb.sceneNavigator      — both defaulted to Ctrl+Shift+S.
//   2. kb.exportPdf vs panel.scriptWorkspace — both defaulted to Ctrl+Shift+E.
//   3. panel.search vs the legacy annotation shim — both defaulted to
//      Ctrl+Shift+F.
//
// This file is the standing guard: it reads the REAL declared defaults
// straight out of source (the Settings registry module, executed; the
// shell's hardcoded panel-shortcut table and the legacy shim's registrations,
// parsed textually — same technique tests/unit/shell/owned-chrome-A4.1-
// accelerator-ownership.test.js already uses for MENU_DEFS) so a future
// contributor adding a colliding default fails CI here, not in a console log.
//
// Deliberately NOT in scope (see docs/plans/evidence/S3.4F-shortcut-
// collisions.md "Proposed gap rows"): Ctrl+Shift+T is ALSO claimed by both
// kb.toggleTheme and the legacy shim's "tag as" binding. The S3.3 audit did
// not escalate it as part of GAP-3-5 and this slice's ledger names only the
// three collisions above — the T collision is reported, not fixed, so this
// guard does not assert on it.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const REPO = path.resolve(__dirname, '../../..');
const SHELL_INDEX_PATH = path.join(REPO, 'renderer/js/shell/index.js');
const LEGACY_SHORTCUTS_PATH = path.join(REPO, 'renderer/js/editor/shortcuts.js');

function read(p) { return fs.readFileSync(p, 'utf8'); }

function loadSettingsRegistry() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  ['../../../renderer/js/shell/settings-validators.js',
   '../../../renderer/js/shell/settings-registry.js'].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  return global.window.Rga.Settings.Registry;
}

// shell/index.js's _PANEL_SHORTCUTS is a private const (deliberately not a
// Settings-registry entry — these panels have no user-facing shortcut
// control). Parse it from source rather than re-typing a second copy that
// could silently drift from the real array.
function parsePanelShortcuts() {
  const src = read(SHELL_INDEX_PATH);
  const start = src.indexOf('const _PANEL_SHORTCUTS = [');
  assert.ok(start >= 0, '_PANEL_SHORTCUTS array must exist in shell/index.js');
  const end = src.indexOf('];', start);
  const block = src.slice(start, end);
  const out = [];
  const re = /\{\s*key:\s*'([^']+)',\s*panel:\s*'([^']+)'\s*\}/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    out.push({ key: m[1], panel: m[2], combo: 'Ctrl+Shift+' + m[1].toUpperCase() });
  }
  assert.ok(out.length > 0, '_PANEL_SHORTCUTS parse must find at least one entry');
  return out;
}

// editor/shortcuts.js's Phase-5 legacy shim registrations (Rga.Keyboard —
// the S3.3 audit's "legacy shim" source label). All three entries share the
// { ctrl: true, shift: true, alt: false } shape.
function parseLegacyShimShortcuts() {
  const src = read(LEGACY_SHORTCUTS_PATH);
  const out = [];
  const re = /K\.register\('([^']+)',\s*\{\s*ctrl:\s*true,\s*shift:\s*true[^}]*\}/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push({ key: m[1], combo: 'Ctrl+Shift+' + m[1].toUpperCase() });
  }
  assert.ok(out.length > 0, 'editor/shortcuts.js legacy-shim parse must find at least one entry');
  return out;
}

// kb.sceneNavigator's Settings default is EXPECTED to equal panel.
// sceneNavigator's real hardcoded combo post-fix (Settings honestly
// re-displaying the shell's real Ctrl+Shift+1 binding for the same feature).
// That is a deliberate one-feature-two-surfaces match, not a collision.
const ALLOWED_SHARED_COMMAND = { 'kb.sceneNavigator': 'sceneNavigator' };

test('GAP-3-5 guard: no two kb.* Settings-registry shortcut defaults share a combo', () => {
  const R = loadSettingsRegistry();
  const shortcuts = R.all().filter(function(e) { return e.type === 'shortcut'; });
  const byCombo = new Map();
  shortcuts.forEach(function(e) {
    if (!byCombo.has(e.default)) byCombo.set(e.default, []);
    byCombo.get(e.default).push(e.id);
  });
  const conflicts = [];
  byCombo.forEach(function(ids, combo) {
    if (ids.length > 1) conflicts.push(combo + ' ← ' + ids.join(', '));
  });
  assert.deepEqual(conflicts, [],
    'GAP-3-5: two Settings-registry shortcut entries must never share the same default ' +
    'combo — Settings would display the same key next to two different commands, and ' +
    'only one can actually fire (KeyboardRegistry is last-wins). Conflicts:\n  ' +
    conflicts.join('\n  '));
});

test('GAP-3-5 guard: no kb.* Settings default collides with a hardcoded shell panel-shortcut default', () => {
  const R = loadSettingsRegistry();
  const shortcuts = R.all().filter(function(e) { return e.type === 'shortcut'; });
  const panelShortcuts = parsePanelShortcuts();
  const conflicts = [];
  shortcuts.forEach(function(kbEntry) {
    panelShortcuts.forEach(function(p) {
      if (ALLOWED_SHARED_COMMAND[kbEntry.id] === p.panel) return;
      if (kbEntry.default === p.combo) {
        conflicts.push(kbEntry.default + ' ← ' + kbEntry.id + ' vs panel.' + p.panel);
      }
    });
  });
  assert.deepEqual(conflicts, [],
    'GAP-3-5: a Settings-driven kb.* default must not collide with a hardcoded shell ' +
    'panel-toggle default — the Settings-driven kb-applicator layer registers last at ' +
    'boot (S3.3 console audit), so it silently wins and the panel toggle stops firing. ' +
    'Conflicts:\n  ' + conflicts.join('\n  '));
});

test('GAP-3-5 guard: the search panel default does not collide with the legacy annotation-shortcut shim', () => {
  const panelShortcuts = parsePanelShortcuts();
  const legacyShortcuts = parseLegacyShimShortcuts();
  const search = panelShortcuts.find(function(p) { return p.panel === 'search'; });
  assert.ok(search, 'shell/index.js must still declare a panel shortcut for "search"');
  const collision = legacyShortcuts.find(function(l) { return l.combo === search.combo; });
  assert.equal(collision, undefined,
    'GAP-3-5: the search panel toggle (' + search.combo + ') collides with editor/' +
    'shortcuts.js\'s legacy-shim registration for the same combo — the S3.3 console ' +
    'audit\'s "Ctrl+Shift+F" collision. One command per default.');
});

// Regression pins named explicitly in the masterplan (S3.4F / GAP-3-5).

test('GAP-3-5: kb.saveAs keeps the ratified Ctrl+Shift+S default (2026-07-29 user ruling)', () => {
  const R = loadSettingsRegistry();
  assert.equal(R.getDefault('kb.saveAs'), 'Ctrl+Shift+S');
});

test('GAP-3-5: kb.sceneNavigator default matches its real Ctrl+Shift+1 binding (Settings honesty)', () => {
  const R = loadSettingsRegistry();
  const panelShortcuts = parsePanelShortcuts();
  const sceneNav = panelShortcuts.find(function(p) { return p.panel === 'sceneNavigator'; });
  assert.ok(sceneNav, 'shell/index.js must still declare a panel shortcut for "sceneNavigator"');
  assert.equal(R.getDefault('kb.sceneNavigator'), sceneNav.combo,
    'Settings must display the SAME combo shell/index.js actually binds for panel.sceneNavigator');
});

test('GAP-3-5: kb.exportPdf no longer collides with the scriptWorkspace panel default', () => {
  const R = loadSettingsRegistry();
  const panelShortcuts = parsePanelShortcuts();
  const scriptWorkspace = panelShortcuts.find(function(p) { return p.panel === 'scriptWorkspace'; });
  assert.ok(scriptWorkspace, 'shell/index.js must still declare a panel shortcut for "scriptWorkspace"');
  assert.notEqual(R.getDefault('kb.exportPdf'), scriptWorkspace.combo);
});
