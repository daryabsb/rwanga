// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings Applicators — Slice 3D.
//
// A small registry that bridges Rga.Settings.Store ↔ surface-touching
// handlers. Each applicator is one register(id, handler, opts?) call.
// The registry owns the Store.subscribe for that id, so individual
// applicator modules do not have to manage subscriptions themselves.
//
// API:
//   register(id, handler, opts?)  — store handler, subscribe to Store
//   get(id)                       — { id, handler, owner } | null
//   apply(id, value?)             — call the handler once (effective if
//                                   value omitted); no-op if unregistered
//   applyAll()                    — call every registered handler with
//                                   its current effective value
//   registered()                  — array of ids
//   _reset()                      — test-only
//
// Rules:
//   - Many ids may share a single handler function (e.g. an
//     editor-font-stack applicator handles fontFamily + fontSize +
//     lineHeight together).
//   - Re-registering an id replaces the prior handler AND its Store
//     subscription cleanly — no leaks, no double-fire.
//   - Missing applicator is valid. apply(id) on an unregistered id is
//     a silent no-op (no console.warn — applicators land slice by
//     slice and many ids will be unregistered for a while).
//   - One handler throwing must not break other applicators. apply()
//     catches and logs (console.error) without rethrowing.
//   - opts.owner is metadata only (e.g. 'editor', 'shell', 'print',
//     'pageSetup', 'appearance', 'review'). NOT enforced in Slice 3D —
//     useful later for grouping in the Settings UI / debug overlays.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Settings = Rga.Settings || {};

  // id → { id, handler, owner, _storeUnsubscribe }
  const _registry = new Map();

  function _activeStore() {
    return (Rga.Settings && Rga.Settings.Store) || null;
  }

  function register(id, handler, opts) {
    if (typeof id !== 'string' || id.length === 0) return;
    if (typeof handler !== 'function') return;
    opts = opts || {};

    // Clean any prior subscription so the replaced handler does not
    // continue to fire on Store changes.
    const prior = _registry.get(id);
    if (prior && typeof prior._storeUnsubscribe === 'function') {
      try { prior._storeUnsubscribe(); }
      catch (err) { console.error('[Rga.Settings.Applicators] unsubscribe threw:', err); }
    }

    const entry = {
      id: id,
      handler: handler,
      owner: typeof opts.owner === 'string' ? opts.owner : null,
      _storeUnsubscribe: null
    };

    // Subscribe to Store changes — when the effective value moves, the
    // handler fires with the new value. Store.subscribe may not be
    // available in early-boot scaffolding (e.g. tiny unit tests) —
    // tolerate its absence.
    const store = _activeStore();
    if (store && typeof store.subscribe === 'function') {
      entry._storeUnsubscribe = store.subscribe(id, function(newVal) {
        _invoke(entry, newVal);
      });
    }

    _registry.set(id, entry);
  }

  function get(id) {
    const e = _registry.get(id);
    if (!e) return null;
    return { id: e.id, handler: e.handler, owner: e.owner };
  }

  function registered() {
    return Array.from(_registry.keys());
  }

  function apply(id, value) {
    const entry = _registry.get(id);
    if (!entry) return;   // missing applicator is valid; silent.
    if (arguments.length < 2) {
      const store = _activeStore();
      value = store && typeof store.effective === 'function'
        ? store.effective(id)
        : undefined;
    }
    _invoke(entry, value);
  }

  function applyAll() {
    const store = _activeStore();
    _registry.forEach(function(entry, id) {
      const v = store && typeof store.effective === 'function'
        ? store.effective(id)
        : undefined;
      _invoke(entry, v);
    });
  }

  function _invoke(entry, value) {
    try {
      entry.handler(value, entry.id);
    } catch (err) {
      console.error('[Rga.Settings.Applicators] applicator threw for "' +
        entry.id + '":', err);
    }
  }

  function _reset() {
    _registry.forEach(function(entry) {
      if (typeof entry._storeUnsubscribe === 'function') {
        try { entry._storeUnsubscribe(); }
        catch (err) { /* ignore — best-effort cleanup */ }
      }
    });
    _registry.clear();
  }

  Rga.Settings.Applicators = {
    register, get, apply, applyAll, registered, _reset
  };
})();
