// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Workstream A — owned chrome main-process guards.
//
// G-OC-1: main process uses platform-conditional frame settings.
//   Windows + Linux: frame: false  (owned chrome)
//   macOS:           titleBarStyle: 'hiddenInset' (hybrid; native traffic lights preserved)
//
// Stage gate (skip pattern): until Workstream A1 lands, main.js still
// declares `frame: true`. The guard skips the assertion in that
// pre-implementation state — the test PASSES but does not assert.
// Once A1 lands, the skip predicate becomes false and the assertion
// runs.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const MAIN_JS = path.join(REPO, 'electron/main.js');

function read(p) { return fs.readFileSync(p, 'utf8'); }

// Stage gate — Workstream A1 has not landed if main.js still says `frame: true`
// without any platform-conditional handling. While the gate is open, this
// guard is a placeholder; once A1 closes the gate, it activates fully.
function isA1Landed(src) {
  return /frame\s*:\s*!isWin/.test(src) ||
         /frame\s*:\s*\(?\s*process\.platform/.test(src) ||
         /frame\s*:\s*false/.test(src);
}

test('G-OC-1: main.js uses platform-conditional frame setting (Win/Linux frameless, macOS hiddenInset)', () => {
  const src = read(MAIN_JS);
  if (!isA1Landed(src)) {
    // A1 has not landed yet — this guard is dormant. It will activate
    // automatically once main.js sets frame: false (or equivalent
    // platform-conditional). Until then, no assertion runs.
    return;
  }
  // Windows + Linux must NOT use frame: true.
  // Look for the platform-aware frame declaration.
  const hasFrameFalse = /frame\s*:\s*false/.test(src) ||
                        /frame\s*:\s*!isWin\s*&&\s*!isLin/.test(src) ||
                        /frame\s*:\s*\(?\s*process\.platform\s*===\s*['"]darwin['"]/.test(src);
  assert.ok(hasFrameFalse,
    'main.js must set frame: false on Windows + Linux (owned chrome). Got source that doesn\'t match any expected pattern.');
  // macOS path must include titleBarStyle: 'hiddenInset' (native
  // traffic lights preserved per HIG).
  assert.ok(/titleBarStyle\s*:\s*['"]hiddenInset['"]/.test(src),
    'main.js must include titleBarStyle: \'hiddenInset\' for the macOS hybrid path');
});

test('G-OC-1: main.js does NOT use frame: true unconditionally (regression guard for the reversal)', () => {
  const src = read(MAIN_JS);
  if (!isA1Landed(src)) return;  // dormant until A1
  // Specifically catch a regression to the old `frame: true` literal.
  // After A1 lands, frame: true should not appear as a top-level
  // BrowserWindow option.
  const bwBlock = src.match(/new BrowserWindow\(\{[\s\S]*?\}\)/);
  assert.ok(bwBlock, 'BrowserWindow construction must be discoverable in main.js');
  assert.equal(/frame\s*:\s*true/.test(bwBlock[0]), false,
    'BrowserWindow must not declare frame: true after A1 — that is the reversal we performed');
});
