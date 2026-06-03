// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Registry Integrity Slice B2 — Rga.Tags.mergeEntities (the merge operation).
// Design: docs/Filmustageation/SCOPED_REGISTRY_MERGE_API_DESIGN.md §1.4, §6
// Policy: docs/Filmustageation/IDENTITY_MERGE_POLICY_AUDIT.md §6
//
// The operation under test follows the approved 5-step order:
//   1. rewrite loser marks → survivor (ONE PM transaction, undoable)
//   2. fold loser metadata into survivor      (Rga.Doc.foldEntityMetadata)
//   3. tombstone losers                       (Rga.Doc.markEntityMerged)
//   4. append merge log                       (Rga.Doc.appendMergeLog)
//   5. mark document dirty
//
// Everything on the path under test is REAL: real doc.js (B1 APIs),
// real tags.js, real v3 schema, real PM state + real prosemirror-history
// (for the undo-safety tests). Only TabManager wiring is stubbed.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// ----------------------------------------------------------------
// Boot — mirrors registry-identity.test.js, plus prosemirror-history.
// ----------------------------------------------------------------
function boot() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Event = dom.window.Event;
  global.window.Rga = {};

  const PMmodel   = require('prosemirror-model');
  const PMstate   = require('prosemirror-state');
  const PMview    = require('prosemirror-view');
  const PMhistory = require('prosemirror-history');
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

  const files = [
    '../../../../renderer/js/constants.js',
    '../../../../renderer/js/doc.js',
    '../../../../renderer/js/framework/base-outer-marks.js',
    '../../../../renderer/js/framework/document-outline.js',
    '../../../../renderer/js/framework/slug-resolver.js',
    '../../../../renderer/js/framework/nav-index.js',
    '../../../../renderer/js/doc-types/screenplay/schema-v3.js',
    '../../../../renderer/js/doc-types/screenplay/plugins/tags.js'
  ];
  files.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;

  // Real v3 schema.
  const sp = Rga.DocTypes.screenplay;
  sp._resetSchemaV3Cache && sp._resetSchemaV3Cache();
  const schema = sp.buildSchemaV3();

  // Real doc with a real registry.
  const doc = Rga.Doc.create();

  // Two scenes whose action text contains the names we tag/merge.
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
  const docNode = schema.nodes.doc.create(null, [title, body]);

  // Real PM state WITH real history (for the undo-safety tests),
  // behind a minimal view shim. Dispatches are counted so tests can
  // assert "one transaction".
  let state = PMstate.EditorState.create({
    schema: schema, doc: docNode, plugins: [PMhistory.history()]
  });
  let dispatchCount = 0;
  const view = {
    get state() { return state; },
    dispatch: function(tr) { dispatchCount += 1; state = state.apply(tr); },
    focus: function() {}
  };

  Rga.TabManager = {
    _editorView: function() { return view; },
    activeDoc:   function() { return doc; },
    activeTab:   function() { return { doc: doc }; }
  };

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

  function selectOccurrence(needle, nth) {
    const occ = occurrencesOf(needle);
    const target = occ[nth || 0];
    if (!target) throw new Error('No occurrence #' + (nth || 0) + ' of "' + needle + '"');
    view.dispatch(view.state.tr.setSelection(
      PMstate.TextSelection.create(view.state.doc, target.from, target.to)));
    return target;
  }

  function tagMarks(tagType) {
    const out = [];
    view.state.doc.descendants(function(node, pos) {
      if (!node.isText) return;
      node.marks.forEach(function(m) {
        if (m.type.name === 'tag' && (!tagType || m.attrs.tagType === tagType)) {
          out.push({ pos: pos, tagType: m.attrs.tagType, entityId: m.attrs.entityId, text: node.text });
        }
      });
    });
    return out;
  }

  function undo() { return PMhistory.undo(view.state, view.dispatch); }
  function redo() { return PMhistory.redo(view.state, view.dispatch); }

  // In the real app, tagging and merging are separated by minutes, so
  // they land in different history groups automatically. Tests run in
  // microseconds — closeHistory() simulates that time gap so undo
  // reverts ONLY the merge, exactly like production.
  function closeHistoryGroup() {
    view.dispatch(PMhistory.closeHistory(view.state.tr));
  }

  function resetDispatchCount() { dispatchCount = 0; }
  function getDispatchCount() { return dispatchCount; }

  return {
    Rga: Rga, doc: doc, view: view, schema: schema, dom: dom,
    selectOccurrence: selectOccurrence,
    tagMarks: tagMarks,
    undo: undo, redo: redo,
    closeHistoryGroup: closeHistoryGroup,
    resetDispatchCount: resetDispatchCount,
    getDispatchCount: getDispatchCount
  };
}

