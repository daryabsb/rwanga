// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// v3.0 → v4.0 migration — pure JSON → JSON.
//
// Semantic Entity Layer S0. Doctrine:
//   docs/Filmustageation/SEMANTIC_ENTITY_LAYER_DOCTRINE_LOCK.md
// Brief:
//   docs/Filmustageation/SEMANTIC_ENTITY_LAYER_S0_IMPLEMENTATION_BRIEF.md §6
//
// Doc-level transforms:
//   - rga_version → "4.0"
//   - every entity in every tag_registry list gains `aliases: []` if it lacks
//     one (tombstones included — harmless and uniform)
//   - everything else preserved (body, settings, merge_log, unknown fields)
//
// Rules: pure function, no PM schema / editor / DOM access, preserves unknown
// fields, idempotent (existing `aliases` arrays are left untouched).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Migrations = Rga.Migrations || {};
  Rga.Migrations._steps = Rga.Migrations._steps || {};

  // Add aliases:[] to a registry entity, idempotently. Non-object entries
  // (defensive — registry lists should only hold entity objects) pass through.
  function _defaultAliases(entity) {
    if (!entity || typeof entity !== 'object') return entity;
    if (Array.isArray(entity.aliases)) return entity;
    return Object.assign({}, entity, { aliases: [] });
  }

  function migrateV3toV4(parsed) {
    if (!parsed || typeof parsed !== 'object') return parsed;
    const out = Object.assign({}, parsed);
    out.rga_version = '4.0';
    if (parsed.tag_registry && typeof parsed.tag_registry === 'object') {
      const reg = Object.assign({}, parsed.tag_registry);
      Object.keys(reg).forEach(function(key) {
        if (Array.isArray(reg[key])) {
          reg[key] = reg[key].map(_defaultAliases);
        }
      });
      out.tag_registry = reg;
    }
    return out;
  }

  Rga.Migrations._steps.v3toV4 = migrateV3toV4;
  // Internal helper exposed for unit tests.
  Rga.Migrations._steps._v3toV4_defaultAliases = _defaultAliases;
})();
