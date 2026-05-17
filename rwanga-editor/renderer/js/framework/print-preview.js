// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PrintPreview controller — view-mode shim for Phase 7.
//
// Wires together the pure pipeline (Normalizer → LayoutProfile → PageMap →
// RenderModel → PrintRenderer) and mounts the result into a fresh DOM root
// outside the editor surface. Editor itself stays in Flow mode underneath
// (just hidden via body.view-print-preview-active CSS); we do NOT touch
// the editor view or its DOM.
//
// Read-only: there is no editing inside the print preview. Flow + Draft
// modes remain editable / unmodified (Rules 9, 10, 11).
//
// Phase 7 correction: lifecycle is owned by Rga.ViewManager. PrintPreview
// registers itself as one of several registered views; ViewManager applies
// the body class on activate/deactivate. The public show/hide/isActive
// /buildModel API on PrintPreview is unchanged — it now delegates to the
// manager. Calling show() while a non-preview view is active preserves
// the previous id; hide() restores it (so closing the preview returns
// the user to Flow or Draft seamlessly).
//
// Public API (unchanged):
//   Rga.PrintPreview.show(view)      → boolean   (true if mounted)
//   Rga.PrintPreview.hide()          → void
//   Rga.PrintPreview.isActive()      → boolean
//   Rga.PrintPreview.buildModel(view)→ RenderModel | null   (testing convenience)
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.PrintPreview = Rga.PrintPreview || {};

  const VIEW_ID = 'printPreview';
  const ROOT_ID = 'rga-print-preview-root';
  const BODY_CLASS = 'view-print-preview-active';

  let _root = null;
  let _previousViewId = null;

  // ----------------------------------------------------------------
  // Controller — registered with ViewManager. ViewManager handles
  // body-class side effect; controller only does the rendering work.
  // ----------------------------------------------------------------
  const _controller = {
    bodyClass: BODY_CLASS,
    activate: function(view) {
      if (!view || !view.state) return false;
      const model = buildModel(view);
      if (!model) return false;
      _ensureRoot();
      if (Rga.PrintRenderer && typeof Rga.PrintRenderer.render === 'function') {
        Rga.PrintRenderer.render(model, _root);
      }
      return true;
    },
    deactivate: function() {
      if (_root && _root.parentNode) _root.parentNode.removeChild(_root);
      _root = null;
    }
  };

  // Register at load time so any caller can `activate('printPreview', view)`.
  if (Rga.ViewManager && typeof Rga.ViewManager.register === 'function') {
    Rga.ViewManager.register(VIEW_ID, _controller);
  }

  function show(view) {
    if (!Rga.ViewManager) return false;
    // Remember the prior view so hide() can restore it (Flow/Draft typically).
    const cur = Rga.ViewManager.current();
    if (cur && cur !== VIEW_ID) _previousViewId = cur;
    return Rga.ViewManager.activate(VIEW_ID, view);
  }

  function hide() {
    if (!Rga.ViewManager) return;
    if (Rga.ViewManager.current() !== VIEW_ID) return;
    Rga.ViewManager.deactivate();
    // Restore the prior view if any (so Flow/Draft snap back).
    if (_previousViewId && Rga.ViewManager.registered().indexOf(_previousViewId) !== -1) {
      Rga.ViewManager.activate(_previousViewId);
    }
    _previousViewId = null;
  }

  function isActive() {
    return !!(Rga.ViewManager && Rga.ViewManager.isActive(VIEW_ID));
  }

  // ----------------------------------------------------------------
  // buildModel — pure: PM view → RenderModel. Safe to call from tests.
  // ----------------------------------------------------------------
  function buildModel(view) {
    if (!view || !view.state || !view.state.doc) return null;
    const Normalizer = Rga.Normalizer;
    const LayoutProfile = Rga.LayoutProfile;
    const Engine = Rga.PageMap;
    const RM = Rga.RenderModel;
    if (!Normalizer || !LayoutProfile || !Engine || !RM) return null;

    const profile = _resolveLayoutProfile();
    const normalizedBlocks = Normalizer.normalize(view.state.doc);
    const pageMap = Engine.build(normalizedBlocks, profile);
    return RM.build(view.state.doc, pageMap, normalizedBlocks, profile);
  }

  function _resolveLayoutProfile() {
    let screenplayProfile = null;
    let settings = null;
    if (Rga.TabManager && typeof Rga.TabManager.activeDoc === 'function') {
      const d = Rga.TabManager.activeDoc();
      if (d) {
        if (d.metadata && d.metadata.screenplayProfile) screenplayProfile = d.metadata.screenplayProfile;
        if (d.settings) settings = d.settings;
      }
    }
    return Rga.LayoutProfile.compose(screenplayProfile, settings);
  }

  function _ensureRoot() {
    if (_root && _root.isConnected) return;
    let existing = document.getElementById(ROOT_ID);
    if (existing) { _root = existing; return; }
    _root = document.createElement('div');
    _root.id = ROOT_ID;
    document.body.appendChild(_root);
  }

  Rga.PrintPreview.show       = show;
  Rga.PrintPreview.hide       = hide;
  Rga.PrintPreview.isActive   = isActive;
  Rga.PrintPreview.buildModel = buildModel;
  Rga.PrintPreview._BODY_CLASS = BODY_CLASS;
  Rga.PrintPreview._ROOT_ID    = ROOT_ID;
  Rga.PrintPreview._VIEW_ID    = VIEW_ID;
  Rga.PrintPreview._controller = _controller;
})();
