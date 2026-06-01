// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 6 — PageMap engine unit tests.
//
// Covers acceptance gates:
//   ✓ exact one-page fixture
//   ✓ exact overflow fixture
//   ✓ long screenplay fixture
//   ✓ page counts stable
//   ✓ insertion updates pages   (NormalizedBlock[] re-built + repacked)
//   ✓ no visual page resizing   (fixed budget, no DOM measurement)
//   ✓ keep-with-next discipline
//   ✓ V1 no-split discipline (entire block moves to next page on overflow)
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
    '../../../renderer/js/framework/layout-profile.js',
    '../../../renderer/js/framework/pagemap-engine.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  return {
    LP: global.window.Rga.LayoutProfile,
    Engine: global.window.Rga.PageMap
  };
}

function block(opts) {
  const out = {
    nodeType: opts.nodeType,
    pmFrom: opts.pmFrom != null ? opts.pmFrom : 0,
    pmTo:   opts.pmTo   != null ? opts.pmTo   : 0,
    sceneNodeId: opts.sceneNodeId || null,
    sceneNumber: opts.sceneNumber != null ? opts.sceneNumber : null,
    blockIndexInScene: opts.blockIndexInScene != null ? opts.blockIndexInScene : null,
    keepWithNext: !!opts.keepWithNext,
    splittable:   false
  };
  // sceneHeading carries structured `heading`; everything else carries `text`.
  if (opts.nodeType === 'sceneHeading') {
    out.heading = opts.heading || {
      setting:  opts.setting  != null ? opts.setting  : 'INT.',
      location: opts.location != null ? opts.location : '',
      time:     opts.time     != null ? opts.time     : 'DAY'
    };
  } else {
    out.text = opts.text || '';
  }
  return out;
}

// ----------------------------------------------------------------
// measureBlock
// ----------------------------------------------------------------

test('measureBlock: empty action = 1 line of content + 1 leading = 2 lines (not first on page)', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  const lines = Engine.measureBlock(block({ nodeType: 'action', text: '' }), p, false);
  assert.equal(lines, 2);
});

test('measureBlock: action 60 chars = 1 content line + 1 leading = 2 lines', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  const lines = Engine.measureBlock(block({ nodeType: 'action', text: 'a'.repeat(60) }), p, false);
  assert.equal(lines, 2);
});

test('measureBlock: action 61 chars wraps to 2 content lines + 1 leading = 3 lines', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  const lines = Engine.measureBlock(block({ nodeType: 'action', text: 'a'.repeat(61) }), p, false);
  assert.equal(lines, 3);
});

test('measureBlock: when isFirstOnPage=true, leading blank is ignored', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  const lines = Engine.measureBlock(block({ nodeType: 'action', text: 'a'.repeat(60) }), p, true);
  assert.equal(lines, 1);
});

test('measureBlock: dialogue cpl=35 → 36 chars = 2 content lines + 0 leading = 2', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  const lines = Engine.measureBlock(block({ nodeType: 'dialogue', text: 'a'.repeat(36) }), p, false);
  assert.equal(lines, 2);
});

test('measureBlock: sceneHeading consumes structured {setting/location/time}; uses profile separators', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  // Hollywood default: "INT." + " " + "OLD HOUSE" + " — " + "DAY" = 4+1+9+3+3 = 20 chars.
  // sceneHeading cpl=60 → 20 chars wraps to 1 content line + 1 leading = 2 lines (not first on page).
  const b = block({ nodeType: 'sceneHeading', setting: 'INT.', location: 'OLD HOUSE', time: 'DAY' });
  assert.equal(Engine.measureBlock(b, p, false), 2);
});

test('measureBlock: sceneHeading with empty parts skips separator (no leading space/em-dash)', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  // Only location → "JUST LOCATION" = 13 chars → 1 line + 1 leading = 2 lines.
  const b = block({ nodeType: 'sceneHeading', setting: '', location: 'JUST LOCATION', time: '' });
  assert.equal(Engine.measureBlock(b, p, false), 2);
});

test('measureBlock: long sceneHeading wraps using profile cpl=60', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  // location 80 chars + "INT. " (5) + " — DAY" (6) = 91 chars → ceil(91/60) = 2 lines + 1 leading = 3.
  const b = block({ nodeType: 'sceneHeading', setting: 'INT.', location: 'A'.repeat(80), time: 'DAY' });
  assert.equal(Engine.measureBlock(b, p, false), 3);
});

// ----------------------------------------------------------------
// build — one-page / overflow / stability
// ----------------------------------------------------------------

