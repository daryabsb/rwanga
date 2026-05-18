// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Studio Panel — Minimize Contract Fix invariants.
//
// Three behavioural gaps closed:
//   1. Minimized grid row must allocate enough height for the tab
//      strip's full rendered box (tabs 32px + their 1px border-
//      bottom + the panel's 1px border-top, all inside box-sizing:
//      border-box). The earlier 32px literal under-allocated by
//      2px which clipped the strip into the chrome edge and made
//      the buttons look hidden.
//   2. Both #bottom-panel and #bottom-panel-tabs must keep a
//      non-hidden display while minimized — defensive `display:
//      flex` declarations so no future stylesheet can collapse
//      them while the panel is in minimized state.
//   3. The minimize button needs a real icon (not the literal "_"
//      text glyph) so users can see and trust the minimize
//      affordance next to the close icon.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const SHELL_CSS  = path.join(REPO, 'renderer/css/shell.css');
const INDEX_HTML = path.join(REPO, 'renderer/index.html');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function ruleBody(css, selector) {
  const re = new RegExp(selector.source + '\\s*\\{([^}]*)\\}');
  const m = css.match(re);
  return m ? m[1] : null;
}

// ----------------------------------------------------------------
// Contract Fix §1 — minimized grid row has breathing room
// ----------------------------------------------------------------

