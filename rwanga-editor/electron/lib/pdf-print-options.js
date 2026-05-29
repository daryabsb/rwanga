// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PB1.C — pure layout-geometry → Electron printToPDF options mapper.
//
// This module is the single place where the renderer's resolved layout
// geometry (the same shape Rga.LayoutProfile.compose / ManuscriptGeometry
// produces) is translated into the option object Electron's
// webContents.printToPDF(options) expects. Keeping it pure (no electron,
// no DOM) makes the page-size / margin parity directly unit-testable —
// the failure mode the Print/Export audit warns about (wrong-sized output
// because printToPDF options don't match the preview) is caught here.
//
// Geometry input shape (subset of the composed layout profile):
//   { pageSize: { w, h, unit:'in' },
//     margins:  { top, bottom, left, right, unit:'in' },   // informational
//     direction: 'ltr' | 'rtl',                            // informational
//     orientation: 'portrait' | 'landscape' }              // already baked
//                                                          // into pageSize w/h
//
// Output: Electron printToPDF options.
//   * pageSize is given in INCHES (Electron 20+ custom pageSize object
//     uses inches for width/height).
//   * margins are ZERO: each .rga-page-sheet already bakes the screenplay
//     margins into its own padding (from layoutProfile.margins), so the
//     physical page must be edge-to-edge or the margins would be applied
//     twice.
//   * preferCSSPageSize:true lets the export document's `@page { size: … }`
//     rule (written by renderer/js/export/pdf-export.js from the SAME
//     pageSize) own the final paper size, so the two never diverge.
//   * landscape stays false because compose() already swapped pageSize
//     w/h for landscape orientation — rotating again would undo it.
'use strict';

// Letter (8.5 x 11 in) — matches Rga.LayoutProfile HOLLYWOOD_DEFAULTS so a
// missing / malformed geometry still produces a sane, correctly-sized PDF
// instead of Electron's own default.
const FALLBACK_PAGE = { w: 8.5, h: 11.0 };

function _positive(value, fallback) {
  return (typeof value === 'number' && isFinite(value) && value > 0) ? value : fallback;
}

function toPrintOptions(geometry) {
  geometry = geometry || {};
  const ps = geometry.pageSize || {};
  const width  = _positive(ps.w, FALLBACK_PAGE.w);
  const height = _positive(ps.h, FALLBACK_PAGE.h);

  return {
    pageSize: { width: width, height: height },   // inches
    margins:  { top: 0, bottom: 0, left: 0, right: 0 },
    printBackground:   true,
    preferCSSPageSize: true,
    landscape:         false
  };
}

module.exports = { toPrintOptions, FALLBACK_PAGE };
