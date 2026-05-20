// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Layout profile — pure arithmetic over typographic constants.
//
// Phase 6 source-of-truth for pagination. Every value here is derivable
// from the screenplay profile + paper + margins + font + per-block column
// widths (per directive rule 5). NEVER comes from DOM measurement.
//
// Output shape:
//   {
//     linesPerPage: number,         // budget per page
//     pageSize: { w, h, unit },     // paper dims (informational)
//     margins:  { top, bottom, left, right, unit },
//     font:     { family, sizePt, leading },
//     blocks: {
//       sceneHeading:  { cpl, leadingBlankLines, splittable, keepWithNext },
//       action:        { cpl, leadingBlankLines, splittable, keepWithNext },
//       character:     { cpl, leadingBlankLines, splittable, keepWithNext },
//       parenthetical: { cpl, leadingBlankLines, splittable, keepWithNext },
//       dialogue:      { cpl, leadingBlankLines, splittable, keepWithNext },
//       shot:          { cpl, leadingBlankLines, splittable, keepWithNext },
//       transition:    { cpl, leadingBlankLines, splittable, keepWithNext },
//       paragraph:     { cpl, leadingBlankLines, splittable, keepWithNext },
//       heading:       { cpl, leadingBlankLines, splittable, keepWithNext }
//     }
//   }
//
// cpl = characters-per-line for monospace at the configured font size +
//       the block's column width. (Courier 12pt → 10 chars per inch.)
// leadingBlankLines = blank lines that come BEFORE this block (the
//       customary screenplay air gap above sceneHeading / action / etc.).
//       The engine treats the first block on a page as having no leading
//       blank — the gap only exists between blocks.
//
// Public API:
//   Rga.LayoutProfile.compose(screenplayProfile?, settings?) → layoutProfile
//   Rga.LayoutProfile.DEFAULT_HOLLYWOOD_LETTER_COURIER_12 — default constant
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.LayoutProfile = Rga.LayoutProfile || {};

  // ----------------------------------------------------------------
  // Geometry constants (Hollywood / Letter / Courier 12pt).
  // ----------------------------------------------------------------
  // These come from longstanding screenplay typography practice:
  //   * Letter paper:    8.5" × 11"
  //   * Margins:         top 1.0", bottom 1.0", left 1.5", right 1.0"
  //     (left wider for binding)
  //   * Courier 12pt at single leading: 6 lines per vertical inch
  //   * Usable text height: 11 - top - bottom = 9.0"
  //   * Lines per page:     9.0" × 6 lpi = 54
  //   * Courier 12pt monospace: 10 chars per horizontal inch (CPI)
  //
  // Per-block column widths (inches), traditional Hollywood layout:
  //   * Action / sceneHeading: 6.0" (uses full body width, 60 cpl)
  //   * Character cue:         occupies ~3.5" centered around the 4.2" mark
  //   * Dialogue:              3.5" body width (35 cpl)
  //   * Parenthetical:         2.0" body width (20 cpl)
  //   * Transition:            right-aligned, logical width 6.0" but conventionally short
  // ----------------------------------------------------------------

  const HOLLYWOOD_DEFAULTS = {
    pageSize: { w: 8.5, h: 11.0, unit: 'in' },
    margins:  { top: 1.0, bottom: 1.0, left: 1.5, right: 1.0, unit: 'in' },
    font:     { family: 'Courier', sizePt: 12, leading: 1.0 },
    blockWidthsIn: {
      sceneHeading:  6.0,
      action:        6.0,
      character:     3.5,
      parenthetical: 2.0,
      dialogue:      3.5,
      shot:          6.0,
      transition:    6.0,
      paragraph:     6.0,
      heading:       6.0
    },
    // Customary blank-line air above each block. The engine ignores
    // leadingBlankLines when a block is first on its page.
    leadingBlankLines: {
      sceneHeading:  1,
      action:        1,
      character:     1,
      parenthetical: 0,
      dialogue:      0,
      shot:          1,
      transition:    1,
      paragraph:     1,
      heading:       1
    }
  };

  // Safety reserve: subtract this many lines from the theoretical linesPerPage.
  // Absorbs browser rendering drift that makes actual lines slightly taller than
  // the pure-math value. One line (at Courier 12pt ≈ 0.167in) gives a small
  // cushion without meaningfully changing page count for normal scripts.
  // Explicit constant here so tests can assert the reserve is applied and
  // future callers can inspect it on the returned profile.
  const SAFETY_LINES = 1;

  // Per-pt → lines-per-inch table for monospace at single leading.
  // For Courier the on-paper line height = sizePt * leading / 72 (in inches).
  function _linesPerInch(sizePt, leading) {
    if (!sizePt || sizePt <= 0) return 6; // fallback to 12pt single
    return 72 / (sizePt * (leading || 1));
  }

  // Courier chars-per-inch at the given point size. Standard 10 cpi at 12pt;
  // larger sizes shrink cpl proportionally. (Monospace fonts scale linearly.)
  function _charsPerInch(sizePt) {
    // Courier 10 cpi is anchored at 12pt; cpi scales inversely with size.
    if (!sizePt || sizePt <= 0) return 10;
    return 10 * (12 / sizePt);
  }

  function _round(n) { return Math.max(1, Math.floor(n)); }

  // ----------------------------------------------------------------
  // Compose
  // ----------------------------------------------------------------

  function compose(screenplayProfile, settings) {
    // Future hook: non-Hollywood conventions (e.g. Arabic / Kurdish-specific)
    // can branch on screenplayProfile.screenplayConvention. V1 supports
    // "hollywood" only; everything else falls back to defaults.
    const _profile = screenplayProfile || {};
    const _settings = settings || {};

    // Overrides: settings may carry pageSetup / fontSize. Use defensively.
    const pageSize = _resolvePageSize(_settings) || HOLLYWOOD_DEFAULTS.pageSize;
    const margins  = _resolveMargins(_settings)  || HOLLYWOOD_DEFAULTS.margins;
    const font     = _resolveFont(_settings)     || HOLLYWOOD_DEFAULTS.font;

    const usableH  = Math.max(0, pageSize.h - margins.top - margins.bottom);
    const usableW  = Math.max(0, pageSize.w - margins.left - margins.right);
    // theoreticalLinesPerPage: pure-math budget before the safety reserve is applied.
    // linesPerPage: actual budget consumed by PageMap — SAFETY_LINES fewer than
    // theoretical, absorbing browser rendering drift so content never bleeds through
    // the bottom margin. Both values are surfaced on the profile for transparency.
    const theoreticalLinesPerPage = _round(usableH * _linesPerInch(font.sizePt, font.leading));
    const linesPerPage = Math.max(1, theoreticalLinesPerPage - SAFETY_LINES);
    const cpi = _charsPerInch(font.sizePt);

    const blocks = {};
    Object.keys(HOLLYWOOD_DEFAULTS.blockWidthsIn).forEach(function(typeName) {
      const widthIn  = Math.min(usableW, HOLLYWOOD_DEFAULTS.blockWidthsIn[typeName]);
      const cpl      = _round(widthIn * cpi);
      const lbl      = HOLLYWOOD_DEFAULTS.leadingBlankLines[typeName] || 0;
      blocks[typeName] = {
        cpl: cpl,
        leadingBlankLines: lbl,
        splittable: false,                                   // V1
        keepWithNext: (typeName === 'sceneHeading' || typeName === 'character')
      };
    });
    // sceneHeading carries structure (setting/location/time) from the
    // normalizer. The engine measures it by concatenating those parts
    // with these separator strings — overriding them here lets a future
    // non-Hollywood convention switch to "setting/time/location" order or
    // different punctuation without touching the normalizer.
    blocks.sceneHeading.separators = {
      settingLocation: ' ',
      locationTime:    ' — '
    };

    // D.2 — carry direction through so PrintRenderer can apply RTL
    // margin mirror (wider binding side is right for Arabic/Kurdish).
    // screenplayProfile.direction is the canonical source; default 'ltr'.
    const direction = (_profile.direction === 'rtl') ? 'rtl' : 'ltr';

    return {
      linesPerPage:            linesPerPage,
      theoreticalLinesPerPage: theoreticalLinesPerPage,  // pre-reserve; diagnostic + testability
      safetyLines:             SAFETY_LINES,              // applied reserve; explicit not magic
      pageSize:                pageSize,
      margins:                 margins,
      font:                    font,
      blocks:                  blocks,
      direction:               direction
    };
  }

  // settings.pageSetup may be { sizeIn: { w, h } } or { paperSize: <name> }
  // where <name> is a key in Rga.Constants.PAPER_SIZES (Letter / A4 / Legal / …).
  // `paperSize` is the canonical field (written by page-setup-dialog.js and doc.js defaults).
  // `size` is accepted as a legacy alias for v2 docs persisted before the rename.
  function _resolvePageSize(settings) {
    if (!settings) return null;
    const ps = settings.pageSetup;
    if (!ps) return null;
    if (ps.sizeIn && typeof ps.sizeIn.w === 'number' && typeof ps.sizeIn.h === 'number') {
      return { w: ps.sizeIn.w, h: ps.sizeIn.h, unit: 'in' };
    }
    // paperSize is canonical; size accepted as legacy alias for v2 docs.
    const sizeName = (typeof ps.paperSize === 'string' ? ps.paperSize : null) ||
                     (typeof ps.size      === 'string' ? ps.size      : null);
    if (sizeName) {
      // Recovery Step 3: paper dimensions come from Constants.PAPER_SIZES —
      // the single paper-size table. LayoutProfile no longer keeps its own
      // Letter/A4/Legal copy. An unrecognised name (or a missing Constants
      // module) yields null here, and compose() falls back to
      // HOLLYWOOD_DEFAULTS.pageSize exactly as it did before.
      const table = (Rga.Constants && Rga.Constants.PAPER_SIZES) || null;
      const entry = table && table[sizeName];
      if (entry && typeof entry.width === 'number' && typeof entry.height === 'number') {
        return { w: entry.width, h: entry.height, unit: 'in' };
      }
    }
    return null;
  }
  function _resolveMargins(settings) {
    if (!settings) return null;
    const m = settings.pageSetup && settings.pageSetup.margins;
    if (!m) return null;
    if (typeof m.top === 'number' && typeof m.bottom === 'number' &&
        typeof m.left === 'number' && typeof m.right === 'number') {
      return { top: m.top, bottom: m.bottom, left: m.left, right: m.right, unit: m.unit || 'in' };
    }
    return null;
  }
  function _resolveFont(settings) {
    if (!settings) return null;
    const f = {};
    if (typeof settings.font_size === 'number')  f.sizePt = settings.font_size;
    if (typeof settings.font_family === 'string') f.family = settings.font_family;
    if (!f.sizePt) return null;
    return {
      family:  f.family || 'Courier',
      sizePt:  f.sizePt,
      leading: 1.0
    };
  }

  // Convenience: pre-computed default for the common case.
  const DEFAULT_HOLLYWOOD_LETTER_COURIER_12 = compose(
    { language: 'en', direction: 'ltr', screenplayConvention: 'hollywood' },
    null
  );

  Rga.LayoutProfile.compose                          = compose;
  Rga.LayoutProfile.DEFAULT_HOLLYWOOD_LETTER_COURIER_12 = DEFAULT_HOLLYWOOD_LETTER_COURIER_12;
  Rga.LayoutProfile._HOLLYWOOD_DEFAULTS              = HOLLYWOOD_DEFAULTS;
  Rga.LayoutProfile._linesPerInch                    = _linesPerInch;
  Rga.LayoutProfile._charsPerInch                    = _charsPerInch;
})();
