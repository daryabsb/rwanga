// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 2 — Rga.Shell.ScriptWorkspace unit tests (plan §3.2, §8.1).
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

  const stub = {
    activeDoc: opts.activeDoc || null,
    enumerated: opts.enumerated || null,           // array or null (null = error)
    openedHandle: null,
    openedExternally: null
  };
  global.window.Rga.TabManager = { activeDoc: function() { return stub.activeDoc; } };
  global.window.Rga.FileManager = { openFromHandle: function(p) { stub.openedHandle = p; } };
  global.window.rwanga = {
    files: {
      listDirectory: function(dirPath) {
        if (stub.enumerated === null && opts.enumerated === null) return Promise.resolve(null);
        if (typeof stub.enumerated === 'function') return Promise.resolve(stub.enumerated(dirPath));
        return Promise.resolve(stub.enumerated || []);
      }
    },
    shell: {
      openPath: function(p) { stub.openedExternally = p; }
    }
  };

  ['../../../renderer/js/shell/layout.js',
   '../../../renderer/js/shell/sidebar.js',
   '../../../renderer/js/shell/panels/script-workspace.js'
  ].forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  Rga.Shell.Layout._reset();
  Rga.Shell.Sidebar._reset();
  // Re-register the workspace controller after sidebar reset.
  Rga.Shell.Sidebar.setHost(document.getElementById('host'));
  Rga.Shell.Sidebar.registerPanel(Rga.Shell.ScriptWorkspace._controller);
  return { Rga, stub, host: document.getElementById('host') };
}

function flush() { return new Promise(function(r) { setTimeout(r, 0); }); }

// ----------------------------------------------------------------
// Categorization (pure)
// ----------------------------------------------------------------

test('CATEGORIES are exactly 6, in plan §3.2 render order', () => {
  const { Rga } = boot();
  const ids = Rga.Shell.ScriptWorkspace._CATEGORIES.map(function(c) { return c.id; });
  assert.deepEqual(ids, ['scripts', 'references', 'images', 'audio', 'notes', 'other']);
});

test('Audio is category 4 of 6 with the 9 supported extensions', () => {
  const { Rga } = boot();
  const audio = Rga.Shell.ScriptWorkspace._CATEGORIES[3];
  assert.equal(audio.id, 'audio');
  assert.equal(audio.label, 'Audio');
  assert.deepEqual(audio.exts.sort(), ['.aac', '.aiff', '.flac', '.m4a', '.mp3', '.ogg', '.opus', '.wav', '.wma']);
});

test('_categoryFor routes audio extensions to the audio category', () => {
  const { Rga } = boot();
  const cf = Rga.Shell.ScriptWorkspace._categoryFor;
  ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.aiff', '.opus', '.wma'].forEach(function(ext) {
    assert.equal(cf('track' + ext).id, 'audio', ext + ' → audio');
  });
});

test('_categoryFor routes .rga to scripts; .pdf to references; .png to images; .md to notes; .xyz to other', () => {
  const { Rga } = boot();
  const cf = Rga.Shell.ScriptWorkspace._categoryFor;
  assert.equal(cf('story.rga').id, 'scripts');
  assert.equal(cf('reference.pdf').id, 'references');
  assert.equal(cf('mood.png').id, 'images');
  assert.equal(cf('notes.md').id, 'notes');
  assert.equal(cf('random.xyz').id, 'other');
  assert.equal(cf('NO_EXTENSION').id, 'other');
});

test('_dirname extracts directory path from file path (handles / and \\)', () => {
  const { Rga } = boot();
  const dn = Rga.Shell.ScriptWorkspace._dirname;
  assert.equal(dn('/home/user/scripts/the-last-light.rga'), '/home/user/scripts');
  assert.equal(dn('C:\\Users\\darya\\scripts\\story.rga'), 'C:\\Users\\darya\\scripts');
  assert.equal(dn(null), null);
  assert.equal(dn(''), null);
});

// ----------------------------------------------------------------
// Mount + render (async)
// ----------------------------------------------------------------

test('mount with no active script shows "Open or save a script" empty state (Bundle 1 §B: unified .rga-shell-panel-empty class)', async () => {
  const { Rga, host } = boot();
  Rga.Shell.Sidebar.activate('scriptWorkspace');
  await flush();
  const empty = host.querySelector('.rga-shell-panel-empty');
  assert.ok(empty);
  assert.match(empty.textContent, /Open or save a script/);
});

test('mount with an empty workspace folder shows the empty-state copy mentioning audio (Bundle 1 §B: unified pattern)', async () => {
  const { Rga, host } = boot({
    activeDoc: { handle: '/workspace/script.rga' },
    enumerated: []
  });
  Rga.Shell.Sidebar.activate('scriptWorkspace');
  await flush();
  const empty = host.querySelector('.rga-shell-panel-empty');
  assert.ok(empty);
  assert.match(empty.textContent, /audio/i, 'empty-state mentions audio');
});

test('mount with mixed assets renders one section per non-empty category in plan §3.2 render order', async () => {
  const { Rga, host } = boot({
    activeDoc: { handle: '/workspace/x.rga' },
    enumerated: [
      { name: 'x.rga',         path: '/workspace/x.rga',         isDirectory: false },
      { name: 'cover.png',     path: '/workspace/cover.png',     isDirectory: false },
      { name: 'soundtrack.mp3', path: '/workspace/soundtrack.mp3', isDirectory: false },
      { name: 'notes.md',      path: '/workspace/notes.md',      isDirectory: false },
      { name: 'misc.xyz',      path: '/workspace/misc.xyz',      isDirectory: false }
    ]
  });
  Rga.Shell.Sidebar.activate('scriptWorkspace');
  await flush();
  const sections = host.querySelectorAll('.rga-shell-workspace-category');
  // No references in this fixture → 5 sections (no 'references' bucket rendered).
  assert.equal(sections.length, 5);
  const ids = Array.from(sections).map(function(s) { return s.getAttribute('data-category-id'); });
  assert.deepEqual(ids, ['scripts', 'images', 'audio', 'notes', 'other']);
});

