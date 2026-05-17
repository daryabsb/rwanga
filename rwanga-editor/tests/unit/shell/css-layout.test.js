// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Emergency runtime-repair guard: the #app grid template must have at
// least as many row tracks as #app has children, otherwise #workspace
// collapses into the wrong track and the editor becomes invisible.
//
// Slice 1 added #rga-shell-titlebar as a 4th child of #app but the
// grid template still listed 3 row tracks. The result was a blank
// editor area after Slice 2. This test prevents that regression.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const INDEX_HTML = path.join(REPO, 'renderer', 'index.html');
const SHELL_CSS  = path.join(REPO, 'renderer', 'css', 'shell.css');

function readText(file) { return fs.readFileSync(file, 'utf8'); }

function countAppChildren(html) {
  // Match the opening <div id="app"> through its matching closing </div>.
  // The HTML is hand-authored and stable; we count direct-child elements
  // by scanning for top-level open-tags at indent level 2 spaces.
  const start = html.indexOf('<div id="app">');
  assert.ok(start >= 0, '#app element exists in index.html');
  const after = html.slice(start);
  // Find children: any top-level tag whose opening sits at indent "  <"
  // and which has an id attribute we recognise as an #app direct child.
  // Studio Shell Recovery §A4 added `rga-shell-menubar` as the owned
  // menu surface (Row 2). §D1 added `rga-shell-toolbar` as the owned
  // writing-instruments surface (Row 3). The legacy `menu-bar` ID was
  // deleted in V1 but kept here as a tombstone — it never matches,
  // but documents the rename intent for future readers.
  const knownChildIds = ['rga-shell-titlebar', 'rga-shell-menubar', 'rga-shell-toolbar', 'menu-bar', 'workspace', 'status-bar'];
  let count = 0;
  knownChildIds.forEach(function(id) {
    const tagOpen = new RegExp('<(?:header|nav|div|aside|footer|main|section)[^>]*\\sid="' + id + '"', 'g');
    if (tagOpen.test(after)) count += 1;
  });
  return { count, knownChildIds };
}

function appGridTrackCount(css) {
  // Find the #app rule and extract its grid-template-rows declaration.
  const ruleMatch = css.match(/#app\s*\{[^}]*\}/);
  assert.ok(ruleMatch, '#app rule exists in shell.css');
  const rule = ruleMatch[0];
  const tplMatch = rule.match(/grid-template-rows\s*:\s*([^;]+);/);
  assert.ok(tplMatch, '#app declares grid-template-rows');
  const value = tplMatch[1].trim();
  // Tokens are space-separated; var(--x) and bare lengths/keywords each
  // count as one track. Use a naive split that respects var(...) groups.
  const tracks = [];
  let depth = 0, buf = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ' ' && depth === 0) {
      if (buf.trim()) tracks.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) tracks.push(buf.trim());
  return { tracks, value };
}

test('runtime-repair guard: #app grid-template-rows has >= one track per #app child', function() {
  const html = readText(INDEX_HTML);
  const css  = readText(SHELL_CSS);
  const kids = countAppChildren(html);
  const grid = appGridTrackCount(css);
  assert.ok(
    grid.tracks.length >= kids.count,
    '#app has ' + kids.count + ' children (' + kids.knownChildIds.join(', ') +
    ') but grid-template-rows defines only ' + grid.tracks.length +
    ' track(s): [' + grid.value + ']. Each child needs its own row track ' +
    'or the workspace collapses into the wrong track and the editor goes blank.'
  );
});

test('runtime-repair guard: the titlebar row is the FIRST track in #app (chrome ordering)', function() {
  const css  = readText(SHELL_CSS);
  const grid = appGridTrackCount(css);
  // The titlebar sits above the menu bar in the DOM; the first grid track
  // must therefore accommodate its height (either an explicit length, `auto`,
  // or a var). A `1fr` first track would consume all extra space and squash
  // the workspace.
  const first = grid.tracks[0];
  assert.notEqual(first, '1fr',
    'first row track of #app must not be 1fr — the titlebar would push the ' +
    'workspace off-screen. Use auto / a fixed length / a var, e.g. "auto".');
});
