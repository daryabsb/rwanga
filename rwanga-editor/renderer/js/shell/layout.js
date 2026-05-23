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
    // Responsive Shell: userOverride flag — set true when the user
    // manually toggles this zone (Cmd-B, activity-rail click, etc.).
    // Rga.Shell.Responsive reads it and skips auto-collapse for any
    // zone the user has explicitly chosen. Session-scoped — not
    // persisted across app restarts so a fresh boot returns to the
    // window-driven defaults.
    sidebar:     { visible: true,  width: 280, activePanel: 'sceneNavigator', userOverride: false },
    // Slice 4 §A: default changed from false → true to match the
    // long-standing UX where a fresh install boots with the bottom
    // panel visible. WorkspaceState restores user-explicit closes.
    //
    // Studio Shell Recovery §E: three-state model added (open /
    // minimized / closed). `state` is now the SSOT for visibility;
    // `visible` is kept as a derived mirror so existing readers keep
    // working (visible === (state !== 'closed')). The fromJSON
    // migration below converts pre-§E workspaces (which only stored
    // `visible: bool`) into the three-state form.
    studioPanel: { state: 'open',  visible: true,  height: 200, activeTab: null },
    // Slice 4 §A: inspector zone added so Resize has a Layout field to
    // commit `--inspector-width` to on drag end (was CSS-only before).
    // Inspector is first-class: no userOverride field — the responsive
    // engine always applies its mode decision on screen-size change so
    // the editor never gets blocked by a sticky "user wants it open"
    // preference. Full-close is forbidden via resize-clamp + recovery
    // (see resize.js, studio-panel.js _ensureExpandedWidth).
    inspector:   { visible: true,  width: 280 },
    titleBar:    { visible: true },
    statusBar:   { visible: true },
    // Studio Shell Recovery §D4: toolbar zone added so the Row 3
    // mode toggle (Screenplay / Text) persists via the existing
    // WorkspaceState pipeline (same extension pattern Slice 4 used
    // to add `inspector`). Pure visibility control; no commands
    // unregistered when 'text' hides Scene + Writing groups.
    toolbar:     { mode: 'screenplay' }
  };

  let _current = _cloneDeepDefaults();
  const _subscribers = new Set();

  function _cloneDeepDefaults() {
    return {
      sidebar:     Object.assign({}, DEFAULTS.sidebar),
      studioPanel: Object.assign({}, DEFAULTS.studioPanel),
      inspector:   Object.assign({}, DEFAULTS.inspector),
      titleBar:    Object.assign({}, DEFAULTS.titleBar),
      statusBar:   Object.assign({}, DEFAULTS.statusBar),
      toolbar:     Object.assign({}, DEFAULTS.toolbar)
    };
  }

  function get() {
    return {
      sidebar:     Object.assign({}, _current.sidebar),
      studioPanel: Object.assign({}, _current.studioPanel),
      inspector:   Object.assign({}, _current.inspector),
      titleBar:    Object.assign({}, _current.titleBar),
      statusBar:   Object.assign({}, _current.statusBar),
      toolbar:     Object.assign({}, _current.toolbar)
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
      // Studio Shell Recovery §E: studioPanel.state and studioPanel.
      // visible are the SAME concept expressed two ways. Keep them in
      // sync no matter which one the caller writes, so existing readers
      // of `.visible` see the same truth as new readers of `.state`.
      const normalized = (zone === 'studioPanel')
        ? _normalizeStudioPanel(incoming, _current[zone])
        : incoming;
      Object.keys(normalized).forEach(function(field) {
        if (_current[zone][field] !== normalized[field]) {
          _current[zone][field] = normalized[field];
          changed = true;
        }
      });
    });
    if (!changed) return;
    _notify(get(), prev);
  }

  // Studio Shell Recovery §E: derive the missing half of the
  // state/visible pair so the two fields are always consistent.
  //   state SSOT: 'open' | 'minimized' | 'closed'
  //   visible mirror: state !== 'closed'
  function _normalizeStudioPanel(incoming, currentZone) {
    const out = Object.assign({}, incoming);
    const hasState   = Object.prototype.hasOwnProperty.call(out, 'state');
    const hasVisible = Object.prototype.hasOwnProperty.call(out, 'visible');
    if (hasState && !hasVisible) {
      // Writer set state — derive visible.
      out.visible = (out.state !== 'closed');
    } else if (hasVisible && !hasState) {
      // Writer set visible — derive state. Preserve current minimized
      // when going visible=true and current state is 'minimized'.
      if (out.visible === false) {
        out.state = 'closed';
      } else {
        // visible=true → preserve minimized if currently minimized,
        // else open. This matches the long-standing toggle UX where
        // showing the panel after a hide goes to "open", not "minimized".
        out.state = (currentZone.state === 'minimized') ? 'minimized' : 'open';
      }
    }
    return out;
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
    const knownZones = ['sidebar', 'studioPanel', 'inspector', 'titleBar', 'statusBar', 'toolbar'];
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
      // Studio Shell Recovery §E: migrate pre-§E workspace JSON
      // that only carried `studioPanel.visible: bool` into the new
      // three-state shape. The brief mandates:
      //   visible=true  → state='open'
      //   visible=false → state='closed'
      const normalized = (zone === 'studioPanel')
        ? _normalizeStudioPanel(incoming, _current[zone])
        : incoming;
      Object.keys(normalized).forEach(function(field) {
        if (_current[zone][field] !== normalized[field]) {
          _current[zone][field] = normalized[field];
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
