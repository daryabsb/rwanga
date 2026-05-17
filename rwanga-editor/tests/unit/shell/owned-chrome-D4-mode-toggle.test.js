// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Studio Shell Recovery — Workstream D, Slice D4 (Mode toggle —
// Screenplay / Text — in Row 3 toolbar).
//
// Invariants:
//   1. Mode segmented-control group exists inside .rga-shell-toolbar-
//      inner, AFTER the Writing-tools group, separated by a group
//      separator. role="radiogroup" with two role="radio" buttons.
//   2. Screenplay button declares aria-checked="true" by default;
//      Text button declares aria-checked="false".
//   3. Persistence rides Rga.Shell.Layout.toolbar.mode (existing
//      shell-truth surface; persisted via WorkspaceState pipeline).
//      No new localStorage key, no new module.
//   4. Toolbar mode wiring lives in format-toolbar.js and routes
//      Layout.set({ toolbar: { mode } }) on click — no PM mutation,
//      no command registration/deregistration on switch.
//   5. CSS Text-mode rules hide Scene + Writing groups (pure
//      display:none — DOM stays, commands stay registered).
//   6. The orphan group-seps adjacent to hidden groups also collapse
//      (no dangling dividers between hidden groups).
//   7. Prior contracts intact:
//        - D1.1 manuscript alignment (.rga-shell-toolbar-inner still
//          consumes --page-width + grid-column: 4).
//        - D2 scene tools (block-type dropdown + + Scene button).
//        - D3 writing tools (Note, Flag, Tag, Undo, Redo).
//   8. Workstream D ships: no further D-series slices required.
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
const LAYOUT_JS  = path.join(REPO, 'renderer/js/shell/layout.js');

function read(p) { return fs.readFileSync(p, 'utf8'); }

// ----------------------------------------------------------------
// 1. Mode group exists in correct position
// ----------------------------------------------------------------

test('§D4: Mode segmented-control group exists inside .rga-shell-toolbar-inner, after Writing-tools', () => {
  const html = read(INDEX_HTML);
  const innerMatch = html.match(/<div class="rga-shell-toolbar-inner">([\s\S]*?)<\/div>\s*<\/div>/);
  assert.ok(innerMatch, '.rga-shell-toolbar-inner must wrap toolbar groups');
  const inner = innerMatch[1];
  const writingIdx = inner.indexOf('data-group="writing"');
  const modeIdx    = inner.indexOf('data-group="mode"');
  assert.ok(writingIdx > 0, 'Writing-tools group must exist (D3 contract)');
  assert.ok(modeIdx > 0,    'Mode group must exist inside the inner band');
  assert.ok(writingIdx < modeIdx,
    'Mode group must appear AFTER the Writing-tools group (rightmost cluster)');
});

test('§D4: a group separator sits between Writing-tools and Mode', () => {
  const html = read(INDEX_HTML);
  // D2 added 1 group-sep (Text|Scene); D3 added 1 (Scene|Writing);
  // D4 adds the third (Writing|Mode).
  const seps = (html.match(/class="rga-shell-toolbar-group-sep"/g) || []).length;
  assert.ok(seps >= 3,
    'at least 3 .rga-shell-toolbar-group-sep elements expected (Text|Scene + Scene|Writing + Writing|Mode); got ' + seps);
});

test('§D4: Mode group uses role="radiogroup" with two role="radio" buttons (a11y per G-OC-8)', () => {
  const html = read(INDEX_HTML);
  const groupMatch = html.match(/<div[^>]*data-group="mode"[^>]*>[\s\S]*?<\/div>/);
  assert.ok(groupMatch, 'Mode group element must exist');
  const group = groupMatch[0];
  assert.ok(/role="radiogroup"/.test(group),
    'Mode group must declare role="radiogroup"');
  assert.ok(/aria-label\s*=\s*["'][^"']+["']/.test(group),
    'Mode group must declare aria-label');
  // Both Screenplay and Text buttons present, each role="radio".
  ['screenplay', 'text'].forEach(function(m) {
    const re = new RegExp('<button[^>]*data-toolbar-mode="' + m + '"[^>]*role="radio"[^>]*>');
    assert.ok(re.test(group),
      'Mode button [data-toolbar-mode="' + m + '"] must declare role="radio"');
  });
});

