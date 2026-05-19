// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// RenderModel builder — pure (PM doc, PageMap, NormalizedBlocks, LayoutProfile)
// → RenderModel.
//
// Phase 7 entry in the rendering pipeline:
//   PM Doc → Normalizer → LayoutProfile → PageMap → RenderModel → PrintRenderer
//
// The RenderModel is the SHARED rendering truth (per Phase 0 contract §6.5).
// It hands consumers (PrintRenderer today, future paginated-flow renderer
// tomorrow) the structured per-page block list along with inline runs
// (text + marks) needed for fidelity rendering. It NEVER reads the editor
// DOM — only PM model state.
//
// RenderModel shape:
//   {
//     totalPages:    number,
//     pages: [
//       {
//         pageNumber:     number,
//         usedLines:      number,
//         availableLines: number,
//         blocks: [
//           {
//             type:        string,                      // PM node type
//             pmFrom:      number,                      // jump-back anchor
//             pmTo:        number,
//             sceneNodeId: string | null,
//             sceneNumber: number | null,
//             // Exactly one of these two is populated, mirroring the
//             // post-Phase-6-correction NormalizedBlock contract.
//             heading?:    { setting, location, time }, // for sceneHeading
//             text?:       string,                       // for everything else
//             inlineRuns:  [ { text, marks: [{type,attrs}] }, ... ]
//           }, ...
//         ]
//       }, ...
//     ],
//     layoutProfile: layoutProfile | null               // pass-through
//   }
//
// Public API:
//   Rga.RenderModel.build(doc, pageMap, normalizedBlocks, layoutProfile?) → RenderModel
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.RenderModel = Rga.RenderModel || {};

  function build(doc, pageMap, normalizedBlocks, layoutProfile) {
    const out = {
      totalPages:    0,
      pages:         [],
      layoutProfile: layoutProfile || null,
      // D.4 — script title for optional running header in PrintRenderer.
      // Sourced from doc.metadata.title; empty string when absent.
      title:         (doc && doc.metadata && typeof doc.metadata.title === 'string')
                       ? doc.metadata.title : ''
    };
    if (!doc || !Array.isArray(pageMap) || !Array.isArray(normalizedBlocks)) return out;

    for (let p = 0; p < pageMap.length; p += 1) {
      const page = pageMap[p];
      if (!page || !Array.isArray(page.blocks)) continue;
      const blocks = [];
      for (let k = 0; k < page.blocks.length; k += 1) {
        const idx = page.blocks[k];
        const nb = normalizedBlocks[idx];
        if (!nb) continue;
        blocks.push(_buildBlock(nb, doc));
      }
      out.pages.push({
        pageNumber:     page.pageNumber,
        usedLines:      page.usedLines,
        availableLines: page.availableLines,
        blocks:         blocks
      });
    }
    out.totalPages = out.pages.length;
    return out;
  }

  function _buildBlock(nb, doc) {
    const block = {
      type:        nb.nodeType,
      pmFrom:      nb.pmFrom,
      pmTo:        nb.pmTo,
      sceneNodeId: nb.sceneNodeId,
      sceneNumber: nb.sceneNumber,
      inlineRuns:  _extractInlineRuns(doc, nb)
    };
    if (nb.nodeType === 'sceneHeading') {
      block.heading = nb.heading;
    } else {
      block.text = nb.text;
    }
    return block;
  }

  // Walk the PM block node's text children. Each text fragment becomes a
  // run carrying its marks (serialized to plain JSON so consumers don't
  // need PM bindings).
  function _extractInlineRuns(doc, nb) {
    const runs = [];
    if (!doc || typeof doc.nodeAt !== 'function') return runs;
    const blockNode = doc.nodeAt(nb.pmFrom);
    if (!blockNode || !blockNode.content || blockNode.content.size === 0) return runs;
    blockNode.content.forEach(function(child) {
      if (child.isText) {
        runs.push({
          text: child.text || '',
          marks: (child.marks || []).map(_serializeMark)
        });
      }
    });
    return runs;
  }

  function _serializeMark(mark) {
    return {
      type:  mark.type && mark.type.name ? mark.type.name : 'unknown',
      attrs: Object.assign({}, mark.attrs || {})
    };
  }

  Rga.RenderModel.build = build;
})();
