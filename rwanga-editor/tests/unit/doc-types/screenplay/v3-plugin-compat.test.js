// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 5 — plugin compatibility against a v3 EditorView.
//
// Verifies that the existing v2-era PM plugins for notes / tags / flags
// work transparently on a v3 document. The plugins are schema-agnostic
// (they read view.state.schema.marks.<name> and dispatch tr.addMark /
// removeMark), so the contract here is: when you boot the same plugin
// against a v3 doc, every public API path (add / edit / resolve / restore
// / remove) still mutates state correctly.
//
// This is what the directive's "toolbar actions work" + "context menu
// actions work" acceptance criteria reduce to at the schema level —
// the toolbar and context menu are thin DOM wrappers around these
// same plugin functions.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot(initialDocJson) {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  // Node 19+ exposes its own global CustomEvent; the plugins call
  // `new CustomEvent(...)` and then dispatch on jsdom's document, which
  // rejects Events constructed by Node's class. Force the plugins to
  // pick up jsdom's CustomEvent by aliasing it onto globalThis.
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.window.Rga = {};

  // Polyfill crypto.randomUUID inside the jsdom window if missing
  // (older jsdom builds don't expose it; the plugins call it directly).
  if (!global.window.crypto) {
    global.window.crypto = { randomUUID: function() {
      return 'uuid-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now();
    } };
  } else if (!global.window.crypto.randomUUID) {
    global.window.crypto.randomUUID = function() {
      return 'uuid-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now();
    };
  }

  const PMstate = require('prosemirror-state');
  const PMview  = require('prosemirror-view');
  const PMmodel = require('prosemirror-model');
  global.window.RgaProseMirror = {
    EditorState:   PMstate.EditorState,
    EditorView:    PMview.EditorView,
    Schema:        PMmodel.Schema,
    PMNode:        PMmodel.Node,
    Plugin:        PMstate.Plugin,
    PluginKey:     PMstate.PluginKey,
    TextSelection: PMstate.TextSelection,
    Decoration:    PMview.Decoration,
    DecorationSet: PMview.DecorationSet
  };

  // Stub TabManager.activeDoc so tags.js / nav-index plugin find a doc.
  const activeDoc = {
    tagRegistry: { characters: [], props: [], wardrobe: [], locations: [], sfx: [], vfx: [], vehicles: [], animals: [], custom: [] },
    settings: { vocabulary: { settings: ['INT.', 'EXT.'], times: ['DAY', 'NIGHT'], sceneWord: 'SCENE' } }
  };
  global.window.Rga.TabManager = {
    activeDoc: function() { return activeDoc; },
    activeTab: function() { return { doc: activeDoc }; }
  };
  // Stub Rga.Doc so tags.js applyTagFromSelection can register new entities.
  const REGISTRY_KEY = { character: 'characters', prop: 'props', wardrobe: 'wardrobe', location: 'locations', sfx: 'sfx', vfx: 'vfx', vehicle: 'vehicles', animal: 'animals', custom: 'custom' };
  global.window.Rga.Doc = {
    _registryKey: REGISTRY_KEY,
    addEntity: function(doc, tagType, entity) {
      const key = REGISTRY_KEY[tagType] || tagType;
      doc.tagRegistry[key] = doc.tagRegistry[key] || [];
      doc.tagRegistry[key].push(entity);
    },
    findEntity: function(doc, tagType, entityId) {
      const key = REGISTRY_KEY[tagType] || tagType;
      const list = doc.tagRegistry[key] || [];
      return list.find(function(e) { return e.id === entityId; }) || null;
    }
  };

  // Load order: base marks → outline → nav-index → schema → plugins.
  const paths = [
    '../../../../renderer/js/framework/base-outer-marks.js',
    '../../../../renderer/js/framework/document-outline.js',
    '../../../../renderer/js/framework/nav-index.js',
    '../../../../renderer/js/doc-types/screenplay/schema-v3.js',
    '../../../../renderer/js/doc-types/screenplay/v3-commands.js',
    '../../../../renderer/js/doc-types/screenplay/v3-keymap.js',
    '../../../../renderer/js/doc-types/screenplay/v3-node-views.js',
    '../../../../renderer/js/doc-types/screenplay/plugins/annotations.js',
    '../../../../renderer/js/doc-types/screenplay/plugins/tags.js',
    '../../../../renderer/js/doc-types/screenplay/plugins/revision-flags.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const sp = global.window.Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  const schema = sp.buildSchemaV3();

  // Build a v3 doc with a single scene containing one action block with text.
  let docNode;
  if (initialDocJson) {
    docNode = schema.nodeFromJSON(initialDocJson);
  } else {
    const heading = schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null });
    const action  = schema.nodes.action.create(null, schema.text('Alex enters the room and waves.'));
    const transition = schema.nodes.transition.create({ presetType: 'CUT' }, schema.text('CUT'));
    const scene = schema.nodes.scene.create(
      { id: 'sc-1', notes: '', revisionFlag: null, metadata: { linkedScenes: [], references: [], production: {} } },
      [heading, action, transition]
    );
    const body = schema.nodes.body.create(null, [scene]);
    const title = schema.nodes.titleStrip.create({ removable: true });
    docNode = schema.nodes.doc.create(null, [title, body]);
  }

  const PM = global.window.RgaProseMirror;
  const plugins = [].concat(sp.buildV3ScenePlugins());
  const state = PM.EditorState.create({ schema: schema, doc: docNode, plugins: plugins });
  const editorEl = document.getElementById('editor');
  const view = new PM.EditorView(editorEl, { state: state, nodeViews: sp.buildV3NodeViews() });

  // Helper: select a range over the first action block text "Alex".
  function selectActionRange(startOffset, endOffset) {
    let actionStart = null;
    view.state.doc.descendants(function(n, p) {
      if (n.type.name === 'action' && actionStart === null) actionStart = p + 1;
    });
    const from = actionStart + startOffset;
    const to = actionStart + endOffset;
    view.dispatch(view.state.tr.setSelection(PM.TextSelection.create(view.state.doc, from, to)));
  }

  function countMarks(markName) {
    let count = 0;
    view.state.doc.descendants(function(n) {
      if (n.isText) {
        n.marks.forEach(function(m) { if (m.type.name === markName) count += 1; });
      }
    });
    return count;
  }

  function findMark(markName, predicate) {
    let found = null;
    view.state.doc.descendants(function(n) {
      if (found) return false;
      if (n.isText) {
        n.marks.forEach(function(m) {
          if (m.type.name === markName && (!predicate || predicate(m))) {
            found = m;
          }
        });
      }
    });
    return found;
  }

  return { view, schema, PM, sp, selectActionRange, countMarks, findMark, activeDoc };
}

