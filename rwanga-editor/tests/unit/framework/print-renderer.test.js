// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 7 — PrintRenderer unit tests.
//
// Covers acceptance gates at the renderer layer:
//   ✓ one-page fixture renders one .rga-page-sheet
//   ✓ overflow fixture renders N .rga-page-sheet (one per PageMap page)
//   ✓ 100-scene fixture renders many sheets
//   ✓ PrintRenderer reads from RenderModel, not editor DOM
//     (verified: tests boot WITHOUT any EditorView)
//   ✓ no measurement calls (renderer body grep — see structural test)
//   ✓ heading composition lives in the renderer, not the model
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  const paths = [
    '../../../renderer/js/framework/slug-resolver.js',
    '../../../renderer/js/framework/print-renderer.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  return { PR: global.window.Rga.PrintRenderer };
}

// Synthetic RenderModel — keeps tests fast and independent of the upstream
// pipeline. Mark `inlineRuns` is the post-builder shape.
function fakeModel(pages) {
  return {
    totalPages: pages.length,
    pages: pages.map(function(p, i) {
      return {
        pageNumber: p.pageNumber || (i + 1),
        usedLines: p.usedLines || 0,
        availableLines: p.availableLines || 54,
        blocks: p.blocks || []
      };
    }),
    layoutProfile: null
  };
}

function headingBlock(setting, location, time, opts) {
  opts = opts || {};
  return Object.assign({
    type: 'sceneHeading',
    pmFrom: 0, pmTo: 0,
    sceneNodeId: opts.sceneNodeId || null,
    sceneNumber: opts.sceneNumber || null,
    heading: { setting: setting, location: location, time: time },
    inlineRuns: []
  });
}
function textBlock(type, text, marks) {
  return {
    type: type,
    pmFrom: 0, pmTo: 0,
    sceneNodeId: null, sceneNumber: null,
    text: text,
    inlineRuns: [{ text: text, marks: marks || [] }]
  };
}

// ----------------------------------------------------------------
// One sheet per page
// ----------------------------------------------------------------

test('one-page model renders exactly one .rga-page-sheet element', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  const model = fakeModel([{ blocks: [headingBlock('INT.', 'ROOM', 'DAY')] }]);
  PR.render(model, container);
  assert.equal(container.querySelectorAll('.rga-page-sheet').length, 1);
  assert.equal(PR.sheetCount(container), 1);
});

test('two-page model renders exactly two .rga-page-sheet elements', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  const model = fakeModel([
    { pageNumber: 1, blocks: [textBlock('action', 'Page 1.')] },
    { pageNumber: 2, blocks: [textBlock('action', 'Page 2.')] }
  ]);
  PR.render(model, container);
  const sheets = container.querySelectorAll('.rga-page-sheet');
  assert.equal(sheets.length, 2);
  assert.equal(sheets[0].dataset.pageNumber, '1');
  assert.equal(sheets[1].dataset.pageNumber, '2');
});

test('many-page model renders one sheet per page (100-scene scale)', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  const pages = [];
  for (let i = 1; i <= 50; i += 1) pages.push({ pageNumber: i, blocks: [textBlock('action', 'p' + i)] });
  PR.render(fakeModel(pages), container);
  assert.equal(container.querySelectorAll('.rga-page-sheet').length, 50);
});

// ----------------------------------------------------------------
// Sheet structure
// ----------------------------------------------------------------

test('each sheet carries a page header (top-right) with "N." text', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  PR.render(fakeModel([{ pageNumber: 7, blocks: [] }]), container);
  const header = container.querySelector('.rga-page-sheet-header');
  assert.ok(header);
  assert.equal(header.textContent, '7.');
});

test('each sheet carries role="document" + aria-label "Page N of M"', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  PR.render(fakeModel([
    { pageNumber: 1, blocks: [] },
    { pageNumber: 2, blocks: [] }
  ]), container);
  const sheets = container.querySelectorAll('.rga-page-sheet');
  assert.equal(sheets[0].getAttribute('role'), 'document');
  assert.equal(sheets[0].getAttribute('aria-label'), 'Page 1 of 2');
  assert.equal(sheets[1].getAttribute('aria-label'), 'Page 2 of 2');
});

test('empty RenderModel renders one blank sheet (not zero) — preview always shows paper', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  PR.render(fakeModel([]), container);
  assert.equal(container.querySelectorAll('.rga-page-sheet').length, 1);
  assert.equal(container.querySelector('.rga-page-sheet-header').textContent, '1.');
});

// ----------------------------------------------------------------
// Block rendering
// ----------------------------------------------------------------

