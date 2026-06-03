// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Registry Identity Integrity — Slice A: reuse-before-create.
// Spec: docs/Filmustageation/REGISTRY_IDENTITY_INTEGRITY_AUDIT.md §7
//
// The toolbar Tag dropdown (primary tagging UI) must acquire entity ids
// through the SAME case-insensitive reuse-before-create lookup that
// showTagDialog (Ctrl+Shift+T path) already performs, via one shared
// helper (Rga.Tags.findOrCreateEntity) so the two paths can never
// diverge again.
//
// Identity is type-scoped: Character:NALI and Prop:NALI stay distinct.
//
// Everything on the identity path here is REAL code — real doc.js
// registry, real plugins/tags.js, real toolbar-tag.js, real v3 schema,
// real ProseMirror state/transactions. No stubs on the path under test.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const FIXTURE_PATH = path.resolve(__dirname, '..', '..', '..', 'fixtures', 'playground-the-last-light.rga');

const TOOLBAR_HTML = '<!DOCTYPE html><html><body>' +
  '<div id="rga-shell-toolbar">' +
    '<div class="rga-shell-toolbar-inner">' +
      '<div class="rga-shell-toolbar-content-slot" data-toolbar-slot="content"></div>' +
    '</div>' +
  '</div>' +
  '</body></html>';

// ----------------------------------------------------------------
// Boot — real doc.js + real tags.js + real toolbar-tag.js + real
// v3 schema over real PM state. TabManager is the only stub (it is
// pure wiring: hands the doc and the view to the code under test).
// ----------------------------------------------------------------
function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM(TOOLBAR_HTML, { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  // Plugins construct `new CustomEvent(...)` / `new Event(...)` and
  // dispatch on jsdom's document — alias jsdom's constructors globally
  // (same workaround as v3-plugin-compat.test.js).
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

  // REAL modules — load order mirrors renderer/index.html.
  const files = [
    '../../../../renderer/js/constants.js',
    '../../../../renderer/js/doc.js',
    '../../../../renderer/js/shell/toolbar.js',
    '../../../../renderer/js/framework/base-outer-marks.js',
    '../../../../renderer/js/framework/document-outline.js',
    '../../../../renderer/js/framework/slug-resolver.js',
    '../../../../renderer/js/framework/nav-index.js',
    '../../../../renderer/js/doc-types/screenplay/schema-v3.js',
    '../../../../renderer/js/doc-types/screenplay/plugins/tags.js',
    '../../../../renderer/js/doc-types/screenplay/toolbar-tag.js'
  ];
  files.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;

  // Toolbar host (same soft-reset + re-require dance as toolbar-tag.test.js).
  Rga.Shell.Toolbar._reset();
  delete require.cache[require.resolve('../../../../renderer/js/doc-types/screenplay/toolbar-tag.js')];
  require('../../../../renderer/js/doc-types/screenplay/toolbar-tag.js');
  const slotEl = global.document.querySelector('[data-toolbar-slot="content"]');
  Rga.Shell.Toolbar.setHost(slotEl);

  // Real v3 schema.
  const sp = Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  const schema = sp.buildSchemaV3();

  // Real doc — fresh (empty registry) or deserialized fixture.
  let doc;
  let docNode;
  if (opts.fixture) {
    const content = fs.readFileSync(FIXTURE_PATH, 'utf8');
    doc = Rga.Doc.deserialize(content, null, { schema: schema });
    docNode = doc.body;
  } else {
    doc = Rga.Doc.create();
    // Two scenes whose action text contains the names we tag.
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
      scene('sc-1', 'NALI stands by the window.'),
      scene('sc-2', 'Nali looks at NALI in the mirror.')
    ]);
    const title = schema.nodes.titleStrip.create({ removable: true });
    docNode = schema.nodes.doc.create(null, [title, body]);
  }

  // Real PM state behind a minimal view shim (state/transactions/marks
  // are all real; only focus() is inert).
  let state = PMstate.EditorState.create({ schema: schema, doc: docNode });
  const view = {
    get state() { return state; },
    dispatch: function(tr) { state = state.apply(tr); },
    focus: function() {}
  };

  // TabManager wiring stub — hands the REAL doc + REAL view to the code.
  Rga.TabManager = {
    _editorView: function() { return view; },
    activeDoc:   function() { return doc; },
    activeTab:   function() { return { doc: doc }; }
  };

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  // All [from,to) ranges of `needle` across text nodes, in doc order.
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

  function selectOccurrence(needle, nth) {
    const occ = occurrencesOf(needle);
    const target = occ[nth || 0];
    if (!target) throw new Error('No occurrence #' + (nth || 0) + ' of "' + needle + '" in doc');
    view.dispatch(view.state.tr.setSelection(
      PMstate.TextSelection.create(view.state.doc, target.from, target.to)));
    return target;
  }

  function tagViaToolbar(category) {
    const select = slotEl.querySelector('select.rga-shell-toolbar-tag');
    select.value = category;
    select.dispatchEvent(new dom.window.Event('change'));
  }

  function tagMarks(tagType) {
    const out = [];
    view.state.doc.descendants(function(node, pos) {
      if (!node.isText) return;
      node.marks.forEach(function(m) {
        if (m.type.name === 'tag' && (!tagType || m.attrs.tagType === tagType)) {
          out.push({ pos: pos, tagType: m.attrs.tagType, entityId: m.attrs.entityId });
        }
      });
    });
    return out;
  }

  return {
    Rga: Rga, doc: doc, view: view, schema: schema, dom: dom,
    selectOccurrence: selectOccurrence,
    tagViaToolbar: tagViaToolbar,
    tagMarks: tagMarks
  };
}

