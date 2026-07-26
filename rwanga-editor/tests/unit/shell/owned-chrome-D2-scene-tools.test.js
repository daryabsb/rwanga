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
const { JSDOM } = require('jsdom');

const REPO = path.resolve(__dirname, '../../..');
const INDEX_HTML = path.join(REPO, 'renderer/index.html');
const SHELL_CSS  = path.join(REPO, 'renderer/css/shell.css');
const FORMAT_TOOLBAR_JS = path.join(REPO, 'renderer/js/format-toolbar.js');
// F1A.6 moved the Scene group into the screenplay plugin — the group's
// DOM, scene.insert registration, engine dispatch and ScriptMetrics
// sync all live in doc-types/screenplay/toolbar.js now.
const SCENE_TOOLBAR_JS = path.join(REPO, 'renderer/js/doc-types/screenplay/toolbar.js');

function read(p) { return fs.readFileSync(p, 'utf8'); }

// Boot the screenplay plugin's Scene toolbar group in JSDOM and mount
// it — the group DOM is plugin-built (F1A.6), no longer static markup
// in index.html (the static slot is index.html's
// .rga-shell-toolbar-content-slot). Captures registerGroup +
// registerCommand calls and returns the mounted group element so DOM
// assertions stay as strong as the old static-markup checks.
function bootSceneGroup() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  const groups = [];
  const commands = [];
  const metrics = { snap: { currentBlockType: null }, subscriber: null };
  global.window.Rga = {
    Shell: { Toolbar: { registerGroup: function(def) { groups.push(def); } } },
    KeyboardRegistry: { registerCommand: function(def) { commands.push(def); } },
    ScriptMetrics: {
      get: function() { return metrics.snap; },
      subscribe: function(fn) { metrics.subscriber = fn; return function() {}; }
    }
  };
  const p = '../../../renderer/js/doc-types/screenplay/toolbar.js';
  delete require.cache[require.resolve(p)];
  require(p);
  const groupEl = dom.window.document.createElement('div');
  groupEl.className = 'rga-shell-toolbar-group';
  if (groups[0]) {
    groupEl.setAttribute('data-group', groups[0].dataGroup || '');
    groups[0].mount(groupEl);
  }
  return { groupEl, groups, commands, metrics };
}

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
  // moved to screenplay plugin per F1A.6 — select is plugin-built at
  // doc-types/screenplay/toolbar.js:105-130 into the index.html:142 slot.
  const { groupEl } = bootSceneGroup();
  const select = groupEl.querySelector('select#rga-shell-toolbar-blocktype');
  assert.ok(select, '#rga-shell-toolbar-blocktype select must exist');
  // Required user-changeable options (order matters for visual
  // consistency with the Scene Toolbox's existing dropdown).
  ['action', 'character', 'dialogue', 'parenthetical', 'shot', 'transition'].forEach(function(v) {
    assert.ok(select.querySelector('option[value="' + v + '"]'),
      'block-type select must include option value="' + v + '"');
  });
  // sceneHeading is the held-only option (mirrors §A4.1's printPreview
  // pattern in the viewMode dropdown) — present in markup but disabled
  // and hidden from the popup.
  // held-only option built at doc-types/screenplay/toolbar.js:125-130
  const held = select.querySelector('option[value="sceneHeading"]');
  assert.ok(held && held.disabled && held.hidden,
    'sceneHeading option must be disabled + hidden (held-only value for selection-aware sync)');
});

test('§D2: block-type select has aria-label (a11y non-negotiable per G-OC-8)', () => {
  // moved to screenplay plugin per F1A.6 — aria-label set in JS at
  // doc-types/screenplay/toolbar.js:107.
  const { groupEl } = bootSceneGroup();
  const select = groupEl.querySelector('select#rga-shell-toolbar-blocktype');
  assert.ok(select);
  assert.ok(select.getAttribute('aria-label'),
    '#rga-shell-toolbar-blocktype must declare aria-label');
});

// ----------------------------------------------------------------
// 3. "+ Scene" button + scene.insert command
// ----------------------------------------------------------------

test('§D2: + Scene button exists with data-command="scene.insert"', () => {
  // moved to screenplay plugin per F1A.6 — button is plugin-built at
  // doc-types/screenplay/toolbar.js:141-147.
  const { groupEl } = bootSceneGroup();
  assert.ok(groupEl.querySelector('button[data-command="scene.insert"]'),
    'a button with data-command="scene.insert" must exist');
});

