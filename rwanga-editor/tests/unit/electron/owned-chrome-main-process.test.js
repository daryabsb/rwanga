// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Owned Chrome — G-OC-1: main-process frame ownership.
// PERMANENT (post-A6). Phase A1 SHIPPED 2026-05-17.
//
// G-OC-1: main process uses platform-conditional frame settings.
//   Windows + Linux: frame: false  (owned chrome)
//   macOS:           titleBarStyle: 'hiddenInset' (hybrid; native traffic lights preserved)
//
// A6 removed the transitional `isA1Landed` skip-gate — the guard
// now asserts unconditionally because A1 is locked in code at
// commit 4bf4d9b0. Any future revert that re-introduces frame:true
// fails this guard at CI.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const MAIN_JS = path.join(REPO, 'electron/main.js');

function read(p) { return fs.readFileSync(p, 'utf8'); }

test('G-OC-1: main.js uses platform-conditional frame setting (Win/Linux frameless, macOS hiddenInset)', () => {
  const src = read(MAIN_JS);
  // Windows + Linux must use frame: false. Two valid construction
  // styles are accepted: inline `new BrowserWindow({ frame: false, … })`
  // or build-and-pass `const opts = {…}; opts.frame = false`.
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

test('G-OC-1: main.js does NOT declare frame: true (regression guard for the §A reversal)', () => {
  const src = read(MAIN_JS);
  // Strip comments first — frame: true inside an explanatory comment
  // is allowed (the comment may legitimately discuss the old setting).
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.equal(/frame\s*:\s*true/.test(stripped), false,
    'main.js must not declare frame: true — that is the V1/T1 native-first state §A reversed at commit 4bf4d9b0');
});
