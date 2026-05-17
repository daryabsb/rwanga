// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.WorkspaceState — the single owner of layout persistence.
//
// Runtime Ownership Stabilization Slice 4 §A resolved OI-3 by
// introducing this module. Layout state (sidebar / studioPanel /
// inspector / titleBar / statusBar — visibility, width, height,
// activePanel) is now stored as a single workspace blob in one
// localStorage key. Read on boot, written on every Layout change.
//
// Boot order requirement: WorkspaceState.init() MUST run before any
// other Layout consumer subscribes (BottomPanel, Resize sync) so the
// hydration happens before the first DOM-paint Layout.subscribe
// callback. The init script in index.html enforces this order.
//
// Legacy migration: Slice 1 introduced a scoped key
// `rga-shell-studio-panel-visible` for bottom panel visibility only.
// On first WorkspaceState.init() after upgrade, that scoped value is
// read into the workspace blob, written under the canonical key, and
// the scoped key is removed. Subsequent boots see no scoped key.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};

  const STORAGE_KEY = 'rga-workspace-layout';
  // Keys this module accepts as legacy input ONLY (never writes).
  // Each row: { key, hydrate(rawString) => partial Layout-shape blob, then localStorage.removeItem on success }.
  const LEGACY_MIGRATIONS = [
    {
      key: 'rga-shell-studio-panel-visible',
      hydrate: function(raw) {
        if (raw == null) return null;
        const visible = raw === '1' || raw === 'true';
        return { studioPanel: { visible: visible } };
      }
    }
  ];

  let _initialized = false;
  let _unsubscribeLayout = null;

  function init() {
    if (_initialized) return;
    _initialized = true;
    if (!Rga.Shell.Layout) return;
    _hydrate();
    // Subscribe to Layout AFTER hydration so the initial fromJSON
    // notify doesn't trigger a self-redundant save. (It still would,
    // but it'd be a no-op writing what we just read.)
    _unsubscribeLayout = Rga.Shell.Layout.subscribe(function(next, prev) {
      _save();
    });
  }

  function _hydrate() {
    let blob = _read();
    if (!blob) blob = _readLegacy();
    if (!blob) return;
    // Push the persisted snapshot into Layout. fromJSON validates +
    // notifies subscribers once.
    Rga.Shell.Layout.fromJSON(blob);
  }

  function _read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed;
    } catch (_) { return null; }
  }

  function _readLegacy() {
    // Collect every legacy key into a single blob, then delete each
    // scoped key. Write the merged blob immediately so we never read
    // a legacy key twice.
    let merged = null;
    for (let i = 0; i < LEGACY_MIGRATIONS.length; i += 1) {
      const rule = LEGACY_MIGRATIONS[i];
      let raw = null;
      try { raw = localStorage.getItem(rule.key); }
      catch (_) { continue; }
      if (raw == null) continue;
      const partial = rule.hydrate(raw);
      if (partial) {
        merged = _deepMerge(merged || {}, partial);
      }
      try { localStorage.removeItem(rule.key); } catch (_) {}
    }
    if (merged) {
      // Persist the merged blob so the next boot reads it cleanly.
      _save(merged);
    }
    return merged;
  }

  function _deepMerge(a, b) {
    const out = Object.assign({}, a);
    Object.keys(b).forEach(function(k) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])
          && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = _deepMerge(out[k], b[k]);
      } else {
        out[k] = b[k];
      }
    });
    return out;
  }

  function _save(explicitBlob) {
    let blob;
    if (explicitBlob != null) {
      blob = explicitBlob;
    } else {
      if (!Rga.Shell.Layout || typeof Rga.Shell.Layout.toJSON !== 'function') return;
      blob = Rga.Shell.Layout.toJSON();
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(blob)); }
    catch (_) { /* private mode / quota — silent. */ }
  }

  function _reset() {
    if (_unsubscribeLayout) { _unsubscribeLayout(); _unsubscribeLayout = null; }
    _initialized = false;
  }

  Rga.Shell.WorkspaceState = {
    init: init,
    _save: _save,
    _hydrate: _hydrate,
    _reset: _reset,
    _STORAGE_KEY: STORAGE_KEY,
    _LEGACY_KEYS: LEGACY_MIGRATIONS.map(function(r) { return r.key; })
  };
  // Top-level alias per the slice brief (`Rga.WorkspaceState`).
  Rga.WorkspaceState = Rga.Shell.WorkspaceState;
})();
