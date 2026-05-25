// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings workspace skeleton — Slice 5A.
//
// First real Settings workspace tab. NOT the full Settings UI yet —
// the rail lists sections from settings-layout, the content area
// shows section title + description + setting count, nothing else.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bootDom() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="tab-content-host"></div></body></html>',
    { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  dom.window.Rga = {};
  // Stub prefs IPC so Store.init() resolves and effective() reads can
  // hydrate cleanly. Workspace rows pull current values via Store.
  dom.window.rwanga = {
    prefs: {
      read:  async function() { return {}; },
      write: async function() { return {}; }
    }
  };
  dom.window.Rga.TabManager = { activeDoc: function() { return null; } };
  return dom;
}

function loadAll() {
  ['../../../renderer/js/shell/settings-validators.js',
   '../../../renderer/js/shell/settings-registry.js',
   '../../../renderer/js/shell/settings-layout.js',
   '../../../renderer/js/shell/settings-search.js',
   '../../../renderer/js/shell/settings-store.js',
   '../../../renderer/js/shell/workspaces.js',
   '../../../renderer/js/shell/workspaces/settings-workspace.js'
  ].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  return global.window.Rga;
}

async function loadAllInitialized() {
  const Rga = loadAll();
  await Rga.Settings.Store.init();
  return Rga;
}

// ----------------------------------------------------------------
// §1 — Workspace registration
// ----------------------------------------------------------------

test('Slice 5A — settings workspace is registered with kind="settings"', () => {
  bootDom();
  const Rga = loadAll();
  const spec = Rga.Workspaces.get('settings');
  assert.ok(spec, 'workspace must be registered');
  assert.equal(spec.kind, 'settings');
  assert.equal(typeof spec.mount, 'function');
});

test('Slice 5A — settings workspace title is "Settings"', () => {
  bootDom();
  const Rga = loadAll();
  const spec = Rga.Workspaces.get('settings');
  assert.equal(spec.title, 'Settings');
});

// ----------------------------------------------------------------
// §2 — mount() renders rail + content placeholder
// ----------------------------------------------------------------

function mountWorkspace() {
  const Rga = loadAll();
  const spec = Rga.Workspaces.get('settings');
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  spec.mount(el);
  return el;
}

test('Slice 5A — mount() renders one nav item per layout section (9 sections)', () => {
  bootDom();
  const el = mountWorkspace();
  const items = el.querySelectorAll('.rga-settings-nav-item');
  assert.equal(items.length, 9, 'expected 9 nav items (one per layout section)');
});

test('Slice 5A — nav item labels match settings-layout section labels', () => {
  bootDom();
  loadAll();
  const expected = global.window.Rga.Settings.Layout.sections()
    .map(function(s) { return s.label; });
  const el = mountWorkspace();
  const got = Array.from(el.querySelectorAll('.rga-settings-nav-item'))
    .map(function(li) { return li.textContent.trim(); });
  assert.deepEqual(got, expected);
});

test('Slice 5A — nav item carries data-section-id matching the layout id', () => {
  bootDom();
  loadAll();
  const expected = global.window.Rga.Settings.Layout.sections()
    .map(function(s) { return s.id; });
  const el = mountWorkspace();
  const got = Array.from(el.querySelectorAll('.rga-settings-nav-item'))
    .map(function(li) { return li.getAttribute('data-section-id'); });
  assert.deepEqual(got, expected);
});

test('Slice 5A — content area shows the first section as active on mount', () => {
  bootDom();
  loadAll();
  const firstSection = global.window.Rga.Settings.Layout.sections()[0];
  const el = mountWorkspace();
  const title = el.querySelector('.rga-settings-content-title');
  const desc  = el.querySelector('.rga-settings-content-description');
  const count = el.querySelector('.rga-settings-content-count');
  assert.ok(title);
  assert.equal(title.textContent, firstSection.label);
  assert.ok(desc);
  assert.equal(desc.textContent, firstSection.description);
  assert.ok(count);
  // Count text must contain the actual number; allow any framing copy.
  assert.ok(count.textContent.indexOf(String(firstSection.settingIds.length)) >= 0,
    'count must include the actual number of settings in the section');
});

test('Slice 5A — exactly one nav item carries the active class on mount', () => {
  bootDom();
  const el = mountWorkspace();
  const active = el.querySelectorAll('.rga-settings-nav-item.is-active');
  assert.equal(active.length, 1);
  assert.equal(active[0].getAttribute('data-section-id'),
    global.window.Rga.Settings.Layout.sections()[0].id);
});

