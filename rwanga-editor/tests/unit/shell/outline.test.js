// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 2 — Rga.Shell.Outline unit tests (plan §3.3, §8.1).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="host"></div></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.window.Rga = {};

  // Default to a minimal view so Rga.Nav.getOutline is reached. Tests that
  // explicitly want "no active script" pass `noView: true` (no view returned).
  const defaultView = { state: { selection: { from: 0, to: 0, empty: true, $from: { parent: { type: { name: 'action' } } } } } };
  const stub = {
    activeDoc: null,
    activeView: opts.noView ? null : (opts.activeView || defaultView),
    viewMode: 'flow',
    viewListeners: new Set(),
    outline: opts.outline || { title: '', statistics: { sceneCount: 0, pages: 0, words: 0, actionWords: 0, dialogueWords: 0 }, scenes: [], characters: [] },
    index: opts.index || { scenes: [], pages: [] },
    pageMap: opts.pageMap || [],
    sceneNavCalls: { scroll: [], focus: [] },
    sidebarActivations: []
  };
  global.window.Rga.TabManager = { activeDoc: function() { return stub.activeDoc; }, _editorView: function() { return stub.activeView; } };
  global.window.Rga.ViewManager = { current: function() { return stub.viewMode; }, onChange: function(fn) { stub.viewListeners.add(fn); return function() {}; } };
  global.window.Rga.Nav = {
    getIndex: function() { return stub.index; },
    getPageMap: function() { return stub.pageMap; },
    getOutline: function() { return stub.outline; }
  };

  ['../../../renderer/js/shell/layout.js',
   '../../../renderer/js/shell/sidebar.js',
   '../../../renderer/js/shell/script-session.js',
   '../../../renderer/js/shell/panels/scene-navigator.js',
   '../../../renderer/js/shell/panels/outline.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  Rga.ScriptSession._reset();
  Rga.Shell.SceneNavigator._reset();
  Rga.Shell.Sidebar.setHost(document.getElementById('host'));
  Rga.Shell.Sidebar.registerPanel(Rga.Shell.SceneNavigator._controller);
  Rga.Shell.Sidebar.registerPanel(Rga.Shell.Outline._controller);
  // Spy on Scene Navigator + Sidebar.activate
  const origScroll = Rga.Shell.SceneNavigator.scrollToScene;
  const origFocus  = Rga.Shell.SceneNavigator.focusRow;
  const origActivate = Rga.Shell.Sidebar.activate;
  Rga.Shell.SceneNavigator.scrollToScene = function(id) { stub.sceneNavCalls.scroll.push(id); return true; };
  Rga.Shell.SceneNavigator.focusRow = function(id) { stub.sceneNavCalls.focus.push(id); return true; };
  Rga.Shell.Sidebar.activate = function(id) { stub.sidebarActivations.push(id); return origActivate.call(this, id); };
  Rga.ScriptSession.init();
  return { Rga, stub, host: document.getElementById('host') };
}

function activate(Rga) {
  Rga.Shell.Sidebar.activate('outline');
}

// ----------------------------------------------------------------
// Section structure
// ----------------------------------------------------------------

test('renders 4 sections in plan §3.3 order: title, progress, scenes, characters', () => {
  const { Rga, host } = boot();
  activate(Rga);
  const sections = host.querySelectorAll('.rga-shell-outline-section');
  assert.equal(sections.length, 4);
  const ids = Array.from(sections).map(function(s) { return s.getAttribute('data-section'); });
  assert.deepEqual(ids, ['title', 'progress', 'scenes', 'characters']);
});

