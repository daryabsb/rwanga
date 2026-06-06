// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Print Contract V1 — the single, named, versioned owner of document print truth.
//
// Doctrine: docs/Filmustageation/PRINT_CONTRACT_V1.md
//
// A screenplay is a print-oriented production document; its print truth must
// travel WITH the document. The `.rga` owns that truth. This module is the one
// place that NAMES the owned set, resolves it with the App-Default cascade, and
// stamps a contract version — the stable API every renderer (Print Preview, PDF
// Export, the future Django Platform, future production tooling) consumes.
//
// IMPORTANT — projection, not parallel storage. The contract VALUES live in the
// document's existing owned homes (settings.pageSetup.* — owned by the Settings
// Store; metadata.screenplayProfile.direction; settings.show_scene_numbers). This
// resolver projects them into one named, versioned shape; it does NOT keep a
// second copy (which would split-brain against the Settings Store, the SSOT for
// pageSetup). The only contract-specific stored field is
// metadata.printContractVersion.
//
// Resolution precedence per field: document owned home → DEFAULTS (App Defaults).
// Reads are defensive: null doc / missing screenplayProfile / missing pageSetup
// all resolve to DEFAULTS without throwing.
//
// Public API:
//   Rga.PrintContract.resolve(doc)  → frozen { version, paperSize, orientation,
//                                       direction, pageNumbering:{enabled,position},
//                                       sceneNumbering:{enabled},
//                                       header:{text}, footer:{text},
//                                       marks:{tags,notes,flags,highlights} }
//   Rga.PrintContract.DEFAULTS      → frozen App-Default contract values
//   Rga.PrintContract.CONTRACT_VERSION → number (the V1 schema version)
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.PrintContract = Rga.PrintContract || {};

  // App Defaults tier — the root of the ownership chain. Kept in sync, by intent,
  // with the geometry layer's enum defaults (LayoutProfile _resolveOrientation /
  // _resolvePageNumbers and the direction fallback) so that a contract resolved
  // for a document mirrors the values the renderer would read from the same homes.
  const DEFAULTS = Object.freeze({
    paperSize:   'Letter',
    orientation: 'portrait',
    direction:   'ltr',
    pageNumbering:  Object.freeze({ enabled: true, position: 'top_right' }),
    sceneNumbering: Object.freeze({ enabled: true }),
    // Print Truth Unification V1 — additive projections (no CONTRACT_VERSION
    // bump: every consumer that predates these fields ignores them, and the
    // resolver defaults them, so V1 readers are unaffected).
    //   header/footer — the document's owned page-banner text (token-bearing;
    //     tokens are resolved at render time by Rga.PrintTokens, not here).
    //   marks — print/export visibility of working-state marks. Defaults honor
    //     the committed Print Truth Doctrine (Decision 2): highlights survive
    //     into the deliverable; tags / notes / flags do NOT, unless turned on.
    header: Object.freeze({ text: '' }),
    footer: Object.freeze({ text: '' }),
    marks:  Object.freeze({ tags: false, notes: false, flags: false, highlights: true })
  });

  // The contract SCHEMA version (V1 = 1). Distinct from rga_version (the file
  // format). Sourced from Constants so seeding (doc.js) and this resolver agree
  // without a load-order dependency between the two modules.
  const CONTRACT_VERSION = (Rga.Constants && typeof Rga.Constants.PRINT_CONTRACT_VERSION === 'number')
    ? Rga.Constants.PRINT_CONTRACT_VERSION
    : 1;

  function _str(v) { return (typeof v === 'string' && v.length > 0) ? v : null; }

  function resolve(doc) {
    const metadata = (doc && doc.metadata) || {};
    const settings = (doc && doc.settings) || {};
    const ps       = settings.pageSetup || {};
    const profile  = metadata.screenplayProfile || {};

    const version = (typeof metadata.printContractVersion === 'number')
      ? metadata.printContractVersion
      : CONTRACT_VERSION;

    // paperSize is a NAME (Letter/A4/Legal). `size` is the legacy v2 alias the
    // geometry layer also accepts; honor it so the contract agrees with compose.
    const paperSize = _str(ps.paperSize) || _str(ps.size) || DEFAULTS.paperSize;

    // Mirror LayoutProfile's owned-enum normalization exactly.
    const orientation = (ps.orientation === 'landscape') ? 'landscape' : 'portrait';
    const direction   = (profile.direction === 'rtl') ? 'rtl' : 'ltr';

    const pageNumbering = Object.freeze({
      enabled:  (ps.pageNumbers !== false),                       // default true
      position: _str(ps.pageNumberPosition) || DEFAULTS.pageNumbering.position
    });

    // Scene-numbering home unification. The Settings UI toggle persists to the
    // nested `settings.screenplay.sceneNumbering` (Store dotted-id routing);
    // older docs carry the flat `settings.show_scene_numbers`. Prefer the UI's
    // home, fall back to the legacy flat field, then default true — so the one
    // visible toggle actually drives print truth (no split-brain).
    const sp = settings.screenplay || {};
    const sceneOn = (typeof sp.sceneNumbering === 'boolean')
      ? sp.sceneNumbering
      : (settings.show_scene_numbers !== false);
    const sceneNumbering = Object.freeze({ enabled: sceneOn });

    // Header / footer banner text — owned page truth, defaulted to ''.
    const header = Object.freeze({
      text: (typeof ps.headerText === 'string') ? ps.headerText : DEFAULTS.header.text
    });
    const footer = Object.freeze({
      text: (typeof ps.footerText === 'string') ? ps.footerText : DEFAULTS.footer.text
    });

    // Mark visibility in the deliverable. tags/notes/flags must be explicitly
    // true to appear; highlights survive unless explicitly turned off.
    const marks = Object.freeze({
      tags:       (ps.showTags === true),
      notes:      (ps.showNotes === true),
      flags:      (ps.showFlags === true),
      highlights: (ps.showHighlights !== false)
    });

    return Object.freeze({
      version:        version,
      paperSize:      paperSize,
      orientation:    orientation,
      direction:      direction,
      pageNumbering:  pageNumbering,
      sceneNumbering: sceneNumbering,
      header:         header,
      footer:         footer,
      marks:          marks
    });
  }

  Rga.PrintContract.resolve          = resolve;
  Rga.PrintContract.DEFAULTS         = DEFAULTS;
  Rga.PrintContract.CONTRACT_VERSION = CONTRACT_VERSION;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Rga.PrintContract;
  }
})();
