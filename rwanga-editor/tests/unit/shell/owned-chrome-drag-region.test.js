// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Owned Chrome — G-OC-6 + G-OC-7 + G-OC-8: drag-region, double-click,
// and accessibility invariants.
// PERMANENT (post-A6). Phase A1 SHIPPED 2026-05-17.
//
// G-OC-6: every interactive element inside the title bar declares
//         -webkit-app-region: no-drag (drag-island invariant).
//         No no-drag declarations outside the title bar (catches
//         stray copy-paste).
//
// G-OC-7: double-click handler on the title bar drag region calls
//         window.rwanga.window.maximize() (existence assertion).
//
// G-OC-8: accessibility — every chrome control has aria-label or
//         visible text; tab order through menu items is sequential.
//
// A6 removed the transitional skip-gates (isA3OrLaterLanded,
// isA5Landed). All three guards now assert unconditionally.
// Behavior is locked in code at commits d28c6b51 (A3), e19ef643 (A4),
// 2ef40715 (A5).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const INDEX_HTML = path.join(REPO, 'renderer/index.html');
const SHELL_CSS  = path.join(REPO, 'renderer/css/shell.css');
const TITLE_BAR_JS = path.join(REPO, 'renderer/js/shell/title-bar.js');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function readIf(p) { return fs.existsSync(p) ? read(p) : ''; }

// ----------------------------------------------------------------
// G-OC-6 — drag-island invariant
// ----------------------------------------------------------------

test('G-OC-6: every interactive title-bar element declares -webkit-app-region: no-drag', () => {
  const html = read(INDEX_HTML);
  const css = read(SHELL_CSS);
  // Three classes of interactive elements inside the title bar must
  // each have no-drag declared somewhere reachable by CSS specificity:
  //   .rga-shell-titlebar-action (theme toggle — already present)
  //   .rga-shell-titlebar-avatar-placeholder (avatar — already present)
  //   .rga-shell-window-control  (new in A3 — must declare)
  const required = [
    /\.rga-shell-titlebar-action\b[^{]*\{[^}]*-webkit-app-region\s*:\s*no-drag/,
    /\.rga-shell-titlebar-avatar-placeholder\b[^{]*\{[^}]*-webkit-app-region\s*:\s*no-drag/,
    /\.rga-shell-window-control\b[^{]*\{[^}]*-webkit-app-region\s*:\s*no-drag/
  ];
  required.forEach(function(re) {
    assert.ok(re.test(css),
      'CSS must declare -webkit-app-region: no-drag for ' + re.source);
  });
});

test('G-OC-6: -webkit-app-region: no-drag declarations are scoped to title-bar / chrome elements only', () => {
  const css = read(SHELL_CSS);
  // Pull every rule that mentions -webkit-app-region: no-drag and
  // verify the selector mentions a chrome element. A no-drag rule
  // on something OUTSIDE the title bar is almost certainly a
  // mistake (it would silently disable drag behaviour for that
  // element's parent if it were in a draggable region, but more
  // importantly indicates conceptual drift).
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = stripped.split(/\}/);
  const offenders = [];
  rules.forEach(function(rule) {
    if (!/-webkit-app-region\s*:\s*no-drag/.test(rule)) return;
    // Extract the selector (everything up to the first {).
    const m = rule.match(/^([^{]+)\{/);
    if (!m) return;
    const selector = m[1].trim();
    // Allowed surfaces: titlebar/* family, window-control, menubar (A4+).
    if (!/rga-shell-titlebar|rga-shell-window-control|rga-shell-menubar/.test(selector)) {
      offenders.push(selector);
    }
  });
  assert.deepEqual(offenders, [],
    'no-drag declarations must be scoped to chrome elements only. Offenders: ' + offenders.join(' / '));
});

// ----------------------------------------------------------------
// G-OC-7 — double-click maximize handler
// ----------------------------------------------------------------

test('G-OC-7: double-click on title-bar drag region calls window.rwanga.window.maximize()', () => {
  const html = read(INDEX_HTML);
  const titleBarSrc = readIf(TITLE_BAR_JS);
  // After A5: somewhere (title-bar.js or boot-script) a dblclick
  // listener on the title bar calls window.rwanga.window.maximize.
  const combined = html + '\n' + titleBarSrc;
  assert.ok(/addEventListener\s*\(\s*['"]dblclick['"]/.test(combined),
    'a dblclick listener must be registered for the title bar (A5)');
  assert.ok(/window\.rwanga\.window\.maximize/.test(combined),
    'the dblclick handler must call window.rwanga.window.maximize() — the IPC bridge already exists');
});

// ----------------------------------------------------------------
// G-OC-8 — accessibility invariants
// ----------------------------------------------------------------

test('G-OC-8: every .rga-shell-window-control has either visible text content or aria-label', () => {
  const html = read(INDEX_HTML);
  // Find every window-control button and verify each has aria-label OR non-empty text.
  const re = /<button[^>]*class="[^"]*rga-shell-window-control[^"]*"[^>]*>([\s\S]*?)<\/button>/g;
  let m;
  let count = 0;
  while ((m = re.exec(html)) !== null) {
    count += 1;
    const buttonTag = m[0];
    const content = (m[1] || '').replace(/<[^>]+>/g, '').trim();
    const hasAria = /aria-label\s*=\s*["'][^"']+["']/.test(buttonTag);
    assert.ok(hasAria || content.length > 0,
      'window-control button #' + count + ' must have aria-label OR visible text content. Tag: ' + buttonTag);
  }
  assert.ok(count >= 3,
    'expected at least 3 window-control buttons (min/max/close); found ' + count);
});

test('G-OC-8: every menubar item is keyboard-focusable (default <button> tab order is correct)', () => {
  const html = read(INDEX_HTML);
  // Every menubar item is a <button> per G-OC-4. <button> elements
  // are tab-focusable by default — no tabindex needed. But if any
  // item declares tabindex="-1" (which would skip it), that's a
  // regression. Explicitly catch.
  const re = /<button[^>]*data-menu="[^"]+"[^>]*>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const tabIndexMatch = tag.match(/tabindex\s*=\s*["']?(-?\d+)["']?/);
    if (tabIndexMatch) {
      const v = parseInt(tabIndexMatch[1], 10);
      assert.ok(v >= 0,
        'menubar item must NOT declare tabindex < 0 (would skip the item from keyboard navigation). Tag: ' + tag);
    }
  }
});
