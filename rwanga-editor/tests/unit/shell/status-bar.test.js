// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 1 — Rga.Shell.StatusBar unit tests (plan §3.4, §8.2).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><footer id="status-bar"></footer><div id="host"></div></body></html>',
    { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.window.Rga = {};

  const stub = {
    activeDoc: opts.activeDoc || null,
    activeView: opts.activeView || null,
    viewMode: opts.viewMode || 'flow',
    viewListeners: new Set(),
    activatedTo: null,
    index: opts.index || { scenes: [], pages: [] },
    pageMap: opts.pageMap || [],
    outline: opts.outline || null
  };
  global.window.Rga.TabManager = {
    activeDoc: function() { return stub.activeDoc; },
    _editorView: function() { return stub.activeView; }
  };
  global.window.Rga.ViewManager = {
    current: function() { return stub.viewMode; },
    onChange: function(fn) { stub.viewListeners.add(fn); return function() { stub.viewListeners.delete(fn); }; },
    activate: function(id) { stub.activatedTo = id; stub.viewMode = id; stub.viewListeners.forEach(function(fn) { fn(); }); }
  };
  // Bundle 1 §A — the dropdown routes through Rga.ViewMode.set, NOT
  // ViewManager.activate. This stub records the .set call and mirrors
  // it to ViewManager so the existing onChange-based status-bar
  // refresh still fires.
  global.window.Rga.ViewMode = {
    setCalledWith: null,
    set: function(mode) {
      this.setCalledWith = mode;
      stub.activatedTo = mode;
      stub.viewMode = mode;
      stub.viewListeners.forEach(function(fn) { fn(); });
    },
    get: function() { return stub.viewMode; }
  };
  global.window.Rga.Nav = {
    getIndex: function() { return stub.index; },
    getPageMap: function() { return stub.pageMap; },
    getOutline: function() { return stub.outline || { statistics: { words: 0, sceneCount: 0, pages: 0 } }; }
  };

  // Studio Shell Recovery §F: StatusBar now also reads Rga.Theme
  // (existing SSOT) for the right-side theme instrument. Provide a
  // minimal stub the test loader sees BEFORE status-bar.js loads.
  global.window.Rga.Theme = global.window.Rga.Theme || {
    current: opts.theme || 'dark',
    _listeners: [],
    toggle: function() {
      this.current = this.current === 'dark' ? 'light' : 'dark';
      this._listeners.forEach(function(fn) { try { fn(); } catch (_) {} });
    },
    onChange: function(fn) {
      this._listeners.push(fn);
      var self = this;
      return function() {
        var i = self._listeners.indexOf(fn);
        if (i >= 0) self._listeners.splice(i, 1);
      };
    }
  };

  ['../../../renderer/js/shell/layout.js',
   '../../../renderer/js/shell/sidebar.js',
   '../../../renderer/js/shell/script-session.js',
   // Slice 5 §A: StatusBar reads wordCount / currentBlockType via
   // ScriptMetrics (delegating layer over ScriptSession). Must load
   // before status-bar.js so the consumer can find it.
   '../../../renderer/js/shell/script-metrics.js',
   '../../../renderer/js/shell/status-bar.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  Rga.ScriptSession._reset();
  Rga.Shell.StatusBar._reset();
  Rga.ScriptSession.init();
  Rga.Shell.StatusBar.init(document.getElementById('status-bar'));
  return { Rga, stub, status: document.getElementById('status-bar') };
}

function viewWithCursor(pos) {
  return { state: { selection: { from: pos, to: pos, empty: true } } };
}

test('init creates 8 segment elements (Studio Shell Recovery §F added theme instrument); no-active-script state', () => {
  const { status } = boot();
  const segments = status.querySelectorAll('.rga-shell-status-segment');
  // Studio Shell Recovery §F: 7 existing segments + 1 new theme
  // instrument that reads Rga.Theme.current (existing SSOT).
  assert.equal(segments.length, 8);
  assert.equal(status.querySelector('[data-segment="scene"]').textContent, 'Scene: —');
  assert.equal(status.querySelector('[data-segment="page"]').textContent, 'Page: —/—');
  assert.equal(status.querySelector('[data-segment="blockType"]').textContent, '—');
  // No active view → wordCount is null → segment shows "— words"
  // (open-script-with-zero-words shows "0 words"; see separate test).
  assert.equal(status.querySelector('[data-segment="wordCount"]').textContent, '— words');
  // Bundle 1 §A: viewMode segment is now a labelled <select> dropdown,
  // not a plain text node. Check select.value (semantic state) and the
  // prefix span (the visible "View:" label), not the noisy textContent
  // which concatenates every option.
  const vmSegment = status.querySelector('[data-segment="viewMode"]');
  assert.ok(vmSegment.querySelector('.rga-shell-status-viewmode-prefix'),
    'viewMode segment must include the View: prefix label');
  const vmSelect = vmSegment.querySelector('select.rga-shell-status-viewmode-select');
  assert.ok(vmSelect, 'viewMode segment must include a <select>');
  assert.equal(vmSelect.value, 'flow');
  assert.equal(status.querySelector('[data-segment="language"]').textContent, '—');
  assert.equal(status.querySelector('[data-segment="offline"]').textContent, 'Local');
  // Theme defaults to 'Dark' (stub default in the boot helper).
  assert.equal(status.querySelector('[data-segment="theme"]').textContent, 'Dark');
});

test('Slice 2: wordCount segment shows "0 words" when script is open but empty', () => {
  const { status } = boot({
    outline: { statistics: { words: 0, sceneCount: 0, pages: 0 } },
    activeView: { state: { selection: { from: 0, to: 0, empty: true, $from: { parent: { type: { name: 'action' } } } } } }
  });
  assert.equal(status.querySelector('[data-segment="wordCount"]').textContent, '0 words');
});

test('Studio Shell Recovery §F: segments are grouped left / center / right (replaces slice-2 flat order)', () => {
  const { status } = boot();
  // Three section wrappers exist.
  const left   = status.querySelector('.rga-shell-statusbar-left');
  const center = status.querySelector('.rga-shell-statusbar-center');
  const right  = status.querySelector('.rga-shell-statusbar-right');
  assert.ok(left && center && right, 'all three statusbar sections must exist');
  function ids(section) {
    return Array.from(section.querySelectorAll('.rga-shell-status-segment'))
                .map(function(el) { return el.getAttribute('data-segment'); });
  }
  // Left:   sync/local (offline) → scene position (scene)
  // Center: current context (blockType) → page position (page)
  // Right:  words → view mode → language → theme
  assert.deepEqual(ids(left),   ['offline', 'scene'],
    'left section: sync/local state then scene position');
  assert.deepEqual(ids(center), ['blockType', 'page'],
    'center section: current context then page position');
  assert.deepEqual(ids(right),  ['wordCount', 'viewMode', 'language', 'theme'],
    'right section: words / view mode / language / theme');
});

test('Bundle 1 §A: viewMode select reflects Rga.ViewManager.current() via ScriptSession', () => {
  const { status } = boot({ viewMode: 'draft' });
  const sel = status.querySelector('select.rga-shell-status-viewmode-select');
  assert.equal(sel.value, 'draft');
});

test('Bundle 1 §A: viewMode select updates when Rga.ViewManager.onChange fires (via ScriptSession)', () => {
  const { Rga, status } = boot();
  const sel = status.querySelector('select.rga-shell-status-viewmode-select');
  assert.equal(sel.value, 'flow');
  Rga.ViewManager.activate('print');
  assert.equal(sel.value, 'print');
});

test('D.1/SP-07: when ViewManager reports printPreview, the live option holds the value (display says "Print Preview")', () => {
  const { Rga, status } = boot();
  Rga.ViewManager.activate('printPreview');
  const sel = status.querySelector('select.rga-shell-status-viewmode-select');
  assert.equal(sel.value, 'printPreview', 'select.value must reflect printPreview');
  const ppOption = Array.from(sel.options).find(function(o) { return o.value === 'printPreview'; });
  assert.ok(ppOption, 'printPreview option must exist');
  // D.1 — printPreview is now a live, pickable option (not disabled/hidden).
  assert.equal(ppOption.disabled, false, 'printPreview option must not be disabled (D.1 makes it a live option)');
  assert.equal(ppOption.hidden, false, 'printPreview option must not be hidden (D.1 makes it a live option)');
});

test('Bundle 1 §A: changing the viewMode select calls Rga.ViewMode.set (NOT ViewManager.activate directly)', () => {
  const { Rga, status, stub } = boot();
  const sel = status.querySelector('select.rga-shell-status-viewmode-select');
  sel.value = 'draft';
  sel.dispatchEvent(new global.window.Event('change'));
  assert.equal(Rga.ViewMode.setCalledWith, 'draft',
    'change event must route through Rga.ViewMode.set (the SSOT) — no direct ViewManager.activate');
  // And the upstream effect is observable (mode flipped to draft).
  assert.equal(stub.viewMode, 'draft');
});

test('D.1/SP-07: dropdown exposes four live options: Flow / Draft / Print / Print Preview', () => {
  const { status } = boot();
  const sel = status.querySelector('select.rga-shell-status-viewmode-select');
  // D.1 — printPreview is now a live option (not disabled/hidden).
  const live = Array.from(sel.options).filter(function(o) {
    return !o.disabled && !o.hidden;
  });
  assert.deepEqual(live.map(function(o) { return o.value; }), ['flow', 'draft', 'print', 'printPreview']);
  assert.deepEqual(live.map(function(o) { return o.textContent; }), ['Flow', 'Draft', 'Print', 'Print Preview']);
});

test('scene segment renders "Scene: S{N}" where N is the current scene\'s sceneNumber', () => {
  const { status } = boot({
    activeView: viewWithCursor(15),
    index: {
      scenes: [
        { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
        { nodeId: 'b', sceneNumber: 12, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 }
      ],
      pages: []
    }
  });
  assert.equal(status.querySelector('[data-segment="scene"]').textContent, 'Scene: S12');
});

test('scene segment renders "Scene: —" when no script is open', () => {
  const { status } = boot();
  assert.equal(status.querySelector('[data-segment="scene"]').textContent, 'Scene: —');
});

test('page segment renders "Page: {N}/{M}" when scene maps to a page', () => {
  const { status } = boot({
    activeView: viewWithCursor(15),
    index: {
      scenes: [{ nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 10, pmEndPos: 30 }],
      pages: [
        { pageNumber: 1, sceneIds: ['a'] },
        { pageNumber: 2, sceneIds: [] }
      ]
    },
    pageMap: [{ pageNumber: 1 }, { pageNumber: 2 }]
  });
  assert.equal(status.querySelector('[data-segment="page"]').textContent, 'Page: 1/2');
});

test('page segment renders "Page: —/—" when no script is open', () => {
  const { status } = boot();
  assert.equal(status.querySelector('[data-segment="page"]').textContent, 'Page: —/—');
});

test('language segment shows the active script\'s screenplayProfile.language', () => {
  const { status } = boot({
    activeDoc: { docId: 'd', displayName: 'X.rga', dirty: false,
                 metadata: { screenplayProfile: { language: 'ku' } } }
  });
  // Language only refreshes via tabActivated.
  document.dispatchEvent(new CustomEvent('editor.tabActivated'));
  assert.equal(status.querySelector('[data-segment="language"]').textContent, 'ku');
});

test('offlineIndicator is hard-coded "Local" in Slice 1', () => {
  const { status } = boot();
  assert.equal(status.querySelector('[data-segment="offline"]').textContent, 'Local');
});

test('selection change refreshes scene + page segments without changing others', () => {
  const { status, stub } = boot({
    activeView: viewWithCursor(5),
    index: {
      scenes: [
        { nodeId: 'a', sceneNumber: 1, headingDisplay: 'A', pmPos: 0,  pmEndPos: 10 },
        { nodeId: 'b', sceneNumber: 2, headingDisplay: 'B', pmPos: 10, pmEndPos: 30 }
      ],
      pages: [{ pageNumber: 1, sceneIds: ['a'] }, { pageNumber: 2, sceneIds: ['b'] }]
    },
    pageMap: [{ pageNumber: 1 }, { pageNumber: 2 }]
  });
  assert.equal(status.querySelector('[data-segment="scene"]').textContent, 'Scene: S1');
  assert.equal(status.querySelector('[data-segment="page"]').textContent, 'Page: 1/2');
  // Move cursor.
  stub.activeView.state.selection.from = 20;
  stub.activeView.state.selection.to = 20;
  document.dispatchEvent(new Event('selectionchange'));
  assert.equal(status.querySelector('[data-segment="scene"]').textContent, 'Scene: S2');
  assert.equal(status.querySelector('[data-segment="page"]').textContent, 'Page: 2/2');
});

test('editor.tabActivated event triggers refresh of the language segment', () => {
  const { stub, status } = boot();
  // Initial: no active doc → '—'.
  assert.equal(status.querySelector('[data-segment="language"]').textContent, '—');
  stub.activeDoc = { docId: 'd', displayName: 'X.rga', dirty: false,
                     metadata: { screenplayProfile: { language: 'ar' } } };
  document.dispatchEvent(new CustomEvent('editor.tabActivated'));
  assert.equal(status.querySelector('[data-segment="language"]').textContent, 'ar');
});

// ----------------------------------------------------------------
// Slice 2 — wordCount + blockType segments
// ----------------------------------------------------------------

test('Slice 2: wordCount segment formats as "N words" with thousands separator', () => {
  const { status } = boot({
    outline: { statistics: { words: 3420, sceneCount: 1, pages: 1 } },
    activeView: { state: { selection: { from: 0, to: 0, empty: true, $from: { parent: { type: { name: 'action' } } } } } }
  });
  assert.equal(status.querySelector('[data-segment="wordCount"]').textContent, '3,420 words');
});

test('Slice 2: wordCount segment formats "1 word" (singular)', () => {
  const { status } = boot({
    outline: { statistics: { words: 1, sceneCount: 1, pages: 1 } },
    activeView: { state: { selection: { from: 0, to: 0, empty: true, $from: { parent: { type: { name: 'action' } } } } } }
  });
  assert.equal(status.querySelector('[data-segment="wordCount"]').textContent, '1 word');
});

test('Slice 2: blockType segment title-cases the structural block name', () => {
  const { status } = boot({
    outline: { statistics: { words: 0, sceneCount: 0, pages: 0 } },
    activeView: { state: { selection: { from: 0, to: 0, empty: true, $from: { parent: { type: { name: 'dialogue' } } } } } }
  });
  assert.equal(status.querySelector('[data-segment="blockType"]').textContent, 'Dialogue');
});

test('Slice 2: blockType "sceneHeading" → "Scene Heading" (two words)', () => {
  const { status } = boot({
    outline: { statistics: { words: 0, sceneCount: 0, pages: 0 } },
    activeView: { state: { selection: { from: 0, to: 0, empty: true, $from: { parent: { type: { name: 'sceneHeading' } } } } } }
  });
  assert.equal(status.querySelector('[data-segment="blockType"]').textContent, 'Scene Heading');
});
