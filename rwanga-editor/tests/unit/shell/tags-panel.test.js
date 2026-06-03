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
  let state = PMstate.EditorState.create({
    schema: schema, doc: docNode,
    plugins: navPlugin ? [navPlugin] : []
  });
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

  // BABAN: curated, never tagged → count 0 (still listed — curation is real data).
  const baban = Array.from(items).find(function(el) {
    return el.querySelector('.tag-name').textContent === 'BABAN';
  });
  assert.ok(baban, 'curated-but-untagged entity still listed');
  assert.equal(baban.querySelector('.tag-count').textContent, '0');

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

test('TagsPanel: clicking an entity row moves the editor selection to the FIRST occurrence', () => {
  const h = boot();
  seedEntities(h);
  h.activatePanel();

  // First NALI occurrence is in scene 1 ("NALI stands by the window…").
  const firstOccurrence = h.occurrencesOf('NALI')[0];

  const nali = Array.from(h.host.querySelectorAll('.tag-item')).find(function(el) {
    return el.querySelector('.tag-name').textContent === 'NALI';
  });
  nali.dispatchEvent(new h.dom.window.Event('click', { bubbles: true }));

  const sel = h.view.state.selection;
  assert.ok(sel.from >= firstOccurrence.from && sel.from <= firstOccurrence.to,
    'selection landed inside the first NALI occurrence (got ' + sel.from +
    ', expected within [' + firstOccurrence.from + ',' + firstOccurrence.to + '])');
  assert.ok(h.view._focusCalls() > 0, 'editor receives focus after the jump');
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
