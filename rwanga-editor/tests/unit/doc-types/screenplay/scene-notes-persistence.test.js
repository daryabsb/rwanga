// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation SN-Helper-2 — scene-level notes persistence into
// the active document's scene.attrs.notes PM attr.
//
// Coverage:
//   1. set() writes the note into scene.attrs.notes (PM transaction).
//   2. get() reads from scene.attrs.notes when an active view exists.
//   3. get() falls back to the in-memory scratchpad when no view.
//   4. serialize → deserialize (PM body round-trip) preserves the note.
//   5. set() still notifies subscribers.
//   6. set() with equal value is idempotent (no transaction, no notify).
//   7. set('') clears the note in PM attrs (persists empty string).
//   8. set on scene A leaves scene B's attrs.notes untouched.
//   9. Inline annotation marks are unaffected by set().
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
                        { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};

  const PMmodel = require('prosemirror-model');
  const PMstate = require('prosemirror-state');
  global.window.RgaProseMirror = {
    EditorState:  PMstate.EditorState,
    Schema:       PMmodel.Schema,
    PMNode:       PMmodel.Node,
    Plugin:       PMstate.Plugin,
    PluginKey:    PMstate.PluginKey
  };

  // Load the v3 screenplay schema (which carries scene.attrs.notes etc.)
  // and the SceneNotes module under test. base-outer-marks supplies the
  // annotation / tag / revisionFlag marks that scene-notes-persistence
  // §9 asserts remain unaffected by writes.
  [
    '../../../../renderer/js/framework/base-outer-marks.js',
    '../../../../renderer/js/doc-types/screenplay/schema-v3.js',
    '../../../../renderer/js/doc-types/screenplay/scene-notes.js'
  ].forEach(function(p) {
    delete require.cache[require.resolve(p)];
    require(p);
  });

  const sp = global.window.Rga.DocTypes.screenplay;
  if (sp._resetSchemaV3Cache) sp._resetSchemaV3Cache();
  const schema = sp.buildSchemaV3();
  const SN = global.window.Rga.SceneNotes;
  SN._reset();
  return { SN, schema, PM: global.window.RgaProseMirror };
}

// Build a doc with N scenes whose attrs.id are 'sc-0', 'sc-1', …
function makeDoc(schema, ids) {
  const scenes = ids.map(function(id) {
    return schema.nodes.scene.create(
      { id: id, notes: '', revisionFlag: null, metadata: null },
      [
        schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
        schema.nodes.action.create()
      ]
    );
  });
  const body = schema.nodes.body.create(null, scenes);
  const title = schema.nodes.titleStrip.create({ removable: true });
  return schema.nodes.doc.create(null, [title, body]);
}

// Build a stub view that wraps an EditorState and applies dispatched
// transactions. The real editor's dispatchTransaction wrapper does the
// markDirty + tab-bar update; that integration is not under test here
// — we test SceneNotes' contract, not the editor's plumbing.
function makeView(schema, doc) {
  const PM = global.window.RgaProseMirror;
  let state = PM.EditorState.create({ doc: doc, schema: schema });
  return {
    get state() { return state; },
    dispatch: function(tr) { state = state.apply(tr); }
  };
}

function attachView(view) {
  global.window.Rga.TabManager = {
    _editorView: function() { return view; },
    activeDoc:   function() { return null; }
  };
}

function detachView() {
  delete global.window.Rga.TabManager;
}

// Locate the scene node by id in a doc. Tiny re-walk for test inspection.
function sceneById(doc, id) {
  let found = null;
  doc.descendants(function(node) {
    if (found) return false;
    if (node.type.name === 'scene' && node.attrs && String(node.attrs.id) === String(id)) {
      found = node;
      return false;
    }
    return true;
  });
  return found;
}

// ----------------------------------------------------------------
// 1. set() writes the note into scene.attrs.notes (PM transaction).
// ----------------------------------------------------------------

