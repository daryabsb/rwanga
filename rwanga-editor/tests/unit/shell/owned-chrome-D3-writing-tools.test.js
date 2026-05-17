// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Studio Shell Recovery — Workstream D, Slice D3 (Writing tools group
// in Row 3 toolbar — Note · Flag · Tag ▾ · Undo · Redo).
//
// Invariants:
//   1. Writing-tools group exists inside .rga-shell-toolbar-inner,
//      AFTER the Scene-tools group, separated by a group separator.
//   2. Note + Flag buttons exist with data-command="writing.note" /
//      "writing.flag"; Tag select exists with id="rga-shell-toolbar-tag";
//      Undo + Redo buttons exist with data-command="edit.undo" / "edit.redo".
//   3. writing.note + writing.flag commands registered via
//      KR.registerCommand; handlers route to existing
//      openAnnotationDialog / openFlagPopup functions (no new logic).
//   4. Undo / Redo route through pre-existing edit.undo / edit.redo
//      commands (§A4.1) — NO duplicate registration in format-toolbar.js.
//   5. Tag dispatch shared with the Scene Toolbox (applyTagFromSelection
//      invoked from exactly one location pattern).
//   6. KR.audit() reports no duplicate accelerators (§A4.1 invariant
//      preserved).
//   7. D1.1 manuscript alignment + D2 contracts unchanged.
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

// ----------------------------------------------------------------
// 1. Writing-tools group exists in correct position
// ----------------------------------------------------------------

test('§D3: Writing-tools group exists after Scene-tools group inside the inner band', () => {
  const html = read(INDEX_HTML);
  const innerMatch = html.match(/<div class="rga-shell-toolbar-inner">([\s\S]*?)<\/div>\s*<\/div>/);
  assert.ok(innerMatch, '.rga-shell-toolbar-inner must wrap toolbar groups');
  const inner = innerMatch[1];
  const textIdx    = inner.indexOf('data-group="text"');
  const sceneIdx   = inner.indexOf('data-group="scene"');
  const writingIdx = inner.indexOf('data-group="writing"');
  assert.ok(textIdx > 0 && sceneIdx > 0 && writingIdx > 0,
    'all three groups (text · scene · writing) must exist in the inner band');
  assert.ok(textIdx < sceneIdx && sceneIdx < writingIdx,
    'group order must be Text → Scene → Writing (left → right)');
});

test('§D3: a group separator sits between Scene-tools and Writing-tools', () => {
  const html = read(INDEX_HTML);
  // Count .rga-shell-toolbar-group-sep occurrences — D2 added one
  // between Text+Scene; D3 adds the second between Scene+Writing.
  const seps = (html.match(/class="rga-shell-toolbar-group-sep"/g) || []).length;
  assert.ok(seps >= 2,
    'at least 2 .rga-shell-toolbar-group-sep elements expected (Text|Scene + Scene|Writing); got ' + seps);
});

// ----------------------------------------------------------------
// 2. Button + select shapes
// ----------------------------------------------------------------

test('§D3: Note + Flag buttons exist with the right data-command', () => {
  const html = read(INDEX_HTML);
  assert.ok(/<button[^>]*data-command="writing\.note"[^>]*>/.test(html),
    'Note button must declare data-command="writing.note"');
  assert.ok(/<button[^>]*data-command="writing\.flag"[^>]*>/.test(html),
    'Flag button must declare data-command="writing.flag"');
});

test('§D3: Tag dropdown exists with id="rga-shell-toolbar-tag" + aria-label', () => {
  const html = read(INDEX_HTML);
  const selectMatch = html.match(/<select[^>]*id="rga-shell-toolbar-tag"[\s\S]*?<\/select>/);
  assert.ok(selectMatch, '#rga-shell-toolbar-tag select must exist');
  assert.ok(/aria-label\s*=/.test(selectMatch[0]),
    'tag select must declare aria-label (G-OC-8)');
  // The tag options must mirror the Scene Toolbox tag list — all
  // 9 categories + the placeholder.
  ['character', 'prop', 'wardrobe', 'location', 'sfx', 'vfx', 'vehicle', 'animal', 'custom'].forEach(function(t) {
    const re = new RegExp('<option[^>]*value="' + t + '"');
    assert.ok(re.test(selectMatch[0]),
      'tag select must include option value="' + t + '"');
  });
});

test('§D3: Undo + Redo buttons exist with data-command="edit.undo|redo" (§A4.1 commands)', () => {
  const html = read(INDEX_HTML);
  assert.ok(/<button[^>]*data-command="edit\.undo"[^>]*>/.test(html),
    'Undo button must declare data-command="edit.undo"');
  assert.ok(/<button[^>]*data-command="edit\.redo"[^>]*>/.test(html),
    'Redo button must declare data-command="edit.redo"');
});

