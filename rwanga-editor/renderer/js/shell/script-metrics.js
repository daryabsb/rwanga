// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.ScriptMetrics — derived script analytics (single owner).
//
// Runtime Ownership Stab. Slice 5 §A. Resolves Compatibility
// Inventory entry #6 (the "ScriptSession analytics misplacement"
// recorded after post-Slice-2 architectural review): wordCount and
// currentBlockType architecturally belong on a derived-analytics
// sibling of ScriptSession, not on the writer-context snapshot.
//
// Slice 5 strategy: introduce ScriptMetrics as a thin DELEGATING
// LAYER over ScriptSession. ScriptSession still TEMPORARILY stores
// the fields (so Outline / future consumers don't break); the
// canonical SSOT for these analytics going forward is
// Rga.ScriptMetrics. A later slice will:
//   1. Migrate any remaining consumer (Outline) to read from
//      ScriptMetrics.
//   2. Move the derivation logic from ScriptSession into
//      ScriptMetrics' own _derive.
//   3. Delete the fields from ScriptSession's snapshot.
// Until then this module is a passthrough. The extraction roadmap +
// runtime audit track the open migration.
//
// API:
//   Rga.ScriptMetrics.get()           → { wordCount, currentBlockType,
//                                          dialogueWords, actionWords,
//                                          sceneCount, estimatedRuntime }
//                                       Reserved fields default to null
//                                       (computed by a future slice).
//   Rga.ScriptMetrics.subscribe(fn)   → unsubscribe()
//                                       Fires only when one of the
//                                       analytics fields changes
//                                       (ignores ScriptSession's
//                                       writer-context churn).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};

  // Reserved-for-future analytics. Today all return null because
  // their derivation lives in a slice that hasn't opened yet. They
  // are listed here so consumers can rely on the snapshot shape
  // being stable: `get().sceneCount` is always defined (possibly
  // null), never undefined.
  const RESERVED = ['dialogueWords', 'actionWords', 'sceneCount', 'estimatedRuntime'];

  function _readScriptSession() {
    if (!Rga.ScriptSession || typeof Rga.ScriptSession.get !== 'function') return null;
    return Rga.ScriptSession.get();
  }

  function get() {
    const ss = _readScriptSession();
    const out = {
      wordCount:        ss ? ss.wordCount : null,
      currentBlockType: ss ? ss.currentBlockType : null
    };
    RESERVED.forEach(function(field) { out[field] = null; });
    return out;
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function() {};
    if (!Rga.ScriptSession || typeof Rga.ScriptSession.subscribe !== 'function') {
      return function() {};
    }
    // Filter ScriptSession's snapshot stream to ScriptMetrics-relevant
    // changes only. ScriptSession fires on every cursor move, panel
    // toggle, etc.; ScriptMetrics should only re-notify when an
    // analytics field actually changes.
    return Rga.ScriptSession.subscribe(function(next, prev) {
      const nextWc = next ? next.wordCount : null;
      const prevWc = prev ? prev.wordCount : null;
      const nextBt = next ? next.currentBlockType : null;
      const prevBt = prev ? prev.currentBlockType : null;
      if (nextWc === prevWc && nextBt === prevBt) return;
      const nextSnap = { wordCount: nextWc, currentBlockType: nextBt };
      const prevSnap = { wordCount: prevWc, currentBlockType: prevBt };
      RESERVED.forEach(function(field) {
        nextSnap[field] = null;
        prevSnap[field] = null;
      });
      try { fn(nextSnap, prevSnap); }
      catch (err) { console.error('[Rga.ScriptMetrics] subscriber threw:', err); }
    });
  }

  Rga.ScriptMetrics = {
    get: get,
    subscribe: subscribe,
    _RESERVED: RESERVED
  };
  Rga.Shell.ScriptMetrics = Rga.ScriptMetrics;
})();