// ================================================================
// §1 — Shared helper exists (one source of truth)
// ================================================================

test('Slice A: Rga.Tags.findOrCreateEntity is the shared reuse-before-create helper', () => {
  const h = boot();
  assert.equal(typeof h.Rga.Tags.findOrCreateEntity, 'function',
    'Rga.Tags.findOrCreateEntity must exist so toolbar + dialog paths share ONE lookup');
});

test('Slice A: findOrCreateEntity reuses an existing entity by case-insensitive name', () => {
  const h = boot();
  const firstId = h.Rga.Tags.findOrCreateEntity(h.doc, 'character', 'NALI');
  const secondId = h.Rga.Tags.findOrCreateEntity(h.doc, 'character', 'Nali');
  assert.equal(firstId, secondId, 'case variant must resolve to the same entity');
  assert.equal(h.doc.tagRegistry.characters.length, 1);
  assert.equal(h.doc.tagRegistry.characters[0].name, 'NALI');
});

test('Slice A: findOrCreateEntity is type-scoped — Character:NALI ≠ Prop:NALI', () => {
  const h = boot();
  const charId = h.Rga.Tags.findOrCreateEntity(h.doc, 'character', 'NALI');
  const propId = h.Rga.Tags.findOrCreateEntity(h.doc, 'prop', 'NALI');
  assert.notEqual(charId, propId, 'same name in different tag types = different entities');
  assert.equal(h.doc.tagRegistry.characters.length, 1);
  assert.equal(h.doc.tagRegistry.props.length, 1);
});

test('Slice A: findOrCreateEntity trims and ignores surrounding whitespace', () => {
  const h = boot();
  const a = h.Rga.Tags.findOrCreateEntity(h.doc, 'character', 'NALI');
  const b = h.Rga.Tags.findOrCreateEntity(h.doc, 'character', '  NALI  ');
  assert.equal(a, b);
  assert.equal(h.doc.tagRegistry.characters.length, 1);
});

// ================================================================
// §2 — Toolbar path: reuse-before-create (the fix itself)
// ================================================================

