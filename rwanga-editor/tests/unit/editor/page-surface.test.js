// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('../../../renderer/js/constants.js');
require('../../../renderer/js/editor/page-surface.js');
const PageSurface = global.window.Rga.PageSurface;

test('_cssVarsFor maps a Letter pageSetup to inch CSS values', () => {
  const v = PageSurface._cssVarsFor({
    paperSize: 'Letter',
    margins: { top: 1, right: 1, bottom: 1, left: 1.5 }
  });
  assert.equal(v.width, '8.5in');
  assert.equal(v.minHeight, '11in');
  assert.equal(v.contentMinHeight, '9in');
  assert.equal(v.paddingTop, '1in');
  assert.equal(v.paddingLeft, '1.5in');
});

test('_cssVarsFor falls back to Letter when paperSize is unknown', () => {
  const v = PageSurface._cssVarsFor({
    paperSize: 'NotAPaper',
    margins: { top: 1, right: 1, bottom: 1, left: 1 }
  });
  assert.equal(v.width, '8.5in');
});
