// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Bundle 2 §B — writer-context breadcrumb.
// Locks DOM, CSS, wiring, and ownership-chain rules.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '../../..');
const INDEX_HTML = path.join(REPO, 'renderer/index.html');
const EDITOR_CSS = path.join(REPO, 'renderer/css/editor-prosemirror.css');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function ruleBody(css, selectorLiteral) {
  const escaped = selectorLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp('(?:^|\\n)\\s*' + escaped + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}

// ----------------------------------------------------------------
// DOM
// ----------------------------------------------------------------

test('Bundle 2 §B: #rga-shell-breadcrumb DOM exists with three stacked segments', () => {
  const html = read(INDEX_HTML);
  assert.ok(/id="rga-shell-breadcrumb"/.test(html),
    'breadcrumb root element must exist');
  ['rga-shell-breadcrumb-script',
   'rga-shell-breadcrumb-scene',
   'rga-shell-breadcrumb-heading'].forEach(function(cls) {
    assert.ok(html.indexOf(cls) >= 0,
      'breadcrumb must include the .' + cls + ' segment');
  });
  // Sub-segments inside the script line.
  ['rga-shell-breadcrumb-app',
   'rga-shell-breadcrumb-sep',
   'rga-shell-breadcrumb-script-name'].forEach(function(cls) {
    assert.ok(html.indexOf(cls) >= 0,
      'breadcrumb script line must include the .' + cls + ' segment');
  });
});

test('Bundle 2 §B: breadcrumb starts hidden (no script open)', () => {
  const html = read(INDEX_HTML);
  assert.ok(/<nav\s+id="rga-shell-breadcrumb"[^>]*hidden/.test(html),
    'breadcrumb must start hidden — CSS + JS reveal once a script is active');
});

test('Bundle 2 §B: breadcrumb sits inside #editor-area, after #tab-bar (writer-context indicator at the top of the editor surface)', () => {
  // §D1 removed the inline #format-toolbar (text tools moved to Row 3
  // #rga-shell-toolbar in app chrome). The breadcrumb's position is
  // now anchored after #tab-bar and before the editor container; the
  // pre-§D1 "before #format-toolbar" check is replaced by "before
  // #editor-container".
  const html = read(INDEX_HTML);
  const tabBarIdx     = html.indexOf('id="tab-bar"');
  const crumbIdx      = html.indexOf('id="rga-shell-breadcrumb"');
  const editorContIdx = html.indexOf('id="editor-container"');
  assert.ok(tabBarIdx > 0 && crumbIdx > 0 && editorContIdx > 0,
    'tab-bar / breadcrumb / editor-container must all exist');
  assert.ok(tabBarIdx < crumbIdx,
    'breadcrumb must sit AFTER #tab-bar');
  assert.ok(crumbIdx < editorContIdx,
    'breadcrumb must sit BEFORE #editor-container (writer-context indicator at the top of the editor surface)');
});

// ----------------------------------------------------------------
// Wiring — single ownership chain (ScriptSession), no new module
// ----------------------------------------------------------------

test('Bundle 2 §B: wireBreadcrumb() exists and is called in boot()', () => {
  const html = read(INDEX_HTML);
  assert.ok(/function\s+wireBreadcrumb\s*\(/.test(html),
    'wireBreadcrumb() must be defined in the boot script (no new shell module — same pattern as wireDraftFooter)');
  assert.ok(/wireBreadcrumb\s*\(\s*\)/.test(html),
    'wireBreadcrumb() must be invoked in the boot sequence');
});

test('Bundle 2 §B: breadcrumb subscribes to Rga.ScriptSession (existing SSOT) and reads activeScript + currentScene only', () => {
  const html = read(INDEX_HTML);
  // Subscribe call.
  assert.ok(/Rga\.ScriptSession\.subscribe\(render\)/.test(html),
    'breadcrumb must subscribe to Rga.ScriptSession (the writer-context SSOT)');
  // Reads the canonical fields, not derived ones.
  assert.ok(/snap\.activeScript/.test(html),
    'breadcrumb must read activeScript from the ScriptSession snapshot');
  assert.ok(/snap\.currentScene/.test(html),
    'breadcrumb must read currentScene from the ScriptSession snapshot');
  // No new ownership: must NOT compute scene number or heading text
  // itself; both come from currentScene fields.
  assert.ok(/scene\.sceneNumber/.test(html),
    'breadcrumb must read sceneNumber from currentScene (no own derivation)');
  assert.ok(/scene\.headingDisplay/.test(html),
    'breadcrumb must read headingDisplay from currentScene (no own derivation)');
});

test('Bundle 2 §B: no new shell module file (boot-script wiring only — preserves Phase 3 ownership guard)', () => {
  const shellDir = path.join(REPO, 'renderer/js/shell');
  const files = fs.readdirSync(shellDir).filter(function(f) { return f.endsWith('.js'); });
  // Same whitelist as Phase 3 §C6 guard.
  const EXPECTED = [
    'activity-rail.js', 'command-palette.js', 'icons-lucide.js',
    'index.js', 'keyboard-registry.js', 'layout.js', 'modal.js',
    'resize.js',
    // Responsive Shell engine (added 2026-05-23 — distinct owner of
    // window-resize → mode classes; not Bundle 2 ownership creep).
    'responsive.js',
    'script-language.js', 'script-metrics.js',
    'script-session.js', 'session-boundary.js', 'sidebar.js',
    'status-bar.js', 'studio-panel.js', 'title-bar.js', 'toast.js',
    // Settings Architecture Doctrine substrate (added Slice 2 —
    // distinct owner of the tier-resolved settings store; consumers
    // subscribe via its public API; not Bundle 2 ownership creep).
    'settings-store.js',
    // Shell Doctrine §4 workspace-tab registry (added Slice 1 —
    // distinct owner of workspace registration map; consumed by
    // TabManager.openWorkspace; not Bundle 2 ownership creep).
    'workspaces.js',
    'workspace-state.js'
  ];
  const unexpected = files.filter(function(f) { return EXPECTED.indexOf(f) < 0; });
  assert.deepEqual(unexpected, [],
    'Bundle 2 §B must not add a new shell module file. Unexpected: ' + unexpected.join(', '));
});

// ----------------------------------------------------------------
// Copy + language rules
// ----------------------------------------------------------------

test('Bundle 2 §B: writer-facing language only — no "Node" / "Document" / "ProseMirror" terminology in user copy', () => {
  const html = read(INDEX_HTML);
  // Find the breadcrumb-related code section and check it doesn't
  // surface engine vocabulary to the user.
  const wireFn = html.match(/function\s+wireBreadcrumb[\s\S]*?\n\s*\}\s*\n\s*\/\*/);
  assert.ok(wireFn, 'wireBreadcrumb function block must be locatable');
  const body = wireFn[0];
  // Forbidden user-facing tokens (these would leak engine vocabulary
  // into breadcrumb text). Comments stripped first.
  const stripped = body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  ['Node', 'NodeId', 'ProseMirror', 'PM ', 'doc.node', 'editor.state'].forEach(function(t) {
    assert.equal(stripped.indexOf(t), -1,
      'breadcrumb wiring must not surface engine vocabulary: "' + t + '"');
  });
  // The user-visible string templates use writer vocabulary.
  assert.ok(/Scene S/.test(body) || /'Scene S'/.test(body),
    'breadcrumb must render "Scene S{N}" (writer vocabulary)');
});

// ----------------------------------------------------------------
// CSS — hierarchy + Draft hide + tokens-only
// ----------------------------------------------------------------

test('Bundle 2 §B: CSS hides the breadcrumb in Draft view (parallel to format-toolbar)', () => {
  const css = read(EDITOR_CSS);
  // The Draft hide group covers format-toolbar AND rga-shell-
  // breadcrumb together — both are editor-area chrome that Draft
  // strips. (Scene Toolbox was retired in §A Shell Final Polish.)
  assert.ok(/body\.view-draft-active\s+#rga-shell-breadcrumb/.test(css),
    'Draft view must hide #rga-shell-breadcrumb (CSS grouped with format-toolbar)');
});

test('Bundle 2 §B: visual hierarchy reads script → scene → heading (font-size ascends)', () => {
  const css = read(EDITOR_CSS);
  const scriptRule  = ruleBody(css, '.rga-shell-breadcrumb-script');
  const sceneRule   = ruleBody(css, '.rga-shell-breadcrumb-scene');
  const headingRule = ruleBody(css, '.rga-shell-breadcrumb-heading');
  assert.ok(scriptRule && sceneRule && headingRule,
    'all three breadcrumb line rules must exist');
  function parsePx(s) { const m = s.match(/font-size\s*:\s*(\d+)px/); return m ? parseInt(m[1], 10) : null; }
  const s1 = parsePx(scriptRule);
  const s2 = parsePx(sceneRule);
  const s3 = parsePx(headingRule);
  assert.ok(s1 != null && s2 != null && s3 != null,
    'each breadcrumb line must declare an explicit font-size');
  assert.ok(s1 <= s2 && s2 <= s3,
    'breadcrumb font-sizes must ascend script (' + s1 + ') → scene (' + s2 + ') → heading (' + s3 + ') — strongest at the bottom');
});

test('Bundle 2 §B: breadcrumb uses existing tokens only (no new colors)', () => {
  const css = read(EDITOR_CSS);
  // Scan the three breadcrumb rules for color declarations and
  // require they all reference var(--text-*) or var(--accent-*).
  ['.rga-shell-breadcrumb-script',
   '.rga-shell-breadcrumb-script-name',
   '.rga-shell-breadcrumb-scene',
   '.rga-shell-breadcrumb-heading'].forEach(function(sel) {
    const body = ruleBody(css, sel);
    if (!body) return;
    const colorDecl = body.match(/color\s*:\s*([^;]+);/);
    if (!colorDecl) return;
    assert.ok(/var\(\s*--(?:text|accent)-/.test(colorDecl[1]),
      sel + ' color must use a --text-* or --accent-* token (no new colors). Got: ' + colorDecl[1]);
  });
});