// ----------------------------------------------------------------
// Annotations (notes)
// ----------------------------------------------------------------

test('annotations: addAnnotation creates annotation mark on selection of v3 doc', () => {
  const { view, selectActionRange, countMarks, findMark } = boot();
  selectActionRange(0, 4); // "Alex"
  global.window.Rga.Annotations.addAnnotation(view, { text: 'verify spelling', color: '#FFE08A' });
  assert.equal(countMarks('annotation'), 1);
  const m = findMark('annotation');
  assert.equal(m.attrs.text, 'verify spelling');
  assert.equal(m.attrs.status, 'open');
  assert.equal(m.attrs.color, '#FFE08A');
});

test('annotations: updateAnnotationText changes mark.attrs.text on v3 doc', () => {
  const { view, selectActionRange, findMark } = boot();
  selectActionRange(0, 4);
  global.window.Rga.Annotations.addAnnotation(view, { id: 'n1', text: 'old' });
  global.window.Rga.Annotations.updateAnnotationText(view, 'n1', 'new');
  const m = findMark('annotation', function(mk) { return mk.attrs.id === 'n1'; });
  assert.equal(m.attrs.text, 'new');
});

test('annotations: resolveAnnotation flips status open → resolved (keeps mark)', () => {
  const { view, selectActionRange, findMark, countMarks } = boot();
  selectActionRange(0, 4);
  global.window.Rga.Annotations.addAnnotation(view, { id: 'n2', text: 'x' });
  global.window.Rga.Annotations.resolveAnnotation(view, 'n2');
  assert.equal(countMarks('annotation'), 1, 'mark still present');
  const m = findMark('annotation', function(mk) { return mk.attrs.id === 'n2'; });
  assert.equal(m.attrs.status, 'resolved');
});

