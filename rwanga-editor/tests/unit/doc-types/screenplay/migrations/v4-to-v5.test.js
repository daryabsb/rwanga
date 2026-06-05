// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Print Contract V1 — v4 → v5 migration.
// Doctrine: docs/Filmustageation/PRINT_CONTRACT_V1.md §5
//
// v5 makes the Print Contract explicit on old documents: stamps
// metadata.printContractVersion, ensures metadata.screenplayProfile (direction
// derived from language), and ensures the pageSetup numbering/orientation fields
// + show_scene_numbers exist. Pure, idempotent, preserves unknown fields, and the
// chain dispatcher must carry a v1/v2/v3/v4 doc all the way to "5.0".
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function bootStep() {
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  const p = require.resolve('../../../../../renderer/js/doc-types/screenplay/migrations/v4-to-v5.js');
  delete require.cache[p];
  require(p);
  return global.window.Rga.Migrations._steps;
}

function bootChain() {
  global.window = { Rga: {} };
  const files = [
    '../../../../../renderer/js/constants.js',
    '../../../../../renderer/js/doc-types/screenplay/migrations/v1-to-v2.js',
    '../../../../../renderer/js/doc-types/screenplay/migrations/v2-to-v3.js',
    '../../../../../renderer/js/doc-types/screenplay/migrations/v3-to-v4.js',
    '../../../../../renderer/js/doc-types/screenplay/migrations/v4-to-v5.js',
    '../../../../../renderer/js/doc-types/screenplay/migrations/index.js',
  ];
  files.forEach(function(f) {
    const p = require.resolve(f);
    delete require.cache[p];
    require(p);
  });
  return global.window.Rga;
}

function v4Doc(extra) {
  return Object.assign({
    rga_version: '4.0',
    document_type: 'screenplay',
    metadata: { title: 't', language: 'en' },
    body: { type: 'doc', content: [] },
    settings: { pageSetup: { paperSize: 'Letter', margins: { top: 1, right: 1, bottom: 1, left: 1.5 } } },
    tag_registry: { characters: [{ id: 'a', name: 'Nali', aliases: [] }] },
  }, extra || {});
}

// ----------------------------------------------------------------
// 1 — step stamps the contract and bumps to 5.0.
// ----------------------------------------------------------------
test('PC: v4toV5 stamps the print contract and bumps to 5.0', () => {
  const S = bootStep();
  const out = S.v4toV5(v4Doc());
  assert.equal(out.rga_version, '5.0');
  assert.equal(out.metadata.printContractVersion, 1);
  assert.ok(out.metadata.screenplayProfile, 'screenplayProfile seeded');
  assert.equal(out.metadata.screenplayProfile.direction, 'ltr');   // en → ltr
  assert.equal(out.metadata.screenplayProfile.language, 'en');
  assert.equal(out.settings.pageSetup.orientation, 'portrait');
  assert.equal(out.settings.pageSetup.pageNumbers, true);
  assert.equal(out.settings.pageSetup.pageNumberPosition, 'top_right');
  assert.equal(out.settings.show_scene_numbers, true);
  // preserved
  assert.equal(out.settings.pageSetup.paperSize, 'Letter');
  assert.equal(out.tag_registry.characters[0].name, 'Nali');
});

// ----------------------------------------------------------------
// 2 — direction derived from language (ku → rtl).
// ----------------------------------------------------------------
test('PC: v4toV5 derives RTL direction from a Kurdish/Arabic language', () => {
  const S = bootStep();
  const ku = S.v4toV5(v4Doc({ metadata: { title: 't', language: 'ku' } }));
  assert.equal(ku.metadata.screenplayProfile.direction, 'rtl');
  const ar = S.v4toV5(v4Doc({ metadata: { title: 't', language: 'ar' } }));
  assert.equal(ar.metadata.screenplayProfile.direction, 'rtl');
});

// ----------------------------------------------------------------
// 3 — idempotent: never overwrites an existing explicit contract.
// ----------------------------------------------------------------
test('PC: v4toV5 is idempotent and preserves an author-set contract', () => {
  const S = bootStep();
  const explicit = v4Doc({
    metadata: { title: 't', language: 'ku', printContractVersion: 1,
      screenplayProfile: { language: 'ku', direction: 'rtl', screenplayConvention: 'hollywood' } },
    settings: { show_scene_numbers: false,
      pageSetup: { paperSize: 'A4', orientation: 'landscape', pageNumbers: false,
        pageNumberPosition: 'bottom_center', margins: { top: 1, right: 1, bottom: 1, left: 1 } } }
  });
  const once  = S.v4toV5(explicit);
  const twice = S.v4toV5(once);
  assert.equal(twice.rga_version, '5.0');
  assert.equal(twice.metadata.screenplayProfile.direction, 'rtl');
  assert.equal(twice.settings.pageSetup.paperSize, 'A4');
  assert.equal(twice.settings.pageSetup.orientation, 'landscape');
  assert.equal(twice.settings.pageSetup.pageNumbers, false);
  assert.equal(twice.settings.pageSetup.pageNumberPosition, 'bottom_center');
  assert.equal(twice.settings.show_scene_numbers, false);
});

// ----------------------------------------------------------------
// 4 — preserves unknown fields at every level.
// ----------------------------------------------------------------
test('PC: v4toV5 preserves unknown fields', () => {
  const S = bootStep();
  const out = S.v4toV5(v4Doc({ merge_log: [{ x: 1 }], metadata: { title: 't', language: 'en', custom: 'keep' } }));
  assert.deepEqual(out.merge_log, [{ x: 1 }]);
  assert.equal(out.metadata.custom, 'keep');
});

// ----------------------------------------------------------------
// 5 — the CHAIN carries v4 → 5.0 (proves the dispatcher branch).
// ----------------------------------------------------------------
test('PC: migrate() carries a v4 doc all the way to 5.0', () => {
  const Rga = bootChain();
  const out = Rga.Migrations.migrate(v4Doc());
  assert.equal(out.rga_version, '5.0');
  assert.equal(out.metadata.printContractVersion, 1);
  assert.ok(out.metadata.screenplayProfile);
});

// ----------------------------------------------------------------
// 6 — the CHAIN carries a v3 doc through v4 (aliases) AND v5 (contract).
// ----------------------------------------------------------------
test('PC: migrate() carries a v3 doc through aliases (v4) and the contract (v5)', () => {
  const Rga = bootChain();
  const v3 = {
    rga_version: '3.0', document_type: 'screenplay',
    metadata: { title: 't', language: 'ku' },
    body: { type: 'doc', content: [] },
    tag_registry: { characters: [{ id: 'a', name: 'Nali' }] },
  };
  const out = Rga.Migrations.migrate(v3);
  assert.equal(out.rga_version, '5.0');
  assert.deepEqual(out.tag_registry.characters[0].aliases, []);   // v4 ran
  assert.equal(out.metadata.printContractVersion, 1);              // v5 ran
  assert.equal(out.metadata.screenplayProfile.direction, 'rtl');   // ku → rtl
});

// ----------------------------------------------------------------
// 7 — LATEST_VERSION + constants bumped to 5.0.
// ----------------------------------------------------------------
test('PC: migrate exposes LATEST_VERSION 5.0 and constants are bumped', () => {
  const Rga = bootChain();
  assert.equal(Rga.Migrations.LATEST_VERSION, '5.0');
  assert.equal(Rga.Constants.CURRENT_RGA_VERSION, '5.0');
  assert.ok(Rga.Constants.SUPPORTED_RGA_VERSIONS.indexOf('5.0') !== -1);
});
