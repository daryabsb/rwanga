// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// RuntimeProfile — single source of truth for editor-level runtime modes.
//
// Phase 8 correction: scattered `opts.legacy` booleans (one each on
// Rga.Doc.deserialize, Rga.Editor.activeSchema, Rga.Editor.mount) made
// it impossible to add new runtime modes cleanly. RuntimeProfile owns
// the active runtime configuration; deserialize / mount / schema
// selection all consume it. Future modes (experimental, AI, debug,
// safe) drop in as new fields without touching any consumer.
//
// API:
//   Rga.RuntimeProfile.current()           → profile (shallow copy)
//   Rga.RuntimeProfile.set(partial)        → void  (merges into current)
//   Rga.RuntimeProfile.isCompatibilityMode() → boolean
//   Rga.RuntimeProfile.reset()             → void  (back to defaults; test helper)
//
// Profile shape (current + reserved future fields):
//   {
//     editorArchitecture: 'v3' | 'v2',     // primary editor pipeline
//     compatibilityMode:  boolean,         // force legacy path regardless of architecture
//     experimentalMode?:  boolean,         // reserved — Phase 10+
//     aiMode?:            boolean,         // reserved — v2 IDE
//     debugMode?:         boolean,         // reserved — diagnostic surfaces
//     safeMode?:          boolean          // reserved — fallback boot
//   }
//
// `isCompatibilityMode()` returns true when EITHER `compatibilityMode`
// is set OR `editorArchitecture` is 'v2'. Either expresses "take the
// legacy pipeline" — keeping both lets the user / a settings page
// distinguish "I've pinned the legacy architecture" from "temporarily
// run a v3 build in compat mode."
//
// In-memory only — no persistence in this phase. A future phase may add
// localStorage hydration without changing the API.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.RuntimeProfile = Rga.RuntimeProfile || {};

  const DEFAULTS = {
    editorArchitecture: 'v3',
    compatibilityMode:  false
  };

  let _current = _clone(DEFAULTS);

  function current() {
    return _clone(_current);
  }

  function set(partial) {
    if (!partial || typeof partial !== 'object') return;
    // Merge: unspecified keys keep their current value. This is what
    // makes future modes (debugMode, aiMode) safe to flip in isolation.
    Object.keys(partial).forEach(function(k) {
      _current[k] = partial[k];
    });
  }

  function isCompatibilityMode() {
    return !!(_current.compatibilityMode === true ||
              _current.editorArchitecture === 'v2');
  }

  function reset() {
    _current = _clone(DEFAULTS);
  }

  function _clone(obj) {
    const out = {};
    Object.keys(obj || {}).forEach(function(k) { out[k] = obj[k]; });
    return out;
  }

  Rga.RuntimeProfile.current              = current;
  Rga.RuntimeProfile.set                  = set;
  Rga.RuntimeProfile.isCompatibilityMode  = isCompatibilityMode;
  Rga.RuntimeProfile.reset                = reset;
  Rga.RuntimeProfile._DEFAULTS            = DEFAULTS;
})();