test('annotations: restoreAnnotation flips resolved → open', () => {
  const { view, selectActionRange, findMark } = boot();
  selectActionRange(0, 4);
  global.window.Rga.Annotations.addAnnotation(view, { id: 'n3' });
  global.window.Rga.Annotations.resolveAnnotation(view, 'n3');
  global.window.Rga.Annotations.restoreAnnotation(view, 'n3');
  const m = findMark('annotation', function(mk) { return mk.attrs.id === 'n3'; });
  assert.equal(m.attrs.status, 'open');
});

test('annotations: removeAnnotation removes the mark entirely', () => {
  const { view, selectActionRange, countMarks } = boot();
  selectActionRange(0, 4);
  global.window.Rga.Annotations.addAnnotation(view, { id: 'n4' });
  assert.equal(countMarks('annotation'), 1);
  global.window.Rga.Annotations.removeAnnotation(view, 'n4');
  assert.equal(countMarks('annotation'), 0);
});

test('annotations: addNoteFromMenu mirrors context-menu "Add note" flow on v3 doc', () => {
  const { view, selectActionRange, countMarks } = boot();
  selectActionRange(0, 4);
  global.window.Rga.Annotations.addNoteFromMenu(view);
  assert.equal(countMarks('annotation'), 1);
});

test('annotations: addNoteFromMenu is a no-op when selection is empty', () => {
  const { view, countMarks } = boot();
  // No selection range set → selection is empty (collapsed at doc start)
  global.window.Rga.Annotations.addNoteFromMenu(view);
  assert.equal(countMarks('annotation'), 0);
});

// ----------------------------------------------------------------
// Tags
// ----------------------------------------------------------------

test('tags: applyTag creates a tag mark with tagType + entityId on v3 doc', () => {
  const { view, selectActionRange, findMark } = boot();
  selectActionRange(0, 4);
  global.window.Rga.Tags.applyTag(view, 'character', 'nali-id');
  const m = findMark('tag');
  assert.ok(m);
  assert.equal(m.attrs.tagType, 'character');
  assert.equal(m.attrs.entityId, 'nali-id');
});

test('tags: removeTag clears all tag marks for that entityId', () => {
  const { view, selectActionRange, countMarks } = boot();
  selectActionRange(0, 4);
  global.window.Rga.Tags.applyTag(view, 'character', 'nali-id');
  assert.equal(countMarks('tag'), 1);
  global.window.Rga.Tags.removeTag(view, 'character', 'nali-id');
  assert.equal(countMarks('tag'), 0);
});

test('tags: showTagDialog (context-menu entry) creates entity + applies mark on v3 doc', () => {
  const { view, selectActionRange, findMark, activeDoc } = boot();
  selectActionRange(0, 4); // "Alex"
  global.window.Rga.Tags.showTagDialog(view, 'character');
  // New character entity registered under that name.
  const ent = activeDoc.tagRegistry.characters.find(function(e) { return e.name === 'Alex'; });
  assert.ok(ent, 'character entity registered for selected text');
  // And a tag mark with that entityId is on the text.
  const m = findMark('tag', function(mk) { return mk.attrs.entityId === ent.id; });
  assert.ok(m);
});

test('tags: showTagDialog reuses an existing entity name (case-insensitive)', () => {
  const { view, selectActionRange, findMark, activeDoc } = boot();
  // Pre-register entity.
  activeDoc.tagRegistry.characters.push({ id: 'pre', name: 'alex', color: null });
  selectActionRange(0, 4); // "Alex"
  global.window.Rga.Tags.showTagDialog(view, 'character');
  // Should NOT add another entity — uses the existing one.
  assert.equal(activeDoc.tagRegistry.characters.length, 1);
  const m = findMark('tag');
  assert.equal(m.attrs.entityId, 'pre');
});

// ----------------------------------------------------------------
// Revision flags
// ----------------------------------------------------------------

test('flags: addRevisionFlag creates a revisionFlag mark on v3 doc', () => {
  const { view, selectActionRange, findMark } = boot();
  selectActionRange(0, 4);
  global.window.Rga.RevisionFlags.addRevisionFlag(view, { reason: 'rewrite', color: '#f00' });
  const m = findMark('revisionFlag');
  assert.ok(m);
  assert.equal(m.attrs.reason, 'rewrite');
  assert.equal(m.attrs.color, '#f00');
  assert.equal(m.attrs.status, 'open');
});