test('audio assets render under the Audio section', async () => {
  const { Rga, host } = boot({
    activeDoc: { handle: '/workspace/x.rga' },
    enumerated: [
      { name: 'mood.mp3', path: '/workspace/mood.mp3', isDirectory: false },
      { name: 'voice.wav', path: '/workspace/voice.wav', isDirectory: false }
    ]
  });
  Rga.Shell.Sidebar.activate('scriptWorkspace');
  await flush();
  const audioSection = host.querySelector('[data-category-id="audio"]');
  assert.ok(audioSection);
  assert.match(audioSection.querySelector('.rga-shell-workspace-category-heading').textContent, /Audio/);
  const files = audioSection.querySelectorAll('.rga-shell-workspace-file');
  assert.equal(files.length, 2);
});

test('directories are filtered out — only files render', async () => {
  const { Rga, host } = boot({
    activeDoc: { handle: '/workspace/x.rga' },
    enumerated: [
      { name: 'subfolder', path: '/workspace/subfolder', isDirectory: true },
      { name: 'x.rga',     path: '/workspace/x.rga',     isDirectory: false }
    ]
  });
  Rga.Shell.Sidebar.activate('scriptWorkspace');
  await flush();
  const files = host.querySelectorAll('.rga-shell-workspace-file');
  assert.equal(files.length, 1);
  assert.equal(files[0].getAttribute('data-file-name'), 'x.rga');
});

// ----------------------------------------------------------------
// Open actions
// ----------------------------------------------------------------

test('clicking a .rga file calls Rga.FileManager.openFromHandle with its path', async () => {
  const { Rga, host, stub } = boot({
    activeDoc: { handle: '/workspace/x.rga' },
    enumerated: [{ name: 'other.rga', path: '/workspace/other.rga', isDirectory: false }]
  });
  Rga.Shell.Sidebar.activate('scriptWorkspace');
  await flush();
  host.querySelector('[data-file-name="other.rga"]').click();
  assert.equal(stub.openedHandle, '/workspace/other.rga');
});

test('clicking a non-.rga file calls window.rwanga.shell.openPath (external open)', async () => {
  const { Rga, host, stub } = boot({
    activeDoc: { handle: '/workspace/x.rga' },
    enumerated: [{ name: 'ref.pdf', path: '/workspace/ref.pdf', isDirectory: false }]
  });
  Rga.Shell.Sidebar.activate('scriptWorkspace');
  await flush();
  host.querySelector('[data-file-name="ref.pdf"]').click();
  assert.equal(stub.openedExternally, '/workspace/ref.pdf');
  assert.equal(stub.openedHandle, null, 'did not open in-app');
});

test('clicking an audio file (.mp3) opens externally — audio is non-.rga', async () => {
  const { Rga, host, stub } = boot({
    activeDoc: { handle: '/workspace/x.rga' },
    enumerated: [{ name: 'score.mp3', path: '/workspace/score.mp3', isDirectory: false }]
  });
  Rga.Shell.Sidebar.activate('scriptWorkspace');
  await flush();
  host.querySelector('[data-file-name="score.mp3"]').click();
  assert.equal(stub.openedExternally, '/workspace/score.mp3');
});

// ----------------------------------------------------------------
// Refresh + tab-activated re-enumeration
// ----------------------------------------------------------------

test('refresh button re-enumerates the workspace', async () => {
  let calls = 0;
  const { Rga, host } = boot({
    activeDoc: { handle: '/workspace/x.rga' },
    enumerated: function() { calls += 1; return []; }
  });
  Rga.Shell.Sidebar.activate('scriptWorkspace');
  await flush();
  const initialCalls = calls;
  host.querySelector('.rga-shell-workspace-refresh').click();
  await flush();
  assert.ok(calls > initialCalls, 'refresh triggered new enumeration');
});

test('editor.tabActivated invalidates the cache and re-enumerates', async () => {
  let calls = 0;
  const { Rga } = boot({
    activeDoc: { handle: '/workspace/x.rga' },
    enumerated: function() { calls += 1; return []; }
  });
  Rga.Shell.Sidebar.activate('scriptWorkspace');
  await flush();
  const before = calls;
  document.dispatchEvent(new CustomEvent('editor.tabActivated'));
  await flush();
  assert.ok(calls > before, 'tabActivated triggered re-enumeration');
});

// ----------------------------------------------------------------
// Error handling
// ----------------------------------------------------------------

test('null IPC response renders the error state with retry (Bundle 1 §B: unified pattern + action button)', async () => {
  const { Rga, host } = boot({
    activeDoc: { handle: '/workspace/x.rga' },
    enumerated: null
  });
  Rga.Shell.Sidebar.activate('scriptWorkspace');
  await flush();
  const err = host.querySelector('.rga-shell-panel-empty');
  assert.ok(err, 'unified empty-state DOM rendered for error path');
  assert.match(err.textContent, /Could not read/);
  // Retry button now lives inside .rga-shell-panel-empty-actions
  // (the unified action area), not as a free-floating .rga-shell-
  // workspace-retry button.
  const retry = err.querySelector('.rga-shell-panel-empty-action');
  assert.ok(retry, 'Retry action button rendered inside unified actions area');
  assert.match(retry.textContent, /Retry/);
});
