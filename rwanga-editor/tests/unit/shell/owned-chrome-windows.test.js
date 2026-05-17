// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Owned Chrome — G-OC-2: owned title bar (Row 1).
// PERMANENT (post-A6). Phase A1 SHIPPED 2026-05-17.
//
// G-OC-2: renderer declares exactly one owned title bar
//         (#rga-shell-titlebar) with -webkit-app-region: drag on
//         the title bar surface. Three zones present:
//           LEFT    #rga-shell-titlebar-app    — app identity
//           CENTER  #rga-shell-titlebar-title  — script identity
//           RIGHT   #rga-shell-titlebar-actions — actions zone
//
// A6 removed the transitional `isA2Landed` skip-gate. The 3-zone
// layout is locked in code at commit 59dc2a92.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const INDEX_HTML = path.join(REPO, 'renderer/index.html');
const SHELL_CSS  = path.join(REPO, 'renderer/css/shell.css');

function read(p) { return fs.readFileSync(p, 'utf8'); }

test('G-OC-2: exactly one owned title bar exists (#rga-shell-titlebar)', () => {
  const html = read(INDEX_HTML);
  const matches = html.match(/id="rga-shell-titlebar"/g) || [];
  assert.equal(matches.length, 1,
    'exactly one #rga-shell-titlebar element must exist (no second title bar)');
});

test('G-OC-2: title bar declares -webkit-app-region: drag in CSS (drag region present)', () => {
  const css = read(SHELL_CSS);
  const m = css.match(/\.rga-shell-titlebar\s*\{[^}]*-webkit-app-region\s*:\s*drag/);
  assert.ok(m,
    '.rga-shell-titlebar CSS rule must declare -webkit-app-region: drag (the title bar IS the drag surface)');
});

test('G-OC-2: title bar 3-zone layout exists (app | script | actions)', () => {
  const html = read(INDEX_HTML);
  // App-identity zone (LEFT).
  assert.ok(/(?:class|id)=["'][^"']*rga-shell-titlebar-app[^"']*["']/.test(html),
    'title bar must include an app-identity zone (left)');
  // Script-identity zone (CENTER).
  assert.ok(/id="rga-shell-titlebar-title"/.test(html),
    'title bar must include the script-identity zone (#rga-shell-titlebar-title)');
  // Actions zone (RIGHT).
  assert.ok(/rga-shell-titlebar-actions/.test(html),
    'title bar must include an actions zone (#rga-shell-titlebar-actions)');
});
