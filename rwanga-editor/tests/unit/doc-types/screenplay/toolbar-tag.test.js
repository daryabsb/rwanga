// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.7 — screenplay Tag toolbar contribution.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const HTML = '<!DOCTYPE html><html><body>' +
  '<div id="rga-shell-toolbar">' +
    '<div class="rga-shell-toolbar-inner">' +
      '<div class="rga-shell-toolbar-group" data-group="text">[text]</div>' +
      '<div class="rga-shell-toolbar-content-slot" data-toolbar-slot="content"></div>' +
      '<div class="rga-shell-toolbar-group" data-group="writing">[writing]</div>' +
    '</div>' +
  '</div>' +
  '</body></html>';

function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM(HTML, { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  // Tags Panel V1: the toolbar routes mark application through
  // Rga.Tags.applyTag, which dispatches CustomEvents on document.
  // Alias jsdom's constructors so Node's own CustomEvent class doesn't
  // get rejected by jsdom's dispatchEvent (same workaround as
  // v3-plugin-compat.test.js).
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.window.Rga = {};

  // Stubs the screenplay tag contribution reads.
  opts._addEntityCalls = opts._addEntityCalls || [];
  opts._addMarkCalls   = opts._addMarkCalls   || [];
  opts._dirtyCalls     = opts._dirtyCalls     || 0;

  global.window.Rga.Doc = {
    addEntity: function(doc, tagType, attrs) {
      opts._addEntityCalls.push({ tagType: tagType, attrs: attrs });
      return 'entity-' + tagType + '-' + opts._addEntityCalls.length;
    },
    markDirty: function() { opts._dirtyCalls += 1; }
  };

  // TabManager + view stubs.
  const tagMark = { create: function(attrs) { return { attrs: attrs, mark: 'tag' }; } };
  global.window.Rga.TabManager = {
    _editorView: function() { return opts.view || null; },
    activeDoc:   function() { return opts.doc || null; }
  };

  // Default a usable view if none supplied.
  if (opts.useDefaultView !== false && !opts.view) {
    opts.view = {
      state: {
        selection: { from: 5, to: 10, empty: false },
        schema:    { marks: { tag: tagMark } },
        doc:       { textBetween: function() { return 'hello'; } },
        tr:        { addMark: function(from, to, mark) {
          opts._addMarkCalls.push({ from: from, to: to, mark: mark });
          return { dispatched: true };
        } }
      },
      dispatch: function() {},
      focus:    function() {}
    };
    opts.doc = opts.doc || { docId: 'd1' };
  }

  const files = [
    '../../../../renderer/js/shell/toolbar.js',
    // Slice A: the toolbar tag path acquires entity ids through the
    // shared Rga.Tags.findOrCreateEntity helper — tags.js must be loaded.
    '../../../../renderer/js/doc-types/screenplay/plugins/tags.js',
    '../../../../renderer/js/doc-types/screenplay/toolbar-tag.js'
  ];
  files.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  Rga.Shell.Toolbar._reset();
  // The plugin IIFE registered before _reset cleared mounted DOM but
  // before the registry was untouched (soft reset). Re-require to
  // re-register against the cleared state.
  delete require.cache[require.resolve('../../../../renderer/js/doc-types/screenplay/toolbar-tag.js')];
  require('../../../../renderer/js/doc-types/screenplay/toolbar-tag.js');
  const slotEl = global.document.querySelector('[data-toolbar-slot="content"]');
  Rga.Shell.Toolbar.setHost(slotEl);
  return { Rga, dom, slot: slotEl, opts };
}

// ----------------------------------------------------------------
// §1 — Registration
// ----------------------------------------------------------------

test('F1A.7 — screenplay toolbar-tag.js registers the Tag group at order 300', () => {
  const { Rga } = boot();
  const ctrl = Rga.Shell.Toolbar.getController('tag');
  assert.ok(ctrl);
  assert.equal(ctrl.id, 'tag');
  assert.equal(ctrl.order, 300);
  assert.equal(ctrl.dataGroup, 'tag');
  assert.equal(typeof ctrl.mount, 'function');
});

test('F1A.7 — Tag group sorts AFTER the Scene group (order 200 < 300)', () => {
  // Boot with both plugins loaded so we can verify ordering.
  const dom = new JSDOM(HTML, { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  // Minimal stubs.
  global.window.RgaProseMirror = { setBlockType: function() { return function() {}; } };
  global.window.Rga.TabManager = { _editorView: function() { return null; }, activeDoc: function() { return null; } };
  global.window.Rga.DocTypes = { screenplay: { v3Commands: { insertSceneSmart: function() {} } } };
  global.window.Rga.KeyboardRegistry = { registerCommand: function() {}, _commands: {} };
  global.window.Rga.ScriptMetrics = { get: function() { return { currentBlockType: null }; }, subscribe: function() { return function() {}; } };

  ['../../../../renderer/js/shell/toolbar.js',
   '../../../../renderer/js/doc-types/screenplay/toolbar.js',
   '../../../../renderer/js/doc-types/screenplay/toolbar-tag.js']
  .forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  Rga.Shell.Toolbar._reset();
  // Re-require to repopulate after soft reset.
  ['../../../../renderer/js/doc-types/screenplay/toolbar.js',
   '../../../../renderer/js/doc-types/screenplay/toolbar-tag.js']
  .forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  const slotEl = global.document.querySelector('[data-toolbar-slot="content"]');
  Rga.Shell.Toolbar.setHost(slotEl);

  const sceneEl = slotEl.querySelector('[data-toolbar-group-id="scene"]');
  const tagEl   = slotEl.querySelector('[data-toolbar-group-id="tag"]');
  assert.ok(sceneEl, 'scene group mounted');
  assert.ok(tagEl, 'tag group mounted');
  // DOM order: scene appears before tag in the slot's children list.
  const kids = Array.from(slotEl.children);
  assert.ok(kids.indexOf(sceneEl) < kids.indexOf(tagEl),
    'scene group must appear before tag group in DOM order');
});

// ----------------------------------------------------------------
// §2 — Mount creates the expected DOM
// ----------------------------------------------------------------

test('F1A.7 — mount creates the tag <select> with id + aria-label + placeholder + 9 categories', () => {
  const { slot } = boot();
  const group = slot.querySelector('[data-toolbar-group-id="tag"]');
  assert.ok(group);
  assert.equal(group.getAttribute('data-group'), 'tag');
  const select = group.querySelector('select.rga-shell-toolbar-tag');
  assert.ok(select);
  assert.equal(select.id, 'rga-shell-toolbar-tag');
  assert.equal(select.getAttribute('aria-label'), 'Tag selected text');
  // 10 options: placeholder + 9 categories.
  assert.equal(select.options.length, 10);
  assert.equal(select.options[0].value, '');
  assert.equal(select.options[0].textContent, 'Tag…');
});

test('F1A.7 — tag select option labels match the pre-F1A.7 production vocabulary', () => {
  const { slot } = boot();
  const select = slot.querySelector('select.rga-shell-toolbar-tag');
  const labels = Array.from(select.options).map(function(o) {
    return [o.value, o.textContent];
  });
  assert.deepEqual(labels, [
    ['',          'Tag…'],
    ['character', 'Character'],
    ['prop',      'Prop'],
    ['wardrobe',  'Wardrobe'],
    ['location',  'Location'],
    ['sfx',       'SFX'],
    ['vfx',       'VFX'],
    ['vehicle',   'Vehicle'],
    ['animal',    'Animal'],
    ['custom',    'Custom']
  ]);
});

// ----------------------------------------------------------------
// §3 — Behavior: change → applyTagFromSelection
// ----------------------------------------------------------------

test('F1A.7 — selecting a tag category applies the entity + adds the tag mark', () => {
  const opts = {};
  const { slot } = boot(opts);
  const select = slot.querySelector('select.rga-shell-toolbar-tag');
  select.value = 'character';
  select.dispatchEvent(new global.window.Event('change'));

  assert.equal(opts._addEntityCalls.length, 1, 'Rga.Doc.addEntity called once');
  assert.equal(opts._addEntityCalls[0].tagType, 'character');
  assert.equal(opts._addEntityCalls[0].attrs.name, 'hello');
  assert.equal(opts._addMarkCalls.length, 1, 'tag mark dispatched once');
  assert.equal(opts._addMarkCalls[0].mark.attrs.tagType, 'character');
  assert.equal(opts._dirtyCalls, 1, 'doc marked dirty');
});

test('Tags Panel V1 — toolbar tagging dispatches editor.tagApplied (live surfaces refresh)', () => {
  // Regression pinned by the Tags Panel e2e: the toolbar previously
  // applied marks via a direct tr.addMark and never fired the
  // editor.tagApplied document event — so the Tags Panel (and any other
  // live listener) never refreshed on toolbar tagging.
  const opts = {};
  const { slot } = boot(opts);
  let tagAppliedEvents = 0;
  global.document.addEventListener('editor.tagApplied', function() { tagAppliedEvents += 1; });

  const select = slot.querySelector('select.rga-shell-toolbar-tag');
  select.value = 'character';
  select.dispatchEvent(new global.window.Event('change'));

  assert.equal(opts._addMarkCalls.length, 1, 'mark applied');
  assert.equal(tagAppliedEvents, 1,
    'editor.tagApplied dispatched exactly once — the event live panels subscribe to');
});

test('F1A.7 — select resets to placeholder after each apply (UX preserved)', () => {
  const opts = {};
  const { slot } = boot(opts);
  const select = slot.querySelector('select.rga-shell-toolbar-tag');
  select.value = 'prop';
  select.dispatchEvent(new global.window.Event('change'));
  assert.equal(select.value, '',
    'select.value must reset to "" so re-selecting the same category re-fires the change event');
});

test('F1A.7 — placeholder change ("") is a safe no-op (no entity, no mark, no dirty)', () => {
  const opts = {};
  const { slot } = boot(opts);
  const select = slot.querySelector('select.rga-shell-toolbar-tag');
  select.value = '';
  select.dispatchEvent(new global.window.Event('change'));
  assert.equal(opts._addEntityCalls.length, 0);
  assert.equal(opts._addMarkCalls.length, 0);
  assert.equal(opts._dirtyCalls, 0);
});

test('F1A.7 — change is a safe no-op when no editor view is active', () => {
  const opts = { useDefaultView: false, view: null };
  const { slot } = boot(opts);
  const select = slot.querySelector('select.rga-shell-toolbar-tag');
  select.value = 'character';
  select.dispatchEvent(new global.window.Event('change'));
  assert.equal(opts._addEntityCalls.length, 0);
});

test('F1A.7 — change is a safe no-op when the selection is empty (no text to tag)', () => {
  const opts = {
    useDefaultView: false,
    view: {
      state: {
        selection: { from: 5, to: 5, empty: true },
        schema: { marks: { tag: { create: function() {} } } },
        doc: { textBetween: function() { return ''; } },
        tr:  { addMark: function() { return {}; } }
      },
      dispatch: function() {},
      focus: function() {}
    },
    doc: { docId: 'd1' }
  };
  const { slot } = boot(opts);
  const select = slot.querySelector('select.rga-shell-toolbar-tag');
  select.value = 'character';
  select.dispatchEvent(new global.window.Event('change'));
  assert.equal(opts._addEntityCalls.length, 0);
});

// ----------------------------------------------------------------
// §4 — Unmount: cleanup detaches the change listener
// ----------------------------------------------------------------

test('F1A.7 — unregisterGroup detaches the change listener (no further calls after unmount)', () => {
  const opts = {};
  const { Rga, slot } = boot(opts);
  const select = slot.querySelector('select.rga-shell-toolbar-tag');
  // Sanity: a change before unregister fires.
  select.value = 'prop';
  select.dispatchEvent(new global.window.Event('change'));
  assert.equal(opts._addEntityCalls.length, 1);

  Rga.Shell.Toolbar.unregisterGroup('tag');
  assert.equal(slot.querySelector('[data-toolbar-group-id="tag"]'), null,
    'tag group DOM removed from slot');
  // Firing change on the detached select must NOT reach the handler
  // (the listener was removed in the unmount cleanup).
  select.value = 'sfx';
  try { select.dispatchEvent(new global.window.Event('change')); }
  catch (_) {}
  assert.equal(opts._addEntityCalls.length, 1,
    'no further addEntity calls after unregister');
});
