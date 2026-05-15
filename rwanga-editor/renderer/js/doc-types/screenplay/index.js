// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Screenplay doc-type module — registers with Rga.DocTypes at load time.
// F1: outer-schema additions + placeholder NodeView (fallback).
// F2: innerSchema + inner keymap + slug NodeView + zone-key plugin + SceneFrame NodeView.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.DocTypes || typeof Rga.DocTypes.register !== 'function') {
    console.error('[doc-types/screenplay] doc-type-registry not loaded — script order is wrong');
    return;
  }
  const sp = Rga.DocTypes.screenplay || {};
  if (!sp.outerNodes || !sp.outerNodes.sceneFrame) {
    console.error('[doc-types/screenplay] outer-schema-additions not loaded — script order is wrong');
    return;
  }
  if (typeof sp.sceneFramePlaceholderFactory !== 'function') {
    console.error('[doc-types/screenplay] scene-frame-placeholder not loaded — script order is wrong');
    return;
  }
  // F2 NO-GO (2026-05-15): nested-EditorView-inside-atom architecture caused
  // unrecoverable focus, right-click, and DOM-corruption issues during smoke test.
  // Inner modules (innerSchema, innerKeymap, zone-key plugin, slug NodeView,
  // SceneFrame NodeView) stay on disk and remain unit-tested for the next attempt,
  // which should follow the canonical PM footnote pattern (on-demand inner view)
  // rather than eager mount.
  const config = {
    outerNodes: sp.outerNodes,
    placeholderNodeViewFactory: sp.sceneFramePlaceholderFactory
  };

  Rga.DocTypes.register('screenplay', config);
})();
