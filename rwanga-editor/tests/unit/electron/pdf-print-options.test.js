// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PB1.C — printToPDF options parity tests.
//
// Guards the page-size / margin contract between the renderer's resolved
// layout geometry and Electron's webContents.printToPDF. The audit's named
// failure mode is "wrong-sized output because printToPDF options don't
// match the preview" — these tests pin the mapping.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { toPrintOptions, FALLBACK_PAGE } = require('../../../electron/lib/pdf-print-options');

test('PB1.C: Letter geometry maps to 8.5×11in page size', () => {
  const opts = toPrintOptions({ pageSize: { w: 8.5, h: 11.0, unit: 'in' } });
  assert.deepEqual(opts.pageSize, { width: 8.5, height: 11.0 });
});

test('PB1.C: A4 geometry passes its dimensions through unchanged (no unit conversion)', () => {
  const opts = toPrintOptions({ pageSize: { w: 8.27, h: 11.69, unit: 'in' } });
  assert.equal(opts.pageSize.width, 8.27);
  assert.equal(opts.pageSize.height, 11.69);
});

test('PB1.C: landscape geometry (already-swapped w/h) is passed through without re-rotating', () => {
  // compose() swaps w/h for landscape BEFORE this mapper runs, so width > height
  // is expected here and landscape must stay false (re-rotating would undo it).
  const opts = toPrintOptions({ pageSize: { w: 11.0, h: 8.5, unit: 'in' }, orientation: 'landscape' });
  assert.equal(opts.pageSize.width, 11.0);
  assert.equal(opts.pageSize.height, 8.5);
  assert.equal(opts.landscape, false);
});

test('PB1.C: physical margins are zero (sheet padding owns the screenplay margins)', () => {
  const opts = toPrintOptions({ pageSize: { w: 8.5, h: 11.0 }, margins: { top: 1, bottom: 1, left: 1.5, right: 1 } });
  assert.deepEqual(opts.margins, { top: 0, bottom: 0, left: 0, right: 0 });
});

test('PB1.C: printBackground + preferCSSPageSize are enabled', () => {
  const opts = toPrintOptions({ pageSize: { w: 8.5, h: 11.0 } });
  assert.equal(opts.printBackground, true);
  assert.equal(opts.preferCSSPageSize, true);
});

test('PB1.C: missing geometry falls back to Letter, never Electron defaults', () => {
  assert.deepEqual(toPrintOptions().pageSize, { width: FALLBACK_PAGE.w, height: FALLBACK_PAGE.h });
  assert.deepEqual(toPrintOptions({}).pageSize, { width: 8.5, height: 11.0 });
});

test('PB1.C: malformed / non-positive dimensions fall back to Letter per-axis', () => {
  assert.deepEqual(toPrintOptions({ pageSize: { w: 0, h: -3 } }).pageSize, { width: 8.5, height: 11.0 });
  assert.deepEqual(toPrintOptions({ pageSize: { w: 'x', h: null } }).pageSize, { width: 8.5, height: 11.0 });
});
