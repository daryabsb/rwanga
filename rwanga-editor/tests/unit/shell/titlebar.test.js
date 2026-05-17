// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 1 — Rga.Shell.TitleBar unit tests (plan §4.2, §8.2).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot(opts) {
  opts = opts || {};
  // Studio Shell Recovery — Workstream A2: three-zone titlebar fixture.
  // Left zone (#rga-shell-titlebar-app) statically owns "Rwanga"; the
  // center zone (#rga-shell-titlebar-title) is what Rga.Shell.TitleBar
  // populates with script content.
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
    '<header id="rga-shell-titlebar">' +
      '<div id="rga-shell-titlebar-app">Rwanga</div>' +
      '<div id="rga-shell-titlebar-title"></div>' +
      '<div id="rga-shell-titlebar-actions"></div>' +
    '</header>' +
    '<div id="host"></div></body></html>',
    { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.window.Rga = {};

  const stub = {
    activeDoc: opts.activeDoc || null
  };
  global.window.Rga.TabManager = {
    activeDoc: function() { return stub.activeDoc; },
    _editorView: function() { return null; }
  };
  global.window.Rga.ViewManager = { current: function() { return 'flow'; }, onChange: function() { return function() {}; } };
  global.window.Rga.Nav = { getIndex: function() { return { scenes: [], pages: [] }; }, getPageMap: function() { return []; } };

  ['../../../renderer/js/shell/layout.js',
   '../../../renderer/js/shell/sidebar.js',
   '../../../renderer/js/shell/script-session.js',
   '../../../renderer/js/shell/title-bar.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  Rga.ScriptSession._reset();
  Rga.Shell.TitleBar._reset();
  Rga.ScriptSession.init();
  Rga.Shell.TitleBar.init(document.getElementById('rga-shell-titlebar-title'));
  return { Rga, stub, titleEl: document.getElementById('rga-shell-titlebar-title') };
}

test('A2: center zone is empty when no script is open; left zone is "Rwanga"; document.title is "Rwanga"', () => {
  const { titleEl } = boot();
  // A2: app identity lives in the LEFT zone (static markup); the
  // center zone is empty until a script opens.
  assert.equal(titleEl.textContent, '');
  assert.equal(document.getElementById('rga-shell-titlebar-app').textContent, 'Rwanga');
  // OS window title (document.title) keeps its full composite form for the taskbar.
  assert.equal(document.title, 'Rwanga');
});

test('A2: center zone shows script name when a clean script is active; document.title composes "Rwanga • {displayName}"', () => {
  const { titleEl } = boot({
    activeDoc: { docId: 'd', displayName: 'The Last Light', dirty: false }
  });
  // Center zone holds script name only (no "Rwanga • " prefix here —
  // the left zone owns app identity).
  assert.equal(titleEl.textContent, 'The Last Light');
  assert.ok(titleEl.querySelector('.rga-shell-titlebar-script-name'));
  assert.equal(titleEl.querySelector('.rga-shell-titlebar-script-name').textContent, 'The Last Light');
  assert.equal(titleEl.querySelector('.rga-shell-titlebar-dirty'), null);
  // Left zone unchanged.
  assert.equal(document.getElementById('rga-shell-titlebar-app').textContent, 'Rwanga');
  // OS title composes the full string for the taskbar.
  assert.equal(document.title, 'Rwanga • The Last Light');
});

test('title text is "Rwanga • {displayName} *" when the active script is dirty', () => {
  const { titleEl } = boot({
    activeDoc: { docId: 'd', displayName: 'The Last Light', dirty: true }
  });
  assert.equal(document.title, 'Rwanga • The Last Light *');
  const dirty = titleEl.querySelector('.rga-shell-titlebar-dirty');
  assert.ok(dirty);
  assert.equal(dirty.textContent, '*');
  assert.equal(dirty.getAttribute('aria-label'), 'Unsaved changes');
});

test('dirty asterisk disappears after dirty flips false (via editor.docDirtyChanged event)', () => {
  const { Rga, stub, titleEl } = boot({
    activeDoc: { docId: 'd', displayName: 'X.rga', dirty: true }
  });
  assert.ok(titleEl.querySelector('.rga-shell-titlebar-dirty'));
  // Clear dirty + notify.
  stub.activeDoc.dirty = false;
  document.dispatchEvent(new CustomEvent('editor.docDirtyChanged'));
  assert.equal(titleEl.querySelector('.rga-shell-titlebar-dirty'), null);
  assert.equal(document.title, 'Rwanga • X.rga');
});

test('document.title mirrors the in-app title bar text', () => {
  const { stub } = boot();
  // Open a doc.
  stub.activeDoc = { docId: 'd', displayName: 'Sample.rga', dirty: false };
  document.dispatchEvent(new CustomEvent('editor.tabActivated'));
  assert.equal(document.title, 'Rwanga • Sample.rga');
});

test('title bar refresh is filtered — non-activeScript snapshot changes do not re-render', () => {
  const { Rga, titleEl } = boot({
    activeDoc: { docId: 'd', displayName: 'A.rga', dirty: false }
  });
  const html1 = titleEl.innerHTML;
  // Force a snapshot change unrelated to activeScript: change view mode.
  Rga.ViewManager.current = function() { return 'draft'; };
  Rga.ScriptSession._recompute();
  const html2 = titleEl.innerHTML;
  assert.equal(html1, html2, 'no re-render when activeScript unchanged');
});