// The standard merge scenario: survivor (curated) + loser (bare), both
// with marks. Mirrors the fixture's NALI split-identity class (C1).
function setupSplitIdentity(h) {
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-survivor', name: 'NALI', color: '#4FC1FF', notes: 'Protagonist.' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-loser', name: 'Nali', color: '#FF0000', notes: 'From scene 2.' });

  // survivor tagged once, loser tagged twice.
  h.selectOccurrence('NALI', 0);                 // scene 1
  h.Rga.Tags.applyTag(h.view, 'character', 'ent-survivor');
  h.selectOccurrence('NALI', 1);                 // scene 2
  h.Rga.Tags.applyTag(h.view, 'character', 'ent-loser');
  h.selectOccurrence('Nali', 0);                 // scene 2 case variant
  h.Rga.Tags.applyTag(h.view, 'character', 'ent-loser');
}

// ================================================================
// §0 — API exists
// ================================================================

test('B2: Rga.Tags.mergeEntities exists', () => {
  const h = boot();
  assert.equal(typeof h.Rga.Tags.mergeEntities, 'function');
});

// ================================================================
// §1 — Mark rewrite
// ================================================================

test('B2: merge rewrites ALL loser marks to the survivor; survivor marks untouched', () => {
  const h = boot();
  setupSplitIdentity(h);
  assert.equal(h.tagMarks('character').length, 3, 'precondition: 3 marks');

  const result = h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-survivor', ['ent-loser']);
  assert.ok(result, 'merge succeeds');

  const marks = h.tagMarks('character');
  assert.equal(marks.length, 3, 'same number of marks after merge');
  marks.forEach(function(m) {
    assert.equal(m.entityId, 'ent-survivor', 'every mark points at the survivor');
  });
});

test('B2: document text is completely unchanged by a merge', () => {
  const h = boot();
  setupSplitIdentity(h);
  const textBefore = h.view.state.doc.textContent;

  h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-survivor', ['ent-loser']);

  assert.equal(h.view.state.doc.textContent, textBefore,
    'merge must never change a single character of the screenplay');
});

test('B2: mark rewrite happens in ONE PM transaction (one dispatch)', () => {
  const h = boot();
  setupSplitIdentity(h);
  h.resetDispatchCount();

  h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-survivor', ['ent-loser']);

  assert.equal(h.getDispatchCount(), 1,
    'all mark rewrites land in exactly one transaction (atomic, one undo step)');
});

test('B2: undo-safety — Ctrl+Z restores loser marks AND the loser id still resolves (tombstone present)', () => {
  const h = boot();
  setupSplitIdentity(h);
  h.closeHistoryGroup();   // simulate the real time gap between tagging and merging

  h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-survivor', ['ent-loser']);
  assert.ok(h.tagMarks('character').every(function(m) { return m.entityId === 'ent-survivor'; }));

  // Undo the merge's mark rewrite.
  const undone = h.undo();
  assert.ok(undone, 'undo applies');

  // Marks are back on the loser…
  const restored = h.tagMarks('character').filter(function(m) { return m.entityId === 'ent-loser'; });
  assert.equal(restored.length, 2, 'loser marks restored by undo');

  // …and the loser id STILL resolves, because the loser was tombstoned,
  // never deleted. This is the whole reason tombstones exist.
  assert.equal(h.Rga.Doc.findEntity(h.doc, 'character', 'ent-loser') !== null, true,
    'loser entity still present in registry');
  assert.equal(h.Rga.Doc.resolveEntityId(h.doc, 'character', 'ent-loser'), 'ent-survivor',
    'restored marks resolve to the survivor through the tombstone');
});

