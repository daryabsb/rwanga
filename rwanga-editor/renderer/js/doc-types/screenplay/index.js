// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Screenplay doc-type module — registers with Rga.DocTypes at load time.
// Phase 9: v3 only. selectSchema returns the v3 schema for every
// screenplay file; the migration chain (v1.x / v2.x → v3) runs upstream
// in Rga.Migrations.migrate so any vintage file lands here as v3 JSON.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.DocTypes || typeof Rga.DocTypes.register !== 'function') {
    console.error('[doc-types/screenplay] doc-type-registry not loaded — script order is wrong');
    return;
  }
  const sp = Rga.DocTypes.screenplay || {};
  if (typeof sp.buildSchemaV3 !== 'function') {
    console.error('[doc-types/screenplay] schema-v3 not loaded — script order is wrong');
    return;
  }

  // selectSchema is doc-type-config's single entry point for schema
  // selection. The parsed JSON is ignored here — screenplay has exactly
  // one schema in v3.
  function selectSchema(/* parsed */) {
    return sp.buildSchemaV3();
  }

  Rga.DocTypes.register('screenplay', {
    selectSchema: selectSchema
  });
})();
