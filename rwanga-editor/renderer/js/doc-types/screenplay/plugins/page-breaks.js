// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Estimated page-break overlay. Step A: pixel-math estimate, not true pagination.
// Self-contained so true pagination (v0.2) can replace it without touching callers.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // 12pt Courier sets 6 lines per inch — the industry estimate.
  const LINES_PER_INCH = 6;
  // CSS resolves 1 inch as 96 px.
  const PX_PER_INCH = 96;

  function _paperSizes() {
    return (Rga.Constants && Rga.Constants.PAPER_SIZES) || {
      Letter: { width: 8.5, height: 11 }
    };
  }

  // Pure: pageSetup -> estimated text lines that fit on one page.
  function estimateLinesPerPage(pageSetup) {
    const sizes = _paperSizes();
    const paper = sizes[pageSetup.paperSize] || sizes.Letter;
    const usableHeightIn = paper.height - pageSetup.margins.top - pageSetup.margins.bottom;
    return Math.floor(usableHeightIn * LINES_PER_INCH);
  }

  // Full page height in CSS px. The .rga-page element's height includes its
  // margin-padding, so page breaks are placed against the FULL page height —
  // usable height is only for estimateLinesPerPage, not for break placement.
  function _fullPageHeightPx(pageSetup) {
    const sizes = _paperSizes();
    const paper = sizes[pageSetup.paperSize] || sizes.Letter;
    return paper.height * PX_PER_INCH;
  }

  // Render break-line + page-number overlay elements inside .rga-page.
  function _renderBreaks(pageEl, pageSetup) {
    let layer = pageEl.querySelector('.rga-page-break-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'rga-page-break-layer';
      pageEl.appendChild(layer);
    }
    const fullPx = _fullPageHeightPx(pageSetup);
    if (fullPx <= 0) { layer.innerHTML = ''; return; }

    // ceil(height / page) - 1 = page boundaries inside the content.
    // An exactly-one-page document yields 0 breaks; just-over-one-page yields 1.
    const nBreaks = Math.max(0, Math.ceil(pageEl.scrollHeight / fullPx) - 1);

    layer.innerHTML = '';
    for (let i = 1; i <= nBreaks; i++) {
      const mark = document.createElement('div');
      mark.className = 'rga-page-break';
      mark.style.top = (i * fullPx) + 'px';
      mark.dataset.pageLabel = 'page ' + (i + 1);
      layer.appendChild(mark);
    }
  }

  // ProseMirror view-plugin: re-renders the overlay on every editor update.
  // getPageSetup() must return the active doc's pageSetup object.
  function pageBreaksPlugin(getPageSetup) {
    const PM = window.RgaProseMirror;
    return new PM.Plugin({
      view: function() {
        return {
          update: function() {
            const pageEl = document.querySelector('.rga-page');
            const ps = getPageSetup && getPageSetup();
            if (pageEl && ps && ps.margins) _renderBreaks(pageEl, ps);
          }
        };
      }
    });
  }

  Rga.PageBreaks = {
    estimateLinesPerPage,
    pageBreaksPlugin,
    _LINES_PER_INCH: LINES_PER_INCH,
    _PX_PER_INCH: PX_PER_INCH
  };
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.pageBreaksPlugin = pageBreaksPlugin;
})();
