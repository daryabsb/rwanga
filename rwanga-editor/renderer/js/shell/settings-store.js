// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Architecture Doctrine — substrate.
//
// Single source of truth for setting values across the renderer.
// Tier cascade (top wins):
//
//   Session  → in-memory only, lost on reload
//   Script   → doc.settings on the active document (travels with .rga)
//   Project  → STUB (always undefined; live in a later slice)
//   User     → window.rwanga.prefs (per-user, persisted to disk)
//   Built-in → Rga.Settings.Registry.getDefault(id)
//
// Built-in defaults come from the Settings Registry (Slice 3A). The
// store does not enumerate defaults itself — it just consults the
// registry at read time. The registry is loaded as a sibling shell
// module and may be absent in early-boot or unit-test scaffolding;
// _getBuiltin() returns undefined in that case (same behavior as
// an unknown id).
//
// Substrate ships:
//   - the cascade resolver (effective)
//   - per-tier read/write (get / set)
//   - subscribe / unsubscribe with change-only emission
//   - re-emit on `editor.tabActivated` for script-tier effective changes
//   - set() validation via Rga.Settings.Validators (Slice 3C)
//
// set() validation policy (Slice 3C):
//   - set() returns boolean.
//   - true  → value was valid AND the write succeeded.
//   - false → value was rejected. Causes:
//       * id is not in the registry
//       * value fails the type validator for the entry
//       * tier is unknown
//       * tier is 'project' (stub)
//       * tier is 'script' with no active doc
//   - On rejection: console.warn with the reason; NO _userValues /
//     _sessionValues / doc.settings mutation; NO prefs.write call;
//     NO subscriber notification.
//
// Substrate explicitly does NOT ship:
//   - migration, undo, restart-required handling
//   - any UI or applicator wiring (applicators are independent consumers
//     that subscribe to ids they care about)
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Settings = Rga.Settings || {};

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
    const reg = Rga.Settings && Rga.Settings.Registry;
    if (!reg || typeof reg.getDefault !== 'function') return undefined;
    return reg.getDefault(id);
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

    // Validate against the registry entry. Unknown ids and values that
    // fail the type validator are both rejected here, before any state
    // mutation.
    const reg = Rga.Settings && Rga.Settings.Registry;
    const validators = Rga.Settings && Rga.Settings.Validators;
    if (!reg || typeof reg.get !== 'function') {
      console.warn('[Rga.Settings.Store] registry not loaded — set() rejected:', id);
      return false;
    }
    const entry = reg.get(id);
    if (!entry) {
      console.warn('[Rga.Settings.Store] unknown setting id — set() rejected:', id);
      return false;
    }
    if (!validators || typeof validators.validateValue !== 'function') {
      console.warn('[Rga.Settings.Store] validators not loaded — set() rejected:', id);
      return false;
    }
    if (!validators.validateValue(entry, value)) {
      console.warn('[Rga.Settings.Store] value rejected by ' + entry.type +
        ' validator for "' + id + '":', value);
      return false;
    }

    if (tier === 'project') {
      console.warn('[Rga.Settings.Store] project tier is a stub — write ignored:', id);
      return false;
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
        return false;
      }
      doc.settings = doc.settings || {};
      doc.settings[id] = value;
      if (Rga.Doc && typeof Rga.Doc.markDirty === 'function') {
        Rga.Doc.markDirty(doc);
      }
    } else {
      console.warn('[Rga.Settings.Store] unknown tier:', tier);
      return false;
    }

    _emitIfChanged(id);
    return true;
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
    _reset:      _reset
  };
})();