test('sceneHeading block composes display from structured parts: "INT. ROOM — DAY"', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  PR.render(fakeModel([{ blocks: [headingBlock('INT.', 'ROOM', 'DAY')] }]), container);
  const heading = container.querySelector('.rga-print-block-sceneHeading');
  assert.equal(heading.textContent, 'INT. ROOM — DAY');
});

test('sceneHeading with empty parts skips separator gracefully', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  PR.render(fakeModel([{ blocks: [headingBlock('', 'LOCATION ONLY', '')] }]), container);
  assert.equal(container.querySelector('.rga-print-block-sceneHeading').textContent, 'LOCATION ONLY');
});

test('action / character / dialogue / transition blocks get type-specific CSS class', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  PR.render(fakeModel([{ blocks: [
    textBlock('action', 'A'),
    textBlock('character', 'B'),
    textBlock('parenthetical', '(c)'),
    textBlock('dialogue', 'D'),
    textBlock('shot', 'E'),
    textBlock('transition', 'CUT')
  ] }]), container);
  ['action','character','parenthetical','dialogue','shot','transition'].forEach(function(t) {
    assert.ok(container.querySelector('.rga-print-block-' + t), t);
  });
});

test('first block on a page receives .rga-print-block-first', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  PR.render(fakeModel([{ blocks: [textBlock('action', 'first'), textBlock('action', 'second')] }]), container);
  const blocks = container.querySelectorAll('.rga-print-block-action');
  assert.ok(blocks[0].classList.contains('rga-print-block-first'));
  assert.ok(!blocks[1].classList.contains('rga-print-block-first'));
});

test('block carries data-block-type + data-scene-id + data-scene-number attributes', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  PR.render(fakeModel([{ blocks: [headingBlock('INT.', 'A', 'DAY', { sceneNodeId: 'sc-1', sceneNumber: 1 })] }]), container);
  const h = container.querySelector('.rga-print-block-sceneHeading');
  assert.equal(h.dataset.blockType, 'sceneHeading');
  assert.equal(h.dataset.sceneId, 'sc-1');
  assert.equal(h.dataset.sceneNumber, '1');
});

// ----------------------------------------------------------------
// Fork A — click-to-edit anchors: every rendered block carries its
// PM document position so the read-only Paper view can return the
// caret to Flow. Source: RenderModel block pmFrom / pmTo.
// ----------------------------------------------------------------

test('block carries data-pm-from / data-pm-to from the RenderModel block pm positions', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  const b = textBlock('action', 'hello');
  b.pmFrom = 12;
  b.pmTo = 19;
  PR.render(fakeModel([{ blocks: [b] }]), container);
  const el = container.querySelector('.rga-print-block-action');
  assert.equal(el.dataset.pmFrom, '12');
  assert.equal(el.dataset.pmTo, '19');
});

test('data-pm-from is stamped even when pmFrom is 0 (0 is a valid document position)', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  const b = textBlock('action', 'top');
  b.pmFrom = 0;
  b.pmTo = 5;
  PR.render(fakeModel([{ blocks: [b] }]), container);
  const el = container.querySelector('.rga-print-block-action');
  assert.equal(el.dataset.pmFrom, '0');
  assert.equal(el.dataset.pmTo, '5');
});

test('sceneHeading block also carries data-pm-from / data-pm-to', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  const h = headingBlock('INT.', 'ROOM', 'DAY');
  h.pmFrom = 30;
  h.pmTo = 44;
  PR.render(fakeModel([{ blocks: [h] }]), container);
  const el = container.querySelector('.rga-print-block-sceneHeading');
  assert.equal(el.dataset.pmFrom, '30');
  assert.equal(el.dataset.pmTo, '44');
});

// ----------------------------------------------------------------
// Inline mark rendering — fidelity gates
// ----------------------------------------------------------------

test('bold mark wraps text in <strong>', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  PR.render(fakeModel([{ blocks: [textBlock('action', 'bold-bit', [{type:'bold',attrs:{}}])] }]), container);
  const strong = container.querySelector('.rga-print-block-action strong');
  assert.ok(strong);
  assert.equal(strong.textContent, 'bold-bit');
});

test('italic / underline / strikethrough produce appropriate elements/styles', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  PR.render(fakeModel([{ blocks: [
    textBlock('action', 'em',     [{type:'italic',attrs:{}}]),
    textBlock('action', 'under',  [{type:'underline',attrs:{}}]),
    textBlock('action', 'strike', [{type:'strikethrough',attrs:{}}])
  ] }]), container);
  assert.ok(container.querySelector('em'));
  const blocks = container.querySelectorAll('.rga-print-block-action');
  assert.match(blocks[1].innerHTML, /text-decoration: underline/);
  assert.match(blocks[2].innerHTML, /text-decoration: line-through/);
});

