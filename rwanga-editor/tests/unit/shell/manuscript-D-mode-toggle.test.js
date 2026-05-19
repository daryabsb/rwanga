// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Manuscript Visual Maturity Bundle — §D guard tests
//
// Invariants:
//   1. No element with data-toolbar-mode="text" exists in index.html.
//   2. The Screenplay mode button (data-toolbar-mode="screenplay") still exists.
//   3. The eight text-tool command registrations in format-toolbar.js are
//      unchanged (text.bold, text.italic, text.underline, text.strikethrough,
//      text.color, text.highlight, text.link, text.clear).
//   4. The format-toolbar.js TOOLBAR_MODES array no longer includes 'text',
//      which means a persisted 'text' mode falls back to 'screenplay' on init.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const INDEX_HTML      = path.join(REPO, 'renderer/index.html');
const FORMAT_TOOLBAR  = path.join(REPO, 'renderer/js/format-toolbar.js');

function read(p) { return fs.readFileSync(p, 'utf8'); }

const TEXT_COMMANDS = [
  'text.bold', 'text.italic', 'text.underline', 'text.strikethrough',
  'text.color', 'text.highlight', 'text.link', 'text.clear'
];

// ----------------------------------------------------------------
// 1. Text mode button is not in the toolbar
// ----------------------------------------------------------------

test('§D bundle: no data-toolbar-mode="text" button exists in index.html', () => {
  const html = read(INDEX_HTML);
  assert.equal(
    /data-toolbar-mode="text"/.test(html),
    false,
    'index.html must NOT contain a button with data-toolbar-mode="text" — Text mode button was removed'
  );
});

test('§D bundle: no element with title containing "Text mode" exists in index.html', () => {
  const html = read(INDEX_HTML);
  assert.equal(
    /title="Text mode[^"]*"/.test(html),
    false,
    'index.html must NOT contain any element titled "Text mode ..." — the button is removed'
  );
});

// ----------------------------------------------------------------
// 2. Screenplay mode button still exists
// ----------------------------------------------------------------

test('§D bundle: Screenplay mode button (data-toolbar-mode="screenplay") is present in index.html', () => {
  const html = read(INDEX_HTML);
  assert.ok(
    /data-toolbar-mode="screenplay"/.test(html),
    'index.html must still contain the Screenplay mode button — Screenplay is the only visible mode'
  );
});

// ----------------------------------------------------------------
// 3. Text-tool command registrations are unchanged
// ----------------------------------------------------------------

test('§D bundle: all 8 text-tool commands are still registered in format-toolbar.js', () => {
  const src = read(FORMAT_TOOLBAR);
  TEXT_COMMANDS.forEach(function(cmd) {
    const re = new RegExp("registerCommand\\(\\{[^}]*command:\\s*['\"]" + cmd.replace('.', '\\.') + "['\"]");
    assert.ok(re.test(src),
      'format-toolbar.js must still call registerCommand({ command: "' + cmd + '", ... }) — command was not removed'
    );
  });
});

// ----------------------------------------------------------------
// 4. TOOLBAR_MODES no longer includes 'text' — persisted 'text' falls back
// ----------------------------------------------------------------

test('§D bundle: TOOLBAR_MODES in format-toolbar.js does not include "text"', () => {
  const src = read(FORMAT_TOOLBAR);
  // Match the TOOLBAR_MODES array literal declaration.
  const match = src.match(/const\s+TOOLBAR_MODES\s*=\s*\[([^\]]*)\]/);
  assert.ok(match, 'format-toolbar.js must declare TOOLBAR_MODES array');
  const contents = match[1];
  assert.equal(
    /'text'|"text"/.test(contents),
    false,
    'TOOLBAR_MODES must NOT include "text" — persisted text mode should coerce to screenplay'
  );
});

test('§D bundle: TOOLBAR_MODES in format-toolbar.js still includes "screenplay"', () => {
  const src = read(FORMAT_TOOLBAR);
  const match = src.match(/const\s+TOOLBAR_MODES\s*=\s*\[([^\]]*)\]/);
  assert.ok(match, 'format-toolbar.js must declare TOOLBAR_MODES array');
  const contents = match[1];
  assert.ok(
    /'screenplay'|"screenplay"/.test(contents),
    'TOOLBAR_MODES must still include "screenplay"'
  );
});

// ----------------------------------------------------------------
// 5. No new command added, no scene/writing commands removed
// ----------------------------------------------------------------

test('§D bundle: scene.insert command is still registered in format-toolbar.js', () => {
  const src = read(FORMAT_TOOLBAR);
  assert.ok(
    /command:\s*['"]scene\.insert['"]/.test(src),
    'format-toolbar.js must still register scene.insert command'
  );
});

test('§D bundle: writing.note and writing.flag commands are still registered', () => {
  const src = read(FORMAT_TOOLBAR);
  assert.ok(/command:\s*['"]writing\.note['"]/.test(src), 'writing.note must still be registered');
  assert.ok(/command:\s*['"]writing\.flag['"]/.test(src), 'writing.flag must still be registered');
});
