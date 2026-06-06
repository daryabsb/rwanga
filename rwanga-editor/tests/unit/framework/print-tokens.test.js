// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PrintTokens — header/footer token resolver unit tests.
// Print Truth Unification V1, SCOPE C.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function boot() {
  global.window = { Rga: {} };
  const p = require.resolve('../../../renderer/js/framework/print-tokens.js');
  delete require.cache[p];
  require(p);
  return global.window.Rga.PrintTokens;
}

test('[print-tokens] resolves every supported token', () => {
  const PT = boot();
  const ctx = { title: 'The Last Light', date: '2026-06-06', version: '3', page: 2, pages: 10 };
  assert.equal(
    PT.resolve('{{title}} — {{date}} — v{{version}} — {{page}}/{{pages}}', ctx),
    'The Last Light — 2026-06-06 — v3 — 2/10');
});

test('[print-tokens] token names are case-insensitive and tolerate inner spaces', () => {
  const PT = boot();
  assert.equal(PT.resolve('{{ Title }} {{PAGE}}', { title: 'X', page: 4 }), 'X 4');
});

test('[print-tokens] unknown tokens are left literal (no surprise deletion)', () => {
  const PT = boot();
  assert.equal(PT.resolve('{{title}} {{author}}', { title: 'X' }), 'X {{author}}');
});

test('[print-tokens] a known token with no ctx value resolves to empty', () => {
  const PT = boot();
  assert.equal(PT.resolve('A{{version}}B', {}), 'AB');
});

test('[print-tokens] empty / non-string input → empty string', () => {
  const PT = boot();
  assert.equal(PT.resolve('', { title: 'X' }), '');
  assert.equal(PT.resolve(null, { title: 'X' }), '');
  assert.equal(PT.resolve(undefined), '');
});

test('[print-tokens] plain text without tokens passes through unchanged', () => {
  const PT = boot();
  assert.equal(PT.resolve('Property of Rwanga Films', {}), 'Property of Rwanga Films');
});

test('[print-tokens] exposes the supported token vocabulary (frozen)', () => {
  const PT = boot();
  assert.deepEqual(PT.TOKENS, ['title', 'date', 'version', 'page', 'pages']);
  assert.ok(Object.isFrozen(PT.TOKENS));
});
