// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Bundle 1 §C — Scene Toolbox anchor correction (CSS-only).
//
// Locks the new "anchored to the page edge with a narrow-width
// fallback to the original gutter position" geometry, and asserts
// the V1 §T4 / V1.1 fix 5 invariants are still in place (toolbox
// lives in #editor-area, not in #editor-container; hidden in Draft;
// hidden in Print Preview via #workspace).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const EDITOR_CSS = path.join(REPO, 'renderer/css/editor-prosemirror.css');
const INDEX_HTML = path.join(REPO, 'renderer/index.html');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function ruleBody(css, selectorLiteral) {
  const escaped = selectorLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp('(?:^|\\n)\\s*' + escaped + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}

// ----------------------------------------------------------------
// §C.1 — New anchor geometry
// ----------------------------------------------------------------

test('Bundle 1 §C: #scene-toolbox right uses max() clamp against calc(50% - 4.25in - 118px)', () => {
  const css = read(EDITOR_CSS);
  const body = ruleBody(css, '#scene-toolbox.scene-toolbox-vertical');
  assert.ok(body, 'toolbox rule must exist');
  // The new anchor is a max() of "16px" (fallback) and "calc(50% - 4.25in - 118px)" (page-edge).
  // 16px = original V1 §T4 position; calc() = new page-edge position at wide widths.
  assert.ok(/right\s*:\s*max\s*\(\s*16px\s*,\s*calc\(\s*50%\s*-\s*4\.25in\s*-\s*118px\s*\)\s*\)/.test(body),
    'toolbox right must be `max(16px, calc(50% - 4.25in - 118px))` — page-edge anchor with narrow-width fallback. Got: ' + (body.match(/right\s*:[^;]+/) || ['<none>'])[0]);
});

test('Bundle 1 §C: RTL mirror also uses the max() clamp on left', () => {
  const css = read(EDITOR_CSS);
  const body = ruleBody(css, '[dir="rtl"] #scene-toolbox.scene-toolbox-vertical');
  assert.ok(body, 'RTL toolbox rule must exist');
  assert.ok(/left\s*:\s*max\s*\(\s*16px\s*,\s*calc\(\s*50%\s*-\s*4\.25in\s*-\s*118px\s*\)\s*\)/.test(body),
    'RTL toolbox left must use the mirrored max(16px, calc(...)) clamp');
});

// ----------------------------------------------------------------
// §C.2 — V1 §T4 / V1.1 fix 5 invariants preserved
// ----------------------------------------------------------------

test('Bundle 1 §C: toolbox still uses position: absolute (V1 §T4 layout invariant)', () => {
  const css = read(EDITOR_CSS);
  const body = ruleBody(css, '#scene-toolbox.scene-toolbox-vertical');
  assert.ok(/position\s*:\s*absolute/.test(body),
    'toolbox must remain position: absolute — Bundle 1 §C is CSS-only re-anchoring, not a container restructure');
});

test('Bundle 1 §C: #scene-toolbox is a sibling of #editor-container, not a child (V1.1 fix 5 — scroll-safe)', () => {
  const html = read(INDEX_HTML);
  // Locate #editor-container's opening tag and find its matching
  // </div> by counting nested <div> tags. #scene-toolbox must NOT
  // appear inside that range. (V1.1 fix 5: toolbox lives in
  // #editor-area, NOT inside the scrolling #editor-container — else
  // scrolling the page scrolls the toolbox out of view.)
  const containerOpen = html.search(/<div\s+id="editor-container"/);
  assert.ok(containerOpen > 0, '#editor-container must exist');
  // Walk from the opening tag, counting div nesting until we hit the
  // matching close.
  let depth = 0;
  let i = containerOpen;
  let containerClose = -1;
  const openRe = /<div\b/g;
  const closeRe = /<\/div>/g;
  // Crude tag walker — fine for a small HTML file.
  while (i < html.length) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const openMatch = openRe.exec(html);
    const closeMatch = closeRe.exec(html);
    if (!closeMatch) break;
    if (openMatch && openMatch.index < closeMatch.index) {
      depth += 1;
      i = openMatch.index + 1;
    } else {
      depth -= 1;
      i = closeMatch.index + 1;
      if (depth === 0) { containerClose = closeMatch.index; break; }
    }
  }
  assert.ok(containerClose > containerOpen, 'must find matching </div> for #editor-container');
  const containerHtml = html.slice(containerOpen, containerClose);
  assert.equal(containerHtml.indexOf('id="scene-toolbox"'), -1,
    '#scene-toolbox must NOT be nested inside #editor-container (V1.1 fix 5 — scroll-safety invariant)');
});

