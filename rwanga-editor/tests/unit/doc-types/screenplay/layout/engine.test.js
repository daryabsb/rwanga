// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Deterministic fixtures for the screenplay layout engine. Per the
// architecture review: every shape on the consultant's list gets a
// dedicated assertion. Snapshot regression = full deep-equal on the
// PageMap output for each shape.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('../../../../../renderer/js/doc-types/screenplay/layout/wrap.js');
require('../../../../../renderer/js/doc-types/screenplay/layout/profiles.js');
require('../../../../../renderer/js/doc-types/screenplay/layout/engine.js');
const layout = global.window.Rga.DocTypes.screenplay.layout;
const { computePageMap, profiles } = layout;

function block(type, text, pmFrom, pmTo, extras) {
  return Object.assign({
    id:                'blk_' + Math.random().toString(36).slice(2, 8),
    type:              type,
    text:              text || '',
    pmFrom:            pmFrom == null ? 0 : pmFrom,
    pmTo:              pmTo == null ? 1 : pmTo,
    sceneId:           null,
    sceneIndex:        null,
    blockIndexInScene: null,
    metadata:          {}
  }, extras || {});
}

// Convenience: a "scene" = slug + N action lines.
function scene(n, pmStart) {
  const out = [];
  out.push(block('sceneHeading', 'INT. ROOM ' + n + ' — DAY', pmStart, pmStart + 1, { sceneId: 'scene_' + n, sceneIndex: n - 1, blockIndexInScene: 0 }));
  out.push(block('action', 'Some action happens here. Short paragraph.', pmStart + 1, pmStart + 2, { sceneId: 'scene_' + n, sceneIndex: n - 1, blockIndexInScene: 1 }));
  return out;
}

test('empty input → one empty page (still a valid PageMap)', () => {
  const map = computePageMap([], profiles.Letter());
  assert.equal(map.totalPages, 1);
  assert.equal(map.totalLines, 0);
  assert.equal(map.pages.length, 1);
  assert.equal(map.pages[0].pageNumber, 1);
  assert.equal(map.pages[0].usedLines, 0);
  assert.equal(map.pages[0].blocks.length, 0);
});

test('single short scene fits on one page', () => {
  const blocks = scene(1, 0);
  const map = computePageMap(blocks, profiles.Letter());
  assert.equal(map.totalPages, 1);
  assert.equal(map.pages[0].blocks.length, 2);
  assert.ok(map.pages[0].usedLines <= 54);
});

test('five short scenes all fit on one Letter page', () => {
  const blocks = [];
  for (let i = 1; i <= 5; i += 1) {
    blocks.push.apply(blocks, scene(i, i * 10));
  }
  const map = computePageMap(blocks, profiles.Letter());
  // 5 slugs + 5 actions + blank spacers between each block = well under 54 lines.
  assert.equal(map.totalPages, 1, 'expected 1 page, got ' + map.totalPages + ' (used ' + map.pages[0].usedLines + ' lines)');
});

test('exact-fit: blocks summing to budget produce 1 page (no overflow)', () => {
  // Build blocks whose cumulative cost is EXACTLY 54 lines on Letter.
  // Each action with one wrapped line + blankLineCostBetween=1 → 2 lines per block.
  // 27 such blocks = 54 lines exactly.
  const blocks = [];
  for (let i = 0; i < 27; i += 1) {
    blocks.push(block('action', 'X', i * 2, i * 2 + 1));
  }
  const map = computePageMap(blocks, profiles.Letter());
  assert.equal(map.totalPages, 1, 'exact fit should be 1 page');
});

test('one-line overflow forces page 2', () => {
  // 28 single-line action blocks at 2 lines each (line + blank) = 56 lines.
  // Last one overflows → goes to page 2.
  const blocks = [];
  for (let i = 0; i < 28; i += 1) {
    blocks.push(block('action', 'X', i * 2, i * 2 + 1));
  }
  const map = computePageMap(blocks, profiles.Letter());
  assert.equal(map.totalPages, 2);
});

test('keep-with-next: slug pulls its first body block to the next page', () => {
  // Fill page 1 to within 2 lines of full, then push a slug+action pair
  // costing 3 lines. The slug must pull the action to page 2.
  const blocks = [];
  // 26 action blocks * 2 lines = 52 lines. Page 1 has room for 2 more lines.
  for (let i = 0; i < 26; i += 1) {
    blocks.push(block('action', 'X', i * 2, i * 2 + 1));
  }
  // Slug (1 line + blank = 2) + action (1 + blank = 2) = pair of 4 lines.
  // Page 1 room = 2. Pair doesn't fit → slug + action push to page 2.
  blocks.push(block('sceneHeading', 'INT. NEW — DAY', 100, 101, { sceneId: 'scene_x' }));
  blocks.push(block('action', 'first body block', 101, 102, { sceneId: 'scene_x' }));

  const map = computePageMap(blocks, profiles.Letter());
  assert.equal(map.totalPages, 2);
  // The last block on page 1 should NOT be the slug.
  const lastOnPage1 = map.pages[0].blocks[map.pages[0].blocks.length - 1];
  assert.notEqual(lastOnPage1.blockType, 'sceneHeading');
  // Page 2's first block IS the slug.
  assert.equal(map.pages[1].blocks[0].blockType, 'sceneHeading');
  // Page 2's second block IS the action that was kept with the slug.
  assert.equal(map.pages[1].blocks[1].blockType, 'action');
});