test('SN-Helper-2: set() persists the note into the matching scene.attrs.notes via PM', () => {
  const { SN, schema } = boot();
  const view = makeView(schema, makeDoc(schema, ['sc-1', 'sc-2', 'sc-3']));
  attachView(view);
  SN.set('sc-2', 'a note that must survive');
  const sc2 = sceneById(view.state.doc, 'sc-2');
  assert.equal(sc2.attrs.notes, 'a note that must survive',
    'set() must dispatch a setNodeMarkup transaction that writes scene.attrs.notes');
});

// ----------------------------------------------------------------
// 2. get() reads from scene.attrs.notes when an active view exists.
// ----------------------------------------------------------------

test('SN-Helper-2: get() reads scene.attrs.notes from the active doc — even when scratchpad is empty', () => {
  const { SN, schema } = boot();
  // Build a doc whose scene already carries persisted text (as if
  // loaded from disk).
  const PRELOADED = 'hydrate from disk';
  const sceneWithText = schema.nodes.scene.create(
    { id: 'sc-1', notes: PRELOADED, revisionFlag: null, metadata: null },
    [schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
     schema.nodes.action.create()]
  );
  const body = schema.nodes.body.create(null, [sceneWithText]);
  const title = schema.nodes.titleStrip.create({ removable: true });
  const doc = schema.nodes.doc.create(null, [title, body]);
  const view = makeView(schema, doc);
  attachView(view);
  // SN was reset by boot() — no scratchpad entry exists. The fresh
  // get() must lazily read from the persisted PM attr.
  assert.equal(SN.get('sc-1'), PRELOADED,
    'get() with empty scratchpad must hydrate from scene.attrs.notes');
});

// ----------------------------------------------------------------
// 3. get() falls back to scratchpad when no active view is wired.
// ----------------------------------------------------------------

test('SN-Helper-2: get() falls back to the in-memory scratchpad when no active view', () => {
  const { SN } = boot();
  detachView();
  SN.set('s1', 'in-memory only');
  assert.equal(SN.get('s1'), 'in-memory only',
    'no view → scratchpad is the fallback store');
  assert.equal(SN.get('unknown'), '');
});

// ----------------------------------------------------------------
// 4. PM body.toJSON() → schema.nodeFromJSON() round-trip preserves the note.
// ----------------------------------------------------------------

test('SN-Helper-2: PM body serialize → deserialize round-trips the persisted scene.attrs.notes', () => {
  const { SN, schema } = boot();
  const view = makeView(schema, makeDoc(schema, ['sc-1', 'sc-2']));
  attachView(view);
  SN.set('sc-1', 'survives reload');
  SN.set('sc-2', 'also survives');
  // Capture body JSON (what .rga would store).
  const bodyJson = view.state.doc.toJSON();
  // Round-trip: nodeFromJSON against the same schema (the path
  // Rga.Doc.deserialize takes when re-opening a .rga file).
  const reloadedDoc = schema.nodeFromJSON(bodyJson);
  const sc1 = sceneById(reloadedDoc, 'sc-1');
  const sc2 = sceneById(reloadedDoc, 'sc-2');
  assert.equal(sc1.attrs.notes, 'survives reload');
  assert.equal(sc2.attrs.notes, 'also survives');
});

// ----------------------------------------------------------------
// 5. set() still notifies subscribers.
// ----------------------------------------------------------------

test('SN-Helper-2: set() still notifies subscribers on every value change', () => {
  const { SN, schema } = boot();
  const view = makeView(schema, makeDoc(schema, ['sc-1']));
  attachView(view);
  const events = [];
  const unsub = SN.subscribe(function(event, payload) {
    if (event === 'notes') events.push(payload);
  });
  SN.set('sc-1', 'first');
  SN.set('sc-1', 'second');
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], { sceneId: 'sc-1', value: 'first' });
  assert.deepEqual(events[1], { sceneId: 'sc-1', value: 'second' });
  unsub();
});

// ----------------------------------------------------------------
// 6. set() with equal value is idempotent.
// ----------------------------------------------------------------

