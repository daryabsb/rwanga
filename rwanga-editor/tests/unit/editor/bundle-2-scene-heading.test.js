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

test('Bundle 2 §A: scene heading margin-top bumped to ≥1.5em (stronger scene-boundary breathing room)', () => {
  const css = read(EDITOR_CSS);
  const body = ruleBody(css, '.rga-scene-heading-v3');
  const marginDecl = body.match(/margin\s*:\s*([^;]+);/);
  assert.ok(marginDecl, 'scene heading must declare margin shorthand');
  const tokens = marginDecl[1].trim().split(/\s+/);
  const topEm = parseLengthEm(tokens[0]);
  assert.ok(topEm != null && topEm >= 1.5,
    'Scene heading margin-top must be ≥ 1.5em (Bundle 2 §A negative-space hierarchy). Got: ' + tokens[0]);
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
