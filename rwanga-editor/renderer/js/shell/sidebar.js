// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Shell.Sidebar — registry + host for sidebar panels.
//
// Mutually-exclusive: exactly one panel is active at a time. Same lifecycle
// pattern as Rga.ViewManager (engine layer). When a panel becomes active,
// its mount(container) is called with the sidebar host element. When it
// loses active status, its unmount() is called and the host is cleared.
//
// Panel controller shape (plan §3.2):
//   {
//     id:        string,          // unique
//     label:     string,          // human-readable; rail tooltip + a11y
//     icon:      string,          // emoji or HTML; slice 1 uses emoji
//     shortcut?: string,          // e.g. 'Cmd-Shift-S'
//     available: boolean,         // false → "Coming in v0.2" empty state
//     mount(container)            // called when panel becomes active
//     unmount()                   // called when panel becomes inactive
//   }
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};
  Rga.Shell.Sidebar = Rga.Shell.Sidebar || {};

  // Registration order is preserved (Map iteration order = insertion order).
  const _panels = new Map();
  const _listeners = new Set();
  let _currentId = null;
  let _host = null;

  function setHost(el) { _host = el; }
  function getHost() { return _host; }

  function registerPanel(controller) {
    if (!controller || typeof controller !== 'object') return false;
    if (typeof controller.id !== 'string' || !controller.id) return false;
    if (_panels.has(controller.id)) return false;
    _panels.set(controller.id, controller);
    return true;
  }

  function unregisterPanel(id) {
    if (_currentId === id) deactivate();
    _panels.delete(id);
  }

  function activate(id) {
    const next = _panels.get(id);
    if (!next) return false;
    // Re-activation: call mount again with no unmount (panels re-render
    // against fresh upstream state).
    if (_currentId === id) {
      _safeMount(next);
      _notify(id, id);
      return true;
    }
    const prevId = _currentId;
    if (prevId) {
      const prev = _panels.get(prevId);
      _safeUnmount(prev);
    }
    _clearHost();
    _safeMount(next);
    _currentId = id;
    _notify(id, prevId);
    return true;
  }

  function deactivate() {
    if (!_currentId) return;
    const prevId = _currentId;
    const prev = _panels.get(prevId);
    _safeUnmount(prev);
    _clearHost();
    _currentId = null;
    _notify(null, prevId);
  }

  function current() { return _currentId; }
  function isActive(id) { return _currentId === id; }
  function registered() { return Array.from(_panels.keys()); }
  function getController(id) { return _panels.get(id) || null; }

  function onChange(fn) {
    if (typeof fn !== 'function') return function() {};
    _listeners.add(fn);
    return function unsubscribe() { _listeners.delete(fn); };
  }

  function _reset() {
    if (_currentId) {
      const c = _panels.get(_currentId);
      _safeUnmount(c);
    }
    _clearHost();
    _panels.clear();
    _listeners.clear();
    _currentId = null;
    _host = null;
  }

  function _safeMount(c) {
    if (!c || typeof c.mount !== 'function') return;
    try { c.mount(_host); }
    catch (err) { console.error('[Rga.Shell.Sidebar] mount threw:', err); }
  }
  function _safeUnmount(c) {
    if (!c || typeof c.unmount !== 'function') return;
    try { c.unmount(); }
    catch (err) { console.error('[Rga.Shell.Sidebar] unmount threw:', err); }
  }
  function _clearHost() {
    if (_host) _host.innerHTML = '';
  }
  function _notify(newId, prevId) {
    _listeners.forEach(function(fn) {
      try { fn(newId, prevId); }
      catch (err) { console.error('[Rga.Shell.Sidebar] listener threw:', err); }
    });
  }

  Rga.Shell.Sidebar.setHost        = setHost;
  Rga.Shell.Sidebar.getHost        = getHost;
  Rga.Shell.Sidebar.registerPanel  = registerPanel;
  Rga.Shell.Sidebar.unregisterPanel= unregisterPanel;
  Rga.Shell.Sidebar.activate       = activate;
  Rga.Shell.Sidebar.deactivate     = deactivate;
  Rga.Shell.Sidebar.current        = current;
  Rga.Shell.Sidebar.isActive       = isActive;
  Rga.Shell.Sidebar.registered     = registered;
  Rga.Shell.Sidebar.getController  = getController;
  Rga.Shell.Sidebar.onChange       = onChange;
  Rga.Shell.Sidebar._reset         = _reset;
})();
