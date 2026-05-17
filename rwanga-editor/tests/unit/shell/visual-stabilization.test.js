// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Visual Stabilization V1 guard tests.
//
// These are structural / token / CSS-rule-presence assertions, not
// visual regression snapshots. They prevent quiet drift away from the
// six P1 fixes shipped in commits 1–6 (chrome stack, status bar,
// scene navigator, scene toolbox, inspector, bottom panel).
//
// The eleventh guard (VS11) protects the 2026-05-17 T1 correction —
// native Electron menu stays as the source of truth; no future
// contributor may quietly re-introduce Menu.setApplicationMenu in
// the main process.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const INDEX_HTML       = path.join(REPO, 'renderer', 'index.html');
const SHELL_CSS        = path.join(REPO, 'renderer', 'css', 'shell.css');
const COMPONENTS_CSS   = path.join(REPO, 'renderer', 'css', 'components.css');
const TOKENS_CSS       = path.join(REPO, 'renderer', 'css', 'tokens.css');
const EDITOR_PM_CSS    = path.join(REPO, 'renderer', 'css', 'editor-prosemirror.css');
const MAIN_JS          = path.join(REPO, 'electron', 'main.js');

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

// Extract a rule's body for a given selector. Naive — assumes the
// selector appears once at the start of a rule and the rule's body
// runs to the next closing brace. Sufficient for these targeted
// guards.
function ruleBody(css, selectorRegex) {
  const m = css.match(new RegExp(selectorRegex.source + '\\s*\\{([^}]*)\\}', selectorRegex.flags));
  return m ? m[1] : null;
}

// ----------------------------------------------------------------
// T1 — Chrome stack guards
// ----------------------------------------------------------------

// VS1 RETIRED — Studio Shell Recovery §A6 (2026-05-17).
// Pre-A6 contract: "index.html contains no #menu-bar element (legacy
// custom menu deleted)". The V1/T1 native-first decision that
// motivated VS1 was authorized for reversal in the Studio Shell
// Recovery mission; Workstream A4 introduced an owned in-window menu
// surface on a NEW element id (#rga-shell-menubar), which respects
// VS1's letter trivially. The constructive G-OC-4 guard
// (tests/unit/shell/owned-chrome-menu-ownership.test.js) replaces
// VS1 with an active assertion: #rga-shell-menubar must exist with
// exactly 8 entries (File · Edit · View · Script · Tags · Tools ·
// Export · Help) and every entry must be a button with data-menu.
//
// VS2 RETIRED — Studio Shell Recovery §A6 (2026-05-17).
// Pre-A6 contract: "no fake window controls and no #app-logo". The
// "fake" qualifier was the entire point — pre-§A6 window controls
// would have been visual stand-ins for missing IPC. A3 wired real
// window controls (#rga-shell-window-{min,max,close}) to the
// pre-existing window.rwanga.window.* IPC bridge. G-OC-3
// (tests/unit/shell/owned-chrome-window-controls.test.js) replaces
// VS2 with: the three controls exist, each routes to real IPC, each
// carries aria-label, each declares -webkit-app-region: no-drag,
// close has the --danger variant for hover affordance.
//
// VS11 RETIRED — Studio Shell Recovery §A6 (2026-05-17).
// Pre-A6 contract: "main process does not call Menu.setApplicationMenu".
// Workstream A4 introduced platform-conditional menu suppression:
// Menu.setApplicationMenu(null) on Windows/Linux (suppress native),
// Menu.setApplicationMenu(builtMenu) on macOS (HIG-required global
// menu). G-OC-5 (tests/unit/shell/owned-chrome-menu-ownership.test.js)
// replaces VS11 with the new contract: the platform branch is
// explicit and grep-able; both branches are required.
//
// VS3–VS10 remain active — they protect concerns unrelated to chrome
// ownership (status bar background, tokens, scene-navigator grid,
// scene-toolbox sticky avoidance, bp-tab indicator, inspector header
// casing) and continue to pass without modification.

test('VS3 — exactly one Rwanga-owned identity surface (#rga-shell-titlebar-title) in index.html', () => {
  const html = readText(INDEX_HTML);
  const matches = html.match(/id="[^"]*titlebar-title[^"]*"/g) || [];
  assert.equal(
    matches.length, 1,
    'Slice 1 titlebar must be the only Rwanga-owned identity surface; ' +
    'found ' + matches.length + ' element(s) matching titlebar-title.'
  );
});

// ----------------------------------------------------------------
// T2 — Status bar guards
// ----------------------------------------------------------------

