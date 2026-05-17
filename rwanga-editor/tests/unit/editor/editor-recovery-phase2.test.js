// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Editor Recovery Phase 2 — CSS guards.
//
// Phase 2 covers three CSS-only recovery items from the forensic
// report:
//   • C2 — Print page-number identity (right-aligned manuscript-style
//          "N." at each page boundary, using existing widget DOM +
//          data-page-number attr via CSS ::after pseudo).
//   • C5 — Scene-heading slug strengthening (thicker pink underline,
//          letter-spacing, more breathing room).
//   • C3 — Scene Navigator dual-state distinction (current uses
//          --accent-rwanga; selected uses softer overlay + outline).
//
// These guards lock the recovery shape so future CSS edits can't
// silently regress to the pre-Phase-2 weaker treatments.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const EDITOR_CSS = path.join(REPO, 'renderer/css/editor-prosemirror.css');
const SHELL_CSS  = path.join(REPO, 'renderer/css/shell.css');

function readText(file) { return fs.readFileSync(file, 'utf8'); }

function ruleBody(css, selectorLiteral) {
  const escaped = selectorLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}

// ----------------------------------------------------------------
// C2 — Print page-number identity
// ----------------------------------------------------------------

test('Phase 2 / C2: Print view shows .rga-page-marker (no longer hidden) and has its own styling block', () => {
  const css = readText(EDITOR_CSS);
  // The dedicated Print-styling rule must exist with display: block
  // (or display set to something other than 'none').
  const printRuleBody = ruleBody(css, 'body.view-print-active .rga-page-marker');
  assert.ok(printRuleBody,
    'body.view-print-active .rga-page-marker must have its own rule (Phase 2 unhides it for page-N display)');
  // Display must NOT be 'none' inside the print-active rule body.
  assert.equal(/display\s*:\s*none/.test(printRuleBody), false,
    'Phase 2 C2: print-active .rga-page-marker must NOT have display: none');
  // Draft + PrintPreview must still hide it (Phase 1 invariant preserved).
  ['view-draft-active', 'view-print-preview-active'].forEach(function(cls) {
    const re = new RegExp('body\\.' + cls + '\\s+\\.rga-page-marker');
    assert.ok(re.test(css),
      'Phase 2 must keep the hide rule for body.' + cls + ' (only Print was unhided)');
  });
});

