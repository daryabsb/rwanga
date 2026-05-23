// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Editor Recovery Phase 1 — CSS guards.
//
// The Phase-1 acceptance is "Flow view shows visible page separation"
// achieved via CSS-only overrides on the existing page-marker /
// page-break DOM. These guards lock the override shape so future
// edits to editor-prosemirror.css cannot silently regress the Flow
// page-boundary feel back to its pre-recovery 1px-dashed-hairline
// state — while keeping Print / Draft / PrintPreview untouched.
//
// Scope rules from the slice brief that the guards enforce:
//   • Flow has a real boundary treatment for both .rga-page-marker
//     (auto) and .rga-page-break (manual).
//   • Print / Draft / PrintPreview hide the marker (unchanged).
//   • No content-splitting changes (no `column-*` properties added).
//   • No engine file touched (the guards never scan framework/* etc.).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const CSS_PATH = path.join(REPO, 'renderer/css/editor-prosemirror.css');

function readText(file) { return fs.readFileSync(file, 'utf8'); }

// Find a CSS rule's body for a given selector. Naive — assumes the
// selector appears once before its `{...}` body. Sufficient for the
// targeted assertions here.
function ruleBody(css, selectorLiteral) {
  // Escape regex metacharacters in the literal selector.
  const escaped = selectorLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}

// ----------------------------------------------------------------
// .rga-page-marker (auto-page-break widget) — Flow override
// ----------------------------------------------------------------

// SUPERSEDED by RTL Recovery Slice B. The Phase-1 design gave the Flow
// page-marker a visible-gap margin (~28px) — but that gap was un-budgeted
// by PageMap and inflated the rendered Flow page toward A2. Slice B makes
// the marker a zero-geometry overlay; this guard now locks that.
test('RTL Slice B: Flow page-marker is a zero-geometry overlay (no in-flow gap)', () => {
  const css = readText(CSS_PATH);
  const body = ruleBody(css, '#editor-container.view-flow .rga-page-marker');
  assert.ok(body, 'Flow override for .rga-page-marker must exist');
  assert.ok(/height\s*:\s*0\b/.test(body),
    'Flow .rga-page-marker must be height:0 — visualization only, zero layout influence');
  assert.ok(/margin\s*:\s*0\b/.test(body),
    'Flow .rga-page-marker must have no margin — the old visible-gap margin inflated the page');
});

test('Flow page marker: parent has no border-top hairline (Phase C invariant preserved under Option A close-out 2026-05-23)', () => {
  const css = readText(CSS_PATH);
  const body = ruleBody(css, '#editor-container.view-flow .rga-page-marker');
  assert.ok(body, 'Flow override for .rga-page-marker must exist');
  // Phase C said: hairline NOT on parent. Option A close-out went
  // further: hairline retired entirely — Flow is a continuous drafting
  // surface, no page-seam, only a quiet page-number label hint.
  // The parent border-top:0 invariant survives.
  assert.ok(!/border-top\s*:\s*\d+px\s+solid/.test(body),
    'parent .rga-page-marker border-top must NOT be a solid line');
  assert.ok(/border-bottom\s*:\s*0/.test(body),
    'Flow .rga-page-marker border-bottom must be 0');
  // .rga-page-marker-rule Flow override is GONE (Option A — no hairline).
  const ruleBody_ = ruleBody(css, '#editor-container.view-flow .rga-page-marker .rga-page-marker-rule');
  assert.equal(ruleBody_, null,
    'Option A close-out: Flow .rga-page-marker-rule rule retired — page boundary has no hairline');
});

test('Phase C: Flow .rga-page-marker uses transparent background (Phase C removes gradient)', () => {
  const css = readText(CSS_PATH);
  const body = ruleBody(css, '#editor-container.view-flow .rga-page-marker');
  assert.ok(body, 'Flow override for .rga-page-marker must still exist (Phase C kept the rule)');
  // Phase C replaces the desk-strip gradient with a calm, transparent background.
  // The dividing line is now a single border-top; no gradient needed.
  assert.ok(/background\s*:\s*transparent/.test(body),
    'Phase C: Flow .rga-page-marker must use a transparent background (gradient removed)');
});

