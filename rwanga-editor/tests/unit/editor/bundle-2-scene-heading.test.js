// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Bundle 2 §A — scene heading hierarchy polish.
// Locks the type-step + negative-space recovery so future edits can't
// silently regress to the pre-Bundle-2 "blends with body text" state.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const EDITOR_CSS = path.join(REPO, 'renderer/css/editor-prosemirror.css');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function ruleBody(css, selectorLiteral) {
  const escaped = selectorLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp('(?:^|\\n)\\s*' + escaped + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}
function parseLengthEm(s) {
  // Parse first em token from a margin/padding shorthand value.
  const m = s.match(/(-?\d*\.?\d+)em/);
  return m ? parseFloat(m[1]) : null;
}
function parseLengthPt(s) {
  const m = s.match(/(-?\d*\.?\d+)pt/);
  return m ? parseFloat(m[1]) : null;
}

test('Bundle 2 §A: scene heading font-size bumped to ≥13pt (one type-notch above body)', () => {
  const css = read(EDITOR_CSS);
  const body = ruleBody(css, '.rga-scene-heading-v3');
  assert.ok(body, '.rga-scene-heading-v3 rule must exist');
  const sizeDecl = body.match(/font-size\s*:\s*([^;]+);/);
  assert.ok(sizeDecl, 'scene heading must declare font-size');
  const pt = parseLengthPt(sizeDecl[1]);
  assert.ok(pt != null && pt >= 13,
    'Scene heading font-size must be ≥ 13pt (Bundle 2 §A: one type-notch above 12pt body). Got: ' + sizeDecl[1]);
});

test('scene heading margin-top kept tight against the scene-num chrome (replaces Bundle 2 §A ≥1.5em rule, retired 2026-05-23)', () => {
  // Bundle 2 §A originally required margin-top ≥ 1.5em to create
  // "scene-boundary breathing room" between the scene-num chrome and
  // the slug. In practice this combined with .rga-scene-v3-content
  // padding-top to produce a ~27px gap that the user explicitly
  // complained read as a chasm (especially in RTL). 2026-05-23
  // tightening reduced margin-top to 0.4em AND retired the
  // .rga-scene-v3-content padding-top so margins can collapse cleanly.
  // New invariant: margin-top must be SMALL (< 1em) — the original
  // intent (visible separation) is satisfied by the much-smaller
  // collapsed gap.
  const css = read(EDITOR_CSS);
  const body = ruleBody(css, '.rga-scene-heading-v3');
  const marginDecl = body.match(/margin\s*:\s*([^;]+);/);
  assert.ok(marginDecl, 'scene heading must declare margin shorthand');
  const tokens = marginDecl[1].trim().split(/\s+/);
  const topEm = parseLengthEm(tokens[0]);
  assert.ok(topEm != null && topEm < 1.0,
    'Scene heading margin-top must be small (< 1em) — the historic 1.5em+ produced a visible chasm. Got: ' + tokens[0]);
});

test('Bundle 2 §A: scene heading margin-bottom bumped to ≥0.8em (slug-to-action gap)', () => {
  const css = read(EDITOR_CSS);
  const body = ruleBody(css, '.rga-scene-heading-v3');
  const marginDecl = body.match(/margin\s*:\s*([^;]+);/);
  const tokens = marginDecl[1].trim().split(/\s+/);
  // Margin shorthand: top right bottom left, or top h-axis bottom, etc.
  // 4-value: bottom is tokens[2]. 3-value: tokens[2]. 2-value: tokens[0]
  // is vertical (no separate bottom). Assert based on length.
  let bottomEm;
  if (tokens.length >= 3) bottomEm = parseLengthEm(tokens[2]);
  else                    bottomEm = parseLengthEm(tokens[0]);
  assert.ok(bottomEm != null && bottomEm >= 0.8,
    'Scene heading margin-bottom must be ≥ 0.8em (Bundle 2 §A: more gap to the first action line). Got: ' + tokens.join(' '));
});

