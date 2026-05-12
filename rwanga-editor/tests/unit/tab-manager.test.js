// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="tab-bar"><button id="tab-new"></button></div><div id="editor-area"><div id="editor-container"><div id="gutter"></div><div id="editor" contenteditable="true"></div></div></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;

require('../../renderer/js/constants.js');
require('../../renderer/js/doc.js');
require('../../renderer/js/tab-manager.js');

const { TabManager } = global.window.Rga;

test('TabManager.openDocument adds a tab and makes it active', () => {
  TabManager.init();
  const doc = global.window.Rga.Doc.create();
  const tab = TabManager.openDocument(doc);
  assert.equal(TabManager.activeTab().id, tab.id);
  assert.equal(TabManager.activeDoc().docId, doc.docId);
});

test('TabManager.openDocument with multiple docs keeps them isolated', () => {
  document.getElementById('tab-bar').innerHTML = '<button id="tab-new"></button>';
  TabManager.init();
  const a = global.window.Rga.Doc.create();
  const b = global.window.Rga.Doc.create();
  TabManager.openDocument(a);
  TabManager.openDocument(b);
  assert.equal(TabManager.activeDoc().docId, b.docId);
  TabManager.activate(TabManager.tabs()[0].id);
  assert.equal(TabManager.activeDoc().docId, a.docId);
});

test('TabManager.closeTab removes the tab and switches to neighbor', () => {
  document.getElementById('tab-bar').innerHTML = '<button id="tab-new"></button>';
  TabManager.init();
  const a = global.window.Rga.Doc.create();
  const b = global.window.Rga.Doc.create();
  const ta = TabManager.openDocument(a);
  const tb = TabManager.openDocument(b);
  TabManager.closeTab(tb.id, { skipDirtyCheck: true });
  const tabs = TabManager.tabs();
  assert.equal(tabs.length, 1);
  assert.equal(tabs[0].id, ta.id);
  assert.equal(TabManager.activeDoc().docId, a.docId);
});

test('Mutating one doc does not affect another', () => {
  document.getElementById('tab-bar').innerHTML = '<button id="tab-new"></button>';
  TabManager.init();
  const a = global.window.Rga.Doc.create();
  const b = global.window.Rga.Doc.create();
  TabManager.openDocument(a);
  TabManager.openDocument(b);
  a.body.metadata.title = 'A';
  b.body.metadata.title = 'B';
  assert.equal(a.body.metadata.title, 'A');
  assert.equal(b.body.metadata.title, 'B');
});