test('B2: redo after undo re-applies the merge marks', () => {
  const h = boot();
  setupSplitIdentity(h);
  h.closeHistoryGroup();   // simulate the real time gap between tagging and merging
  h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-survivor', ['ent-loser']);
  h.undo();
  const redone = h.redo();
  assert.ok(redone, 'redo applies');
  h.tagMarks('character').forEach(function(m) {
    assert.equal(m.entityId, 'ent-survivor');
  });
});

test('B2: merging a mark-less loser (curated-orphan class C2) works — registry-only merge', () => {
  const h = boot();
  // BABAN class: curated survivor with no marks; loser carries the marks.
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-baban', name: 'BABAN', color: '#FFB86C', notes: 'Grandmother.' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'uuid-1', name: 'Baban' });
  // Note: loser 'uuid-1' has NO marks either in this test — pure registry merge.

  const result = h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-baban', ['uuid-1']);
  assert.ok(result, 'merge succeeds with zero marks to rewrite');
  assert.equal(h.Rga.Doc.isEntityMerged(h.doc, 'character', 'uuid-1'), true);
});

// ================================================================
// §2 — Metadata fold + tombstone + log (steps 2–4)
// ================================================================

test('B2: survivor metadata folded — color kept, loser notes concatenated with attribution', () => {
  const h = boot();
  setupSplitIdentity(h);

  h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-survivor', ['ent-loser']);

  const survivor = h.Rga.Doc.findEntity(h.doc, 'character', 'ent-survivor');
  assert.equal(survivor.color, '#4FC1FF', 'survivor color never overwritten');
  assert.ok(survivor.notes.startsWith('Protagonist.'), 'survivor notes first');
  assert.ok(survivor.notes.includes('merged from "Nali" (ent-loser)'), 'attribution present');
  assert.ok(survivor.notes.endsWith('From scene 2.'), 'loser notes preserved');
});

test('B2: losers are tombstoned, never deleted', () => {
  const h = boot();
  setupSplitIdentity(h);

  h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-survivor', ['ent-loser']);

  assert.equal(h.doc.tagRegistry.characters.length, 2, 'both entities still in the registry');
  assert.equal(h.Rga.Doc.isEntityMerged(h.doc, 'character', 'ent-loser'), true, 'loser tombstoned');
  assert.equal(h.Rga.Doc.isEntityMerged(h.doc, 'character', 'ent-survivor'), false, 'survivor live');
});

test('B2: merge log appended with survivor, losers, mark counts, and fold summary', () => {
  const h = boot();
  setupSplitIdentity(h);

  const result = h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-survivor', ['ent-loser']);

  assert.equal(h.doc.mergeLog.length, 1, 'one record appended');
  const record = h.doc.mergeLog[0];
  assert.equal(record.tag_type, 'character');
  assert.equal(record.survivor.id, 'ent-survivor');
  assert.equal(record.survivor.name, 'NALI');
  assert.equal(record.losers.length, 1);
  assert.equal(record.losers[0].id, 'ent-loser');
  assert.equal(record.losers[0].name, 'Nali');
  assert.equal(record.losers[0].mark_count, 2, 'log records how many marks the loser had');
  assert.match(record.merged_at, /^\d{4}-\d{2}-\d{2}T/, 'timestamped');
  assert.ok(record.metadata_moved, 'fold summary recorded');
  assert.equal(result.record, record, 'operation returns the appended record');
});

test('B2: document is marked dirty by a merge', () => {
  const h = boot();
  setupSplitIdentity(h);
  h.doc.dirty = false;

  h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-survivor', ['ent-loser']);

  assert.equal(h.doc.dirty, true);
});