test('title section renders title text + Scenes/Pages line + word-count breakdown', () => {
  const { Rga, host } = boot({
    outline: {
      title: 'The Last Light',
      statistics: { sceneCount: 8, pages: 12, words: 3420, actionWords: 1320, dialogueWords: 1980 },
      scenes: [], characters: []
    }
  });
  activate(Rga);
  const title = host.querySelector('[data-section="title"]');
  assert.match(title.querySelector('.rga-shell-outline-section-header').textContent, /The Last Light/);
  assert.match(title.querySelector('.rga-shell-outline-meta').textContent, /Scenes: 8/);
  assert.match(title.querySelector('.rga-shell-outline-meta').textContent, /Pages: 12/);
  assert.match(title.querySelector('.rga-shell-outline-words').textContent, /3,420 words/);
  assert.match(title.querySelector('.rga-shell-outline-words').textContent, /1,320 action/);
  assert.match(title.querySelector('.rga-shell-outline-words').textContent, /1,980 dialogue/);
});

// ----------------------------------------------------------------
// Story Progress (the writer-orientation surface)
// ----------------------------------------------------------------

test('Story Progress: Current Scene format "S{N} of {M}" when active', () => {
  const { Rga, stub, host } = boot({
    activeView: { state: { selection: { from: 15, to: 15, empty: true, $from: { parent: { type: { name: 'action' } } } } } },
    outline: {
      title: 'X',
      statistics: { sceneCount: 5, pages: 8, words: 0, actionWords: 0, dialogueWords: 0 },
      scenes: [{ nodeId: 'a', sceneNumber: 3, headingDisplay: 'A' }],
      characters: []
    },
    index: {
      scenes: [{ nodeId: 'a', sceneNumber: 3, headingDisplay: 'A', pmPos: 10, pmEndPos: 30 }],
      pages: []
    }
  });
  Rga.ScriptSession._recompute();
  activate(Rga);
  const row = host.querySelector('.rga-shell-outline-progress-currentScene .rga-shell-outline-progress-value');
  assert.equal(row.textContent, 'S3 of 5');
});

test('Story Progress: Current Page format "{N} of {M}" when active', () => {
  const { Rga, host } = boot({
    activeView: { state: { selection: { from: 15, to: 15, empty: true, $from: { parent: { type: { name: 'action' } } } } } },
    outline: {
      title: 'X',
      statistics: { sceneCount: 1, pages: 12, words: 0, actionWords: 0, dialogueWords: 0 },
      scenes: [{ nodeId: 'a', sceneNumber: 1, headingDisplay: 'A' }],
      characters: []
    },
    index: {
      scenes: [{ nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 10, pmEndPos: 30 }],
      pages: [{ pageNumber: 5, sceneIds: ['a'] }]
    },
    pageMap: [{ pageNumber: 1 }, { pageNumber: 2 }, { pageNumber: 3 }, { pageNumber: 4 }, { pageNumber: 5 }, { pageNumber: 6 }, { pageNumber: 7 }, { pageNumber: 8 }, { pageNumber: 9 }, { pageNumber: 10 }, { pageNumber: 11 }, { pageNumber: 12 }]
  });
  Rga.ScriptSession._recompute();
  activate(Rga);
  const row = host.querySelector('.rga-shell-outline-progress-currentPage .rga-shell-outline-progress-value');
  assert.equal(row.textContent, '5 of 12');
});

test('Story Progress: empty-state "— of —" when no active script', () => {
  const { Rga, host } = boot({ noView: true });
  activate(Rga);
  const sceneRow = host.querySelector('.rga-shell-outline-progress-currentScene .rga-shell-outline-progress-value');
  const pageRow = host.querySelector('.rga-shell-outline-progress-currentPage .rga-shell-outline-progress-value');
  assert.equal(sceneRow.textContent, '— of —');
  assert.equal(pageRow.textContent, '— of —');
});

test('Story Progress: Act Progress and Story Beat placeholders render "—"', () => {
  const { Rga, host } = boot({ noView: true });
  activate(Rga);
  const act = host.querySelector('.rga-shell-outline-progress-actProgress .rga-shell-outline-progress-value');
  const beat = host.querySelector('.rga-shell-outline-progress-storyBeat .rga-shell-outline-progress-value');
  assert.equal(act.textContent, '—');
  assert.equal(beat.textContent, '—');
});