test('exact ONE-PAGE fixture: 27 single-line actions fit on page 1 within safety budget', () => {
  // UPDATED 2026-05-19: linesPerPage is now 53 (was 54) after the P0 safety
  // reserve change. availableLines reflects the new budget.
  // 1 + 2*N <= 53 → N <= 26 → 27 total → usedLines = 1 + 26*2 = 53.
  // Exactly fills the budget (53 usedLines, 53 available). Still one page.
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  const blocks = [];
  for (let i = 0; i < 30; i += 1) {
    blocks.push(block({ nodeType: 'action', text: 'short' }));
  }
  // Costs: 1st block = 1 line (first on page), next 29 = 2 lines each = 58. Total 59 → overflows.
  // Use fewer: pick a count that fits within 53 (new linesPerPage after safety reserve).
  // 1 + 2*N <= 53 → N <= 26 → 26 more blocks → 27 total → cost = 1 + 26*2 = 53 lines.
  blocks.length = 27;
  const pages = Engine.build(blocks, p);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].pageNumber, 1);
  assert.equal(pages[0].availableLines, 53);   // UPDATED from 54 → 53
  assert.equal(pages[0].usedLines, 53);
  assert.equal(pages[0].blocks.length, 27);
});

test('exact OVERFLOW fixture: 28 single-line actions overflow to 2 pages', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  // 1 + 27*2 = 55 lines for 28 blocks → needs page 2.
  const blocks = [];
  for (let i = 0; i < 28; i += 1) blocks.push(block({ nodeType: 'action', text: 'short' }));
  const pages = Engine.build(blocks, p);
  assert.equal(pages.length, 2);
  // Page 1 holds 27 blocks (53 lines); page 2 the 28th (1 line, first on page).
  assert.equal(pages[0].blocks.length, 27);
  assert.equal(pages[1].blocks.length, 1);
  assert.equal(pages[1].usedLines, 1);
});

test('long screenplay: 500 short actions paginate into many pages', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  const blocks = [];
  for (let i = 0; i < 500; i += 1) blocks.push(block({ nodeType: 'action', text: 'short' }));
  const pages = Engine.build(blocks, p);
  // Each page after page-1 holds 27 blocks (1 leading-skipped + 26 × 2 = 53 lines).
  // Page 1 also 27. So ~ceil(500/27) ≈ 19 pages.
  assert.ok(pages.length >= 18 && pages.length <= 20, 'pages=' + pages.length);
  // All blocks accounted for, in order.
  const placed = pages.reduce(function(a, pg) { return a.concat(pg.blocks); }, []);
  assert.equal(placed.length, 500);
  for (let i = 0; i < 500; i += 1) assert.equal(placed[i], i);
});

test('page counts stable: running build twice on same input gives same shape', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  const blocks = [];
  for (let i = 0; i < 100; i += 1) blocks.push(block({ nodeType: 'action', text: 'x'.repeat(40) }));
  const a = Engine.build(blocks, p);
  const b = Engine.build(blocks, p);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i += 1) {
    assert.equal(a[i].pageNumber, b[i].pageNumber);
    assert.equal(a[i].usedLines, b[i].usedLines);
    assert.deepEqual(a[i].blocks, b[i].blocks);
  }
});

test('insertion updates pages: adding a block at the start shifts pagination', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  const base = [];
  for (let i = 0; i < 50; i += 1) base.push(block({ nodeType: 'action', text: 'short' }));
  const before = Engine.build(base, p);
  // Insert one block at index 0.
  const after = Engine.build([block({ nodeType: 'action', text: 'inserted' })].concat(base), p);
  assert.equal(after.length, before.length || after.length, 'page count changes are allowed');
  // Block index 0 lands on page 1.
  assert.equal(after[0].blocks[0], 0);
  // Total blocks placed = original + 1.
  const totalAfter = after.reduce(function(a, pg) { return a + pg.blocks.length; }, 0);
  const totalBefore = before.reduce(function(a, pg) { return a + pg.blocks.length; }, 0);
  assert.equal(totalAfter, totalBefore + 1);
});

// ----------------------------------------------------------------
// keep-with-next: sceneHeading + first body block travel together
// ----------------------------------------------------------------

