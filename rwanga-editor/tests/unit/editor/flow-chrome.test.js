// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// FlowChrome — _lineTops slug short-circuit tests.
//
// These tests verify the fix for the duplicate gutter line number bug on
// slug headings. The v3 SceneHeadingNodeView emits multiple inline children
// (setting picker, em-dash separator, time picker, slash separator, location
// text span). Walking range.getClientRects() on the slug returned 2+ rects
// with tops 1–3px apart, defeating the 1px dedup and producing two stacked
// gutter numbers per slug.
//
// Fix: _lineTops short-circuits for .rga-scene-heading-v3 elements —
// uses a single getBoundingClientRect() instead of range.getClientRects().
//
// jsdom returns zero-rect geometry by default. We stub getBoundingClientRect
// and document.createRange/getClientRects on test elements to inject
// controlled top values.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');

const FLOW_CHROME_JS = path.resolve(__dirname, '../../../renderer/js/flow-chrome.js');

// ----------------------------------------------------------------
// Boot helper — sets up a minimal jsdom + loads flow-chrome.js
// ----------------------------------------------------------------

function boot() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
    '<div id="editor-container">' +
    '  <div id="flow-line-gutter" class="flow-line-gutter"></div>' +
    '  <div id="editor"></div>' +
    '</div>' +
    '</body></html>',
    { url: 'http://localhost/' }
  );

  global.window   = dom.window;
  global.document = dom.window.document;

  global.window.Rga = {};
  // Stub ViewMode so _isFlow() returns true in rebuildLineNumbers
  global.window.Rga.ViewMode = {
    get:      function() { return 'flow'; },
    onChange: function() {}
  };

  // Stub document.createRange to make getClientRects controllable per-test.
  // Tests that need custom rects must override this on the test element directly.
  // The default createRange returns empty rects (jsdom default).
  // We expose a helper that creates a stubbed range returning given rects.
  dom.window.document._makeStubRange = function(rects) {
    return {
      selectNodeContents: function() {},
      getClientRects: function() { return rects || []; }
    };
  };

  delete require.cache[require.resolve(FLOW_CHROME_JS)];
  require(FLOW_CHROME_JS);

  const FlowChrome = global.window.Rga.FlowChrome;
  return { dom, FlowChrome, document: dom.window.document };
}

// Helper: create a slug heading element (.rga-scene-heading-v3)
// and stub getBoundingClientRect to return a controlled top.
function makeSlug(doc, topPx) {
  const el = doc.createElement('div');
  el.className = 'rga-scene-heading-v3';
  // Add inner children matching the real v3 NodeView structure
  const setting = doc.createElement('select');
  setting.className = 'rga-scene-heading-v3-setting';
  const sep1 = doc.createElement('span');
  sep1.className = 'rga-scene-heading-v3-sep';
  sep1.textContent = ' — ';
  const time = doc.createElement('select');
  time.className = 'rga-scene-heading-v3-time';
  const sep2 = doc.createElement('span');
  sep2.className = 'rga-scene-heading-v3-sep';
  sep2.textContent = ' / ';
  const loc = doc.createElement('span');
  loc.className = 'rga-scene-heading-v3-location';
  loc.textContent = 'OLD HOUSE — ROSE GARDEN';
  el.appendChild(setting);
  el.appendChild(sep1);
  el.appendChild(time);
  el.appendChild(sep2);
  el.appendChild(loc);

  el.getBoundingClientRect = function() {
    return { top: topPx, bottom: topPx + 18, left: 0, right: 600, width: 600, height: 18 };
  };
  return el;
}

// Helper: create an action block element and stub its geometry.
// supplyRects: array of {top, bottom} objects simulating wrapped visual lines.
function makeActionBlock(doc, rectsData) {
  const el = doc.createElement('div');
  el.className = 'rga-block-action';
  el.textContent = 'This is a long action line that wraps in the column.';

  // Override createRange for this element by patching document.createRange
  // only for calls that selectNodeContents(el). We use a simpler approach:
  // store rects on the element and intercept in the test.
  el._testRects = rectsData.map(function(r) {
    return { top: r.top, bottom: r.bottom, left: 0, right: 600 };
  });
  el.getBoundingClientRect = function() {
    return { top: rectsData[0].top, bottom: rectsData[rectsData.length - 1].bottom, left: 0, right: 600, height: rectsData[rectsData.length - 1].bottom - rectsData[0].top, width: 600 };
  };
  return el;
}

// ----------------------------------------------------------------
// Patch createRange on document to route _testRects per element.
// We call this per-test so each test controls what rects are returned.
// ----------------------------------------------------------------
function patchCreateRange(doc) {
  doc.createRange = function() {
    let targetEl = null;
    return {
      selectNodeContents: function(el) { targetEl = el; },
      getClientRects: function() {
        if (targetEl && targetEl._testRects) {
          return targetEl._testRects;
        }
        return [];
      }
    };
  };
}

