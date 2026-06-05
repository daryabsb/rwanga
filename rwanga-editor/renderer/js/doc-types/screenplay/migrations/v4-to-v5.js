// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// v4.0 → v5.0 migration — pure JSON → JSON.
//
// Print Contract V1. Doctrine:
//   docs/Filmustageation/PRINT_CONTRACT_V1.md §5
//
// Makes the Print Contract EXPLICIT on documents authored before V1, so every
// reopened doc carries an explicit, versioned print contract (no reliance on
// resolver fallback). Doc-level transforms:
//   - rga_version → "5.0"
//   - metadata.printContractVersion → 1 (if not already a number)
//   - metadata.screenplayProfile → seeded if absent, direction derived from
//     metadata.language (ku/ar → rtl, else ltr) — same rule as v2→v3
//   - settings.pageSetup → ensure orientation / pageNumbers / pageNumberPosition
//   - settings.show_scene_numbers → ensure present (default true)
//
// Rules: pure function, no PM schema / editor / DOM access, preserves unknown
// fields (incl. body, margins, paperSize, aliases, merge_log), idempotent — an
// author-set contract value is never overwritten.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Migrations = Rga.Migrations || {};
  Rga.Migrations._steps = Rga.Migrations._steps || {};

  // Same RTL derivation as the v2→v3 step: Kurdish/Arabic read right-to-left.
  function _directionFor(language) {
    return (language === 'ku' || language === 'ar') ? 'rtl' : 'ltr';
  }

  function migrateV4toV5(parsed) {
    if (!parsed || typeof parsed !== 'object') return parsed;
    const out = Object.assign({}, parsed);
    out.rga_version = '5.0';

    // --- metadata: contract version + screenplayProfile (direction) ---
    const metadata = Object.assign({}, parsed.metadata || {});
    if (typeof metadata.printContractVersion !== 'number') {
      metadata.printContractVersion = 1;
    }
    if (!metadata.screenplayProfile || typeof metadata.screenplayProfile !== 'object') {
      metadata.screenplayProfile = {
        language: typeof metadata.language === 'string' ? metadata.language : 'en',
        direction: _directionFor(metadata.language),
        screenplayConvention: 'hollywood'
      };
    }
    out.metadata = metadata;

    // --- settings: pageSetup numbering/orientation + scene numbering ---
    const settings = Object.assign({}, parsed.settings || {});
    if (typeof settings.show_scene_numbers !== 'boolean') {
      settings.show_scene_numbers = true;
    }
    const pageSetup = Object.assign({}, settings.pageSetup || {});
    if (typeof pageSetup.orientation !== 'string')        pageSetup.orientation = 'portrait';
    if (typeof pageSetup.pageNumbers !== 'boolean')       pageSetup.pageNumbers = true;
    if (typeof pageSetup.pageNumberPosition !== 'string') pageSetup.pageNumberPosition = 'top_right';
    settings.pageSetup = pageSetup;
    out.settings = settings;

    return out;
  }

  Rga.Migrations._steps.v4toV5 = migrateV4toV5;
})();
