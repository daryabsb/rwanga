// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Studio Shell Recovery — Workstream D, Slice D2 (Scene tools group
// in Row 3 toolbar).
//
// Invariants:
//   1. Scene-tools group exists inside .rga-shell-toolbar-inner,
//      AFTER the Text-tools group, separated by a group separator.
//   2. Block-type dropdown (#rga-shell-toolbar-blocktype) exists with
//      the 6 user-changeable block types + a hidden disabled
//      sceneHeading option (held-only value, mirrors §A4.1's
//      printPreview pattern from the viewMode dropdown).
//   3. "+ Scene" button exists with data-command="scene.insert".
//   4. scene.insert command registered via KR.registerCommand;
//      handler routes through Rga.DocTypes.screenplay.v3Commands.
//      insertSceneSmart (existing engine command — no engine mod).
//   5. NO Insert Page Break button (deferred — v3 has no command).
//   6. Block-type dispatch shared with the Scene Toolbox (no
//      duplicate command logic).
//   7. Row 3 dropdown subscribes to ScriptMetrics.currentBlockType
//      for selection-aware sync.
//   8. D1.1 manuscript-alignment contract unchanged.
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
// 1. Scene-tools group structure
// ----------------------------------------------------------------

test('§D2: Scene-tools group exists inside .rga-shell-toolbar-inner, after the Text-tools group', () => {
  const html = read(INDEX_HTML);
  // Both groups must live INSIDE the inner band (the D1.1 alignment
  // contract); Scene group must follow Text group in DOM order.
  const innerMatch = html.match(/<div class="rga-shell-toolbar-inner">([\s\S]*?)<\/div>\s*<\/div>/);
  assert.ok(innerMatch, '.rga-shell-toolbar-inner must wrap toolbar groups');
  const inner = innerMatch[1];
  const textGroupIdx  = inner.indexOf('data-group="text"');
  const sceneGroupIdx = inner.indexOf('data-group="scene"');
  assert.ok(textGroupIdx > 0,  'Text-tools group must exist inside the inner band');
  assert.ok(sceneGroupIdx > 0, 'Scene-tools group must exist inside the inner band');
  assert.ok(textGroupIdx < sceneGroupIdx,
    'Scene-tools group must appear AFTER Text-tools group');
});

test('§D2: a group separator sits between Text-tools and Scene-tools', () => {
  const html = read(INDEX_HTML);
  // The .rga-shell-toolbar-group-sep element marks the gap between
  // top-level groups (vs .rga-shell-toolbar-sep which separates
  // sub-clusters within a group).
  assert.ok(/class="rga-shell-toolbar-group-sep"/.test(html),
    'a .rga-shell-toolbar-group-sep element must exist between groups');
});

// ----------------------------------------------------------------
// 2. Block-type dropdown
// ----------------------------------------------------------------

test('§D2: #rga-shell-toolbar-blocktype select exists with 6 user-changeable block types + hidden sceneHeading', () => {
  const html = read(INDEX_HTML);
  const selectMatch = html.match(/<select[^>]*id="rga-shell-toolbar-blocktype"[\s\S]*?<\/select>/);
  assert.ok(selectMatch, '#rga-shell-toolbar-blocktype select must exist');
  const select = selectMatch[0];
  // Required user-changeable options (order matters for visual
  // consistency with the Scene Toolbox's existing dropdown).
  ['action', 'character', 'dialogue', 'parenthetical', 'shot', 'transition'].forEach(function(v) {
    const re = new RegExp('<option[^>]*value="' + v + '"[^>]*>');
    assert.ok(re.test(select),
      'block-type select must include option value="' + v + '"');
  });
  // sceneHeading is the held-only option (mirrors §A4.1's printPreview
  // pattern in the viewMode dropdown) — present in markup but disabled
  // and hidden from the popup.
  assert.ok(/<option[^>]*value="sceneHeading"[^>]*disabled[^>]*hidden/.test(select),
    'sceneHeading option must be disabled + hidden (held-only value for selection-aware sync)');
});

test('§D2: block-type select has aria-label (a11y non-negotiable per G-OC-8)', () => {
  const html = read(INDEX_HTML);
  const selectMatch = html.match(/<select[^>]*id="rga-shell-toolbar-blocktype"[^>]*>/);
  assert.ok(selectMatch);
  assert.ok(/aria-label\s*=\s*["'][^"']+["']/.test(selectMatch[0]),
    '#rga-shell-toolbar-blocktype must declare aria-label');
});

// ----------------------------------------------------------------
// 3. "+ Scene" button + scene.insert command
// ----------------------------------------------------------------

test('§D2: + Scene button exists with data-command="scene.insert"', () => {
  const html = read(INDEX_HTML);
  assert.ok(/<button[^>]*data-command="scene\.insert"[^>]*>/.test(html),
    'a button with data-command="scene.insert" must exist');
});

