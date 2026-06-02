// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.SearchHighlight — transient "selected scene-search match" highlight.
//
// Scene Search v1.1: when a writer clicks / keyboard-selects a body-text
// search result, the Scene Navigator resolves the FIRST matching keyword
// inside that scene and asks this plugin to paint ONE strong, temporary
// inline decoration over it.
//
// Deliberately minimal — this is the ONLY in-editor search highlight:
//   • no ambient highlight, no highlight-all, no persistent decorations,
//   • content-safe: a Decoration, never a document mutation,
//   • driven by transaction meta (set → {from,to}; clear → null),
//   • transient: it drops itself on ANY document change rather than
//     drifting onto shifted text,
//   • composes additively with the nav-index decorations (PM unions the
//     `decorations` prop across plugins).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // One PluginKey for the lifetime of the module — buildPlugin() and the
  // set/clear helpers must share it so meta dispatched by the navigator
  // reaches the plugin's state reducer. v3 is single-doc, so one key is
  // sufficient.
  let _key = null;
  function key() {
    const PM = window.RgaProseMirror;
    if (!PM || !PM.PluginKey) return null;
    if (!_key) _key = new PM.PluginKey('rga-search-highlight');
    return _key;
  }

  function buildPlugin() {
    const PM = window.RgaProseMirror;
    if (!PM || !PM.Plugin || !PM.Decoration || !PM.DecorationSet) return null;
    const k = key();
    if (!k) return null;
    return new PM.Plugin({
      key: k,
      state: {
        init: function() { return PM.DecorationSet.empty; },
        apply: function(tr, old) {
          const meta = tr.getMeta(k);
          if (meta === null) return PM.DecorationSet.empty;  // explicit clear
          if (meta && meta.from != null && meta.to != null && meta.to > meta.from) {
            const deco = PM.Decoration.inline(meta.from, meta.to, { class: 'rga-search-match-active' });
            return PM.DecorationSet.create(tr.doc, [deco]);
          }
          // No highlight meta this transaction. Stay transient: any document
          // edit drops the highlight rather than letting it drift.
          if (tr.docChanged) return PM.DecorationSet.empty;
          return old;
        }
      },
      props: {
        decorations: function(state) { return k.getState(state); }
      }
    });
  }

  // Paint the highlight over [from,to) in the given EditorView. Meta-only
  // transaction — no document steps, so the document content is untouched.
  function set(view, from, to) {
    const k = key();
    if (!view || !view.state || !k) return false;
    if (from == null || to == null || to <= from) return false;
    view.dispatch(view.state.tr.setMeta(k, { from: from, to: to }));
    return true;
  }

  // Clear any active highlight. Guarded so a no-op click doesn't emit a
  // redundant (stepless) transaction.
  function clear(view) {
    const k = key();
    if (!view || !view.state || !k) return;
    const cur = k.getState(view.state);
    if (!cur || (typeof cur.find === 'function' && cur.find().length === 0)) return;
    view.dispatch(view.state.tr.setMeta(k, null));
  }

  // Find the first occurrence of `query` (case-insensitive) in the text
  // between absolute positions [from,to), SKIPPING scene-heading text (the
  // slug is matched separately, and a slug hit must NOT produce a body
  // highlight). Returns { from, to } absolute PM positions, or null. Pure
  // read of the document — no mutation. A match that straddles a mark
  // boundary (split across text nodes) is not found and yields null; the
  // caller then simply jumps without a highlight.
  function firstMatchInRange(doc, from, to, query) {
    if (!doc || typeof doc.nodesBetween !== 'function') return null;
    const q = String(query == null ? '' : query).toLowerCase();
    if (!q) return null;
    let range = null;
    doc.nodesBetween(from, to, function(node, pos) {
      if (range) return false;
      if (node.type && node.type.name === 'sceneHeading') return false;  // skip slug
      if (node.isText && typeof node.text === 'string') {
        const idx = node.text.toLowerCase().indexOf(q);
        if (idx >= 0) { range = { from: pos + idx, to: pos + idx + q.length }; return false; }
      }
      return true;
    });
    return range;
  }

  Rga.SearchHighlight = {
    buildPlugin:      buildPlugin,
    set:              set,
    clear:            clear,
    firstMatchInRange: firstMatchInRange,
    // Test helper — current highlighted ranges in a given EditorState.
    _decorations: function(state) {
      const k = key();
      if (!k || !state) return [];
      const cur = k.getState(state);
      if (!cur || typeof cur.find !== 'function') return [];
      return cur.find().map(function(d) { return { from: d.from, to: d.to }; });
    }
  };
})();