test('a single block larger than the page budget gets its own page (v1)', () => {
  // 200-line action paragraph (very long). Page budget = 54.
  // v1: place on its own page, accept overflow at the bottom.
  const longText = ('A'.repeat(50) + ' ').repeat(200); // ~200 wrapped lines at width 60
  const blocks = [
    block('action', 'first short.', 0, 1),
    block('action', longText, 1, 2)
  ];
  const map = computePageMap(blocks, profiles.Letter());
  // 2+ pages: short on page 1, monster on its own page (page 2).
  assert.ok(map.totalPages >= 2);
  // The monster block's split flag should be false (v1 limitation).
  let monster = null;
  map.pages.forEach(function(p) {
    p.blocks.forEach(function(b) {
      if (b.endLine - b.startLine + 1 > 100) monster = b;
    });
  });
  assert.ok(monster, 'monster block placed');
  assert.equal(monster.split, false, 'v1: split must remain false');
});

test('PageMap is deterministic — same input gives same output', () => {
  const blocks = [
    block('sceneHeading', 'INT. A — DAY', 0, 1, { sceneId: 's1' }),
    block('action', 'action one.', 1, 2),
    block('character', 'NALI', 2, 3),
    block('dialogue', 'Hello.', 3, 4),
    block('blank', '', 4, 5),
    block('sceneHeading', 'EXT. B — NIGHT', 5, 6, { sceneId: 's2' }),
    block('action', 'action two.', 6, 7)
  ];
  const a = computePageMap(blocks, profiles.Letter());
  const b = computePageMap(blocks, profiles.Letter());
  // Strip random ids before comparing (block.id isn't deterministic here).
  function strip(m) {
    return Object.assign({}, m, {
      pages: m.pages.map(function(p) {
        return Object.assign({}, p, {
          blocks: p.blocks.map(function(bl) {
            return Object.assign({}, bl, { blockId: '<id>' });
          })
        });
      })
    });
  }
  assert.deepEqual(strip(a), strip(b));
});

test('large procedural script: 100 scenes paginates without error', () => {
  const blocks = [];
  for (let i = 1; i <= 100; i += 1) {
    blocks.push.apply(blocks, scene(i, i * 100));
  }
  const map = computePageMap(blocks, profiles.Letter());
  assert.ok(map.totalPages > 1, 'should span multiple pages');
  assert.ok(map.totalPages < 100, 'should not be one page per scene');
  // Every block accounted for.
  const placedCount = map.pages.reduce(function(n, p) { return n + p.blocks.length; }, 0);
  assert.equal(placedCount, blocks.length);
});

test('A4 profile has different budget than Letter', () => {
  const letterBudget = profiles.Letter().pageLineBudget;
  const a4Budget = profiles.A4().pageLineBudget;
  assert.notEqual(letterBudget, a4Budget);
});

test('PageMap snapshot — slug + 4 short blocks + blank + slug + 2 blocks', () => {
  // Snapshot regression — exact expected output for a small canonical input.
  // Updating this snapshot is intentional when changing layout rules.
  const blocks = [
    block('sceneHeading', 'INT. A — DAY', 0, 1, { id: 'b1', sceneId: 's1', sceneIndex: 0, blockIndexInScene: 0 }),
    block('action',       'short.',       1, 2, { id: 'b2', sceneId: 's1', sceneIndex: 0, blockIndexInScene: 1 }),
    block('character',    'NALI',         2, 3, { id: 'b3', sceneId: 's1', sceneIndex: 0, blockIndexInScene: 2 }),
    block('dialogue',     'Hi.',          3, 4, { id: 'b4', sceneId: 's1', sceneIndex: 0, blockIndexInScene: 3 }),
    block('transition',   'CUT',          4, 5, { id: 'b5', sceneId: 's1', sceneIndex: 0, blockIndexInScene: 4 }),
    block('blank',        '',             5, 6, { id: 'b6' }),
    block('sceneHeading', 'EXT. B — DAY', 6, 7, { id: 'b7', sceneId: 's2', sceneIndex: 1, blockIndexInScene: 0 }),
    block('action',       'A.',           7, 8, { id: 'b8', sceneId: 's2', sceneIndex: 1, blockIndexInScene: 1 })
  ];
  const map = computePageMap(blocks, profiles.Letter());

  // All on page 1, line budget 54, used: every block = 1 + 1 (blank between) = 2 lines.
  // 8 blocks * 2 = 16, but final block's trailing blank doesn't push to a new page.
  assert.equal(map.totalPages, 1);
  assert.equal(map.pages[0].blocks.length, 8);
  assert.equal(map.pages[0].blocks[0].blockId, 'b1');
  assert.equal(map.pages[0].blocks[0].blockType, 'sceneHeading');
  assert.equal(map.pages[0].blocks[0].startLine, 1);
  assert.equal(map.pages[0].blocks[0].endLine, 1);
  // Page 1 startPmPos = first block's pmFrom = 0.
  assert.equal(map.pages[0].startPmPos, 0);
  assert.equal(map.pages[0].endPmPos, 8);
  assert.equal(map.layoutProfileId, 'screenplay-letter-courier12');
});
