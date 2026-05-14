// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Applies doc.settings.pageSetup (paper size + margins) to the .rga-page element.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  function _paperSizes() {
    return (Rga.Constants && Rga.Constants.PAPER_SIZES) || {
      Letter: { width: 8.5, height: 11 }
    };
  }

  // Pure: pageSetup -> { width, minHeight, paddingTop/Right/Bottom/Left } in CSS inch units.
  function cssVarsFor(pageSetup) {
    const sizes = _paperSizes();
    const paper = sizes[pageSetup.paperSize] || sizes.Letter;
    const m = pageSetup.margins;
    return {
      width: paper.width + 'in',
      minHeight: paper.height + 'in',
      paddingTop: m.top + 'in',
      paddingRight: m.right + 'in',
      paddingBottom: m.bottom + 'in',
      paddingLeft: m.left + 'in'
    };
  }

  // Apply to the live .rga-page element.
  function apply(pageSetup) {
    const page = document.querySelector('.rga-page');
    if (!page || !pageSetup || !pageSetup.margins) return;
    const v = cssVarsFor(pageSetup);
    page.style.width = v.width;
    page.style.minHeight = v.minHeight;
    page.style.paddingTop = v.paddingTop;
    page.style.paddingRight = v.paddingRight;
    page.style.paddingBottom = v.paddingBottom;
    page.style.paddingLeft = v.paddingLeft;
  }

  Rga.PageSurface = { apply, _cssVarsFor: cssVarsFor };
})();
