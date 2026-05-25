// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Search — Slice 3B.
//
// Pure functions. searchSettings(query, entries?) is the only public
// surface. Default entries come from Rga.Settings.Registry.all().
// Search covers id / label / description / keywords / aliases.
// Case-insensitive, punctuation-tolerant, deterministic ordering.
//
// Slice 3B scope: search substrate only — no UI, no search box.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bootDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
                        { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Rga = {};
  return dom;
}

function loadSearch() {
  // Validators → Registry → Search. The registry requires validators
  // at load time (Slice 3C).
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-validators.js')];
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-registry.js')];
  delete require.cache[require.resolve('../../../renderer/js/shell/settings-search.js')];
  require('../../../renderer/js/shell/settings-validators.js');
  require('../../../renderer/js/shell/settings-registry.js');
  require('../../../renderer/js/shell/settings-search.js');
  return global.window.Rga.Settings;
}

// Synthetic registry-shaped entries for alias / keyword tests so the
// real registry data stays unmodified by this slice.
function fakeEntry(over) {
  return Object.assign({
    id: 'fake.id', label: 'Fake', description: 'fake entry',
    type: 'toggle', default: false, scope: 'all',
    persistsTo: 'user', owner: 'general',
    restartRequired: false, experimental: false,
    dependencies: [], requiresPro: false,
    keywords: [], aliases: [],
    previewKind: 'none', requiresOnboarding: false
  }, over);
}

// ----------------------------------------------------------------
// §1 — Module presence + public API
// ----------------------------------------------------------------

test('Slice 3B — Rga.Settings.Search exposes searchSettings()', () => {
  bootDom();
  const S = loadSearch();
  assert.equal(typeof S.Search, 'object');
  assert.equal(typeof S.Search.searchSettings, 'function');
});

// ----------------------------------------------------------------
// §2 — Empty / trivial queries
// ----------------------------------------------------------------

test('Slice 3B — empty query returns []', () => {
  bootDom();
  const S = loadSearch();
  assert.deepEqual(S.Search.searchSettings(''), []);
  assert.deepEqual(S.Search.searchSettings('   '), []);
});

test('Slice 3B — query with no matches returns []', () => {
  bootDom();
  const S = loadSearch();
  assert.deepEqual(S.Search.searchSettings('xyzzy_nothing_here'), []);
});

// ----------------------------------------------------------------
// §3 — Matching against the real registry (single-token queries)
// ----------------------------------------------------------------

test('Slice 3B — exact id match returns the entry', () => {
  bootDom();
  const S = loadSearch();
  const results = S.Search.searchSettings('editor.highlightCurrentLine');
  const ids = results.map(function(r) { return r.id; });
  assert.ok(ids.indexOf('editor.highlightCurrentLine') >= 0,
    'exact id must be found; got: ' + JSON.stringify(ids));
  assert.equal(ids[0], 'editor.highlightCurrentLine',
    'exact id should be the top result');
});

test('Slice 3B — label substring "paper" finds pageSetup.paperSize', () => {
  bootDom();
  const S = loadSearch();
  const ids = S.Search.searchSettings('paper').map(function(r) { return r.id; });
  assert.ok(ids.indexOf('pageSetup.paperSize') >= 0,
    '"paper" must surface pageSetup.paperSize; got: ' + JSON.stringify(ids));
});

test('Slice 3B — keyword "dark" finds theme (whose keywords include "dark")', () => {
  bootDom();
  const S = loadSearch();
  const ids = S.Search.searchSettings('dark').map(function(r) { return r.id; });
  assert.ok(ids.indexOf('theme') >= 0,
    '"dark" must surface theme via its keyword; got: ' + JSON.stringify(ids));
});

// ----------------------------------------------------------------
// §4 — Multi-word AND semantics
// ----------------------------------------------------------------

test('Slice 3B — multi-word query "font size" finds editor.fontSize', () => {
  bootDom();
  const S = loadSearch();
  const ids = S.Search.searchSettings('font size').map(function(r) { return r.id; });
  assert.ok(ids.indexOf('editor.fontSize') >= 0,
    '"font size" must surface editor.fontSize; got: ' + JSON.stringify(ids));
});

test('Slice 3B — multi-word query requires ALL tokens to match somewhere', () => {
  bootDom();
  const S = loadSearch();
  // "font" alone matches several entries. Adding a token that none of
  // them carry must drop them all from the result.
  const fontResults = S.Search.searchSettings('font');
  assert.ok(fontResults.length > 0, 'baseline: "font" must match at least one entry');
  const withGarbage = S.Search.searchSettings('font xyzzy_no_such_token');
  assert.deepEqual(withGarbage, [],
    'adding an unmatchable token must zero the result set (AND semantics)');
});

