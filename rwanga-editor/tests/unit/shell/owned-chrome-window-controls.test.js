// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Workstream A — owned window controls guards.
//
// G-OC-3: renderer declares three window-control buttons
//         (#rga-shell-window-min, #rga-shell-window-max,
//          #rga-shell-window-close). Each:
//   • routes to window.rwanga.window.{minimize,maximize,close}
//     (existing IPC bridge in electron/preload.js)
//   • carries aria-label
//   • declares -webkit-app-region: no-drag in CSS
//   • close button has a --danger variant class for hover affordance
//
// Stage gate: until A3 lands, the buttons do not exist. The guard
// skips until the close button id appears in index.html.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const INDEX_HTML = path.join(REPO, 'renderer/index.html');
const SHELL_CSS  = path.join(REPO, 'renderer/css/shell.css');
const PRELOAD_JS = path.join(REPO, 'electron/preload.js');

function read(p) { return fs.readFileSync(p, 'utf8'); }

function isA3Landed(html) {
  return /id="rga-shell-window-close"/.test(html);
}

test('G-OC-3: window-control buttons exist (min / max / close)', () => {
  const html = read(INDEX_HTML);
  if (!isA3Landed(html)) return;  // dormant until A3
  ['rga-shell-window-min', 'rga-shell-window-max', 'rga-shell-window-close'].forEach(function(id) {
    assert.ok(html.indexOf('id="' + id + '"') >= 0,
      'window control button #' + id + ' must exist');
  });
});

test('G-OC-3: each window-control button carries aria-label (accessibility non-negotiable)', () => {
  const html = read(INDEX_HTML);
  if (!isA3Landed(html)) return;
  ['rga-shell-window-min', 'rga-shell-window-max', 'rga-shell-window-close'].forEach(function(id) {
    // Find the button tag and verify aria-label.
    const re = new RegExp('<button[^>]*id="' + id + '"[^>]*aria-label\\s*=', 'i');
    assert.ok(re.test(html),
      '#' + id + ' must declare aria-label (screen reader contract)');
  });
});

test('G-OC-3: window-control buttons declare -webkit-app-region: no-drag in CSS', () => {
  const html = read(INDEX_HTML);
  if (!isA3Landed(html)) return;
  const css = read(SHELL_CSS);
  // Either a .rga-shell-window-control class rule or per-id rules
  // must declare no-drag. The shared class is the cleaner pattern.
  const classRule = /\.rga-shell-window-control\s*\{[^}]*-webkit-app-region\s*:\s*no-drag/;
  const perIdRule = /#rga-shell-window-(min|max|close)[^{]*\{[^}]*-webkit-app-region\s*:\s*no-drag/;
  assert.ok(classRule.test(css) || perIdRule.test(css),
    'window-control buttons must declare -webkit-app-region: no-drag (drag-island invariant)');
});

test('G-OC-3: close button has the --danger variant class for hover affordance', () => {
  const html = read(INDEX_HTML);
  if (!isA3Landed(html)) return;
  // The close button must carry the --danger modifier so hover
  // styling can distinguish it (industry pattern — close hover is
  // typically red).
  const re = /<button[^>]*id="rga-shell-window-close"[^>]*class="[^"]*rga-shell-window-control--danger/;
  assert.ok(re.test(html),
    'close button must carry .rga-shell-window-control--danger for the distinct hover treatment');
});

test('G-OC-3: window-control click handlers route through window.rwanga.window.* IPC (no DOM-only behaviour)', () => {
  const html = read(INDEX_HTML);
  if (!isA3Landed(html)) return;
  // The buttons must wire to the existing preload IPC bridge — not
  // perform direct DOM mutations. Look for the IPC call references
  // in the renderer source (index.html boot script OR title-bar.js).
  const titleBarSrc = (function() {
    const p = path.join(REPO, 'renderer/js/shell/title-bar.js');
    return fs.existsSync(p) ? read(p) : '';
  })();
  const combined = html + '\n' + titleBarSrc;
  assert.ok(/window\.rwanga\.window\.minimize/.test(combined),
    'minimize button must call window.rwanga.window.minimize() (existing IPC bridge)');
  assert.ok(/window\.rwanga\.window\.maximize/.test(combined),
    'maximize button must call window.rwanga.window.maximize() (existing IPC bridge)');
  assert.ok(/window\.rwanga\.window\.close/.test(combined),
    'close button must call window.rwanga.window.close() (existing IPC bridge)');
});

test('G-OC-3: preload exposes the IPC bridge the buttons depend on (existing — sanity check)', () => {
  const src = read(PRELOAD_JS);
  // This passes today (the bridge has existed since Slice 4) — the
  // assertion exists as a regression guard so the bridge can't be
  // accidentally removed in some future cleanup.
  assert.ok(/minimize:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(\s*['"]window\.minimize['"]/.test(src),
    'preload must expose window.rwanga.window.minimize');
  assert.ok(/maximize:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(\s*['"]window\.maximize['"]/.test(src),
    'preload must expose window.rwanga.window.maximize');
  assert.ok(/close:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(\s*['"]window\.close['"]/.test(src),
    'preload must expose window.rwanga.window.close');
});
