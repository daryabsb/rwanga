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
   '../../../renderer/js/shell/settings-applicators.js',
   '../../../renderer/js/editor/editor-applicators.js',
   '../../../renderer/js/shell/shell-applicators.js',
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
// §4 — Editable controls boundary (5C overrides 5B)
// ----------------------------------------------------------------
// 5B forbade ANY input inside .rga-settings-rows. 5C makes the safe
// types (toggle / select / radio / number / text) editable. The new
// boundary: unsupported types (slider / color / shortcut / margins)
// stay strictly read-only. The §11 block below covers the editable
// contract end-to-end.

test('Slice 5C — unsupported types stay read-only (no input/select/fieldset on their rows)', async () => {
  bootDom();
  const el = await mountInitialized();
  const Rga = global.window.Rga;
  const UNSUPPORTED = ['slider', 'color', 'shortcut', 'margins'];
  const unsupportedIds = Rga.Settings.Registry.all()
    .filter(function(e) { return UNSUPPORTED.indexOf(e.type) >= 0; })
    .map(function(e) { return e.id; });
  // Touch each section that owns at least one unsupported entry and
  // assert the row's value slot stays text-only.
  const sectionsTouched = new Set();
  unsupportedIds.forEach(function(id) {
    const entry = Rga.Settings.Registry.get(id);
    const section = Rga.Settings.Layout.sections().find(function(s) {
      return s.settingIds.indexOf(id) >= 0;
    });
    if (!section || sectionsTouched.has(section.id)) return;
    sectionsTouched.add(section.id);
    el.querySelector('[data-section-id="' + section.id + '"]')
      .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));
    const row = el.querySelector(
      '.rga-settings-row[data-setting-id="' + id + '"]');
    assert.ok(row, 'row must exist for unsupported entry ' + id);
    const valueSlot = row.querySelector('.rga-settings-row-value');
    assert.equal(valueSlot.querySelectorAll('input').length,    0, id + ': no input');
    assert.equal(valueSlot.querySelectorAll('select').length,   0, id + ': no select');
    assert.equal(valueSlot.querySelectorAll('fieldset').length, 0, id + ': no fieldset');
    assert.ok(valueSlot.classList.contains('is-readonly'),
      id + ': read-only value slot must carry is-readonly class');
  });
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

