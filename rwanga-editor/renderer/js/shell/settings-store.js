// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Architecture Doctrine — substrate (Slice 2).
//
// Single source of truth for setting values across the renderer.
// Tier cascade (top wins):
//
//   Session  → in-memory only, lost on reload
//   Script   → doc.settings on the active document (travels with .rga)
//   Project  → STUB (always undefined; live in a later slice)
//   User     → window.rwanga.prefs (per-user, persisted to disk)
//   Built-in → BUILTINS table below
//
// Slice 2 ships:
//   - the cascade resolver (effective)
//   - per-tier read/write (get / set)
//   - subscribe / unsubscribe with change-only emission
//   - re-emit on `editor.tabActivated` for script-tier effective changes
//
// Slice 2 explicitly does NOT ship:
//   - a settings registry (BUILTINS is a tiny inline map here)
//   - validators, migration, undo, restart-required handling
//   - any UI or applicator wiring (applicators are independent consumers
//     that subscribe to ids they care about)
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Settings = Rga.Settings || {};

  // Built-in defaults. Slice 2 ships ONE proof setting only — later
  // slices replace this map with a registry-driven defaults table.
  const BUILTINS = {
    'editor.highlightCurrentLine': true
  };

  // ----------------------------------------------------------------
  // Per-tier state
  // ----------------------------------------------------------------

  // Object.create(null) so prototype keys never accidentally satisfy
  // hasOwnProperty lookups (foo === 'toString', etc.).
  let _userValues    = Object.create(null);
  let _sessionValues = Object.create(null);

  // Subscriptions: Map<id, Set<handler>>. Handlers receive
  // (newEffective, oldEffective, id) only when effective() changes.
  const _subs = new Map();

  // Per-id snapshot of the last effective value we emitted; used by
  // _emitIfChanged so set() and tab-activated re-emit don't fire when
  // the effective value didn't actually move.
  const _lastEffective = new Map();

  let _initialized = false;
  let _tabActivatedHandler = null;

  // ----------------------------------------------------------------
  // Lookups
  // ----------------------------------------------------------------

  function _getBuiltin(id) {
    return Object.prototype.hasOwnProperty.call(BUILTINS, id) ? BUILTINS[id] : undefined;
  }

  function _activeDoc() {
    const TM = window.Rga && window.Rga.TabManager;
    if (!TM || typeof TM.activeDoc !== 'function') return null;
    return TM.activeDoc();
  }

  function _scriptValue(id) {
    const doc = _activeDoc();
    if (!doc || !doc.settings) return undefined;
    if (!Object.prototype.hasOwnProperty.call(doc.settings, id)) return undefined;
    return doc.settings[id];
  }

  function effective(id) {
    if (Object.prototype.hasOwnProperty.call(_sessionValues, id)) {
      return _sessionValues[id];
    }
    const fromScript = _scriptValue(id);
    if (fromScript !== undefined) return fromScript;
    // Project tier is a stub — always falls through.
    if (Object.prototype.hasOwnProperty.call(_userValues, id)) {
      return _userValues[id];
    }
    return _getBuiltin(id);
  }

  function get(id, tier) {
    tier = tier || 'user';
    if (tier === 'session') {
      return Object.prototype.hasOwnProperty.call(_sessionValues, id)
        ? _sessionValues[id] : undefined;
    }
    if (tier === 'script')  return _scriptValue(id);
    if (tier === 'project') return undefined;
    if (tier === 'user') {
      return Object.prototype.hasOwnProperty.call(_userValues, id)
        ? _userValues[id] : undefined;
    }
    if (tier === 'builtin') return _getBuiltin(id);
    return undefined;
  }

  // ----------------------------------------------------------------
  // Writes
  // ----------------------------------------------------------------

  function set(id, value, opts) {
    opts = opts || {};
    const tier = opts.tier || 'user';

    if (tier === 'project') {
      // Project tier is intentionally a no-op in Slice 2; a later slice
      // adds the project container + storage.
      console.warn('[Rga.Settings.Store] project tier is a stub — write ignored:', id);
      return;
    }

    if (tier === 'session') {
      _sessionValues[id] = value;
    } else if (tier === 'user') {
      _userValues[id] = value;
      _persistUserValue(id, value);
    } else if (tier === 'script') {
      const doc = _activeDoc();
      if (!doc) {
        console.warn('[Rga.Settings.Store] no active doc — script-tier write dropped:', id);
        return;
      }
      doc.settings = doc.settings || {};
      doc.settings[id] = value;
      if (Rga.Doc && typeof Rga.Doc.markDirty === 'function') {
        Rga.Doc.markDirty(doc);
      }
    } else {
      console.warn('[Rga.Settings.Store] unknown tier:', tier);
      return;
    }

    _emitIfChanged(id);
  }

  function _persistUserValue(id, value) {
    if (!window.rwanga || !window.rwanga.prefs ||
        typeof window.rwanga.prefs.write !== 'function') {
      return;  // no prefs IPC available (e.g. jsdom unit tests without stub)
    }
    try {
      // Fire-and-forget. The in-memory _userValues is the truth for the
      // current session; the disk write is for the next launch.
      const partial = {};
      partial[id] = value;
      Promise.resolve(window.rwanga.prefs.write(partial)).catch(function(err) {
        console.warn('[Rga.Settings.Store] prefs.write failed:', err);
      });
    } catch (err) {
      console.warn('[Rga.Settings.Store] prefs.write threw:', err);
    }
  }

  // ----------------------------------------------------------------
  // Subscriptions + emission
  // ----------------------------------------------------------------

  function subscribe(id, handler) {
    if (typeof handler !== 'function') return function() {};
    let set = _subs.get(id);
    if (!set) {
      set = new Set();
      _subs.set(id, set);
    }
    set.add(handler);
    // Seed the change-detection baseline on first subscriber so a later
    // tab activation or set() has a defined "oldVal" to diff against.
    if (!_lastEffective.has(id)) {
      _lastEffective.set(id, effective(id));
    }
    return function unsubscribe() {
      const s = _subs.get(id);
      if (s) s.delete(handler);
    };
  }

  function unsubscribe(id, handler) {
    const s = _subs.get(id);
    if (s) s.delete(handler);
  }

  function _emit(id, newVal, oldVal) {
    const s = _subs.get(id);
    if (!s) return;
    s.forEach(function(handler) {
      try { handler(newVal, oldVal, id); }
      catch (err) { console.error('[Rga.Settings.Store] subscriber threw:', err); }
    });
  }

  function _emitIfChanged(id) {
    const subs = _subs.get(id);
    if (!subs || subs.size === 0) return;
    const cur = effective(id);
    const last = _lastEffective.get(id);
    if (_equal(cur, last)) return;
    _lastEffective.set(id, cur);
    _emit(id, cur, last);
  }

  // Shallow equality. Sufficient for Slice 2 (scalar values + simple
  // objects like margins). Deep-diff comes with validators.
  function _equal(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
      return false;
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i += 1) {
      if (a[ka[i]] !== b[ka[i]]) return false;
    }
    return true;
  }

  // ----------------------------------------------------------------
  // Tab-activated → re-evaluate script-tier effective changes
  // ----------------------------------------------------------------

  function _onTabActivated() {
    _subs.forEach(function(_set, id) { _emitIfChanged(id); });
  }

  // ----------------------------------------------------------------
  // Init
  // ----------------------------------------------------------------

  async function init() {
    if (_initialized) return;
    // Hydrate user tier from the persisted prefs file (if available).
    if (window.rwanga && window.rwanga.prefs &&
        typeof window.rwanga.prefs.read === 'function') {
      try {
        const stored = await window.rwanga.prefs.read();
        if (stored && typeof stored === 'object') {
          _userValues = Object.assign(Object.create(null), stored);
        }
      } catch (err) {
        console.warn('[Rga.Settings.Store] prefs.read failed:', err);
      }
    }
    // Listen for active-doc changes so subscribers see script-tier
    // effective flips on tab switches.
    if (!_tabActivatedHandler) {
      _tabActivatedHandler = _onTabActivated;
      document.addEventListener('editor.tabActivated', _tabActivatedHandler);
    }
    _initialized = true;
  }

  function _reset() {
    _userValues    = Object.create(null);
    _sessionValues = Object.create(null);
    _subs.clear();
    _lastEffective.clear();
    if (_tabActivatedHandler) {
      document.removeEventListener('editor.tabActivated', _tabActivatedHandler);
      _tabActivatedHandler = null;
    }
    _initialized = false;
  }

  Rga.Settings.Store = {
    init:        init,
    set:         set,
    get:         get,
    effective:   effective,
    subscribe:   subscribe,
    unsubscribe: unsubscribe,
    _reset:      _reset,
    _BUILTINS:   BUILTINS
  };
})();
