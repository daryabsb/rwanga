// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Print Contract V1 — renderer-consumption integration + byte-identical guard.
// Doctrine: docs/Filmustageation/PRINT_CONTRACT_V1.md §6
//
// Proves:
//   1. ManuscriptGeometry.resolve(doc) consumes the contract — the resolved
//      layoutProfile carries `printContract` === PrintContract.resolve(doc).
//   2. The GEOMETRY is byte-identical to the pre-contract path: stripping
//      printContract, resolve(doc) deepEquals compose(profile, settings) with no
//      contract. Ownership changed; pixels did not (success criteria #4/#5).
//   3. The owned enums on the profile (orientation, direction, pageNumbers) equal
//      the contract's values — the contract is the single owner the renderer reads.
//   4. resolveFrom(p, s) (no contract) stays pure — no printContract attached.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  const files = [
    '../../../renderer/js/constants.js',
    '../../../renderer/js/framework/print-contract.js',
    '../../../renderer/js/framework/layout-profile.js',
    '../../../renderer/js/framework/manuscript-geometry.js',
  ];
  files.forEach((f) => { delete require.cache[require.resolve(f)]; require(f); });
  const R = global.window.Rga;
  return { MG: R.ManuscriptGeometry, LP: R.LayoutProfile, PC: R.PrintContract };
}

function geomOnly(profile) {
  const g = Object.assign({}, profile);
  delete g.printContract;
  return g;
}

const DOCS = {
  'default (no profile, no pageSetup)': { metadata: {}, settings: {} },
  'LTR A4 landscape, numbering off': {
    metadata: { screenplayProfile: { direction: 'ltr' } },
    settings: {
      show_scene_numbers: true,
      pageSetup: {
        paperSize: 'A4', orientation: 'landscape',
        pageNumbers: false, pageNumberPosition: 'bottom_center',
        margins: { top: 1, right: 1, bottom: 1, left: 1.5, unit: 'in' }
      }
    }
  },
  'RTL Letter portrait': {
    metadata: { screenplayProfile: { direction: 'rtl' } },
    settings: { pageSetup: { paperSize: 'Letter', margins: { top: 1, right: 1, bottom: 1, left: 1.5, unit: 'in' } } }
  }
};

// ----------------------------------------------------------------
// 1 + 2 — contract carried + geometry byte-identical, every doc.
// ----------------------------------------------------------------
Object.keys(DOCS).forEach((label) => {
  test('[print-contract-geometry] resolve(doc) carries the contract + byte-identical geometry — ' + label, () => {
    const { MG, LP, PC } = boot();
    const doc = DOCS[label];

    const viaResolve = MG.resolve(doc);
    const expectedContract = PC.resolve(doc);

    // (1) contract attached + equal to the standalone resolver.
    assert.deepEqual(viaResolve.printContract, expectedContract);

    // (2) geometry (everything else) byte-identical to the pre-contract path.
    const preContract = LP.compose(doc.metadata.screenplayProfile || null, doc.settings || null);
    assert.deepEqual(geomOnly(viaResolve), preContract);
  });
});

// ----------------------------------------------------------------
// 3 — owned enums on the profile equal the contract.
// ----------------------------------------------------------------
test('[print-contract-geometry] profile owned enums are sourced from the contract', () => {
  const { MG } = boot();
  const doc = DOCS['LTR A4 landscape, numbering off'];
  const p = MG.resolve(doc);
  assert.equal(p.orientation, p.printContract.orientation);
  assert.equal(p.direction, p.printContract.direction);
  assert.deepEqual(p.pageNumbers, {
    enabled: p.printContract.pageNumbering.enabled,
    position: p.printContract.pageNumbering.position
  });
});

// ----------------------------------------------------------------
// 4 — resolveFrom stays pure (no contract attached, identity preserved).
// ----------------------------------------------------------------
test('[print-contract-geometry] resolveFrom(p,s) attaches no contract and equals compose', () => {
  const { MG, LP } = boot();
  const profile = { direction: 'rtl' };
  const settings = { pageSetup: { paperSize: 'A4' } };
  const rf = MG.resolveFrom(profile, settings);
  assert.equal(rf.printContract, undefined);
  assert.deepEqual(rf, LP.compose(profile, settings));
});
