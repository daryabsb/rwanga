// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Migration framework — pure JSON → JSON chain.
//
// Public API:
//   Rga.Migrations.detectVersion(parsed) → string ("1.0" | "1.1" | "2.0" | "3.0" | …)
//   Rga.Migrations.migrate(parsed)       → parsed object at the latest known version
//
// Behavior:
//   - Pure function. No editor / DOM / PM schema access.
//   - Preserves unknown fields at every level.
//   - Marks on text nodes are passed through byte-for-byte by the individual
//     migration steps.
//   - Unknown / future / unrecognized versions pass through unchanged
//     (caller decides whether to refuse or accept).
//   - Capped iteration count prevents infinite loops if a buggy step
//     forgets to bump rga_version.
//
// Load order: this file must load AFTER the individual step files
// (v1-to-v2.js, v2-to-v3.js) so the steps are registered on
// Rga.Migrations._steps before migrate() runs.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Migrations = Rga.Migrations || {};

  const LATEST_VERSION = '3.0';
  const MAX_HOPS = 10;

  function detectVersion(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    const v = parsed.rga_version;
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof v === 'number') return String(v);
    return '1.0'; // legacy fallback: pre-versioning files are treated as v1
  }

  function _isV1(version) { return typeof version === 'string' && version.charAt(0) === '1'; }
  function _isV2(version) { return typeof version === 'string' && version.charAt(0) === '2'; }
  function _isV3(version) { return typeof version === 'string' && version.charAt(0) === '3'; }

  function migrate(parsed) {
    if (!parsed || typeof parsed !== 'object') return parsed;
    const steps = (Rga.Migrations._steps) || {};
    let current = parsed;
    let hops = 0;
    while (hops < MAX_HOPS) {
      const version = detectVersion(current);
      if (_isV3(version)) return current;          // already at or beyond v3
      if (_isV1(version) && steps.v1toV2) { current = steps.v1toV2(current); hops += 1; continue; }
      if (_isV2(version) && steps.v2toV3) { current = steps.v2toV3(current); hops += 1; continue; }
      // Unknown version or missing step — pass through; caller decides.
      return current;
    }
    return current;
  }

  Rga.Migrations.detectVersion = detectVersion;
  Rga.Migrations.migrate = migrate;
  Rga.Migrations.LATEST_VERSION = LATEST_VERSION;
})();
