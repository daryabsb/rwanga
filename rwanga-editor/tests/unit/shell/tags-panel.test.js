// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Tags Panel V1 — Visible Intelligence.
//
// The writer's window into every tagged entity in the screenplay:
//   - The Characters sidebar panel (existing rail button, existing icon)
//     hosts the tag-groups content rendered by the screenplay plugin.
//   - Entities grouped by category, name + occurrence count per row.
//   - Clicking a row jumps the editor to the first occurrence.
//   - Tombstoned (merged-away) entities never appear (liveEntities).
//   - Honest empty state; RTL mirrors the script's direction.
//
// Everything on the path under test is REAL: real doc.js (+ B1 APIs),
// real tags.js, real sidebar.js, real characters.js panel, real v3
// schema, real PM state, real nav-index plugin (for counts). Only
// TabManager wiring + ScriptSession are stubs.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// ----------------------------------------------------------------
// Boot
// ----------------------------------------------------------------
function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="sidebar-host"></div></body></html>',
    { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.window.Rga = {};

  const PMmodel = require('prosemirror-model');
  const PMstate = require('prosemirror-state');
  const PMview  = require('prosemirror-view');
  global.window.RgaProseMirror = {
    EditorState:   PMstate.EditorState,
    Schema:        PMmodel.Schema,
    PMNode:        PMmodel.Node,
    Plugin:        PMstate.Plugin,
    PluginKey:     PMstate.PluginKey,
    TextSelection: PMstate.TextSelection,
    Decoration:    PMview.Decoration,
    DecorationSet: PMview.DecorationSet
  };

  // REAL modules.
  const files = [
    '../../../renderer/js/constants.js',
    '../../../renderer/js/doc.js',
    '../../../renderer/js/shell/sidebar.js',
    '../../../renderer/js/framework/base-outer-marks.js',
    '../../../renderer/js/framework/document-outline.js',
    '../../../renderer/js/framework/slug-resolver.js',
    '../../../renderer/js/framework/nav-index.js',
    '../../../renderer/js/doc-types/screenplay/schema-v3.js',
    '../../../renderer/js/doc-types/screenplay/plugins/tag-focus-highlight.js',
    '../../../renderer/js/doc-types/screenplay/plugins/tags.js',
    '../../../renderer/js/shell/panels/characters.js'
  ];
  files.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;

  // Real v3 schema + real doc.
  const sp = Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  const schema = sp.buildSchemaV3();
  const doc = Rga.Doc.create();
  if (opts.rtl) {
    doc.metadata.screenplayProfile = { direction: 'rtl' };
  }

  // Two scenes with taggable text.
  function scene(id, actionText) {
    const heading = schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null });
    const action  = schema.nodes.action.create(null, schema.text(actionText));
    const transition = schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'));
    return schema.nodes.scene.create(
      { id: id, notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
      [heading, action, transition]
    );
  }
  const body = schema.nodes.body.create(null, [
    scene('sc-1', 'NALI stands by the window holding the PHOTOGRAPH.'),
    scene('sc-2', 'Nali looks at NALI in the mirror.')
  ]);
  const title = schema.nodes.titleStrip.create({ removable: true });
  const docNode = schema.nodes.doc.create(null, [title, body]);

  // TabManager stub must exist BEFORE the nav-index plugin builds its
  // first state (it resolves the registry through activeDoc()).
  Rga.TabManager = {
    _editorView: function() { return view; },
    activeDoc:   function() { return doc; },
    lastActiveDoc: function() { return doc; },
    activeTab:   function() { return { doc: doc }; }
  };

  // Real PM state WITH the real nav-index plugin (counts come from it).
  const navPlugin = Rga.Nav && typeof Rga.Nav.buildIndexPlugin === 'function'
    ? Rga.Nav.buildIndexPlugin() : null;
  // V1.3 — the tag-focus highlight plugin (additive; empty until an entity
  // is selected, so it is a no-op for every pre-V1.3 test).
  const focusPlugin = Rga.TagFocusHighlight && typeof Rga.TagFocusHighlight.buildPlugin === 'function'
    ? Rga.TagFocusHighlight.buildPlugin() : null;
  const _plugins = [];
  if (navPlugin) _plugins.push(navPlugin);
  if (focusPlugin) _plugins.push(focusPlugin);
  let state = PMstate.EditorState.create({ schema: schema, doc: docNode, plugins: _plugins });
  let focusCalls = 0;
  const view = {
    get state() { return state; },
    dispatch: function(tr) { state = state.apply(tr); },
    focus: function() { focusCalls += 1; },
    _focusCalls: function() { return focusCalls; }
  };

  // ScriptSession stub (panel subscribes for re-renders).
  const _sessionSubs = new Set();
  Rga.ScriptSession = {
    subscribe: function(fn) { _sessionSubs.add(fn); return function() { _sessionSubs.delete(fn); }; },
    get: function() { return { currentScene: null }; },
    _tick: function() { _sessionSubs.forEach(function(fn) { fn(); }); }
  };

  // Sidebar host.
  const host = global.document.getElementById('sidebar-host');
  Rga.Shell.Sidebar.setHost(host);

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function occurrencesOf(needle) {
    const found = [];
    view.state.doc.descendants(function(node, pos) {
      if (!node.isText) return;
      let i = node.text.indexOf(needle);
      while (i !== -1) {
        found.push({ from: pos + i, to: pos + i + needle.length });
        i = node.text.indexOf(needle, i + 1);
      }
    });
    return found;
  }

  function tagOccurrence(needle, nth, tagType, entityId) {
    const occ = occurrencesOf(needle);
    const target = occ[nth || 0];
    if (!target) throw new Error('No occurrence #' + (nth || 0) + ' of "' + needle + '"');
    view.dispatch(view.state.tr.setSelection(
      PMstate.TextSelection.create(view.state.doc, target.from, target.to)));
    Rga.Tags.applyTag(view, tagType, entityId);
    return target;
  }

  function activatePanel() {
    return Rga.Shell.Sidebar.activate('characters');
  }

  return {
    Rga: Rga, doc: doc, view: view, schema: schema, dom: dom, host: host,
    occurrencesOf: occurrencesOf,
    tagOccurrence: tagOccurrence,
    activatePanel: activatePanel
  };
}

