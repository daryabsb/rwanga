// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// LayoutProfile — externalizes every screenplay layout assumption so the
// engine never hardcodes paper / font / chars-per-line literals. Future
// profiles for TV scripts, stage plays, Arabic/Kurdish typography, custom
// templates etc. plug in by producing a LayoutProfile of the same shape.
//
// Engine signature: computePageMap(normalizedBlocks, layoutProfile) → PageMap
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.layout = Rga.DocTypes.screenplay.layout || {};

  // Industry-standard US screenplay typography:
  //   Courier 12pt → 6 lines per vertical inch
  //   Letter 8.5×11 with 1" top/bottom = 9" usable = 54 lines
  //   1.5" left margin / 1" right = 6" usable width = 60 Courier chars per line
  //   Dialogue indent: ~1" each side, ~3.5" wide = ~35 chars/line
  //   Parenthetical indent: ~1.5" each side, ~2.8" wide = ~28 chars/line
  //
  // These ratios come from the Academy / WGA conventions; deviation
  // breaks the "one page ≈ one minute" property writers depend on.
  function _buildLetterProfile() {
    return {
      id:              'screenplay-letter-courier12',
      paper:           'Letter',
      paperDimensions: { width: 8.5, height: 11, unit: 'in' },
      margins:         { top: 1, right: 1, bottom: 1, left: 1.5 },
      font:            { family: 'Courier Prime', size: 12 },
      pageLineBudget:  54,
      widths: {
        action:             60,
        dialogue:           35,
        parenthetical:      28,
        character:          30,
        transition:         15,
        sceneHeading:       60,
        shot:               60,
        treatmentParagraph: 60,
        treatmentHeading:   60,
        titleStrip:         60
      },
      keepWithNext:        ['sceneHeading'],
      blankLineCostBetween: 1
    };
  }

  // A4 = 210mm × 297mm = 8.27" × 11.69". With the same 1" margins:
  //   Usable height = 9.69" = ~58 lines at 6 lpi.
  //   Usable width = 5.77" = ~57 Courier chars per line (vs 60 for Letter).
  // Most international productions still emulate US conventions for cue/
  // dialogue widths (because the visual rhythm matters more than the
  // millimetres); we keep those columns at US values and only adjust the
  // page line budget + action width.
  function _buildA4Profile() {
    return {
      id:              'screenplay-a4-courier12',
      paper:           'A4',
      paperDimensions: { width: 8.27, height: 11.69, unit: 'in' },
      margins:         { top: 1, right: 1, bottom: 1, left: 1.5 },
      font:            { family: 'Courier Prime', size: 12 },
      pageLineBudget:  58,
      widths: {
        action:             57,
        dialogue:           35,
        parenthetical:      28,
        character:          30,
        transition:         15,
        sceneHeading:       57,
        shot:               57,
        treatmentParagraph: 57,
        treatmentHeading:   57,
        titleStrip:         57
      },
      keepWithNext:        ['sceneHeading'],
      blankLineCostBetween: 1
    };
  }

  // Build a profile from a doc's pageSetup object. Falls back to Letter.
  // When the user changes paper size in Page Setup, this is what the
  // renderer plugin calls to refresh the active profile.
  function fromPageSetup(pageSetup) {
    const paper = pageSetup && pageSetup.paperSize;
    const base = paper === 'A4' ? _buildA4Profile() : _buildLetterProfile();
    // Override margins from the doc if they're set explicitly.
    if (pageSetup && pageSetup.margins) {
      base.margins = Object.assign({}, base.margins, pageSetup.margins);
      // Recompute pageLineBudget from the new vertical margins
      // (6 lines per inch is fixed by Courier 12pt).
      const usableHeight = base.paperDimensions.height - base.margins.top - base.margins.bottom;
      base.pageLineBudget = Math.floor(usableHeight * 6);
    }
    return base;
  }

  Rga.DocTypes.screenplay.layout.profiles = {
    fromPageSetup: fromPageSetup,
    Letter: _buildLetterProfile,
    A4:     _buildA4Profile
  };
})();
