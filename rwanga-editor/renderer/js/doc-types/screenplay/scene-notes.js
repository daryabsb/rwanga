// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.SceneNotes — Filmustageation F1A.5 + SN-Helper-2.
//
// Single shared source for per-scene notes + "current scene" tracking.
// Owned by the screenplay plugin (scenes are a screenplay-specific
// concept); CORE shell modules consume this via the documented public
// API.
//
// SN-Helper-2 (.rga memory integrity): scene-level note text is now
// PERSISTED into the active document's `scene.attrs.notes` PM attr via
// a setNodeMarkup transaction. The editor's dispatchTransaction wrapper
// (renderer/js/editor/mount.js) detects docChanged and calls
// Rga.Doc.markDirty automatically, which triggers autosave + flips the
// tab's dirty indicator. On a fresh reload, get() reads the persisted
// attr from the active PM doc so the textarea hydrates from disk.
//
// Pre-F1A.5 surface:
//   shell/studio-panel.js owned a private _notesBySceneId map AND
//   walked the editor DOM looking for `data-block-type="scene-header"`.
//   The defensive Rga.SceneManager dual-write in that file was dead
//   code (no module defined SceneManager). Notes existed only in
//   memory and only inside studio-panel's closure.
//
// Post-F1A.5 surface:
//   The data + change-notification live here, in the screenplay plugin
//   where scenes belong. Two surfaces read/write through this module:
//     1. The bottom-panel Scene Notes textarea (studio-panel.js, still
//        the canonical CORE-side notes UI today).
//     2. The inspector panel registered by inspector-scene-notes.js
//        (new in F1A.5, also screenplay-owned).
//   studio-panel.js's DOM-walk now publishes "current scene" changes
//   to this module instead of using a private map.
//
// API:
//   Rga.SceneNotes.get(sceneId) → string
//     Reads from the active doc's scene.attrs.notes when available;
//     falls back to the in-memory scratchpad when no view / no scene.
//   Rga.SceneNotes.set(sceneId, value) → void  (notifies subscribers)
//     Writes to scene.attrs.notes via setNodeMarkup AND updates the
//     in-memory scratchpad. Idempotent on equal value.
//   Rga.SceneNotes.currentSceneId() → string | null
//   Rga.SceneNotes.currentSceneName() → string | null
//   Rga.SceneNotes.setCurrentScene(sceneId, sceneName) → void  (notifies)
//   Rga.SceneNotes.subscribe(fn) → unsubscribe
//   Rga.SceneNotes._reset()  — test helper
//
// Notification shape — every change dispatches (event, payload):
//   ('notes',   { sceneId, value })
//   ('current', { sceneId, sceneName })
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // sceneId → notes string. SN-Helper-2: this is now a graceful-degrade
  // SCRATCHPAD, not the source of truth. The persisted store is the
  // active document's scene.attrs.notes attribute (see set()/get()).
  // The scratchpad is used when no editor view is available (boot,
  // tests, between tab switches) and for unknown sceneIds that don't
  // map to a real scene node.
  const _notes = Object.create(null);
  let _currentSceneId = null;
  let _currentSceneName = null;
  const _listeners = new Set();

  // SN-Helper-2 — resolve the active editor view (when one exists).
  // The view is the surface where the persisted scene.attrs.notes lives;
  // tests + boot paths that have no TabManager get null and the
  // module falls back to in-memory behaviour.
  function _activeView() {
    if (typeof window === 'undefined' || !window.Rga) return null;
    const TM = window.Rga.TabManager;
    if (!TM || typeof TM._editorView !== 'function') return null;
    return TM._editorView();
  }

  // SN-Helper-2 — locate a scene node by stable id within the doc.
  // Returns { node, pos } or null. Inline to avoid pulling Rga.Nav into
  // this module's runtime dependency surface (Rga.Nav.findScene returns
  // pos only; we also need the node for its current attrs).
  function _findScene(doc, sceneId) {
    if (!doc || !sceneId || typeof doc.descendants !== 'function') return null;
    let result = null;
    doc.descendants(function(node, pos) {
      if (result) return false;
      if (node.type && node.type.name === 'scene'
          && node.attrs && String(node.attrs.id) === String(sceneId)) {
        result = { node: node, pos: pos };
        return false;
      }
      return true;
    });
    return result;
  }

  function get(sceneId) {
    if (typeof sceneId !== 'string' || sceneId.length === 0) return '';
    // SN-Helper-2: prefer the persisted scene.attrs.notes as source of
    // truth. Re-checking the doc on every get() also guards against
    // external PM mutations (undo, file reload, programmatic edits)
    // silently desyncing the in-memory scratchpad.
    const view = _activeView();
    if (view && view.state && view.state.doc) {
      const found = _findScene(view.state.doc, sceneId);
      if (found && found.node.attrs && typeof found.node.attrs.notes === 'string') {
        return found.node.attrs.notes;
      }
    }
    // Fallback: scratchpad (graceful-degrade for no-view + unknown-scene
    // contexts). Lost on reload — the persisted attr is the durable copy.
    const v = _notes[sceneId];
    return typeof v === 'string' ? v : '';
  }

  function set(sceneId, value) {
    if (typeof sceneId !== 'string' || sceneId.length === 0) return;
    const v = typeof value === 'string' ? value : String(value || '');

    // SN-Helper-2: idempotence is now PM-anchored. The current value is
    // whatever the persisted scene.attrs.notes holds (when a view +
    // scene exist) or the scratchpad fallback (otherwise). If v already
    // equals the current value, this is a true no-op — no transaction,
    // no scratchpad write, no subscriber notify.
    const view = _activeView();
    const found = (view && view.state)
      ? _findScene(view.state.doc, sceneId)
      : null;
    const currentInPm = (found && found.node.attrs && typeof found.node.attrs.notes === 'string')
      ? found.node.attrs.notes
      : null;
    const currentInMem = (typeof _notes[sceneId] === 'string') ? _notes[sceneId] : null;
    const currentValue = (currentInPm != null) ? currentInPm : currentInMem;
    if (currentValue === v) return;

    // Persist to scene.attrs.notes via a PM transaction when possible.
    // The editor's dispatchTransaction wrapper (mount.js) detects
    // docChanged and calls Rga.Doc.markDirty → autosave + tab dirty.
    if (found && view && view.dispatch && currentInPm !== v) {
      try {
        const newAttrs = Object.assign({}, found.node.attrs, { notes: v });
        const tr = view.state.tr.setNodeMarkup(found.pos, null, newAttrs);
        view.dispatch(tr);
      } catch (err) {
        console.error('[Rga.SceneNotes] setNodeMarkup threw:', err);
      }
    }

    _notes[sceneId] = v;
    _notify('notes', { sceneId: sceneId, value: v });
  }

  function currentSceneId() { return _currentSceneId; }
  function currentSceneName() { return _currentSceneName; }

  function setCurrentScene(sceneId, sceneName) {
    const nextId = (typeof sceneId === 'string' && sceneId.length > 0) ? sceneId : null;
    // When the scene is cleared we normalise the name to null too so
    // the "fresh boot" state and the "cleared" state are identical.
    // When the scene is set, sceneName defaults to '' to avoid leaking
    // a stale name from a prior scene.
    const nextName = (nextId == null)
      ? null
      : (typeof sceneName === 'string' ? sceneName : '');
    if (_currentSceneId === nextId && _currentSceneName === nextName) return;
    _currentSceneId = nextId;
    _currentSceneName = nextName;
    _notify('current', { sceneId: _currentSceneId, sceneName: _currentSceneName });
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function() {};
    _listeners.add(fn);
    return function unsubscribe() { _listeners.delete(fn); };
  }

  function _notify(event, payload) {
    _listeners.forEach(function(fn) {
      try { fn(event, payload); }
      catch (err) { console.error('[Rga.SceneNotes] listener threw:', err); }
    });
  }

  function _reset() {
    Object.keys(_notes).forEach(function(k) { delete _notes[k]; });
    _currentSceneId = null;
    _currentSceneName = null;
    _listeners.clear();
  }

  Rga.SceneNotes = {
    get:               get,
    set:               set,
    currentSceneId:    currentSceneId,
    currentSceneName:  currentSceneName,
    setCurrentScene:   setCurrentScene,
    subscribe:         subscribe,
    _reset:            _reset
  };
})();