test('B2: multi-loser merge (the fixture BABAN case) — all losers fold, tombstone, and log together', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-baban', name: 'BABAN', color: '#FFB86C', notes: 'Grandmother.' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'uuid-1', name: 'BABAN' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'uuid-2', name: 'Baban', notes: 'lowercase variant' });

  // Tag text with both losers (reuse the NALI text positions as stand-ins).
  h.selectOccurrence('NALI', 0);
  h.Rga.Tags.applyTag(h.view, 'character', 'uuid-1');
  h.selectOccurrence('Nali', 0);
  h.Rga.Tags.applyTag(h.view, 'character', 'uuid-2');

  const result = h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-baban', ['uuid-1', 'uuid-2']);
  assert.ok(result);

  // All marks → survivor.
  h.tagMarks('character').forEach(function(m) {
    assert.equal(m.entityId, 'ent-baban');
  });
  // Both losers tombstoned.
  assert.equal(h.Rga.Doc.isEntityMerged(h.doc, 'character', 'uuid-1'), true);
  assert.equal(h.Rga.Doc.isEntityMerged(h.doc, 'character', 'uuid-2'), true);
  // One log record covering both losers.
  assert.equal(h.doc.mergeLog.length, 1);
  assert.equal(h.doc.mergeLog[0].losers.length, 2);
  // Loser notes folded in.
  const survivor = h.Rga.Doc.findEntity(h.doc, 'character', 'ent-baban');
  assert.ok(survivor.notes.includes('lowercase variant'));
});

// ================================================================
// §3 — Refusals (safety rules)
// ================================================================

test('B2: cross-type merge refused — loser id from another tag type is not found in this type', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-char-nali', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'prop',      { id: 'ent-prop-nali', name: 'NALI' });

  const result = h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-char-nali', ['ent-prop-nali']);
  assert.equal(result, null, 'merging a prop into a character is refused');
  assert.equal(h.Rga.Doc.isEntityMerged(h.doc, 'prop', 'ent-prop-nali'), false, 'prop untouched');
  assert.equal(h.doc.mergeLog.length, 0, 'nothing logged');
});

test('B2: different-name merge refused — NALI and BABAN can never merge', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-nali', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-baban', name: 'BABAN' });

  const result = h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-nali', ['ent-baban']);
  assert.equal(result, null, 'different names refuse to merge (alias work is Slice C, not B)');
  assert.equal(h.Rga.Doc.isEntityMerged(h.doc, 'character', 'ent-baban'), false);
  assert.equal(h.doc.mergeLog.length, 0);
});

test('B2: case-variant names DO merge (same case-folded name)', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-a', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-b', name: 'nali  ' });  // case + trailing space

  const result = h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-a', ['ent-b']);
  assert.ok(result, 'NALI / "nali  " are the same identity (case-folded, trimmed)');
});

test('B2: merge without a live view refused', () => {
  const h = boot();
  setupSplitIdentity(h);
  assert.equal(h.Rga.Tags.mergeEntities(null, 'character', 'ent-survivor', ['ent-loser']), null);
  assert.equal(h.Rga.Tags.mergeEntities({}, 'character', 'ent-survivor', ['ent-loser']), null);
  assert.equal(h.Rga.Doc.isEntityMerged(h.doc, 'character', 'ent-loser'), false, 'nothing happened');
});

test('B2: merge into a tombstone refused (no chains)', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-a', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-b', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-c', name: 'NALI' });
  // b merged into a.
  h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-a', ['ent-b']);

  // Merging c INTO b (a tombstone) must be refused.
  const result = h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-b', ['ent-c']);
  assert.equal(result, null);
  assert.equal(h.Rga.Doc.isEntityMerged(h.doc, 'character', 'ent-c'), false);
});

test('B2: survivor listed among losers refused', () => {
  const h = boot();
  setupSplitIdentity(h);
  const result = h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-survivor', ['ent-loser', 'ent-survivor']);
  assert.equal(result, null);
  assert.equal(h.Rga.Doc.isEntityMerged(h.doc, 'character', 'ent-loser'), false, 'all-or-nothing: nothing merged');
});

