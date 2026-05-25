// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Editor Recovery Phase 3 — guards for FlowChrome visibility (C4)
// and Draft mode minimal context footer (C6).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const EDITOR_CSS = path.join(REPO, 'renderer/css/editor-prosemirror.css');
const INDEX_HTML = path.join(REPO, 'renderer/index.html');
const FLOW_CHROME_JS = path.join(REPO, 'renderer/js/flow-chrome.js');

function readText(file) { return fs.readFileSync(file, 'utf8'); }

function ruleBody(css, selectorLiteral) {
  const escaped = selectorLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Anchor at line-start (or file-start) so that `.flow-line-gutter`
  // matches the base rule, not the `#editor-container.view-flow .flow-line-gutter`
  // override that happens to end with the same selector text.
  const m = css.match(new RegExp('(?:^|\\n)\\s*' + escaped + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}

// ----------------------------------------------------------------
// §A — C4: FlowChrome implementation + DOM target + CSS visibility
// ----------------------------------------------------------------

test('Phase 3 / C4: Rga.FlowChrome module exists and is NOT stubbed', () => {
  const src = readText(FLOW_CHROME_JS);
  // Implementation hallmarks — confirm the real module is there.
  assert.ok(/function\s+rebuildLineNumbers\b/.test(src),
    'FlowChrome must define rebuildLineNumbers() — the line-numbering engine');
  assert.ok(/MutationObserver/.test(src),
    'FlowChrome must use a MutationObserver — the recompute trigger');
  assert.ok(/getClientRects\s*\(/.test(src),
    'FlowChrome must use Range.getClientRects() — per-visual-line geometry');
  assert.ok(/Rga\.FlowChrome\s*=\s*\{[\s\S]*init/.test(src),
    'FlowChrome must export a public init function');
});

test('Phase 3 / C4: #flow-line-gutter DOM target exists in index.html', () => {
  const html = readText(INDEX_HTML);
  assert.ok(/id="flow-line-gutter"/.test(html),
    '#flow-line-gutter element must exist in index.html (FlowChrome mounts into it)');
  assert.ok(/<div\s+class="flow-line-gutter"[^>]*id="flow-line-gutter"/.test(html),
    '#flow-line-gutter must carry the .flow-line-gutter class (CSS selector)');
});

test('Phase 3 / C4: .flow-line-gutter is visible in Flow view (display: block override)', () => {
  const css = readText(EDITOR_CSS);
  const flowOverride = ruleBody(css, '#editor-container.view-flow .flow-line-gutter');
  assert.ok(flowOverride, 'Flow override rule for the gutter must exist');
  assert.ok(/display\s*:\s*block/.test(flowOverride),
    'Flow override must set display: block (un-hides the default display: none base rule)');
});

test('Phase 3 / C4: gutter visibility recovery — opacity raised so existing numbers are readable', () => {
  const css = readText(EDITOR_CSS);
  const baseRule = ruleBody(css, '.flow-line-gutter');
  assert.ok(baseRule);
  const opacityMatch = baseRule.match(/opacity\s*:\s*([\d.]+)/);
  assert.ok(opacityMatch, '.flow-line-gutter must declare opacity');
  const opacity = parseFloat(opacityMatch[1]);
  // Pre-Phase-3 opacity was 0.55 — invisible against editor bg.
  // Recovery target: >= 0.7 so numbers are readable but still subtle.
  assert.ok(opacity >= 0.7,
    '.flow-line-gutter opacity must be ≥ 0.7 (Phase 3 visibility recovery — was 0.55, invisible). Got: ' + opacity);
});

test('Phase 3 / C4: gutter recovery did NOT touch FlowChrome.js (no engine / no implementation rewrite)', () => {
  const src = readText(FLOW_CHROME_JS);
  // Sanity: rebuildLineNumbers's selector list is the same as before
  // (Phase 3 is CSS-only — no new line-number system; no selector
  // changes). We assert the v3 selectors are still queried.
  ['rga-scene-v3-num', 'rga-scene-heading-v3', 'rga-block-action',
   'rga-block-character', 'rga-block-dialogue'].forEach(function(cls) {
    assert.ok(src.indexOf(cls) >= 0,
      'FlowChrome must still target ' + cls + ' (Phase 3 must not modify selector list — no new line-number system)');
  });
});

// ----------------------------------------------------------------
// §B — C6: Draft mode minimal context footer
// ----------------------------------------------------------------

test('Phase 3 / C6: draft footer DOM element exists in index.html', () => {
  const html = readText(INDEX_HTML);
  assert.ok(/id="draft-mode-footer"/.test(html),
    '#draft-mode-footer element must exist in index.html');
  assert.ok(/class="rga-draft-footer"/.test(html),
    'draft footer must carry the .rga-draft-footer class');
  // Initially hidden — CSS reveals it only when body.view-draft-active.
  assert.ok(/<footer\s+id="draft-mode-footer"[^>]*hidden/.test(html),
    'draft footer must start hidden (CSS controls reveal via body.view-draft-active)');
});

test('Phase 3 / C6: draft footer contains all four required segments', () => {
  const html = readText(INDEX_HTML);
  // Per brief: Draft Mode label, page position, word count, Esc hint.
  ['rga-draft-footer-mode',
   'rga-draft-footer-page',
   'rga-draft-footer-words',
   'rga-draft-footer-hint'].forEach(function(cls) {
    assert.ok(html.indexOf(cls) >= 0,
      'draft footer must contain a .' + cls + ' segment');
  });
  // The hint text must mention Esc (acceptance criterion).
  assert.ok(/Esc to exit/.test(html),
    'draft footer hint segment must say "Esc to exit"');
});

test('Phase 3 / C6: CSS reveals the draft footer ONLY when body.view-draft-active', () => {
  const css = readText(EDITOR_CSS);
  // Base rule: display: none.
  const base = ruleBody(css, '.rga-draft-footer');
  assert.ok(base);
  assert.ok(/display\s*:\s*none/.test(base),
    '.rga-draft-footer must default to display: none');
  // Reveal rule: only via body.view-draft-active.
  const revealBody = ruleBody(css, 'body.view-draft-active .rga-draft-footer');
  assert.ok(revealBody,
    'CSS must include a body.view-draft-active .rga-draft-footer rule');
  assert.ok(/display\s*:\s*inline-flex|display\s*:\s*flex|display\s*:\s*block/.test(revealBody),
    'Draft-active reveal rule must set display to a visible value');
});

test('Phase 3 / C6: draft footer is non-interactive (pointer-events: none) so it never traps the writer', () => {
  const css = readText(EDITOR_CSS);
  const base = ruleBody(css, '.rga-draft-footer');
  assert.ok(/pointer-events\s*:\s*none/.test(base),
    'draft footer must be pointer-events: none — it\'s informational, not interactive');
});

test('Phase 3 / C6: draft footer wiring uses existing SSoTs only (no new computation)', () => {
  const html = readText(INDEX_HTML);
  // wireDraftFooter() must reference both ScriptSession + ScriptMetrics.
  assert.ok(/function\s+wireDraftFooter\s*\(/.test(html),
    'wireDraftFooter() function must exist in the boot script');
  // Strip comments before pattern-matching so the explanatory comment
  // mentioning these names isn't the only match.
  const stripped = html
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.ok(/Rga\.ScriptSession\.subscribe/.test(stripped),
    'wireDraftFooter must subscribe to Rga.ScriptSession (existing SSOT for currentPage)');
  assert.ok(/Rga\.ScriptMetrics\.subscribe/.test(stripped),
    'wireDraftFooter must subscribe to Rga.ScriptMetrics (existing SSOT for wordCount)');
  // No new computation: must read .currentPage and .wordCount from
  // those snapshots — not compute them locally.
  assert.ok(/snap\.currentPage|snap && snap\.currentPage/.test(stripped),
    'wireDraftFooter must READ currentPage from ScriptSession snapshot (no new pagination)');
  assert.ok(/m\.wordCount|m && m\.wordCount/.test(stripped),
    'wireDraftFooter must READ wordCount from ScriptMetrics snapshot (no new word counting)');
});

test('Phase 3 / C6: draft footer wire call is in the boot sequence', () => {
  const html = readText(INDEX_HTML);
  // The wireDraftFooter() invocation must appear inside boot()
  // alongside the existing wireXxx pattern.
  assert.ok(/wireDraftFooter\s*\(\s*\)/.test(html),
    'wireDraftFooter() must be invoked in the boot sequence');
});

// ----------------------------------------------------------------
// Cross-cutting: Phase 3 didn't touch off-limits files
// ----------------------------------------------------------------

test('Phase 3: no new ownership introduced — no new shell module file', () => {
  // The C6 brief disallows new ownership. The footer wiring lives
  // in the boot script (alongside wireViewMode / wireUnits /
  // wireThemeToggle) — NOT in a new shell module file.
  const shellDir = path.join(REPO, 'renderer/js/shell');
  const files = fs.readdirSync(shellDir).filter(function(f) {
    return f.endsWith('.js');
  });
  // Whitelist of files that should exist post-Phase-3 (matches the
  // post-Slice-9 layout — confirms Phase 3 didn't add a new module).
  const EXPECTED = [
    'activity-rail.js', 'command-palette.js', 'icons-lucide.js',
    'index.js', 'keyboard-registry.js', 'layout.js', 'modal.js',
    'resize.js',
    // Responsive Shell engine (added 2026-05-23 — distinct owner of
    // window-resize → mode classes; not Phase 3 ownership creep).
    'responsive.js',
    'script-language.js', 'script-metrics.js',
    'script-session.js', 'session-boundary.js', 'sidebar.js',
    'status-bar.js', 'studio-panel.js', 'title-bar.js', 'toast.js',
    // Settings Architecture Doctrine substrate (added Slice 2 — distinct
    // owner of the tier-resolved settings store; consumers subscribe via
    // its public API; not Phase 3 ownership creep).
    'settings-store.js',
    // Settings Registry (added Slice 3A — distinct owner of the
    // declarative settings inventory; the store reads built-in
    // defaults from it; not Phase 3 ownership creep).
    'settings-registry.js',
    // Settings Layout (added Slice 3B — distinct owner of the
    // section + ordered-id presentation map; validates against the
    // registry at load time; not Phase 3 ownership creep).
    'settings-layout.js',
    // Settings Search (added Slice 3B — distinct owner of the pure
    // search functions over registry entries; not Phase 3 ownership creep).
    'settings-search.js',
    // Settings Validators (added Slice 3C — distinct owner of the
    // pure type-validator functions; registry + store consult it
    // at load and write respectively; not Phase 3 ownership creep).
    'settings-validators.js',
    // Shell Doctrine §4 workspace-tab registry (added Slice 1 —
    // distinct owner of the workspace-kind registration map; consumed
    // by TabManager.openWorkspace; not Phase 3 ownership creep).
    'workspaces.js',
    'workspace-state.js'
  ];
  const unexpected = files.filter(function(f) { return EXPECTED.indexOf(f) < 0; });
  assert.deepEqual(unexpected, [],
    'Phase 3 must not add a new file to renderer/js/shell/ (no new ownership). ' +
    'Unexpected file(s): ' + unexpected.join(', '));
});
