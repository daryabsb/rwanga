// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Screenplay normalizer — pure function (PM doc → NormalizedBlock[]).
//
// Phase 6 entry-point in the pagination pipeline:
//   PM Doc → NormalizedBlock[] → PageMap → Page markers
//
// What it does:
//   - Walks the PM doc.
//   - Emits ONE NormalizedBlock per renderable body block (sceneHeading,
//     action, character, parenthetical, dialogue, shot, transition, and
//     any treatment-area paragraph/heading).
//   - Composes the displayable text for sceneHeading (setting + location
//     + time) — the PM node's textContent is the location alone, but
//     pagination needs the rendered string.
//   - Annotates each block with the keep-with-next discipline:
//       * sceneHeading.keepWithNext = true   (cannot orphan above next block)
//       * character.keepWithNext   = true   (cannot orphan above dialogue)
//   - Records pmFrom / pmTo for jump-back and sceneNodeId / sceneNumber
//     so PageMap pages can list owning scenes (NavigationIndex §6.1).
//
// What it does NOT do:
//   - No DOM access. No measurement. No styling.
//   - No splitting. No line counting. (That's the LayoutProfile + Engine.)
//   - No scene chrome — the wrapping <scene> node itself is not a block;
//     its children are.
//
// Output element shape (NormalizedBlock):
//   {
//     nodeType:           string,            // PM type name
//     text:               string | undefined,  // logical content for non-heading blocks
//     heading:            { setting, location, time } | undefined,  // structured for sceneHeading
//     pmFrom:             number,            // PM start pos (the block node start)
//     pmTo:               number,            // PM end pos (pos + nodeSize)
//     sceneNodeId:        string|null,
//     sceneNumber:        number|null,
//     blockIndexInScene:  number|null,       // 0-based, heading=0
//     keepWithNext:       boolean,
//     splittable:         boolean            // V1: false for everything per directive
//   }
//
// Structural rule: the normalizer NEVER composes a display string. sceneHeading
// carries its parts as `{setting, location, time}`; renderers (NodeView, print)
// decide how to format them. The engine internally synthesises a measurement-only
// string from those parts using profile-supplied separators (cardinality of
// characters matters for line counting, not the formatting itself).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Normalizer = Rga.Normalizer || {};

  // The set of node types that count as renderable body blocks.
  // Anything else (doc, body, titleStrip, scene wrapper, text) is structural.
  const RENDERABLE_TYPES = new Set([
    'sceneHeading', 'action', 'character', 'parenthetical',
    'dialogue', 'shot', 'transition', 'paragraph', 'heading'
  ]);

  // V1 split discipline (per directive rule 6).
  // splittable = false for everything in V1. Future phases may relax.
  const SPLITTABLE = {
    sceneHeading: false, action: false, dialogue: false,
    character: false, parenthetical: false, shot: false,
    transition: false, paragraph: false, heading: false
  };

  // keep-with-next: a block whose page placement must travel with the
  // following block so the writer never sees an orphaned scene heading
  // or character cue at the bottom of a page.
  const KEEP_WITH_NEXT = {
    sceneHeading: true,
    character:    true
  };

  function normalize(doc) {
    const out = [];
    if (!doc || typeof doc.descendants !== 'function') return out;

    // Cache the current owning scene during the walk. PM's descendants
    // visits the scene wrapper BEFORE its children, so we set the cache
    // when we enter a scene; child blocks read it.
    let currentScene = null;        // PM node
    let currentSceneNodeId = null;
    let currentSceneNumber = 0;     // ephemeral 1-based
    let blockIndexInScene = 0;

    doc.descendants(function(node, pos, parent) {
      if (!node || !node.type) return true;
      const typeName = node.type.name;

      // Scene wrapper — update context, don't emit a block; descend.
      if (typeName === 'scene') {
        currentScene = node;
        currentSceneNodeId = node.attrs && node.attrs.id ? String(node.attrs.id) : null;
        currentSceneNumber += 1;
        blockIndexInScene = 0;
        return true; // descend into children
      }

      if (!RENDERABLE_TYPES.has(typeName)) return true;

      // Only emit when the block is a DIRECT child of either the body
      // wrapper or a scene. Nested PM content (text inside a block) is
      // skipped — text has no .type.name match anyway.
      const parentName = parent && parent.type ? parent.type.name : null;
      if (parentName !== 'body' && parentName !== 'scene') return true;

      const inScene = parentName === 'scene';

      // Structure-preserving normalization. For sceneHeading we carry the
      // attrs (setting / time) + content (location) as three separate
      // fields so renderers and the engine can use them independently
      // without any presentation choice baked in here.
      const out_block = {
        nodeType:           typeName,
        pmFrom:             pos,
        pmTo:               pos + node.nodeSize,
        sceneNodeId:        inScene ? currentSceneNodeId : null,
        sceneNumber:        inScene ? currentSceneNumber : null,
        blockIndexInScene:  inScene ? blockIndexInScene : null,
        keepWithNext:       !!KEEP_WITH_NEXT[typeName],
        splittable:         !!SPLITTABLE[typeName]
      };
      if (typeName === 'sceneHeading') {
        out_block.heading = {
          setting:  (node.attrs && node.attrs.setting != null) ? String(node.attrs.setting) : '',
          location: (typeof node.textContent === 'string') ? node.textContent : '',
          time:     (node.attrs && node.attrs.time != null) ? String(node.attrs.time) : ''
        };
      } else {
        out_block.text = (typeof node.textContent === 'string') ? node.textContent : '';
      }
      out.push(out_block);

      if (inScene) blockIndexInScene += 1;
      // Don't descend into the block's own content — text marks etc. are
      // for the renderer, not the normalizer.
      return false;
    });

    return out;
  }

  Rga.Normalizer.normalize       = normalize;
  Rga.Normalizer._RENDERABLE      = RENDERABLE_TYPES;
  Rga.Normalizer._SPLITTABLE      = SPLITTABLE;
  Rga.Normalizer._KEEP_WITH_NEXT  = KEEP_WITH_NEXT;
})();
