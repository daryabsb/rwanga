// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PageSurface — publishes the resolved page width to the --page-width CSS
// token (consumed by the Flow editor column and the Row-3 toolbar band).
//
// Fork A (Brick 4+5): RETIRED from geometry application. #editor is no
// longer "paper" — the Paper view (PrintRenderer leaves) owns all page
// geometry. PageSurface no longer finds #editor, writes no inline width /
// padding / min-height on any element, and imposes no growth model. Its
// only remaining job is to keep --page-width in sync with Page Setup so a
// paper-size change still reaches the Flow column.
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

  // apply(pageSetup) — publish the resolved paper width to the --page-width
  // token on documentElement (the :root scope the token resolves from).
  // Publishes nothing else; touches no editor DOM. Called on doc open
  // (tab-manager) and on Page Setup Apply (page-setup-dialog).
  function apply(pageSetup) {
    if (!pageSetup) return;
    const profile = _resolveProfile(pageSetup);
    if (!profile || !profile.pageSize || typeof profile.pageSize.w !== 'number') return;
    document.documentElement.style.setProperty('--page-width', profile.pageSize.w + 'in');
  }

  Rga.PageSurface = {
    apply:           apply,
    _resolveProfile: _resolveProfile
  };
})();