test('color + highlight marks apply inline color / background-color styles', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  PR.render(fakeModel([{ blocks: [
    textBlock('action', 'red',    [{type:'color',     attrs:{color:'#ff0000'}}]),
    textBlock('action', 'yellow', [{type:'highlight', attrs:{color:'#ffff00'}}])
  ] }]), container);
  const blocks = container.querySelectorAll('.rga-print-block-action');
  assert.match(blocks[0].innerHTML, /color: (red|rgb\(255, 0, 0\)|#ff0000)/i);
  assert.match(blocks[1].innerHTML, /background-color: (yellow|rgb\(255, 255, 0\)|#ffff00)/i);
});

test('annotation / tag / revisionFlag marks are NOT decorated in print (working marks)', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  PR.render(fakeModel([{ blocks: [
    textBlock('action', 'plain', [
      { type: 'annotation',   attrs: { id: 'n', color: '#ff0', text: '', status: 'open' } },
      { type: 'tag',          attrs: { tagType: 'character', entityId: 'e' } },
      { type: 'revisionFlag', attrs: { id: 'f', color: '#f00', reason: '', status: 'open' } }
    ])
  ] }]), container);
  const block = container.querySelector('.rga-print-block-action');
  // No <span class="rga-annotation"> etc. should appear; text renders unwrapped.
  assert.equal(block.textContent, 'plain');
  assert.equal(block.querySelectorAll('span, strong, em, a').length, 0);
});

// ----------------------------------------------------------------
// Idempotent re-render (sheet count tracks model on every call)
// ----------------------------------------------------------------

test('re-rendering with a different model clears previous sheets', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  PR.render(fakeModel([{blocks:[]}, {blocks:[]}, {blocks:[]}]), container);
  assert.equal(container.querySelectorAll('.rga-page-sheet').length, 3);
  PR.render(fakeModel([{blocks:[]}]), container);
  assert.equal(container.querySelectorAll('.rga-page-sheet').length, 1);
});

test('renders with no editor present — does not touch any editor DOM', () => {
  const { PR } = boot();
  // document.body has no editor element at all.
  assert.equal(document.querySelectorAll('.ProseMirror, .rga-scene-v3, [contenteditable]').length, 0);
  const container = document.createElement('div');
  document.body.appendChild(container);
  PR.render(fakeModel([{ blocks: [textBlock('action', 'x')] }]), container);
  assert.equal(container.querySelectorAll('.rga-page-sheet').length, 1);
});

// ----------------------------------------------------------------
// Anti-pattern guard — source file must contain none of these
// ----------------------------------------------------------------
test('print-renderer.js source has no DOM measurement call sites', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '../../../renderer/js/framework/print-renderer.js'), 'utf8');
  // Strip line comments before grepping so the header's negation comments
  // don't trigger false positives. We only care about actual call sites.
  const code = src
    .split('\n')
    .map(function(line) { const idx = line.indexOf('//'); return idx >= 0 ? line.slice(0, idx) : line; })
    .join('\n');
  // Each banned token must NOT appear as a call (`token(`) or property access
  // (`.token`) anywhere in real code.
  ['getBoundingClientRect', 'offsetHeight', 'offsetWidth', 'clientHeight', 'clientWidth', 'getComputedStyle']
    .forEach(function(banned) {
      const calledAsFn = new RegExp('\\b' + banned + '\\(').test(code);
      const accessedAsProp = new RegExp('\\.' + banned + '\\b').test(code);
      assert.equal(calledAsFn || accessedAsProp, false, 'print-renderer.js uses banned API: ' + banned);
    });
});

// ----------------------------------------------------------------
// RTL Recovery Slice 1 — document direction on the page sheet
// ----------------------------------------------------------------

test('RTL Slice1 — page sheet carries dir="rtl" for an rtl document', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  const model = fakeModel([{ blocks: [textBlock('action', 'سڵاو')] }]);
  model.layoutProfile = { direction: 'rtl' };
  PR.render(model, container, {});
  const sheet = container.querySelector('.rga-page-sheet');
  assert.equal(sheet.getAttribute('dir'), 'rtl',
    'an rtl document must paint the page sheet with dir="rtl" so the RTL font chain reaches print');
});

test('RTL Slice1 — page sheet has no rtl direction for an ltr document', () => {
  const { PR } = boot();
  const container = document.createElement('div');
  const model = fakeModel([{ blocks: [textBlock('action', 'hello')] }]);
  model.layoutProfile = { direction: 'ltr' };
  PR.render(model, container, {});
  const sheet = container.querySelector('.rga-page-sheet');
  assert.notEqual(sheet.getAttribute('dir'), 'rtl',
    'an ltr document must not get dir="rtl" on the page sheet');
});
