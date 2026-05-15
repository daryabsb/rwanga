// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Doc-type registry. Each doc-type module (screenplay, novel, theatre, …)
// calls Rga.DocTypes.register(name, config) at script-tag load time.
// mount.js / doc.js read the active document's documentType and look up
// its config to compose the outer schema, attach NodeViews, etc.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const _registry = Object.create(null);

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

  Rga.DocTypes = { register: register, get: get, has: has };
})();