test('Minimize Contract v2: bottom-minimized grid row ≥ 40px (ample headroom for tab strip rendering)', () => {
  const css = read(SHELL_CSS);
  const bareRule = css.match(/#center-column\.bottom-minimized\s*\{([^}]*)\}/);
  assert.ok(bareRule, '#center-column.bottom-minimized rule must exist');
  const body = bareRule[1];
  const rowsDecl = body.match(/grid-template-rows\s*:\s*([^;]+);/);
  assert.ok(rowsDecl, 'bottom-minimized must declare grid-template-rows');
  // Third track is the panel; parse the literal pixel value.
  const tracks = rowsDecl[1].trim().split(/\s+/);
  assert.equal(tracks.length, 3,
    'bottom-minimized must declare exactly three grid tracks (1fr 0 Npx)');
  const panelTrack = tracks[2];
  const panelPx = panelTrack.match(/^(\d+)px$/);
  assert.ok(panelPx, 'third track must be a literal px value');
  assert.ok(parseInt(panelPx[1], 10) >= 40,
    'panel grid row must be ≥ 40px (v2) — ample headroom so column-flex pressure inside #bottom-panel can never shrink the tab strip to invisibility. Got: ' + panelTrack);
});

test('Minimize Contract v2: #bottom-panel-tabs has explicit min-height + flex basis (cannot be shrunk by parent flex)', () => {
  const css = read(SHELL_CSS);
  // The tabs rule under .bottom-minimized must declare min-height
  // and a flex basis ≥ 32px so column-flex on #bottom-panel never
  // shrinks the strip below its natural rendered height.
  const tabsRules = css.match(/#center-column\.bottom-minimized\s+#bottom-panel-tabs[^{]*\{[^}]*\}/g) || [];
  assert.ok(tabsRules.length >= 1, 'at least one minimized #bottom-panel-tabs rule must exist');
  const allDecls = tabsRules.join(' ');
  assert.ok(/min-height\s*:\s*\d+px/.test(allDecls),
    'minimized #bottom-panel-tabs must declare min-height so parent flex cannot shrink it');
  assert.ok(/flex\s*:\s*0\s+0\s+\d+px/.test(allDecls),
    'minimized #bottom-panel-tabs must declare flex: 0 0 Npx (basis ≥ 32px) so the strip holds its size');
});

test('Minimize Contract v2: #bottom-panel pins min-height to the row size (column flex can\'t squeeze children)', () => {
  const css = read(SHELL_CSS);
  const panelRule = css.match(/#center-column\.bottom-minimized\s+#bottom-panel\s*\{([^}]*)\}/);
  assert.ok(panelRule, 'minimized #bottom-panel rule must exist');
  assert.ok(/min-height\s*:\s*\d+px/.test(panelRule[1]),
    'minimized #bottom-panel must declare min-height so column flex has guaranteed space for the tab strip');
});

// ----------------------------------------------------------------
// Contract Fix §2 — defensive display rules for the minimized shell
// ----------------------------------------------------------------

test('Minimize Contract: #bottom-panel + #bottom-panel-tabs both declare display: flex when minimized (defensive)', () => {
  const css = read(SHELL_CSS);
  // After v2 the two surfaces have separate rule bodies (each
  // carries its own min-height / flex-basis tuning). Each must
  // still declare display: flex so neither can be collapsed by a
  // future stylesheet while the panel is minimized.
  const panelRule = css.match(/#center-column\.bottom-minimized\s+#bottom-panel\s*\{([^}]*)\}/);
  assert.ok(panelRule, 'minimized #bottom-panel rule must exist');
  assert.ok(/display\s*:\s*flex/.test(panelRule[1]),
    '#bottom-panel must declare display: flex while minimized');
  const tabsRules = css.match(/#center-column\.bottom-minimized\s+#bottom-panel-tabs[^{]*\{[^}]*\}/g) || [];
  assert.ok(tabsRules.length >= 1, 'minimized #bottom-panel-tabs rule must exist');
  const allTabsDecls = tabsRules.join(' ');
  assert.ok(/display\s*:\s*flex/.test(allTabsDecls),
    '#bottom-panel-tabs must declare display: flex while minimized');
});

test('Minimize Contract: minimized tab strip carries cursor: pointer (one-click restore affordance)', () => {
  const css = read(SHELL_CSS);
  // The tab strip is targeted by TWO rules under .bottom-minimized:
  // the combined display:flex rule and the cursor: pointer rule.
  // We assert cursor: pointer appears in at least one of them.
  const all = css.match(/#center-column\.bottom-minimized\s+#bottom-panel-tabs[^{]*\{[^}]*\}/g) || [];
  assert.ok(all.length >= 1, 'at least one #center-column.bottom-minimized #bottom-panel-tabs rule must exist');
  const hasCursor = all.some(function(rule) { return /cursor\s*:\s*pointer/.test(rule); });
  assert.ok(hasCursor,
    'minimized #bottom-panel-tabs must declare cursor: pointer in one of its rules — the whole strip is the restore click target');
});

// ----------------------------------------------------------------
// Contract Fix §3 — minimize button has a real icon
// ----------------------------------------------------------------

test('Minimize Contract: index.html boot script injects Rga.Icons.minimize into #btn-minimize-bottom-panel', () => {
  const html = read(INDEX_HTML);
  // Look for the boot-script line that assigns innerHTML = Rga.Icons.minimize
  // on the minimize button.
  assert.ok(/btn-minimize-bottom-panel[\s\S]{0,400}innerHTML\s*=\s*Rga\.Icons\.minimize/.test(html),
    'index.html boot script must inject Rga.Icons.minimize into #btn-minimize-bottom-panel — visual parity with the close button which already gets its SVG injected');
});

// ----------------------------------------------------------------
// Contract Fix — invariants the JS layer still owns (regression
// guards: nothing here must regress the existing three-state
// model from Studio Shell Recovery §E)
// ----------------------------------------------------------------

test('Minimize Contract: closed state still fully hides the panel (bottom-collapsed rules intact)', () => {
  const css = read(SHELL_CSS);
  const bareRule = css.match(/#center-column\.bottom-collapsed\s*\{([^}]*)\}/);
  assert.ok(bareRule, '#center-column.bottom-collapsed rule must still exist');
  const body = bareRule[1];
  assert.ok(/grid-template-rows\s*:\s*1fr\s+0px\s+0px/.test(body),
    'bottom-collapsed must still allocate zero height to the panel — close still fully hides');
  // The display: none rule for the panel + resize handle when closed.
  const closedHideRule = css.match(/#center-column\.bottom-collapsed\s+#bottom-panel\s*,[\s\S]{0,200}\{\s*display\s*:\s*none/);
  assert.ok(closedHideRule,
    'closed state must still declare display: none on #bottom-panel + the resize handle');
});

test('Minimize Contract: minimized state does NOT add bottom-collapsed semantics (no display:none on the panel)', () => {
  const css = read(SHELL_CSS);
  // Negative guard — there must be no rule that hides #bottom-panel
  // while .bottom-minimized is set. (The body content is hidden by a
  // separate, correct rule on #bottom-panel-content.)
  const evilRe = /#center-column\.bottom-minimized\s+#bottom-panel\s*\{[^}]*display\s*:\s*none/;
  assert.equal(evilRe.test(css), false,
    'no rule may apply display: none to #bottom-panel while minimized — that would collapse the tab strip');
  const evilTabsRe = /#center-column\.bottom-minimized\s+#bottom-panel-tabs\s*\{[^}]*display\s*:\s*none/;
  assert.equal(evilTabsRe.test(css), false,
    'no rule may apply display: none to #bottom-panel-tabs while minimized — tab strip is the restore affordance');
});