test('Story Progress: clicking the Current Scene value calls SceneNavigator + Sidebar.activate("sceneNavigator")', () => {
  const { Rga, stub, host } = boot({
    activeView: { state: { selection: { from: 15, to: 15, empty: true, $from: { parent: { type: { name: 'action' } } } } } },
    outline: {
      title: 'X',
      statistics: { sceneCount: 1, pages: 1, words: 0, actionWords: 0, dialogueWords: 0 },
      scenes: [{ nodeId: 'sc-jump', sceneNumber: 1, headingDisplay: 'A' }],
      characters: []
    },
    index: {
      scenes: [{ nodeId: 'sc-jump', sceneNumber: 1, headingDisplay: 'A', pmPos: 10, pmEndPos: 30 }],
      pages: []
    }
  });
  Rga.ScriptSession._recompute();
  activate(Rga);
  const value = host.querySelector('.rga-shell-outline-progress-currentScene .rga-shell-outline-progress-value');
  value.click();
  assert.deepEqual(stub.sceneNavCalls.scroll, ['sc-jump']);
  assert.deepEqual(stub.sceneNavCalls.focus, ['sc-jump']);
  assert.ok(stub.sidebarActivations.indexOf('sceneNavigator') >= 0);
});

// ----------------------------------------------------------------
// Scenes section (simple)
// ----------------------------------------------------------------

test('Scenes section renders numbered scene rows (number + heading)', () => {
  const { Rga, host } = boot({
    outline: {
      title: 'X', statistics: { sceneCount: 2, pages: 1, words: 0, actionWords: 0, dialogueWords: 0 },
      scenes: [
        { nodeId: 'a', sceneNumber: 1, headingDisplay: 'INT. ROOM — DAY' },
        { nodeId: 'b', sceneNumber: 2, headingDisplay: 'EXT. STREET — NIGHT' }
      ],
      characters: []
    }
  });
  activate(Rga);
  const rows = host.querySelectorAll('.rga-shell-outline-scene-row');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].querySelector('.rga-shell-outline-scene-num').textContent, '1.');
  assert.match(rows[0].querySelector('.rga-shell-outline-scene-head').textContent, /INT\. ROOM/);
});

test('Scenes section click routes through SceneNavigator.scrollToScene + .focusRow + Sidebar.activate', () => {
  const { Rga, stub, host } = boot({
    outline: {
      title: 'X', statistics: { sceneCount: 1, pages: 1, words: 0, actionWords: 0, dialogueWords: 0 },
      scenes: [{ nodeId: 'sc-x', sceneNumber: 1, headingDisplay: 'A' }],
      characters: []
    }
  });
  activate(Rga);
  host.querySelector('[data-scene-node-id="sc-x"]').click();
  assert.deepEqual(stub.sceneNavCalls.scroll, ['sc-x']);
  assert.deepEqual(stub.sceneNavCalls.focus, ['sc-x']);
  assert.ok(stub.sidebarActivations.indexOf('sceneNavigator') >= 0);
});

// ----------------------------------------------------------------
// Characters section
// ----------------------------------------------------------------

test('Characters section renders name + appearance count rows; collapsed by default', () => {
  const { Rga, host } = boot({
    outline: {
      title: 'X', statistics: { sceneCount: 0, pages: 0, words: 0, actionWords: 0, dialogueWords: 0 },
      scenes: [],
      characters: [
        { nodeId: 'nali', name: 'NALI', appearances: 4 },
        { nodeId: 'alex', name: 'ALEX', appearances: 8 }
      ]
    }
  });
  activate(Rga);
  const charSection = host.querySelector('[data-section="characters"]');
  // Collapsed by default → no body rendered.
  assert.equal(charSection.querySelectorAll('.rga-shell-outline-character-row').length, 0);
  // Expand by clicking header.
  charSection.querySelector('.rga-shell-outline-section-header').click();
  const rows = host.querySelectorAll('.rga-shell-outline-character-row');
  assert.equal(rows.length, 2);
  assert.match(rows[0].querySelector('.rga-shell-outline-character-name').textContent, /NALI/);
  assert.equal(rows[0].querySelector('.rga-shell-outline-character-count').textContent, '(4 scenes)');
});

