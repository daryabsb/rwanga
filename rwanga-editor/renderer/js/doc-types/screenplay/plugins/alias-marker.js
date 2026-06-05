// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.AliasMarker — Semantic Entity Layer S1 derived alias marker.
//
// An alias mention ("The Teacher" pointing at Nali) renders in the same type
// color as a canonical mention but with a DOTTED underline. Alias-ness is
// DERIVED at render time by comparing the mention's surface text against the
// entity's canonical name + alias list — it is NEVER stored on the mark.
// schema.marks.tag is untouched (DOCTRINE_LOCK: identity stays by id; the mark
// carries only {tagType, entityId}).
//
// Modelled on Rga.TagFocusHighlight: a content-safe inline Decoration, never a
// document step. Composes additively with the other decoration plugins (PM
// unions the `decorations` prop). Recomputed from doc text + registry, so it
// reflects new aliases the moment a tagging change re-renders.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  function _liveEntity(doc, tagType, entityId) {
    if (!doc || !Rga.Doc) return null;
    let id = entityId;
    if (typeof Rga.Doc.resolveEntityId === 'function') {
      const r = Rga.Doc.resolveEntityId(doc, tagType, entityId);
      if (r) id = r;   // a mark left on a tombstone resolves to its survivor
    }
    return (typeof Rga.Doc.findEntity === 'function')
      ? Rga.Doc.findEntity(doc, tagType, id)
      : null;
  }

  // Pure: is `surface` an ALIAS (not the canonical name) of the entity?
  // Canonical name → false. Unknown / missing entity → false.
  function isAliasSurface(doc, tagType, entityId, surface) {
    const norm = String(surface == null ? '' : surface).trim().toLowerCase();
    if (!norm) return false;
    const ent = _liveEntity(doc, tagType, entityId);
    if (!ent) return false;
    if (String(ent.name || '').trim().toLowerCase() === norm) return false;
    const aliases = Array.isArray(ent.aliases) ? ent.aliases : [];
    return aliases.some(function(a) { return String(a || '').trim().toLowerCase() === norm; });
  }

  // Walk a PM doc; return {from,to} ranges whose tagged surface text is an alias
  // of the entity the mark points at. One range per text node bearing a tag mark.
  function aliasRanges(pmDoc, rgaDoc) {
    const out = [];
    if (!pmDoc || typeof pmDoc.descendants !== 'function' || !rgaDoc) return out;
    pmDoc.descendants(function(node, pos) {
      if (!node || !node.isText || !Array.isArray(node.marks)) return;
      for (let i = 0; i < node.marks.length; i += 1) {
        const m = node.marks[i];
        if (m && m.type && m.type.name === 'tag' && m.attrs) {
          const from = pos;
          const to = pos + node.nodeSize;
          const surface = pmDoc.textBetween(from, to);
          if (isAliasSurface(rgaDoc, m.attrs.tagType, m.attrs.entityId, surface)) {
            out.push({ from: from, to: to });
          }
          break;   // one range per node even if the mark appears twice
        }
      }
    });
    return out;
  }

  function _activeDoc() {
    const tab = Rga.TabManager && Rga.TabManager.activeTab && Rga.TabManager.activeTab();
    return tab && tab.doc;
  }

  function buildPlugin() {
    const PM = window.RgaProseMirror;
    if (!PM || !PM.Plugin || !PM.Decoration || !PM.DecorationSet) return null;
    return new PM.Plugin({
      props: {
        decorations: function(state) {
          const rgaDoc = _activeDoc();
          if (!rgaDoc) return PM.DecorationSet.empty;
          const ranges = aliasRanges(state.doc, rgaDoc);
          if (!ranges.length) return PM.DecorationSet.empty;
          const decos = ranges.map(function(r) {
            return PM.Decoration.inline(r.from, r.to, { class: 'rga-tag-alias' });
          });
          return PM.DecorationSet.create(state.doc, decos);
        }
      }
    });
  }

  Rga.AliasMarker = {
    isAliasSurface: isAliasSurface,
    aliasRanges:    aliasRanges,
    buildPlugin:    buildPlugin
  };
})();
