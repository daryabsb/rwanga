// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PageMap engine — pure function (NormalizedBlock[], layoutProfile) → PageMap[].
//
// Phase 6 conservative V1 packer. NEVER measures DOM. Every line count
// derives from the layout profile + the block's character text length.
//
// V1 rules (per directive rule 6):
//   * sceneHeading: not splittable.
//   * action:       not splittable.
//   * dialogue:     not splittable.
//   * If a block doesn't fit on the remaining lines of the current page,
//     move the ENTIRE block (and its keep-with-next chain) to the next
//     page.
//
// Keep-with-next discipline:
//   * sceneHeading attaches to the next block in sequence.
//   * character    attaches to the next block in sequence (dialogue
//     or parenthetical → dialogue).
//   These chains are placed atomically. If the chain doesn't fit, the
//   whole chain travels.
//
// PageMap entry shape (directive rule 7):
//   {
//     pageNumber:     number,
//     usedLines:      number,
//     availableLines: number,
//     blocks:         Array<index into normalizedBlocks>
//   }
//
// Public API:
//   Rga.PageMap.build(normalizedBlocks, layoutProfile) → PageMap[]
//   Rga.PageMap.measureBlock(block, layoutProfile, isFirstOnPage) → number  (lines)
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.PageMap = Rga.PageMap || {};

  // ----------------------------------------------------------------
  // measureBlock — total lines a single block consumes on a page.
  //   leadingBlankLines counts only when block is NOT the first on its page.
  //   content lines  = max(1, ceil(measureText.length / cpl)).
  //
  // For sceneHeading the normalizer hands us a STRUCTURED `heading`
  // ({setting, location, time}); we synthesise a measurement-only string
  // by concatenating the parts with the profile's separators. The
  // composition lives here (not in the normalizer) because it's pure
  // length arithmetic — not display. Renderers compose their own strings.
  // ----------------------------------------------------------------
  function measureBlock(block, layoutProfile, isFirstOnPage) {
    if (!block || !block.nodeType) return 0;
    const spec = (layoutProfile && layoutProfile.blocks && layoutProfile.blocks[block.nodeType])
      || _fallbackSpec();
    const lbl  = isFirstOnPage ? 0 : (spec.leadingBlankLines || 0);
    const measureText = (block.nodeType === 'sceneHeading')
      ? _composeHeadingForMeasure(block.heading, spec)
      : (block.text || '');
    const content = _measureContentLines(measureText, spec.cpl || 60);
    return lbl + content;
  }

  // Engine-internal: build the measurement-only string for a structured
  // sceneHeading using the profile's separator widths. NOT for display.
  function _composeHeadingForMeasure(heading, spec) {
    if (!heading) return '';
    const sep = (spec && spec.separators) || { settingLocation: ' ', locationTime: ' — ' };
    let s = '';
    if (heading.setting) s += heading.setting;
    if (heading.location) {
      if (s) s += sep.settingLocation;
      s += heading.location;
    }
    if (heading.time) {
      if (s) s += sep.locationTime;
      s += heading.time;
    }
    return s;
  }

  function _measureContentLines(text, cpl) {
    if (!text) return 1; // even an empty block occupies one visible line
    // Treat explicit hard newlines as their own runs (rare in screenplay
    // blocks but supported defensively).
    const runs = text.split(/\r\n|\r|\n/);
    let total = 0;
    for (let i = 0; i < runs.length; i += 1) {
      const len = runs[i].length;
      total += Math.max(1, Math.ceil(len / cpl));
    }
    return Math.max(1, total);
  }

  function _fallbackSpec() {
    return { cpl: 60, leadingBlankLines: 1, splittable: false, keepWithNext: false };
  }

  // ----------------------------------------------------------------
  // collectChain — build the keep-with-next chain starting at index i.
  // Returns [i, i+1, ...] until a block without keepWithNext is found or
  // the array runs out.
  // ----------------------------------------------------------------
  function _collectChain(blocks, i) {
    const out = [i];
    let j = i;
    while (j + 1 < blocks.length && blocks[j].keepWithNext) {
      j += 1;
      out.push(j);
    }
    return out;
  }

  // ----------------------------------------------------------------
  // chainCost — total lines for a chain placed starting at the current
  // page's usedLines. Honors the "first on page → no leading blank" rule
  // only for the head of the chain WHEN page is empty.
  // ----------------------------------------------------------------
  function _chainCost(chain, blocks, layoutProfile, pageIsEmpty) {
    let total = 0;
    for (let k = 0; k < chain.length; k += 1) {
      const isFirstOnPage = (k === 0 && pageIsEmpty);
      total += measureBlock(blocks[chain[k]], layoutProfile, isFirstOnPage);
    }
    return total;
  }

  function _placeChain(chain, blocks, layoutProfile, page) {
    for (let k = 0; k < chain.length; k += 1) {
      const lines = measureBlock(blocks[chain[k]], layoutProfile, page.usedLines === 0);
      page.usedLines += lines;
      page.blocks.push(chain[k]);
    }
  }

  function _newPage(pageNumber, availableLines) {
    return {
      pageNumber:     pageNumber,
      usedLines:      0,
      availableLines: availableLines,
      blocks:         []
    };
  }

  // ----------------------------------------------------------------
  // Resolve the per-page line budget. Normal path: the caller's
  // layoutProfile.linesPerPage. No profile (isolated test / pathological
  // boot): fall back to LayoutProfile's named default — which already
  // carries the SAFETY_LINES reserve — NEVER a raw literal. If even the
  // LayoutProfile module is absent, fail loud rather than silently
  // resurrect the old hardcoded 54-line budget.
  // ----------------------------------------------------------------
  function _resolveLinesPerPage(layoutProfile) {
    if (layoutProfile && typeof layoutProfile.linesPerPage === 'number') {
      return layoutProfile.linesPerPage;
    }
    const def = Rga.LayoutProfile && Rga.LayoutProfile.DEFAULT_HOLLYWOOD_LETTER_COURIER_12;
    if (def && typeof def.linesPerPage === 'number') {
      return def.linesPerPage;
    }
    throw new Error('PageMap.build: no layoutProfile.linesPerPage and ' +
      'Rga.LayoutProfile.DEFAULT_HOLLYWOOD_LETTER_COURIER_12 is unavailable — ' +
      'refusing to resurrect a hardcoded line budget.');
  }

  // ----------------------------------------------------------------
  // build — main entry. Greedy pack chains onto pages.
  // ----------------------------------------------------------------
  function build(blocks, layoutProfile) {
    const lpp = _resolveLinesPerPage(layoutProfile);
    const pages = [];
    let cur = _newPage(1, lpp);

    if (!Array.isArray(blocks) || blocks.length === 0) {
      pages.push(cur);
      return pages;
    }

    let i = 0;
    while (i < blocks.length) {
      const chain = _collectChain(blocks, i);
      const costOnCur = _chainCost(chain, blocks, layoutProfile, cur.blocks.length === 0);
      const fits      = costOnCur <= (cur.availableLines - cur.usedLines);

      if (fits) {
        _placeChain(chain, blocks, layoutProfile, cur);
        i = chain[chain.length - 1] + 1;
        continue;
      }

      // Doesn't fit on current page.
      if (cur.blocks.length === 0) {
        // Page is empty and the chain still doesn't fit — V1 cannot split,
        // so place the chain anyway as an overlong page (the only safety
        // net for pathological input). Production V2 will split here.
        _placeChain(chain, blocks, layoutProfile, cur);
        pages.push(cur);
        cur = _newPage(pages.length + 1, lpp);
        i = chain[chain.length - 1] + 1;
        continue;
      }

      // Page has prior blocks — push it, retry chain on a fresh page.
      pages.push(cur);
      cur = _newPage(pages.length + 1, lpp);
      // loop body re-enters with same i → chain rebuilt against fresh page
    }

    if (cur.blocks.length > 0 || pages.length === 0) pages.push(cur);
    return pages;
  }

  // ----------------------------------------------------------------
  // Stable nodeId for a page boundary — used by NavigationIndex.pages
  // to list owning scenes per page. Pure helper consumed by nav-index.
  // ----------------------------------------------------------------
  function pagesToIndexEntries(pages, normalizedBlocks) {
    const out = [];
    for (let p = 0; p < pages.length; p += 1) {
      const page = pages[p];
      const sceneIds = [];
      const seen = new Set();
      let startPmPos = null;
      let endPmPos = null;
      for (let k = 0; k < page.blocks.length; k += 1) {
        const b = normalizedBlocks[page.blocks[k]];
        if (!b) continue;
        if (startPmPos === null || b.pmFrom < startPmPos) startPmPos = b.pmFrom;
        if (endPmPos === null   || b.pmTo   > endPmPos)   endPmPos   = b.pmTo;
        if (b.sceneNodeId && !seen.has(b.sceneNodeId)) {
          seen.add(b.sceneNodeId);
          sceneIds.push(b.sceneNodeId);
        }
      }
      out.push({
        pageNumber:       page.pageNumber,
        startPmPos:       startPmPos,
        endPmPos:         endPmPos,
        lineCount:        page.usedLines,
        sceneIds:         sceneIds,
        firstBlockNodeId: null,   // reserved (block-level ids deferred per §6.1)
        lastBlockNodeId:  null
      });
    }
    return out;
  }

  Rga.PageMap.build                = build;
  Rga.PageMap.measureBlock         = measureBlock;
  Rga.PageMap.pagesToIndexEntries  = pagesToIndexEntries;
})();
