// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Visual Inspection Unblockers — Fix 2: editor page-colour separation.
//
// Fork A (Brick 4+5) set the Flow `#editor` to `background: transparent`, so
// the writing surface showed the desk colour (`--editor-bg`) and the
// dedicated `--editor-page-bg` token went entirely unused — the page blended
// into the surrounding app. Fix 2 re-applies `--editor-page-bg` to the Flow
// writing surface. Colour only — no geometry, no PageMap/LayoutProfile, no
// typography change.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CSS = path.resolve(__dirname, '../../../renderer/css');

function readCss(file) {
  return fs.readFileSync(path.join(CSS, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}
function ruleBody(css, selector) {
  const m = css.match(
    new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}
// A custom-property value from one [data-theme="..."] block.
function token(css, theme, name) {
  const block = css.match(new RegExp('\\[data-theme="' + theme + '"\\]\\s*\\{([^}]*)\\}'));
  if (!block) return null;
  const d = block[1].match(new RegExp(name + '\\s*:\\s*([^;]+);'));
  return d ? d[1].trim().toLowerCase() : null;
}

test('Fix 2 — the Flow writing surface is painted with the --editor-page-bg token', () => {
  // RED before: `#editor-container.view-flow #editor` is `background: transparent`.
  const body = ruleBody(readCss('editor-prosemirror.css'), '#editor-container.view-flow #editor');
  assert.ok(body, '#editor-container.view-flow #editor rule must exist');
  assert.match(body, /background\s*:\s*var\(--editor-page-bg\)/,
    'the Flow writing surface must paint the page with var(--editor-page-bg) — not ' +
    'transparent, which showed the desk colour and blended the page into the app');
});

test('Fix 2 — page colour is distinct from the desk colour in both themes', () => {
  const css = readCss('tokens.css');
  ['dark', 'light'].forEach(function (theme) {
    const page = token(css, theme, '--editor-page-bg');
    const desk = token(css, theme, '--editor-bg');
    assert.ok(page && desk, theme + ': --editor-page-bg and --editor-bg must both be defined');
    assert.notEqual(page, desk,
      theme + ': --editor-page-bg (' + page + ') must differ from --editor-bg (' + desk +
      ') so the page reads as separate from the surrounding desk');
  });
});

test('Fix 2 — light-mode page is pure white', () => {
  assert.equal(token(readCss('tokens.css'), 'light', '--editor-page-bg'), '#ffffff',
    'light-mode --editor-page-bg must be pure white #ffffff, not a grayish white');
});

test('Fix 2 — colour-only: the Flow #editor geometry is untouched', () => {
  // Guard — Fix 2 must not change pagination geometry or re-introduce a
  // growth model / paper shell (Fork A invariants).
  const body = ruleBody(readCss('editor-prosemirror.css'), '#editor-container.view-flow #editor');
  assert.match(body, /width\s*:\s*var\(--page-width\)/, 'width token must be unchanged');
  assert.match(body, /min-height\s*:\s*auto/, 'min-height:auto (no growth model) must be unchanged');
  assert.match(body, /box-shadow\s*:\s*none/, 'no paper shadow re-introduced');
});