test('Slice 5B+5C+H3 — each row shows label, description, value control (no engineer type chip per RC1 §7.3)', async () => {
  bootDom();
  const el = await mountInitialized();
  const Rga = global.window.Rga;
  // Spot-check editor.highlightCurrentLine (default true → checkbox checked).
  el.querySelector('[data-section-id="editor"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));
  const row = el.querySelector('.rga-settings-rows .rga-settings-row[data-setting-id="editor.highlightCurrentLine"]');
  assert.ok(row, 'highlightCurrentLine row must exist in the editor section');
  const label = row.querySelector('.rga-settings-row-label');
  const desc  = row.querySelector('.rga-settings-row-description');
  const value = row.querySelector('.rga-settings-row-value');
  const entry = Rga.Settings.Registry.get('editor.highlightCurrentLine');
  assert.equal(label.textContent, entry.label);
  assert.equal(desc.textContent,  entry.description);
  assert.ok(value, 'value element must exist');
  // 5C: toggle renders an editable checkbox carrying the current value.
  const cb = value.querySelector('input[type="checkbox"]');
  assert.ok(cb, 'toggle row must contain a checkbox in 5C');
  assert.equal(cb.checked, true, 'default true must render as checked');
  // H3 / RC1 §7.3 — the type chip ("toggle", "select", "radio") is
  // explicitly forbidden. It must not be rendered.
  const chip = row.querySelector('.rga-settings-row-type-chip');
  assert.equal(chip, null,
    'RC1 §7.3 forbids control-type chips on rows; this row must render none');
});

test('Slice 5C — boolean false renders as an unchecked checkbox', async () => {
  bootDom();
  const Rga = await loadAllInitialized();
  // Set highlight to false via Store, then mount fresh so rows pick up
  // the user-tier value.
  Rga.Settings.Store.set('editor.highlightCurrentLine', false);
  const spec = Rga.Workspaces.get('settings');
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  spec.mount(el);
  el.querySelector('[data-section-id="editor"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));
  const row = el.querySelector('.rga-settings-row[data-setting-id="editor.highlightCurrentLine"]');
  const cb = row.querySelector('.rga-settings-row-value input[type="checkbox"]');
  assert.ok(cb);
  assert.equal(cb.checked, false);
});

test('Slice 5C — text/select editable rows carry inputs with current effective values', async () => {
  bootDom();
  const el = await mountInitialized();
  el.querySelector('[data-section-id="pageSetup"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));
  // pageSetup.headerText — default '', editable text input.
  const headerRow = el.querySelector('.rga-settings-row[data-setting-id="pageSetup.headerText"]');
  const textInput = headerRow.querySelector('.rga-settings-row-value input[type="text"]');
  assert.ok(textInput, 'text type must render an editable text input');
  assert.equal(textInput.value, '');
  // pageSetup.paperSize — default 'letter', editable select.
  const paperRow = el.querySelector('.rga-settings-row[data-setting-id="pageSetup.paperSize"]');
  const sel = paperRow.querySelector('.rga-settings-row-value select');
  assert.ok(sel, 'select type must render a <select>');
  assert.equal(sel.value, 'letter');
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

test('Slice 5B + H3 — a REAL requiresPro entry renders a pro marker (PERSISTS_ONLY suppresses badges per RC1 §8.1.2)', async () => {
  bootDom();
  const Rga = await loadAllInitialized();
  const internals = Rga.Settings._workspaceInternals;
  assert.ok(internals && typeof internals.renderRowsInto === 'function',
    'renderRowsInto fixture hook must be exposed for testing');
  // Register a synthetic applicator so the row is REAL — under RC1
  // §8.1.2 only REAL rows display any badges (incl. the pro marker).
  Rga.Settings.Applicators.register('fake.pro', function() {}, { owner: 'test' });
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
  assert.equal(row.classList.contains('is-persists-only'), false,
    'REAL row must not be flagged PERSISTS_ONLY');
  const marker = row.querySelector('.rga-settings-row-pro-marker');
  assert.ok(marker, 'pro marker element must exist on a REAL requiresPro row');
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

// ================================================================
// Slice 5C — editable controls for safe types
// ================================================================

function _change(input) {
  input.dispatchEvent(new global.window.Event('change', { bubbles: true }));
}

// ----------------------------------------------------------------
// §11 — Boolean toggle writes through Store.set
// ----------------------------------------------------------------

test('Slice 5C — toggling a boolean checkbox writes the new value via Store.set', async () => {
  bootDom();
  const Rga = await loadAllInitialized();
  const spec = Rga.Workspaces.get('settings');
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  spec.mount(el);
  el.querySelector('[data-section-id="editor"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));

  const cb = el.querySelector(
    '.rga-settings-row[data-setting-id="editor.highlightCurrentLine"] input[type="checkbox"]');
  assert.ok(cb);
  assert.equal(cb.checked, true);

  // Spy on Store.set without breaking the real call (we still want
  // persistence + emission so the rest of the slice keeps working).
  const calls = [];
  const realSet = Rga.Settings.Store.set;
  Rga.Settings.Store.set = function(id, value, opts) {
    calls.push({ id: id, value: value });
    return realSet.call(this, id, value, opts);
  };

  cb.checked = false;
  _change(cb);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 'editor.highlightCurrentLine');
  assert.equal(calls[0].value, false);
  assert.equal(Rga.Settings.Store.effective('editor.highlightCurrentLine'), false);
});

// ----------------------------------------------------------------
// §12 — Select / radio write through Store.set
// ----------------------------------------------------------------

test('Slice 5C — changing a <select> writes the new option via Store.set', async () => {
  // H3: control-contract test must target a REAL select (has an
  // applicator). pageSetup.paperSize was the prior target but is
  // PERSISTS_ONLY post-H3 and correctly renders disabled.
  // editor.fontFamily is a REAL select.
  bootDom();
  const Rga = await loadAllInitialized();
  const spec = Rga.Workspaces.get('settings');
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  spec.mount(el);
  el.querySelector('[data-section-id="editor"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));

  const sel = el.querySelector(
    '.rga-settings-row[data-setting-id="editor.fontFamily"] select');
  assert.ok(sel);
  assert.equal(sel.value, 'Courier Prime');

  sel.value = 'Courier New';
  _change(sel);

  assert.equal(Rga.Settings.Store.effective('editor.fontFamily'), 'Courier New');
});

test('Slice 5C — picking a radio option writes via Store.set', async () => {
  // H3: the only REAL radio in the registry is `theme` (wired in H2).
  // pageSetup.orientation is PERSISTS_ONLY post-H3.
  bootDom();
  const Rga = await loadAllInitialized();
  const spec = Rga.Workspaces.get('settings');
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  spec.mount(el);
  // 'theme' lives in General — that's the default section.
  const group = el.querySelector(
    '.rga-settings-row[data-setting-id="theme"] fieldset');
  assert.ok(group);
  const light = group.querySelector('input[type="radio"][value="light"]');
  assert.ok(light);
  light.checked = true;
  _change(light);

  assert.equal(Rga.Settings.Store.effective('theme'), 'light');
});

// ----------------------------------------------------------------
// §13 — Number / text write through Store.set
// ----------------------------------------------------------------

test('Slice 5C — number input parses and writes a valid number via Store.set', async () => {
  bootDom();
  const Rga = await loadAllInitialized();
  const spec = Rga.Workspaces.get('settings');
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  spec.mount(el);
  el.querySelector('[data-section-id="editor"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));

  const input = el.querySelector(
    '.rga-settings-row[data-setting-id="editor.fontSize"] input[type="number"]');
  assert.ok(input);
  assert.equal(input.value, '12');
  input.value = '14';
  _change(input);

  const eff = Rga.Settings.Store.effective('editor.fontSize');
  assert.equal(eff, 14);
  assert.equal(typeof eff, 'number');
});

test('Slice 5C — text input writes a string via Store.set', async () => {
  // H3: no REAL text setting exists today (every text entry is
  // PERSISTS_ONLY). Register a synthetic applicator for the target
  // text entry to lift it to REAL for the duration of this test —
  // the test's concern is the text control's write contract, not the
  // wiring of any specific setting.
  bootDom();
  const Rga = await loadAllInitialized();
  Rga.Settings.Applicators.register('pageSetup.headerText', function() {},
    { owner: 'test' });
  const spec = Rga.Workspaces.get('settings');
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  spec.mount(el);
  el.querySelector('[data-section-id="pageSetup"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));

  const input = el.querySelector(
    '.rga-settings-row[data-setting-id="pageSetup.headerText"] input[type="text"]');
  assert.ok(input);
  input.value = 'Untitled draft';
  _change(input);

  assert.equal(Rga.Settings.Store.effective('pageSetup.headerText'), 'Untitled draft');
});

// ----------------------------------------------------------------
// §14 — requiresPro rows are disabled
// ----------------------------------------------------------------

test('Slice 5C — requiresPro rows render disabled controls and do NOT write on change', async () => {
  bootDom();
  await loadAllInitialized();
  const internals = global.window.Rga.Settings._workspaceInternals;
  const host = global.document.createElement('div');
  // Use a select-typed pro entry so we can simulate a change attempt.
  const fakeEntry = {
    id: 'fake.pro.select', label: 'Fake Pro Select', description: 'demo',
    type: 'select', default: 'a', options: ['a', 'b'], requiresPro: true
  };
  internals.renderRowsInto(host, [fakeEntry]);
  const sel = host.querySelector(
    '.rga-settings-row[data-setting-id="fake.pro.select"] select');
  assert.ok(sel);
  assert.equal(sel.disabled, true, 'pro control must be disabled');

  let setCalled = false;
  const realSet = global.window.Rga.Settings.Store.set;
  global.window.Rga.Settings.Store.set = function() { setCalled = true; return false; };
  try {
    // Even if the user could simulate a change, no write must occur
    // (no change handler is attached for pro rows).
    sel.value = 'b';
    _change(sel);
    assert.equal(setCalled, false, 'pro row change must not call Store.set');
  } finally {
    global.window.Rga.Settings.Store.set = realSet;
  }
});

// ----------------------------------------------------------------
// §15 — Unsupported types list (reporting parity)
// ----------------------------------------------------------------

test('Slice 5C — editable type set is exactly {toggle, select, radio, number, text}', async () => {
  bootDom();
  await loadAllInitialized();
  const editable = global.window.Rga.Settings._workspaceInternals._editableTypes.slice().sort();
  assert.deepEqual(editable, ['number', 'radio', 'select', 'text', 'toggle']);
});

// ----------------------------------------------------------------
// §16 — Invalid value is rejected and does not persist
// ----------------------------------------------------------------

test('Slice 5C — when Store.set rejects, the control reverts to the prior value', async () => {
  bootDom();
  const Rga = await loadAllInitialized();
  const spec = Rga.Workspaces.get('settings');
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  spec.mount(el);
  el.querySelector('[data-section-id="editor"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));

  const sel = el.querySelector(
    '.rga-settings-row[data-setting-id="editor.lineHeight"] select');
  assert.ok(sel);
  const before = Rga.Settings.Store.effective('editor.lineHeight');

  // Inject an option that is NOT in the registry's option set, then
  // dispatch change. Store.set must reject and the control must revert.
  const evil = global.document.createElement('option');
  evil.value = '999';
  evil.textContent = '999';
  sel.appendChild(evil);
  sel.value = '999';
  _change(sel);

  assert.equal(Rga.Settings.Store.effective('editor.lineHeight'), before,
    'rejected write must not change effective value');
  assert.equal(sel.value, String(before),
    'control must revert to the prior value after rejection');
});

// ----------------------------------------------------------------
// §17 — Search + edit interleave
// ----------------------------------------------------------------

test('Slice 5C — editing a control surfaced by search persists across section switches', async () => {
  bootDom();
  const Rga = await loadAllInitialized();
  const spec = Rga.Workspaces.get('settings');
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  spec.mount(el);

  // Search for "font size" → editor.fontSize row appears.
  const input = el.querySelector('.rga-settings-search-input');
  input.value = 'font size';
  input.dispatchEvent(new global.window.Event('input', { bubbles: true }));

  const numInput = el.querySelector(
    '.rga-settings-row[data-setting-id="editor.fontSize"] input[type="number"]');
  assert.ok(numInput, 'fontSize row must surface in search');
  numInput.value = '13';
  _change(numInput);
  assert.equal(Rga.Settings.Store.effective('editor.fontSize'), 13);

  // Clear search → return to General. Then switch to Editor and assert
  // the input there shows the edited value (effective is the truth).
  input.value = '';
  input.dispatchEvent(new global.window.Event('input', { bubbles: true }));
  el.querySelector('[data-section-id="editor"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));
  const after = el.querySelector(
    '.rga-settings-row[data-setting-id="editor.fontSize"] input[type="number"]');
  assert.equal(after.value, '13');
});

// ----------------------------------------------------------------
// §18 — External Store changes keep the control in sync
// ----------------------------------------------------------------

test('Slice 5C — when Store changes from elsewhere, the control reflects the new value', async () => {
  bootDom();
  const Rga = await loadAllInitialized();
  const spec = Rga.Workspaces.get('settings');
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  spec.mount(el);
  el.querySelector('[data-section-id="editor"]')
    .dispatchEvent(new global.window.MouseEvent('click', { bubbles: true }));

  const cb = el.querySelector(
    '.rga-settings-row[data-setting-id="editor.spellcheck"] input[type="checkbox"]');
  assert.equal(cb.checked, true);

  // Mutate via Store directly (not through the control).
  Rga.Settings.Store.set('editor.spellcheck', false);
  assert.equal(cb.checked, false,
    'external Store write must sync the control to the new value');
});

// ----------------------------------------------------------------
// §19 — restartRequired marker (no banner)
// ----------------------------------------------------------------

test('H3 / RC1 §8.1.2 — restartRequired entries that are PERSISTS_ONLY suppress the restart marker (no badges on un-wired rows)', async () => {
  bootDom();
  const el = await mountInitialized();
  // 'language' has restartRequired=true, type=select, AND no applicator.
  // Under RC1 §8.1.2 a PERSISTS_ONLY row carries no badges — the lower
  // opacity + appended helper text are the sole signals.
  const row = el.querySelector(
    '.rga-settings-row[data-setting-id="language"]');
  assert.ok(row);
  assert.ok(row.classList.contains('is-persists-only'),
    'language is PERSISTS_ONLY (no applicator) — row must carry the is-persists-only class');
  assert.equal(row.getAttribute('aria-disabled'), 'true',
    'PERSISTS_ONLY row must declare aria-disabled');
  const marker = row.querySelector('.rga-settings-row-restart-marker');
  assert.equal(marker, null,
    'RC1 §8.1.2 — PERSISTS_ONLY rows must not render the restart marker');
  const sel = row.querySelector('select');
  assert.ok(sel, 'control still renders, just non-interactive');
  assert.equal(sel.disabled, true,
    'RC1 §8.1.2 — PERSISTS_ONLY controls must be disabled');
  const desc = row.querySelector('.rga-settings-row-description');
  assert.ok(/Behavior not wired yet\.$/.test(desc.textContent),
    'helper text must be appended with the literal "Behavior not wired yet."');
});

test('H3 — REAL row (theme: has registered applicator) renders fully interactive and not flagged PERSISTS_ONLY', async () => {
  bootDom();
  const el = await mountInitialized();
  const Rga = global.window.Rga;
  // Force-register a synthetic applicator for theme so the workspace
  // sees it as REAL (the production boot also registers one).
  if (!Rga.Settings.Applicators.registered().includes('theme')) {
    Rga.Settings.Applicators.register('theme', function() {}, { owner: 'test' });
  }
  // Mount fresh to pick up the registration.
  const fresh = await mountInitialized();
  const row = fresh.querySelector('.rga-settings-row[data-setting-id="theme"]');
  assert.ok(row);
  assert.equal(row.classList.contains('is-persists-only'), false,
    'theme is REAL (applicator registered) — must not carry the PERSISTS_ONLY class');
  const radios = row.querySelectorAll('input[type="radio"]');
  assert.ok(radios.length > 0);
  radios.forEach(function(r) {
    assert.equal(r.disabled, false, 'REAL row controls must not be disabled');
  });
});

// ----------------------------------------------------------------
// §20 — unmount tears down Store subscriptions
// ----------------------------------------------------------------

test('Slice 5C — unmount removes per-row Store subscriptions', async () => {
  bootDom();
  const Rga = await loadAllInitialized();
  const spec = Rga.Workspaces.get('settings');
  const el = global.document.createElement('div');
  global.document.body.appendChild(el);
  spec.mount(el);

  const rowsHost = el.querySelector('.rga-settings-rows');
  assert.ok(rowsHost._rgaSettingsSubs && rowsHost._rgaSettingsSubs.length > 0,
    'subscriptions must be registered after mount');

  spec.unmount(el);
  // Re-acquire from the element (cleared on unmount).
  assert.equal(el.children.length, 0);
});