// ================================================================
// Test 1: _lineTops for a slug element returns exactly one top value
// ================================================================

test('_lineTops: slug heading (.rga-scene-heading-v3) returns exactly one top', () => {
  const { FlowChrome, document } = boot();
  patchCreateRange(document);

  const slug = makeSlug(document, 100);
  const originY = 0;

  const tops = FlowChrome._lineTops(slug, originY);

  assert.equal(tops.length, 1,
    'Slug must produce exactly one top value regardless of internal inline children');
  assert.equal(tops[0], 100,
    'The single top must be getBoundingClientRect().top minus originY');
});

test('_lineTops: slug heading uses getBoundingClientRect, not range.getClientRects', () => {
  const { FlowChrome, document } = boot();
  patchCreateRange(document);

  // Create a slug but override getBoundingClientRect to report top=200,
  // while _testRects would report a different set of tops.
  // If the fix is working, we should get 200, not the testRects tops.
  const slug = makeSlug(document, 200);
  // Override _testRects to simulate getClientRects returning multi-rect result
  // that would produce tops [200, 202] (1–3px gap defeating 1px dedup).
  slug._testRects = [
    { top: 200, bottom: 209, left: 0, right: 600 },
    { top: 202, bottom: 218, left: 0, right: 600 }  // 2px gap — would defeat dedup
  ];

  const tops = FlowChrome._lineTops(slug, 0);

  assert.equal(tops.length, 1, 'Must short-circuit: only one top even when getClientRects would produce 2');
  assert.equal(tops[0], 200, 'Top must come from getBoundingClientRect, not getClientRects');
});

// ================================================================
// Test 2: Action / dialogue / paragraph rows still number normally
//         (wrapped lines → multiple gutter numbers; non-slug uses
//          range.getClientRects path unchanged)
// ================================================================

test('_lineTops: action block with two wrapped visual lines returns two tops', () => {
  const { FlowChrome, document } = boot();
  patchCreateRange(document);

  // Simulate a wrapped action block: two visual lines 18px apart
  const action = makeActionBlock(document, [
    { top: 50, bottom: 68 },
    { top: 68, bottom: 86 }
  ]);
  const originY = 0;

  const tops = FlowChrome._lineTops(action, originY);

  assert.equal(tops.length, 2,
    'Wrapped action block must produce two tops (one per visual line)');
  assert.equal(tops[0], 50);
  assert.equal(tops[1], 68);
});

test('_lineTops: 1px dedup threshold is unchanged for non-slug elements', () => {
  const { FlowChrome, document } = boot();
  patchCreateRange(document);

  // Three rects: first two have tops 0px and 1px apart (should be deduped),
  // third is 18px after first (should survive).
  const action = doc => {
    const el = document.createElement('div');
    el.className = 'rga-block-action';
    el._testRects = [
      { top: 50, bottom: 68, left: 0, right: 600 },
      { top: 51, bottom: 68, left: 0, right: 600 },   // 1px gap — deduped (>1 is threshold)
      { top: 68, bottom: 86, left: 0, right: 600 }    // 18px gap — survives
    ];
    el.getBoundingClientRect = function() { return { top: 50, bottom: 86, left: 0, right: 600, height: 36, width: 600 }; };
    return el;
  };

  const tops = FlowChrome._lineTops(action(), 0);

  // 50 is included, 51 is dropped (51 - 50 = 1, not > 1), 68 is included (68 - 50 = 18 > 1)
  assert.equal(tops.length, 2, '1px gap is deduped; 18px gap survives');
  assert.equal(tops[0], 50);
  assert.equal(tops[1], 68);
});

test('_lineTops: single-line action block returns one top', () => {
  const { FlowChrome, document } = boot();
  patchCreateRange(document);

  const action = makeActionBlock(document, [
    { top: 75, bottom: 93 }
  ]);

  const tops = FlowChrome._lineTops(action, 0);

  assert.equal(tops.length, 1);
  assert.equal(tops[0], 75);
});

test('_lineTops: empty element (no rects) still contributes one top from getBoundingClientRect', () => {
  const { FlowChrome, document } = boot();
  patchCreateRange(document);

  const el = document.createElement('div');
  el.className = 'rga-block-action';
  el._testRects = []; // empty — no rects
  el.getBoundingClientRect = function() { return { top: 200, bottom: 218, left: 0, right: 600, height: 18, width: 600 }; };

  const tops = FlowChrome._lineTops(el, 0);

  assert.equal(tops.length, 1, 'Empty block must still produce one top');
  assert.equal(tops[0], 200, 'Falls back to getBoundingClientRect.top');
});

