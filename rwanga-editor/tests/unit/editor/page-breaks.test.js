// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('../../../renderer/js/constants.js');
require('../../../renderer/js/doc-types/screenplay/plugins/page-breaks.js');
const PageBreaks = global.window.Rga.PageBreaks;

test('estimateLinesPerPage: Letter with 1in top/bottom margins = 54 lines', () => {
  // (11 - 1 - 1) usable inches * 6 lines/inch = 54
  const lpp = PageBreaks.estimateLinesPerPage({
    paperSize: 'Letter',
    margins: { top: 1, right: 1, bottom: 1, left: 1.5 }
  });
  assert.equal(lpp, 54);
});

test('estimateLinesPerPage: A4 with 1in top/bottom margins = 58 lines', () => {
  // (11.69 - 2) * 6 = 58.14 -> floor 58
  const lpp = PageBreaks.estimateLinesPerPage({
    paperSize: 'A4',
    margins: { top: 1, right: 1, bottom: 1, left: 1.5 }
  });
  assert.equal(lpp, 58);
});

test('estimateLinesPerPage: unknown paper size falls back to Letter', () => {
  const lpp = PageBreaks.estimateLinesPerPage({
    paperSize: 'NotAPaper',
    margins: { top: 1, right: 1, bottom: 1, left: 1 }
  });
  assert.equal(lpp, 54);
});
