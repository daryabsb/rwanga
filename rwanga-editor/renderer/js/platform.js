// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Platform — Filmustageation F1A.1.
//
// Single consumer helper for the optional window.rwanga.platform
// namespace. The editor renderer is local-first by design: the platform
// host (Rwanga Preproduction Platform, web embeds, future hosts) is
// always optional. In standalone Electron — today's only build —
// window.rwanga.platform is undefined and EVERY consumer must short-
// circuit cleanly.
//
// Contract source of truth:
//   docs/filmustageation/EDITOR_VIEWPORT_PLATFORM_BOUNDARY_CONTRACT.md
//
// Guard pattern this helper standardises:
//
//   // Without helper:
//   if (window.rwanga && window.rwanga.platform &&
//       typeof window.rwanga.platform.shareScript === 'function') {
//     window.rwanga.platform.shareScript(doc);
//   }
//
//   // With helper:
//   if (Rga.Platform.has('shareScript')) {
//     Rga.Platform.invoke('shareScript', doc);
//   }
//
// The helper is intentionally minimal — no DI, no plugin registry, no
// caching. The platform shape is unspecified at v1; any consumer that
// reaches for Rga.Platform is reading-only, and absence is the default.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  function _platform() {
    const w = (typeof window !== 'undefined') ? window : null;
    if (!w || !w.rwanga) return null;
    const p = w.rwanga.platform;
    return (p && typeof p === 'object') ? p : null;
  }

  // has(feature?)
  //   has()                — true iff window.rwanga.platform exists at
  //                          all (any kind of platform host is present).
  //   has('share')         — true iff window.rwanga.platform.share is
  //                          defined (any truthy or zero value, including
  //                          a function or a primitive flag).
  //
  // Returns boolean. Never throws. Never logs.
  function has(feature) {
    const p = _platform();
    if (!p) return false;
    if (typeof feature !== 'string' || feature.length === 0) return true;
    return typeof p[feature] !== 'undefined';
  }

  // invoke(feature, ...args)
  //   Calls window.rwanga.platform[feature](...args) iff feature exists
  //   and is a function. Returns the call's return value, or undefined
  //   if the feature is absent or not callable. Wraps thrown errors so
  //   a platform-side bug never crashes the editor — errors are logged
  //   with the feature name and the call resolves to undefined.
  //
  // Consumers that need to distinguish "feature absent" from "feature
  // returned undefined" should call has(feature) first.
  function invoke(feature, ...args) {
    const p = _platform();
    if (!p || typeof feature !== 'string') return undefined;
    const fn = p[feature];
    if (typeof fn !== 'function') return undefined;
    try {
      return fn.apply(p, args);
    } catch (err) {
      console.error('[Rga.Platform] platform.' + feature + ' threw:', err);
      return undefined;
    }
  }

  // get(path)
  //   Read-only deep access on window.rwanga.platform. path is a
  //   dotted string ('user.id', 'collab.session'). Returns undefined
  //   on any missing segment. Never throws. The helper accepts a
  //   single segment too — get('user') is equivalent to has('user')
  //   ? platform.user : undefined.
  //
  // Why this exists: consumers should not chain `?.` against an
  // implicit `window.rwanga.platform` — every probe goes through this
  // helper so the boundary stays auditable (grep `Rga\.Platform\.`
  // finds every read site).
  function get(path) {
    if (typeof path !== 'string' || path.length === 0) return undefined;
    const p = _platform();
    if (!p) return undefined;
    const segments = path.split('.');
    let cur = p;
    for (let i = 0; i < segments.length; i += 1) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[segments[i]];
    }
    return cur;
  }

  Rga.Platform = {
    has:    has,
    invoke: invoke,
    get:    get,
    // Read-only sentinel for diagnostics / smoke tests. Returns the
    // raw platform object reference (or null). NOT for general use —
    // consumers should call has/invoke/get instead.
    _raw:   _platform
  };
})();