test('§D4: Screenplay is the default checked radio (aria-checked="true"); Text is unchecked', () => {
  const html = read(INDEX_HTML);
  const screenplayBtn = html.match(/<button[^>]*data-toolbar-mode="screenplay"[^>]*>/);
  const textBtn       = html.match(/<button[^>]*data-toolbar-mode="text"[^>]*>/);
  assert.ok(screenplayBtn, 'Screenplay mode button must exist');
  assert.ok(textBtn,       'Text mode button must exist');
  assert.ok(/aria-checked="true"/.test(screenplayBtn[0]),
    'Screenplay button must declare aria-checked="true" by default (Screenplay is the default mode)');
  assert.ok(/aria-checked="false"/.test(textBtn[0]),
    'Text button must declare aria-checked="false" by default');
});

// ----------------------------------------------------------------
// 2. Persistence ownership — Layout.toolbar.mode (existing surface)
// ----------------------------------------------------------------

test('§D4: Rga.Shell.Layout DEFAULTS include toolbar.mode = "screenplay"', () => {
  const src = read(LAYOUT_JS);
  // The DEFAULTS object must carry the toolbar zone with mode: 'screenplay'.
  assert.ok(/toolbar:\s*\{\s*mode:\s*['"]screenplay['"]/.test(src),
    'Layout DEFAULTS must include toolbar: { mode: "screenplay" } (default mode)');
});

test('§D4: Layout.get() and Layout._cloneDeepDefaults() include the toolbar zone', () => {
  const src = read(LAYOUT_JS);
  // Direct contract checks — these two lines must appear somewhere
  // in layout.js (the function-body regex is brittle because the
  // Object.assign({}) literals contain inner braces).
  assert.ok(/toolbar:\s*Object\.assign\(\{\},\s*DEFAULTS\.toolbar\)/.test(src),
    '_cloneDeepDefaults must initialize the toolbar zone via Object.assign({}, DEFAULTS.toolbar)');
  assert.ok(/toolbar:\s*Object\.assign\(\{\},\s*_current\.toolbar\)/.test(src),
    'get() must return the toolbar zone via Object.assign({}, _current.toolbar) — so toJSON / WorkspaceState persists it');
});

test('§D4: fromJSON knownZones validation list includes "toolbar"', () => {
  const src = read(LAYOUT_JS);
  const knownMatch = src.match(/const knownZones\s*=\s*\[[^\]]+\]/);
  assert.ok(knownMatch, 'knownZones array must exist in fromJSON');
  assert.ok(/['"]toolbar['"]/.test(knownMatch[0]),
    'knownZones must include "toolbar" so fromJSON validates the persisted zone shape');
});

test('§D4: Layout boots with toolbar.mode default; set + get round-trips through toJSON', () => {
  // End-to-end test: boot a fresh Layout, verify defaults, switch mode,
  // verify toJSON carries the change, then fromJSON restores it.
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
  const prevWindow = global.window;
  const prevDocument = global.document;
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  try {
    delete require.cache[require.resolve(LAYOUT_JS)];
    require(LAYOUT_JS);
    const Layout = global.window.Rga.Shell.Layout;
    Layout._reset();
    // Default
    assert.equal(Layout.get().toolbar.mode, 'screenplay',
      'default toolbar.mode must be "screenplay"');
    // Set
    Layout.set({ toolbar: { mode: 'text' } });
    assert.equal(Layout.get().toolbar.mode, 'text',
      'Layout.set must update toolbar.mode');
    // toJSON carries it
    const blob = Layout.toJSON();
    assert.equal(blob.toolbar.mode, 'text',
      'toJSON must serialise toolbar.mode (so WorkspaceState persists it)');
    // fromJSON restores it on a fresh state
    Layout._reset();
    assert.equal(Layout.get().toolbar.mode, 'screenplay');
    Layout.fromJSON({ toolbar: { mode: 'text' } });
    assert.equal(Layout.get().toolbar.mode, 'text',
      'fromJSON must restore toolbar.mode from the persisted blob');
  } finally {
    global.window = prevWindow;
    global.document = prevDocument;
  }
});

// ----------------------------------------------------------------
// 3. Wiring lives in format-toolbar.js, routes through Layout.set
// ----------------------------------------------------------------

test('§D4: format-toolbar.js wires the Mode group via Layout.set({ toolbar: { mode } })', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  // The mode wiring helper must exist and reference the Mode group
  // selector + Layout.set with a toolbar.mode partial.
  assert.ok(/_wireToolbarMode\s*\(/.test(src),
    '_wireToolbarMode helper must be defined and called from init()');
  assert.ok(/data-group="mode"/.test(src) || /rga-shell-toolbar-mode-btn/.test(src),
    'mode wiring must select the Mode group / mode buttons');
  assert.ok(/Rga\.Shell\.Layout\.set\([\s\S]{0,200}toolbar\s*:\s*\{\s*mode/.test(src),
    'mode wiring must call Rga.Shell.Layout.set({ toolbar: { mode: ... } }) — no new persistence surface');
});

test('§D4: mode wiring does NOT introduce a new localStorage key (uses WorkspaceState pipeline)', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  // Negative guard: format-toolbar.js must NOT call localStorage
  // directly for the mode toggle — persistence rides Layout +
  // WorkspaceState.
  assert.equal(/localStorage\.(set|get)Item\s*\(\s*['"]rga-(toolbar|mode|view-mode)/.test(src), false,
    'format-toolbar.js must NOT create a new rga-* localStorage key for the mode toggle');
});

test('§D4: mode switch does NOT unregister or re-register commands', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  // Negative guard: the toolbar mode helpers must not call any
  // KR.unregister / unregisterCommand path — Text mode is pure
  // visibility (CSS), commands stay live.
  const helpers = src.match(/function _(wire|read|apply)ToolbarMode[\s\S]*?\n  \}/g) || [];
  helpers.forEach(function(h) {
    assert.equal(/KR\.unregister|unregisterCommand|removeCommand/.test(h), false,
      'mode helpers must NOT unregister commands (Text mode is visibility-only)');
  });
});

test('§D4: mode switch does NOT mutate the PM editor (no view.dispatch in mode helpers)', () => {
  const src = read(FORMAT_TOOLBAR_JS);
  const helpers = src.match(/function _(wire|read|apply)ToolbarMode[\s\S]*?\n  \}/g) || [];
  helpers.forEach(function(h) {
    assert.equal(/view\.dispatch|state\.tr/.test(h), false,
      'mode helpers must NOT touch the PM editor (no editor mutations — pure UI toggle)');
  });
});

// ----------------------------------------------------------------
// 4. CSS visibility rules for Text mode
// ----------------------------------------------------------------

test('§D4: CSS hides Scene + Writing groups when #rga-shell-toolbar[data-mode="text"]', () => {
  const css = read(SHELL_CSS);
  // Find a rule that selects [data-mode="text"] AND hides scene + writing.
  // Allow them to be in a comma-separated selector list (more concise).
  const sceneHide = css.match(/#rga-shell-toolbar\[data-mode="text"\][^,{]*data-group="scene"[^{]*/);
  const writingHide = css.match(/#rga-shell-toolbar\[data-mode="text"\][^,{]*data-group="writing"[^{]*/);
  assert.ok(sceneHide,   'CSS must hide the Scene group in Text mode');
  assert.ok(writingHide, 'CSS must hide the Writing group in Text mode');
  // Verify display:none is the hiding mechanism (no destructive removal).
  // Find the block containing one of the hides and ensure display: none is its rule body.
  const ruleBlock = css.match(/#rga-shell-toolbar\[data-mode="text"\][\s\S]{0,800}?\{[\s\S]*?display\s*:\s*none[\s\S]*?\}/);
  assert.ok(ruleBlock,
    'the Text-mode hide rule must use display: none (pure visibility — DOM stays, commands stay)');
});

test('§D4: CSS collapses the orphan group-seps adjacent to hidden Scene/Writing groups', () => {
  const css = read(SHELL_CSS);
  // The two sep-hide selectors use :has(+ ...) to detect orphans.
  const sepBeforeScene = /#rga-shell-toolbar\[data-mode="text"\][\s\S]*?:has\(\s*\+\s*\.rga-shell-toolbar-group\[data-group="scene"\]\s*\)/;
  const sepBeforeWriting = /#rga-shell-toolbar\[data-mode="text"\][\s\S]*?:has\(\s*\+\s*\.rga-shell-toolbar-group\[data-group="writing"\]\s*\)/;
  assert.ok(sepBeforeScene.test(css),
    'CSS must collapse the group-sep before the Scene group in Text mode (:has(+ ...))');
  assert.ok(sepBeforeWriting.test(css),
    'CSS must collapse the group-sep before the Writing group in Text mode (:has(+ ...))');
});

// ----------------------------------------------------------------
// 5. Prior contracts intact
// ----------------------------------------------------------------

test('§D4: D1.1 alignment + D2 scene tools + D3 writing tools all intact', () => {
  const html = read(INDEX_HTML);
  const css  = read(SHELL_CSS);
  const src  = read(FORMAT_TOOLBAR_JS);
  // D1.1 — toolbar inner still consumes --page-width.
  const innerRule = css.match(/(?:^|\n)\s*\.rga-shell-toolbar-inner\s*\{[^}]*\}/);
  assert.ok(innerRule, '.rga-shell-toolbar-inner rule must still exist');
  assert.ok(/var\(\s*--page-width/.test(innerRule[0]),
    '.rga-shell-toolbar-inner must still consume var(--page-width) — D1.1 alignment preserved');
  assert.ok(/grid-column\s*:\s*4/.test(innerRule[0]),
    '.rga-shell-toolbar-inner must still declare grid-column: 4 — D1.1 preserved');
  // D2 — block-type + + Scene still wired.
  assert.ok(/<select[^>]*id="rga-shell-toolbar-blocktype"/.test(html),
    'D2 block-type dropdown must still exist');
  assert.ok(/<button[^>]*data-command="scene\.insert"/.test(html),
    'D2 + Scene button must still exist');
  assert.ok(/registerCommand\(\{[^}]*command:\s*['"]scene\.insert['"]/.test(src),
    'D2 scene.insert command must still be registered');
  // D3 — Note/Flag/Tag/Undo/Redo still wired.
  assert.ok(/<button[^>]*data-command="writing\.note"/.test(html),
    'D3 Note button must still exist');
  assert.ok(/<button[^>]*data-command="writing\.flag"/.test(html),
    'D3 Flag button must still exist');
  assert.ok(/<select[^>]*id="rga-shell-toolbar-tag"/.test(html),
    'D3 Tag dropdown must still exist');
  assert.ok(/<button[^>]*data-command="edit\.undo"/.test(html),
    'D3 Undo button must still exist');
  assert.ok(/<button[^>]*data-command="edit\.redo"/.test(html),
    'D3 Redo button must still exist');
});

// ----------------------------------------------------------------
// 6. Mode-toggle group geometry uses existing ownership only
// ----------------------------------------------------------------

test('§D4: Mode buttons reuse the existing .rga-shell-toolbar-btn--text style (no visual invention)', () => {
  const html = read(INDEX_HTML);
  const screenplayBtn = html.match(/<button[^>]*data-toolbar-mode="screenplay"[^>]*>/);
  const textBtn       = html.match(/<button[^>]*data-toolbar-mode="text"[^>]*>/);
  assert.ok(screenplayBtn && textBtn);
  // Both must carry the existing text-button class (--text variant
  // already used by D2/D3 — no new sizing/typography invented).
  assert.ok(/rga-shell-toolbar-btn--text/.test(screenplayBtn[0]),
    'Screenplay button must reuse the existing .rga-shell-toolbar-btn--text style');
  assert.ok(/rga-shell-toolbar-btn--text/.test(textBtn[0]),
    'Text button must reuse the existing .rga-shell-toolbar-btn--text style');
});
