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

test('closeTab honors a CloseGuard cancel verdict — the tab is kept', async () => {
  bootDom();
  const TM = loadTabManager();
  TM.init();
  // CloseGuard is a renderer peer module; stub it to veto the close.
  global.window.Rga.CloseGuard = { confirmClose: async () => 'cancel' };
  const doc = { docId: 'd1', displayName: 'one.rga', dirty: true };
  const tab = TM.openDocument(doc);
  await TM.closeTab(tab.id);
  assert.equal(TM.tabs().length, 1, 'a cancelled close must keep the tab');
});

test('bootSession merges with recovery — skips a file already open, opens the rest, no duplicates', async () => {
  bootDom();
  const TM = loadTabManager();
  TM.init();
  global.localStorage = (function() {
    const store = new Map();
    return {
      getItem: function(k) { return store.has(k) ? store.get(k) : null; },
      setItem: function(k, v) { store.set(k, String(v)); },
      removeItem: function(k) { store.delete(k); }
    };
  })();
  // A recovered (dirty) tab for a.rga is already open (crash recovery ran first).
  TM.openDocument({ docId: 'rec-a', displayName: 'a.rga', handle: '/x/a.rga', dirty: true });
  // The previous session referenced a.rga (collision) AND b.rga (clean, new).
  global.localStorage.setItem('rga-session-tabs', JSON.stringify({
    tabs: [{ handle: '/x/a.rga', displayName: 'a.rga' },
           { handle: '/x/b.rga', displayName: 'b.rga' }],
    activeIndex: 0
  }));
  const reads = [];
  global.window.rwanga = { files: { read: async (h) => { reads.push(h); return { content: 'STUB' }; } } };
  global.window.Rga.FileManager = {
    openFromContent: (handle) => TM.openDocument(
      { docId: 'sess-' + handle, displayName: handle, handle: handle, dirty: false })
  };
  await TM.bootSession();
  const handles = TM.tabs().map(function(t) { return t.doc.handle; }).sort();
  assert.deepEqual(handles, ['/x/a.rga', '/x/b.rga'],
    'a.rga is not duplicated (recovered tab wins); b.rga (clean) still appears');
  assert.deepEqual(reads, ['/x/b.rga'], 'only the not-already-open file was read');
  delete global.localStorage;
  delete global.window.rwanga;
  delete global.window.Rga.FileManager;
});

// ============================================================
// Slice 1 — Workspace tab kind.
//
// TabManager must support a second tab kind ('workspace') alongside
// the existing 'document' kind. Document semantics (dirty tracking,
// CloseGuard, recent files, session restore by handle) apply only to
// document tabs; workspace tabs are app-provided panes (Settings,
// Welcome, etc.) with no file backing.
// ============================================================

