// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// SlugResolver V1 — pure-function unit tests.
//
// Proves the single canonical slug projection (SLUG_TRUTH_DOCTRINE_V1):
//   * default-convention composition
//   * empty-field collapse
//   * text / tokens / length invariants
//   * custom + partial convention
//   * purity (no input mutation; deterministic)
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  const p = '../../../renderer/js/framework/slug-resolver.js';
  delete require.cache[require.resolve(p)];
  require(p);
  return global.window.Rga.SlugResolver;
}

// ----------------------------------------------------------------
// Default-convention composition
// ----------------------------------------------------------------

test('compose: full heading → "SETTING LOCATION — TIME"', () => {
  const SR = boot();
  assert.equal(SR.compose({ setting: 'INT.', location: 'KITCHEN', time: 'DAY' }).text, 'INT. KITCHEN — DAY');
});

test('compose: setting + location only (no time)', () => {
  const SR = boot();
  assert.equal(SR.compose({ setting: 'INT.', location: 'KITCHEN', time: '' }).text, 'INT. KITCHEN');
});

test('compose: setting + time only (no location) keeps the em-dash before time', () => {
  const SR = boot();
  assert.equal(SR.compose({ setting: 'INT.', location: '', time: 'DAY' }).text, 'INT. — DAY');
});

test('compose: location + time only (no setting) drops the leading space', () => {
  const SR = boot();
  assert.equal(SR.compose({ setting: '', location: 'KITCHEN', time: 'DAY' }).text, 'KITCHEN — DAY');
});

// ----------------------------------------------------------------
// Empty-field collapse
// ----------------------------------------------------------------

test('compose: single present field → no separators', () => {
  const SR = boot();
  assert.equal(SR.compose({ setting: 'INT.', location: '', time: '' }).text, 'INT.');
  assert.equal(SR.compose({ setting: '', location: 'KITCHEN', time: '' }).text, 'KITCHEN');
  assert.equal(SR.compose({ setting: '', location: '', time: 'DAY' }).text, 'DAY');
});

test('compose: all empty → empty string, empty tokens, zero length', () => {
  const SR = boot();
  const r = SR.compose({ setting: '', location: '', time: '' });
  assert.equal(r.text, '');
  assert.deepEqual(r.tokens, []);
  assert.equal(r.length, 0);
});

test('compose: missing/undefined fields treated as empty', () => {
  const SR = boot();
  assert.equal(SR.compose({}).text, '');
  assert.equal(SR.compose({ setting: 'INT.' }).text, 'INT.');
  assert.equal(SR.compose(null).text, '');
  assert.equal(SR.compose(undefined).text, '');
});

test('compose: null field values are coerced to empty (not "null")', () => {
  const SR = boot();
  assert.equal(SR.compose({ setting: 'INT.', location: null, time: 'DAY' }).text, 'INT. — DAY');
});

// ----------------------------------------------------------------
// Invariants: length === text.length; tokens join === text
// ----------------------------------------------------------------

test('invariants hold across a matrix of headings', () => {
  const SR = boot();
  const matrix = [
    { setting: 'INT.', location: 'KITCHEN', time: 'DAY' },
    { setting: 'EXT.', location: 'BEACH', time: 'NIGHT' },
    { setting: 'INT.', location: '', time: 'DAY' },
    { setting: '', location: 'KITCHEN', time: 'DAY' },
    { setting: 'INT.', location: 'KITCHEN', time: '' },
    { setting: '', location: '', time: 'DAY' },
    { setting: '', location: '', time: '' },
    { setting: 'INT./EXT.', location: 'APARTMENT — KITCHEN', time: 'CONTINUOUS' },
    { setting: 'داخلي', location: 'مطبخ', time: 'ليل' }
  ];
  matrix.forEach(function(h) {
    const r = SR.compose(h);
    assert.equal(r.length, r.text.length, 'length === text.length for ' + JSON.stringify(h));
    assert.equal(r.tokens.map(function(t) { return t.value; }).join(''), r.text,
      'tokens join === text for ' + JSON.stringify(h));
  });
});

test('tokens carry correct kinds + interleaved separators', () => {
  const SR = boot();
  const r = SR.compose({ setting: 'INT.', location: 'KITCHEN', time: 'DAY' });
  assert.deepEqual(r.tokens, [
    { kind: 'setting',  value: 'INT.' },
    { kind: 'sep',      value: ' ' },
    { kind: 'location', value: 'KITCHEN' },
    { kind: 'sep',      value: ' — ' },
    { kind: 'time',     value: 'DAY' }
  ]);
});

// ----------------------------------------------------------------
// Convention handling
// ----------------------------------------------------------------

test('DEFAULT_CONVENTION matches today exactly', () => {
  const SR = boot();
  assert.deepEqual(SR.DEFAULT_CONVENTION, {
    order: ['setting', 'location', 'time'],
    separators: { settingLocation: ' ', locationTime: ' — ' }
  });
});

test('custom separators are honored', () => {
  const SR = boot();
  const conv = { order: ['setting', 'location', 'time'], separators: { settingLocation: ' ', locationTime: ' - ' } };
  assert.equal(SR.compose({ setting: 'INT.', location: 'KITCHEN', time: 'DAY' }, conv).text, 'INT. KITCHEN - DAY');
});

test('partial convention inherits default separators', () => {
  const SR = boot();
  // Only override settingLocation; locationTime should still default to ' — '.
  const conv = { separators: { settingLocation: '_' } };
  assert.equal(SR.compose({ setting: 'INT.', location: 'KITCHEN', time: 'DAY' }, conv).text, 'INT._KITCHEN — DAY');
});

// ----------------------------------------------------------------
// Purity
// ----------------------------------------------------------------

test('purity: same input → identical output (deterministic)', () => {
  const SR = boot();
  const h = { setting: 'INT.', location: 'KITCHEN', time: 'DAY' };
  assert.deepEqual(SR.compose(h), SR.compose(h));
});

test('purity: does not mutate the input heading', () => {
  const SR = boot();
  const h = { setting: 'INT.', location: 'KITCHEN', time: 'DAY' };
  const snapshot = JSON.stringify(h);
  SR.compose(h);
  assert.equal(JSON.stringify(h), snapshot);
});