// ----------------------------------------------------------------
// 3. writing.note + writing.flag command registrations
// ----------------------------------------------------------------

test('§D3: writing.note registered with handler routing to existing openAnnotationDialog', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  const block = src.match(/registerCommand\(\{[^}]*command:\s*['"]writing\.note['"][^}]*\}\)/);
  assert.ok(block, 'writing.note command must be registered');
  assert.ok(/handler:\s*openAnnotationDialog/.test(block[0]),
    'writing.note handler must be openAnnotationDialog (existing function — no new logic)');
});

test('§D3: writing.flag registered with handler routing to existing openFlagPopup', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  const block = src.match(/registerCommand\(\{[^}]*command:\s*['"]writing\.flag['"][^}]*\}\)/);
  assert.ok(block, 'writing.flag command must be registered');
  assert.ok(/handler:\s*openFlagPopup/.test(block[0]),
    'writing.flag handler must be openFlagPopup (existing function — no new logic)');
});

// ----------------------------------------------------------------
// 4. Undo / Redo are NOT re-registered (consume §A4.1 ownership)
// ----------------------------------------------------------------

test('§D3: Undo / Redo NOT re-registered in format-toolbar.js (consume the §A4.1 edit.undo / edit.redo commands)', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  // The toolbar must NOT register its own edit.undo or edit.redo —
  // those commands are owned by index.html's registerMenuCommands
  // (§A4.1). The toolbar buttons just declare data-command and let
  // the click delegation route through KR.invokeCommand.
  assert.equal(/registerCommand\(\{[^}]*command:\s*['"]edit\.undo['"]/.test(src), false,
    'format-toolbar.js must NOT register edit.undo (owned by index.html / §A4.1)');
  assert.equal(/registerCommand\(\{[^}]*command:\s*['"]edit\.redo['"]/.test(src), false,
    'format-toolbar.js must NOT register edit.redo (owned by index.html / §A4.1)');
});

// ----------------------------------------------------------------
// 5. Tag dispatch shared with Scene Toolbox (no duplicate logic)
// ----------------------------------------------------------------

test('§D3: Tag dispatch routes through the existing applyTagFromSelection', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  // §A Shell Final Polish retired the Scene Toolbox; only the Row 3
  // tag dropdown remains. applyTagFromSelection is still the single
  // logic owner — Row 3 routes through it.
  const row3Tag = src.match(/rga-shell-toolbar-tag[\s\S]{0,500}\}\);/);
  assert.ok(row3Tag, 'rga-shell-toolbar-tag handler must exist');
  assert.ok(/applyTagFromSelection/.test(row3Tag[0]),
    'Row 3 tag handler must call applyTagFromSelection');
  // The single owner still exists in the file.
  assert.ok(/function applyTagFromSelection\b/.test(src),
    'applyTagFromSelection helper must still exist (single tagging logic owner)');
});

// ----------------------------------------------------------------
// 6. KR audit still passes (no accelerator conflicts introduced)
// ----------------------------------------------------------------

test('§D3: writing.note / writing.flag carry no KR keyboard binding (consistent with §D1 policy)', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  ['writing.note', 'writing.flag'].forEach(function(cmd) {
    const block = src.match(new RegExp("registerCommand\\(\\{[^}]*command:\\s*['\"]" + cmd.replace('.', '\\.') + "['\"][^}]*\\}\\)"));
    if (!block) return;
    assert.equal(/\bkey\s*:\s*['"]/.test(block[0]), false,
      cmd + ' must NOT declare a KR key (no accelerator; toolbar invocation only — keeps audit clean)');
  });
});

// ----------------------------------------------------------------
// 7. Prior contracts preserved
// ----------------------------------------------------------------

test('§D3: D1.1 manuscript alignment contract intact (.rga-shell-toolbar-inner still consumes --page-width)', () => {
  const css = read(SHELL_CSS);
  const innerRule = css.match(/(?:^|\n)\s*\.rga-shell-toolbar-inner\s*\{[^}]*\}/);
  assert.ok(innerRule);
  assert.ok(/var\(\s*--page-width/.test(innerRule[0]),
    '.rga-shell-toolbar-inner must still consume var(--page-width) — D1.1 alignment preserved');
});

test('§D3: D2 scene tools intact (scene.insert + #rga-shell-toolbar-blocktype unchanged)', () => {
  const html = read(INDEX_HTML);
  const src  = read(FORMAT_TOOLBAR_JS);
  assert.ok(/<button[^>]*data-command="scene\.insert"/.test(html),
    '+ Scene button must still exist (D2)');
  assert.ok(/<select[^>]*id="rga-shell-toolbar-blocktype"/.test(html),
    'block-type dropdown must still exist (D2)');
  assert.ok(/registerCommand\(\{[^}]*command:\s*['"]scene\.insert['"]/.test(src),
    'scene.insert must still be registered (D2)');
});
