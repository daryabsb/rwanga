// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bootDom() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html><body>
      <div id="tab-bar"><button id="tab-new">+</button></div>
      <div id="editor"></div>
    </body></html>
  `, { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.confirm = () => true;

  // Stub ProseMirror globals
  dom.window.RgaProseMirror = { EditorState: { create: () => ({ plugins: [] }) } };
  dom.window.Rga = {
    Editor: {
      mount: () => ({ view: { state: { schema: {}, plugins: [] }, updateState: () => {}, setProps: () => {}, focus: () => {} } }),
      emptyDoc: () => null
    }
  };
  return dom;
}

function loadTabManager() {
  delete require.cache[require.resolve('../../renderer/js/tab-manager.js')];
  require('../../renderer/js/tab-manager.js');
  return global.window.Rga.TabManager;
}

test('TabManager.openDocument adds and activates a tab', () => {
  bootDom();
  const TM = loadTabManager();
  TM.init();
  const doc = { docId: 'd1', displayName: 'one.rga', dirty: false };
  const tab = TM.openDocument(doc);
  assert.ok(tab.id);
  assert.equal(TM.activeDoc(), doc);
  assert.equal(TM.tabs().length, 1);
});

test('TabManager.closeTab removes the tab', () => {
  bootDom();
  const TM = loadTabManager();
  TM.init();
  const doc1 = { docId: 'd1', displayName: 'one.rga', dirty: false };
  const tab1 = TM.openDocument(doc1);
  TM.closeTab(tab1.id);
  assert.equal(TM.tabs().length, 0);
  assert.equal(TM.activeDoc(), null);
});

test('TabManager switching activates correct doc', () => {
  bootDom();
  const TM = loadTabManager();
  TM.init();
  const doc1 = { docId: 'd1', displayName: 'one.rga', dirty: false };
  const doc2 = { docId: 'd2', displayName: 'two.rga', dirty: false };
  const t1 = TM.openDocument(doc1);
  const t2 = TM.openDocument(doc2);
  assert.equal(TM.activeDoc(), doc2);
  TM.activate(t1.id);
  assert.equal(TM.activeDoc(), doc1);
});

// ============================================================
// RTL Recovery Slice A — text direction is a DOCUMENT property.
// screenplayProfile.direction must drive #editor's dir attribute on every
// open / tab activation, with no manual language toggle.
// ============================================================

function docWithDirection(dir) {
  return {
    docId: 'd-' + dir, displayName: dir + '.rga', dirty: false,
    metadata: { screenplayProfile: { direction: dir } }
  };
}

test('RTL Slice A — opening an rtl document sets #editor dir=rtl', () => {
  bootDom();
  const TM = loadTabManager();
  TM.init();
  TM.openDocument(docWithDirection('rtl'));
  assert.equal(document.getElementById('editor').getAttribute('dir'), 'rtl');
});

test('RTL Slice A — opening an ltr document sets #editor dir=ltr', () => {
  bootDom();
  const TM = loadTabManager();
  TM.init();
  TM.openDocument(docWithDirection('ltr'));
  assert.equal(document.getElementById('editor').getAttribute('dir'), 'ltr');
});

test('RTL Slice A — a document with no screenplayProfile defaults to ltr', () => {
  bootDom();
  const TM = loadTabManager();
  TM.init();
  TM.openDocument({ docId: 'd1', displayName: 'plain.rga', dirty: false });
  assert.equal(document.getElementById('editor').getAttribute('dir'), 'ltr');
});

test('RTL Slice A — switching tabs re-applies each document direction', () => {
  bootDom();
  const TM = loadTabManager();
  TM.init();
  const rtl = TM.openDocument(docWithDirection('rtl'));
  const ltr = TM.openDocument(docWithDirection('ltr'));
  assert.equal(document.getElementById('editor').getAttribute('dir'), 'ltr');
  TM.activate(rtl.id);
  assert.equal(document.getElementById('editor').getAttribute('dir'), 'rtl');
  TM.activate(ltr.id);
  assert.equal(document.getElementById('editor').getAttribute('dir'), 'ltr');
});

test('RTL Slice A — ScriptLanguage no longer owns #editor direction or font', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../renderer/js/shell/script-language.js'), 'utf8');
  assert.equal(/setAttribute\(\s*['"]dir['"]/.test(src), false,
    'script-language.js must not set a dir attribute — direction is document-owned');
  assert.equal(/\.style\.fontFamily/.test(src), false,
    'script-language.js must not set an inline font — the dir=rtl CSS owns the RTL font');
});
