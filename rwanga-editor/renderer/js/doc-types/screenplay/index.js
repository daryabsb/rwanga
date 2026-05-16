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
  // F2 NO-GO (2026-05-15): the original eager nested-EditorView-inside-atom
  // architecture caused unrecoverable focus, right-click, and DOM-corruption
  // issues during smoke test. Those inner modules remain on disk and unit-
  // tested as reference. The current replacement-in-progress is the v2 nested-
  // PM approach in scene-frame-pm.js, built one step at a time per the
  // roadmap at the top of that file.
  //
  // Routing: PM's nodeViews registration is fixed at EditorView mount time
  // (mount.js calls placeholderNodeViewFactory ONCE), but the function we
  // hand back is invoked per sceneFrame node — so we route inside it by
  // checking the active doc's metadata.useV2SceneFrame flag each time PM
  // builds a NodeView. Tab swaps trigger setState → fresh NodeView
  // construction, so per-tab routing falls out naturally.
  const placeholderCtor = sp.sceneFramePlaceholderFactory();
  function routeSceneFrameNodeView(node, view, getPos) {
    const activeDoc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
    const useV2 = !!(activeDoc && activeDoc.metadata && activeDoc.metadata.useV2SceneFrame);
    if (useV2 && typeof sp.sceneFramePmFactory === 'function') {
      return sp.sceneFramePmFactory()(node, view, getPos);
    }
    return placeholderCtor(node, view, getPos);
  }
  function routedFactory() { return routeSceneFrameNodeView; }

  const config = {
    outerNodes: sp.outerNodes,
    placeholderNodeViewFactory: routedFactory
  };

  Rga.DocTypes.register('screenplay', config);
})();