test('Slice A: toolbar — tagging NALI twice creates ONE character entity, both marks share its id', () => {
  const h = boot();
  h.selectOccurrence('NALI', 0);          // scene 1
  h.tagViaToolbar('character');
  h.selectOccurrence('NALI', 1);          // scene 2
  h.tagViaToolbar('character');

  assert.equal(h.doc.tagRegistry.characters.length, 1,
    'tagging the same name twice must NOT create a second entity');
  const entity = h.doc.tagRegistry.characters[0];
  assert.equal(entity.name, 'NALI');

  const marks = h.tagMarks('character');
  assert.equal(marks.length, 2, 'both selections carry a tag mark');
  assert.equal(marks[0].entityId, marks[1].entityId, 'both marks point at the same entity');
  assert.equal(marks[0].entityId, entity.id, 'marks point at the registry entity');
});

test('Slice A: toolbar — tagging "Nali" after "NALI" reuses the same entity (case-insensitive)', () => {
  const h = boot();
  h.selectOccurrence('NALI', 0);
  h.tagViaToolbar('character');
  h.selectOccurrence('Nali', 0);          // case variant in scene 2
  h.tagViaToolbar('character');

  assert.equal(h.doc.tagRegistry.characters.length, 1,
    'case variant must NOT create a second entity');
  const marks = h.tagMarks('character');
  assert.equal(marks.length, 2);
  assert.equal(marks[0].entityId, marks[1].entityId);
});

test('Slice A: toolbar — Character NALI + Prop NALI = TWO entities (type-scoped identity)', () => {
  const h = boot();
  h.selectOccurrence('NALI', 0);
  h.tagViaToolbar('character');
  h.selectOccurrence('NALI', 1);
  h.tagViaToolbar('prop');

  assert.equal(h.doc.tagRegistry.characters.length, 1, 'one character NALI');
  assert.equal(h.doc.tagRegistry.props.length, 1, 'one prop NALI');
  assert.notEqual(h.doc.tagRegistry.characters[0].id, h.doc.tagRegistry.props[0].id,
    'type-scoped identity: the two NALI entities stay distinct');

  const charMarks = h.tagMarks('character');
  const propMarks = h.tagMarks('prop');
  assert.equal(charMarks[0].entityId, h.doc.tagRegistry.characters[0].id);
  assert.equal(propMarks[0].entityId, h.doc.tagRegistry.props[0].id);
});

// ================================================================
// §3 — Cross-path: toolbar and showTagDialog share identity (D5 stops)
// ================================================================

test('Slice A: cross-path — toolbar tag after showTagDialog reuses the SAME entity', () => {
  const h = boot();
  h.selectOccurrence('NALI', 0);
  h.Rga.Tags.showTagDialog(h.view, 'character');
  assert.equal(h.doc.tagRegistry.characters.length, 1, 'dialog created the entity');
  const dialogEntityId = h.doc.tagRegistry.characters[0].id;

  h.selectOccurrence('NALI', 1);
  h.tagViaToolbar('character');
  assert.equal(h.doc.tagRegistry.characters.length, 1,
    'toolbar must reuse the entity the dialog created — no cross-path split');

  const marks = h.tagMarks('character');
  assert.equal(marks.length, 2);
  marks.forEach(function(m) { assert.equal(m.entityId, dialogEntityId); });
});

test('Slice A: cross-path — showTagDialog after toolbar reuses the SAME entity', () => {
  const h = boot();
  h.selectOccurrence('NALI', 0);
  h.tagViaToolbar('character');
  assert.equal(h.doc.tagRegistry.characters.length, 1);
  const toolbarEntityId = h.doc.tagRegistry.characters[0].id;

  h.selectOccurrence('Nali', 0);
  h.Rga.Tags.showTagDialog(h.view, 'character');
  assert.equal(h.doc.tagRegistry.characters.length, 1,
    'dialog must reuse the entity the toolbar created');

  const marks = h.tagMarks('character');
  assert.equal(marks.length, 2);
  marks.forEach(function(m) { assert.equal(m.entityId, toolbarEntityId); });
});

// ================================================================
// §4 — Existing showTagDialog behavior preserved (regression guards)
// ================================================================

