// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Studio Shell Recovery — Workstream E (Studio Panel three-state model).
//
// Locks: open / minimized / closed transitions; backward-compat
// migration from pre-§E workspaces (visible: bool only); minimize
// vs close as DISTINCT actions; tab-strip-click restore from
// minimized; View menu entry; existing keyboard / close-button /
// command-palette paths preserved; single-owner discipline.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const REPO = path.resolve(__dirname, '../../..');
const MENU_JS    = path.join(REPO, 'electron/menu.js');
const INDEX_HTML = path.join(REPO, 'renderer/index.html');
const SHELL_CSS  = path.join(REPO, 'renderer/css/shell.css');

function readText(p) { return fs.readFileSync(p, 'utf8'); }

function boot(opts) {
  opts = opts || {};
  const html = '<!DOCTYPE html><html><body>' +
    '<div id="center-column">' +
      '<div id="editor"></div>' +
      '<div class="resize-handle" data-resize="bottom-panel"></div>' +
      '<div id="bottom-panel">' +
        '<div id="bottom-panel-tabs">' +
          '<button class="bp-tab active" data-bp-tab="scene">Scene</button>' +
          '<button class="bp-tab" data-bp-tab="notes">Notes</button>' +
          '<span class="bp-tab-spacer"></span>' +
          '<button class="bp-tab-action" id="btn-minimize-bottom-panel">_</button>' +
          '<button class="bp-tab-action" id="btn-close-bottom-panel">x</button>' +
        '</div>' +
        '<div id="bottom-panel-content">' +
          '<div class="bp-content active" data-bp-tab="scene">Scene body</div>' +
          '<div class="bp-content" data-bp-tab="notes">Notes body</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '</body></html>';
  const dom = new JSDOM(html, { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.window.Rga = { $: function(s) { return document.querySelector(s); } };

  ['../../../renderer/js/shell/layout.js',
   '../../../renderer/js/shell/sidebar.js',
   '../../../renderer/js/shell/studio-panel.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.StudioPanel._reset();
  if (opts.initialState) {
    Rga.Shell.Layout.set({ studioPanel: { state: opts.initialState } });
  }
  Rga.Shell.StudioPanel.init();
  return { Rga, col: document.getElementById('center-column'),
           tabs: document.getElementById('bottom-panel-tabs'),
           body: document.getElementById('bottom-panel-content'),
           minBtn: document.getElementById('btn-minimize-bottom-panel'),
           closeBtn: document.getElementById('btn-close-bottom-panel') };
}

// ----------------------------------------------------------------
// §E.1 — Three-state model exists and transitions correctly
// ----------------------------------------------------------------

test('§E: default state is "open" (matches DEFAULTS.studioPanel.state)', () => {
  const { Rga, col } = boot();
  assert.equal(Rga.Shell.StudioPanel.state(), 'open');
  assert.equal(col.classList.contains('bottom-collapsed'), false);
  assert.equal(col.classList.contains('bottom-minimized'), false);
});

test('§E: open → minimize → restore cycle works (state transitions + DOM)', () => {
  const { Rga, col } = boot();
  Rga.Shell.StudioPanel.minimize();
  assert.equal(Rga.Shell.StudioPanel.state(), 'minimized');
  assert.equal(col.classList.contains('bottom-minimized'), true,
    'center-column carries .bottom-minimized after minimize()');
  assert.equal(col.classList.contains('bottom-collapsed'), false,
    'minimize must NOT set .bottom-collapsed (minimize ≠ close)');
  Rga.Shell.StudioPanel.restore();
  assert.equal(Rga.Shell.StudioPanel.state(), 'open');
  assert.equal(col.classList.contains('bottom-minimized'), false);
});

test('§E: open → close → toggle restores to open (no reload required)', () => {
  const { Rga, col } = boot();
  Rga.Shell.StudioPanel.hide();
  assert.equal(Rga.Shell.StudioPanel.state(), 'closed');
  assert.equal(col.classList.contains('bottom-collapsed'), true);
  Rga.Shell.StudioPanel.toggle();
  assert.equal(Rga.Shell.StudioPanel.state(), 'open',
    'toggle from closed must go to open (the existing keyboard / menu behaviour)');
  assert.equal(col.classList.contains('bottom-collapsed'), false);
});

test('§E: minimize and close are MUTUALLY EXCLUSIVE CSS classes (state cannot be both)', () => {
  const { Rga, col } = boot();
  Rga.Shell.StudioPanel.minimize();
  assert.equal(col.classList.contains('bottom-minimized'), true);
  assert.equal(col.classList.contains('bottom-collapsed'), false);
  Rga.Shell.StudioPanel.hide();
  assert.equal(col.classList.contains('bottom-collapsed'), true);
  assert.equal(col.classList.contains('bottom-minimized'), false,
    'going from minimized to closed must clear .bottom-minimized');
  Rga.Shell.StudioPanel.show();
  assert.equal(col.classList.contains('bottom-collapsed'), false);
  assert.equal(col.classList.contains('bottom-minimized'), false);
});

test('§E (revised): toggle from minimized RESTORES to open (one-keystroke restore from minimized)', () => {
  const { Rga } = boot();
  Rga.Shell.StudioPanel.minimize();
  Rga.Shell.StudioPanel.toggle();
  // Studio Panel Toggle Contract Fix — the original §E mapping
  // (minimized → closed) made the user press Ctrl+J twice to bring
  // the panel back after minimizing. The fix treats minimized as a
  // hidden-ish state for toggle purposes: one keystroke restores.
  // Same UX as VS Code / Cursor.
  assert.equal(Rga.Shell.StudioPanel.state(), 'open',
    'toggle from minimized → open (one-keystroke restore — matches VS Code Ctrl+J behaviour)');
});

test('§E (revised): toggle from open hides → closed (unchanged)', () => {
  const { Rga } = boot();
  Rga.Shell.StudioPanel.toggle();
  assert.equal(Rga.Shell.StudioPanel.state(), 'closed',
    'toggle from open hides to closed (the user explicitly wants the panel gone)');
});

test('§E (revised): toggle from closed restores → open (unchanged)', () => {
  const { Rga } = boot();
  Rga.Shell.StudioPanel.hide();
  Rga.Shell.StudioPanel.toggle();
  assert.equal(Rga.Shell.StudioPanel.state(), 'open',
    'toggle from closed restores to open');
});

// ----------------------------------------------------------------
// §E.2 — Header controls
// ----------------------------------------------------------------

test('§E: clicking close button closes the panel (does NOT toggle)', () => {
  const { Rga, closeBtn } = boot();
  closeBtn.click();
  assert.equal(Rga.Shell.StudioPanel.state(), 'closed');
  // A second click on the close button (which doesn't exist when
  // closed) is not applicable — when closed the button is hidden.
  // Reopening must come from a different surface.
});

test('§E: clicking minimize button minimizes when open, restores when minimized', () => {
  const { Rga, minBtn } = boot();
  assert.equal(Rga.Shell.StudioPanel.state(), 'open');
  minBtn.click();
  assert.equal(Rga.Shell.StudioPanel.state(), 'minimized');
  minBtn.click();
  assert.equal(Rga.Shell.StudioPanel.state(), 'open',
    'second click on minimize button restores from minimized');
});

test('§E: clicking the tab strip (not on a tab/action) when minimized restores in one click', () => {
  const { Rga, tabs } = boot();
  Rga.Shell.StudioPanel.minimize();
  // Click on the strip itself — not on a tab and not on an action.
  // Use the spacer element (which exists for this purpose).
  const spacer = tabs.querySelector('.bp-tab-spacer');
  assert.ok(spacer);
  spacer.click();
  assert.equal(Rga.Shell.StudioPanel.state(), 'open',
    'one click on the tab strip restores from minimized (acceptance: one-click restore)');
});

// ----------------------------------------------------------------
// §E.3 — Layout-state ownership + backward-compat migration
// ----------------------------------------------------------------

test('§E: Layout.studioPanel has a `state` field defaulting to "open"', () => {
  const { Rga } = boot();
  const snap = Rga.Shell.Layout.get();
  assert.equal(snap.studioPanel.state, 'open');
});

test('§E: Layout migration — pre-§E workspace with visible:true → state:"open"', () => {
  const { Rga } = boot();
  // Pre-§E workspace JSON only carried { visible: true }.
  Rga.Shell.Layout.fromJSON({ studioPanel: { visible: true, height: 250, activeTab: 'notes' } });
  const snap = Rga.Shell.Layout.get();
  assert.equal(snap.studioPanel.state, 'open',
    'visible:true in stored workspace must migrate to state:"open"');
  assert.equal(snap.studioPanel.visible, true, 'visible mirror preserved');
  assert.equal(snap.studioPanel.height, 250, 'unrelated fields preserved');
  assert.equal(snap.studioPanel.activeTab, 'notes', 'unrelated fields preserved');
});

test('§E: Layout migration — pre-§E workspace with visible:false → state:"closed"', () => {
  const { Rga } = boot();
  Rga.Shell.Layout.fromJSON({ studioPanel: { visible: false } });
  const snap = Rga.Shell.Layout.get();
  assert.equal(snap.studioPanel.state, 'closed',
    'visible:false in stored workspace must migrate to state:"closed"');
  assert.equal(snap.studioPanel.visible, false, 'visible mirror preserved');
});

test('§E: visible mirror auto-updates when state changes via set()', () => {
  const { Rga } = boot();
  Rga.Shell.Layout.set({ studioPanel: { state: 'closed' } });
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, false,
    'writing state:"closed" must derive visible:false');
  Rga.Shell.Layout.set({ studioPanel: { state: 'minimized' } });
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, true,
    'writing state:"minimized" must derive visible:true (panel header still showing)');
  Rga.Shell.Layout.set({ studioPanel: { state: 'open' } });
  assert.equal(Rga.Shell.Layout.get().studioPanel.visible, true);
});

test('§E: state mirror auto-updates when visible is written (backward-compat for existing callers)', () => {
  const { Rga } = boot();
  Rga.Shell.Layout.set({ studioPanel: { visible: false } });
  assert.equal(Rga.Shell.Layout.get().studioPanel.state, 'closed',
    'writing visible:false must derive state:"closed" — preserves callers that still use boolean shape');
  Rga.Shell.Layout.set({ studioPanel: { visible: true } });
  assert.equal(Rga.Shell.Layout.get().studioPanel.state, 'open');
});

test('§E: writing visible:true preserves minimized state (does not auto-restore)', () => {
  const { Rga } = boot({ initialState: 'minimized' });
  // visible:true with current state='minimized' should stay minimized
  // (the minimized panel is already "visible" — the header is showing).
  // This preserves the V1.1 fix 6 contract that visible mirrors "is
  // any part of the panel showing".
  Rga.Shell.Layout.set({ studioPanel: { visible: true } });
  assert.equal(Rga.Shell.Layout.get().studioPanel.state, 'minimized',
    'visible:true write preserves existing minimized state');
});

// ----------------------------------------------------------------
// §E.4 — Existing recovery paths preserved (single owner, no drift)
// ----------------------------------------------------------------

test('§E: native View menu has a Studio Panel entry routing to view.studioPanel', () => {
  const src = readText(MENU_JS);
  assert.ok(/label:\s*['"]Studio Panel['"]/.test(src),
    'electron/menu.js must include a View → Studio Panel entry');
  assert.ok(/sendMenuAction\(mainWindow,\s*['"]view\.studioPanel['"]\)/.test(src),
    'Studio Panel menu entry must route via the menu.action IPC channel with id "view.studioPanel"');
});

test('§E: view.studioPanel command routes through Rga.Shell.StudioPanel.toggle (single owner)', () => {
  // §A4.1 — the view.studioPanel command is registered via
  // KR.registerCommand inside studio-panel.js _wireKeyboardShortcut.
  // The command's handler calls Studio Panel toggle. Both the
  // keyboard accelerator (Ctrl+J) AND the View menu item invoke
  // this command — no duplicate routing.
  const studioSrc = readText(path.join(REPO, 'renderer/js/shell/studio-panel.js'));
  assert.ok(
    /registerCommand\(\{[\s\S]{0,300}command:\s*['"]view\.studioPanel['"][\s\S]{0,300}toggle\(\)/.test(studioSrc),
    'studio-panel.js must register the view.studioPanel command whose handler calls toggle()'
  );
  // Renderer dispatch unifies under KR.invokeCommand — verify the
  // menuAction handler routes through KR (not a per-action switch).
  const rendererSrc = readText(INDEX_HTML);
  assert.ok(
    /Rga\.KeyboardRegistry\.invokeCommand\(action\)/.test(rendererSrc),
    'renderer menu-action handler must route via KR.invokeCommand(action) — no per-case ownership duplication'
  );
});

test('§E: minimize button DOM exists in index.html with the expected id', () => {
  const html = readText(INDEX_HTML);
  assert.ok(/id="btn-minimize-bottom-panel"/.test(html),
    'index.html must declare <button id="btn-minimize-bottom-panel">');
});

test('§E: close button DOM exists in index.html (preserved, not removed)', () => {
  const html = readText(INDEX_HTML);
  assert.ok(/id="btn-close-bottom-panel"/.test(html),
    'close button preserved (minimize did not replace it)');
});

// ----------------------------------------------------------------
// §E.5 — CSS for the minimized state
// ----------------------------------------------------------------

test('§E: shell.css defines .bottom-minimized rules (parallel to .bottom-collapsed)', () => {
  const css = readText(SHELL_CSS);
  assert.ok(/#center-column\.bottom-minimized\s*\{/.test(css),
    'shell.css must declare a rule for #center-column.bottom-minimized');
  assert.ok(/#center-column\.bottom-minimized\s+#bottom-panel-content\s*\{[^}]*display\s*:\s*none/.test(css),
    'bottom-minimized must hide #bottom-panel-content (the panel body)');
  // The tab strip must NOT be hidden — that's the whole point of
  // minimize-vs-close.
  const stripHideRule = css.match(/#center-column\.bottom-minimized[^}]*#bottom-panel-tabs[^}]*display\s*:\s*none/);
  assert.equal(stripHideRule, null,
    'bottom-minimized must NOT hide #bottom-panel-tabs (the strip is the restore affordance)');
});

// ----------------------------------------------------------------
// §E.6 — Ownership discipline
// ----------------------------------------------------------------

test('§E: Rga.Shell.StudioPanel exposes minimize / restore / state on its public API', () => {
  const { Rga } = boot();
  assert.equal(typeof Rga.Shell.StudioPanel.minimize, 'function');
  assert.equal(typeof Rga.Shell.StudioPanel.restore,  'function');
  assert.equal(typeof Rga.Shell.StudioPanel.state,    'function');
  // The existing public surface is preserved.
  ['init', 'show', 'hide', 'toggle', 'switchTo', 'activeTab',
   'toggleInspector', 'openInspector'].forEach(function(method) {
    assert.equal(typeof Rga.Shell.StudioPanel[method], 'function',
      'pre-§E method ' + method + ' must still exist on StudioPanel');
  });
});

test('§E: no new shell module file (StudioPanel is and remains the single owner of bottom + inspector)', () => {
  // Phase 3 / Bundle 2 §B ownership guard — re-locked here so §E
  // can't accidentally spawn a sibling. New modules with their own
  // distinct ownership (e.g. Responsive Shell engine) are added to
  // EXPECTED explicitly with a documented owner — the guard catches
  // unauthorised additions, not authorised ones.
  const shellDir = path.join(REPO, 'renderer/js/shell');
  const files = fs.readdirSync(shellDir).filter(function(f) { return f.endsWith('.js'); });
  const EXPECTED = [
    'activity-rail.js', 'command-palette.js', 'icons-lucide.js',
    'index.js', 'keyboard-registry.js', 'layout.js', 'modal.js',
    'resize.js',
    // 'responsive.js' — Responsive Shell engine. Distinct owner: window
    // resize → mode classes on #app. Does NOT touch StudioPanel's
    // ownership of the inspector-collapsed class (engine routes
    // through StudioPanel's public API).
    'responsive.js',
    'script-language.js', 'script-metrics.js',
    'script-session.js', 'session-boundary.js', 'sidebar.js',
    'status-bar.js', 'studio-panel.js', 'title-bar.js', 'toast.js',
    'workspace-state.js'
  ];
  const unexpected = files.filter(function(f) { return EXPECTED.indexOf(f) < 0; });
  assert.deepEqual(unexpected, [],
    '§E must not add a new shell module file. Unexpected: ' + unexpected.join(', '));
});
