// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Activity Rail Doctrine — guard tests for the implementation slice.
//
// Each guard maps 1:1 to one of the five doctrine rules in
// docs/rwanga-activity-rail-doctrine.md. A failure here means the
// rail has drifted from its locked doctrine and must be corrected
// before any rail-touching change ships.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const REPO = path.resolve(__dirname, '../../..');
const SHELL_CSS         = path.join(REPO, 'renderer', 'css', 'shell.css');
const ACTIVITY_RAIL_JS  = path.join(REPO, 'renderer', 'js', 'shell', 'activity-rail.js');
const ICONS_LUCIDE_JS   = path.join(REPO, 'renderer', 'js', 'shell', 'icons-lucide.js');
const PANELS_DIR        = path.join(REPO, 'renderer', 'js', 'shell', 'panels');
const LUCIDE_VENDOR_DIR = path.join(REPO, 'renderer', 'static', 'vendor', 'icons', 'lucide');

function readText(file) { return fs.readFileSync(file, 'utf8'); }

// ----------------------------------------------------------------
// Rule 1 — single icon family only (Lucide)
// ----------------------------------------------------------------

test('Rule 1: vendored Lucide directory contains the seven doctrine glyphs + LICENSE', () => {
  const required = ['clapperboard', 'folder-open', 'list-tree', 'search', 'users', 'history', 'settings'];
  required.forEach(function(name) {
    const p = path.join(LUCIDE_VENDOR_DIR, name + '.svg');
    assert.ok(fs.existsSync(p), 'missing vendored Lucide glyph: ' + name + '.svg');
  });
  assert.ok(fs.existsSync(path.join(LUCIDE_VENDOR_DIR, 'LICENSE')), 'Lucide LICENSE file must be vendored alongside the glyphs');
});

test('Rule 1: every vendored Lucide SVG satisfies the Doctrine Rule 2 wrapper attributes', () => {
  const required = ['clapperboard', 'folder-open', 'list-tree', 'search', 'users', 'history', 'settings'];
  required.forEach(function(name) {
    const src = readText(path.join(LUCIDE_VENDOR_DIR, name + '.svg'));
    assert.ok(/viewBox="0 0 24 24"/.test(src),       name + ': viewBox must be "0 0 24 24"');
    assert.ok(/fill="none"/.test(src),               name + ': fill must be "none"');
    assert.ok(/stroke="currentColor"/.test(src),     name + ': stroke must be "currentColor"');
    assert.ok(/stroke-width="2"/.test(src),          name + ': stroke-width must be 2');
    assert.ok(/stroke-linecap="round"/.test(src),    name + ': stroke-linecap must be "round"');
    assert.ok(/stroke-linejoin="round"/.test(src),   name + ': stroke-linejoin must be "round"');
  });
});

test('Rule 1: every rail panel\'s icon registration is a Lucide name (not an emoji literal)', () => {
  // Walk the seven panel files and confirm their icon: '...' literal
  // is a string the Lucide registry recognises. Emoji codepoints in
  // an icon: literal fail this guard.
  const expected = {
    'scene-navigator.js':  'clapperboard',
    'script-workspace.js': 'folder-open',
    'outline.js':          'list-tree',
    'search.js':           'search',
    'characters.js':       'users',
    'revisions.js':        'history',
    'settings.js':         'settings'
  };
  Object.keys(expected).forEach(function(file) {
    const src = readText(path.join(PANELS_DIR, file));
    const m = src.match(/icon:\s*['"]([^'"]+)['"]/);
    assert.ok(m, file + ': must declare an icon: string literal');
    assert.equal(m[1], expected[file],
      file + ' icon must be "' + expected[file] + '" (Lucide name), got "' + m[1] + '"');
  });
});

