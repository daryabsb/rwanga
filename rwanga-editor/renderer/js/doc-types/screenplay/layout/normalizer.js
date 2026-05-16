// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// ScreenplayNormalizer — flattens the outer ProseMirror doc + every
// sceneFrame's attrs.innerDoc tree into a single NormalizedBlock[] stream
// that the layout engine + future importers / exporters / AI tools can
// consume without knowing anything about ProseMirror internals.
//
// Output shape (NormalizedBlock):
//   {
//     id:                "blk_<index>",
//     type:              <screenplay block type — see _OUTER_TYPE_MAP / inner types>,
//     text:              <plain text content>,
//     pmFrom:            <outer PM doc position where this block starts>,
//     pmTo:              <outer PM doc position where this block ends>,
//     sceneId:           <outer attrs.id of containing sceneFrame, or null>,
//     sceneIndex:        <0-based index of containing sceneFrame, or null>,
//     blockIndexInScene: <0-based index within scene's innerDoc.content, or null>,
//     metadata:          <reserved, currently {}>
//   }
//
// The normalizer NEVER reads from the DOM. It walks the PM doc + the
// serialized innerDoc JSON. Same output for the same input — deterministic.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.layout = Rga.DocTypes.screenplay.layout || {};

  // Outer node type → normalized block type. Outer body holds treatment
  // content (paragraphs / headings) plus sceneFrame atoms.
  const _OUTER_TYPE_MAP = {
    titleStrip:  'titleStrip',
    paragraph:   'treatmentParagraph',
    heading:     'treatmentHeading',
    blockquote:  'treatmentParagraph',
    listItem:    'treatmentParagraph'
  };

  // Inner sceneFrame node type → normalized block type. Inner doc holds
  // the screenplay block stream per scene.
  const _INNER_TYPE_MAP = {
    sceneLine:      'sceneHeading',
    action:         'action',
    character:      'character',
    dialogue:       'dialogue',
    parenthetical:  'parenthetical',
    shot:           'shot',
    transition:     'transition',
    inlineFreeText: 'action'
  };

  function _innerTextOf(jsonNode) {
    if (!jsonNode) return '';
    if (jsonNode.type === 'text' && typeof jsonNode.text === 'string') return jsonNode.text;
    if (!Array.isArray(jsonNode.content)) return '';
    let out = '';
    jsonNode.content.forEach(function(child) {
      out += _innerTextOf(child);
    });
    return out;
  }

  function _sceneSlugText(sceneLineJson) {
    // sceneLine looks like { type: 'sceneLine', attrs: { setting, time }, content: [text "LOCATION"] }
    // Real on-paper slug = `SETTING LOCATION — TIME` (the slug-row format the
    // editor shows). Layout engine counts wrapped lines on this synthetic
    // text — accurate enough at Courier widths.
    const attrs = (sceneLineJson && sceneLineJson.attrs) || {};
    const setting  = attrs.setting || 'INT.';
    const time     = attrs.time || 'DAY';
    const location = _innerTextOf(sceneLineJson).trim();
    return location
      ? (setting + ' ' + location + ' — ' + time)
      : (setting + ' — ' + time);
  }

  // Normalize one sceneFrame's innerDoc into NormalizedBlock[].
  // Each inner content node becomes one block. sceneLine becomes a
  // 'sceneHeading' block; transition stays as 'transition'; everything
  // else maps via _INNER_TYPE_MAP.
  function _normalizeSceneFrame(sceneJson, pmFrom, pmTo, sceneId, sceneIndex, idCounterRef) {
    const innerDoc = sceneJson || { type: 'doc', content: [] };
    const content = Array.isArray(innerDoc.content) ? innerDoc.content : [];
    const out = [];
    content.forEach(function(node, idx) {
      if (!node || !node.type) return;
      let blockType, text;
      if (node.type === 'sceneLine') {
        blockType = 'sceneHeading';
        text = _sceneSlugText(node);
      } else {
        blockType = _INNER_TYPE_MAP[node.type];
        if (!blockType) return; // unknown inner type — skip
        text = _innerTextOf(node);
      }
      idCounterRef.n += 1;
      out.push({
        id:                'blk_' + String(idCounterRef.n).padStart(4, '0'),
        type:              blockType,
        text:              text,
        // Inner blocks all live inside the sceneFrame atom; from the OUTER
        // editor's perspective they share the same pmFrom/pmTo (the atom's
        // outer positions). The renderer can't split inside an atom anyway,
        // so this is the correct granularity for break placement.
        pmFrom:            pmFrom,
        pmTo:              pmTo,
        sceneId:           sceneId,
        sceneIndex:        sceneIndex,
        blockIndexInScene: idx,
        metadata:          {}
      });
    });
    return out;
  }

  // Plain-text content of an outer PM node (paragraph, heading, etc.).
  // Uses textBetween if the PM Node API is available; falls back to
  // walking JSON shape so the normalizer also works from raw .rga JSON
  // (handy for export / batch scripts that don't mount an editor).
  function _outerTextOf(pmNode) {
    if (!pmNode) return '';
    if (typeof pmNode.textContent === 'string') return pmNode.textContent;
    if (typeof pmNode.textBetween === 'function') {
      try { return pmNode.textBetween(0, pmNode.content.size, '\n'); } catch (_) { /* fall through */ }
    }
    // JSON-shape fallback.
    return _innerTextOf(pmNode);
  }

  // Walk the outer doc. For each top-level body child:
  //   - sceneFrame → recurse into _normalizeSceneFrame
  //   - paragraph/heading/etc. → one treatment block
  //   - empty paragraph → 'blank' (engine treats as 1-line spacer)
  // Plus an optional 'titleStrip' block from doc.titleStrip if present.
  function normalize(outerDoc) {
    if (!outerDoc) return [];
    const idCounter = { n: 0 };
    const out = [];
    let sceneIndex = -1;

    // PM Node descent: doc → (titleStrip?, body) where body holds blocks.
    // The outer schema (mount.js) names the body container 'body'.
    function pushBlock(type, text, pmFrom, pmTo, sceneId, sceneIdx, blockIdxInScene) {
      idCounter.n += 1;
      out.push({
        id:                'blk_' + String(idCounter.n).padStart(4, '0'),
        type:              type,
        text:              text || '',
        pmFrom:            pmFrom,
        pmTo:              pmTo,
        sceneId:           sceneId || null,
        sceneIndex:        sceneIdx == null ? null : sceneIdx,
        blockIndexInScene: blockIdxInScene == null ? null : blockIdxInScene,
        metadata:          {}
      });
    }

    // Iterate children of the outer doc. Handle PM Node + JSON shapes.
    function eachChild(node, fn) {
      if (!node) return;
      if (typeof node.forEach === 'function') { node.forEach(fn); return; }
      if (Array.isArray(node.content)) {
        let pos = 0;
        node.content.forEach(function(child, i) {
          fn(child, pos, i);
          // For JSON shape positions are not meaningful — pass 0/0; the
          // engine + renderer only use pmFrom/pmTo for live PM use.
          pos += 1;
        });
      }
    }

    // Walk the outer doc's content.
    let posCursor = 0;
    function processOuterChild(child, pos) {
      const childType = (child.type && child.type.name) || child.type;
      const childSize = (child.nodeSize != null) ? child.nodeSize : 1;
      const pmFrom = pos;
      const pmTo = pos + childSize;

      if (childType === 'titleStrip') {
        const text = _outerTextOf(child);
        if (text && text.trim()) pushBlock('titleStrip', text, pmFrom, pmTo, null, null, null);
      } else if (childType === 'body') {
        // Recurse into body children.
        let innerPos = pmFrom + 1; // +1 to step past the body open token
        const bodyContent = child.content || child;
        eachChild(child, function(bodyChild) {
          processBodyChild(bodyChild, innerPos);
          innerPos += (bodyChild.nodeSize != null) ? bodyChild.nodeSize : 1;
        });
      } else {
        // Treat unknown top-level nodes as treatment paragraphs (safer than dropping).
        const text = _outerTextOf(child);
        pushBlock('treatmentParagraph', text, pmFrom, pmTo, null, null, null);
      }
    }

    function processBodyChild(child, pos) {
      const childType = (child.type && child.type.name) || child.type;
      const childSize = (child.nodeSize != null) ? child.nodeSize : 1;
      const pmFrom = pos;
      const pmTo = pos + childSize;

      if (childType === 'sceneFrame') {
        sceneIndex += 1;
        const sceneId = (child.attrs && child.attrs.id) || 'scene_' + (sceneIndex + 1);
        const innerDoc = (child.attrs && child.attrs.innerDoc) || null;
        const sceneBlocks = _normalizeSceneFrame(innerDoc, pmFrom, pmTo, sceneId, sceneIndex, idCounter);
        sceneBlocks.forEach(function(b) { out.push(b); });
      } else {
        const mapped = _OUTER_TYPE_MAP[childType] || 'treatmentParagraph';
        const text = _outerTextOf(child);
        const isEmpty = !text || !text.trim();
        if (isEmpty && mapped === 'treatmentParagraph') {
          // Empty paragraphs in body = explicit spacers between scenes.
          pushBlock('blank', '', pmFrom, pmTo, null, null, null);
        } else {
          pushBlock(mapped, text, pmFrom, pmTo, null, null, null);
        }
      }
    }

    eachChild(outerDoc, function(child) {
      processOuterChild(child, posCursor);
      posCursor += (child.nodeSize != null) ? child.nodeSize : 1;
    });

    return out;
  }

  Rga.DocTypes.screenplay.layout.normalize = normalize;
  // Exposed for unit tests that want the internal pieces.
  Rga.DocTypes.screenplay.layout._innerTextOf  = _innerTextOf;
  Rga.DocTypes.screenplay.layout._sceneSlugText = _sceneSlugText;
})();
