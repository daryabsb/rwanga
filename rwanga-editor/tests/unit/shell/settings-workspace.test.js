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
  return dom;
}

function loadAll() {
  ['../../../renderer/js/shell/settings-validators.js',
   '../../../renderer/js/shell/settings-registry.js',
   '../../../renderer/js/shell/settings-layout.js',
   '../../../renderer/js/shell/workspaces.js',
   '../../../renderer/js/shell/workspaces/settings-workspace.js'
  ].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });
  return global.window.Rga;
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
// §4 — No controls rendered (skeleton scope)
// ----------------------------------------------------------------

test('Slice 5A — content area renders ONLY title/description/count placeholders, no controls', () => {
  bootDom();
  const el = mountWorkspace();
  const content = el.querySelector('.rga-settings-content');
  assert.ok(content);
  // Skeleton scope: no inputs, no buttons, no toggles, no save anywhere.
  assert.equal(content.querySelectorAll('input').length, 0);
  assert.equal(content.querySelectorAll('button').length, 0);
  assert.equal(content.querySelectorAll('select').length, 0);
  assert.equal(content.querySelectorAll('textarea').length, 0);
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