test('§D2: scene.insert command registered via KR.registerCommand', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  assert.ok(/registerCommand\(\{[^}]*command:\s*['"]scene\.insert['"]/.test(src),
    'format-toolbar.js must register the scene.insert command');
});

test('§D2: scene.insert handler routes through Rga.DocTypes.screenplay.v3Commands.insertSceneSmart (existing engine command)', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  // The _dispatchInsertScene helper must call insertSceneSmart.
  assert.ok(/v3Commands\.insertSceneSmart/.test(src),
    'Insert Scene path must call Rga.DocTypes.screenplay.v3Commands.insertSceneSmart');
  // Negative guard: scene.insert must not call any OTHER scene-insert
  // engine command (would imply duplicate ownership / new engine path).
  const handlerMatch = src.match(/function _dispatchInsertScene[\s\S]*?\n  \}/);
  assert.ok(handlerMatch, '_dispatchInsertScene helper must exist');
  assert.equal(/insertSceneAtEnd\(|insertSceneAfter\(/.test(handlerMatch[0]), false,
    '_dispatchInsertScene must call ONLY insertSceneSmart — not the lower-level helpers (those are the SMART command\'s internal fallbacks)');
});

// ----------------------------------------------------------------
// 4. Insert Page Break — DEFERRED (no v3 command exists)
// ----------------------------------------------------------------

test('§D2: NO Insert Page Break button (deferred — no v3 command exists)', () => {
  const html = read(INDEX_HTML);
  // Negative guard. If a future engine commit adds an
  // insertPageBreak command, the user authorises ungating this guard.
  assert.equal(/data-command="scene\.insertPageBreak"/.test(html), false,
    'no scene.insertPageBreak button until v3-commands.js exposes the engine command (§D2 brief: defer immediately if absent)');
});

// ----------------------------------------------------------------
// 5. Shared block-type dispatch (no duplicate command logic)
// ----------------------------------------------------------------

test('§D2: block-type dispatch is shared via the _dispatchBlockType helper (no duplicate logic)', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  assert.ok(/function _dispatchBlockType\b/.test(src),
    'a single _dispatchBlockType helper must exist (no duplicate PM.setBlockType call sites)');
  // §A Shell Final Polish retired the Scene Toolbox, so only the
  // Row 3 dropdown handler remains. The shared-helper contract still
  // holds — it's now the single owner of PM.setBlockType dispatch.
  const row3Handler = src.match(/row3BlockType\.addEventListener\([\s\S]{0,200}\}\);/);
  assert.ok(row3Handler, 'Row 3 block-type handler must exist');
  assert.ok(/_dispatchBlockType\s*\(/.test(row3Handler[0]),
    'Row 3 dropdown change handler must call _dispatchBlockType');
});

test('§D2: PM.setBlockType is invoked from exactly one site in format-toolbar.js (single owner)', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  // Strip comments first.
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  // Count call sites: PM.setBlockType(nodeType)(view.state, …)
  const calls = (stripped.match(/PM\.setBlockType\s*\(/g) || []).length;
  assert.equal(calls, 1,
    'PM.setBlockType must be invoked from exactly one site in format-toolbar.js (the _dispatchBlockType helper). Got ' + calls + ' call(s).');
});

// ----------------------------------------------------------------
// 6. Selection-aware sync
// ----------------------------------------------------------------

test('§D2: Row 3 block-type dropdown subscribes to Rga.ScriptMetrics for selection-aware sync', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  // The wiring must satisfy three substring requirements: it
  // references row3BlockType (the Row 3 dropdown), it subscribes to
  // ScriptMetrics, and it reads currentBlockType. The three appear
  // in proximity (within the same init block); we don't assert exact
  // syntactic shape — just the contract.
  assert.ok(/row3BlockType/.test(src),
    'wiring must reference row3BlockType (the Row 3 block-type dropdown)');
  assert.ok(/Rga\.ScriptMetrics\.subscribe/.test(src),
    'wiring must subscribe to Rga.ScriptMetrics');
  assert.ok(/currentBlockType/.test(src),
    'wiring must read currentBlockType from the ScriptMetrics snapshot');
  // Cross-check the three appear in close proximity (within ~1500
  // chars of each other — same wiring block).
  const idxRow3   = src.indexOf('row3BlockType');
  const idxSub    = src.indexOf('Rga.ScriptMetrics.subscribe');
  const idxBlock  = src.indexOf('currentBlockType');
  assert.ok(idxRow3 > 0 && idxSub > 0 && idxBlock > 0);
  assert.ok(Math.max(idxRow3, idxSub, idxBlock) - Math.min(idxRow3, idxSub, idxBlock) < 1500,
    'row3BlockType / ScriptMetrics.subscribe / currentBlockType must appear in the SAME wiring block (proximity check)');
});

// ----------------------------------------------------------------
// 7. D1.1 alignment contract preserved
// ----------------------------------------------------------------

test('§D2: D1.1 manuscript alignment contract intact (toolbar inner still uses --page-width)', () => {
  const css = read(SHELL_CSS);
  const innerRule = css.match(/(?:^|\n)\s*\.rga-shell-toolbar-inner\s*\{[^}]*\}/);
  assert.ok(innerRule, '.rga-shell-toolbar-inner rule must still exist');
  assert.ok(/var\(\s*--page-width/.test(innerRule[0]),
    '.rga-shell-toolbar-inner must still consume var(--page-width) — D1.1 contract preserved');
  assert.ok(/grid-column\s*:\s*4/.test(innerRule[0]),
    '.rga-shell-toolbar-inner must still declare grid-column: 4');
  assert.ok(/justify-self\s*:\s*center/.test(innerRule[0]),
    '.rga-shell-toolbar-inner must still declare justify-self: center');
});