test('B2: unknown survivor or unknown loser refused', () => {
  const h = boot();
  setupSplitIdentity(h);
  assert.equal(h.Rga.Tags.mergeEntities(h.view, 'character', 'missing', ['ent-loser']), null);
  assert.equal(h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-survivor', ['missing']), null);
  assert.equal(h.doc.mergeLog.length, 0);
});

test('B2: loser already merged into a DIFFERENT survivor → conflict, whole operation refused', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-a', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-b', name: 'NALI' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-c', name: 'NALI' });
  h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-a', ['ent-b']);   // b → a

  // Now try to merge b into c: b already belongs to a.
  const result = h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-c', ['ent-b']);
  assert.equal(result, null, 'conflicting merge refused');
  assert.equal(h.Rga.Doc.resolveEntityId(h.doc, 'character', 'ent-b'), 'ent-a', 'original tombstone unchanged');
});

// ================================================================
// §4 — Re-run safety (idempotency)
// ================================================================

test('B2: re-running the same merge is a safe no-op — no duplicate log, no double fold, no extra dispatch', () => {
  const h = boot();
  setupSplitIdentity(h);

  const first = h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-survivor', ['ent-loser']);
  assert.ok(first.record, 'first run produces a record');
  const notesAfterFirst = h.Rga.Doc.findEntity(h.doc, 'character', 'ent-survivor').notes;
  h.resetDispatchCount();

  const second = h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-survivor', ['ent-loser']);
  assert.ok(second, 'rerun does not error');
  assert.equal(second.record, null, 'rerun produces NO new record');
  assert.equal(second.alreadyMerged, true, 'rerun reports already-merged');

  assert.equal(h.doc.mergeLog.length, 1, 'no duplicate log entry');
  assert.equal(h.Rga.Doc.findEntity(h.doc, 'character', 'ent-survivor').notes, notesAfterFirst,
    'no double-fold of notes');
  assert.equal(h.getDispatchCount(), 0, 'no marks to rewrite, no transaction dispatched');
});

test('B2: partial re-run — one loser already merged, one new: only the new one is processed and logged', () => {
  const h = boot();
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'ent-surv', name: 'NALI', notes: '' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'uuid-1', name: 'Nali', notes: 'first' });
  h.Rga.Doc.addEntity(h.doc, 'character', { id: 'uuid-2', name: 'nali', notes: 'second' });

  h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-surv', ['uuid-1']);
  assert.equal(h.doc.mergeLog.length, 1);

  // Second call includes the already-merged uuid-1 plus the new uuid-2.
  const result = h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-surv', ['uuid-1', 'uuid-2']);
  assert.ok(result.record, 'a record is produced for the new loser');
  assert.equal(result.record.losers.length, 1, 'only the NEW loser appears in the new record');
  assert.equal(result.record.losers[0].id, 'uuid-2');
  assert.equal(h.doc.mergeLog.length, 2);
  assert.equal(h.Rga.Doc.isEntityMerged(h.doc, 'character', 'uuid-2'), true);
});

// ================================================================
// §5 — Tag popup resolution (C7): tombstoned ids display as survivor
// ================================================================

test('B2: showTagInfo resolves a tombstoned entityId to the survivor name for display', () => {
  const h = boot();
  setupSplitIdentity(h);
  h.closeHistoryGroup();   // simulate the real time gap between tagging and merging
  h.Rga.Tags.mergeEntities(h.view, 'character', 'ent-survivor', ['ent-loser']);

  // Undo restores marks pointing at the tombstoned loser — exactly the
  // case where the popup must not show a ghost.
  h.undo();
  const loserMark = h.view.state.schema.marks.tag.create({ tagType: 'character', entityId: 'ent-loser' });

  // Minimal coords support for the popup.
  h.view.coordsAtPos = function() { return { left: 10, bottom: 10 }; };

  h.Rga.Tags.showTagInfo(h.view, loserMark, 1);

  const label = global.document.querySelector('.rga-mark-info-popup .rga-info-label');
  assert.ok(label, 'popup rendered');
  assert.ok(label.textContent.includes('NALI'),
    'popup shows the SURVIVOR name (resolved through the tombstone), got: ' + label.textContent);
});
