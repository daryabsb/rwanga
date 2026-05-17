// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// ViewManager — central registry for editor view modes.
//
// Phase 7 correction: body classes were the source of truth for which view
// was active. That made it impossible to add new view modes (Focus, Split,
// PrintPreview) without scattered CSS-class arithmetic. ViewManager moves
// the truth into one place: an active-id and a controller registry. Body
// classes become a side effect of activation, applied by ViewManager on
// behalf of the active controller.
//
// API:
//   Rga.ViewManager.register(id, controller) → boolean
//     controller = {
//       bodyClass?: string,         // applied to document.body while active
//       activate?(...args),         // called when view becomes active
//       deactivate?()               // called when view loses active status
//     }
//   Rga.ViewManager.activate(id, ...args) → boolean
//     Deactivates the current view (if any & different), then activates `id`.
//     If `id` is already current, calls activate(...args) again without
//     deactivating — controllers decide what re-activation means
//     (PrintPreview re-renders, ViewMode no-ops, etc).
//   Rga.ViewManager.deactivate() → void
//     Deactivates the current view (no replacement). current() → null.
//   Rga.ViewManager.current() → string | null
//   Rga.ViewManager.isActive(id) → boolean
//   Rga.ViewManager.registered() → string[]
//   Rga.ViewManager.unregister(id) → void
//   Rga.ViewManager.onChange(fn) → unsubscribe()
//     fn(newId, prevId) fires after every activate / deactivate.
//
// Mutual exclusion is enforced — exactly one view can be active at a time.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.ViewManager = Rga.ViewManager || {};

  const _controllers = new Map();
  const _listeners = new Set();
  let _currentId = null;

  function register(id, controller) {
    if (!id || typeof id !== 'string') return false;
    if (!controller || typeof controller !== 'object') return false;
    _controllers.set(id, controller);
    return true;
  }

  function unregister(id) {
    if (_currentId === id) deactivate();
    _controllers.delete(id);
  }

  function activate(id) {
    const controller = _controllers.get(id);
    if (!controller) return false;
    const args = Array.prototype.slice.call(arguments, 1);

    // Re-activation of same id → re-run activate without deactivating.
    if (_currentId === id) {
      _safeActivate(controller, args);
      _notify(id, id);
      return true;
    }

    // Otherwise, deactivate the previous view first.
    const prevId = _currentId;
    if (prevId) {
      const prev = _controllers.get(prevId);
      _safeDeactivate(prev);
    }

    // Apply body-class side effect.
    if (controller.bodyClass) document.body.classList.add(controller.bodyClass);

    const ok = _safeActivate(controller, args);
    _currentId = id;
    _notify(id, prevId);
    return ok !== false;
  }

  function deactivate() {
    if (!_currentId) return;
    const prev = _controllers.get(_currentId);
    const prevId = _currentId;
    _safeDeactivate(prev);
    _currentId = null;
    _notify(null, prevId);
  }

  function current() { return _currentId; }
  function isActive(id) { return _currentId === id; }
  function registered() { return Array.from(_controllers.keys()); }

  function onChange(fn) {
    if (typeof fn !== 'function') return function() {};
    _listeners.add(fn);
    return function unsubscribe() { _listeners.delete(fn); };
  }

  // Test-only escape hatch — reset registry between tests.
  function _reset() {
    if (_currentId) {
      const c = _controllers.get(_currentId);
      _safeDeactivate(c);
    }
    _controllers.clear();
    _listeners.clear();
    _currentId = null;
  }

  // ----------------------------------------------------------------
  // Internals
  // ----------------------------------------------------------------
  function _safeActivate(controller, args) {
    if (controller && typeof controller.activate === 'function') {
      try { return controller.activate.apply(null, args); }
      catch (err) { console.error('[view-manager] activate threw:', err); return false; }
    }
    return true;
  }
  function _safeDeactivate(controller) {
    if (!controller) return;
    if (typeof controller.deactivate === 'function') {
      try { controller.deactivate(); }
      catch (err) { console.error('[view-manager] deactivate threw:', err); }
    }
    if (controller.bodyClass) document.body.classList.remove(controller.bodyClass);
  }
  function _notify(newId, prevId) {
    _listeners.forEach(function(fn) {
      try { fn(newId, prevId); } catch (err) { console.error('[view-manager] listener threw:', err); }
    });
  }

  Rga.ViewManager.register   = register;
  Rga.ViewManager.unregister = unregister;
  Rga.ViewManager.activate   = activate;
  Rga.ViewManager.deactivate = deactivate;
  Rga.ViewManager.current    = current;
  Rga.ViewManager.isActive   = isActive;
  Rga.ViewManager.registered = registered;
  Rga.ViewManager.onChange   = onChange;
  Rga.ViewManager._reset     = _reset;
})();
