// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 1 — Rga.Shell.TitleBar unit tests (plan §4.2, §8.2).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
    '<header id="rga-shell-titlebar"><div id="rga-shell-titlebar-title">Rwanga</div></header>' +
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

test('title text is "Rwanga" when no script is open', () => {
  const { titleEl } = boot();
  assert.equal(titleEl.textContent, 'Rwanga');
  assert.equal(document.title, 'Rwanga');
});

test('title text is "Rwanga • {displayName}" when a clean script is active', () => {
  const { titleEl } = boot({
    activeDoc: { docId: 'd', displayName: 'The Last Light', dirty: false }
  });
  assert.equal(titleEl.textContent, 'Rwanga•The Last Light');  // text nodes concatenated; visual gap via CSS gap
  assert.equal(document.title, 'Rwanga • The Last Light');
  assert.ok(titleEl.querySelector('.rga-shell-titlebar-sep'));
  assert.ok(titleEl.querySelector('.rga-shell-titlebar-script-name'));
  assert.equal(titleEl.querySelector('.rga-shell-titlebar-script-name').textContent, 'The Last Light');
  assert.equal(titleEl.querySelector('.rga-shell-titlebar-dirty'), null);
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