// ----------------------------------------------------------------
// §5 — Case insensitivity + punctuation tolerance
// ----------------------------------------------------------------

test('Slice 3B — search is case-insensitive', () => {
  bootDom();
  const S = loadSearch();
  const lower = S.Search.searchSettings('paper').map(function(r) { return r.id; });
  const upper = S.Search.searchSettings('PAPER').map(function(r) { return r.id; });
  const mixed = S.Search.searchSettings('Paper').map(function(r) { return r.id; });
  assert.deepEqual(upper, lower);
  assert.deepEqual(mixed, lower);
});

test('Slice 3B — punctuation in the query is tolerated (page.setup matches pageSetup.*)', () => {
  bootDom();
  const S = loadSearch();
  const ids = S.Search.searchSettings('page.setup').map(function(r) { return r.id; });
  // pageSetup.paperSize / .orientation / .margins / etc. all carry
  // "page" and "setup"-related tokens via their id; the punctuation
  // tolerance must still surface at least one of them.
  const hits = ids.filter(function(id) { return id.indexOf('pageSetup.') === 0; });
  assert.ok(hits.length > 0,
    '"page.setup" must surface pageSetup.* entries via punctuation tolerance; got: ' +
    JSON.stringify(ids));
});

test('Slice 3B — punctuation in the query is tolerated (editor.font-size matches editor.fontSize)', () => {
  bootDom();
  const S = loadSearch();
  const ids = S.Search.searchSettings('editor.font-size').map(function(r) { return r.id; });
  assert.ok(ids.indexOf('editor.fontSize') >= 0,
    'punctuation-tolerant tokenization must still locate editor.fontSize; got: ' +
    JSON.stringify(ids));
});

// ----------------------------------------------------------------
// §6 — Alias + keyword matching via parametrized entries
// ----------------------------------------------------------------

test('Slice 3B — alias matching works (via injected entries)', () => {
  bootDom();
  const S = loadSearch();
  const entries = [
    fakeEntry({ id: 'a.b', label: 'A B', description: 'demo',
                aliases: ['my-alias-token'] }),
    fakeEntry({ id: 'c.d', label: 'C D', description: 'demo' })
  ];
  const ids = S.Search.searchSettings('my-alias-token', entries)
    .map(function(r) { return r.id; });
  assert.deepEqual(ids, ['a.b'],
    'alias must surface its owning entry; other entries must not match');
});

test('Slice 3B — keyword matching works (via injected entries)', () => {
  bootDom();
  const S = loadSearch();
  const entries = [
    fakeEntry({ id: 'a.b', label: 'A B', description: 'demo',
                keywords: ['quickbrownfox'] }),
    fakeEntry({ id: 'c.d', label: 'C D', description: 'demo' })
  ];
  const ids = S.Search.searchSettings('quickbrownfox', entries)
    .map(function(r) { return r.id; });
  assert.deepEqual(ids, ['a.b']);
});

// ----------------------------------------------------------------
// §7 — Determinism
// ----------------------------------------------------------------

test('Slice 3B — same query returns the same order on repeated calls', () => {
  bootDom();
  const S = loadSearch();
  const a = S.Search.searchSettings('font').map(function(r) { return r.id; });
  const b = S.Search.searchSettings('font').map(function(r) { return r.id; });
  const c = S.Search.searchSettings('font').map(function(r) { return r.id; });
  assert.deepEqual(b, a);
  assert.deepEqual(c, a);
});

test('Slice 3B — exact id match ranks above mere description-substring match', () => {
  bootDom();
  const S = loadSearch();
  // editor.highlightCurrentLine — exact id; theme/etc may contain
  // "highlight" or "current" in descriptions. Exact id must win.
  const ids = S.Search.searchSettings('editor.highlightCurrentLine')
    .map(function(r) { return r.id; });
  assert.equal(ids[0], 'editor.highlightCurrentLine');
});

// ----------------------------------------------------------------
// §8 — Injection API
// ----------------------------------------------------------------

test('Slice 3B — searchSettings(query, entries) uses the passed array, not the registry', () => {
  bootDom();
  const S = loadSearch();
  const entries = [fakeEntry({ id: 'only.one', label: 'Only One' })];
  const ids = S.Search.searchSettings('only', entries).map(function(r) { return r.id; });
  // The injected list has exactly one entry; the result cannot contain
  // anything else even though the real registry has 62 entries loaded.
  assert.deepEqual(ids, ['only.one']);
});