test('SN-Helper-2: set() with the same value as already-persisted does NOT fire a transaction or a notify', () => {
  const { SN, schema } = boot();
  // Start with a scene whose attrs.notes is already 'identical'.
  const sceneWithText = schema.nodes.scene.create(
    { id: 'sc-1', notes: 'identical', revisionFlag: null, metadata: null },
    [schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
     schema.nodes.action.create()]
  );
  const body  = schema.nodes.body.create(null, [sceneWithText]);
  const title = schema.nodes.titleStrip.create({ removable: true });
  const view = makeView(schema, schema.nodes.doc.create(null, [title, body]));
  attachView(view);
  // Hydrate the scratchpad by reading (so the second set sees an equal
  // scratchpad value too, exercising the "no-op on equal value" branch).
  SN.get('sc-1');
  const initialJson = JSON.stringify(view.state.doc.toJSON());
  const events = [];
  SN.subscribe(function(e, p) { if (e === 'notes') events.push(p); });
  SN.set('sc-1', 'identical');
  // PM doc untouched (no transaction dispatched).
  assert.equal(JSON.stringify(view.state.doc.toJSON()), initialJson,
    'equal value must not produce a PM transaction');
  // No notification fired either.
  assert.equal(events.length, 0, 'equal value must not fire a notify');
});

// ----------------------------------------------------------------
// 7. set('') clears the note in PM attrs (persists empty string).
// ----------------------------------------------------------------

test('SN-Helper-2: set("") persists an empty string into scene.attrs.notes', () => {
  const { SN, schema } = boot();
  const view = makeView(schema, makeDoc(schema, ['sc-1']));
  attachView(view);
  SN.set('sc-1', 'to be cleared');
  assert.equal(sceneById(view.state.doc, 'sc-1').attrs.notes, 'to be cleared');
  SN.set('sc-1', '');
  assert.equal(sceneById(view.state.doc, 'sc-1').attrs.notes, '',
    'clearing must persist the empty string, not just remove the scratchpad entry');
  assert.equal(SN.get('sc-1'), '');
});

// ----------------------------------------------------------------
// 8. set on scene A leaves scene B's attrs.notes untouched.
// ----------------------------------------------------------------

test('SN-Helper-2: set on one scene does not modify any other scene', () => {
  const { SN, schema } = boot();
  // Pre-seed sc-2 with persisted text so we can detect collateral damage.
  const sceneA = schema.nodes.scene.create(
    { id: 'sc-1', notes: '', revisionFlag: null, metadata: null },
    [schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
     schema.nodes.action.create()]
  );
  const sceneB = schema.nodes.scene.create(
    { id: 'sc-2', notes: 'preexisting on sc-2', revisionFlag: null, metadata: null },
    [schema.nodes.sceneHeading.create({ setting: 'EXT.', time: 'NIGHT', headingStyle: null }),
     schema.nodes.action.create()]
  );
  const body  = schema.nodes.body.create(null, [sceneA, sceneB]);
  const title = schema.nodes.titleStrip.create({ removable: true });
  const view = makeView(schema, schema.nodes.doc.create(null, [title, body]));
  attachView(view);
  SN.set('sc-1', 'new on sc-1');
  // sc-1 updated, sc-2 untouched.
  assert.equal(sceneById(view.state.doc, 'sc-1').attrs.notes, 'new on sc-1');
  assert.equal(sceneById(view.state.doc, 'sc-2').attrs.notes, 'preexisting on sc-2');
});

// ----------------------------------------------------------------
// 9. Inline annotation marks are unaffected by scene-notes writes.
// ----------------------------------------------------------------