// The standard populated registry: 2 characters (one tagged 3x, one
// curated with 0 marks) + 1 prop tagged once.
function seedEntities(h) {
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-nali', name: 'NALI', color: '#4FC1FF', notes: '' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-baban', name: 'BABAN', color: '#FFB86C', notes: 'curated, never tagged' });
  h.Rga.Doc.addEntity(h.doc, 'prop', { id: 'ent-photo', name: 'PHOTOGRAPH', color: null, notes: '' });

  h.tagOccurrence('NALI', 0, 'character', 'ent-nali');   // scene 1
  h.tagOccurrence('NALI', 1, 'character', 'ent-nali');   // scene 2
  h.tagOccurrence('Nali', 0, 'character', 'ent-nali');   // scene 2 case variant
  h.tagOccurrence('PHOTOGRAPH', 0, 'prop', 'ent-photo'); // scene 1
}

// ================================================================
// §0 — API + registration
// ================================================================

test('TagsPanel: Rga.Tags.renderTagsPanel exists (the screenplay-owned panel renderer)', () => {
  const h = boot();
  assert.equal(typeof h.Rga.Tags.renderTagsPanel, 'function');
});

test('TagsPanel: the Characters panel is registered and AVAILABLE (no longer a placeholder)', () => {
  const h = boot();
  const ctrl = h.Rga.Shell.Sidebar.getController('characters');
  assert.ok(ctrl, 'characters panel registered');
  assert.equal(ctrl.available, true, 'panel is now real, not a coming-soon placeholder');
  // Identity unchanged (rail-doctrine: icon + shortcut are designer-frozen).
  assert.equal(ctrl.icon, 'users');
  assert.equal(ctrl.label, 'Characters');
});

// ================================================================
// §1 — Groups by category, name + count
// ================================================================

test('TagsPanel: entities render grouped by category — Characters group + Props group', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  const groups = h.host.querySelectorAll('.tag-group');
  assert.equal(groups.length, 2, 'two non-empty categories → two groups (empty categories render no group)');

  const headers = Array.from(h.host.querySelectorAll('.tag-group-header .tag-group-label'))
    .map(function(el) { return el.textContent; });
  assert.deepEqual(headers, ['Characters', 'Props'],
    'category headers in TAG_TYPES order, characters first');
});