test('keep-with-next: sceneHeading at page bottom moves WITH its action to next page', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  // Pack 26 short actions = 53 lines (= full linesPerPage after safety reserve). Then push a
  // sceneHeading + action chain. The heading alone (1 leading + 1 content = 2)
  // could fit, but with action (1 + 1 = 2 more) the chain is 4. The remaining
  // page space is 53 - 53 = 0, so chain doesn't fit → BOTH go to next page.
  const blocks = [];
  for (let i = 0; i < 26; i += 1) blocks.push(block({ nodeType: 'action', text: 'fill' }));
  // Verify pre-state: 26 actions cost 1 + 25*2 = 51 lines → still 3 lines left.
  // Add another action so we use 53 lines, then heading + action.
  blocks.push(block({ nodeType: 'action', text: 'fill' }));    // 27th → 53 lines
  blocks.push(block({ nodeType: 'sceneHeading', setting: 'INT.', location: 'ROOM', time: 'DAY', keepWithNext: true }));
  blocks.push(block({ nodeType: 'action', text: 'follow-up' }));
  const pages = Engine.build(blocks, p);
  // Page 1 packs the 27 actions; page 2 gets heading + action together.
  assert.ok(pages.length === 2, 'expected 2 pages, got ' + pages.length);
  assert.equal(pages[0].blocks.length, 27);
  assert.equal(pages[1].blocks.length, 2);
  // Verify chain didn't get split: heading is first on page 2.
  assert.equal(pages[1].blocks[0], 27);
  assert.equal(pages[1].blocks[1], 28);
});

test('keep-with-next: character cue travels with following dialogue', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  // Fill page 1 nearly full (53 lines), then character + dialogue chain (cost 1+1 + 0+1 = 3).
  const blocks = [];
  for (let i = 0; i < 27; i += 1) blocks.push(block({ nodeType: 'action', text: 'fill' })); // 53 lines
  blocks.push(block({ nodeType: 'character', text: 'ALEX', keepWithNext: true }));
  blocks.push(block({ nodeType: 'dialogue',  text: 'Hi.' }));
  const pages = Engine.build(blocks, p);
  // Chain travels: page 2 contains BOTH character and dialogue.
  assert.equal(pages.length, 2);
  assert.equal(pages[1].blocks.length, 2);
  assert.equal(pages[1].blocks[0], 27); // character first on page 2
  assert.equal(pages[1].blocks[1], 28); // dialogue second
});

// ----------------------------------------------------------------
// V1 no-split fallback
// ----------------------------------------------------------------

test('V1 no-split: an oversized single block on an empty page IS placed (oversize page)', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  // Build an action with 60 chars × 100 → 100 wrapped lines. Way over 53 (linesPerPage).
  const blocks = [ block({ nodeType: 'action', text: 'a'.repeat(60 * 100) }) ];
  const pages = Engine.build(blocks, p);
  // V1 places the block on page 1 as an oversize page (no split available).
  assert.equal(pages.length, 1);
  assert.equal(pages[0].blocks.length, 1);
  assert.ok(pages[0].usedLines > p.linesPerPage, 'oversize page acknowledged');
});

test('empty block array still returns a single empty page', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  const pages = Engine.build([], p);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].pageNumber, 1);
  assert.equal(pages[0].blocks.length, 0);
  assert.equal(pages[0].usedLines, 0);
});

// ----------------------------------------------------------------
// P0 — Test 4: safety reserve is the budget gap (usedLines <= linesPerPage,
//   never equal to theoreticalLinesPerPage on normal pages)
// ----------------------------------------------------------------

test('P0.4 safety reserve: no page usedLines ever equals theoreticalLinesPerPage', () => {
  // Build enough blocks to fill multiple pages. Assert that the packer
  // respects linesPerPage (= theoretical - 1) so no page carries content
  // that reaches the theoretical ceiling. The safety reserve is the gap.
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  assert.ok(p.theoreticalLinesPerPage > p.linesPerPage,
    'theoreticalLinesPerPage must be > linesPerPage (safety reserve applied)');
  assert.equal(p.theoreticalLinesPerPage - p.linesPerPage, p.safetyLines,
    'the gap between theoretical and actual must equal safetyLines');

  // Fill 3 pages worth of blocks (each page holds 27 action blocks = 53 used lines).
  const blocks = [];
  for (let i = 0; i < 81; i += 1) {
    blocks.push(block({ nodeType: 'action', text: 'short line' }));
  }
  const pages = Engine.build(blocks, p);
  assert.ok(pages.length >= 3, 'fixture must produce at least 3 pages, got ' + pages.length);

  for (let i = 0; i < pages.length - 1; i += 1) {
    // For all fully-packed pages (not the last, which may be partial):
    // usedLines must not exceed linesPerPage (the safe budget).
    assert.ok(pages[i].usedLines <= p.linesPerPage,
      'page ' + (i + 1) + ' usedLines (' + pages[i].usedLines +
      ') must not exceed linesPerPage (' + p.linesPerPage + ')');
    // The safety reserve IS the gap: usedLines must not reach theoreticalLinesPerPage
    // on any normally-packed page (only an oversize/unsplittable block could exceed it).
    assert.ok(pages[i].usedLines < p.theoreticalLinesPerPage ||
              pages[i].blocks.length === 1,
      'page ' + (i + 1) + ' usedLines (' + pages[i].usedLines +
      ') must not equal theoreticalLinesPerPage (' + p.theoreticalLinesPerPage +
      ') unless it is a single-block oversize page');
  }
});

