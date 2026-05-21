// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// RTL Recovery Slice B — Flow page-marker geometry guard.
//
// The Flow page-break marker is visualization only: it must contribute ZERO
// layout height (budget cost 0, layout influence 0). Previously it was an
// in-flow block with 28px margin + 26px padding (~87px) — that height was
// un-budgeted by PageMap and inflated the rendered Flow page toward A2.
// These guards lock the marker as a zero-height overlay.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const EDITOR_PM_CSS = fs.readFileSync(
  path.resolve(__dirname, '../../../renderer/css/editor-prosemirror.css'), 'utf8');

function ruleBodyContaining(css, needle) {
  const i = css.indexOf(needle);
  if (i === -1) return null;
  const m = css.slice(i).match(/\{([^}]*)\}/);
  return m ? m[1] : null;
}

test('RTL Slice B — Flow page-marker contributes zero layout height', () => {
  const body = ruleBodyContaining(EDITOR_PM_CSS, '#editor-container.view-flow .rga-page-marker {');
  assert.ok(body, 'the Flow .rga-page-marker rule must exist');
  assert.ok(/height:\s*0\b/.test(body),
    'Flow page-marker must be height:0 — zero layout influence');
  assert.ok(/margin:\s*0\b/.test(body),
    'Flow page-marker must have no margin — un-budgeted margin inflated the page');
  assert.ok(/padding:\s*0\b/.test(body),
    'Flow page-marker must have no padding — un-budgeted padding inflated the page');
});

test('RTL Slice B — Flow page-marker hairline + label are absolute overlays', () => {
  const rule = ruleBodyContaining(EDITOR_PM_CSS,
    '#editor-container.view-flow .rga-page-marker .rga-page-marker-rule');
  assert.ok(rule && /position:\s*absolute/.test(rule),
    'the hairline must be position:absolute so it adds no flow height');
  const label = ruleBodyContaining(EDITOR_PM_CSS,
    '#editor-container.view-flow .rga-page-marker .rga-page-marker-begin');
  assert.ok(label && /position:\s*absolute/.test(label),
    'the "Page N" label must be position:absolute so it adds no flow height');
});