test('Bundle 2 §A: scene heading retains the 3px brand-pink underline (no regression)', () => {
  const css = read(EDITOR_CSS);
  const body = ruleBody(css, '.rga-scene-heading-v3');
  // Phase 2 (C5) established a 3px solid var(--accent-rwanga) bottom
  // border. Bundle 2 §A is type-step + space-only; the underline must
  // NOT regress.
  const borderMatch = body.match(/border-bottom\s*:\s*(\d+)px\s+solid\s+var\(--accent-rwanga/);
  assert.ok(borderMatch, 'Scene heading must keep the solid --accent-rwanga bottom border');
  const width = parseInt(borderMatch[1], 10);
  assert.ok(width >= 3,
    'Scene heading underline must remain ≥ 3px (Phase 2 C5 invariant). Got: ' + width + 'px');
});

test('Bundle 2 §A: NO new color, NO new background, NO new chrome element on the heading', () => {
  const css = read(EDITOR_CSS);
  const body = ruleBody(css, '.rga-scene-heading-v3');
  // Negative guard — the "no visual noise increase" rule forbids:
  //   - new background color (slug must not gain a tinted strip)
  //   - new outline / box-shadow (slug must not gain a chrome ring)
  //   - text-decoration (the underline already comes from border-bottom)
  assert.equal(/background\s*(?:-color)?\s*:/.test(body), false,
    'Bundle 2 §A forbids background on the scene heading (would add visual noise)');
  assert.equal(/box-shadow\s*:/.test(body), false,
    'Bundle 2 §A forbids box-shadow on the scene heading (would add visual noise)');
  // outline is allowed only as a focus ring on nested elements; on the
  // .rga-scene-heading-v3 root rule itself it must be absent.
  assert.equal(/^[^;]*outline\s*:/m.test(body), false,
    'Bundle 2 §A forbids outline on the root scene heading rule (would add visual noise)');
});

// ================================================================
// P1 regression guard — scene-number badge must never have a narrow
// width that forces "SCENE N" to wrap vertically.
//
// Regression introduced in f622cac4: `width: 1.5em` was intended to
// constrain only the hairline underline, but it constrained the badge
// element itself, forcing "SCENE 1" (~56px) into a ~19px column and
// wrapping into character pairs. Fix: width removed from the element;
// hairline moved to `.rga-scene-v3-num::after`.
// ================================================================

test('P1 no-wrap guard: .rga-scene-v3-num must NOT have a width declaration (no-wrap regression)', () => {
  const css = read(EDITOR_CSS);
  // Extract the .rga-scene-v3-num rule body (not ::after).
  // We need the rule for the element itself, not the pseudo-element.
  const m = css.match(/(?:^|\n)\s*\.rga-scene-v3-num\s*\{([^}]*)\}/);
  assert.ok(m, '.rga-scene-v3-num rule must exist in editor-prosemirror.css');
  // Strip CSS block comments before searching so that comment text
  // (e.g. an explanation mentioning "width: 1.5em") cannot trigger
  // a false positive.
  const body = m[1].replace(/\/\*[\s\S]*?\*\//g, '');
  // A width declaration on the badge element is the bug.  Any non-auto, non-100%
  // fixed width narrower than the text causes wrapping.  The rule must be absent.
  assert.equal(/\bwidth\s*:/.test(body), false,
    '.rga-scene-v3-num must NOT have a width declaration — it forces "SCENE N" to wrap (regression f622cac4)');
});

test('P1 hairline guard: .rga-scene-v3-num::after provides the hairline underline', () => {
  const css = read(EDITOR_CSS);
  // The hairline was moved from the element to the ::after pseudo-element.
  // Verify the ::after rule exists and carries a width + border-bottom.
  const m = css.match(/(?:^|\n)\s*\.rga-scene-v3-num::after\s*\{([^}]*)\}/);
  assert.ok(m, '.rga-scene-v3-num::after rule must exist (hairline moved to pseudo-element)');
  const body = m[1];
  assert.ok(/\bwidth\s*:\s*1\.5em/.test(body),
    '.rga-scene-v3-num::after must carry width: 1.5em for the short hairline');
  assert.ok(/\bborder-bottom\s*:/.test(body),
    '.rga-scene-v3-num::after must carry a border-bottom to produce the hairline');
});