test('§D2: scene.insert command registered via KR.registerCommand', () => {
  // moved to screenplay plugin per F1A.6 — registered at
  // doc-types/screenplay/toolbar.js:90-94 (move documented at
  // format-toolbar.js:364-369).
  const src = read(SCENE_TOOLBAR_JS);
  assert.ok(/registerCommand\(\{[^}]*command:\s*['"]scene\.insert['"]/.test(src),
    'doc-types/screenplay/toolbar.js must register the scene.insert command');
  // Behavioral cross-check: script-load actually issues the call.
  const { commands } = bootSceneGroup();
  const reg = commands.filter(function(c) { return c.command === 'scene.insert'; });
  assert.equal(reg.length, 1, 'plugin load must register scene.insert exactly once');
  assert.equal(typeof reg[0].handler, 'function', 'scene.insert must carry a handler');
});

test('§D2: scene.insert handler routes through Rga.DocTypes.screenplay.v3Commands.insertSceneSmart (existing engine command)', () => {
  // moved to screenplay plugin per F1A.6 — engine call at
  // doc-types/screenplay/toolbar.js:77-78.
  const src = read(SCENE_TOOLBAR_JS);
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
  // moved to screenplay plugin per F1A.6 — helper at
  // doc-types/screenplay/toolbar.js:62, wired to the select's change
  // handler at :151.
  const src = read(SCENE_TOOLBAR_JS);
  assert.ok(/function _dispatchBlockType\b/.test(src),
    'a single _dispatchBlockType helper must exist (no duplicate PM.setBlockType call sites)');
  // §A Shell Final Polish retired the Scene Toolbox, so only the
  // Row 3 dropdown handler remains. The shared-helper contract still
  // holds — it's now the single owner of PM.setBlockType dispatch.
  const changeHandler = src.match(/const onChange = function\(\) \{[\s\S]{0,200}?\};/);
  assert.ok(changeHandler, 'block-type select change handler must exist');
  assert.ok(/_dispatchBlockType\s*\(/.test(changeHandler[0]),
    'block-type select change handler must call _dispatchBlockType');
  assert.ok(/select\.addEventListener\(\s*['"]change['"]\s*,\s*onChange\s*\)/.test(src),
    'change handler must be wired to the block-type select');
});

test('§D2: PM.setBlockType is invoked from exactly one site in format-toolbar.js (single owner)', () => {
  // Single owner moved to screenplay plugin per F1A.6 —
  // doc-types/screenplay/toolbar.js:70; CORE format-toolbar.js
  // correctly has 0 call sites (no longer knows screenplay block
  // types, see format-toolbar.js:364-369).
  function countCalls(src) {
    // Strip comments first.
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    // Count call sites: PM.setBlockType(nodeType)(view.state, …)
    return (stripped.match(/PM\.setBlockType\s*\(/g) || []).length;
  }
  const pluginCalls = countCalls(read(SCENE_TOOLBAR_JS));
  assert.equal(pluginCalls, 1,
    'PM.setBlockType must be invoked from exactly one site in doc-types/screenplay/toolbar.js (the _dispatchBlockType helper). Got ' + pluginCalls + ' call(s).');
  const coreCalls = countCalls(read(FORMAT_TOOLBAR_JS));
  assert.equal(coreCalls, 0,
    'format-toolbar.js must have ZERO PM.setBlockType call sites post-F1A.6 (CORE no longer knows screenplay block types). Got ' + coreCalls + ' call(s).');
});

// ----------------------------------------------------------------
// 6. Selection-aware sync
// ----------------------------------------------------------------

test('§D2: Row 3 block-type dropdown subscribes to Rga.ScriptMetrics for selection-aware sync', () => {
  // moved to screenplay plugin per F1A.6 — ScriptMetrics subscribe
  // sync at doc-types/screenplay/toolbar.js:154-175.
  const src = read(SCENE_TOOLBAR_JS);
  // The wiring must satisfy three substring requirements: it
  // references the block-type select, it subscribes to ScriptMetrics
  // (via the SM alias for window.Rga.ScriptMetrics, :157), and it
  // reads currentBlockType. The three appear in proximity (within the
  // same mount block); we don't assert exact syntactic shape — just
  // the contract.
  assert.ok(/window\.Rga\.ScriptMetrics/.test(src),
    'wiring must reference window.Rga.ScriptMetrics');
  assert.ok(/SM\.subscribe/.test(src),
    'wiring must subscribe to Rga.ScriptMetrics');
  assert.ok(/currentBlockType/.test(src),
    'wiring must read currentBlockType from the ScriptMetrics snapshot');
  // Cross-check the three appear in close proximity (within ~1500
  // chars of each other — same wiring block).
  const idxSM     = src.indexOf('window.Rga.ScriptMetrics');
  const idxSub    = src.indexOf('SM.subscribe');
  const idxBlock  = src.indexOf('currentBlockType');
  assert.ok(idxSM > 0 && idxSub > 0 && idxBlock > 0);
  assert.ok(Math.max(idxSM, idxSub, idxBlock) - Math.min(idxSM, idxSub, idxBlock) < 1500,
    'ScriptMetrics / SM.subscribe / currentBlockType must appear in the SAME wiring block (proximity check)');
  // Behavioral cross-check: mounting subscribes, and a metrics tick
  // moves the select to the cursor's block type.
  const { groupEl, metrics } = bootSceneGroup();
  const select = groupEl.querySelector('select#rga-shell-toolbar-blocktype');
  assert.ok(select && typeof metrics.subscriber === 'function',
    'plugin mount must subscribe to ScriptMetrics');
  metrics.snap = { currentBlockType: 'dialogue' };
  metrics.subscriber();
  assert.equal(select.value, 'dialogue',
    'select must track ScriptMetrics.currentBlockType (selection-aware sync)');
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