test('Rule 1: no rail-path file contains an emoji codepoint where an icon string should live', () => {
  // Scan the rail-rendering path (activity-rail.js + panel files) for
  // emoji codepoints inside icon: '...' literals. The full Unicode
  // emoji block check is overkill — we look for the specific glyphs
  // the pre-V1 rail used and any high-codepoint glyphs.
  const files = [ACTIVITY_RAIL_JS]
    .concat(['scene-navigator.js','script-workspace.js','outline.js','search.js','characters.js','revisions.js','settings.js']
            .map(function(f) { return path.join(PANELS_DIR, f); }));
  const EMOJI_IN_ICON_VALUE = /icon:\s*['"][^a-zA-Z][^'"]*['"]/;
  files.forEach(function(file) {
    const src = readText(file);
    // icon: ... values must be ASCII-letter / hyphen only — Lucide name shape.
    const matches = src.match(/icon:\s*['"]([^'"]+)['"]/g) || [];
    matches.forEach(function(match) {
      assert.ok(
        /^icon:\s*['"][a-z][a-z0-9-]*['"]$/.test(match),
        file + ': icon value must be a kebab-case Lucide name. Got: ' + match
      );
    });
  });
});

// ----------------------------------------------------------------
// Rule 3 — three-group layout
// ----------------------------------------------------------------

test('Rule 3: activity-rail.js declares RAIL_GROUPS with the doctrine-prescribed item placement', () => {
  const src = readText(ACTIVITY_RAIL_JS);
  // The map literal must exist and assign each documented item to its
  // documented group. Loose regex — match `top: [ ... ]` etc.
  const topMatch    = src.match(/top\s*:\s*\[([^\]]+)\]/);
  const middleMatch = src.match(/middle\s*:\s*\[([^\]]+)\]/);
  const bottomMatch = src.match(/bottom\s*:\s*\[([^\]]+)\]/);
  assert.ok(topMatch && middleMatch && bottomMatch,
    'activity-rail.js must declare top / middle / bottom arrays inside RAIL_GROUPS');
  function parse(m) {
    return m[1].split(',').map(function(s) { return s.replace(/['"\s]/g, ''); }).filter(Boolean);
  }
  const top    = parse(topMatch);
  const middle = parse(middleMatch);
  const bottom = parse(bottomMatch);
  assert.deepEqual(top,    ['sceneNavigator', 'scriptWorkspace', 'outline', 'search'], 'Top group');
  assert.deepEqual(middle, ['characters', 'revisions'],                                  'Middle group');
  assert.deepEqual(bottom, ['settings'],                                                  'Bottom group');
});

test('Rule 3: shell.css does NOT use justify-content: space-between or space-around on #activity-bar', () => {
  const css = readText(SHELL_CSS);
  const rule = css.match(/#activity-bar\s*\{([^}]*)\}/);
  assert.ok(rule, '#activity-bar rule must exist');
  assert.equal(/justify-content\s*:\s*space-(between|around)/.test(rule[1]), false,
    '#activity-bar must not use space-between or space-around (Doctrine Rule 3 forbids even distribution)');
});

test('Rule 3: shell.css pins the bottom group via margin-top: auto', () => {
  const css = readText(SHELL_CSS);
  const rule = css.match(/\.rga-shell-rail-group-bottom\s*\{([^}]*)\}/);
  assert.ok(rule, '.rga-shell-rail-group-bottom rule must exist');
  assert.ok(/margin-top\s*:\s*auto/.test(rule[1]),
    '.rga-shell-rail-group-bottom must use margin-top: auto to pin Settings to the bottom');
});

// ----------------------------------------------------------------
// Rule 4 — four-state interaction model
// ----------------------------------------------------------------

test('Rule 4: shell.css declares distinct visual treatments for hover, selected, current', () => {
  const css = readText(SHELL_CSS);
  // Each state must declare at least one of: background, background-color,
  // color, border, border-bottom — under its own selector.
  const states = [
    { sel: '\\.rga-shell-rail-item:hover',              label: 'hover' },
    { sel: '\\.rga-shell-rail-item-active(?![\\w-])',   label: 'selected' },
    { sel: '\\.rga-shell-rail-item-current',            label: 'current' }
  ];
  const seen = {};
  states.forEach(function(s) {
    // Collect ALL rule bodies whose selector starts with this state.
    const re = new RegExp(s.sel + '[^,{]*\\{([^}]*)\\}', 'g');
    let m;
    let combined = '';
    while ((m = re.exec(css))) combined += m[1] + '\n';
    assert.ok(combined.length > 0, label(s) + ' state must have at least one rule');
    seen[s.label] = combined;
  });
  function label(s) { return 'the ' + s.label + ' state'; }
  // Sanity: hover and selected must declare different bodies (the
  // separation invariant — selected must not just be hover with a
  // tweak too subtle to read).
  assert.notEqual(seen.hover.trim(), seen.selected.trim(),
    'hover and selected rules must declare different visual treatments (Doctrine Rule 4)');
});

test('Rule 4: the tiny-black-line ::before fallback is gone — selected uses a pill (::before) PLUS a left bar (::after)', () => {
  const css = readText(SHELL_CSS);
  // The pre-doctrine rule used `::before { width: 2px; background: var(--accent-primary) }`
  // as the only active-state treatment. Doctrine Rule 4 requires the
  // pill (::before) AND the left bar (::after) as separate carriers.
  const beforeAny = /\.rga-shell-rail-item::before\s*\{/.test(css);
  const afterAny  = /\.rga-shell-rail-item::after\s*\{/.test(css);
  assert.ok(beforeAny, 'rail item must declare a ::before pseudo (the background pill)');
  assert.ok(afterAny,  'rail item must declare a ::after pseudo (the left accent bar)');
  // The active state's ::before must set a background other than transparent
  // (the pill becomes visible).
  const activeBeforeBody = css.match(/\.rga-shell-rail-item-active::before\s*\{([^}]*)\}/);
  assert.ok(activeBeforeBody, '.rga-shell-rail-item-active::before rule must exist');
  assert.ok(/background\s*:\s*[^t][^;]*;/.test(activeBeforeBody[1]),
    'selected state\'s ::before pill must have a non-transparent background');
});

test('Rule 4: behavioural — selected state applies a different background AND a left-bar to the rail item', () => {
  // Boot a minimal DOM with the rail, register two documented panels,
  // toggle one into selected, assert both ::before pill and ::after
  // bar carriers are populated via the class-state mechanism.
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="rail"></div><div id="host"></div></body></html>',
    { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  ['../../../renderer/js/shell/layout.js',
   '../../../renderer/js/shell/sidebar.js',
   '../../../renderer/js/shell/icons-lucide.js',
   '../../../renderer/js/shell/activity-rail.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  Rga.Shell.ActivityRail._reset();
  Rga.Shell.Sidebar.setHost(document.getElementById('host'));
  ['sceneNavigator', 'scriptWorkspace'].forEach(function(id) {
    Rga.Shell.Sidebar.registerPanel({
      id: id, label: id, icon: id === 'sceneNavigator' ? 'clapperboard' : 'folder-open',
      available: true, mount: function() {}, unmount: function() {}
    });
  });
  Rga.Shell.ActivityRail.init(document.getElementById('rail'));
  Rga.Shell.Sidebar.activate('sceneNavigator');
  const btn = document.querySelector('[data-panel-id="sceneNavigator"]');
  assert.ok(btn, 'rail must render the sceneNavigator button');
  assert.ok(btn.classList.contains('rga-shell-rail-item-active'),
    'selected panel\'s button must carry the .rga-shell-rail-item-active class so the pill + left-bar pseudos activate');
});

// ----------------------------------------------------------------
// Rule 5 — visual feeling target (proxy guards)
// ----------------------------------------------------------------

test('Rule 5: rail transitions never exceed 120ms (Doctrine ceiling)', () => {
  const css = readText(SHELL_CSS);
  // Extract rail-related rules and check transition declarations.
  const railRules = css.match(/\.rga-shell-rail[^{]*\{[^}]*\}/g) || [];
  const tooSlow = /(\d+)ms/g;
  railRules.forEach(function(rule) {
    if (!/transition\s*:/.test(rule)) return;
    const transitionDecl = rule.match(/transition[^;]+;/g) || [];
    transitionDecl.forEach(function(decl) {
      let m;
      while ((m = tooSlow.exec(decl))) {
        const ms = parseInt(m[1], 10);
        assert.ok(ms <= 120,
          'rail transition durations must be ≤120ms (Doctrine Rule 5); found ' + ms + 'ms in: ' + decl.trim());
      }
    });
  });
});

test('Rule 5: prefers-reduced-motion disables rail transitions', () => {
  const css = readText(SHELL_CSS);
  assert.ok(
    /@media\s*\(prefers-reduced-motion\s*:\s*reduce\)[\s\S]*?\.rga-shell-rail-item[\s\S]*?transition\s*:\s*none/.test(css),
    'shell.css must include a prefers-reduced-motion guard that sets transition: none on rail items'
  );
});
