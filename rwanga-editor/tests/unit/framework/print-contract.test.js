// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Print Contract V1 — Rga.PrintContract.resolve unit tests.
// Doctrine: docs/Filmustageation/PRINT_CONTRACT_V1.md
//
// The contract is a named, versioned projection over the document's owned
// print homes (settings.pageSetup.*, metadata.screenplayProfile.direction,
// settings.show_scene_numbers, metadata.printContractVersion) with App-Default
// fallback. The resolver is the single API renderers + the future Platform call.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};

  const cPath  = '../../../renderer/js/constants.js';
  const pcPath = '../../../renderer/js/framework/print-contract.js';
  delete require.cache[require.resolve(cPath)];
  delete require.cache[require.resolve(pcPath)];
  require(cPath);
  require(pcPath);

  return { PC: global.window.Rga.PrintContract, Rga: global.window.Rga };
}

// ----------------------------------------------------------------
// 1 — null doc resolves to App Defaults (never throws).
// ----------------------------------------------------------------
test('[print-contract] resolve(null) returns the App-Default contract', () => {
  const { PC } = boot();
  const c = PC.resolve(null);
  assert.equal(c.paperSize, 'Letter');
  assert.equal(c.orientation, 'portrait');
  assert.equal(c.direction, 'ltr');
  assert.deepEqual(c.pageNumbering, { enabled: true, position: 'top_right' });
  assert.deepEqual(c.sceneNumbering, { enabled: true });
  assert.equal(c.version, PC.CONTRACT_VERSION);
});

// ----------------------------------------------------------------
// 2 — empty doc ({}) resolves to App Defaults too.
// ----------------------------------------------------------------
test('[print-contract] resolve({}) returns App Defaults', () => {
  const { PC } = boot();
  assert.deepEqual(PC.resolve({}), PC.resolve(null));
});

// ----------------------------------------------------------------
// 3 — reads every owned home.
// ----------------------------------------------------------------
test('[print-contract] resolve reads owned homes from the document', () => {
  const { PC } = boot();
  const doc = {
    metadata: {
      printContractVersion: 1,
      language: 'ku',
      screenplayProfile: { direction: 'rtl' }
    },
    settings: {
      show_scene_numbers: false,
      pageSetup: {
        paperSize: 'A4',
        orientation: 'landscape',
        pageNumbers: false,
        pageNumberPosition: 'bottom_center'
      }
    }
  };
  const c = PC.resolve(doc);
  assert.equal(c.version, 1);
  assert.equal(c.paperSize, 'A4');
  assert.equal(c.orientation, 'landscape');
  assert.equal(c.direction, 'rtl');
  assert.deepEqual(c.pageNumbering, { enabled: false, position: 'bottom_center' });
  assert.deepEqual(c.sceneNumbering, { enabled: false });
});

// ----------------------------------------------------------------
// 4 — version: present wins; absent falls back to CONTRACT_VERSION.
// ----------------------------------------------------------------
test('[print-contract] version comes from metadata.printContractVersion, else CONTRACT_VERSION', () => {
  const { PC } = boot();
  assert.equal(PC.resolve({ metadata: { printContractVersion: 7 } }).version, 7);
  assert.equal(PC.resolve({ metadata: {} }).version, PC.CONTRACT_VERSION);
});

// ----------------------------------------------------------------
// 5 — enum normalization (unknown → safe default).
// ----------------------------------------------------------------
test('[print-contract] normalizes orientation + direction to known enums', () => {
  const { PC } = boot();
  const c = PC.resolve({
    metadata: { screenplayProfile: { direction: 'sideways' } },
    settings: { pageSetup: { orientation: 'diagonal' } }
  });
  assert.equal(c.orientation, 'portrait');
  assert.equal(c.direction, 'ltr');
});

// ----------------------------------------------------------------
// 6 — legacy `size` alias is honored for paperSize.
// ----------------------------------------------------------------
test('[print-contract] honors the legacy pageSetup.size alias', () => {
  const { PC } = boot();
  const c = PC.resolve({ settings: { pageSetup: { size: 'Legal' } } });
  assert.equal(c.paperSize, 'Legal');
});

// ----------------------------------------------------------------
// 7 — page numbering: enabled default true; position default top_right.
// ----------------------------------------------------------------
test('[print-contract] page numbering defaults: enabled true, position top_right', () => {
  const { PC } = boot();
  const c = PC.resolve({ settings: { pageSetup: { pageNumbers: true } } });
  assert.deepEqual(c.pageNumbering, { enabled: true, position: 'top_right' });
});

// ----------------------------------------------------------------
// 8 — result is deeply frozen (value object; renderers must not mutate).
// ----------------------------------------------------------------
test('[print-contract] resolved contract is deeply frozen', () => {
  const { PC } = boot();
  const c = PC.resolve({});
  assert.ok(Object.isFrozen(c));
  assert.ok(Object.isFrozen(c.pageNumbering));
  assert.ok(Object.isFrozen(c.sceneNumbering));
});

// ----------------------------------------------------------------
// 9 — DEFAULTS + CONTRACT_VERSION exposed (App Defaults tier).
// ----------------------------------------------------------------
test('[print-contract] exposes DEFAULTS and CONTRACT_VERSION', () => {
  const { PC } = boot();
  assert.equal(PC.DEFAULTS.paperSize, 'Letter');
  assert.equal(PC.DEFAULTS.direction, 'ltr');
  assert.equal(typeof PC.CONTRACT_VERSION, 'number');
});
