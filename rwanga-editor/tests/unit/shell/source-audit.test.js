// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 1 — shell-layer source-audit tests (plan §8.1).
//
// Greps the shell source tree for forbidden patterns. Each check is
// the regression guard for one architectural rule from the slice 1 plan.
//
//   (a) view.dispatch( calls outside the documented Scene-Navigator exception
//   (b) .classList.contains( reads as source of truth
//   (c) raw view.state.doc mutations
//   (d) banned writer-facing strings (Document/Node/Plugin/Render) per §1.4
//   (e) banned "file browser" / "file tree" / "file explorer" / "Files panel" per §3.7.3
//   (f) the literal "Scenes panel" phrase
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SHELL_ROOT = path.resolve(__dirname, '../../../renderer/js/shell');

function* walkJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walkJsFiles(p);
    } else if (e.isFile() && e.name.endsWith('.js')) {
      yield p;
    }
  }
}

function readShellFiles() {
  const out = [];
  for (const file of walkJsFiles(SHELL_ROOT)) {
    out.push({ file: file, code: fs.readFileSync(file, 'utf8') });
  }
  return out;
}

function stripComments(code) {
  // Strip line + block comments before grepping so doc-comments that
  // *mention* a banned pattern don't trigger false positives.
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(function(line) {
      const i = line.indexOf('//');
      return i >= 0 ? line.slice(0, i) : line;
    })
    .join('\n');
}

function stripStrings(code) {
  // Strip string literals (single, double, backtick) — used for code-only
  // checks that should ignore user-facing copy.
  return code
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '""');
}

// ----------------------------------------------------------------
// (a) view.dispatch( — allowed ONLY in scene-navigator.js (navigation-only)
// ----------------------------------------------------------------
test('audit (a): view.dispatch( call sites exist ONLY in panels/scene-navigator.js (the navigation-only exception)', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    const code = stripStrings(stripComments(f.code));
    if (/view\.dispatch\s*\(/.test(code)) {
      // Allowed only in the Scene Navigator (scrollToScene).
      // Use a separator-agnostic check for Windows + POSIX paths.
      const isSceneNav = /scene-navigator\.js$/.test(f.file) && /panels[\\/]/.test(f.file);
      if (!isSceneNav) violations.push(f.file);
    }
  });
  assert.deepEqual(violations, [], 'shell files calling view.dispatch outside the allowlist');
});

// ----------------------------------------------------------------
// (b) .classList.contains( reads as source of truth
// ----------------------------------------------------------------
// The shell may set/toggle classes (render-only) but must never read
// classList state as source of truth (state truth lives in Rga.Shell.Layout
// / Rga.ScriptSession / Rga.Shell.Sidebar — never in the DOM).
test('audit (b): no shell file reads .classList.contains( in an if-condition (source-of-truth check)', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    const code = stripStrings(stripComments(f.code));
    // Match: `if (... .classList.contains( ... ))` — a read used as a condition.
    if (/if\s*\([^)]*\.classList\.contains\s*\(/.test(code)) {
      violations.push(f.file);
    }
  });
  assert.deepEqual(violations, [], 'shell files reading classList.contains as source of truth');
});