test('flags: updateRevisionFlag changes reason/color over a range on v3 doc', () => {
  const { view, selectActionRange, findMark } = boot();
  selectActionRange(0, 4);
  const range = { from: view.state.selection.from, to: view.state.selection.to };
  global.window.Rga.RevisionFlags.addRevisionFlag(view, { id: 'fl-u', reason: 'old' });
  global.window.Rga.RevisionFlags.updateRevisionFlag(view, range.from, range.to, { reason: 'new', color: '#ff0' });
  const m = findMark('revisionFlag', function(mk) { return mk.attrs.id === 'fl-u'; });
  assert.equal(m.attrs.reason, 'new');
  assert.equal(m.attrs.color, '#ff0');
});

test('flags: removeRevisionFlag clears mark across a range', () => {
  const { view, selectActionRange, countMarks } = boot();
  selectActionRange(0, 4);
  const range = { from: view.state.selection.from, to: view.state.selection.to };
  global.window.Rga.RevisionFlags.addRevisionFlag(view, { id: 'fl-r', reason: 'fix' });
  assert.equal(countMarks('revisionFlag'), 1);
  global.window.Rga.RevisionFlags.removeRevisionFlag(view, range.from, range.to);
  assert.equal(countMarks('revisionFlag'), 0);
});

// ----------------------------------------------------------------
// NavigationIndex live-tracks plugin-side mark mutations
// ----------------------------------------------------------------

test('NavigationIndex.notes/flags/characters update after plugin-driven mark mutations', () => {
  const { view, selectActionRange } = boot();
  const Nav = global.window.Rga.Nav;

  // Initially: no marks.
  let idx = Nav.getIndex(view.state);
  assert.equal(idx.notes.length, 0);
  assert.equal(idx.flags.length, 0);
  assert.equal(idx.characters.length, 0);

  // Add a note.
  selectActionRange(0, 4);
  global.window.Rga.Annotations.addAnnotation(view, { id: 'n', text: 'note' });
  idx = Nav.getIndex(view.state);
  assert.equal(idx.notes.length, 1);
  assert.equal(idx.scenes[0].hasNotes, true);

  // Add a flag.
  selectActionRange(5, 10);
  global.window.Rga.RevisionFlags.addRevisionFlag(view, { reason: 'rewrite' });
  idx = Nav.getIndex(view.state);
  assert.equal(idx.flags.length, 1);

  // Add a character tag.
  selectActionRange(11, 14);
  global.window.Rga.Tags.applyTag(view, 'character', 'ent-1');
  idx = Nav.getIndex(view.state);
  assert.equal(idx.characters.length, 1);
  assert.equal(idx.characters[0].nodeId, 'ent-1');
  assert.equal(idx.characters[0].mentionCount, 1);
});

// ----------------------------------------------------------------
// scene.attrs.notes — the scene-level notes field (separate from
// annotation marks). Set via setNodeMarkup; round-trips through state.
// ----------------------------------------------------------------

test('scene.attrs.notes is settable via setNodeMarkup and reflected in NavigationIndex', () => {
  const { view, schema, PM } = boot();
  const Nav = global.window.Rga.Nav;

  // Find the scene's pos.
  let scenePos = null;
  view.state.doc.descendants(function(n, p) {
    if (n.type.name === 'scene' && scenePos === null) scenePos = p;
  });
  const sceneNode = view.state.doc.nodeAt(scenePos);
  // Mutate scene.attrs.notes.
  const newAttrs = Object.assign({}, sceneNode.attrs, { notes: 'director: revisit the pacing here' });
  view.dispatch(view.state.tr.setNodeMarkup(scenePos, null, newAttrs));
  // Verify the field stuck.
  const updated = view.state.doc.nodeAt(scenePos);
  assert.equal(updated.attrs.notes, 'director: revisit the pacing here');
  // NavigationIndex flags hasNotes=true.
  const idx = Nav.getIndex(view.state);
  assert.equal(idx.scenes[0].hasNotes, true);
});
