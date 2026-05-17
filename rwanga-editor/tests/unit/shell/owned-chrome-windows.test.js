// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Workstream A — owned title bar guards.
//
// G-OC-2: renderer declares exactly one owned title bar
//         (#rga-shell-titlebar) with -webkit-app-region: drag on
//         the title bar surface. App-identity, script-identity,
//         and actions zones are present.
//
// Stage gate: until A2 lands, the title bar exists (it has since
// Slice 1) but is a 28px strip without the 3-zone layout. The
// guard's "exists + drag declared" check passes today; the
// "3-zone layout" check activates when A2 lands.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const INDEX_HTML = path.join(REPO, 'renderer/index.html');
const SHELL_CSS  = path.join(REPO, 'renderer/css/shell.css');

function read(p) { return fs.readFileSync(p, 'utf8'); }

// Detect whether A2 has shipped its 3-zone layout. The marker is a
// dedicated app-identity element class. Until A2 lands, the strip
// just contains the existing title text + spacer + actions.
function isA2Landed(html) {
  return /class="[^"]*rga-shell-titlebar-app[^"]*"/.test(html) ||
         /id="rga-shell-titlebar-app/.test(html);
}

test('G-OC-2: exactly one owned title bar exists (#rga-shell-titlebar)', () => {
  const html = read(INDEX_HTML);
  const matches = html.match(/id="rga-shell-titlebar"/g) || [];
  assert.equal(matches.length, 1,
    'exactly one #rga-shell-titlebar element must exist (no second title bar)');
});

test('G-OC-2: title bar declares -webkit-app-region: drag in CSS (drag region present)', () => {
  const css = read(SHELL_CSS);
  // The .rga-shell-titlebar rule must declare drag region.
  const m = css.match(/\.rga-shell-titlebar\s*\{[^}]*-webkit-app-region\s*:\s*drag/);
  assert.ok(m,
    '.rga-shell-titlebar CSS rule must declare -webkit-app-region: drag (the title bar IS the drag surface)');
});

test('G-OC-2: title bar 3-zone layout exists (app | script | actions) — activates with A2', () => {
  const html = read(INDEX_HTML);
  if (!isA2Landed(html)) return;  // dormant until A2
  // App-identity zone (LEFT).
  assert.ok(/(?:class|id)=["'][^"']*rga-shell-titlebar-app[^"']*["']/.test(html),
    'title bar must include an app-identity zone (left)');
  // Script-identity zone — the existing #rga-shell-titlebar-title is the script-name surface; A2 preserves it.
  assert.ok(/id="rga-shell-titlebar-title"/.test(html),
    'title bar must include the script-identity zone (middle — existing #rga-shell-titlebar-title)');
  // Actions/spacer zone — existing flex spacer pushes actions right.
  assert.ok(/rga-shell-titlebar-spacer|rga-shell-titlebar-actions/.test(html),
    'title bar must include an actions/spacer zone (right)');
});
