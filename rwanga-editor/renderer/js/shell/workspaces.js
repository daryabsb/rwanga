// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Workspaces — registry for workspace-kind tabs (Shell Doctrine).
// A workspace is an app-provided pane that shares the tab bar with
// document tabs but is not file-backed: Settings, Welcome, Logs,
// Account, Updates, etc. TabManager.openWorkspace(kind) queries this
// registry to resolve mount / unmount + metadata.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const _registry = new Map();

  // Registration shape:
  //   {
  //     kind:             string  — stable id (e.g. 'settings', 'hello-world')
  //     title:            string  — tab title
  //     icon:             ?string — optional icon glyph / svg / name
  //     restoreOnSession: ?bool   — default false; opt-in to session restore
  //     mount:            (el)=>void — render the workspace into `el`
  //     unmount:          ?(el)=>void — tear down (optional)
  //   }
  function register(spec) {
    if (!spec || typeof spec.kind !== 'string' || typeof spec.mount !== 'function') {
      console.warn('[Rga.Workspaces.register] invalid spec', spec);
      return;
    }
    _registry.set(spec.kind, {
      kind:             spec.kind,
      title:            spec.title || spec.kind,
      icon:             spec.icon || null,
      restoreOnSession: !!spec.restoreOnSession,
      mount:            spec.mount,
      unmount:          typeof spec.unmount === 'function' ? spec.unmount : null
    });
  }

  function get(kind) {
    return _registry.get(kind) || null;
  }

  function registered() {
    return Array.from(_registry.keys());
  }

  function _reset() {
    _registry.clear();
  }

  Rga.Workspaces = { register, get, registered, _reset };
})();