// ----------------------------------------------------------------
// pagesToIndexEntries — NavigationIndex.pages population helper
// ----------------------------------------------------------------

test('pagesToIndexEntries produces NavigationIndex.pages entries: pageNumber/startPmPos/endPmPos/lineCount/sceneIds', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  const blocks = [
    block({ nodeType: 'sceneHeading', setting: 'INT.', location: 'A', time: 'DAY',   pmFrom: 10, pmTo: 20, sceneNodeId: 's1', sceneNumber: 1, keepWithNext: true }),
    block({ nodeType: 'action',       text: 'Stuff happens.',                          pmFrom: 20, pmTo: 40, sceneNodeId: 's1', sceneNumber: 1 }),
    block({ nodeType: 'sceneHeading', setting: 'EXT.', location: 'B', time: 'NIGHT', pmFrom: 40, pmTo: 60, sceneNodeId: 's2', sceneNumber: 2, keepWithNext: true }),
    block({ nodeType: 'action',       text: 'More.',                                   pmFrom: 60, pmTo: 80, sceneNodeId: 's2', sceneNumber: 2 })
  ];
  const pages = Engine.build(blocks, p);
  const entries = Engine.pagesToIndexEntries(pages, blocks);
  assert.equal(entries.length, pages.length);
  // Single-page case for tiny input — all scenes listed.
  assert.deepEqual(entries[0].sceneIds, ['s1', 's2']);
  assert.equal(entries[0].pageNumber, 1);
  assert.equal(entries[0].startPmPos, 10);
  assert.equal(entries[0].endPmPos, 80);
  assert.equal(entries[0].lineCount, pages[0].usedLines);
});

test('pagesToIndexEntries dedupes sceneIds within a page', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  const blocks = [
    block({ nodeType: 'sceneHeading', setting: 'INT.', location: 'A', time: 'DAY', sceneNodeId: 's1', keepWithNext: true, pmFrom: 0, pmTo: 5 }),
    block({ nodeType: 'action',       text: 'x', sceneNodeId: 's1', pmFrom: 5, pmTo: 10 }),
    block({ nodeType: 'action',       text: 'y', sceneNodeId: 's1', pmFrom: 10, pmTo: 15 })
  ];
  const pages = Engine.build(blocks, p);
  const entries = Engine.pagesToIndexEntries(pages, blocks);
  assert.deepEqual(entries[0].sceneIds, ['s1']);
});

// ----------------------------------------------------------------
// Recovery Step 2 — PageMap no longer carries a hardcoded 54-line
// fallback budget. With no profile it falls back to LayoutProfile's
// named, reserve-aware default (53); it never resurrects raw 54.
// ----------------------------------------------------------------

test('Recovery Step 2: build() without a layoutProfile uses the reserve-aware default (53), never raw 54', () => {
  // Pre-Step-2: build() used `(layoutProfile && layoutProfile.linesPerPage) || 54`,
  // a hardcoded budget that bypassed the SAFETY_LINES reserve.
  const { Engine } = boot();
  const pages = Engine.build([block({ nodeType: 'action', text: 'x' })], undefined);
  assert.equal(pages[0].availableLines, 53,
    'no-profile build must use LayoutProfile default budget (53)');
  assert.notEqual(pages[0].availableLines, 54,
    'the raw 54-line budget must never be resurrected');
});

test('Recovery Step 2: build() with a layoutProfile uses that profile linesPerPage (reserved budget)', () => {
  const { LP, Engine } = boot();
  const p = LP.compose(null, null);
  const pages = Engine.build([block({ nodeType: 'action', text: 'x' })], p);
  assert.equal(pages[0].availableLines, p.linesPerPage,
    'with a profile, the budget must be the profile linesPerPage');
  assert.equal(pages[0].availableLines, 53, 'Letter Hollywood reserved budget is 53');
});

test('Recovery Step 2: the no-profile fallback budget respects the safety reserve', () => {
  const { LP, Engine } = boot();
  const def = LP.DEFAULT_HOLLYWOOD_LETTER_COURIER_12;
  assert.equal(def.linesPerPage, def.theoreticalLinesPerPage - def.safetyLines,
    'LayoutProfile default linesPerPage must be theoretical minus the safety reserve');
  const pages = Engine.build([block({ nodeType: 'action', text: 'x' })], null);
  assert.equal(pages[0].availableLines, def.linesPerPage,
    'no-profile build budget must equal the reserve-aware default, not a literal');
});