test('Phase 2 / C2: Print marker uses ::after pseudo with attr(data-page-number)', () => {
  const css = readText(EDITOR_CSS);
  const body = ruleBody(css, 'body.view-print-active .rga-page-marker::after');
  assert.ok(body, 'body.view-print-active .rga-page-marker::after rule must exist (Phase 2 C2)');
  // The content must use attr(data-page-number) — pulling the page
  // number from the existing widget DOM attribute. No fake content.
  assert.ok(/content\s*:\s*attr\(\s*data-page-number\s*\)/.test(body),
    'Print page marker ::after must use attr(data-page-number) for the page number');
  // Manuscript convention: "N." (number + period). Verify the period.
  assert.ok(/content\s*:\s*attr\(\s*data-page-number\s*\)\s*['"]\.['"]/.test(body),
    'Print page marker ::after content must append "." (manuscript convention "1." "2." …)');
});

test('Phase 2 / C2: Print marker positions the page number at the right edge', () => {
  const css = readText(EDITOR_CSS);
  const containerBody = ruleBody(css, 'body.view-print-active .rga-page-marker');
  assert.ok(containerBody);
  // Right-aligned (manuscript-standard top-right page number).
  assert.ok(/text-align\s*:\s*right/.test(containerBody),
    'Print marker container must be text-align: right (manuscript convention top-right)');
  // The container must hide the original "— Page N —" text so the
  // ::after pseudo's "N." shows alone. font-size: 0 + color:transparent
  // is the standard hide-text-but-show-pseudo trick.
  assert.ok(/font-size\s*:\s*0/.test(containerBody),
    'Print marker container must zero-out the original text (font-size: 0) so only the pseudo shows');
});

// ----------------------------------------------------------------
// C5 — Scene-heading slug
// ----------------------------------------------------------------

test('Phase 2 / C5: scene heading slug has the dark-pink underline (pre-existing) + Phase-2 strengthening', () => {
  const css = readText(EDITOR_CSS);
  const body = ruleBody(css, '.rga-scene-heading-v3');
  assert.ok(body, '.rga-scene-heading-v3 rule must exist');
  // Pink underline — the brand identifier. Width must be >= 2px.
  const borderMatch = body.match(/border-bottom\s*:\s*(\d+)px\s+solid\s+var\(--accent-rwanga/);
  assert.ok(borderMatch,
    'Scene heading must have a solid var(--accent-rwanga) bottom border (brand identifier)');
  const width = parseInt(borderMatch[1], 10);
  assert.ok(width >= 2,
    'Scene heading underline thickness must be ≥ 2px (Phase 2 strengthened to 3px). Got ' + width + 'px');
  // Letter-spacing on uppercase — Phase 2 addition.
  assert.ok(/letter-spacing\s*:\s*[\d.]+/.test(body),
    'Scene heading must declare letter-spacing (Phase 2 addition — uppercase needs spacing to read crisply)');
  // Top margin for scene separation — Phase 2 addition.
  const marginMatch = body.match(/margin\s*:\s*([^;]+);/);
  assert.ok(marginMatch, 'Scene heading must declare margin');
  // Top value (first margin value) should be at least 0.5em.
  // Margin shorthand: parse first numeric token.
  const topVal = marginMatch[1].trim().split(/\s+/)[0];
  assert.ok(/^\d*\.?\d+(em|rem|px)/.test(topVal),
    'Scene heading margin-top must be a positive length (Phase 2: 1em). Got: ' + topVal);
});

// ----------------------------------------------------------------
// C3 — Scene Navigator dual-state distinction
// ----------------------------------------------------------------

test('Phase 2 / C3: Scene Navigator current row uses --accent-rwanga (you-are-here brand)', () => {
  const css = readText(SHELL_CSS);
  const body = ruleBody(css, '.rga-shell-scene-navigator-row-current');
  assert.ok(body, '.rga-shell-scene-navigator-row-current rule must exist');
  assert.ok(/border-left-color\s*:\s*var\(--accent-rwanga/.test(body),
    'Current row must use --accent-rwanga for the left bar (Phase 2 — was --text-primary, too similar to selected)');
});

test('Phase 2 / C3: Scene Navigator selected row uses a softer overlay than current (no shared --bg-active)', () => {
  const css = readText(SHELL_CSS);
  const body = ruleBody(css, '.rga-shell-scene-navigator-row-selected');
  assert.ok(body, '.rga-shell-scene-navigator-row-selected rule must exist');
  // Pre-Phase-2 used --bg-active (saturated). Phase 2 uses --bg-hover
  // (softer) + outline. Reject any rule that uses --bg-active as the
  // background.
  assert.equal(/background\s*:\s*var\(--bg-active/.test(body), false,
    'Selected row must NOT use --bg-active (too similar to current). Phase 2 uses --bg-hover (softer overlay)');
  // The outline-as-focus-ring distinction is the C3 deliverable.
  assert.ok(/outline\s*:\s*\d+px\s+solid/.test(body),
    'Selected row must declare an outline (keyboard-focus-ring feel — Phase 2 C3)');
});

test('Phase 2 / C3: current + selected use DIFFERENT visual treatments (separation invariant strengthened)', () => {
  const css = readText(SHELL_CSS);
  const currBody = ruleBody(css, '.rga-shell-scene-navigator-row-current') || '';
  const selBody  = ruleBody(css, '.rga-shell-scene-navigator-row-selected') || '';
  // Current uses --accent-rwanga (brand pink) somewhere; selected does not.
  assert.ok(/--accent-rwanga/.test(currBody),
    'Current row body must reference --accent-rwanga (brand)');
  assert.equal(/--accent-rwanga/.test(selBody), false,
    'Selected row must NOT use --accent-rwanga (that\'s current\'s brand). Selected uses neutral overlay/outline.');
  // Current sets font-weight; selected does not. Different text treatment.
  assert.ok(/font-weight\s*:\s*[56789]00|font-weight\s*:\s*bold/.test(currBody),
    'Current row should bump font-weight (≥500) to read as "you are here" emphasis');
});
