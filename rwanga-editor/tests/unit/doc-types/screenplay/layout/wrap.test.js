// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('../../../../../renderer/js/doc-types/screenplay/layout/wrap.js');
const { wrapText } = global.window.Rga.DocTypes.screenplay.layout;

test('empty string → 1 line (block still occupies a row)', () => {
  assert.equal(wrapText('', 60), 1);
  assert.equal(wrapText(null, 60), 1);
  assert.equal(wrapText(undefined, 60), 1);
});

test('whitespace-only (spaces only) → 1 line', () => {
  assert.equal(wrapText('   ', 60), 1);
});

test('explicit newlines DO split into paragraphs (n+1 newlines → n+1 lines)', () => {
  // Per docstring: newlines split into independent paragraphs.
  assert.equal(wrapText('\n', 60), 2);
  assert.equal(wrapText('\n\n', 60), 3);
});

test('short text fits one line', () => {
  assert.equal(wrapText('Karen stares.', 60), 1);
});

test('exact-fit text fits one line', () => {
  // 60 chars exactly
  const text = 'X'.repeat(60);
  assert.equal(wrapText(text, 60), 1);
});

test('one-char overflow wraps to 2 lines', () => {
  // "60-char word " + 1 more word should wrap (the space + word push past 60).
  const text = 'X'.repeat(58) + ' YY';
  assert.equal(wrapText(text, 60), 2);
});

test('long single word does not break — stays on 1 line', () => {
  const text = 'X'.repeat(120);
  // No spaces, can't be wrapped — engine accepts overflow.
  assert.equal(wrapText(text, 60), 1);
});

test('multi-word paragraph wraps greedily on space boundaries', () => {
  // 5 words of 12 chars each ("XXXXXXXXXXXX") with single spaces between =
  // 12 + 1 + 12 + 1 + 12 + 1 + 12 + 1 + 12 = 64 chars.
  // At width 30: word1 (12) + space + word2 (12) = 25, then can't fit word3 (would be 38);
  // line 2: word3 (12) + space + word4 (12) = 25, then can't fit word5; line 3: word5.
  // Expected: 3 lines.
  const text = ('X'.repeat(12) + ' ').repeat(5).trim();
  assert.equal(wrapText(text, 30), 3);
});

test('explicit newline = paragraph break, each para wrapped independently', () => {
  // Two short lines separated by \n should be 2 lines total.
  assert.equal(wrapText('First.\nSecond.', 60), 2);
});

test('three short paras → 3 lines', () => {
  assert.equal(wrapText('A\nB\nC', 60), 3);
});

test('two paragraphs each wrapping → sums', () => {
  const para1 = ('X'.repeat(12) + ' ').repeat(5).trim(); // 3 lines at width 30
  const para2 = 'short.';                                  // 1 line
  assert.equal(wrapText(para1 + '\n' + para2, 30), 4);
});

test('zero/negative width → 1 line (safety fallback)', () => {
  assert.equal(wrapText('some text', 0), 1);
  assert.equal(wrapText('some text', -5), 1);
});

test('industry-realistic action paragraph at 60 chars', () => {
  // Real action lines from "The Last Light" sample:
  const text = 'A beat-up car rolls to a stop at the end of a long gravel drive. The engine ticks as it cools. Mist drifts low through an overgrown rose garden.';
  // 147 chars / 60 char-line ≈ 3 lines with greedy wrap (might be 3 or 4 depending on space boundaries).
  const lines = wrapText(text, 60);
  assert.ok(lines >= 2 && lines <= 4, 'expected 2-4 lines, got ' + lines);
});

test('industry-realistic dialogue at 35 chars', () => {
  const text = 'I miss you, Nani. I miss everything we never did together.';
  // 59 chars / 35 ≈ 2 lines.
  const lines = wrapText(text, 35);
  assert.ok(lines >= 2 && lines <= 3, 'expected 2-3 lines, got ' + lines);
});
