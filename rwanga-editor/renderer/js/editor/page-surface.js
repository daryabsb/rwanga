// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Applies a doc's page geometry to the live .rga-page element.
//
// Recovery Step 5: PageSurface resolves geometry through the single named
// resolver Rga.ManuscriptGeometry — the same façade PageMap and Print
// Preview use. ManuscriptGeometry delegates the arithmetic to LayoutProfile
// (which reads Constants.PAPER_SIZES). PageSurface consumes the resolved
// layoutProfile.pageSize + layoutProfile.margins; it owns no geometry math.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // Resolve a pageSetup into a layoutProfile via the ManuscriptGeometry
  // façade. resolveFrom(screenplayProfile, settings) is the "I have the
  // pieces, not a whole doc" entry point — PageSurface's callers pass a
  // pageSetup, so screenplayProfile is null here (the Flow visual page
  // does not need direction/RTL; that stays current behaviour).
  function _resolveProfile(pageSetup) {
    if (Rga.ManuscriptGeometry && typeof Rga.ManuscriptGeometry.resolveFrom === 'function') {
      return Rga.ManuscriptGeometry.resolveFrom(null, { pageSetup: pageSetup });
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
