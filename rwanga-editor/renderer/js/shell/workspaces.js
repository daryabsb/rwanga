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

  // Chrome policy — per-workspace declaration of which editor-only
  // shell surfaces should be visible while the workspace tab is active.
  // Each field defaults to true (backward-compatible with workspaces
  // registered before the policy existed). TabManager.activate() reads
  // this off the registration to gate the targets:
  //   toolbar     → #rga-shell-toolbar  (Row 3 writing instruments)
  //   bottomPanel → #bottom-panel       (Scene/Notes/Flags/Problems/Breakdown)
  //   inspector   → #inspector-panel    (selection inspector)
  const CHROME_DEFAULTS = { toolbar: true, bottomPanel: true, inspector: true };

  function _normalizeChrome(input) {
    const out = Object.assign({}, CHROME_DEFAULTS);
    if (input && typeof input === 'object') {
      Object.keys(CHROME_DEFAULTS).forEach(function(k) {
        if (Object.prototype.hasOwnProperty.call(input, k)) out[k] = !!input[k];
      });
    }
    return out;
  }

  // Registration shape:
  //   {
  //     kind:             string  — stable id (e.g. 'settings', 'hello-world')
  //     title:            string  — tab title
  //     icon:             ?string — optional icon glyph / svg / name
  //     restoreOnSession: ?bool   — default false; opt-in to session restore
  //     chrome:           ?{ toolbar:bool, bottomPanel:bool, inspector:bool }
  //                       — per-workspace editor-chrome visibility; each
  //                         field defaults to true. Read by TabManager.
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
      chrome:           _normalizeChrome(spec.chrome),
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

  Rga.Workspaces = {
    register, get, registered, _reset,
    // Exposed for TabManager and tests; chrome consumers should always
    // read off a normalized registration (which is already merged with
    // CHROME_DEFAULTS) rather than reach for the constant directly.
    _CHROME_DEFAULTS: CHROME_DEFAULTS
  };
})();
