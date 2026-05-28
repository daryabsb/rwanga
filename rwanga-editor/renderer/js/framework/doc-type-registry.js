// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Doc-type registry. Each doc-type module (screenplay, novel, theatre, …)
// calls Rga.DocTypes.register(name, config) at script-tag load time.
// mount.js / doc.js read the active document's documentType and look up
// its config to compose the outer schema, attach NodeViews, etc.
//
// Recognised config fields (Filmustageation F1A.2, 2026-05-28):
//   selectSchema(parsed)    — returns the PM Schema for a given parsed
//                             .rga (today the only required field).
//   defaultSidebarPanel     — optional string. The boot-time default
//                             sidebar panel for documents of this type.
//                             Read by Rga.Shell.init when no persisted
//                             panel exists. The CORE Layout no longer
//                             names a default; ownership moved to the
//                             doc-type so future plugins (novel,
//                             research, proposal, …) can declare their
//                             own without touching the shell.
//
// Additional fields a doc-type chooses to expose are preserved as-is;
// the registry never strips unknown keys.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const _registry = Object.create(null);
  // Insertion-order list of registered names so bootDefaultSidebarPanel
  // is deterministic even if the host JS engine reorders Object.keys
  // (modern engines preserve string-key order, but the array makes the
  // contract explicit and trivially testable).
  const _order = [];

  function register(name, config) {
    if (typeof name !== 'string' || !name) {
      throw new Error('DocTypes.register: name must be a non-empty string');
    }
    if (!config || typeof config !== 'object') {
      throw new Error('DocTypes.register: config must be an object');
    }
    if (_registry[name]) {
      throw new Error('DocTypes.register: "' + name + '" is already registered');
    }
    _registry[name] = config;
    _order.push(name);
  }

  function get(name) {
    if (!_registry[name]) {
      throw new Error('DocTypes.get: unknown doc-type "' + name + '"');
    }
    return _registry[name];
  }

  function has(name) {
    return !!_registry[name];
  }

  // Read parsed.document_type with a sensible default. Preserves unknown
  // document types verbatim (returns whatever string the file claims) —
  // the caller decides whether to accept or refuse. Default: 'screenplay'.
  function detect(parsed) {
    if (!parsed || typeof parsed !== 'object') return 'screenplay';
    const dt = parsed.document_type;
    if (typeof dt === 'string' && dt.length > 0) return dt;
    return 'screenplay';
  }

  // Delegate schema selection to the registered config's selectSchema(parsed)
  // hook. Each doc-type owns its schema choice — screenplay returns its v3
  // schema; future doc-types (stage play, TV template) return theirs.
  // Returns null when the config exposes no selectSchema hook (which is
  // unsupported in Phase 9+ — every doc-type must opt in to a schema).
  // Throws for unknown doc-types — by design, so callers find out
  // immediately if a file claims an unsupported document_type.
  function selectSchema(parsed) {
    const name = detect(parsed);
    const config = _registry[name];
    if (!config) {
      throw new Error('DocTypes.selectSchema: unknown doc-type "' + name + '"');
    }
    if (typeof config.selectSchema !== 'function') return null;
    return config.selectSchema(parsed);
  }

  // F1A.2 — Editor / Platform boundary doctrine §3 (and the Phase 1A
  // audit's "Sidebar default per doc-type" slice). CORE Layout no longer
  // hardcodes a default sidebar panel; ownership lives on the doc-type
  // registration. This helper returns the boot-time default by walking
  // the registry in insertion order and returning the first non-empty
  // defaultSidebarPanel string. With only the screenplay plugin loaded
  // today, this returns 'sceneNavigator'. When a second plugin (novel,
  // research, …) loads alongside screenplay, the first-registered wins;
  // future slices may introduce richer resolution (e.g. by active doc-
  // type) without changing CORE Layout's neutral default.
  function bootDefaultSidebarPanel() {
    for (let i = 0; i < _order.length; i += 1) {
      const cfg = _registry[_order[i]];
      if (cfg && typeof cfg.defaultSidebarPanel === 'string'
          && cfg.defaultSidebarPanel.length > 0) {
        return cfg.defaultSidebarPanel;
      }
    }
    return null;
  }

  // F1A.2 — returns the registered insertion order. Exposed for tests
  // and for the boot-default resolver; never mutated.
  function registered() {
    return _order.slice();
  }

  Rga.DocTypes = {
    register:                register,
    get:                      get,
    has:                      has,
    detect:                   detect,
    selectSchema:             selectSchema,
    bootDefaultSidebarPanel:  bootDefaultSidebarPanel,
    registered:               registered
  };
})();