test('TagsPanel: each entity row shows name + occurrence count', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  const items = h.host.querySelectorAll('.tag-item');
  assert.equal(items.length, 3, 'NALI + BABAN + PHOTOGRAPH = 3 rows');

  // NALI: tagged 3 times.
  const nali = Array.from(items).find(function(el) {
    return el.querySelector('.tag-name').textContent === 'NALI';
  });
  assert.ok(nali, 'NALI row present');
  assert.equal(nali.querySelector('.tag-count').textContent, '3',
    'occurrence count = number of tag marks in the document');

  // BABAN: curated, never tagged → listed, but NO count element
  // (V1.1 honest zero-occurrence treatment: a "0" reads as broken;
  // absence reads as "registered, not yet tagged").
  const baban = Array.from(items).find(function(el) {
    return el.querySelector('.tag-name').textContent === 'BABAN';
  });
  assert.ok(baban, 'curated-but-untagged entity still listed');
  assert.equal(baban.querySelector('.tag-count'), null,
    'zero-occurrence entities render no count');

  // PHOTOGRAPH: tagged once.
  const photo = Array.from(items).find(function(el) {
    return el.querySelector('.tag-name').textContent === 'PHOTOGRAPH';
  });
  assert.equal(photo.querySelector('.tag-count').textContent, '1');
});

test('TagsPanel: entity color renders on the row dot (curation visible)', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  const nali = Array.from(h.host.querySelectorAll('.tag-item')).find(function(el) {
    return el.querySelector('.tag-name').textContent === 'NALI';
  });
  const dot = nali.querySelector('.tag-dot');
  assert.ok(dot, 'row has a color dot');
  assert.ok(/79, 193, 255|#4FC1FF/i.test(dot.style.background || dot.style.backgroundColor),
    'dot carries the curated entity color');
});

// ================================================================
// §2 — Tombstones never appear (consumer rule C3)
// ================================================================

test('TagsPanel: tombstoned (merged-away) entities are never listed', () => {
  const h = boot();
  seedEntities(h);
  // A historical duplicate that has been merged into ent-nali.
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-dupe', name: 'NALI', color: null, notes: '' });
  h.Rga.Doc.markEntityMerged(h.doc, 'character', 'ent-dupe', 'ent-nali');

  h.activatePanel();

  const names = Array.from(h.host.querySelectorAll('.tag-item .tag-name'))
    .map(function(el) { return el.textContent; });
  assert.equal(names.filter(function(n) { return n === 'NALI'; }).length, 1,
    'only the live NALI appears — the tombstone is invisible');
  assert.equal(h.host.querySelector('[data-entity-id="ent-dupe"]'), null,
    'no row carries the tombstoned entity id');
});

// ================================================================
// §3 — Click → jump to first occurrence
// ================================================================

test('TagsPanel: clicking an entity row expands its occurrences — it does NOT jump (V1.2 behavior)', () => {
  // V1 made the row click jump to the first occurrence. V1.2 deliberately
  // changes this: the row click opens the occurrence browser; jumping
  // happens by clicking a scene inside it (§9 tests cover the jump).
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  const before = h.view.state.selection.from;
  const nali = Array.from(h.host.querySelectorAll('.tag-item')).find(function(el) {
    return el.querySelector('.tag-name').textContent === 'NALI';
  });
  nali.dispatchEvent(new h.dom.window.Event('click', { bubbles: true }));

  assert.equal(h.view.state.selection.from, before,
    'entity row click no longer moves the editor selection');
  assert.ok(h.host.querySelectorAll('.tag-occurrence').length > 0,
    'it expands the occurrence browser instead');
});

test('TagsPanel: clicking a zero-occurrence (curated, untagged) entity does not move the selection', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  const before = h.view.state.selection.from;
  const baban = Array.from(h.host.querySelectorAll('.tag-item')).find(function(el) {
    return el.querySelector('.tag-name').textContent === 'BABAN';
  });
  baban.dispatchEvent(new h.dom.window.Event('click', { bubbles: true }));

  assert.equal(h.view.state.selection.from, before,
    'no occurrence to jump to → selection unchanged (safe no-op)');
});

