// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Shell.Layout — shell-truth ownership layer.
//
// One of the three ownership layers (slice-1 plan §2.5):
//   * Document truth → PM EditorState (engine)
//   * Shell truth    → Rga.Shell.Layout   ← THIS
//   * Writer-context → Rga.ScriptSession
//
// Single in-memory container for shell-zone state. Slice 1 is in-memory
// only; Slice 2 adds workspace JSON persistence via the same API.
//
// API (slice 1 plan §3.1):
//   Rga.Shell.Layout.get()           → readonly shallow copy
//   Rga.Shell.Layout.set(partial)    → merge; notifies subscribers
//   Rga.Shell.Layout.subscribe(fn)   → returns unsubscribe()
//   Rga.Shell.Layout._reset()        → test helper; restores defaults
//
// Merge semantics: per-zone shallow merge. set({sidebar: {visible: false}})
// updates sidebar.visible and preserves sidebar.width + sidebar.activePanel.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};
  Rga.Shell.Layout = Rga.Shell.Layout || {};

  const DEFAULTS = {
    sidebar:     { visible: true,  width: 280, activePanel: 'sceneNavigator' },
    studioPanel: { visible: false, height: 200, activeTab: null },
    titleBar:    { visible: true },
    statusBar:   { visible: true }
  };

  let _current = _cloneDeepDefaults();
  const _subscribers = new Set();

  function _cloneDeepDefaults() {
    return {
      sidebar:     Object.assign({}, DEFAULTS.sidebar),
      studioPanel: Object.assign({}, DEFAULTS.studioPanel),
      titleBar:    Object.assign({}, DEFAULTS.titleBar),
      statusBar:   Object.assign({}, DEFAULTS.statusBar)
    };
  }

  function get() {
    // Shallow per-zone copy. Returning the internal object would let
    // consumers mutate state out from under subscribers; this is the
    // same defensive pattern Rga.RuntimeProfile uses.
    return {
      sidebar:     Object.assign({}, _current.sidebar),
      studioPanel: Object.assign({}, _current.studioPanel),
      titleBar:    Object.assign({}, _current.titleBar),
      statusBar:   Object.assign({}, _current.statusBar)
    };
  }

  function set(partial) {
    if (!partial || typeof partial !== 'object') return;
    const prev = get();
    let changed = false;
    Object.keys(partial).forEach(function(zone) {
      const incoming = partial[zone];
      if (!incoming || typeof incoming !== 'object') return;
      if (!_current[zone]) {
        // Unknown zone — accept it (forward-compat for future fields).
        _current[zone] = {};
      }
      Object.keys(incoming).forEach(function(field) {
        if (_current[zone][field] !== incoming[field]) {
          _current[zone][field] = incoming[field];
          changed = true;
        }
      });
    });
    if (!changed) return;
    _notify(get(), prev);
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function() {};
    _subscribers.add(fn);
    return function unsubscribe() { _subscribers.delete(fn); };
  }

  function _notify(next, prev) {
    _subscribers.forEach(function(fn) {
      try { fn(next, prev); }
      catch (err) { console.error('[Rga.Shell.Layout] subscriber threw:', err); }
    });
  }

  function _reset() {
    _current = _cloneDeepDefaults();
    _subscribers.clear();
  }

  // ----------------------------------------------------------------
  // Slice 2: serialization contract — toJSON / fromJSON.
  // Pure in-memory pair; disk wiring is the slice that introduces
  // workspace persistence (Slice 4).
  // ----------------------------------------------------------------
  function toJSON() {
    // Same shape as get(). Safe to JSON.stringify directly.
    return get();
  }

  function fromJSON(snap) {
    if (!snap || typeof snap !== 'object' || Array.isArray(snap)) {
      console.error('[Rga.Shell.Layout] fromJSON: input is not a plain object');
      return false;
    }
    // Validate: every zone present must be a plain object. Unknown zones
    // pass through (forward-compat).
    const knownZones = ['sidebar', 'studioPanel', 'titleBar', 'statusBar'];
    for (let i = 0; i < knownZones.length; i += 1) {
      const z = knownZones[i];
      if (snap[z] !== undefined && (snap[z] === null || typeof snap[z] !== 'object' || Array.isArray(snap[z]))) {
        console.error('[Rga.Shell.Layout] fromJSON: zone "' + z + '" must be a plain object');
        return false;
      }
    }
    // Merge zone-by-zone in silent mode, then notify once.
    const prev = get();
    let anyChanged = false;
    Object.keys(snap).forEach(function(zone) {
      const incoming = snap[zone];
      if (!incoming || typeof incoming !== 'object') return;
      if (!_current[zone]) _current[zone] = {};
      Object.keys(incoming).forEach(function(field) {
        if (_current[zone][field] !== incoming[field]) {
          _current[zone][field] = incoming[field];
          anyChanged = true;
        }
      });
    });
    if (anyChanged) _notify(get(), prev);
    return true;
  }

  Rga.Shell.Layout.get       = get;
  Rga.Shell.Layout.set       = set;
  Rga.Shell.Layout.subscribe = subscribe;
  Rga.Shell.Layout.toJSON    = toJSON;
  Rga.Shell.Layout.fromJSON  = fromJSON;
  Rga.Shell.Layout._reset    = _reset;
  Rga.Shell.Layout._DEFAULTS = DEFAULTS;
})();
