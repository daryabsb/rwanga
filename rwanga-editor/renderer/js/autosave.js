// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Autosave — background recovery snapshots (Persistence Safety Contract §4).
// Owns the per-document debounce / max-interval timers and the snapshot writes.
// It does NOT recover or restore — that is Brick 4.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const C = Rga.Constants || {};
  const DEBOUNCE_MS = C.AUTOSAVE_DEBOUNCE_MS || 2000;
  const DEFAULT_MAX_INTERVAL_MS = C.AUTOSAVE_MAX_INTERVAL_MS || 10000;
  const SCHEMA_VERSION = 1;

  // docId -> { lastSnapshotAt: number, debounceTimer: timerId|null }
  const _state = new Map();

  // S9.1 — Settings-driven gates.
  //   _enabled       — when false, notifyChange short-circuits; no
  //                    snapshots written, no debounce armed. Persists
  //                    via the `autosave.enabled` Store entry.
  //   _maxIntervalMs — max-interval ceiling. Persists via the
  //                    `autosave.interval` Store entry (seconds, the
  //                    applicator converts to ms here).
  let _enabled = true;
  let _maxIntervalMs = DEFAULT_MAX_INTERVAL_MS;

  // Sync the latest editor content into doc.body before serializing — only for
  // the active document (its live edits are in the EditorView, not doc.body).
  function _capture(doc) {
    const TM = Rga.TabManager;
    if (!TM || typeof TM._editorView !== 'function') return;
    const view = TM._editorView();
    if (view && typeof TM.activeDoc === 'function' && TM.activeDoc() === doc) {
      doc.body = view.state.doc;
    }
  }

  function _writeSnapshot(doc) {
    if (!window.rwanga || !window.rwanga.autosave
        || typeof window.rwanga.autosave.write !== 'function') return;
    if (!Rga.Doc || typeof Rga.Doc.serialize !== 'function') return;
    const envelope = {
      schemaVersion: SCHEMA_VERSION,
      savedAt: Date.now(),
      baseHandle: doc.handle || null,
      baseDisplayName: doc.displayName,
      baseSavedAt: doc.lastSavedAt || null,
      rga: Rga.Doc.serialize(doc)
    };
    window.rwanga.autosave.write(doc.docId, envelope);
  }

  function _armDebounce(doc, st) {
    if (st.debounceTimer) clearTimeout(st.debounceTimer);
    st.debounceTimer = setTimeout(function() {
      st.debounceTimer = null;
      _writeSnapshot(doc);
      st.lastSnapshotAt = Date.now();
    }, DEBOUNCE_MS);
  }

  // Called by Rga.Doc.markDirty on every document-changing edit.
  function notifyChange(doc) {
    if (!doc || !doc.docId) return;
    // S9.1 gate: when autosave.enabled is false, drop the notification
    // entirely. No capture, no snapshot, no debounce. This preserves
    // the existing per-doc state map untouched so re-enabling autosave
    // resumes from the same point.
    if (!_enabled) return;
    _capture(doc);
    const id = doc.docId;
    const st = _state.get(id);
    const now = Date.now();
    if (!st) {
      // CLEAN -> DIRTY: write the immediate seed snapshot; no debounce yet.
      _writeSnapshot(doc);
      _state.set(id, { lastSnapshotAt: now, debounceTimer: null });
      return;
    }
    // Already dirty: enforce the max interval, then (re)arm the debounce.
    if (now - st.lastSnapshotAt >= _maxIntervalMs) {
      _writeSnapshot(doc);
      st.lastSnapshotAt = now;
    }
    _armDebounce(doc, st);
  }

  // Called by Rga.Doc.clearDirty on a successful manual save.
  function notifyClean(doc) {
    if (!doc || !doc.docId) return;
    const id = doc.docId;
    const st = _state.get(id);
    if (st && st.debounceTimer) clearTimeout(st.debounceTimer);
    _state.delete(id);
    if (window.rwanga && window.rwanga.autosave
        && typeof window.rwanga.autosave.discard === 'function') {
      window.rwanga.autosave.discard(id);
    }
  }

  function _reset() {
    _state.forEach(function(st) { if (st.debounceTimer) clearTimeout(st.debounceTimer); });
    _state.clear();
    _enabled = true;
    _maxIntervalMs = DEFAULT_MAX_INTERVAL_MS;
  }

  // S9.1 — Settings-driven control points. Both are called by the
  // `autosave.enabled` and `autosave.interval` applicators in
  // shell-applicators.js; they are also safe to call from tests.
  function setEnabled(v) {
    _enabled = !!v;
  }
  function setInterval(seconds) {
    // Defensive: any non-positive number falls back to the registry
    // default (30 seconds) to match the applicator's clamp.
    const s = (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0)
      ? Math.floor(seconds)
      : 30;
    _maxIntervalMs = s * 1000;
  }

  Rga.Autosave = {
    notifyChange, notifyClean,
    setEnabled, setInterval,
    _reset,
    _state: _state,
    // Read-only views for tests / debug overlays.
    _isEnabled: function() { return _enabled; },
    _maxIntervalMs: function() { return _maxIntervalMs; }
  };
})();
