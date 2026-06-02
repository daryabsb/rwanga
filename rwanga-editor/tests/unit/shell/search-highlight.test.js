// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Scene Search v1.1 — Rga.SearchHighlight plugin + range finder.
// Uses REAL ProseMirror (state/view/model) so the decoration mechanism and
// PM position math are verified for real, not stubbed.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');
const { EditorState, Plugin, PluginKey } = require('prosemirror-state');
const { Decoration, DecorationSet } = require('prosemirror-view');

// Minimal screenplay-ish schema: a scene with a heading (the slug, which the
// finder must SKIP) and action body blocks (where matches live).
const schema = new Schema({
  nodes: {
    doc: { content: 'scene+' },
    scene: { content: 'sceneHeading action+' },
    sceneHeading: { content: 'text*' },
    action: { content: 'text*' },
    text: {}
  }
});

function buildDoc() {
  return schema.node('doc', null, [
    schema.node('scene', null, [
      schema.node('sceneHeading', null, [schema.text('INT. KITCHEN — DAY')]),
      schema.node('action', null, [schema.text('He grabbed the KNIFE quickly.')])
    ])
  ]);
}

// Load the plugin module against a real-PM RgaProseMirror surface.
function loadSH() {
  global.window = { Rga: {} };
  global.window.RgaProseMirror = { Plugin, PluginKey, Decoration, DecorationSet };
  const p = '../../../renderer/js/doc-types/screenplay/plugins/search-highlight.js';
  delete require.cache[require.resolve(p)];
  require(p);
  return global.window.Rga.SearchHighlight;
}

function makeView(state) {
  return { state: state, dispatch: function(tr) { this.state = this.state.apply(tr); } };
}

test('Search-v1.1: firstMatchInRange locates the body keyword (real PM positions)', () => {
  const SH = loadSH();
  const doc = buildDoc();
  const range = SH.firstMatchInRange(doc, 0, doc.content.size, 'knife');
  assert.ok(range, 'a range is returned for a body match');
  // The decisive check: the resolved positions actually cover "KNIFE".
  assert.equal(doc.textBetween(range.from, range.to), 'KNIFE');
});

test('Search-v1.1: firstMatchInRange SKIPS the scene heading (slug term → no body range)', () => {
  const SH = loadSH();
  const doc = buildDoc();
  // "KITCHEN" appears only in the heading (the slug). A slug-only term must
  // not produce a body highlight range.
  assert.equal(SH.firstMatchInRange(doc, 0, doc.content.size, 'kitchen'), null);
});

test('Search-v1.1: set paints ONE inline decoration over the range; clear removes it; content untouched', () => {
  const SH = loadSH();
  const doc = buildDoc();
  const view = makeView(EditorState.create({ doc, plugins: [SH.buildPlugin()] }));
  const r = SH.firstMatchInRange(doc, 0, doc.content.size, 'knife');
  const contentBefore = view.state.doc.textContent;

  SH.set(view, r.from, r.to);
  const decos = SH._decorations(view.state);
  assert.equal(decos.length, 1, 'exactly one highlight decoration');
  assert.deepEqual(decos[0], { from: r.from, to: r.to }, 'over the matched range');
  assert.equal(view.state.doc.textContent, contentBefore, 'set does NOT modify document content');

  SH.clear(view);
  assert.equal(SH._decorations(view.state).length, 0, 'clear removes the highlight');
  assert.equal(view.state.doc.textContent, contentBefore, 'clear does NOT modify document content');
});

test('Search-v1.1: a second set MOVES the highlight (only one at a time, no ambient/all)', () => {
  const SH = loadSH();
  const doc = buildDoc();
  const view = makeView(EditorState.create({ doc, plugins: [SH.buildPlugin()] }));
  const r = SH.firstMatchInRange(doc, 0, doc.content.size, 'knife');
  SH.set(view, r.from, r.to);
  // Move to a different (valid) range — still exactly one decoration.
  SH.set(view, r.from + 1, r.to + 1);
  const decos = SH._decorations(view.state);
  assert.equal(decos.length, 1, 'still a single highlight (no highlight-all)');
  assert.deepEqual(decos[0], { from: r.from + 1, to: r.to + 1 }, 'moved to the new range');
});

test('Search-v1.1: highlight is transient — it drops on any document change', () => {
  const SH = loadSH();
  const doc = buildDoc();
  const view = makeView(EditorState.create({ doc, plugins: [SH.buildPlugin()] }));
  const r = SH.firstMatchInRange(doc, 0, doc.content.size, 'knife');
  SH.set(view, r.from, r.to);
  assert.equal(SH._decorations(view.state).length, 1);
  // Any content edit drops the highlight (no drift onto shifted text).
  view.dispatch(view.state.tr.insertText('x', 1));
  assert.equal(SH._decorations(view.state).length, 0, 'highlight cleared on document change');
});
