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
  // F2 dependencies (optional in registration — fall back to placeholder if any are missing)
  const hasF2 =
    sp.innerSchema &&
    typeof sp.emptyInnerDoc === 'function' &&
    typeof sp.buildInnerKeymap === 'function' &&
    typeof sp.buildZoneKeyPlugin === 'function' &&
    typeof sp.sceneLineNodeViewFactory === 'function' &&
    typeof sp.sceneFrameNodeViewFactory === 'function';

  const config = {
    outerNodes: sp.outerNodes,
    placeholderNodeViewFactory: sp.sceneFramePlaceholderFactory
  };
  if (hasF2) {
    config.sceneFrameNodeViewFactory = sp.sceneFrameNodeViewFactory;
  } else {
    console.warn('[doc-types/screenplay] F2 modules not all present — using F1 placeholder');
  }

  Rga.DocTypes.register('screenplay', config);
})();
