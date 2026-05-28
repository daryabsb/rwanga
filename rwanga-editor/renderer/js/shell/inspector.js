// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Shell.Inspector — Filmustageation F1A.3.
//
// Neutral inspector content registry. Parallel in philosophy to
// Rga.Shell.Sidebar: CORE owns the frame (#inspector-panel, .inspector-
// body, the visibility toggle in studio-panel.js); plugins own the
// CONTENTS via registerPanel(controller). Mutually exclusive — at most
// one panel is active at a time.
//
// F1A.3 is **frame work only**:
//   - The registration API exists.
//   - The lifecycle (mount / unmount) is wired.
//   - The static empty-state HTML (#inspector-panel .inspector-empty)
//     is captured at setHost time and restored on deactivate, so the
//     existing visible empty state is preserved when no panel is active.
//   - **Nothing registers an inspector panel yet.** Scene Notes
//     migration is the F1A.5 brief; AI surfaces are post-Alive-App.
//
// Controller shape (per the F1A.1A audit's "contract minimally — id,
// mount, unmount, isApplicable(context)"):
//
//   {
//     id:        string,                       // unique
//     label:     string,                       // human-readable
//     isApplicable?: function(context) → bool, // optional; default true
//     mount:     function(container, context), // called on activate
//     unmount?:  function(container)           // called on deactivate
//   }
//
// Boundary discipline:
//   - registerPanel never mounts anything synchronously; the panel
//     only renders after activate(id, context?) is called.
//   - mount throws are caught + logged; the empty-state restores so
//     a buggy plugin never leaves an empty body.
//   - The host element is the .inspector-body DIV (the empty-state
//     wrapper). setHost captures its initial innerHTML once; that
//     snapshot is the "default content" restored on deactivate or on
//     a failed mount.
//   - Visibility (collapsed / expanded) is owned by
//     Rga.Shell.StudioPanel.toggleInspector. This module does NOT
//     toggle the inspector-collapsed class.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};
  Rga.Shell.Inspector = Rga.Shell.Inspector || {};

  // Registration is insertion-ordered (Map preserves insertion order).
  const _panels = new Map();
  const _listeners = new Set();
  let _currentId = null;
  let _host = null;
  // Captured at setHost time. The empty-state HTML the renderer ships
  // with (per renderer/index.html line ~397). Restored verbatim on
  // deactivate and on mount-error recovery so the inspector body never
  // ends up blank when no panel is active.
  let _emptyStateHtml = null;

  function setHost(el) {
    _host = el || null;
    // Capture the original empty-state markup ONCE (first non-null
    // setHost). A second setHost with a different element does not
    // re-capture — the renderer ships exactly one .inspector-body and
    // tests that re-mount it use _reset to start fresh.
    if (_host && _emptyStateHtml == null) {
      _emptyStateHtml = _host.innerHTML;
    }
  }

  function getHost() { return _host; }

  // Registration ----------------------------------------------------

  function registerPanel(controller) {
    if (!controller || typeof controller !== 'object') return false;
    if (typeof controller.id !== 'string' || controller.id.length === 0) return false;
    if (typeof controller.mount !== 'function') return false;
    if (_panels.has(controller.id)) return false;   // duplicate — reject (Sidebar parity)
    _panels.set(controller.id, controller);
    return true;
  }

  function unregisterPanel(id) {
    if (typeof id !== 'string' || !_panels.has(id)) return false;
    if (_currentId === id) deactivate();
    _panels.delete(id);
    return true;
  }

  function registered() {
    return Array.from(_panels.keys());
  }

  function getController(id) {
    if (typeof id !== 'string') return null;
    return _panels.get(id) || null;
  }

  // Lifecycle -------------------------------------------------------

  function activate(id, context) {
    const next = _panels.get(id);
    if (!next) return false;
    // Re-activation against the same id: re-mount with the latest
    // context. Same pattern Rga.Shell.Sidebar uses.
    if (_currentId === id) {
      _restoreHost();
      _safeMount(next, context);
      _notify(id, id);
      return true;
    }
    const prevId = _currentId;
    if (prevId) {
      const prev = _panels.get(prevId);
      _safeUnmount(prev);
    }
    _restoreHost();  // strip any prior content (empty-state or prior panel)
    _clearHost();    // then clear; the empty state is "default content",
                     // not the panel target.
    _safeMount(next, context);
    _currentId = id;
    _notify(id, prevId);
    return true;
  }

  function deactivate() {
    if (!_currentId) return false;
    const prevId = _currentId;
    const prev = _panels.get(prevId);
    _safeUnmount(prev);
    _restoreHost();   // empty-state back
    _currentId = null;
    _notify(null, prevId);
    return true;
  }

  function current() { return _currentId; }
  function isActive(id) { return _currentId === id; }

  // Applicability — called by future selection-driven code (F1A.5+).
  // F1A.3 exposes the helper but no internal consumer yet.
  function isApplicable(id, context) {
    const ctrl = _panels.get(id);
    if (!ctrl) return false;
    if (typeof ctrl.isApplicable !== 'function') return true;   // default
    try { return !!ctrl.isApplicable(context); }
    catch (err) {
      console.error('[Rga.Shell.Inspector] isApplicable threw for "' + id + '":', err);
      return false;
    }
  }

  // Subscriptions ---------------------------------------------------

  function onChange(fn) {
    if (typeof fn !== 'function') return function() {};
    _listeners.add(fn);
    return function unsubscribe() { _listeners.delete(fn); };
  }

  function _notify(newId, prevId) {
    _listeners.forEach(function(fn) {
      try { fn(newId, prevId); }
      catch (err) { console.error('[Rga.Shell.Inspector] listener threw:', err); }
    });
  }

  // Internals -------------------------------------------------------

  function _safeMount(controller, context) {
    if (!_host) return;
    if (!controller || typeof controller.mount !== 'function') return;
    try {
      controller.mount(_host, context);
    } catch (err) {
      console.error('[Rga.Shell.Inspector] mount threw for "' +
        controller.id + '":', err);
      // Restore the empty state so the body never ends up blank.
      _restoreHost();
    }
  }

  function _safeUnmount(controller) {
    if (!controller || typeof controller.unmount !== 'function') return;
    try {
      controller.unmount(_host);
    } catch (err) {
      console.error('[Rga.Shell.Inspector] unmount threw for "' +
        controller.id + '":', err);
    }
  }

  function _clearHost() {
    if (_host) _host.innerHTML = '';
  }

  function _restoreHost() {
    if (!_host) return;
    if (_emptyStateHtml == null) return;   // setHost never ran
    _host.innerHTML = _emptyStateHtml;
  }

  // Test helper. Drops everything and forgets the empty-state snapshot
  // so the next setHost re-captures from a fresh DOM.
  function _reset() {
    if (_currentId) {
      const c = _panels.get(_currentId);
      _safeUnmount(c);
    }
    _panels.clear();
    _listeners.clear();
    _currentId = null;
    _host = null;
    _emptyStateHtml = null;
  }

  Rga.Shell.Inspector.setHost          = setHost;
  Rga.Shell.Inspector.getHost          = getHost;
  Rga.Shell.Inspector.registerPanel    = registerPanel;
  Rga.Shell.Inspector.unregisterPanel  = unregisterPanel;
  Rga.Shell.Inspector.registered       = registered;
  Rga.Shell.Inspector.getController    = getController;
  Rga.Shell.Inspector.activate         = activate;
  Rga.Shell.Inspector.deactivate       = deactivate;
  Rga.Shell.Inspector.current          = current;
  Rga.Shell.Inspector.isActive         = isActive;
  Rga.Shell.Inspector.isApplicable     = isApplicable;
  Rga.Shell.Inspector.onChange         = onChange;
  Rga.Shell.Inspector._reset           = _reset;
})();