// ----------------------------------------------------------------
// (c) raw view.state.doc mutations
// ----------------------------------------------------------------
// Acceptable reads: doc.descendants, doc.nodeAt, doc.resolve, doc.textBetween.
// Forbidden writes: doc.replace, doc.set..., doc.update..., doc.delete...
test('audit (c): no shell file mutates view.state.doc directly', () => {
  const files = readShellFiles();
  const violations = [];
  // Patterns of doc-mutation methods PM doesn't have read-only equivalents for.
  const mutationPatterns = [
    /\.state\.doc\.replaceWith\s*\(/,
    /\.state\.doc\.replace\s*\(/,
    /\.state\.doc\.delete\s*\(/,
    /\.state\.doc\.insert\s*\(/,
    /\.state\.doc\.setNodeMarkup\s*\(/,
    /\.state\.doc\.update\s*\(/
  ];
  files.forEach(function(f) {
    const code = stripStrings(stripComments(f.code));
    mutationPatterns.forEach(function(re) {
      if (re.test(code)) violations.push({ file: f.file, pattern: re.toString() });
    });
  });
  assert.deepEqual(violations, [], 'shell files mutating view.state.doc directly');
});

// ----------------------------------------------------------------
// (d) banned writer-facing strings (Document / Node / Plugin / Render)
// ----------------------------------------------------------------
// The plan §1.4 forbids these words in writer-facing copy. The grep targets
// string literals only (engine identifiers like Rga.RenderModel are
// stripped before the check). Allowlist: a comment that *defines* a banned
// term is fine because comments were stripped too.
test('audit (d): no shell string literal contains banned writer-facing word "Document"', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    const code = stripComments(f.code);
    // Find string literals and check.
    const matches = code.match(/'[^'\\]*'|"[^"\\]*"|`[^`\\]*`/g) || [];
    matches.forEach(function(lit) {
      if (/\bDocument\b/.test(lit)) violations.push({ file: f.file, str: lit });
    });
  });
  assert.deepEqual(violations, [], 'shell string literals containing "Document"');
});

test('audit (d): no shell string literal contains banned writer-facing word "Node"', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    const code = stripComments(f.code);
    const matches = code.match(/'[^'\\]*'|"[^"\\]*"|`[^`\\]*`/g) || [];
    matches.forEach(function(lit) {
      // Allow nodeId (camelCase identifier prefix), not the bare word.
      if (/\bNode\b/.test(lit)) violations.push({ file: f.file, str: lit });
    });
  });
  assert.deepEqual(violations, [], 'shell string literals containing "Node"');
});

test('audit (d): no shell string literal contains banned writer-facing word "Plugin"', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    const code = stripComments(f.code);
    const matches = code.match(/'[^'\\]*'|"[^"\\]*"|`[^`\\]*`/g) || [];
    matches.forEach(function(lit) {
      if (/\bPlugin\b/.test(lit)) violations.push({ file: f.file, str: lit });
    });
  });
  assert.deepEqual(violations, [], 'shell string literals containing "Plugin"');
});

// "Render" is allowed in engine-API identifiers like 'RenderModel' but not
// as a bare user-facing word. We grep for `\bRender\b` as a standalone word.
test('audit (d): no shell string literal uses bare "Render" as a writer-facing word', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    const code = stripComments(f.code);
    const matches = code.match(/'[^'\\]*'|"[^"\\]*"|`[^`\\]*`/g) || [];
    matches.forEach(function(lit) {
      // Match "Render" as a standalone word (not RenderModel / Renderer / etc).
      if (/\bRender\b(?!Model|er|ing)/.test(lit)) {
        violations.push({ file: f.file, str: lit });
      }
    });
  });
  assert.deepEqual(violations, [], 'shell string literals using bare "Render"');
});

// ----------------------------------------------------------------
// (e) banned Script-Workspace phrases (plan §3.7.3)
// ----------------------------------------------------------------
test('audit (e): no shell file uses the phrase "file browser"', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    if (/file browser/i.test(stripComments(f.code))) violations.push(f.file);
  });
  assert.deepEqual(violations, [], 'shell files containing "file browser"');
});

test('audit (e): no shell file uses the phrase "file tree"', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    if (/file tree/i.test(stripComments(f.code))) violations.push(f.file);
  });
  assert.deepEqual(violations, [], 'shell files containing "file tree"');
});

test('audit (e): no shell file uses the phrase "file explorer"', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    if (/file explorer/i.test(stripComments(f.code))) violations.push(f.file);
  });
  assert.deepEqual(violations, [], 'shell files containing "file explorer"');
});

test('audit (e): no shell file uses the phrase "Files panel"', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    if (/Files panel/i.test(stripComments(f.code))) violations.push(f.file);
  });
  assert.deepEqual(violations, [], 'shell files containing "Files panel"');
});

// ----------------------------------------------------------------
// (f) the literal "Scenes panel" phrase
// ----------------------------------------------------------------
// The canonical name is "Scene Navigator". The rail UI may label it
// "Scenes" alone, but the phrase "Scenes panel" is forbidden in shell
// source per plan §3.7.1.
test('audit (f): no shell file uses the literal phrase "Scenes panel"', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    if (/Scenes panel/i.test(stripComments(f.code))) violations.push(f.file);
  });
  assert.deepEqual(violations, [], 'shell files containing "Scenes panel"');
});