test('SN-Helper-2: writing scene.attrs.notes leaves inline annotation marks untouched', () => {
  const { SN, schema } = boot();
  // Build a scene whose action node carries an inline annotation mark
  // on a text fragment. The mark's attrs.text is the inline-note content
  // (a separate persistence pathway from scene.attrs.notes).
  const annotation = schema.marks.annotation.create({
    id: 'note-1', text: 'inline note text', color: '#FFE08A',
    createdAt: '2026-05-29T00:00:00Z', author: 'tester', status: 'open'
  });
  const textNode = schema.text('marked span', [annotation]);
  const action = schema.nodes.action.create(null, [textNode]);
  const sceneNode = schema.nodes.scene.create(
    { id: 'sc-1', notes: '', revisionFlag: null, metadata: null },
    [schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }), action]
  );
  const body  = schema.nodes.body.create(null, [sceneNode]);
  const title = schema.nodes.titleStrip.create({ removable: true });
  const view = makeView(schema, schema.nodes.doc.create(null, [title, body]));
  attachView(view);
  SN.set('sc-1', 'scene-level note added');
  // Scene-level attr written, AND the inline annotation mark survives
  // intact with its original attrs (id, text, color, status).
  const scAfter = sceneById(view.state.doc, 'sc-1');
  assert.equal(scAfter.attrs.notes, 'scene-level note added');
  let foundAnnotation = null;
  view.state.doc.descendants(function(node) {
    if (foundAnnotation) return false;
    if (node.isText && Array.isArray(node.marks)) {
      for (let i = 0; i < node.marks.length; i += 1) {
        const m = node.marks[i];
        if (m.type.name === 'annotation') {
          foundAnnotation = m;
          return false;
        }
      }
    }
    return true;
  });
  assert.ok(foundAnnotation, 'inline annotation mark must survive scene-level write');
  assert.equal(foundAnnotation.attrs.id,     'note-1');
  assert.equal(foundAnnotation.attrs.text,   'inline note text');
  assert.equal(foundAnnotation.attrs.color,  '#FFE08A');
  assert.equal(foundAnnotation.attrs.status, 'open');
});

// ----------------------------------------------------------------
// 10. get() prefers PM attr over the scratchpad when both have a value.
// ----------------------------------------------------------------

test('SN-Helper-2: get() returns the PM attr value, not a stale scratchpad value', () => {
  const { SN, schema } = boot();
  // PM doc carries the canonical 'persisted' text.
  const scenePersisted = schema.nodes.scene.create(
    { id: 'sc-1', notes: 'persisted', revisionFlag: null, metadata: null },
    [schema.nodes.sceneHeading.create({ setting: 'INT.', time: 'DAY', headingStyle: null }),
     schema.nodes.action.create()]
  );
  const body  = schema.nodes.body.create(null, [scenePersisted]);
  const title = schema.nodes.titleStrip.create({ removable: true });
  const view = makeView(schema, schema.nodes.doc.create(null, [title, body]));
  attachView(view);
  // Simulate a stale scratchpad entry by writing it without going through set().
  // (This is what would happen if a previous tab's session left state on a
  // shared scratchpad. The fix is precisely that get() re-reads PM.)
  SN._reset();   // clear scratchpad cleanly
  // Force a direct scratchpad write via set() — but make sure PM has the
  // canonical value first. Then mutate the doc out-of-band and confirm
  // get() reports the new PM value, not the stale scratchpad.
  SN.set('sc-1', 'persisted');
  assert.equal(SN.get('sc-1'), 'persisted');
  // Out-of-band PM update (e.g., undo, programmatic edit, or a different
  // surface writing the attr) — change PM directly without touching SN.
  const scenePos = (function() {
    let p = null;
    view.state.doc.descendants(function(node, pos) {
      if (p != null) return false;
      if (node.type.name === 'scene') { p = pos; return false; }
      return true;
    });
    return p;
  })();
  const node = view.state.doc.nodeAt(scenePos);
  const newAttrs = Object.assign({}, node.attrs, { notes: 'externally rewritten' });
  view.dispatch(view.state.tr.setNodeMarkup(scenePos, null, newAttrs));
  // Stale scratchpad still says 'persisted'; PM says 'externally rewritten'.
  // get() must report the PM value, not the stale scratchpad.
  assert.equal(SN.get('sc-1'), 'externally rewritten');
});
