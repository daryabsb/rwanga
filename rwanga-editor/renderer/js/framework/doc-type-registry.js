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

  Rga.DocTypes = {
    register:     register,
    get:          get,
    has:          has,
    detect:       detect,
    selectSchema: selectSchema
  };
})();