// ================================================================
// §4 — Empty state
// ================================================================

test('TagsPanel: no entities → honest empty state (approved writer-voice copy)', () => {
  const h = boot();
  h.activatePanel();

  const empty = h.host.querySelector('.rga-shell-panel-empty');
  assert.ok(empty, 'unified empty-state pattern used');
  assert.ok(/Your characters will appear here as you write/.test(empty.textContent),
    'approved copy preserved');
  assert.equal(h.host.querySelectorAll('.tag-item').length, 0, 'no rows');
});

// ================================================================
// §5 — RTL
// ================================================================

test('TagsPanel: panel wrapper mirrors the script direction — rtl script → dir="rtl"', () => {
  const h = boot({ rtl: true });
  seedEntities(h);
  h.activatePanel();

  const wrapper = h.host.querySelector('[dir]');
  assert.ok(wrapper, 'panel wrapper carries a dir attribute');
  assert.equal(wrapper.getAttribute('dir'), 'rtl');
});

test('TagsPanel: LTR script → dir="ltr" (accepted LTR layout unchanged)', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  const wrapper = h.host.querySelector('[dir]');
  assert.ok(wrapper);
  assert.equal(wrapper.getAttribute('dir'), 'ltr');
});

// ================================================================
// §6 — Entry points + live refresh
// ================================================================

test('TagsPanel: the "View Tags" popup button activates the Characters panel', () => {
  const h = boot();
  seedEntities(h);

  // Open the tag info popup for the NALI mark (the existing popup path).
  const mark = h.view.state.schema.marks.tag.create({ tagType: 'character', entityId: 'ent-nali' });
  h.view.coordsAtPos = function() { return { left: 10, bottom: 10 }; };
  h.Rga.Tags.showTagInfo(h.view, mark, 1);

  const viewBtn = Array.from(global.document.querySelectorAll('.rga-info-btn'))
    .find(function(b) { return /View Tags/.test(b.textContent); });
  assert.ok(viewBtn, 'View Tags button rendered in the popup');
  viewBtn.dispatchEvent(new h.dom.window.Event('click', { bubbles: true }));

  assert.equal(h.Rga.Shell.Sidebar.current(), 'characters',
    'View Tags is no longer a dead button — it opens the Tags Panel');
  assert.ok(h.host.querySelectorAll('.tag-item').length > 0,
    'and the panel shows the tagged entities');
});

test('TagsPanel: tagging new text while the panel is open refreshes it (editor.tagApplied)', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-nali', name: 'NALI', color: null, notes: '' });
  h.activatePanel();
  assert.equal(h.host.querySelectorAll('.tag-item').length, 1, 'one entity before');

  // Tag a prop via the real applyTag path → dispatches editor.tagApplied.
  h.Rga.Doc.addEntity(h.doc, 'prop', { id: 'ent-photo', name: 'PHOTOGRAPH', color: null, notes: '' });
  h.tagOccurrence('PHOTOGRAPH', 0, 'prop', 'ent-photo');

  assert.equal(h.host.querySelectorAll('.tag-item').length, 2,
    'panel refreshed automatically — the new prop appears without re-opening');
});

// ================================================================
// §7 — Source-level guards
// ================================================================

test('TagsPanel: characters.js keeps the Bundle-1 consistency contract (renderEmpty + approved copy in source)', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', '..', '..', 'renderer', 'js', 'shell', 'panels', 'characters.js'), 'utf8');
  assert.ok(/Rga\.Shell\.Sidebar\.renderEmpty\(/.test(src), 'still uses the unified empty-state helper');
  assert.ok(/Your characters will appear here as you write/.test(src), 'approved copy still in source');
});

test('TagsPanel: the panel renderer never writes registry state (read-only surface)', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', '..', '..', 'renderer', 'js', 'shell', 'panels', 'characters.js'), 'utf8');
  assert.equal(/addEntity|markEntityMerged|foldEntityMetadata|removeEntity/.test(src), false,
    'the shell panel never mutates the registry — it is a lens, not a hand');
});

// ================================================================
// §8 — V1.1: Honest Entity Intelligence
// ================================================================

// --- Duplicate identity warning ---------------------------------

