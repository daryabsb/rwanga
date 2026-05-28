// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Screenplay plugin — Scene Notes inspector panel (Filmustageation F1A.5).
//
// First production consumer of the F1A.3 inspector host. Registers a
// screenplay-owned contextual panel that displays the current scene's
// notes. The panel:
//
//   - reads/writes via Rga.SceneNotes (the shared screenplay source,
//     also consumed by the bottom-panel Scene tab)
//   - subscribes to Rga.SceneNotes change events so notes written from
//     ANY surface (bottom panel, this inspector, future surfaces)
//     reflect immediately
//   - declares isApplicable(context) so a future selection-driven
//     activation flow knows when the panel makes sense (cursor in a
//     scene → applicable)
//   - is NEVER auto-activated — the F1A.5 brief requires invocation-
//     based open. Today no production module calls activate; the
//     panel is reachable only via Rga.Shell.Inspector.activate from
//     a future UI surface (right-click → Inspect, rail button, or
//     keyboard shortcut)
//
// Visible behaviour: a calm label + textarea, identical functionally
// to the bottom-panel Scene tab. Layout is minimal — the brief forbids
// new note UI design beyond what is necessary.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Shell || !Rga.Shell.Inspector
      || typeof Rga.Shell.Inspector.registerPanel !== 'function') {
    // Inspector host loads BEFORE doc-types/screenplay/* in renderer/
    // index.html, so this branch only fires in stripped-down test
    // scaffolding. Bail silently — tests that need the panel must load
    // both files in the right order.
    return;
  }
  if (!Rga.SceneNotes
      || typeof Rga.SceneNotes.subscribe !== 'function') {
    // Same — the shared source must exist before the panel registers.
    return;
  }

  const NS = window.Rga;   // capture once for closures below

  // Mount the contextual scene-notes UI into the inspector body.
  // Returns a cleanup function that the inspector host calls on
  // deactivate / unregister / a thrown re-mount.
  function _mount(container, /* context */) {
    // Clear the empty-state markup the host captured at boot — the
    // inspector module restores it on deactivate via the captured
    // snapshot, so we don't need to preserve it ourselves.
    container.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'rga-inspector-scene-notes';
    container.appendChild(root);

    const label = document.createElement('div');
    label.className = 'rga-inspector-scene-notes-label';
    root.appendChild(label);

    const textarea = document.createElement('textarea');
    textarea.className = 'rga-inspector-scene-notes-textarea';
    textarea.setAttribute('placeholder', 'Add notes for this scene…');
    textarea.setAttribute('aria-label', 'Scene notes');
    root.appendChild(textarea);

    // Last seen scene id — guards against echoing the value back from
    // the same surface we just wrote (input → set → notify → input
    // listener fires twice → cursor jumps). When the change event
    // mentions a sceneId we already painted with the same text we
    // skip the re-render.
    let _renderedSceneId = null;
    let _renderedText = null;

    function _renderForCurrentScene() {
      const sceneId = NS.SceneNotes.currentSceneId();
      const sceneName = NS.SceneNotes.currentSceneName();
      if (sceneId == null) {
        label.textContent = 'Scene Notes — no scene selected';
        textarea.value = '';
        textarea.disabled = true;
        _renderedSceneId = null;
        _renderedText = null;
        return;
      }
      label.textContent = 'Scene Notes — Scene ' + (sceneName || sceneId);
      textarea.disabled = false;
      const v = NS.SceneNotes.get(sceneId);
      // Only write into textarea when it doesn't already match the
      // stored value — avoids cursor jumps when the change event
      // round-trips from our own typing.
      if (textarea.value !== v) textarea.value = v;
      _renderedSceneId = sceneId;
      _renderedText = v;
    }

    _renderForCurrentScene();

    // Inbound — subscribe to the shared source so external writes
    // (bottom panel, future surfaces) reflect here.
    const unsubscribe = NS.SceneNotes.subscribe(function(event, payload) {
      if (event === 'current') {
        _renderForCurrentScene();
        return;
      }
      if (event === 'notes' && payload && payload.sceneId === _renderedSceneId) {
        if (textarea.value !== payload.value) {
          textarea.value = payload.value;
          _renderedText = payload.value;
        }
      }
    });

    // Outbound — debounce writes (mirror the bottom panel's 300ms).
    const debouncer = _debounce(function() {
      const sceneId = NS.SceneNotes.currentSceneId();
      if (sceneId == null) return;
      NS.SceneNotes.set(sceneId, textarea.value);
      _renderedSceneId = sceneId;
      _renderedText = textarea.value;
    }, 300);
    textarea.addEventListener('input', debouncer);

    // The cleanup function tearing down listeners + subscription. The
    // inspector host's restore-empty-state path repaints the captured
    // markup, so we don't need to clear our DOM here — the host does.
    return function _unmount() {
      try { unsubscribe(); }
      catch (err) { console.error('[inspector-scene-notes] unsubscribe threw:', err); }
      textarea.removeEventListener('input', debouncer);
    };
  }

  // Tiny local debounce — avoids a hard dependency on Rga.debounce
  // (which lives in utils.js and may not have loaded yet under some
  // test scaffolding).
  function _debounce(fn, ms) {
    let t = null;
    return function debounced() {
      const ctx = this, args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function() { t = null; fn.apply(ctx, args); }, ms);
    };
  }

  // Capture the cleanup returned by _mount so unmount() can run it.
  // The inspector host's lifecycle calls mount(container, context) on
  // activate and unmount(container) on deactivate. We bridge by
  // stashing the cleanup on the controller closure.
  let _activeCleanup = null;

  Rga.Shell.Inspector.registerPanel({
    id:        'scene-notes',
    label:     'Scene Notes',
    isApplicable: function(/* context */) {
      // Applicable iff there IS a current scene. The future
      // selection-driven activation flow (post-F1A.5) consults this.
      return NS.SceneNotes && typeof NS.SceneNotes.currentSceneId === 'function'
        ? NS.SceneNotes.currentSceneId() != null
        : false;
    },
    mount: function(container, context) {
      _activeCleanup = _mount(container, context);
    },
    unmount: function(/* container */) {
      if (typeof _activeCleanup === 'function') {
        try { _activeCleanup(); }
        catch (err) { console.error('[inspector-scene-notes] cleanup threw:', err); }
      }
      _activeCleanup = null;
    }
  });
})();
