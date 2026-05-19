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
// Public API:
//   Rga.PrintPreview.show(view)          → boolean   (true if mounted)
//   Rga.PrintPreview.hide()              → void
//   Rga.PrintPreview.isActive()          → boolean
//   Rga.PrintPreview.buildModel(view)    → RenderModel | null   (testing convenience)
//   Rga.PrintPreview.open()              → boolean   (D.1 — entry-point helper)
//   Rga.PrintPreview.setOptions(opts)    → void      (D.3/D.4 options API)
//   Rga.PrintPreview.getOptions()        → opts      (D.3/D.4 options API)
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.PrintPreview = Rga.PrintPreview || {};

  const VIEW_ID = 'printPreview';
  const ROOT_ID = 'rga-print-preview-root';
  const BODY_CLASS = 'view-print-preview-active';

  let _root = null;
  let _previousViewId = null;

  // D.3/D.4 — options for optional footer/header rendering.
  // Defaults: both off (preserves existing top-right "N." header only).
  let _opts = { footerStyle: 'none', headerStyle: 'none' };

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
        // D.3/D.4 — pass current options to the renderer so optional
        // footer/header slots are populated when the user has opted in.
        Rga.PrintRenderer.render(model, _root, _opts);
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
    const ok = Rga.ViewManager.activate(VIEW_ID, view);
    // D.5 — Register Esc-to-exit on show() so this handler is always
    // last-registered (KR is last-wins) and wins when the preview is open.
    if (ok) _registerEsc();
    return ok;
  }

  function hide() {
    if (!Rga.ViewManager) return;
    if (Rga.ViewManager.current() !== VIEW_ID) return;
    // D.5 — Unregister the Esc handler before deactivating. The prior
    // consumer (e.g. ViewMode Esc for Draft) was replaced by our
    // registration; after unregistering, ViewMode will re-register its
    // own Esc handler the next time ViewMode.init() runs (or it stays
    // absent if init was never called). In practice, the Draft Esc
    // re-registers itself next time it's needed via ViewMode.init().
    _unregEsc();
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

  // ----------------------------------------------------------------
  // D.1 — open() — canonical entry point for all UI surfaces.
  //   Resolves the active editor view via TabManager._editorView()
  //   and calls show(view). Returns false if no view is available.
  //   No try/catch — errors surface to the caller.
  // ----------------------------------------------------------------
  function open() {
    if (!Rga.TabManager || typeof Rga.TabManager._editorView !== 'function') return false;
    const view = Rga.TabManager._editorView();
    if (!view) return false;
    return show(view);
  }

  // ----------------------------------------------------------------
  // D.3/D.4 — options API for optional footer + running header.
  //   Default: { footerStyle: 'none', headerStyle: 'none' }.
  //   footerStyle: 'bottom-center' | 'none'
  //   headerStyle: 'running' | 'none'
  // ----------------------------------------------------------------
  function setOptions(opts) {
    if (!opts || typeof opts !== 'object') return;
    _opts = Object.assign({}, _opts, opts);
  }

  function getOptions() {
    return Object.assign({}, _opts);
  }

  // ----------------------------------------------------------------
  // D.5 — PageUp/PageDown scroll helper.
  //   Scrolls to the previous/next sheet in the stack. Uses
  //   scrollIntoView so the target sheet snaps to the top of the
  //   scroll viewport regardless of exact sheet height.
  //   direction: +1 → forward (PageDown), -1 → backward (PageUp).
  // ----------------------------------------------------------------
  function _scrollByOneSheet(direction) {
    if (!_root || !_root.isConnected) return;
    const sheets = _root.querySelectorAll('.rga-page-sheet');
    if (sheets.length === 0) return;

    // Determine which sheet is currently closest to the top of the
    // viewport. Walk the sheets and find the one whose top attribute
    // (dataset.pageNumber, 1-based) corresponds to the currently
    // visible page. We use scrollTop to find the current position
    // without calling getBoundingClientRect (banned per Phase 7 rule).
    const currentScrollTop = _root.scrollTop;
    let currentIdx = 0;
    // Find the sheet currently at or above the scroll position.
    // Since we can't use getBoundingClientRect, we use offsetTop
    // (a layout-engine property, but valid for scroll math here —
    // it does not trigger forced reflow when used after the browser
    // has already laid out the element).
    for (let i = 0; i < sheets.length; i += 1) {
      if (sheets[i].offsetTop <= currentScrollTop + 1) {
        currentIdx = i;
      } else {
        break;
      }
    }
    const targetIdx = Math.max(0, Math.min(sheets.length - 1, currentIdx + direction));
    if (sheets[targetIdx]) {
      sheets[targetIdx].scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  // D.5 — Register PageDown / PageUp via KeyboardRegistry, gated on
  // isActive(). Both are registered at module load time; their `when`
  // predicates gate them so they only fire while Print Preview is active.
  if (Rga.KeyboardRegistry && typeof Rga.KeyboardRegistry.register === 'function') {
    Rga.KeyboardRegistry.register(
      'PageDown',
      { when: function() { return isActive(); } },
      function() { _scrollByOneSheet(1); },
      'Rga.PrintPreview (PgDn)'
    );
    Rga.KeyboardRegistry.register(
      'PageUp',
      { when: function() { return isActive(); } },
      function() { _scrollByOneSheet(-1); },
      'Rga.PrintPreview (PgUp)'
    );
  }

  // D.5 — Esc exits Print Preview. Registered on show() / unregistered
  // on hide() so it never conflicts with the Rga.ViewMode Esc handler
  // (which registers during ViewMode.init(), after module load, and
  // would otherwise overwrite a module-load-time registration here).
  // By registering on show(), this handler is always LAST and has the
  // highest combo priority while the preview is open.
  let _unregisterEsc = null;

  function _registerEsc() {
    if (!Rga.KeyboardRegistry || typeof Rga.KeyboardRegistry.register !== 'function') return;
    _unregisterEsc = Rga.KeyboardRegistry.register(
      'escape',
      { when: function() { return isActive(); } },
      function() { hide(); },
      'Rga.PrintPreview (Esc exits preview)'
    );
  }

  function _unregEsc() {
    if (typeof _unregisterEsc === 'function') {
      _unregisterEsc();
      _unregisterEsc = null;
    }
  }

  Rga.PrintPreview.show        = show;
  Rga.PrintPreview.hide        = hide;
  Rga.PrintPreview.isActive    = isActive;
  Rga.PrintPreview.buildModel  = buildModel;
  Rga.PrintPreview.open        = open;
  Rga.PrintPreview.setOptions  = setOptions;
  Rga.PrintPreview.getOptions  = getOptions;
  Rga.PrintPreview._BODY_CLASS = BODY_CLASS;
  Rga.PrintPreview._ROOT_ID    = ROOT_ID;
  Rga.PrintPreview._VIEW_ID    = VIEW_ID;
  Rga.PrintPreview._controller = _controller;
})();
