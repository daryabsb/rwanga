// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// View modes — Flow (default), Print, Draft.
// State lives in localStorage as a per-app global preference. Esc inside
// Draft restores the previous view.
//
// Phase 7 correction: the actual view switch (body classes, container
// classes) is owned by Rga.ViewManager. ViewMode keeps the user-facing UX
// (persistence, cycle, Esc-exits-Draft, listeners) and registers one
// controller per mode with the manager. Each controller is responsible
// only for its own DOM side effects (the editor-container class arithmetic
// that used to live in _apply()).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const KEY = 'rga-view-mode';
  const MODES = ['flow', 'print', 'draft'];
  const DEFAULT = 'flow';

  let current = DEFAULT;
  let previous = DEFAULT;
  const listeners = [];

  function _load() {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored && MODES.indexOf(stored) !== -1) {
        current = stored;
        previous = stored === 'draft' ? 'flow' : stored;
      }
    } catch (_) {}
  }

  function _persist() {
    try { localStorage.setItem(KEY, current); } catch (_) {}
  }

  // Per-mode controllers — each handles its OWN editor-container class
  // arithmetic. ViewManager applies the body class (if any) and runs
  // activate/deactivate in mutual exclusion.
  function _applyContainerClass(mode) {
    const target = document.getElementById('editor-container');
    if (!target) return;
    MODES.forEach(function(m) {
      target.classList.toggle('view-' + m, m === mode);
    });
  }
  function _clearContainerClasses() {
    const target = document.getElementById('editor-container');
    if (!target) return;
    MODES.forEach(function(m) { target.classList.remove('view-' + m); });
  }

  // ----------------------------------------------------------------
  // Fork A — Paper view. Print mode renders the read-only Paper truth
  // surface (Rga.PaperView) into a dedicated container and hides the
  // live #editor; Flow and Draft clear it and restore #editor.
  //
  // Rule 9: the hidden #editor is state-preservation only. view-mode
  // toggles its visibility and re-focuses it on return — it never
  // destroys the EditorView and never reads its DOM geometry.
  // ----------------------------------------------------------------
  const PAPER_ROOT_ID = 'rga-paper-view-root';

  function _activeEditorView() {
    return (Rga.TabManager && typeof Rga.TabManager._editorView === 'function')
      ? Rga.TabManager._editorView()
      : null;
  }

  // Create the Paper render container exactly once; reuse it thereafter.
  function _ensurePaperContainer() {
    let root = document.getElementById(PAPER_ROOT_ID);
    if (root) return root;
    const editor = document.getElementById('editor');
    const host = document.getElementById('editor-container') || (editor && editor.parentNode);
    if (!host) return null;
    root = document.createElement('div');
    root.id = PAPER_ROOT_ID;
    root.style.display = 'none';
    host.appendChild(root);
    return root;
  }

  function _enterPaperView() {
    const root = _ensurePaperContainer();
    if (!root) return;
    const editor = document.getElementById('editor');
    if (editor) editor.style.display = 'none';
    root.style.display = '';
    if (Rga.PaperView && typeof Rga.PaperView.render === 'function') {
      Rga.PaperView.render(_activeEditorView(), root);
    }
  }

  function _exitPaperView() {
    const root = document.getElementById(PAPER_ROOT_ID);
    if (root) {
      if (Rga.PaperView && typeof Rga.PaperView.clear === 'function') {
        Rga.PaperView.clear(root);
      }
      root.style.display = 'none';
    }
    const editor = document.getElementById('editor');
    if (editor) editor.style.display = '';
    // Re-focus so the preserved Flow selection becomes a visible caret.
    const view = _activeEditorView();
    if (view && typeof view.focus === 'function') view.focus();
  }

  const _flowController = {
    bodyClass: null,                              // flow = default; no body class
    activate: function() { _applyContainerClass('flow'); _exitPaperView(); },
    deactivate: function() { /* next activate overwrites the class */ }
  };
  const _printController = {
    bodyClass: 'view-print-active',
    activate: function() { _applyContainerClass('print'); _enterPaperView(); },
    deactivate: function() { _exitPaperView(); }
  };
  const _draftController = {
    bodyClass: 'view-draft-active',
    activate: function() { _applyContainerClass('draft'); _exitPaperView(); },
    deactivate: function() {}
  };

  function _registerWithViewManager() {
    if (!Rga.ViewManager || typeof Rga.ViewManager.register !== 'function') return;
    Rga.ViewManager.register('flow',  _flowController);
    Rga.ViewManager.register('print', _printController);
    Rga.ViewManager.register('draft', _draftController);
  }

  function _activate(mode) {
    // Runtime Ownership Stab. Slice 6 §A: Rga.ViewManager is the sole
    // owner of view-* body classes. The fallback that used to live
    // here (direct body.classList toggle for test contexts without
    // ViewManager) was removed in Slice 6 to enforce the G3 drift
    // guard's "no shell-js writer for view-{draft,print,print-preview}-
    // active" invariant. Any test harness that exercises view-mode
    // must load renderer/js/framework/view-manager.js before
    // view-mode.js — see the Slice 1 / Slice 5 test setup patterns.
    if (Rga.ViewManager && typeof Rga.ViewManager.activate === 'function') {
      Rga.ViewManager.activate(mode);
    }
    // No fallback. If ViewManager is absent, the activate is a no-op;
    // the call returns silently and the body class isn't applied.
  }

  function _notify() {
    listeners.forEach(function(fn) { try { fn(current); } catch (_) {} });
  }

  function get() { return current; }

  function set(mode) {
    if (MODES.indexOf(mode) === -1) return;
    if (mode === current) return;
    if (current !== 'draft') previous = current;
    current = mode;
    _persist();
    _activate(mode);
    _notify();
  }

  function cycle() {
    const idx = MODES.indexOf(current);
    set(MODES[(idx + 1) % MODES.length]);
  }

  function exitDraft() {
    if (current !== 'draft') return;
    set(previous || DEFAULT);
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return;
    listeners.push(fn);
  }

  // V1.1 fix 3 (Draft mode trap): when other surfaces (status-bar,
  // command palette, future menu items) call Rga.ViewManager.activate
  // directly, they bypass Rga.ViewMode.set and the local `current`
  // diverges from the true active mode. This made the Esc handler
  // misfire (it gated on `current === 'draft'` while ViewManager said
  // draft). Subscribing to ViewManager keeps `current` and `previous`
  // in sync regardless of who flipped the mode.
  function _syncFromViewManager() {
    if (!Rga.ViewManager || typeof Rga.ViewManager.onChange !== 'function') return function() {};
    return Rga.ViewManager.onChange(function(mode) {
      if (!mode || MODES.indexOf(mode) === -1) return;
      if (mode === current) return;
      if (current !== 'draft') previous = current;
      current = mode;
      _persist();
      _notify();
    });
  }

  function init() {
    _load();
    _registerWithViewManager();
    _activate(current);
    _notify();
    _syncFromViewManager();

    // Esc exits Draft — registered via Rga.KeyboardRegistry (the
    // single keyboard SSOT, Runtime Ownership Stab. Slice 2 §A).
    // The `when` predicate gates dispatch on current === 'draft' so
    // Escape stays available to other consumers (context menus,
    // palette, etc.) outside Draft mode.
    //
    // The Slice-2 fallback `document.addEventListener('keydown', ...)`
    // was removed in Slice 3 §B (drift guard G1: no document.keydown
    // listeners outside the registry). Any test harness that exercises
    // Esc-exits-Draft must load renderer/js/shell/keyboard-registry.js
    // before view-mode.js.
    if (Rga.KeyboardRegistry && typeof Rga.KeyboardRegistry.register === 'function') {
      Rga.KeyboardRegistry.register(
        'escape',
        { when: function() { return current === 'draft'; } },
        function() { exitDraft(); },
        'Rga.ViewMode (Esc exits Draft)'
      );
    }
  }

  Rga.ViewMode = {
    init: init, get: get, set: set, cycle: cycle,
    exitDraft: exitDraft, onChange: onChange, MODES: MODES,
    // Test/diagnostic exposure of the controllers we register.
    _flowController:  _flowController,
    _printController: _printController,
    _draftController: _draftController
  };
})();
