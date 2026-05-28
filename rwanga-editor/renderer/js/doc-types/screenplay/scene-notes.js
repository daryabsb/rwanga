// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.SceneNotes — Filmustageation F1A.5.
//
// Single shared source for per-scene notes + "current scene" tracking.
// Owned by the screenplay plugin (scenes are a screenplay-specific
// concept); CORE shell modules consume this via the documented public
// API.
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
//   Rga.SceneNotes.set(sceneId, value) → void  (notifies subscribers)
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

  // sceneId → notes string. In-memory only at v1; future slice may
  // bridge to the screenplay doc-type's .rga serialization.
  const _notes = Object.create(null);
  let _currentSceneId = null;
  let _currentSceneName = null;
  const _listeners = new Set();

  function get(sceneId) {
    if (typeof sceneId !== 'string' || sceneId.length === 0) return '';
    const v = _notes[sceneId];
    return typeof v === 'string' ? v : '';
  }

  function set(sceneId, value) {
    if (typeof sceneId !== 'string' || sceneId.length === 0) return;
    const v = typeof value === 'string' ? value : String(value || '');
    if (_notes[sceneId] === v) return;   // no-op on equal value
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