test('TagsPanel V1.1: two live entities with the same name in one category both carry a duplicate warning', () => {
  const h = boot();
  // The fragmented-script reality (pre-Slice-A legacy data): two NALI entities.
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-nali-1', name: 'NALI', color: '#4FC1FF', notes: '' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-nali-2', name: 'NALI', color: null, notes: '' });
  h.activatePanel();

  const warned = h.host.querySelectorAll('.tag-item .tag-duplicate-warning');
  assert.equal(warned.length, 2, 'BOTH duplicate rows carry the warning indicator');
  // The warning carries accessible meaning.
  const aria = warned[0].getAttribute('aria-label') || '';
  assert.ok(/duplicate/i.test(aria), 'warning explains itself: ' + aria);
});

test('TagsPanel V1.1: case-variant names are duplicates (NALI / Nali — same normalized identity)', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-a', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-b', name: 'Nali' });
  h.activatePanel();

  assert.equal(h.host.querySelectorAll('.tag-duplicate-warning').length, 2,
    'case variants are the same identity → both warned');
});

test('TagsPanel V1.1: the same name in DIFFERENT categories is NOT a duplicate (type-scoped identity)', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-char', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'prop',      { id: 'ent-prop', name: 'NALI' });
  h.activatePanel();

  assert.equal(h.host.querySelectorAll('.tag-duplicate-warning').length, 0,
    'Character:NALI and Prop:NALI are different identities — no warning');
});

test('TagsPanel V1.1: a tombstoned duplicate does NOT trigger the warning (only live entities count)', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-live', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-merged', name: 'NALI' });
  h.Rga.Doc.markEntityMerged(h.doc, 'character', 'ent-merged', 'ent-live');
  h.activatePanel();

  assert.equal(h.host.querySelectorAll('.tag-item').length, 1, 'only the live entity is listed');
  assert.equal(h.host.querySelectorAll('.tag-duplicate-warning').length, 0,
    'a merged-away twin is resolved, not a duplicate — no warning');
});

test('TagsPanel V1.1: a unique entity carries no warning', () => {
  const h = boot();
  seedEntities(h);  // NALI / BABAN / PHOTOGRAPH — all unique names
  h.activatePanel();
  assert.equal(h.host.querySelectorAll('.tag-duplicate-warning').length, 0);
});

// --- Honest zero-occurrence treatment ----------------------------

test('TagsPanel V1.1: zero-occurrence entities render NO count element', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'prop', { id: 'ent-photo', name: 'PHOTOGRAPH' });
  h.Rga.Doc.addEntity(h.doc, 'prop', { id: 'ent-tinbox', name: 'TIN BOX' });
  h.activatePanel();

  const items = h.host.querySelectorAll('.tag-item');
  assert.equal(items.length, 2);
  items.forEach(function(item) {
    assert.equal(item.querySelector('.tag-count'), null,
      item.querySelector('.tag-name').textContent + ' has 0 occurrences → no count rendered');
  });
});

test('TagsPanel V1.1: tagged entities still show their count', () => {
  const h = boot();
  seedEntities(h);  // NALI tagged 3×, PHOTOGRAPH 1×, BABAN 0×
  h.activatePanel();

  const items = Array.from(h.host.querySelectorAll('.tag-item'));
  const nali = items.find(function(el) { return el.querySelector('.tag-name').textContent === 'NALI'; });
  const photo = items.find(function(el) { return el.querySelector('.tag-name').textContent === 'PHOTOGRAPH'; });
  assert.equal(nali.querySelector('.tag-count').textContent, '3');
  assert.equal(photo.querySelector('.tag-count').textContent, '1');
});

// --- Honest count language ---------------------------------------

test('TagsPanel V1.1: the count means TAGGED OCCURRENCES and says so (title + aria)', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  const nali = Array.from(h.host.querySelectorAll('.tag-item')).find(function(el) {
    return el.querySelector('.tag-name').textContent === 'NALI';
  });
  const count = nali.querySelector('.tag-count');
  assert.ok(/tagged occurrence/i.test(count.title || ''),
    'count title is honest about what it counts: "' + count.title + '"');
  assert.ok(/3 tagged occurrence/i.test(count.getAttribute('aria-label') || ''),
    'aria carries the same honest meaning');
});

