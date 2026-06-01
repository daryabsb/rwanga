// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Density Slice 9 — MT-11 page-break stability.
//
// MT-11's Evidence-required column names an automated test: "breaks
// deterministic across reflow." Density Slice 8 proved determinism
// structurally (PageMap / Normalizer / LayoutProfile are pure functions) and
// empirically (the probe run twice → byte-identical), but the named TEST did
// not exist. This file IS that test.
//
// Two properties, each on an RTL and an LTR fixture:
//   1. Determinism — building the same document twice yields identical pages
//      (page count, page numbers, block ranges, PM break positions).
//   2. Localised re-flow — an edit inside a later page leaves every page
//      break BEFORE the edit point unchanged (the greedy sequential packer
//      re-flows only forward).
//
// This verifies existing behaviour; no production code is in scope unless a
// test exposes a real bug.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RJS = path.resolve(__dirname, '../../../renderer/js');
const FIX = path.resolve(__dirname, '../../fixtures');

// Run the real pipeline (.rga → schema-v3 → Normalizer → LayoutProfile →
// PageMap.build) from the parsed JSON. Each call re-requires the modules and
// re-normalises, so calling it twice is a genuine "same document, built
// twice" test — not "same array reference compared with itself".
function paginate(fixtureFile) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  global.window.RgaProseMirror = {
    Schema: require(path.resolve(__dirname, '../../../node_modules/prosemirror-model')).Schema
  };
  ['constants.js', 'framework/base-outer-marks.js', 'doc-types/screenplay/schema-v3.js',
   'framework/slug-resolver.js',
   'framework/layout-profile.js', 'framework/pagemap-engine.js',
   'framework/screenplay-normalizer.js'].forEach(function (rel) {
    const p = path.join(RJS, rel);
    delete require.cache[require.resolve(p)];
    require(p);
  });
  const Rga = global.window.Rga;
  const parsed = JSON.parse(fs.readFileSync(path.join(FIX, fixtureFile), 'utf8'));
  const doc = Rga.DocTypes.screenplay.buildSchemaV3().nodeFromJSON(parsed.body);
  const blocks = Rga.Normalizer.normalize(doc);
  const profile = Rga.LayoutProfile.compose(parsed.metadata.screenplayProfile, parsed.settings);
  const pages = Rga.PageMap.build(blocks, profile);
  return { Rga: Rga, blocks: blocks, profile: profile, pages: pages };
}

// The page-break "shape" that must stay stable: page number + the
// block-index range of each page. Independent of object identity.
function breakShape(pages) {
  return pages.map(function (p) {
    return {
      pageNumber: p.pageNumber,
      firstBlock: p.blocks[0],
      lastBlock:  p.blocks[p.blocks.length - 1],
      blockCount: p.blocks.length
    };
  });
}

const FIXTURES = [
  { label: 'RTL (mysterious-guest-rtl.rga)',      file: 'mysterious-guest-rtl.rga' },
  { label: 'LTR (playground-the-last-light.rga)', file: 'playground-the-last-light.rga' }
];

FIXTURES.forEach(function (fx) {

  test('MT-11 determinism — ' + fx.label + ' — the same document built twice yields identical pages', () => {
    const a = paginate(fx.file);
    const b = paginate(fx.file);
    assert.equal(a.pages.length, b.pages.length,
      'page count must be identical across two builds');
    assert.deepEqual(breakShape(a.pages), breakShape(b.pages),
      'page numbers and block ranges must be identical across two builds');
    assert.deepEqual(
      a.Rga.PageMap.pagesToIndexEntries(a.pages, a.blocks),
      b.Rga.PageMap.pagesToIndexEntries(b.pages, b.blocks),
      'PM page-break positions (start/end document positions) must be identical');
    assert.deepEqual(a.pages, b.pages,
      'the full PageMap output must be byte-for-byte identical');
  });

  test('MT-11 localised re-flow — ' + fx.label + ' — an edit after page N leaves earlier breaks unchanged', () => {
    const base = paginate(fx.file);
    assert.ok(base.pages.length >= 2,
      'fixture must paginate to >= 2 pages for a localised-edit test (got ' + base.pages.length + ')');

    // Edit point — the first block of a later page. Every page before it is
    // composed entirely of blocks earlier than the edit.
    const editPageIdx  = Math.floor(base.pages.length / 2);
    const editBlockIdx = base.pages[editPageIdx].blocks[0];

    // Apply an edit at the edit point: lengthen that block so it re-flows.
    const edited = base.blocks.slice();
    const orig = base.blocks[editBlockIdx];
    const pad = ' word'.repeat(400);   // ~2000 chars → guaranteed multi-line growth
    edited[editBlockIdx] = (orig.nodeType === 'sceneHeading')
      ? Object.assign({}, orig, { heading: Object.assign({}, orig.heading,
          { location: ((orig.heading && orig.heading.location) || '') + pad }) })
      : Object.assign({}, orig, { text: (orig.text || '') + pad });

    const after = base.Rga.PageMap.build(edited, base.profile);

    // Sanity — the edit must actually re-flow something at/after the edit
    // point, otherwise the stability assertion below would be vacuous.
    assert.notDeepEqual(
      breakShape(base.pages).slice(editPageIdx),
      breakShape(after).slice(editPageIdx),
      'the edit must re-flow pages at/after the edit point');

    // The property under test — every page break BEFORE the edit point is
    // unchanged. Pages 0 .. editPageIdx-1 contain only blocks earlier than
    // the edit, so the greedy sequential packer produces them identically.
    assert.deepEqual(
      breakShape(base.pages.slice(0, editPageIdx)),
      breakShape(after.slice(0, editPageIdx)),
      'every page break before the edit point (pages 0..' + (editPageIdx - 1) +
      ') must be unchanged after the edit');
  });

});