// ----------------------------------------------------------------
// Slice 2 audit additions (g/h/i/j/k/l/m) — plan §8.1
// ----------------------------------------------------------------

test('audit (g): no shell file references legacy Rga.StatusBar (entry #1 resolution guard)', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    const code = stripStrings(stripComments(f.code));
    if (/\bRga\.StatusBar\b/.test(code)) violations.push(f.file);
  });
  assert.deepEqual(violations, [], 'shell files referencing legacy Rga.StatusBar');
});

test('audit (h): no shell file references legacy Rga.Sidebar (entry #2 partial — shim retained outside shell)', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    const code = stripStrings(stripComments(f.code));
    // Match `Rga.Sidebar.` (legacy module dot-access) — does NOT match `Rga.Shell.Sidebar` because of the `Shell.` boundary.
    if (/\bRga\.Sidebar\./.test(code)) violations.push(f.file);
  });
  assert.deepEqual(violations, [], 'shell files referencing legacy Rga.Sidebar (legitimately retained in app-shell.js shim)');
});

test('audit (i): no shell file uses #sidebar-header selectors (entry #3 resolution guard)', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    const code = stripComments(f.code);
    if (/#sidebar-header/.test(code)) violations.push(f.file);
  });
  assert.deepEqual(violations, [], 'shell files referencing #sidebar-header selectors');
});

test('audit (j): no shell file uses the banned writer-facing string "Total scenes:"', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    if (/Total scenes:/i.test(stripComments(f.code))) violations.push(f.file);
  });
  assert.deepEqual(violations, [], 'shell files using "Total scenes:"');
});

test('audit (k): no shell file uses position-totals format "Scene N of M" in string literals (use position-first "Scene: SN" instead)', () => {
  const files = readShellFiles();
  const violations = [];
  files.forEach(function(f) {
    const code = stripComments(f.code);
    const literals = code.match(/'[^'\\]*'|"[^"\\]*"|`[^`\\]*`/g) || [];
    literals.forEach(function(lit) {
      if (/Scene\s+\d+\s+of\s+\d+/i.test(lit)) violations.push({ file: f.file, str: lit });
    });
  });
  assert.deepEqual(violations, [], 'shell string literals using "Scene N of M" format');
});

test('audit (l): no shell file emits a percent sign "%" in the Outline / Story Progress code path (no-fake-progress rule)', () => {
  const fs = require('fs');
  const path = require('path');
  // Limit grep to the Outline panel file — Story Progress lives there.
  const outlinePath = path.resolve(__dirname, '../../../renderer/js/shell/panels/outline.js');
  if (!fs.existsSync(outlinePath)) return;
  const code = stripStrings(stripComments(fs.readFileSync(outlinePath, 'utf8')));
  assert.equal(/%/.test(code), false, 'Outline / Story Progress code path emits a "%" — violates no-fake-progress rule');
  // Also check string literals don't contain a "%" outside CSS units (none in shell yet).
  const literals = stripComments(fs.readFileSync(outlinePath, 'utf8')).match(/'[^'\\]*'|"[^"\\]*"|`[^`\\]*`/g) || [];
  literals.forEach(function(lit) {
    assert.equal(/%/.test(lit), false, 'Outline string literal contains "%": ' + lit);
  });
});

test('audit (m): no shell file emits qualitative-judgment words ("brisk", "tight", "loose", "strong", "weak", "pacing", "looking") in Outline code path (no-AI-judgment rule)', () => {
  const fs = require('fs');
  const path = require('path');
  const outlinePath = path.resolve(__dirname, '../../../renderer/js/shell/panels/outline.js');
  if (!fs.existsSync(outlinePath)) return;
  // Only scan string literals (comments may discuss the banned words as documentation).
  const literals = stripComments(fs.readFileSync(outlinePath, 'utf8')).match(/'[^'\\]*'|"[^"\\]*"|`[^`\\]*`/g) || [];
  const BANNED = /\b(brisk|tight|loose|strong|weak|pacing|looking)\b/i;
  const violations = [];
  literals.forEach(function(lit) {
    if (BANNED.test(lit)) violations.push(lit);
  });
  assert.deepEqual(violations, [], 'Outline string literals containing qualitative-judgment words');
});
