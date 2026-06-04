// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.SceneTagOccurrences — Scene Navigator Tags v1.1 occurrence derivation.
//
// Given a screenplay document and one scene's PM position, derive the
// scene-LOCAL tagged occurrences: for every `tag` mark whose range lands
// inside that scene's subtree, the exact tagged wording, a surrounding
// snippet, and the PM positions — grouped by category, then by entity.
//
// This is the "scene intelligence" the Scene Navigator surfaces: not a
// registry name, but WHERE in the scene an entity was tagged, HOW MANY
// times, and WHAT the screenplay actually says there.
//
// Contract (mirrors SearchHighlight / TagFocusHighlight discipline):
//   • PURE READ. No document mutation, no marks added, no persistence.
//   • SCENE-SUBTREE ONLY. Walks one scene's range (doc.nodesBetween over
//     [scenePos, scenePos + sceneNode.nodeSize]) — never the whole doc,
//     never a cached global index. Computed on demand for one expanded
//     scene at a time.
//   • NO nav-index / schema / registry change. Entity NAME + COLOR are
//     looked up read-only from the index the caller already has (the tag
//     mark itself carries only tagType + entityId).
//   • Duplicate same-named entities stay SEPARATE — grouping is by
//     entityId, so two NALIs (distinct ids) never collapse.
//   • Only entities actually TAGGED in this scene appear — a registry
//     entity with no mark in this subtree is absent (honest: "tagged
//     here", not "exists globally").
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // Category order + labels — mirror SceneCatalog / Tags Panel so all three
  // surfaces read identically. tagType (singular) is what the mark carries.
  const TAG_CATEGORIES = [
    { tagType: 'character', label: 'Characters' },
    { tagType: 'prop',      label: 'Props'      },
    { tagType: 'wardrobe',  label: 'Wardrobe'   },
    { tagType: 'location',  label: 'Locations'  },
    { tagType: 'sfx',       label: 'SFX'        },
    { tagType: 'vfx',       label: 'VFX'        },
    { tagType: 'vehicle',   label: 'Vehicles'   },
    { tagType: 'animal',    label: 'Animals'    },
    { tagType: 'custom',    label: 'Custom'     }
  ];

  const SNIPPET_CONTEXT = 28;   // chars of wording each side of the tag

  function _entityFromIndex(idx, tagType, entityId) {
    if (!idx || !idx.tags || !Array.isArray(idx.tags[tagType])) return null;
    const arr = idx.tags[tagType];
    for (let i = 0; i < arr.length; i += 1) {
      if (arr[i] && arr[i].nodeId === entityId) return arr[i];
    }
    return null;
  }

  // Build a one-line context window around a tagged run, from the text of
  // the block that contains it (action / dialogue / heading / …). The
  // tagged wording keeps its original screenplay casing; truncatedStart/End
  // flag whether the line continues beyond the window (leading/trailing …).
  function _snippet(doc, from, matchLen) {
    let blockText = '';
    let offset = 0;
    try {
      const $f = doc.resolve(from);
      blockText = ($f.parent && typeof $f.parent.textContent === 'string') ? $f.parent.textContent : '';
      offset = from - $f.start();
    } catch (_) {
      blockText = '';
      offset = 0;
    }
    if (offset < 0) offset = 0;
    if (offset > blockText.length) offset = blockText.length;
    const matchEnd = Math.min(blockText.length, offset + matchLen);
    const start = Math.max(0, offset - SNIPPET_CONTEXT);
    const end = Math.min(blockText.length, matchEnd + SNIPPET_CONTEXT);
    return {
      before:         blockText.slice(start, offset),
      match:          blockText.slice(offset, matchEnd),
      after:          blockText.slice(matchEnd, end),
      truncatedStart: start > 0,
      truncatedEnd:   end < blockText.length
    };
  }

  // forScene(doc, scenePos, idx) → category groups for ONE scene.
  // Returns [] when the doc can't be walked, the position isn't a scene, or
  // nothing is tagged. Shape:
  //   [{ tagType, label, entities: [{ entityId, name, color, count,
  //       occurrences: [{ from, to, text, snippet }] }] }]
  function forScene(doc, scenePos, idx) {
    if (!doc || typeof doc.nodeAt !== 'function' || typeof doc.nodesBetween !== 'function') return [];
    if (typeof scenePos !== 'number') return [];
    const sceneNode = doc.nodeAt(scenePos);
    if (!sceneNode || !sceneNode.type || sceneNode.type.name !== 'scene') return [];
    const end = scenePos + sceneNode.nodeSize;

    // tagType::entityId → { tagType, entityId, occurrences: [] }, in
    // first-seen document order (preserved by `order`).
    const byKey = {};
    const order = [];
    doc.nodesBetween(scenePos, end, function(node, pos) {
      if (!node || !node.isText || !Array.isArray(node.marks)) return;
      for (let i = 0; i < node.marks.length; i += 1) {
        const m = node.marks[i];
        if (m && m.type && m.type.name === 'tag' && m.attrs && m.attrs.entityId) {
          const tagType = m.attrs.tagType;
          const entityId = m.attrs.entityId;
          const key = tagType + '::' + entityId;
          const from = pos;
          const to = pos + node.nodeSize;
          const text = node.text || '';
          const occ = { from: from, to: to, text: text, snippet: _snippet(doc, from, text.length) };
          if (!byKey[key]) { byKey[key] = { tagType: tagType, entityId: entityId, occurrences: [] }; order.push(key); }
          byKey[key].occurrences.push(occ);
          break;   // one mark per node even if it appears twice
        }
      }
    });

    if (order.length === 0) return [];

    // Group the entities under their category, in canonical category order,
    // entities within a category in first-seen document order.
    const groups = [];
    for (let c = 0; c < TAG_CATEGORIES.length; c += 1) {
      const cat = TAG_CATEGORIES[c];
      const entities = [];
      for (let k = 0; k < order.length; k += 1) {
        const rec = byKey[order[k]];
        if (rec.tagType !== cat.tagType) continue;
        const ent = _entityFromIndex(idx, rec.tagType, rec.entityId);
        // Name from the index (the mark carries no name). Honest fallback:
        // the tagged wording itself, so an orphan mark still reads truthfully.
        const name = (ent && ent.name != null) ? ent.name
                   : (rec.occurrences[0] ? rec.occurrences[0].text : '');
        entities.push({
          entityId:    rec.entityId,
          name:        name,
          color:       (ent && ent.color != null) ? ent.color : null,
          count:       rec.occurrences.length,
          occurrences: rec.occurrences
        });
      }
      if (entities.length) groups.push({ tagType: cat.tagType, label: cat.label, entities: entities });
    }
    return groups;
  }

  Rga.SceneTagOccurrences = {
    forScene:        forScene,
    _TAG_CATEGORIES: TAG_CATEGORIES   // read-only export for tests
  };
})();
