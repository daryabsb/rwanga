// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.TagFocusHighlight — Tags Panel V1.3 "tag focus" highlight.
//
// When the writer selects an entity in the Tags Panel, every tagged
// occurrence of THAT entity (matched by entityId) lights up in the editor.
// This is a UI focus state only — it is NOT search, NOT a mark, NOT
// persisted, NOT document content.
//
// Sibling of (and modelled on) Rga.SearchHighlight, kept SEPARATE on
// purpose: different concern (entity focus vs. search match), different
// PluginKey, different CSS class (.rga-tag-focus-active vs.
// .rga-search-match-active), and N ranges instead of one. Both compose
// additively — PM unions the `decorations` prop across plugins — so an
// entity focus and a search match can coexist, each visually distinct.
//
// Contract:
//   • content-safe: a Decoration, never a document step,
//   • driven by transaction meta (set → { ranges:[…] }; clear → null),
//   • transient: drops itself on ANY document change rather than drifting
//     onto shifted text,
//   • survives selection-only transactions (the V1.2 jump keeps the focus
//     highlight lit),
//   • matched by entityId only — so two same-named entities (the duplicate
//     NALI case) never bleed into each other.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // One PluginKey for the module lifetime — buildPlugin() and the
  // set/clear helpers must share it so dispatched meta reaches the
  // reducer. v3 is single-doc, so one key suffices.
  let _key = null;
  function key() {
    const PM = window.RgaProseMirror;
    if (!PM || !PM.PluginKey) return null;
    if (!_key) _key = new PM.PluginKey('rga-tag-focus');
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
          if (meta && Array.isArray(meta.ranges)) {
            const decos = [];
            for (let i = 0; i < meta.ranges.length; i += 1) {
              const r = meta.ranges[i];
              if (r && r.from != null && r.to != null && r.to > r.from) {
                decos.push(PM.Decoration.inline(r.from, r.to, { class: 'rga-tag-focus-active' }));
              }
            }
            return PM.DecorationSet.create(tr.doc, decos);
          }
          // No focus meta this transaction. Stay transient: a document
          // edit drops the highlight; a selection-only change keeps it.
          if (tr.docChanged) return PM.DecorationSet.empty;
          return old;
        }
      },
      props: {
        decorations: function(state) { return k.getState(state); }
      }
    });
  }

  // Pure read: every tag-mark range carrying `entityId`, in document
  // order. One range per text node bearing the mark (adjacent runs render
  // as a continuous box). Matched by entityId alone — entityIds are
  // globally unique, so this isolates duplicate same-named entities.
  function rangesForEntity(doc, entityId) {
    const out = [];
    if (!doc || typeof doc.descendants !== 'function' || !entityId) return out;
    doc.descendants(function(node, pos) {
      if (!node.isText || !Array.isArray(node.marks)) return;
      for (let i = 0; i < node.marks.length; i += 1) {
        const m = node.marks[i];
        if (m && m.type && m.type.name === 'tag' && m.attrs && m.attrs.entityId === entityId) {
          out.push({ from: pos, to: pos + node.nodeSize });
          break;  // one range per node even if the mark appears twice
        }
      }
    });
    return out;
  }

  // Paint focus over all of `entityId`'s tagged occurrences. Meta-only
  // transaction (no document steps). Replaces any prior focus highlight.
  // Returns the number of ranges painted (0 = entity has no marks → a
  // curated-but-untagged entity is a safe, honest no-op: no decorations).
  function setEntity(view, entityId) {
    const k = key();
    if (!view || !view.state || !k) return 0;
    const ranges = rangesForEntity(view.state.doc, entityId);
    view.dispatch(view.state.tr.setMeta(k, { ranges: ranges, entityId: entityId }));
    return ranges.length;
  }

  // Clear any active focus highlight. Guarded so a redundant clear doesn't
  // emit a stepless transaction.
  function clear(view) {
    const k = key();
    if (!view || !view.state || !k) return;
    const cur = k.getState(view.state);
    if (!cur || (typeof cur.find === 'function' && cur.find().length === 0)) return;
    view.dispatch(view.state.tr.setMeta(k, null));
  }

  Rga.TagFocusHighlight = {
    buildPlugin:     buildPlugin,
    setEntity:       setEntity,
    clear:           clear,
    rangesForEntity: rangesForEntity,
    _key:            key,   // test helper
    _decorations: function(state) {
      const k = key();
      if (!k || !state) return [];
      const cur = k.getState(state);
      if (!cur || typeof cur.find !== 'function') return [];
      return cur.find().map(function(d) { return { from: d.from, to: d.to }; });
    }
  };
})();
