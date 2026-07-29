// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PageSurface — publishes the resolved page width/height to the
// --page-width / --page-height CSS tokens (consumed by the Flow editor
// column and the Row-3 toolbar band).
//
// Fork A (Brick 4+5): RETIRED from geometry application. #editor is no
// longer "paper" — the Paper view (PrintRenderer leaves) owns all page
// geometry. PageSurface writes no inline width/padding on any element and
// imposes no pagination/seam model. Its job is to keep --page-width AND
// --page-height in sync with Page Setup so a paper-size change still
// reaches the Flow column.
//
// GAP-2-1 (S2.3F): --page-height is consumed by editor-prosemirror.css as a
// MINIMUM height on the Flow #editor surface — a floor, not a cap. A New
// document therefore paints at its full configured paper size (A4/Letter)
// from the first frame instead of the near-zero content-driven height an
// empty doc previously produced; #editor still grows past one page's height
// once content overflows it (min-height, not height), so Flow stays a
// single continuous surface with no seams/pagination (Fork A invariant
// intact — only the FLOOR changed).
//
// Resolution still flows through the single named resolver
// Rga.ManuscriptGeometry -> Rga.LayoutProfile (which reads
// Constants.PAPER_SIZES).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // Resolve a pageSetup into a layoutProfile via the ManuscriptGeometry
  // facade. screenplayProfile is null — only pageSize.w is needed here.
  function _resolveProfile(pageSetup) {
    if (Rga.ManuscriptGeometry && typeof Rga.ManuscriptGeometry.resolveFrom === 'function') {
      return Rga.ManuscriptGeometry.resolveFrom(null, { pageSetup: pageSetup });
    }
    return null;
  }

  // apply(pageSetup) — publish the resolved paper width/height to the
  // --page-width / --page-height tokens on documentElement (the :root scope
  // the tokens resolve from). Publishes nothing else; touches no editor DOM.
  // Called on doc open (tab-manager) and on Page Setup Apply
  // (page-setup-dialog).
  function apply(pageSetup) {
    if (!pageSetup) return;
    const profile = _resolveProfile(pageSetup);
    if (!profile || !profile.pageSize || typeof profile.pageSize.w !== 'number') return;
    document.documentElement.style.setProperty('--page-width', profile.pageSize.w + 'in');
    if (typeof profile.pageSize.h === 'number') {
      document.documentElement.style.setProperty('--page-height', profile.pageSize.h + 'in');
    }
  }

  Rga.PageSurface = {
    apply:           apply,
    _resolveProfile: _resolveProfile
  };
})();
