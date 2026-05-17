// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Visual Stabilization V1.1 — runtime UX regression tests.
//
// Six P1 fixes shipped in commits 1–5 of V1.1; this file guards the
// five behavioural ones (fix 1 is a doc-only open-decision note).
// All tests are structural / behavioural assertions readable by node:test
// + plain file inspection; no jsdom required where possible.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const REPO = path.resolve(__dirname, '../../..');
const INDEX_HTML       = path.join(REPO, 'renderer', 'index.html');
const VIEW_MODE_JS     = path.join(REPO, 'renderer', 'js', 'view-mode.js');
const SCENE_NAV_JS     = path.join(REPO, 'renderer', 'js', 'shell', 'panels', 'scene-navigator.js');
const APP_SHELL_JS     = path.join(REPO, 'renderer', 'js', 'app-shell.js');
const SHELL_INDEX_JS   = path.join(REPO, 'renderer', 'js', 'shell', 'index.js');
const SHELL_CSS        = path.join(REPO, 'renderer', 'css', 'shell.css');

function readText(file) { return fs.readFileSync(file, 'utf8'); }

// ----------------------------------------------------------------
// V1.1 fix 2 — Theme toggle surface
// ----------------------------------------------------------------

test('V1.1 fix 2: titlebar exposes a theme-toggle button with click affordance', () => {
  const html = readText(INDEX_HTML);
  assert.ok(
    /id="rga-shell-titlebar-theme"/.test(html),
    'index.html must include #rga-shell-titlebar-theme as the visible theme toggle'
  );
  // Wiring exists in the init script.
  assert.ok(
    /Rga\.\$\(['"]#rga-shell-titlebar-theme['"]\)/.test(html),
    'titlebar theme button must be wired in the init script (looked for Rga.$ selector)'
  );
  assert.ok(
    /Rga\.Theme\.toggle\s*\(\)/.test(html),
    'titlebar theme button wiring must call Rga.Theme.toggle()'
  );
});

// ----------------------------------------------------------------
// V1.1 fix 3 — Draft mode trap (Esc / X exits)
// ----------------------------------------------------------------

test('V1.1 fix 3: Rga.ViewMode subscribes to ViewManager.onChange so local current stays in sync', () => {
  const src = readText(VIEW_MODE_JS);
  assert.ok(
    /Rga\.ViewManager\.onChange\s*\(/.test(src),
    'view-mode.js must subscribe to Rga.ViewManager.onChange so external mode flips update local `current`'
  );
  // The subscription must update `current` so the Esc handler's gate
  // (`current === 'draft'`) fires for status-bar-initiated draft entry.
  assert.ok(
    /current\s*=\s*mode/.test(src),
    'the ViewManager.onChange callback must assign mode to current'
  );
});

test('V1.1 fix 3: behavioural — entering draft via ViewManager makes ViewMode.exitDraft work', () => {
  // Minimal jsdom harness that simulates ViewManager.onChange firing
  // for a status-bar-initiated draft entry, then verifies exitDraft
  // takes effect.
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor-container"></div></body></html>',
                        { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;

  global.window.Rga = {};
  // Minimal ViewManager stub — supports register, activate, current, onChange.
  let activeMode = 'flow';
  const listeners = [];
  global.window.Rga.ViewManager = {
    register: function() {},
    activate: function(m) {
      activeMode = m;
      listeners.forEach(function(fn) { try { fn(m); } catch (_) {} });
    },
    current: function() { return activeMode; },
    onChange: function(fn) { listeners.push(fn); return function() {}; }
  };

  delete require.cache[require.resolve('../../../renderer/js/view-mode.js')];
  require('../../../renderer/js/view-mode.js');
  const Rga = global.window.Rga;
  Rga.ViewMode.init();

  // Initial: flow.
  assert.equal(Rga.ViewMode.get(), 'flow');

  // Simulate status-bar bypass: ViewManager.activate('draft') without
  // going through Rga.ViewMode.set.
  Rga.ViewManager.activate('draft');
  assert.equal(Rga.ViewMode.get(), 'draft',
    'after V1.1 fix 3, ViewMode.current must follow ViewManager mode changes');

  // Now exitDraft must work because current === 'draft'.
  Rga.ViewMode.exitDraft();
  assert.equal(Rga.ViewMode.get(), 'flow',
    'exitDraft must return to the previous mode (flow) once current is in sync');
});

// ----------------------------------------------------------------
// V1.1 fix 4 — Scene Navigator click navigates
// ----------------------------------------------------------------

test('V1.1 fix 4: scrollToScene includes a DOM-level scrollIntoView backup via view.nodeDOM', () => {
  const src = readText(SCENE_NAV_JS);
  assert.ok(
    /view\.nodeDOM\s*\(/.test(src),
    'scrollToScene must call view.nodeDOM(pmPos) to get the scene\'s DOM node'
  );
  assert.ok(
    /scrollIntoView\s*\(\s*\{[^}]*block\s*:\s*['"]start['"]/.test(src),
    'scrollToScene must call dom.scrollIntoView({block: "start", ...}) as a backup'
  );
});

// ----------------------------------------------------------------
// V1.1 fix 5 — Toolbox stays visible during scroll
// RETIRED §A Shell Final Polish: #scene-toolbox surface was retired
// (every control migrated to Row 3 via D2 + D3). The "toolbox must
// not be inside the scrolling container" + "editor-area is the
// position:relative anchor" invariants are moot — no toolbox exists
// to anchor. Negative guard kept below: nothing must re-introduce
// #scene-toolbox without an architectural review.
// ----------------------------------------------------------------

test('V1.1 fix 5 (retired): #scene-toolbox surface has been retired (§A Shell Final Polish)', () => {
  const html = readText(INDEX_HTML);
  assert.equal(/<aside[^>]*id="scene-toolbox"/.test(html), false,
    '#scene-toolbox markup must NOT be reintroduced — every control migrated to Row 3 (#rga-shell-toolbar) via D2 + D3.');
});

// ----------------------------------------------------------------
// V1.1 fix 6 — Bottom panel reopen via Layout
// ----------------------------------------------------------------

test('V1.1 fix 6: Rga.BottomPanel.toggleCollapse writes to Rga.Shell.Layout.studioPanel (via state — Studio Shell Recovery §E)', () => {
  // Slice 9 §A: the implementation moved from app-shell.js into
  // renderer/js/shell/studio-panel.js (BottomPanel is now a thin
  // shim → StudioPanel). Source audit follows the move.
  //
  // Studio Shell Recovery §E: the SSOT field changed from
  // studioPanel.visible (boolean) to studioPanel.state (enum). The
  // V1.1 fix 6 contract — "toggle writes to Layout, not the DOM" — is
  // preserved; only the field name is updated. The visible mirror is
  // still maintained by Layout._normalizeStudioPanel so existing
  // readers of .visible keep working.
  const studioPanelSrc = readText(path.join(REPO, 'renderer/js/shell/studio-panel.js'));
  assert.ok(
    /Rga\.Shell\.Layout\.set\s*\(\s*\{\s*studioPanel\s*:\s*\{\s*state/.test(studioPanelSrc),
    'Rga.Shell.StudioPanel must call Rga.Shell.Layout.set({studioPanel: {state: ...}}) — DOM-only toggle is the regression V1.1 fix 6 prevents'
  );
  // A Layout subscriber must mirror state into the DOM.
  assert.ok(
    /Rga\.Shell\.Layout\.subscribe\s*\(/.test(studioPanelSrc) &&
    /_syncStateFromLayout/.test(studioPanelSrc),
    'StudioPanel.init must subscribe to Layout and sync the DOM via _syncStateFromLayout (§E renamed from _syncVisibilityFromLayout)'
  );
});

test('V1.1 fix 6: shell/index.js registers Cmd/Ctrl+` for the studio panel toggle', () => {
  const src = readText(SHELL_INDEX_JS);
  // §A4.1 migrated from KR.register to KR.registerCommand. The
  // command id is 'view.studioPanelAlt' (the "alt" suffix
  // distinguishes it from the primary Cmd+J binding which lives in
  // studio-panel.js — both invoke the same toggle mutator).
  assert.ok(
    /registerCommand\(\{[\s\S]{0,300}key:\s*['"]`['"][\s\S]{0,150}mods:\s*\{[^}]*ctrl:\s*true/.test(src),
    'shell/index.js must register the backtick combo via Rga.KeyboardRegistry.registerCommand (§A4.1 — was .register pre-§A4.1)'
  );
  // Must route through BottomPanel.toggleCollapse (single mutator) or
  // fall back to Layout.studioPanel.visible. Both flip the SSOT.
  assert.ok(
    /Rga\.BottomPanel\.toggleCollapse|Rga\.Shell\.Layout\.set\s*\(\s*\{\s*studioPanel/.test(src),
    'the backtick handler must route through BottomPanel.toggleCollapse or Layout.studioPanel.visible (SSOT)'
  );
});

test('V1.1 fix 6: behavioural — close + reopen via Layout round-trips visibility', () => {
  // Boot a minimal harness with #center-column + bottom-panel and the
  // Shell.Layout module + BottomPanel module. Then exercise the open/
  // close cycle through Layout.
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
    '<div id="center-column"><div id="bottom-panel"></div></div>' +
    '<button id="btn-close-bottom-panel"></button>' +
    '</body></html>',
    { url: 'http://localhost/' }
  );
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  global.window.Rga = {};
  // app-shell.js uses bare `Rga` identifiers after the initial
  // `window.Rga = window.Rga || {};` line, so we also expose it as
  // a true global for the require() to resolve.
  global.Rga = global.window.Rga;
  // Minimal Rga.$ / Rga.$$ shims required by app-shell.js.
  global.window.Rga.$  = function(sel, root) { return (root || document).querySelector(sel); };
  global.window.Rga.$$ = function(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  global.window.Rga.Keyboard = { register: function() {} };
  global.window.Rga.Shell = global.window.Rga.Shell || {};

  // Load Layout first, then StudioPanel (Slice 9 §A: BottomPanel shim
  // delegates here), then app-shell.js (provides the shim).
  delete require.cache[require.resolve('../../../renderer/js/shell/layout.js')];
  require('../../../renderer/js/shell/layout.js');
  delete require.cache[require.resolve('../../../renderer/js/shell/studio-panel.js')];
  require('../../../renderer/js/shell/studio-panel.js');
  delete require.cache[require.resolve('../../../renderer/js/app-shell.js')];
  require('../../../renderer/js/app-shell.js');
  const Rga = global.window.Rga;

  // Initial DOM: #center-column has NO 'bottom-collapsed' class (panel open).
  Rga.BottomPanel.init();
  assert.equal(
    document.getElementById('center-column').classList.contains('bottom-collapsed'),
    false,
    'initial DOM state: panel open (bottom-collapsed class absent)'
  );
  assert.equal(
    Rga.Shell.Layout.get().studioPanel.visible, true,
    'Layout must mirror the initial DOM state: studioPanel.visible = true'
  );

  // Simulate close-button click (toggleCollapse).
  Rga.BottomPanel.toggleCollapse();
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, false, 'after toggle, Layout.studioPanel.visible = false');
  assert.equal(
    document.getElementById('center-column').classList.contains('bottom-collapsed'),
    true,
    'DOM follows Layout — bottom-collapsed class added'
  );

  // Simulate reopen via Layout (what Ctrl+` does).
  Rga.Shell.Layout.set({ studioPanel: { visible: true } });
  assert.equal(
    document.getElementById('center-column').classList.contains('bottom-collapsed'),
    false,
    'DOM follows Layout — bottom-collapsed class removed on reopen'
  );
});