function bootDomWithHost() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html><body>
      <div id="tab-bar"><button id="tab-new">+</button></div>
      <div id="editor-container" class="no-doc">
        <div id="editor-empty-state"></div>
        <div id="tab-content-host">
          <div class="rga-page-row" data-renderer="document">
            <div id="editor"></div>
          </div>
        </div>
      </div>
    </body></html>
  `, { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.confirm = () => true;
  dom.window.RgaProseMirror = { EditorState: { create: () => ({ plugins: [] }) } };
  dom.window.Rga = {
    Editor: {
      mount: () => ({ view: { state: { schema: {}, plugins: [] }, updateState: () => {}, setProps: () => {}, focus: () => {} } }),
      emptyDoc: () => null
    }
  };
  return dom;
}

function loadWorkspacesRegistry() {
  delete require.cache[require.resolve('../../renderer/js/shell/workspaces.js')];
  require('../../renderer/js/shell/workspaces.js');
  return global.window.Rga.Workspaces;
}

function registerHelloWorld() {
  const W = global.window.Rga.Workspaces;
  W.register({
    kind: 'hello-world',
    title: 'Hello World',
    restoreOnSession: false,
    mount: function(el) { el.innerHTML = '<div class="hw-proof">Workspace tab works</div>'; },
    unmount: function(el) { el.innerHTML = ''; }
  });
}

test('Slice 1 — document tabs default to kind="document" (back-compat)', () => {
  bootDomWithHost();
  const TM = loadTabManager();
  TM.init();
  const tab = TM.openDocument({ docId: 'd1', displayName: 'one.rga', dirty: false });
  assert.equal(tab.kind, 'document');
});

test('Slice 1 — openWorkspace creates a tab with kind="workspace"', () => {
  bootDomWithHost();
  loadWorkspacesRegistry();
  registerHelloWorld();
  const TM = loadTabManager();
  TM.init();
  const tab = TM.openWorkspace('hello-world');
  assert.ok(tab, 'openWorkspace returns a tab');
  assert.equal(tab.kind, 'workspace');
  assert.equal(tab.workspaceKind, 'hello-world');
});

test('Slice 1 — openWorkspace is singleton — opening the same kind twice focuses existing', () => {
  bootDomWithHost();
  loadWorkspacesRegistry();
  registerHelloWorld();
  const TM = loadTabManager();
  TM.init();
  const t1 = TM.openWorkspace('hello-world');
  const t2 = TM.openWorkspace('hello-world');
  assert.equal(t1.id, t2.id, 'second open returns the same tab id');
  assert.equal(TM.tabs().length, 1, 'only one workspace tab exists');
});

test('Slice 1 — openWorkspace returns null for an unregistered kind', () => {
  bootDomWithHost();
  loadWorkspacesRegistry();
  const TM = loadTabManager();
  TM.init();
  const tab = TM.openWorkspace('does-not-exist');
  assert.equal(tab, null);
  assert.equal(TM.tabs().length, 0);
});

test('Slice 1 — activeDoc() returns null when a workspace tab is active', () => {
  bootDomWithHost();
  loadWorkspacesRegistry();
  registerHelloWorld();
  const TM = loadTabManager();
  TM.init();
  TM.openWorkspace('hello-world');
  assert.equal(TM.activeDoc(), null,
    'activeDoc returns null because the active tab is a workspace, not a document');
});

test('Slice 1 — workspace activation does not crash without a doc', () => {
  bootDomWithHost();
  loadWorkspacesRegistry();
  registerHelloWorld();
  const TM = loadTabManager();
  TM.init();
  // PageSurface + FileManager are not stubbed; activate must not blindly
  // call setActive/apply on tab.doc when kind === 'workspace'.
  assert.doesNotThrow(() => { TM.openWorkspace('hello-world'); });
});

test('Slice 1 — closeTab on a workspace tab skips CloseGuard', async () => {
  bootDomWithHost();
  loadWorkspacesRegistry();
  registerHelloWorld();
  const TM = loadTabManager();
  TM.init();
  let guardCalled = false;
  global.window.Rga.CloseGuard = {
    confirmClose: async () => { guardCalled = true; return 'cancel'; }
  };
  const tab = TM.openWorkspace('hello-world');
  await TM.closeTab(tab.id);
  assert.equal(guardCalled, false,
    'CloseGuard must not be invoked for workspace tabs (no dirty state to guard)');
  assert.equal(TM.tabs().length, 0, 'workspace tab closes immediately');
});

test('Slice 1 — mixed document + workspace — closing workspace preserves document', async () => {
  bootDomWithHost();
  loadWorkspacesRegistry();
  registerHelloWorld();
  const TM = loadTabManager();
  TM.init();
  const doc1 = { docId: 'd1', displayName: 'one.rga', dirty: false };
  const docTab = TM.openDocument(doc1);
  const wsTab = TM.openWorkspace('hello-world');
  assert.equal(TM.tabs().length, 2);
  // Close the workspace; the document tab must remain and become active.
  await TM.closeTab(wsTab.id);
  assert.equal(TM.tabs().length, 1);
  assert.equal(TM.activeDoc(), doc1, 'document tab is now active after workspace close');
});

test('Slice 1 — session save excludes workspace tabs', () => {
  bootDomWithHost();
  loadWorkspacesRegistry();
  registerHelloWorld();
  const TM = loadTabManager();
  TM.init();
  global.localStorage = (function() {
    const store = new Map();
    return {
      getItem: (k) => store.has(k) ? store.get(k) : null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    };
  })();
  TM.openDocument({ docId: 'd1', displayName: 'one.rga', handle: '/x/one.rga', dirty: false });
  TM.openWorkspace('hello-world');
  TM._saveSession();
  const saved = JSON.parse(global.localStorage.getItem('rga-session-tabs'));
  const handles = saved.tabs.map(t => t.handle);
  assert.deepEqual(handles, ['/x/one.rga'],
    'session save persists only the document tab; workspace is excluded');
  delete global.localStorage;
});

test('Slice 1 — hello-world workspace mounts into #tab-content-host with proof content', () => {
  bootDomWithHost();
  loadWorkspacesRegistry();
  registerHelloWorld();
  const TM = loadTabManager();
  TM.init();
  TM.openWorkspace('hello-world');
  const host = document.getElementById('tab-content-host');
  const proof = host && host.querySelector('.hw-proof');
  assert.ok(proof, 'workspace mount sits inside #tab-content-host');
  assert.equal(proof.textContent, 'Workspace tab works');
});

test('Slice 1 — activating a workspace tab hides the document renderer', () => {
  bootDomWithHost();
  loadWorkspacesRegistry();
  registerHelloWorld();
  const TM = loadTabManager();
  TM.init();
  TM.openDocument({ docId: 'd1', displayName: 'one.rga', dirty: false });
  TM.openWorkspace('hello-world');  // now active
  const docRenderer = document.querySelector('[data-renderer="document"]');
  assert.ok(docRenderer);
  assert.equal(docRenderer.style.display, 'none',
    'document renderer is hidden when a workspace tab is active');
});

test('Slice 1 — activating a document tab re-shows the document renderer', () => {
  bootDomWithHost();
  loadWorkspacesRegistry();
  registerHelloWorld();
  const TM = loadTabManager();
  TM.init();
  const docTab = TM.openDocument({ docId: 'd1', displayName: 'one.rga', dirty: false });
  TM.openWorkspace('hello-world');
  TM.activate(docTab.id);
  const docRenderer = document.querySelector('[data-renderer="document"]');
  assert.notEqual(docRenderer.style.display, 'none',
    'document renderer becomes visible when a document tab is active');
});
