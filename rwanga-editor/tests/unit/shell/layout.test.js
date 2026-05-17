// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 1 — Rga.Shell.Layout unit tests (plan §3.1, §8.2).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  delete require.cache[require.resolve('../../../renderer/js/shell/layout.js')];
  require('../../../renderer/js/shell/layout.js');
  global.window.Rga.Shell.Layout._reset();
  return { Layout: global.window.Rga.Shell.Layout };
}

test('Layout.get() returns the default state on first read', () => {
  const { Layout } = boot();
  const s = Layout.get();
  assert.equal(s.sidebar.visible, true);
  assert.equal(s.sidebar.width, 280);
  assert.equal(s.sidebar.activePanel, 'sceneNavigator');
  // Slice 4 §A: studioPanel.visible default flipped false → true to
  // match the long-standing UX where a fresh install boots with the
  // bottom panel visible.
  assert.equal(s.studioPanel.visible, true);
  assert.equal(s.studioPanel.height, 200);
  assert.equal(s.studioPanel.activeTab, null);
  // Slice 4 §A: inspector zone added.
  assert.equal(s.inspector.visible, true);
  assert.equal(s.inspector.width, 280);
  assert.equal(s.titleBar.visible, true);
  assert.equal(s.statusBar.visible, true);
});

test('Layout.get() returns a SHALLOW COPY — mutations do not affect internal state', () => {
  const { Layout } = boot();
  const s1 = Layout.get();
  s1.sidebar.visible = 'mutated';
  s1.studioPanel.height = 9999;
  const s2 = Layout.get();
  assert.equal(s2.sidebar.visible, true);
  assert.equal(s2.studioPanel.height, 200);
});

test('Layout.set({sidebar: {visible: false}}) merges; other sidebar fields preserved', () => {
  const { Layout } = boot();
  Layout.set({ sidebar: { visible: false } });
  const s = Layout.get();
  assert.equal(s.sidebar.visible, false);
  assert.equal(s.sidebar.width, 280, 'width preserved');
  assert.equal(s.sidebar.activePanel, 'sceneNavigator', 'activePanel preserved');
});

test('Layout.set with deeply-merged path only touches specified leaves', () => {
  const { Layout } = boot();
  Layout.set({ studioPanel: { activeTab: 'notes' } });
  const s = Layout.get();
  assert.equal(s.studioPanel.activeTab, 'notes');
  assert.equal(s.studioPanel.visible, true);   // Slice 4 §A default flip
  assert.equal(s.studioPanel.height, 200);
  // Other zones untouched.
  assert.equal(s.sidebar.visible, true);
});

test('Layout.set(null) / set(undefined) / set(non-object) is a safe no-op', () => {
  const { Layout } = boot();
  const before = Layout.get();
  Layout.set(null);
  Layout.set(undefined);
  Layout.set('string');
  Layout.set(42);
  Layout.set(true);
  assert.deepEqual(Layout.get(), before);
});

test('Layout.subscribe(fn) fires synchronously after set', () => {
  const { Layout } = boot();
  let called = 0;
  let receivedNext = null;
  Layout.subscribe(function(next) { called += 1; receivedNext = next; });
  Layout.set({ sidebar: { width: 320 } });
  assert.equal(called, 1);
  assert.equal(receivedNext.sidebar.width, 320);
});

test('Layout.subscribe passes (next, prev) snapshots', () => {
  const { Layout } = boot();
  let receivedPrev = null;
  let receivedNext = null;
  Layout.subscribe(function(next, prev) { receivedNext = next; receivedPrev = prev; });
  Layout.set({ sidebar: { visible: false } });
  assert.equal(receivedPrev.sidebar.visible, true);
  assert.equal(receivedNext.sidebar.visible, false);
});

test('Layout.subscribe returns unsubscribe; unsubscribe stops further notifications', () => {
  const { Layout } = boot();
  let count = 0;
  const off = Layout.subscribe(function() { count += 1; });
  Layout.set({ sidebar: { width: 300 } });
  off();
  Layout.set({ sidebar: { width: 320 } });
  assert.equal(count, 1);
});