// ----------------------------------------------------------------
// Refresh on ScriptSession change
// ----------------------------------------------------------------

test('outline re-renders when ScriptSession notifies of a change', () => {
  const { Rga, stub, host } = boot();
  activate(Rga);
  assert.equal(host.querySelector('.rga-shell-outline-progress-currentScene .rga-shell-outline-progress-value').textContent, '— of —');
  // Set state + force recompute.
  stub.activeView = { state: { selection: { from: 15, to: 15, empty: true, $from: { parent: { type: { name: 'action' } } } } } };
  stub.outline = { title: 'X', statistics: { sceneCount: 3, pages: 1, words: 0, actionWords: 0, dialogueWords: 0 }, scenes: [{ nodeId: 'a', sceneNumber: 2, headingDisplay: 'A' }], characters: [] };
  stub.index = { scenes: [{ nodeId: 'a', sceneNumber: 2, headingDisplay: 'A', pmPos: 10, pmEndPos: 30 }], pages: [] };
  document.dispatchEvent(new Event('selectionchange'));
  // After recompute, snapshot has currentScene; the outline subscribed and re-rendered.
  assert.equal(host.querySelector('.rga-shell-outline-progress-currentScene .rga-shell-outline-progress-value').textContent, 'S2 of 3');
});

// ----------------------------------------------------------------
// "No fake progress" rule — observable invariants
// ----------------------------------------------------------------

test('no-fake-progress invariant: no "%" character appears in any rendered Story Progress text', () => {
  const { Rga, host } = boot({
    activeView: { state: { selection: { from: 15, to: 15, empty: true, $from: { parent: { type: { name: 'action' } } } } } },
    outline: { title: 'X', statistics: { sceneCount: 5, pages: 10, words: 0, actionWords: 0, dialogueWords: 0 }, scenes: [{ nodeId: 'a', sceneNumber: 3, headingDisplay: 'A' }], characters: [] },
    index: { scenes: [{ nodeId: 'a', sceneNumber: 3, headingDisplay: 'A', pmPos: 10, pmEndPos: 30 }], pages: [{ pageNumber: 5, sceneIds: ['a'] }] }
  });
  Rga.ScriptSession._recompute();
  activate(Rga);
  const progress = host.querySelector('[data-section="progress"]');
  assert.equal(progress.textContent.indexOf('%'), -1, 'no percent sign anywhere in Story Progress text');
});

test('no-fake-progress invariant: reserved placeholders render only "—" — no fake value, no fake label', () => {
  const { Rga, host } = boot();
  activate(Rga);
  const act = host.querySelector('.rga-shell-outline-progress-actProgress .rga-shell-outline-progress-value');
  const beat = host.querySelector('.rga-shell-outline-progress-storyBeat .rga-shell-outline-progress-value');
  assert.equal(act.textContent, '—');
  assert.equal(beat.textContent, '—');
});

// ----------------------------------------------------------------
// Section collapse toggle
// ----------------------------------------------------------------

test('clicking a section header toggles its collapsed state', () => {
  const { Rga, host } = boot({
    outline: { title: 'X', statistics: { sceneCount: 1, pages: 1, words: 0, actionWords: 0, dialogueWords: 0 }, scenes: [{ nodeId: 'a', sceneNumber: 1, headingDisplay: 'A' }], characters: [] }
  });
  activate(Rga);
  // Scenes section initially expanded → has a list.
  let scenesSec = host.querySelector('[data-section="scenes"]');
  assert.ok(scenesSec.querySelector('.rga-shell-outline-scenes'));
  // Click to collapse.
  scenesSec.querySelector('.rga-shell-outline-section-header').click();
  scenesSec = host.querySelector('[data-section="scenes"]');
  assert.equal(scenesSec.querySelector('.rga-shell-outline-scenes'), null);
});
