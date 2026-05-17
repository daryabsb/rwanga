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

test('VS1 — index.html contains no #menu-bar element (legacy custom menu deleted)', () => {
  const html = readText(INDEX_HTML);
  assert.equal(
    /<(?:header|nav|div|aside|footer)[^>]*\sid="menu-bar"/.test(html),
    false,
    'Legacy #menu-bar must be deleted per T1 (native Electron menu is the source of truth).'
  );
});

test('VS2 — index.html contains no fake window controls and no #app-logo (deleted with #menu-bar)', () => {
  const html = readText(INDEX_HTML);
  ['win-minimize', 'win-maximize', 'win-close', 'app-logo'].forEach(function(id) {
    assert.equal(
      new RegExp('id="' + id + '"').test(html),
      false,
      '#' + id + ' must not exist in index.html — retired with the legacy custom menu bar (T1).'
    );
  });
});

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
// ----------------------------------------------------------------

test('VS8 — scene toolbox is no longer position: sticky (out of clipping flex flow)', () => {
  const css = readText(EDITOR_PM_CSS);
  const body = ruleBody(css, /#scene-toolbox\.scene-toolbox-vertical/);
  assert.ok(body, '#scene-toolbox.scene-toolbox-vertical rule must exist');
  assert.ok(
    /position\s*:\s*(absolute|fixed)/.test(body),
    'toolbox must use position: absolute (option A) or fixed — option B (sticky + padding-right) is also allowed; ' +
    'sticky alone clips the toolbox when sidebar+inspector squeeze the workspace. Got: ' + body.match(/position\s*:\s*\w+/)
  );
  // Either option must reserve right-side space on the editor container
  // OR position the toolbox out of flow. Asserting position is enough
  // for the option-A path that landed.
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

// ----------------------------------------------------------------
// T1 drift guard — main process must not own the menu
// ----------------------------------------------------------------

test('VS11 — main process does not call Menu.setApplicationMenu (native menu stays source of truth)', () => {
  // The 2026-05-17 T1 correction binds V1 to leave the native Electron
  // application menu untouched. Any future contributor who reintroduces
  // a renderer-owned menu would also be tempted to suppress the native
  // one via Menu.setApplicationMenu(null) — that's the drift this guard
  // exists to prevent.
  if (!fs.existsSync(MAIN_JS)) {
    // No main.js file at this exact path — search the typical alts.
    const alts = [
      path.join(REPO, 'main.js'),
      path.join(REPO, 'main', 'index.js'),
      path.join(REPO, 'src', 'main.js')
    ];
    let found = null;
    for (let i = 0; i < alts.length; i += 1) {
      if (fs.existsSync(alts[i])) { found = alts[i]; break; }
    }
    assert.ok(found, 'Cannot locate the Electron main process file to audit. Checked: ' + MAIN_JS + ', ' + alts.join(', '));
    const src = readText(found);
    assert.equal(
      /Menu\s*\.\s*setApplicationMenu/.test(src),
      false,
      'main process must not call Menu.setApplicationMenu — native menu is the source of truth (T1 / 2026-05-17 correction)'
    );
    return;
  }
  const src = readText(MAIN_JS);
  assert.equal(
    /Menu\s*\.\s*setApplicationMenu/.test(src),
    false,
    'main process must not call Menu.setApplicationMenu — native menu is the source of truth (T1 / 2026-05-17 correction)'
  );
});