// ================================================================
// Test 3: originY offset is applied correctly (slug + action)
// ================================================================

test('_lineTops: originY offset is subtracted from slug top', () => {
  const { FlowChrome, document } = boot();
  patchCreateRange(document);

  const slug = makeSlug(document, 250); // absolute top = 250
  const originY = 50;

  const tops = FlowChrome._lineTops(slug, originY);

  assert.equal(tops[0], 200, 'top - originY should be 250 - 50 = 200');
});

test('_lineTops: originY offset is subtracted from action tops', () => {
  const { FlowChrome, document } = boot();
  patchCreateRange(document);

  const action = makeActionBlock(document, [
    { top: 100, bottom: 118 },
    { top: 118, bottom: 136 }
  ]);
  const originY = 30;

  const tops = FlowChrome._lineTops(action, originY);

  assert.equal(tops[0], 70,  'First visual line: 100 - 30 = 70');
  assert.equal(tops[1], 88,  'Second visual line: 118 - 30 = 88');
});

// ================================================================
// Test 4: .rga-scene-v3-num selector is absent from _collectRowElements
//         (regression guard for Phase C correction)
// ================================================================

test('_collectRowElements: .rga-scene-v3-num is NOT in the selector list (Phase C regression guard)', () => {
  const src = fs.readFileSync(FLOW_CHROME_JS, 'utf8');

  // The selector list is the array literal in _collectRowElements.
  // Extract the selectors array content between the opening '[' and ']'.
  const selectorArrayMatch = src.match(/const selectors\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(selectorArrayMatch, '_collectRowElements must contain a "const selectors = [...]" array');

  const selectorArray = selectorArrayMatch[1];
  assert.ok(!selectorArray.includes('rga-scene-v3-num'),
    '.rga-scene-v3-num must NOT be in the selectors array — it is non-authorial chrome (Phase C correction). ' +
    'Found in selectors: ' + selectorArray);
});

test('_collectRowElements: .rga-scene-heading-v3 IS in the selector list', () => {
  const src = fs.readFileSync(FLOW_CHROME_JS, 'utf8');
  const selectorArrayMatch = src.match(/const selectors\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(selectorArrayMatch);
  const selectorArray = selectorArrayMatch[1];
  assert.ok(selectorArray.includes('rga-scene-heading-v3'),
    '.rga-scene-heading-v3 must remain in the selectors array (it IS a row; the short-circuit gives it one number)');
});

// ================================================================
// Test 5: Multi-scene fixture — each slug gets exactly one number;
//         total gutter count does not accumulate drift.
// ================================================================

test('rebuildLineNumbers: three-scene document — each slug contributes one gutter entry, no drift', () => {
  const { FlowChrome, document } = boot();
  patchCreateRange(document);

  // Build a fake editor DOM: 3 scenes, each with 1 slug + 1 action block.
  const editor = document.getElementById('editor');

  // Scene 1
  const slug1 = makeSlug(document, 18);   // line 1
  const act1  = makeActionBlock(document, [{ top: 36, bottom: 54 }]);  // line 2
  act1.className = 'rga-scene-v3-content rga-block-action'; // ensure it matches selector

  // Scene 2
  const slug2 = makeSlug(document, 72);   // line 3
  const act2  = makeActionBlock(document, [{ top: 90, bottom: 108 }]); // line 4
  act2.className = 'rga-scene-v3-content rga-block-action';

  // Scene 3
  const slug3 = makeSlug(document, 126);  // line 5
  const act3  = makeActionBlock(document, [{ top: 144, bottom: 162 }]); // line 6
  act3.className = 'rga-scene-v3-content rga-block-action';

  // Nest inside scene content containers to match _collectRowElements selectors
  // Selector: '.rga-scene-heading-v3' and '.rga-scene-v3-content .rga-block-action'
  function makeScene(slug, action) {
    const scene = document.createElement('div');
    scene.className = 'rga-scene-v3';
    scene.appendChild(slug);
    const content = document.createElement('div');
    content.className = 'rga-scene-v3-content';
    const actionEl = document.createElement('div');
    actionEl.className = 'rga-block-action';
    actionEl._testRects = action._testRects;
    actionEl.getBoundingClientRect = action.getBoundingClientRect;
    content.appendChild(actionEl);
    scene.appendChild(content);
    return scene;
  }

  editor.appendChild(makeScene(slug1, act1));
  editor.appendChild(makeScene(slug2, act2));
  editor.appendChild(makeScene(slug3, act3));

  // Stub gutter getBoundingClientRect (originY)
  const gutter = document.getElementById('flow-line-gutter');
  gutter.getBoundingClientRect = function() { return { top: 0, bottom: 600, left: 0, right: 20, height: 600, width: 20 }; };

  FlowChrome._rebuildLineNumbers();

  const lineNums = gutter.querySelectorAll('.flow-line-num');
  assert.equal(lineNums.length, 6,
    'Three scenes × (1 slug + 1 action) = 6 line numbers. Got: ' + lineNums.length);

  // Verify sequential numbering with no drift
  const nums = Array.prototype.slice.call(lineNums).map(function(d) {
    return parseInt(d.textContent, 10);
  });
  assert.deepEqual(nums, [1, 2, 3, 4, 5, 6],
    'Line numbers must be 1..6 with no duplicates or gaps. Got: ' + nums.join(','));
});

test('rebuildLineNumbers: slug with multi-rect NodeView children still gets ONE number (integration)', () => {
  const { FlowChrome, document } = boot();
  patchCreateRange(document);

  const editor = document.getElementById('editor');

  // One scene: slug that has multiple rects (simulating getClientRects behaviour
  // if we hadn't applied the fix) + one action block.
  const slug = makeSlug(document, 30);
  // Ensure the slug's _testRects simulates what range.getClientRects would return
  // if the short-circuit weren't present (2 rects, 2px apart — defeats 1px dedup).
  slug._testRects = [
    { top: 30, bottom: 39, left: 0, right: 600 },
    { top: 32, bottom: 48, left: 0, right: 600 }
  ];

  const scene = document.createElement('div');
  scene.className = 'rga-scene-v3';
  scene.appendChild(slug);
  const content = document.createElement('div');
  content.className = 'rga-scene-v3-content';
  const action = document.createElement('div');
  action.className = 'rga-block-action';
  action._testRects = [{ top: 60, bottom: 78, left: 0, right: 600 }];
  action.getBoundingClientRect = function() { return { top: 60, bottom: 78, left: 0, right: 600, height: 18, width: 600 }; };
  content.appendChild(action);
  scene.appendChild(content);
  editor.appendChild(scene);

  const gutter = document.getElementById('flow-line-gutter');
  gutter.getBoundingClientRect = function() { return { top: 0, bottom: 400, left: 0, right: 20, height: 400, width: 20 }; };

  FlowChrome._rebuildLineNumbers();

  const lineNums = gutter.querySelectorAll('.flow-line-num');
  assert.equal(lineNums.length, 2,
    'One slug + one action = 2 line numbers total (slug must NOT produce 2 due to multi-rect children). Got: ' + lineNums.length);

  const nums = Array.prototype.slice.call(lineNums).map(function(d) {
    return parseInt(d.textContent, 10);
  });
  assert.deepEqual(nums, [1, 2], 'Numbers must be [1, 2] — no phantom duplicate on slug. Got: ' + nums.join(','));
});

// ================================================================
// Source-level structural guards — the fix is correctly scoped
// ================================================================

test('flow-chrome.js: slug short-circuit uses getBoundingClientRect (not range)', () => {
  const src = fs.readFileSync(FLOW_CHROME_JS, 'utf8');
  assert.ok(/rga-scene-heading-v3/.test(src),
    'Source must reference rga-scene-heading-v3 (the short-circuit guard)');
  assert.ok(/getBoundingClientRect\(\)\.top\s*-\s*originY/.test(src),
    'Slug short-circuit must use getBoundingClientRect().top - originY');
  assert.ok(/getClientRects\s*\(/.test(src),
    'Non-slug path must still use getClientRects() (unchanged path)');
});

test('flow-chrome.js: _lineTops is exposed as a test hook on Rga.FlowChrome', () => {
  const src = fs.readFileSync(FLOW_CHROME_JS, 'utf8');
  assert.ok(/_lineTops\s*:/.test(src),
    '_lineTops must be exposed on Rga.FlowChrome for direct unit testing');
});

test('flow-chrome.js: 1px dedup threshold is still 1 (not bumped)', () => {
  const src = fs.readFileSync(FLOW_CHROME_JS, 'utf8');
  // The dedup guard is: top - lastTop > 1
  assert.ok(/lastTop\s*>\s*1\b/.test(src) || />\s*1\b[\s\S]{0,30}dedup|dedup[\s\S]{0,80}>\s*1\b/.test(src) || /top\s*-\s*lastTop\s*>\s*1/.test(src),
    '1px dedup threshold must remain at > 1, not bumped to a higher value');
  // Ensure it wasn't silently bumped to > 2 or > 3
  assert.ok(!/top\s*-\s*lastTop\s*>\s*[23456789]/.test(src),
    '1px threshold must NOT have been bumped to > 2 or higher (tolerance bump rejected)');
});