test('VS4 — #status-bar background is NOT var(--accent-primary) (root cause guard)', () => {
  const css = readText(SHELL_CSS);
  const body = ruleBody(css, /#status-bar/);
  assert.ok(body, '#status-bar rule must exist');
  const bgLine = body.match(/background\s*:\s*([^;]+);/);
  assert.ok(bgLine, '#status-bar must declare a background');
  assert.equal(
    /var\(\s*--accent-primary\b/.test(bgLine[1]),
    false,
    '#status-bar must not use --accent-primary as a surface fill; got: ' + bgLine[1].trim()
  );
});

test('VS5 — tokens.css defines --statusbar-bg in BOTH dark and light theme blocks', () => {
  const css = readText(TOKENS_CSS);
  const darkBlockMatch = css.match(/\[data-theme="dark"\]\s*,?\s*\{[\s\S]*?\n\}/);
  const darkBlock      = darkBlockMatch ? darkBlockMatch[0] : '';
  // The dark block is `:root, [data-theme="dark"] { ... }` — try that too.
  const rootBlockMatch = css.match(/:root\s*,\s*\[data-theme="dark"\][\s\S]*?\n\}/);
  const darkSrc        = rootBlockMatch ? rootBlockMatch[0] : darkBlock;
  const lightBlockMatch = css.match(/\[data-theme="light"\]\s*\{[\s\S]*?\n\}/);
  const lightSrc       = lightBlockMatch ? lightBlockMatch[0] : '';
  assert.ok(darkSrc, 'dark-theme block must exist in tokens.css');
  assert.ok(lightSrc, 'light-theme block must exist in tokens.css');
  assert.ok(
    /--statusbar-bg\s*:/.test(darkSrc),
    '--statusbar-bg must be defined in the dark-theme tokens block (T2)'
  );
  assert.ok(
    /--statusbar-bg\s*:/.test(lightSrc),
    '--statusbar-bg must be defined in the light-theme tokens block (T2)'
  );
});

// ----------------------------------------------------------------
// T3 — Scene Navigator guards
// ----------------------------------------------------------------

test('VS6 — shell.css defines .rga-shell-scene-navigator-row with display: grid', () => {
  const css = readText(SHELL_CSS);
  const body = ruleBody(css, /\.rga-shell-scene-navigator-row(?![-\w])/);
  assert.ok(body, '.rga-shell-scene-navigator-row rule must exist (T3)');
  assert.ok(
    /display\s*:\s*grid/.test(body),
    '.rga-shell-scene-navigator-row must use display: grid for the [num] [heading] [page] column layout (T3)'
  );
});

test('VS7 — current and selected row states render distinctly (separation invariant)', () => {
  const css = readText(SHELL_CSS);
  const currentBody  = ruleBody(css, /\.rga-shell-scene-navigator-row-current/);
  const selectedBody = ruleBody(css, /\.rga-shell-scene-navigator-row-selected(?![\w-])/);
  assert.ok(currentBody, '.rga-shell-scene-navigator-row-current rule must exist (T3)');
  assert.ok(selectedBody, '.rga-shell-scene-navigator-row-selected rule must exist (T3)');
  // They must declare different background-or-border treatments —
  // otherwise the cursor-mark and the keyboard-mark visually collapse.
  const norm = function(s) {
    return s.replace(/\s+/g, ' ').trim();
  };
  assert.notEqual(
    norm(currentBody), norm(selectedBody),
    'current and selected row rules must declare different visual treatments — ' +
    'the SEPARATION INVARIANT requires them never to collapse into one mark (T3)'
  );
});

// ----------------------------------------------------------------
// T4 — Scene toolbox guards
// RETIRED §A Shell Final Polish: #scene-toolbox surface was retired
// (controls migrated to Row 3). VS8 (sticky avoidance) is moot —
// no surface to anchor. Negative guard kept: nothing must
// reintroduce a sticky toolbox rule.
// ----------------------------------------------------------------

test('VS8 (retired) — no #scene-toolbox rule must reappear in editor CSS', () => {
  const css = readText(EDITOR_PM_CSS);
  assert.equal(/#scene-toolbox\.scene-toolbox-vertical\s*\{/.test(css), false,
    '#scene-toolbox.scene-toolbox-vertical rule must NOT be reintroduced — Scene Toolbox was retired in §A Shell Final Polish.');
});

// ----------------------------------------------------------------
// T6 — Bottom panel guards
// ----------------------------------------------------------------

test('VS9 — .bp-tab.active indicator is NOT var(--accent-primary) (twinning broken)', () => {
  const css = readText(COMPONENTS_CSS);
  const body = ruleBody(css, /\.bp-tab\.active/);
  assert.ok(body, '.bp-tab.active rule must exist');
  const indicatorDecl = body.match(/border-bottom(?:-color)?\s*:\s*[^;]+;/g) || [];
  assert.ok(indicatorDecl.length > 0, '.bp-tab.active must declare a border-bottom indicator');
  indicatorDecl.forEach(function(d) {
    assert.equal(
      /var\(\s*--accent-primary\b/.test(d),
      false,
      '.bp-tab.active must not use --accent-primary for its indicator (twinning with old status bar). Got: ' + d
    );
  });
});

// ----------------------------------------------------------------
// T5 — Inspector guards
// ----------------------------------------------------------------

test('VS10 — Inspector header is title-case and no stylesheet applies text-transform: uppercase to .inspector-header', () => {
  const html = readText(INDEX_HTML);
  const components = readText(COMPONENTS_CSS);
  const shell = readText(SHELL_CSS);
  // HTML body says "Inspector" (title case).
  const headerMatch = html.match(/<div class="inspector-header">([^<]+)<\/div>/);
  assert.ok(headerMatch, '<div class="inspector-header"> must be present in index.html');
  assert.equal(
    headerMatch[1].trim(), 'Inspector',
    '.inspector-header text must be "Inspector" (title case), not "INSPECTOR". Got: "' + headerMatch[1] + '"'
  );
  // No stylesheet declares text-transform: uppercase on .inspector-header.
  [components, shell].forEach(function(css) {
    const body = ruleBody(css, /\.inspector-header(?![\w-])/);
    if (body == null) return;  // rule may live in only one file
    assert.equal(
      /text-transform\s*:\s*uppercase/.test(body),
      false,
      '.inspector-header must not declare text-transform: uppercase (T5)'
    );
  });
});

// VS11 retired in §A6 — see the retirement notes at the top of the
// VS3 block above. G-OC-5 carries the new contract.
