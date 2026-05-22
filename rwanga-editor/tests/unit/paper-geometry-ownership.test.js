// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Fork A (Brick 4+5) — paper geometry ownership.
//
// #editor no longer owns paper geometry: it has lost the .rga-page class,
// the CSS paper / min-height growth model is fully retired, and a dedicated
// Paper render container exists. Page geometry now belongs solely to the
// Paper view's leaves (PrintRenderer), which carry fixed dimensions.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const RENDERER = path.resolve(__dirname, '../../renderer');

function indexDom() {
  // Parse only — external scripts are NOT executed.
  return new JSDOM(fs.readFileSync(path.join(RENDERER, 'index.html'), 'utf8'));
}

test('#editor no longer carries the .rga-page paper-ownership class', () => {
  const editor = indexDom().window.document.getElementById('editor');
  assert.ok(editor, '#editor exists in index.html');
  assert.equal(editor.classList.contains('rga-page'), false,
    '#editor must not own the paper class — paper geometry belongs to the Paper view');
});

test('index.html declares exactly one Paper render container', () => {
  const doc = indexDom().window.document;
  assert.equal(doc.querySelectorAll('#rga-paper-view-root').length, 1);
});

test('editor-prosemirror.css no longer has a .rga-page paper rule (growth model removed)', () => {
  let css = fs.readFileSync(path.join(RENDERER, 'css/editor-prosemirror.css'), 'utf8');
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');   // strip comments
  // `.rga-page` exactly — not .rga-page-row / -sheet / -marker / -break.
  assert.equal(/\.rga-page(?![-\w])/.test(css), false,
    'the .rga-page paper class (carrier of the min-height growth model) must be fully retired');
});

test('a Paper leaf carries fixed page geometry — PrintRenderer sets an inline height', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  delete require.cache[require.resolve('../../renderer/js/framework/print-renderer.js')];
  require('../../renderer/js/framework/print-renderer.js');
  const container = document.createElement('div');
  global.window.Rga.PrintRenderer.render({
    totalPages: 1,
    layoutProfile: { pageSize: { w: 8.5, h: 11, unit: 'in' } },
    pages: [{ pageNumber: 1, usedLines: 0, availableLines: 57, blocks: [] }]
  }, container, {});
  const sheet = container.querySelector('.rga-page-sheet');
  assert.ok(sheet, 'a leaf was rendered');
  assert.equal(sheet.style.height, '11in', 'each Paper leaf has a fixed inline height — it cannot grow');
});