test('Slice A: showTagDialog — still creates a new entity when no match exists', () => {
  const h = boot();
  h.selectOccurrence('NALI', 0);
  h.Rga.Tags.showTagDialog(h.view, 'character');

  assert.equal(h.doc.tagRegistry.characters.length, 1);
  const ent = h.doc.tagRegistry.characters[0];
  assert.equal(ent.name, 'NALI');
  const marks = h.tagMarks('character');
  assert.equal(marks.length, 1);
  assert.equal(marks[0].entityId, ent.id);
});

test('Slice A: showTagDialog — still reuses a pre-existing entity (case-insensitive)', () => {
  const h = boot();
  // Pre-seed the registry the way a curated script would.
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-nali', name: 'nali', color: '#4FC1FF', notes: 'curated' });

  h.selectOccurrence('NALI', 0);
  h.Rga.Tags.showTagDialog(h.view, 'character');

  assert.equal(h.doc.tagRegistry.characters.length, 1, 'no duplicate of the curated entity');
  const marks = h.tagMarks('character');
  assert.equal(marks[0].entityId, 'ent-nali', 'mark points at the curated entity');
  // Curation survives untouched.
  assert.equal(h.doc.tagRegistry.characters[0].color, '#4FC1FF');
  assert.equal(h.doc.tagRegistry.characters[0].notes, 'curated');
});

// ================================================================
// §5 — Curated reuse + existing marks preserve entityId
// ================================================================

test('Slice A: toolbar — reuses a curated entity; its color/notes survive; mark points at it', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-nali', name: 'NALI', color: '#4FC1FF', notes: 'Protagonist.' });

  h.selectOccurrence('Nali', 0);
  h.tagViaToolbar('character');

  assert.equal(h.doc.tagRegistry.characters.length, 1,
    'toolbar must reuse the curated entity, not mint a colorless twin (audit D4)');
  const marks = h.tagMarks('character');
  assert.equal(marks[0].entityId, 'ent-nali');
  assert.equal(h.doc.tagRegistry.characters[0].color, '#4FC1FF');
  assert.equal(h.doc.tagRegistry.characters[0].notes, 'Protagonist.');
});

test('Slice A: fixture — tagging NALI again adds NO 7th entity; existing marks keep their entityIds', () => {
  const h = boot({ fixture: true });
  const before = h.doc.tagRegistry.characters.length;
  assert.equal(before, 6, 'fixture ground truth: 3 curated + 3 historical duplicates');
  const marksBefore = h.tagMarks(null);

  h.selectOccurrence('NALI', 0);
  h.tagViaToolbar('character');

  assert.equal(h.doc.tagRegistry.characters.length, before,
    'reuse-before-create: no new entity for a name that already exists');

  // The new mark points at the FIRST case-insensitive match — the
  // curated ent-nali (first in the fixture list), not a new UUID.
  const marksAfter = h.tagMarks(null);
  assert.equal(marksAfter.length, marksBefore.length + 1, 'exactly one mark added');

  // Every pre-existing mark survives with its entityId untouched.
  marksBefore.forEach(function(m) {
    const still = marksAfter.find(function(a) {
      return a.pos === m.pos && a.tagType === m.tagType && a.entityId === m.entityId;
    });
    assert.ok(still, 'pre-existing mark at pos ' + m.pos + ' keeps entityId ' + m.entityId);
  });

  // The added mark reuses ent-nali.
  const added = marksAfter.filter(function(a) {
    return !marksBefore.some(function(m) {
      return m.pos === a.pos && m.tagType === a.tagType && m.entityId === a.entityId;
    });
  });
  assert.equal(added.length, 1);
  assert.equal(added[0].entityId, 'ent-nali',
    'reuse resolves to the first case-insensitive match (the curated entity)');
});

// ================================================================
// §6 — Existing tagged documents load unchanged (no dedup on load)
// ================================================================

