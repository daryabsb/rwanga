// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.ScriptMetrics — derived script analytics (single owner).
//
// Runtime Ownership Stab. Slice 5 §A introduced this module as a
// DELEGATING LAYER over ScriptSession. Slice 7 §A completes the
// migration: ScriptMetrics now derives wordCount + currentBlockType
// INDEPENDENTLY from the same upstream sources ScriptSession used
// (Rga.TabManager._editorView + Rga.Nav.getOutline), and the fields
// were removed from ScriptSession's snapshot. This module is now a
// first-class SSOT per Rga.SessionBoundary, not a passthrough.
//
// Compatibility Inventory entry #6 is RESOLVED by this change.
//
// API:
//   Rga.ScriptMetrics.get()           → { wordCount, currentBlockType,
//                                          dialogueWords, actionWords,
//                                          sceneCount, estimatedRuntime }
//                                       Reserved fields default to null
//                                       (computed by a future slice).
//   Rga.ScriptMetrics.subscribe(fn)   → unsubscribe()
//                                       Fires only when an analytics
//                                       field actually changes (uses
//                                       ScriptSession.subscribe as the
//                                       cheap trigger signal — ScriptSession
//                                       already shallow-equality-filters
//                                       its own dispatches — then
//                                       re-derives and applies its own
//                                       analytics-field equality filter
//                                       before notifying.)
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};

  // Body-block name allow-list. Matches the structural blocks the
  // screenplay schema considers writer-targetable. Mirrors the list
  // ScriptSession used pre-Slice-7. The duplication is intentional:
  // ScriptMetrics owns this domain knowledge now.
  const BODY_BLOCKS = [
    'sceneHeading', 'action', 'character', 'parenthetical',
    'dialogue', 'shot', 'transition', 'paragraph', 'heading'
  ];

  // Reserved-for-future fields. Today always null because their
  // derivation lives in a slice that hasn't opened yet. Listed in
  // get()'s shape so consumers can rely on the snapshot being stable:
  // `get().sceneCount` is always defined (possibly null), never undefined.
  const RESERVED = ['dialogueWords', 'actionWords', 'sceneCount', 'estimatedRuntime'];

  let _lastSnap = _emptySnap();
  const _disposers = [];
  let _initialized = false;

  function _emptySnap() {
    const s = { wordCount: null, currentBlockType: null };
    RESERVED.forEach(function(f) { s[f] = null; });
    return s;
  }

  function _activeView() {
    if (Rga.TabManager && typeof Rga.TabManager._editorView === 'function') {
      return Rga.TabManager._editorView();
    }
    return null;
  }

  function _deriveWordCount(view) {
    if (!view || !view.state) return null;
    if (!Rga.Nav || typeof Rga.Nav.getOutline !== 'function') return null;
    const outline = Rga.Nav.getOutline(view.state);
    if (!outline || !outline.statistics) return null;
    return typeof outline.statistics.words === 'number' ? outline.statistics.words : null;
  }

  function _deriveCurrentBlockType(view) {
    if (!view || !view.state || !view.state.selection) return null;
    const $from = view.state.selection.$from;
    if (!$from || !$from.parent || !$from.parent.type) return null;
    const name = $from.parent.type.name;
    return BODY_BLOCKS.indexOf(name) >= 0 ? name : null;
  }

  function get() {
    const view = _activeView();
    const snap = {
      wordCount:        _deriveWordCount(view),
      currentBlockType: _deriveCurrentBlockType(view)
    };
    RESERVED.forEach(function(f) { snap[f] = null; });
    return snap;
  }

  function _equals(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.wordCount !== b.wordCount) return false;
    if (a.currentBlockType !== b.currentBlockType) return false;
    // Reserved fields are always null today; nothing to compare.
    return true;
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function() {};
    if (!Rga.ScriptSession || typeof Rga.ScriptSession.subscribe !== 'function') {
      return function() {};
    }
    // Lazy init on first subscribe: snapshot the current state so
    // future change-detection has a baseline.
    if (!_initialized) {
      _lastSnap = get();
      _initialized = true;
    }
    // ScriptSession's subscribe is the cheap trigger — ScriptSession
    // already shallow-equality-filters its own dispatches, so we
    // only see notifications when SOMETHING upstream changed.
    return Rga.ScriptSession.subscribe(function() {
      const next = get();
      const prev = _lastSnap;
      if (_equals(next, prev)) return;
      _lastSnap = next;
      try { fn(_clone(next), _clone(prev)); }
      catch (err) { console.error('[Rga.ScriptMetrics] subscriber threw:', err); }
    });
  }

  function _clone(snap) {
    if (!snap) return null;
    const out = { wordCount: snap.wordCount, currentBlockType: snap.currentBlockType };
    RESERVED.forEach(function(f) { out[f] = snap[f] != null ? snap[f] : null; });
    return out;
  }

  function _reset() {
    _disposers.forEach(function(d) { try { d(); } catch (_) {} });
    _disposers.length = 0;
    _lastSnap = _emptySnap();
    _initialized = false;
  }

  Rga.ScriptMetrics = {
    get: get,
    subscribe: subscribe,
    _reset: _reset,
    _RESERVED: RESERVED,
    _BODY_BLOCKS: BODY_BLOCKS
  };
  Rga.Shell.ScriptMetrics = Rga.ScriptMetrics;
})();
