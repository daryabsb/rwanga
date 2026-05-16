// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// ScreenplayLayoutEngine — pure-function pagination.
//
// Input:  NormalizedBlock[] (from normalizer.js) + LayoutProfile (from profiles.js)
// Output: PageMap — { layoutProfileId, totalPages, totalLines, pages: [...] }
//
// Algorithm:
//   For each NormalizedBlock, compute its line cost via wrapText(text,
//   profile.widths[blockType]). Greedy-fill the current page until the
//   next block would overflow profile.pageLineBudget — then start a new
//   page. Honour keepWithNext (slug pulls its next block; if the pair
//   doesn't fit, push both to the next page). Always record blocks
//   per-page with their PM positions + line ranges so the renderer can
//   place break decorations and future tools (PDF export, page nav,
//   analytics) can read everything they need without recomputing.
//
// v1 limitations (explicit, not hidden):
//   - splitAllowed = false on every block. A single block longer than
//     the page budget is placed on its own page (it overflows the
//     bottom; user sees it as a tall block). Future (MORE) / (CONT'D)
//     logic flips splitAllowed to true and adds split records.
//   - No widow rules beyond keepWithNext for slugs.
//   - No (CONT'D) markers for character cues continuing across pages.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.layout = Rga.DocTypes.screenplay.layout || {};

  // Cost = wrapped-line count for the block's text at its column width,
  // plus any inherent line cost (e.g. 'blank' = 1, 'transition' = 1).
  // Returns at least 1 — every block occupies at least one row on paper.
  function _lineCostFor(block, profile) {
    if (!block) return 1;
    if (block.type === 'blank') return 1;
    const widths = profile.widths || {};
    const colWidth = widths[block.type] || widths.action || 60;
    const wrapText = Rga.DocTypes.screenplay.layout.wrapText;
    const wrapped = wrapText ? wrapText(block.text || '', colWidth) : 1;
    return Math.max(1, wrapped);
  }

  // Should this block be kept with the next? Currently: scene headings
  // pull at least one body block onto the same page (no orphan slugs).
  // Profile.keepWithNext is the source of truth.
  function _keepsWithNext(block, profile) {
    if (!block || !block.type) return false;
    const list = profile.keepWithNext || [];
    return list.indexOf(block.type) >= 0;
  }

  function _newPage(pageNumber, profile) {
    return {
      pageNumber:      pageNumber,
      startPmPos:      null,
      endPmPos:        null,
      usedLines:       0,
      availableLines:  profile.pageLineBudget,
      blocks:          []
    };
  }

  function _placeBlock(page, block, cost, profile) {
    const startLine = page.usedLines + 1;
    const endLine   = page.usedLines + cost;
    page.blocks.push({
      blockId:   block.id,
      blockType: block.type,
      startPos:  block.pmFrom,
      endPos:    block.pmTo,
      startLine: startLine,
      endLine:   endLine,
      split:     false
    });
    page.usedLines = endLine;
    if (page.startPmPos == null) page.startPmPos = block.pmFrom;
    page.endPmPos = block.pmTo;
    // Inter-block blank spacing — applied AFTER the block, not before,
    // so a page never ends with a stranded blank line.
    const blank = profile.blankLineCostBetween || 0;
    if (blank > 0) page.usedLines += blank;
  }

  function computePageMap(normalizedBlocks, layoutProfile) {
    const profile = layoutProfile || (Rga.DocTypes.screenplay.layout.profiles &&
                                       Rga.DocTypes.screenplay.layout.profiles.Letter());
    const budget  = profile.pageLineBudget;
    const blocks  = Array.isArray(normalizedBlocks) ? normalizedBlocks : [];

    const pages = [];
    let currentPage = _newPage(1, profile);
    pages.push(currentPage);
    let totalLines = 0;

    let i = 0;
    while (i < blocks.length) {
      const block = blocks[i];
      const cost  = _lineCostFor(block, profile);

      // keepWithNext (e.g. slug + first body block) — check the PAIR fits
      // together. If not, push the slug to the next page along with its
      // partner. If the slug is the first thing on a fresh page, accept
      // the placement even if the pair doesn't fit (no point pushing to
      // yet-another-fresh-page).
      if (_keepsWithNext(block, profile) && i + 1 < blocks.length) {
        const next     = blocks[i + 1];
        const nextCost = _lineCostFor(next, profile);
        const pairCost = cost + nextCost + (profile.blankLineCostBetween || 0);
        const room     = currentPage.availableLines - currentPage.usedLines;
        if (pairCost > room && currentPage.usedLines > 0) {
          currentPage = _newPage(pages.length + 1, profile);
          pages.push(currentPage);
        }
        _placeBlock(currentPage, block, cost, profile);
        _placeBlock(currentPage, next, nextCost, profile);
        totalLines += cost + nextCost;
        i += 2;
        continue;
      }

      // Standard placement — if it doesn't fit, start a new page and
      // place it there. A block larger than the page budget on its own
      // gets placed on a fresh page and overflows the bottom (v1
      // limitation; future split logic flips splitAllowed=true).
      const room = currentPage.availableLines - currentPage.usedLines;
      if (cost > room && currentPage.usedLines > 0) {
        currentPage = _newPage(pages.length + 1, profile);
        pages.push(currentPage);
      }
      _placeBlock(currentPage, block, cost, profile);
      totalLines += cost;
      i += 1;
    }

    return {
      layoutProfileId: profile.id,
      totalPages:      pages.length,
      totalLines:      totalLines,
      pages:           pages
    };
  }

  Rga.DocTypes.screenplay.layout.computePageMap = computePageMap;
  // Internal pieces exposed for unit tests.
  Rga.DocTypes.screenplay.layout._lineCostFor = _lineCostFor;
})();
