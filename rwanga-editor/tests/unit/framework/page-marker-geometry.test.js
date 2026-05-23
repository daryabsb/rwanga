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

test('Flow page-marker label is an absolute overlay (Option A close-out 2026-05-23 — hairline retired, label remains)', () => {
  // RTL Slice B originally required both hairline + label to be
  // absolute overlays (zero flow height contract). Option A close-out
  // retired the hairline entirely — Flow has no page seam. Only the
  // quiet page-number label remains, still as an absolute overlay so
  // the marker's zero-flow-height contract holds.
  const ruleStillGone = ruleBodyContaining(EDITOR_PM_CSS,
    '#editor-container.view-flow .rga-page-marker .rga-page-marker-rule');
  assert.equal(ruleStillGone, null,
    'Option A: Flow .rga-page-marker-rule (hairline) must not exist');
  const label = ruleBodyContaining(EDITOR_PM_CSS,
    '#editor-container.view-flow .rga-page-marker .rga-page-marker-begin');
  assert.ok(label && /position:\s*absolute/.test(label),
    'the "Page N" label must remain position:absolute so it adds no flow height');
});