// ----------------------------------------------------------------
// §3 — Section switching
// ----------------------------------------------------------------

test('Slice 5A — clicking a nav item swaps the content area', () => {
  bootDom();
  loadAll();
  const sections = global.window.Rga.Settings.Layout.sections();
  const editor = sections.find(function(s) { return s.id === 'editor'; });
  const el = mountWorkspace();
  const editorItem = el.querySelector('[data-section-id="editor"]');
  editorItem.dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));
  assert.equal(el.querySelector('.rga-settings-content-title').textContent, editor.label);
  assert.equal(el.querySelector('.rga-settings-content-description').textContent,
    editor.description);
  assert.ok(el.querySelector('.rga-settings-content-count').textContent
    .indexOf(String(editor.settingIds.length)) >= 0);
});

test('Slice 5A — clicking a nav item moves the active class', () => {
  bootDom();
  const el = mountWorkspace();
  const target = el.querySelector('[data-section-id="appearance"]');
  target.dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));
  const active = el.querySelectorAll('.rga-settings-nav-item.is-active');
  assert.equal(active.length, 1);
  assert.equal(active[0].getAttribute('data-section-id'), 'appearance');
});

// ----------------------------------------------------------------
// §4 — No editable controls rendered (rows are read-only in 5B)
// ----------------------------------------------------------------
// Slice 5A asserted "no controls anywhere in the content area". Slice
// 5B adds a search input in the header (intentional) and rows
// underneath (intentionally NON-editable). The boundary moves to the
// .rga-settings-rows container: editable controls inside individual
// rows are still forbidden — those land with Slice 5C+.

test('Slice 5B — .rga-settings-rows contains no editable controls (rows are read-only)', () => {
  bootDom();
  const el = mountWorkspace();
  const rows = el.querySelector('.rga-settings-rows');
  assert.ok(rows);
  assert.equal(rows.querySelectorAll('input').length,    0);
  assert.equal(rows.querySelectorAll('button').length,   0);
  assert.equal(rows.querySelectorAll('select').length,   0);
  assert.equal(rows.querySelectorAll('textarea').length, 0);
});

// ----------------------------------------------------------------
// §5 — unmount() cleans up the rendered DOM
// ----------------------------------------------------------------

test('Slice 5A — unmount() empties the mount element', () => {
  bootDom();
  const Rga = loadAll();
  const spec = Rga.Workspaces.get('settings');
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  spec.mount(el);
  assert.ok(el.children.length > 0, 'mount must populate');
  spec.unmount(el);
  assert.equal(el.children.length, 0, 'unmount must clear');
});

// ================================================================
// Slice 5B — read-only rows + search
// ================================================================

async function mountInitialized() {
  await loadAllInitialized();
  const spec = global.window.Rga.Workspaces.get('settings');
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  spec.mount(el);
  return el;
}

// ----------------------------------------------------------------
// §6 — Rows render from the registry / layout
// ----------------------------------------------------------------

test('Slice 5B — content area contains a search input in the header', async () => {
  bootDom();
  const el = await mountInitialized();
  const search = el.querySelector('.rga-settings-search-input');
  assert.ok(search, 'a search input must exist in the content header');
  assert.equal(search.tagName, 'INPUT');
  assert.equal(search.getAttribute('type'), 'search');
});

test('Slice 5B — rows are rendered for every setting in the active section', async () => {
  bootDom();
  const el = await mountInitialized();
  const general = global.window.Rga.Settings.Layout.getSection('general');
  const rows = el.querySelectorAll('.rga-settings-rows .rga-settings-row');
  assert.equal(rows.length, general.settingIds.length,
    'one row per setting in the section');
});

test('Slice 5B — each row carries data-setting-id matching its setting', async () => {
  bootDom();
  const el = await mountInitialized();
  const general = global.window.Rga.Settings.Layout.getSection('general');
  const got = Array.from(el.querySelectorAll('.rga-settings-rows .rga-settings-row'))
    .map(function(r) { return r.getAttribute('data-setting-id'); });
  assert.deepEqual(got, general.settingIds);
});

