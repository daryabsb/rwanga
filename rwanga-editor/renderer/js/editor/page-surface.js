// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Applies a doc's page geometry to the live .rga-page element.
//
// Recovery Step 4: PageSurface no longer resolves paper size or margins
// itself. It routes pageSetup through Rga.LayoutProfile.compose — the same
// arithmetic path PageMap and Print Preview use — and consumes the resolved
// layoutProfile.pageSize + layoutProfile.margins. One geometry source.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // Resolve a pageSetup into a layoutProfile via LayoutProfile.compose.
  // compose() reads Constants.PAPER_SIZES (Recovery Step 3), so the Flow
  // visual page, PageMap, and Print Preview all derive geometry from the
  // single Constants paper-size table.
  function _resolveProfile(pageSetup) {
    if (Rga.LayoutProfile && typeof Rga.LayoutProfile.compose === 'function') {
      return Rga.LayoutProfile.compose(null, { pageSetup: pageSetup });
    }
    return null;
  }

  // Pure: a resolved layoutProfile -> { width, minHeight, contentMinHeight,
  // paddingTop/Right/Bottom/Left } in CSS inch units. Consumes only
  // layoutProfile.pageSize + layoutProfile.margins — no paper-size or
  // margin resolution of its own.
  function cssVarsForProfile(layoutProfile) {
    const ps = layoutProfile.pageSize;
    const m  = layoutProfile.margins;
    return {
      width:            ps.w + 'in',
      minHeight:        ps.h + 'in',
      contentMinHeight: (ps.h - m.top - m.bottom) + 'in',
      paddingTop:       m.top + 'in',
      paddingRight:     m.right + 'in',
      paddingBottom:    m.bottom + 'in',
      paddingLeft:      m.left + 'in'
    };
  }

  // Apply to the live .rga-page element.
  // Also sets .ProseMirror min-height so the full content area is clickable when empty.
  function apply(pageSetup) {
    const page = document.querySelector('.rga-page');
    if (!page || !pageSetup || !pageSetup.margins) return;
    const profile = _resolveProfile(pageSetup);
    if (!profile || !profile.pageSize || !profile.margins) return;
    const v = cssVarsForProfile(profile);
    page.style.width = v.width;
    page.style.minHeight = v.minHeight;
    page.style.paddingTop = v.paddingTop;
    page.style.paddingRight = v.paddingRight;
    page.style.paddingBottom = v.paddingBottom;
    page.style.paddingLeft = v.paddingLeft;
    const pm = page.querySelector('.ProseMirror');
    if (pm) pm.style.minHeight = v.contentMinHeight;
  }

  Rga.PageSurface = {
    apply: apply,
    _cssVarsForProfile: cssVarsForProfile,
    _resolveProfile: _resolveProfile
  };
})();