// ================================================================
// §9 — V1.2: Occurrence Browser
// ================================================================

// Helper — find an entity row by name.
function rowByName(h, name) {
  return Array.from(h.host.querySelectorAll('.tag-item')).find(function(el) {
    return el.querySelector('.tag-name').textContent === name;
  });
}
function clickRow(h, row) {
  row.dispatchEvent(new h.dom.window.Event('click', { bubbles: true }));
}

test('TagsPanel V1.2: clicking an entity row expands its occurrence list (scene number + heading + per-scene count)', () => {
  const h = boot();
  seedEntities(h);   // NALI tagged in scene 1 (1×) and scene 2 (2×: NALI + Nali)
  h.activatePanel();

  clickRow(h, rowByName(h, 'NALI'));

  const occurrences = h.host.querySelectorAll('.tag-occurrence');
  assert.equal(occurrences.length, 2, 'NALI is tagged in two scenes → two occurrence rows');

  const first = occurrences[0];
  assert.match(first.textContent, /1/, 'first row carries scene number 1');
  assert.match(first.textContent, /INT\./, 'first row carries the scene heading');
  // Per-scene counts: scene 1 has 1 occurrence, scene 2 has 2.
  const counts = Array.from(occurrences).map(function(el) {
    return el.querySelector('.tag-occurrence-count').textContent;
  });
  assert.deepEqual(counts, ['1', '2'],
    'per-scene tagged-occurrence counts (scene 1: NALI×1; scene 2: NALI + Nali = 2)');
});

test('TagsPanel V1.2: clicking the entity row again collapses the occurrence list', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  clickRow(h, rowByName(h, 'NALI'));
  assert.ok(h.host.querySelectorAll('.tag-occurrence').length > 0, 'expanded');

  clickRow(h, rowByName(h, 'NALI'));
  assert.equal(h.host.querySelectorAll('.tag-occurrence').length, 0, 'collapsed');
});

test('TagsPanel V1.2: clicking a scene occurrence row jumps the editor INTO that scene', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  clickRow(h, rowByName(h, 'NALI'));
  const occurrences = h.host.querySelectorAll('.tag-occurrence');

  // The second occurrence row = scene 2. Scene 2's text is
  // "Nali looks at NALI in the mirror." — its FIRST ent-nali occurrence
  // is the leading lowercase "Nali" (also tagged in seedEntities).
  const scene2FirstOccurrence = h.occurrencesOf('Nali')[0];

  occurrences[1].dispatchEvent(new h.dom.window.Event('click', { bubbles: true }));

  const sel = h.view.state.selection;
  assert.ok(sel.from >= scene2FirstOccurrence.from && sel.from <= scene2FirstOccurrence.to,
    'selection landed inside scene 2\'s first tagged occurrence (got ' + sel.from +
    ', expected within [' + scene2FirstOccurrence.from + ',' + scene2FirstOccurrence.to + '])');
});

test('TagsPanel V1.2: clicking a scene occurrence does NOT collapse the expansion (browsing stays open)', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  clickRow(h, rowByName(h, 'NALI'));
  const occurrences = h.host.querySelectorAll('.tag-occurrence');
  occurrences[0].dispatchEvent(new h.dom.window.Event('click', { bubbles: true }));

  assert.ok(h.host.querySelectorAll('.tag-occurrence').length > 0,
    'occurrence list still visible after a jump — the writer keeps browsing');
});

test('TagsPanel V1.2: an unused entity expands to an honest empty line, not a broken blank', () => {
  const h = boot();
  seedEntities(h);   // BABAN is registered, never tagged
  h.activatePanel();

  clickRow(h, rowByName(h, 'BABAN'));

  const empty = h.host.querySelector('.tag-occurrences-empty');
  assert.ok(empty, 'expansion shows the honest empty line');
  assert.match(empty.textContent, /not tagged/i, 'copy explains: "' + (empty ? empty.textContent : '') + '"');
  assert.equal(h.host.querySelectorAll('.tag-occurrence').length, 0, 'no scene rows');
});