test('Option A close-out (2026-05-23): no hairline at all — Flow boundary is label-only', () => {
  // Original test asserted that the hairline spans the full sheet
  // width via -0.5in negative offsets. Option A retired the hairline
  // entirely — Flow is a continuous drafting surface, no page seam.
  // Marker geometry contract (height:0, zero PageMap budget) is
  // unchanged; only the visible chrome is reduced to the quiet
  // page-number label.
  const css = readText(CSS_PATH);
  const ruleBody_ = ruleBody(css, '#editor-container.view-flow .rga-page-marker .rga-page-marker-rule');
  assert.equal(ruleBody_, null,
    'Option A: Flow .rga-page-marker-rule rule must not exist (no hairline crossing the manuscript)');
});

// ----------------------------------------------------------------
// .rga-page-break (manual page-break PM node) — Flow override
// ----------------------------------------------------------------

test('Phase C / SP-05: Flow .rga-page-break CSS rule is removed (v3 schema has no pageBreak node)', () => {
  const css = readText(CSS_PATH);
  // SP-05 resolution: the .rga-page-break CSS is dead code; v3 schema has no
  // pageBreak node. Phase C deleted both rule blocks and left a single comment.
  // Verify: no selector rule body exists for the deleted selectors.
  const flowBreakBody = ruleBody(css, '#editor-container.view-flow .rga-page-break');
  assert.equal(flowBreakBody, null,
    'SP-05: #editor-container.view-flow .rga-page-break rule must be absent (deleted in Phase C)');
  // The deletion comment must be present so the removal is documented.
  assert.ok(css.includes('.rga-page-break rules removed 2026-05-18'),
    'SP-05: a deletion comment must document the removal of .rga-page-break rules');
});

// ----------------------------------------------------------------
// Print / Draft / PrintPreview untouched
// ----------------------------------------------------------------

test('Phase 1: Draft / Print / PrintPreview still HIDE .rga-page-marker (Phase 1 is Flow-only)', () => {
  const css = readText(CSS_PATH);
  // The hide rule is a multi-selector block:
  //   body.view-draft-active .rga-page-marker,
  //   body.view-print-active .rga-page-marker,
  //   body.view-print-preview-active .rga-page-marker { display: none; }
  // Verify all three selectors appear AND the block sets display: none.
  ['view-draft-active', 'view-print-active', 'view-print-preview-active'].forEach(function(cls) {
    const re = new RegExp('body\\.' + cls + '\\s+\\.rga-page-marker');
    assert.ok(re.test(css),
      'Phase 1 must not break the hide rule for body.' + cls);
  });
  // The hide block must contain display: none.
  const hideBlockMatch = css.match(
    /body\.view-draft-active\s+\.rga-page-marker[\s\S]*?\{([^}]*)\}/);
  assert.ok(hideBlockMatch);
  assert.ok(/display\s*:\s*none/.test(hideBlockMatch[1]),
    'Phase 1 must keep the hide rule (display: none) for Draft / Print / PrintPreview');
});

// ----------------------------------------------------------------
// No content-splitting (the slice rule "no content splitting changes")
// ----------------------------------------------------------------

test('Phase 1: no content-splitting CSS (no column-* / break-after / page-break-after) added to Flow rules', () => {
  const css = readText(CSS_PATH);
  // Scan the two Flow override blocks specifically.
  const markerBody = ruleBody(css, '#editor-container.view-flow .rga-page-marker') || '';
  const breakBody  = ruleBody(css, '#editor-container.view-flow .rga-page-break')  || '';
  // Forbidden properties: would change how content WRAPS, not just
  // how the boundary LOOKS. Phase 1 acceptance: no content splitting.
  const FORBIDDEN = /\b(?:column-count|column-width|columns|break-before|break-after|page-break-before|page-break-after)\s*:/;
  assert.equal(FORBIDDEN.test(markerBody), false,
    'Flow .rga-page-marker must NOT use column-* / *break-* properties (would split content)');
  assert.equal(FORBIDDEN.test(breakBody), false,
    'Flow .rga-page-break must NOT use column-* / *break-* properties');
});
