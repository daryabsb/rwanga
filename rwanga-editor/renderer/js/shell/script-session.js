// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.ScriptSession — writer-context-truth ownership layer.
//
// One of the three ownership layers (slice-1 plan §2.5):
//   * Document truth → PM EditorState (engine)
//   * Shell truth    → Rga.Shell.Layout
//   * Writer-context → Rga.ScriptSession   ← THIS
//
// Aggregates writer-perspective context — activeScript / currentScene /
// currentPage / currentView / currentSelection / openPanels / activePanel.
// Purely DERIVED; never owns primary state. Single recompute → many
// consumers (Scene Navigator, Status Bar, Title Bar + future continuity /
// focus mode / AI context / session restore).
//
// API (slice-1 plan §3.5):
//   Rga.ScriptSession.get()           → snapshot (shallow copy)
//   Rga.ScriptSession.subscribe(fn)   → unsubscribe()
//   Rga.ScriptSession.init()          → wires upstream listeners; idempotent
//   Rga.ScriptSession._reset()        → test helper
//
// Boundary discipline: zero view.dispatch calls; reads view.state only.
// No setters. Consumers that need to *change* writer context call the
// original owner's API (e.g. Rga.ViewManager.activate(...)).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.ScriptSession = Rga.ScriptSession || {};

  // Slice 7 §A: snapshot shape is now LOCKED to the 7 writer-context
  // fields declared by Rga.SessionBoundary.ScriptSession.fields.
  // Adding any field to this snapshot fails the G8 drift guard with
  // a message naming the correct owner (typically ScriptMetrics for
  // analytics fields). The pre-Slice-7 wordCount + currentBlockType
  // fields were removed; derivation lives in Rga.ScriptMetrics now.
  // (Closes Compatibility Inventory entry #6.)
  const EMPTY_SNAPSHOT = {
    activeScript:     null,
    currentScene:     null,
    currentPage:      null,
    currentView:      null,
    currentSelection: null,
    openPanels:       [],
    activePanel:      null
  };

  let _snapshot = _clone(EMPTY_SNAPSHOT);
  const _subscribers = new Set();
  const _disposers = [];
  let _initialized = false;

  function get() {
    return _clone(_snapshot);
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function() {};
    _subscribers.add(fn);
    return function unsubscribe() { _subscribers.delete(fn); };
  }

  function init() {
    if (_initialized) return;
    _initialized = true;
    // Wire upstream listeners. Each one calls _recompute on change.
    _wireTabActivated();
    _wireSelectionChange();
    _wireViewManager();
    _wireSidebar();
    // Initial compute.
    _recompute();
  }

  function _reset() {
    _disposers.forEach(function(d) { try { d(); } catch (_) {} });
    _disposers.length = 0;
    _subscribers.clear();
    _snapshot = _clone(EMPTY_SNAPSHOT);
    _initialized = false;
  }

  // ----------------------------------------------------------------
  // Upstream listener wiring
  // ----------------------------------------------------------------
  function _wireTabActivated() {
    const handler = function() { _recompute(); };
    document.addEventListener('editor.tabActivated', handler);
    document.addEventListener('editor.docDirtyChanged', handler);  // optional per plan §4.2
    _disposers.push(function() {
      document.removeEventListener('editor.tabActivated', handler);
      document.removeEventListener('editor.docDirtyChanged', handler);
    });
  }
  function _wireSelectionChange() {
    const handler = function() { _recompute(); };
    document.addEventListener('selectionchange', handler);
    _disposers.push(function() { document.removeEventListener('selectionchange', handler); });
  }
  function _wireViewManager() {
    if (!Rga.ViewManager || typeof Rga.ViewManager.onChange !== 'function') return;
    const off = Rga.ViewManager.onChange(function() { _recompute(); });
    if (typeof off === 'function') _disposers.push(off);
  }
  function _wireSidebar() {
    if (!Rga.Shell || !Rga.Shell.Sidebar || typeof Rga.Shell.Sidebar.onChange !== 'function') return;
    const off = Rga.Shell.Sidebar.onChange(function() { _recompute(); });
    if (typeof off === 'function') _disposers.push(off);
  }

  // ----------------------------------------------------------------
  // Recompute
  // ----------------------------------------------------------------
  function _recompute() {
    const view = _activeView();
    const doc = _activeDoc();
    const next = {
      activeScript:     _deriveActiveScript(doc),
      currentScene:     _deriveCurrentScene(view),
      currentPage:      _deriveCurrentPage(view),
      currentView:      _deriveCurrentView(),
      currentSelection: _deriveCurrentSelection(view),
      openPanels:       _deriveOpenPanels(),
      activePanel:      _deriveActivePanel()
      // Slice 7 §A: wordCount + currentBlockType moved to ScriptMetrics.
    };
    if (_snapshotEquals(_snapshot, next)) return;  // calm by default
    const prev = _snapshot;
    _snapshot = next;
    _subscribers.forEach(function(fn) {
      try { fn(_clone(next), _clone(prev)); }
      catch (err) { console.error('[Rga.ScriptSession] subscriber threw:', err); }
    });
  }

  // ----------------------------------------------------------------
  // Derivations (per plan §3.5)
  // ----------------------------------------------------------------
  function _deriveActiveScript(doc) {
    if (!doc) return null;
    return {
      docId:       doc.docId || null,
      displayName: doc.displayName || 'Untitled.rga',
      dirty:       !!doc.dirty
    };
  }

  function _deriveCurrentScene(view) {
    if (!view || !view.state) return null;
    const idx = (Rga.Nav && typeof Rga.Nav.getIndex === 'function') ? Rga.Nav.getIndex(view.state) : null;
    if (!idx || !Array.isArray(idx.scenes) || idx.scenes.length === 0) return null;
    const cursorPos = view.state.selection ? view.state.selection.from : 0;
    let found = null;
    for (let i = 0; i < idx.scenes.length; i += 1) {
      const s = idx.scenes[i];
      if (cursorPos >= s.pmPos && cursorPos < s.pmEndPos) { found = s; break; }
    }
    if (!found) return null;
    return {
      nodeId:         found.nodeId,
      sceneNumber:    found.sceneNumber,
      headingDisplay: found.headingDisplay
    };
  }

  function _deriveCurrentPage(view) {
    if (!view || !view.state) return null;
    const pageMap = (Rga.Nav && typeof Rga.Nav.getPageMap === 'function') ? Rga.Nav.getPageMap(view.state) : null;
    if (!Array.isArray(pageMap) || pageMap.length === 0) return null;
    const idx = (Rga.Nav && typeof Rga.Nav.getIndex === 'function') ? Rga.Nav.getIndex(view.state) : null;
    if (!idx || !Array.isArray(idx.pages) || idx.pages.length === 0) return { number: null, total: pageMap.length };
    const currentScene = _deriveCurrentScene(view);
    if (!currentScene) return { number: null, total: pageMap.length };
    for (let i = 0; i < idx.pages.length; i += 1) {
      const pg = idx.pages[i];
      if (Array.isArray(pg.sceneIds) && pg.sceneIds.indexOf(currentScene.nodeId) >= 0) {
        return { number: pg.pageNumber, total: pageMap.length };
      }
    }
    return { number: null, total: pageMap.length };
  }

  function _deriveCurrentView() {
    if (!Rga.ViewManager || typeof Rga.ViewManager.current !== 'function') return null;
    return Rga.ViewManager.current();
  }

  function _deriveCurrentSelection(view) {
    if (!view || !view.state || !view.state.selection) return null;
    const sel = view.state.selection;
    return { from: sel.from, to: sel.to, empty: !!sel.empty };
  }

  function _deriveOpenPanels() {
    if (!Rga.Shell || !Rga.Shell.Sidebar || typeof Rga.Shell.Sidebar.registered !== 'function') return [];
    return Rga.Shell.Sidebar.registered();
  }

  function _deriveActivePanel() {
    if (!Rga.Shell || !Rga.Shell.Sidebar || typeof Rga.Shell.Sidebar.current !== 'function') return null;
    return Rga.Shell.Sidebar.current();
  }

  // Slice 7 §A: _deriveWordCount and _deriveCurrentBlockType moved to
  // renderer/js/shell/script-metrics.js (the analytics SSOT per
  // Rga.SessionBoundary). ScriptSession no longer carries derived
  // analytics; consumers read those fields from Rga.ScriptMetrics.

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  function _activeView() {
    if (Rga.TabManager && typeof Rga.TabManager._editorView === 'function') return Rga.TabManager._editorView();
    return null;
  }
  function _activeDoc() {
    if (Rga.TabManager && typeof Rga.TabManager.activeDoc === 'function') return Rga.TabManager.activeDoc();
    return null;
  }

  function _clone(snap) {
    return {
      activeScript:     snap.activeScript ? Object.assign({}, snap.activeScript) : null,
      currentScene:     snap.currentScene ? Object.assign({}, snap.currentScene) : null,
      currentPage:      snap.currentPage ? Object.assign({}, snap.currentPage) : null,
      currentView:      snap.currentView,
      currentSelection: snap.currentSelection ? Object.assign({}, snap.currentSelection) : null,
      openPanels:       Array.isArray(snap.openPanels) ? snap.openPanels.slice() : [],
      activePanel:      snap.activePanel
    };
  }

  function _snapshotEquals(a, b) {
    if (!_deepEqualOrNull(a.activeScript, b.activeScript)) return false;
    if (!_deepEqualOrNull(a.currentScene, b.currentScene)) return false;
    if (!_deepEqualOrNull(a.currentPage, b.currentPage)) return false;
    if (a.currentView !== b.currentView) return false;
    if (!_deepEqualOrNull(a.currentSelection, b.currentSelection)) return false;
    if (a.activePanel !== b.activePanel) return false;
    if (a.openPanels.length !== b.openPanels.length) return false;
    for (let i = 0; i < a.openPanels.length; i += 1) {
      if (a.openPanels[i] !== b.openPanels[i]) return false;
    }
    return true;
  }

  function _deepEqualOrNull(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i += 1) {
      if (a[ka[i]] !== b[ka[i]]) return false;
    }
    return true;
  }

  Rga.ScriptSession.get       = get;
  Rga.ScriptSession.subscribe = subscribe;
  Rga.ScriptSession.init      = init;
  Rga.ScriptSession._reset    = _reset;
  Rga.ScriptSession._recompute = _recompute;  // test helper for forced refresh
})();
