// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// RTL Recovery Slice 1 — font-chain guard tests.
//
// The editor carries dir="rtl" on #editor itself (Rga.ScriptLanguage), so a
// descendant selector `[dir="rtl"] .ProseMirror` never matches. These guards
// assert the dir=rtl → var(--font-editor-rtl) chain is wired through compound
// selectors that match the element that actually carries dir, plus the v3
// scene heading (which sets its own font-family) and the Print Preview page
// sheet — and that LTR rendering is left untouched.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const EDITOR_CSS = fs.readFileSync(path.join(REPO, 'renderer', 'css', 'editor.css'), 'utf8');
const EDITOR_PM_CSS = fs.readFileSync(path.join(REPO, 'renderer', 'css', 'editor-prosemirror.css'), 'utf8');

// Body of the first CSS rule whose selector list contains `needle`.
function ruleBodyContaining(css, needle) {
  const i = css.indexOf(needle);
  if (i === -1) return null;
  const m = css.slice(i).match(/\{([^}]*)\}/);
  return m ? m[1] : null;
}

test('RTL Slice1 — #editor[dir="rtl"] applies the RTL editor font', () => {
  assert.ok(EDITOR_CSS.includes('#editor[dir="rtl"]'),
    'editor.css must target #editor[dir="rtl"] — the element itself carries dir');
  const body = ruleBodyContaining(EDITOR_CSS, '#editor[dir="rtl"]');
  assert.ok(body && body.includes('var(--font-editor-rtl)'),
    '#editor[dir="rtl"] must set font-family: var(--font-editor-rtl)');
});

test('RTL Slice1 — .ProseMirror[dir="rtl"] applies the RTL editor font', () => {
  assert.ok(EDITOR_PM_CSS.includes('.ProseMirror[dir="rtl"]'),
    'editor-prosemirror.css must target .ProseMirror[dir="rtl"]');
  const body = ruleBodyContaining(EDITOR_PM_CSS, '.ProseMirror[dir="rtl"]');
  assert.ok(body && body.includes('var(--font-editor-rtl)'),
    '.ProseMirror[dir="rtl"] must set font-family: var(--font-editor-rtl)');
});

test('RTL Slice1 — scene heading uses the RTL font under [dir="rtl"]', () => {
  assert.ok(EDITOR_PM_CSS.includes('[dir="rtl"] .rga-scene-heading-v3'),
    'the v3 scene heading sets its own font-family, so it needs an explicit RTL rule');
  const body = ruleBodyContaining(EDITOR_PM_CSS, '[dir="rtl"] .rga-scene-heading-v3');
  assert.ok(body && body.includes('var(--font-editor-rtl)'),
    'the scene-heading RTL rule must set font-family: var(--font-editor-rtl)');
  assert.ok(body && !/courier/i.test(body),
    'the scene-heading RTL rule must not fall back to Courier');
});

test('RTL Slice1 — Print Preview page sheet uses the RTL font under [dir="rtl"]', () => {
  assert.ok(EDITOR_PM_CSS.includes('.rga-page-sheet[dir="rtl"]'),
    'the print page sheet needs an RTL font rule so Print Preview matches Flow');
  const body = ruleBodyContaining(EDITOR_PM_CSS, '.rga-page-sheet[dir="rtl"]');
  assert.ok(body && body.includes('var(--font-editor-rtl)'),
    '.rga-page-sheet[dir="rtl"] must set font-family: var(--font-editor-rtl)');
  assert.ok(body && !/courier/i.test(body),
    'the print RTL rule must not fall back to Courier');
});

test('RTL Slice1 — LTR editor + print fonts are unchanged', () => {
  assert.ok(EDITOR_PM_CSS.includes("'Courier Prime', 'Courier New', monospace"),
    'the LTR editor base font (Courier Prime) must remain');
  const sheetBody = ruleBodyContaining(EDITOR_PM_CSS, '.rga-page-sheet {');
  assert.ok(sheetBody && /courier new/i.test(sheetBody),
    'the LTR print sheet base font (Courier New) must remain');
});