test('TagsPanel V1.2: duplicate entities expand to THEIR OWN scenes — answers "which NALI is this?"', () => {
  const h = boot();
  // Two NALI entities; first tagged in scene 1, second tagged in scene 2.
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-nali-1', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-nali-2', name: 'NALI' });
  h.tagOccurrence('NALI', 0, 'character', 'ent-nali-1');   // scene 1
  h.tagOccurrence('NALI', 1, 'character', 'ent-nali-2');   // scene 2
  h.activatePanel();

  // NOTE: the panel re-renders (rebuilds DOM) on every expansion toggle,
  // so rows must be re-queried from the live host after each click.
  function liveRows() { return Array.from(h.host.querySelectorAll('.tag-item')); }
  assert.equal(liveRows().length, 2);

  // Expand the FIRST duplicate → only scene 1.
  clickRow(h, liveRows()[0]);
  const occurrenceScenes = Array.from(h.host.querySelectorAll('.tag-occurrence'))
    .map(function(el) { return el.getAttribute('data-scene-node-id'); });
  assert.equal(occurrenceScenes.length, 1, 'first NALI is tagged in exactly one scene');
  assert.equal(occurrenceScenes[0], 'sc-1');

  // Expand the SECOND duplicate too → both expansions visible, each
  // showing its OWN scene.
  clickRow(h, liveRows()[1]);
  const allSceneIds = Array.from(h.host.querySelectorAll('.tag-occurrence'))
    .map(function(el) { return el.getAttribute('data-scene-node-id'); });
  assert.equal(allSceneIds.length, 2, 'both duplicates expanded simultaneously');
  assert.ok(allSceneIds.indexOf('sc-1') !== -1, 'first NALI shows scene 1');
  assert.ok(allSceneIds.indexOf('sc-2') !== -1, 'second NALI shows scene 2');
});

test('TagsPanel V1.2: expansion survives a panel re-render (tag event)', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  clickRow(h, rowByName(h, 'NALI'));
  assert.ok(h.host.querySelectorAll('.tag-occurrence').length > 0, 'expanded');

  // A new tag elsewhere triggers the live refresh (editor.tagApplied).
  h.Rga.Doc.addEntity(h.doc, 'prop', { id: 'ent-window', name: 'WINDOW' });
  h.tagOccurrence('window', 0, 'prop', 'ent-window');

  assert.ok(h.host.querySelectorAll('.tag-occurrence').length > 0,
    'NALI\'s expansion survived the re-render (scene-navigator expansion pattern)');
});

test('TagsPanel V1.2: occurrence rows are read-only navigation — no merge/edit/rename affordances', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();
  clickRow(h, rowByName(h, 'NALI'));

  const expansion = h.host.querySelector('.tag-occurrences');
  assert.ok(expansion);
  assert.equal(expansion.querySelectorAll('button, input, select, textarea').length, 0,
    'the occurrence browser is a lens: no actions, no controls');
});

// ================================================================
// V1.3 — Tag Focus Highlight (click an entity → its tagged
// occurrences light up in the editor). Decorations only; no marks,
// no content change, no persistence.
// ================================================================

function focusDecos(h) {
  return h.Rga.TagFocusHighlight._decorations(h.view.state);
}
function rowsByName(h, name) {
  return Array.from(h.host.querySelectorAll('.tag-item')).filter(function(el) {
    return el.querySelector('.tag-name').textContent === name;
  });
}

test('TagsPanel V1.3 #1: clicking an entity highlights ALL its tagged occurrences in the editor', () => {
  const h = boot();
  seedEntities(h);     // NALI (ent-nali) tagged 3× ; PHOTOGRAPH 1×
  h.activatePanel();

  assert.equal(focusDecos(h).length, 0, 'no highlight before any selection');
  clickRow(h, rowByName(h, 'NALI'));

  const decos = focusDecos(h);
  assert.equal(decos.length, 3, 'all three NALI tag marks are highlighted');
  // They coincide exactly with ent-nali's marks.
  const expected = h.Rga.TagFocusHighlight.rangesForEntity(h.view.state.doc, 'ent-nali');
  assert.deepEqual(decos.slice().sort((a, b) => a.from - b.from),
                   expected.slice().sort((a, b) => a.from - b.from));
});

