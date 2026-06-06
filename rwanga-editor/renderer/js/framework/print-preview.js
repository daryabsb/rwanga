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
//   Rga.PrintPreview.refresh()           → boolean   (Step 8 — re-render if active)
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
        // Print Truth Unification V1 — supply the header/footer token context
        // (title/version) from the Rga document. The RenderModel is built from
        // the PM node (view.state.doc), which carries no metadata, so the real
        // title/version must come from the active doc here.
        Rga.PrintRenderer.render(model, _root, Object.assign({}, _opts, { tokenCtx: _tokenCtx() }));
      }
      // Review Bar v1 — mount/refresh the persistent review chrome over the
      // freshly-rendered sheets. Guarded so the pure-pipeline tests (which
      // load print-preview.js without review-bar.js) remain a no-op. All
      // measurement-based fit/zoom logic lives in Rga.ReviewBar, NOT here.
      if (Rga.ReviewBar && typeof Rga.ReviewBar.show === 'function') Rga.ReviewBar.show();
      // The review surface is read-only; release the (now-hidden) editor's
      // keyboard focus. Otherwise the focused contenteditable swallows caret
      // keys — Home/End especially (it preventDefaults them, and the global
      // dispatcher skips defaultPrevented events) — and surface navigation
      // never reaches Rga.PrintPreview's PageUp/PageDown/Home/End handlers.
      const ae = document.activeElement;
      if (ae && ae.isContentEditable && typeof ae.blur === 'function') ae.blur();
      return true;
    },
    deactivate: function() {
      // Tear the review bar down before the root is removed (resets the
      // presentation zoom + unwires its scroll/resize listeners).
      if (Rga.ReviewBar && typeof Rga.ReviewBar.hide === 'function') Rga.ReviewBar.hide();
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
    // Slice C — register the surface nav keys here too (see _registerNav).
    if (ok) { _registerEsc(); _registerNav(); }
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
    _unregisterNav();
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
    const Geometry = Rga.ManuscriptGeometry;
    const Engine = Rga.PageMap;
    const RM = Rga.RenderModel;
    if (!Normalizer || !Geometry || !Engine || !RM) return null;

    const profile = _resolveLayoutProfile();
    const normalizedBlocks = Normalizer.normalize(view.state.doc);
    const pageMap = Engine.build(normalizedBlocks, profile);
    return RM.build(view.state.doc, pageMap, normalizedBlocks, profile);
  }

  // Recovery Step 5: resolve through the ManuscriptGeometry façade.
  // ManuscriptGeometry.resolve(doc) does the doc → (screenplayProfile,
  // settings) extraction and delegates to LayoutProfile; resolve(null)
  // safely yields the default profile. One named resolver for every
  // geometry consumer.
  function _resolveLayoutProfile() {
    const d = (Rga.TabManager && typeof Rga.TabManager.activeDoc === 'function')
      ? Rga.TabManager.activeDoc()
      : null;
    return Rga.ManuscriptGeometry.resolve(d);
  }

  // Print Truth Unification V1 — header/footer token context from the active
  // Rga document's metadata (title + draft/revision version). Sourced here, not
  // from the RenderModel, because the model is built from the PM node which
  // carries no document metadata.
  function _tokenCtx() {
    const d = (Rga.TabManager && typeof Rga.TabManager.activeDoc === 'function')
      ? Rga.TabManager.activeDoc()
      : null;
    const md = (d && d.metadata) || {};
    return {
      title:   (typeof md.title === 'string') ? md.title : '',
      version: (md.version !== null && md.version !== undefined) ? String(md.version) : ''
    };
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

  // Recovery Step 8 — re-render the preview IF it is currently active.
  // Used by Page Setup Apply so a geometry change reaches an open
  // preview on the same gesture. When the preview is closed this is a
  // no-op (returns false) — no unnecessary render.
  //
  // refresh() does NOT introduce a render path: it delegates to open(),
  // which calls show() → ViewManager.activate(VIEW_ID, view). Because
  // the preview is already the current view, ViewManager re-runs the
  // controller's activate() WITHOUT deactivating — buildModel() runs
  // fresh and PrintRenderer.render() repaints into the SAME _root. The
  // preview surface is preserved; only its sheet contents are rebuilt.
  function refresh() {
    if (!isActive()) return false;
    return open();
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

  // Slice C — Home / End jump to the first / last sheet. The review-navigation
  // audit found prev/next, jump, and a live indicator already present; first/
  // last was the one genuine gap (UX Direction V2: "Home / End to first / last
  // sheet. Keyboard-complete, discoverable."). Keyboard-only — no new button,
  // so the review bar is not redesigned. Uses scrollIntoView only (no measured
  // geometry), so the integration guard stays green; the indicator updates via
  // the review bar's scroll listener, exactly as PageUp/PageDown do.
  function _scrollToEdge(which) {
    if (!_root || !_root.isConnected) return;
    const sheets = _root.querySelectorAll('.rga-page-sheet');
    if (sheets.length === 0) return;
    const target = (which === 'end') ? sheets[sheets.length - 1] : sheets[0];
    if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // D.5 / Slice C — surface navigation keys (PageUp/PageDown/Home/End).
  //
  // These MUST register lazily on show() — not at module load. keyboard-
  // registry.js loads AFTER print-preview.js in index.html, so a load-time
  // Rga.KeyboardRegistry.register() block was a silent no-op (the bug Slice C
  // surfaced: the keys never fired). Registering on show() — the same lifecycle
  // Esc already uses — guarantees the dispatcher exists. Unregistered on hide()
  // so repeated open/close (and Page-Setup refresh) never stack duplicates.
  let _navUnreg = [];

  function _registerNav() {
    _unregisterNav();
    if (!Rga.KeyboardRegistry || typeof Rga.KeyboardRegistry.register !== 'function') return;
    const gate = { when: function() { return isActive(); } };
    _navUnreg.push(Rga.KeyboardRegistry.register('PageDown', gate, function() { _scrollByOneSheet(1); }, 'Rga.PrintPreview (PgDn)'));
    _navUnreg.push(Rga.KeyboardRegistry.register('PageUp', gate, function() { _scrollByOneSheet(-1); }, 'Rga.PrintPreview (PgUp)'));
    _navUnreg.push(Rga.KeyboardRegistry.register('Home', gate, function() { _scrollToEdge('home'); }, 'Rga.PrintPreview (Home → first page)'));
    _navUnreg.push(Rga.KeyboardRegistry.register('End', gate, function() { _scrollToEdge('end'); }, 'Rga.PrintPreview (End → last page)'));
  }

  function _unregisterNav() {
    _navUnreg.forEach(function(fn) { if (typeof fn === 'function') fn(); });
    _navUnreg = [];
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
  Rga.PrintPreview.refresh     = refresh;
  Rga.PrintPreview.setOptions  = setOptions;
  Rga.PrintPreview.getOptions  = getOptions;
  Rga.PrintPreview._BODY_CLASS = BODY_CLASS;
  Rga.PrintPreview._ROOT_ID    = ROOT_ID;
  Rga.PrintPreview._VIEW_ID    = VIEW_ID;
  Rga.PrintPreview._controller = _controller;
})();