test('Layout.set that does not actually change anything does NOT notify subscribers', () => {
  const { Layout } = boot();
  let count = 0;
  Layout.subscribe(function() { count += 1; });
  // Setting current value to the same value: no notification.
  Layout.set({ sidebar: { visible: true } });
  assert.equal(count, 0);
  // Real change: notify once.
  Layout.set({ sidebar: { visible: false } });
  assert.equal(count, 1);
});

test('Layout._reset() restores defaults', () => {
  const { Layout } = boot();
  Layout.set({ sidebar: { visible: false, width: 50, activePanel: 'outline' } });
  Layout.set({ studioPanel: { visible: true, height: 400 } });
  Layout._reset();
  assert.deepEqual(Layout.get(), {
    sidebar:     { visible: true,  width: 280, activePanel: 'sceneNavigator' },
    // Studio Shell Recovery §E: studioPanel gained a `state` field
    // ('open' | 'minimized' | 'closed') as the new SSOT for the
    // three-state model. `visible` is auto-derived (state !== 'closed')
    // for backward compat.
    studioPanel: { state: 'open', visible: true,  height: 200, activeTab: null },
    inspector:   { visible: true,  width: 280 },
    titleBar:    { visible: true },
    statusBar:   { visible: true }
  });
});

// ----------------------------------------------------------------
// Slice 2 — toJSON / fromJSON serialization contract
// ----------------------------------------------------------------

test('Slice 2: toJSON returns the same shape as get()', () => {
  const { Layout } = boot();
  const a = Layout.toJSON();
  const b = Layout.get();
  assert.deepEqual(a, b);
});

test('Slice 2: JSON.stringify(toJSON()) round-trips through fromJSON identity', () => {
  const { Layout } = boot();
  Layout.set({ sidebar: { visible: false, width: 350, activePanel: 'outline' } });
  Layout.set({ studioPanel: { visible: true, height: 250, activeTab: 'notes' } });
  const serialized = JSON.stringify(Layout.toJSON());
  Layout._reset();
  const before = Layout.get();
  const ok = Layout.fromJSON(JSON.parse(serialized));
  assert.equal(ok, true);
  const after = Layout.get();
  assert.notDeepEqual(before, after);
  assert.equal(after.sidebar.visible, false);
  assert.equal(after.sidebar.width, 350);
  assert.equal(after.sidebar.activePanel, 'outline');
  assert.equal(after.studioPanel.activeTab, 'notes');
});

test('Slice 2: fromJSON rejects non-object input — null, primitives, arrays', () => {
  const { Layout } = boot();
  assert.equal(Layout.fromJSON(null), false);
  assert.equal(Layout.fromJSON(undefined), false);
  assert.equal(Layout.fromJSON('string'), false);
  assert.equal(Layout.fromJSON(42), false);
  assert.equal(Layout.fromJSON([]), false);
});

test('Slice 2: fromJSON rejects malformed zones (primitive where object expected)', () => {
  const { Layout } = boot();
  assert.equal(Layout.fromJSON({ sidebar: 'broken' }), false);
  assert.equal(Layout.fromJSON({ studioPanel: 42 }), false);
  assert.equal(Layout.fromJSON({ titleBar: null }), false);
});

test('Slice 2: fromJSON ignores unknown zones (forward-compat)', () => {
  const { Layout } = boot();
  const ok = Layout.fromJSON({
    sidebar: { visible: false },
    futureZone: { someField: 'value' }
  });
  assert.equal(ok, true);
  // Known zone updated, unknown zone neither rejected nor surfaced in get().
  assert.equal(Layout.get().sidebar.visible, false);
  // futureZone may or may not be stored — what matters is no throw, no false return.
});

test('Slice 2: fromJSON notifies subscribers exactly ONCE for a multi-zone load', () => {
  const { Layout } = boot();
  let count = 0;
  Layout.subscribe(function() { count += 1; });
  Layout.fromJSON({
    sidebar:     { visible: false, width: 320, activePanel: 'outline' },
    studioPanel: { visible: true,  height: 250, activeTab: 'flags' }
  });
  assert.equal(count, 1, 'multi-zone fromJSON fires one consolidated notification');
});