test('Slice 5B — each row shows label, description, value, and a type chip', async () => {
  bootDom();
  const el = await mountInitialized();
  const Rga = global.window.Rga;
  // Spot-check editor.highlightCurrentLine (default true).
  el.querySelector('[data-section-id="editor"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));
  const row = el.querySelector('.rga-settings-rows .rga-settings-row[data-setting-id="editor.highlightCurrentLine"]');
  assert.ok(row, 'highlightCurrentLine row must exist in the editor section');
  const label = row.querySelector('.rga-settings-row-label');
  const desc  = row.querySelector('.rga-settings-row-description');
  const value = row.querySelector('.rga-settings-row-value');
  const chip  = row.querySelector('.rga-settings-row-type-chip');
  const entry = Rga.Settings.Registry.get('editor.highlightCurrentLine');
  assert.equal(label.textContent, entry.label);
  assert.equal(desc.textContent,  entry.description);
  assert.ok(value, 'value element must exist');
  // toggle boolean → "On" / "Off"
  assert.equal(value.textContent.trim(), 'On',
    'boolean true must render as "On"');
  assert.ok(chip);
  assert.equal(chip.textContent.trim(), 'toggle');
});

test('Slice 5B — boolean false renders as "Off"', async () => {
  bootDom();
  const Rga = await loadAllInitialized();
  // Set highlight to false via Store, then mount fresh so rows
  // pick up the user-tier value.
  Rga.Settings.Store.set('editor.highlightCurrentLine', false);
  const spec = Rga.Workspaces.get('settings');
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  spec.mount(el);
  el.querySelector('[data-section-id="editor"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));
  const row = el.querySelector('.rga-settings-row[data-setting-id="editor.highlightCurrentLine"]');
  assert.equal(row.querySelector('.rga-settings-row-value').textContent.trim(), 'Off');
});

test('Slice 5B — string value renders verbatim; empty string shows "(empty)"', async () => {
  bootDom();
  const el = await mountInitialized();
  // Switch to Page Setup section where pageSetup.headerText (default '')
  // and pageSetup.paperSize (default 'letter') both live.
  el.querySelector('[data-section-id="pageSetup"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));
  const headerRow = el.querySelector('.rga-settings-row[data-setting-id="pageSetup.headerText"]');
  assert.equal(headerRow.querySelector('.rga-settings-row-value').textContent.trim(),
    '(empty)', 'empty string default must show "(empty)" placeholder');
  const paperRow = el.querySelector('.rga-settings-row[data-setting-id="pageSetup.paperSize"]');
  assert.equal(paperRow.querySelector('.rga-settings-row-value').textContent.trim(),
    'letter');
});

// ----------------------------------------------------------------
// §7 — Section switching changes rows
// ----------------------------------------------------------------

test('Slice 5B — clicking a different section re-renders rows for that section', async () => {
  bootDom();
  const el = await mountInitialized();
  const Rga = global.window.Rga;
  // Start: General section rows.
  const general = Rga.Settings.Layout.getSection('general');
  assert.equal(el.querySelectorAll('.rga-settings-row').length, general.settingIds.length);
  // Click Advanced.
  el.querySelector('[data-section-id="advanced"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));
  const advanced = Rga.Settings.Layout.getSection('advanced');
  const rows = el.querySelectorAll('.rga-settings-row');
  assert.equal(rows.length, advanced.settingIds.length);
  const ids = Array.from(rows).map(function(r) { return r.getAttribute('data-setting-id'); });
  assert.deepEqual(ids, advanced.settingIds);
});

// ----------------------------------------------------------------
// §8 — Search filters rows
// ----------------------------------------------------------------

function _typeQuery(input, q) {
  input.value = q;
  input.dispatchEvent(new global.window.Event('input', { bubbles: true }));
}

test('Slice 5B — typing "paper" filters rows to settings that match (pageSetup.paperSize among them)', async () => {
  bootDom();
  const el = await mountInitialized();
  const input = el.querySelector('.rga-settings-search-input');
  _typeQuery(input, 'paper');
  const ids = Array.from(el.querySelectorAll('.rga-settings-row'))
    .map(function(r) { return r.getAttribute('data-setting-id'); });
  assert.ok(ids.indexOf('pageSetup.paperSize') >= 0,
    '"paper" must surface pageSetup.paperSize; got: ' + JSON.stringify(ids));
  // No other section row should be present unless it actually
  // matches — pageSetup.paperSize is the one specifically named.
  // Allow related pageSetup matches; assert the un-related General
  // section's "language" row is absent.
  assert.equal(ids.indexOf('language'), -1,
    'unrelated rows must be filtered out');
});

test('Slice 5B — typing "dark" surfaces theme via its keyword', async () => {
  bootDom();
  const el = await mountInitialized();
  const input = el.querySelector('.rga-settings-search-input');
  _typeQuery(input, 'dark');
  const ids = Array.from(el.querySelectorAll('.rga-settings-row'))
    .map(function(r) { return r.getAttribute('data-setting-id'); });
  assert.ok(ids.indexOf('theme') >= 0,
    '"dark" must surface theme; got: ' + JSON.stringify(ids));
});

test('Slice 5B — typing "font size" surfaces editor.fontSize', async () => {
  bootDom();
  const el = await mountInitialized();
  const input = el.querySelector('.rga-settings-search-input');
  _typeQuery(input, 'font size');
  const ids = Array.from(el.querySelectorAll('.rga-settings-row'))
    .map(function(r) { return r.getAttribute('data-setting-id'); });
  assert.ok(ids.indexOf('editor.fontSize') >= 0,
    '"font size" must surface editor.fontSize; got: ' + JSON.stringify(ids));
});

test('Slice 5B — clearing the search restores the active section view', async () => {
  bootDom();
  const el = await mountInitialized();
  const general = global.window.Rga.Settings.Layout.getSection('general');
  const input = el.querySelector('.rga-settings-search-input');
  _typeQuery(input, 'paper');
  // After search, count is whatever matched.
  assert.notEqual(el.querySelectorAll('.rga-settings-row').length,
    general.settingIds.length, 'search must have changed the row set');
  _typeQuery(input, '');
  // After clear, back to the active section.
  const rows = el.querySelectorAll('.rga-settings-row');
  assert.equal(rows.length, general.settingIds.length);
});

test('Slice 5B — clicking a section nav item clears the search input', async () => {
  bootDom();
  const el = await mountInitialized();
  const input = el.querySelector('.rga-settings-search-input');
  _typeQuery(input, 'paper');
  el.querySelector('[data-section-id="editor"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));
  assert.equal(input.value, '', 'switching sections must clear the search input');
});

// ----------------------------------------------------------------
// §9 — Empty search state
// ----------------------------------------------------------------

test('Slice 5B — no-result search renders the empty state and zero rows', async () => {
  bootDom();
  const el = await mountInitialized();
  const input = el.querySelector('.rga-settings-search-input');
  _typeQuery(input, 'xyzzy_no_match');
  const rows = el.querySelectorAll('.rga-settings-row');
  assert.equal(rows.length, 0);
  const empty = el.querySelector('.rga-settings-empty');
  assert.ok(empty);
  assert.ok(!empty.hasAttribute('hidden') && empty.style.display !== 'none',
    'empty state must be visible when no results');
});

test('Slice 5B — empty state is hidden when results exist', async () => {
  bootDom();
  const el = await mountInitialized();
  const empty = el.querySelector('.rga-settings-empty');
  // Initial mount has section rows visible → empty state hidden.
  assert.ok(empty.hasAttribute('hidden') || empty.style.display === 'none',
    'empty state must be hidden when rows are visible');
});

// ----------------------------------------------------------------
// §10 — requiresPro marker (via injected entries fixture)
// ----------------------------------------------------------------
// No registry entry currently carries requiresPro=true. The marker
// code-path is verified by calling the workspace's internal row
// renderer with a synthetic entry — same pattern Slice 3B used for
// alias/keyword testing on the search module.

test('Slice 5B — a requiresPro entry renders a pro marker', async () => {
  bootDom();
  await loadAllInitialized();
  const internals = global.window.Rga.Settings._workspaceInternals;
  assert.ok(internals && typeof internals.renderRowsInto === 'function',
    'renderRowsInto fixture hook must be exposed for testing');
  const fakeEntry = {
    id: 'fake.pro', label: 'Fake Pro Setting', description: 'demo',
    type: 'toggle', default: false, requiresPro: true
  };
  const host = global.document.createElement('div');
  internals.renderRowsInto(host, [fakeEntry]);
  const row = host.querySelector('.rga-settings-row[data-setting-id="fake.pro"]');
  assert.ok(row);
  assert.ok(row.classList.contains('is-pro'),
    'pro row must carry the is-pro class for styling');
  const marker = row.querySelector('.rga-settings-row-pro-marker');
  assert.ok(marker, 'pro marker element must exist on a requiresPro row');
});

test('Slice 5B — non-pro entries do NOT render the pro marker', async () => {
  bootDom();
  const el = await mountInitialized();
  // No registry entry has requiresPro=true today, so no row should
  // carry the marker. If a future slice adds Pro entries, this
  // assertion will need updating.
  const markers = el.querySelectorAll('.rga-settings-row-pro-marker');
  assert.equal(markers.length, 0);
});