test('Bundle 1 §C: Draft view still hides the toolbox (existing hide rule preserved)', () => {
  const css = read(EDITOR_CSS);
  // The hide rule lives in a grouped selector — easiest to assert by
  // pattern.
  assert.ok(/body\.view-draft-active\s+#scene-toolbox\s*\{[^}]*display\s*:\s*none/.test(css) ||
            /body\.view-draft-active[^\{]*#scene-toolbox[^\{]*\{[^}]*display\s*:\s*none/.test(css),
    'Draft view must still hide #scene-toolbox (existing rule preserved)');
});

test('Bundle 1 §C: Print Preview hides the toolbox indirectly via #workspace display: none', () => {
  const css = read(EDITOR_CSS);
  // In Print Preview, the entire #workspace is display:none, which
  // contains editor-area which contains the toolbox. Verify the
  // workspace hide rule is still in place.
  const body = ruleBody(css, 'body.view-print-preview-active #workspace');
  assert.ok(body, 'Print Preview must still hide #workspace');
  assert.ok(/display\s*:\s*none/.test(body),
    'Print Preview #workspace hide rule must be display: none (toolbox hides indirectly)');
});

// ----------------------------------------------------------------
// §C.3 — Negative guards (no container restructure, no JS measurement)
// ----------------------------------------------------------------

test('Bundle 1 §C: no JS anchoring code added (CSS-only — Approach (a) per the plan)', () => {
  // The plan considered three approaches: (a) CSS-only, (b) container
  // restructure, (c) JS-anchored. The user chose (a). This guard
  // catches accidental drift into (c) by ensuring no JS measurement
  // pipeline references the toolbox for positioning.
  const jsDir = path.join(REPO, 'renderer/js');
  function walk(dir, files) {
    fs.readdirSync(dir).forEach(function(f) {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full, files);
      else if (f.endsWith('.js')) files.push(full);
    });
    return files;
  }
  const jsFiles = walk(jsDir, []);
  const offenders = [];
  jsFiles.forEach(function(file) {
    const src = read(file);
    // Look for measurement APIs scoped to #scene-toolbox. If anything
    // computes the toolbox's geometry, it's positioning logic that
    // belongs in CSS for this bundle.
    if (/#scene-toolbox[\s\S]{0,200}getBoundingClientRect|scene-toolbox[\s\S]{0,200}\.style\.(right|left|top|transform)\s*=/.test(src)) {
      offenders.push(path.relative(REPO, file));
    }
  });
  assert.deepEqual(offenders, [],
    'No JS may measure or position #scene-toolbox (Bundle 1 §C is CSS-only). Offenders: ' + offenders.join(', '));
});

test('Bundle 1 §C: HTML still declares #scene-toolbox as the same <aside> element with the same disabled-class hook', () => {
  const html = read(INDEX_HTML);
  // <aside id="scene-toolbox" class="scene-toolbox-vertical disabled" ...>
  // Disabled class is the engine-side wiring's anchor (v3 plugins flip
  // it). This bundle must NOT change that contract.
  assert.ok(/<aside\s+id="scene-toolbox"\s+class="scene-toolbox-vertical disabled"/.test(html),
    '<aside id="scene-toolbox" class="scene-toolbox-vertical disabled"> must remain intact — engine-side disabled-class wiring depends on it');
});
