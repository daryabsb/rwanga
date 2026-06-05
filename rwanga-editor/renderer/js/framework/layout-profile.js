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
  // Per-block column widths (inches). Density Slice 7: these MUST match the
  // Paper truth surface (`.rga-print-block-*` in editor-prosemirror.css) —
  // cpl = width × cpi, and cpi is direction-aware (see _charsPerInch).
  //   * Action / sceneHeading / transition: full body width (6.0" clamp)
  //   * Character cue:         3.5" placeholder — character never wraps
  //   * Dialogue:              2.5" text column (CSS max-width 3.5" − pad 1.0")
  //   * Parenthetical:         2.0" text column (CSS max-width 3.5" − pad 1.5")
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
      dialogue:      2.5,
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

  // Chars-per-inch at the given point size and text direction (Density Slice 7).
  //   * LTR (Hollywood): Courier monospace — exactly 10 cpi at 12pt.
  //   * RTL (ratified Kurdish/RTL profile, Rule 10): the Paper truth surface
  //     renders Noto Naskh Arabic, whose measured line capacity is ≈ 14.5 cpi
  //     at 12pt — the median of the per-type capacities measured by the
  //     paper-truth probe (action 14.1 / parenthetical 14.5 / dialogue 15.5;
  //     Density Slice 4/7 line-capacity forensic). This is a FONT metric, not
  //     a per-fixture constant. `direction` is the discriminator because the
  //     RTL truth surface forces Noto Naskh via CSS regardless of font.family.
  // cpi scales inversely with point size for both (linear glyph scaling).
  function _charsPerInch(sizePt, direction) {
    const baseCpi = (direction === 'rtl') ? 14.5 : 10;
    if (!sizePt || sizePt <= 0) return baseCpi;
    return baseCpi * (12 / sizePt);
  }

  function _round(n) { return Math.max(1, Math.floor(n)); }

  // ----------------------------------------------------------------
  // Compose
  // ----------------------------------------------------------------

  // compose(screenplayProfile, settings, contract?)
  //
  // The optional third argument is a resolved Print Contract
  // (Rga.PrintContract.resolve(doc)). When present, the OWNED enums — paper,
  // orientation, direction, page numbering — are sourced from the contract
  // (the single owner of document print truth) instead of being re-read from
  // the raw scattered fields, and the contract is attached on the output as
  // `profile.printContract` so every renderer that consumes a layoutProfile
  // also carries the canonical contract. Geometry math is unchanged.
  //
  // When NO contract is passed (resolveFrom, the DEFAULT constant, direct test
  // calls), behavior is BYTE-IDENTICAL to before — the identity rule
  // resolveFrom(p,s) === compose(p,s) is preserved. Because the contract reads
  // the same owned homes these helpers read, the resolved values are identical
  // either way: this is an ownership change, not a geometry change.
  function compose(screenplayProfile, settings, contract) {
    // Future hook: non-Hollywood conventions (e.g. Arabic / Kurdish-specific)
    // can branch on screenplayProfile.screenplayConvention. V1 supports
    // "hollywood" only; everything else falls back to defaults.
    const _profile = screenplayProfile || {};
    const _settings = settings || {};

    // Overrides: settings may carry pageSetup / fontSize. Use defensively.
    // Paper: a stored explicit sizeIn (legacy v2 raw dims) always wins; otherwise
    // the contract's paper NAME (when a contract is present) or the settings name.
    const orientation = contract ? contract.orientation : _resolveOrientation(_settings);
    let   pageSize    = _resolvePageSizeWithContract(_settings, contract) || HOLLYWOOD_DEFAULTS.pageSize;
    const margins     = _resolveMargins(_settings)  || HOLLYWOOD_DEFAULTS.margins;
    const font        = _resolveFont(_settings)     || HOLLYWOOD_DEFAULTS.font;

    // S8 — landscape rotates the paper. Page-derived geometry (usable
    // dims, linesPerPage, cpl) must reflect the rotated paper, so the
    // swap happens BEFORE the arithmetic below. The single-resolver
    // truth rule (RC1 §10 + S8 stop condition) makes this the only
    // place where paper/orientation math runs — both PageSetupPreview
    // (Settings UI) and PrintRenderer (future) read this output.
    if (orientation === 'landscape' && pageSize.w < pageSize.h) {
      pageSize = { w: pageSize.h, h: pageSize.w, unit: pageSize.unit };
    }

    const usableH  = Math.max(0, pageSize.h - margins.top - margins.bottom);
    const usableW  = Math.max(0, pageSize.w - margins.left - margins.right);
    // theoreticalLinesPerPage: pure-math budget before the safety reserve is applied.
    // linesPerPage: actual budget consumed by PageMap — SAFETY_LINES fewer than
    // theoretical, absorbing browser rendering drift so content never bleeds through
    // the bottom margin. Both values are surfaced on the profile for transparency.
    const theoreticalLinesPerPage = _round(usableH * _linesPerInch(font.sizePt, font.leading));
    const linesPerPage = Math.max(1, theoreticalLinesPerPage - SAFETY_LINES);
    // Text direction — RTL (Kurdish/Arabic) or LTR (Hollywood). Resolved here
    // because it drives the font-aware cpi: the RTL Paper truth surface renders
    // Noto Naskh, the LTR surface Courier. screenplayProfile.direction is the
    // canonical source; default 'ltr'.
    const direction = contract
      ? contract.direction
      : ((_profile.direction === 'rtl') ? 'rtl' : 'ltr');
    const cpi = _charsPerInch(font.sizePt, direction);

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
    // Token order for the canonical slug projection (SLUG_TRUTH_DOCTRINE_V1).
    // Owned here alongside the separators so order + punctuation are a single
    // convention source that Rga.SlugResolver consumes; a future non-Hollywood
    // or RTL convention re-sequences here, never in the resolver or the record.
    // V1 default === today's order exactly.
    blocks.sceneHeading.order = ['setting', 'location', 'time'];

    // D.2 — `direction` (resolved above, next to the cpi it drives) is carried
    // through so PrintRenderer can apply the RTL margin mirror (the wider
    // binding side is the right margin for Arabic/Kurdish).

    // S8 — page decorations (numbering + header/footer text) carried on
    // the composed profile so PageSetupPreview and PrintRenderer share
    // ONE source of truth. The Single-resolver truth rule forbids the
    // preview from reading Store.effective directly; everything renders
    // off this returned shape.
    const pageNumbers = contract
      ? { enabled: contract.pageNumbering.enabled, position: contract.pageNumbering.position }
      : _resolvePageNumbers(_settings);
    const header      = _resolveHeader(_settings);
    const footer      = _resolveFooter(_settings);

    const result = {
      linesPerPage:            linesPerPage,
      theoreticalLinesPerPage: theoreticalLinesPerPage,  // pre-reserve; diagnostic + testability
      safetyLines:             SAFETY_LINES,              // applied reserve; explicit not magic
      pageSize:                pageSize,
      orientation:             orientation,
      margins:                 margins,
      font:                    font,
      blocks:                  blocks,
      direction:               direction,
      pageNumbers:             pageNumbers,
      header:                  header,
      footer:                  footer
    };
    // Print Contract V1: when a contract was supplied, carry it on the output so
    // every renderer that consumes this layoutProfile (Print Preview, PDF Export,
    // Page Setup preview, Flow paper view — all via ManuscriptGeometry.resolve)
    // also holds the canonical contract. Omitted entirely when no contract is
    // passed, so the no-contract output stays byte-identical to pre-V1.
    if (contract) result.printContract = contract;
    return result;
  }

  // settings.pageSetup may be { sizeIn: { w, h } } or { paperSize: <name> }
  // where <name> is a key in Rga.Constants.PAPER_SIZES (Letter / A4 / Legal / …).
  // `paperSize` is the canonical field (written by page-setup-dialog.js and doc.js defaults).
  // `size` is accepted as a legacy alias for v2 docs persisted before the rename.
  //
  // S8 — name lookup is case-insensitive. The Settings registry options
  // are lowercase ('letter', 'a4'); Constants.PAPER_SIZES historically
  // uses capitalised keys ('Letter', 'A4', 'Legal'). Both forms resolve
  // to the same entry so the registry-driven path and the legacy modal-
  // driven path agree.
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
      return _pageSizeFromName(sizeName);
    }
    return null;
  }

  // Paper NAME → dims, via Constants.PAPER_SIZES (the single paper-size table).
  // Recovery Step 3: LayoutProfile keeps no Letter/A4/Legal copy of its own. An
  // unrecognised name (or a missing Constants module) yields null, and compose()
  // falls back to HOLLYWOOD_DEFAULTS.pageSize exactly as before. Shared by the
  // settings path (_resolvePageSize) and the Print-Contract path in compose().
  function _pageSizeFromName(sizeName) {
    if (typeof sizeName !== 'string' || !sizeName) return null;
    const table = (Rga.Constants && Rga.Constants.PAPER_SIZES) || null;
    let entry = table && table[sizeName];
    if (!entry && table) {
      // S8 — case-insensitive fallback. Settings registry feeds 'letter' /
      // 'a4' / 'custom'; table keys are 'Letter' / 'A4' / 'Legal'.
      const lower = sizeName.toLowerCase();
      const keys = Object.keys(table);
      for (let i = 0; i < keys.length; i += 1) {
        if (keys[i].toLowerCase() === lower) { entry = table[keys[i]]; break; }
      }
    }
    if (entry && typeof entry.width === 'number' && typeof entry.height === 'number') {
      return { w: entry.width, h: entry.height, unit: 'in' };
    }
    return null;
  }

  // Print Contract V1 — paper resolution that prefers the contract's paper NAME.
  // A stored explicit `sizeIn` (legacy v2 raw dims) still wins, exactly as in the
  // no-contract path. Otherwise the contract paper name resolves via the shared
  // Constants table lookup. Byte-identical to _resolvePageSize(settings) whenever
  // contract.paperSize mirrors settings.pageSetup.paperSize (which it always does,
  // since the contract reads that same home). When no contract is passed this is a
  // pure pass-through to _resolvePageSize(settings).
  function _resolvePageSizeWithContract(settings, contract) {
    if (!contract) return _resolvePageSize(settings);
    const ps = (settings && settings.pageSetup) || {};
    if (ps.sizeIn && typeof ps.sizeIn.w === 'number' && typeof ps.sizeIn.h === 'number') {
      return { w: ps.sizeIn.w, h: ps.sizeIn.h, unit: 'in' };
    }
    return _pageSizeFromName(contract.paperSize);
  }

  // S8 — orientation. Defaults to 'portrait'. The registry option set is
  // ['portrait', 'landscape']; LayoutProfile.compose swaps page width/
  // height when 'landscape' is in effect.
  function _resolveOrientation(settings) {
    if (!settings) return 'portrait';
    const ps = settings.pageSetup;
    if (!ps) return 'portrait';
    return (ps.orientation === 'landscape') ? 'landscape' : 'portrait';
  }

  // S8 — page-number decoration. Carried on the composed profile so
  // both PageSetupPreview and PrintRenderer (when it ships) read from a
  // single source of truth.
  function _resolvePageNumbers(settings) {
    const ps = (settings && settings.pageSetup) || {};
    const enabled  = (ps.pageNumbers !== false);          // default true
    const position = (typeof ps.pageNumberPosition === 'string'
                       && ps.pageNumberPosition.length > 0)
                       ? ps.pageNumberPosition : 'top_right';
    return { enabled: enabled, position: position };
  }

  function _resolveHeader(settings) {
    const ps = (settings && settings.pageSetup) || {};
    return { text: typeof ps.headerText === 'string' ? ps.headerText : '' };
  }

  function _resolveFooter(settings) {
    const ps = (settings && settings.pageSetup) || {};
    return { text: typeof ps.footerText === 'string' ? ps.footerText : '' };
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