test('Slice A: fixture — deserialize leaves the registry exactly as stored (duplicates included)', () => {
  const h = boot({ fixture: true });
  const parsed = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

  // The registry is taken as-is: every entity (including the historical
  // duplicates) survives load. Healing duplicates is Slice B, not load.
  assert.deepEqual(h.doc.tagRegistry, parsed.tag_registry,
    'doc.js stays dumb: no dedup, no normalization, no reordering on load');
  assert.equal(h.doc.tagRegistry.characters.length, 6);
  assert.equal(h.doc.tagRegistry.props.length, 3);
});

test('Slice A: fixture — serialize round-trips the registry byte-identically (no silent rewrites)', () => {
  const h = boot({ fixture: true });
  const parsed = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const reserialized = JSON.parse(h.Rga.Doc.serialize(h.doc));
  assert.deepEqual(reserialized.tag_registry, parsed.tag_registry,
    'loading + saving a tagged document must not alter its registry');
});

// ================================================================
// §7 — Slice B2 (consumer rule C1): lookup domain is LIVE entities only
// Design: SCOPED_REGISTRY_MERGE_API_DESIGN.md §4 C1, §5.2
// ================================================================

test('Slice B2: findOrCreateEntity skips tombstones — live entity wins even when the tombstone sits first', () => {
  const h = boot();
  // Tombstone FIRST in registry array order, live survivor second —
  // the exact array-order-roulette case rule C1 exists to prevent.
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-old', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-live', name: 'NALI' });
  assert.equal(h.Rga.Doc.markEntityMerged(h.doc, 'character', 'ent-old', 'ent-live'), true);

  const id = h.Rga.Tags.findOrCreateEntity(h.doc, 'character', 'NALI');
  assert.equal(id, 'ent-live',
    'lookup must return the LIVE entity, never the tombstone (even though the tombstone is first in array order)');
  assert.equal(h.doc.tagRegistry.characters.length, 2, 'no new entity created');
});

test('Slice B2: findOrCreateEntity creates a fresh live entity when only a tombstone matches the name', () => {
  const h = boot();
  // Tombstone "NALI" whose survivor was later renamed — no live "NALI" remains.
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-old', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-renamed', name: 'NALI' });
  h.Rga.Doc.markEntityMerged(h.doc, 'character', 'ent-old', 'ent-renamed');
  // Simulates a post-merge rename of the survivor (file-loaded state).
  h.Rga.Doc.findEntity(h.doc, 'character', 'ent-renamed').name = 'NALI YOUNGER';

  const id = h.Rga.Tags.findOrCreateEntity(h.doc, 'character', 'NALI');
  assert.notEqual(id, 'ent-old', 'a tombstone is never resurrected by tagging');
  assert.notEqual(id, 'ent-renamed', 'the renamed survivor does not match "NALI"');
  assert.equal(h.doc.tagRegistry.characters.length, 3, 'a fresh live entity was created');
  assert.equal(h.Rga.Doc.isEntityMerged(h.doc, 'character', id), false, 'the new entity is live');
});

test('Slice B2: toolbar tagging after a merge points new marks at the survivor', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-old', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-survivor', name: 'NALI', color: '#4FC1FF' });
  h.Rga.Doc.markEntityMerged(h.doc, 'character', 'ent-old', 'ent-survivor');

  h.selectOccurrence('NALI', 0);
  h.tagViaToolbar('character');

  const marks = h.tagMarks('character');
  assert.equal(marks.length, 1);
  assert.equal(marks[0].entityId, 'ent-survivor',
    'the primary tagging UI must point new marks at the live survivor, never at a tombstone');
  assert.equal(h.doc.tagRegistry.characters.length, 2, 'no third entity minted');
});

test('Slice B2: showTagDialog after a merge reuses the survivor (shared helper, both paths protected)', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-old', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-survivor', name: 'NALI' });
  h.Rga.Doc.markEntityMerged(h.doc, 'character', 'ent-old', 'ent-survivor');

  h.selectOccurrence('Nali', 0);
  h.Rga.Tags.showTagDialog(h.view, 'character');

  const marks = h.tagMarks('character');
  assert.equal(marks.length, 1);
  assert.equal(marks[0].entityId, 'ent-survivor');
  assert.equal(h.doc.tagRegistry.characters.length, 2);
});