test('TagsPanel V1.3: the selected entity row carries an active state', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();
  clickRow(h, rowByName(h, 'NALI'));

  const naliRow = rowByName(h, 'NALI');
  assert.ok(naliRow.classList.contains('tag-item-selected'), 'selected row has the active class');
  assert.equal(naliRow.getAttribute('aria-selected'), 'true');
  // Only one selected at a time.
  assert.equal(h.host.querySelectorAll('.tag-item-selected').length, 1);
});

test('TagsPanel V1.3 #5: selecting another entity REPLACES the highlight (and moves the active state)', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  clickRow(h, rowByName(h, 'NALI'));
  assert.equal(focusDecos(h).length, 3);

  clickRow(h, rowByName(h, 'PHOTOGRAPH'));
  const decos = focusDecos(h);
  assert.equal(decos.length, 1, 'now only PHOTOGRAPH is highlighted — NALI cleared');
  assert.deepEqual(decos, h.Rga.TagFocusHighlight.rangesForEntity(h.view.state.doc, 'ent-photo'));
  // Active state moved.
  assert.ok(rowByName(h, 'PHOTOGRAPH').classList.contains('tag-item-selected'));
  assert.ok(!rowByName(h, 'NALI').classList.contains('tag-item-selected'));
});

test('TagsPanel V1.3 #6: clicking the selected entity again clears the highlight', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  clickRow(h, rowByName(h, 'NALI'));
  assert.equal(focusDecos(h).length, 3);
  clickRow(h, rowByName(h, 'NALI'));   // toggle off
  assert.equal(focusDecos(h).length, 0, 'highlight cleared on deselect');
  assert.equal(h.host.querySelectorAll('.tag-item-selected').length, 0);
});

test('TagsPanel V1.3 #4: selecting a zero-occurrence entity shows no highlight and does not crash', () => {
  const h = boot();
  seedEntities(h);     // BABAN (ent-baban) is curated but never tagged
  h.activatePanel();

  clickRow(h, rowByName(h, 'BABAN'));
  assert.equal(focusDecos(h).length, 0, 'no occurrences → no highlight (honest)');
});

test('TagsPanel V1.3 #2: duplicate NALI — selecting one highlights only that entity\'s marks', () => {
  const h = boot();
  seedEntities(h);
  // A second, distinct NALI identity tagged on the "Nali" occurrence's neighbours.
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-nali-2', name: 'NALI', color: null, notes: '' });
  // Tag the word "window" against the second NALI just to give it a mark.
  h.tagOccurrence('window', 0, 'character', 'ent-nali-2');
  h.activatePanel();

  const naliRows = rowsByName(h, 'NALI');
  assert.equal(naliRows.length, 2, 'two NALI identities present');

  // Click the FIRST NALI row (ent-nali).
  const firstNali = naliRows.find(function(r) { return r.getAttribute('data-entity-id') === 'ent-nali'; });
  clickRow(h, firstNali);
  const decos = focusDecos(h);
  assert.equal(decos.length, 3, 'only ent-nali\'s 3 marks — the other NALI is untouched');
  assert.deepEqual(decos.slice().sort((a, b) => a.from - b.from),
                   h.Rga.TagFocusHighlight.rangesForEntity(h.view.state.doc, 'ent-nali').slice().sort((a, b) => a.from - b.from));
});

test('TagsPanel V1.3 #7: occurrence-row jump still works while focus is active (V1.2 preserved)', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  clickRow(h, rowByName(h, 'NALI'));            // select + expand + highlight
  assert.equal(focusDecos(h).length, 3);

  const before = h.view._focusCalls();
  const occ = h.host.querySelector('.tag-occurrence');
  assert.ok(occ, 'occurrence rows present');
  occ.dispatchEvent(new h.dom.window.Event('click', { bubbles: true }));
  assert.ok(h.view._focusCalls() > before, 'jump ran (editor focused) — V1.2 navigation intact');
  // The jump is selection-only, so the focus highlight survives it.
  assert.equal(focusDecos(h).length, 3, 'highlight survives the jump');
});

test('TagsPanel V1.3 #6: selecting an entity does not change document content', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();
  const before = h.view.state.doc;
  clickRow(h, rowByName(h, 'NALI'));
  assert.ok(before.eq(h.view.state.doc), 'document byte-identical — highlight is decoration only');
});
