// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Shell.StudioPanel — single owner of the bottom-panel + inspector
// surfaces.
//
// Runtime Ownership Stab. Slice 9 §A. Consolidates three previously-
// separate modules (Rga.BottomPanel, Rga.Inspector,
// Rga.SceneNotesConnector) into one shell-side SSOT:
//
//   • Panel visibility       (delegates to Layout.studioPanel.visible)
//   • Active tab              (now persisted via Layout.studioPanel.activeTab —
//                              pre-Slice-9 this field existed but nothing
//                              wrote it, so the active tab was lost on
//                              reload. StudioPanel.switchTo writes it now.)
//   • Notes surface           (the per-scene notes textarea)
//   • Inspector routing       (open / toggle of the right-rail inspector)
//   • Scene notes routing     (cursor scene → notes textarea wiring,
//                              folded in from the dead Rga.SceneNotesConnector)
//
// Closes Compatibility Inventory entry #5.
//
// Compatibility — the public APIs engine plugins (off-limits) depend on
// are preserved by thin shims in app-shell.js that delegate here:
//   Rga.BottomPanel.switchTo('notes' | 'flags' | ...)  →  StudioPanel.switchTo
//   Rga.BottomPanel.toggleCollapse()                   →  StudioPanel.toggle
//   Rga.BottomPanel.open()                             →  StudioPanel.show
//   Rga.BottomPanel.init()                             →  StudioPanel.init
//   Rga.Inspector.toggle()                             →  StudioPanel.toggleInspector
//   #inspector-reopen click (Responsive Shell Phase 2) →  StudioPanel.openInspector
//   Rga.Inspector.open()                               →  StudioPanel.openInspector  (new — was undocumented no-op pre-Slice-9)
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};

  let _initialized = false;
  let _unsubLayout = null;
  // F1A.5 — scene-notes state moved to Rga.SceneNotes
  // (doc-types/screenplay/scene-notes.js). StudioPanel now holds only
  // the subscription handle so _reset can detach cleanly.
  let _sceneNotesUnsub = null;

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------

  function init() {
    if (_initialized) return;
    _initialized = true;
    _wireTabs();
    _wireCloseButton();
    _wireKeyboardShortcut();
    _wireSceneNotesConnector();
    _wireInspectorToggle();
    _initLayoutSync();
  }

  function _initLayoutSync() {
    if (!Rga.Shell || !Rga.Shell.Layout) return;
    // First-paint sync: read whatever Layout has now (after
    // WorkspaceState hydrated it from rga-workspace-layout) and
    // reflect to DOM.
    const layoutSnap = Rga.Shell.Layout.get();
    _syncStateFromLayout(_resolveState(layoutSnap.studioPanel));
    // Restore the persisted active tab if Layout has one. Pre-Slice-9
    // the field was never written; post-Slice-9 it's the SSOT.
    if (layoutSnap.studioPanel.activeTab) {
      _renderActiveTab(layoutSnap.studioPanel.activeTab);
    }
    _unsubLayout = Rga.Shell.Layout.subscribe(function(next, prev) {
      if (!next || !next.studioPanel) return;
      if (prev && prev.studioPanel) {
        const prevState = _resolveState(prev.studioPanel);
        const nextState = _resolveState(next.studioPanel);
        if (prevState !== nextState) {
          _syncStateFromLayout(nextState);
        }
        if (prev.studioPanel.activeTab !== next.studioPanel.activeTab && next.studioPanel.activeTab) {
          _renderActiveTab(next.studioPanel.activeTab);
        }
      }
    });
  }

  // Studio Shell Recovery §E: derive the canonical 3-state from a
  // studioPanel zone snapshot. Tolerates pre-§E snapshots that only
  // had .visible — same migration as the Layout fromJSON path.
  function _resolveState(zone) {
    if (!zone) return 'open';
    if (zone.state === 'open' || zone.state === 'minimized' || zone.state === 'closed') {
      return zone.state;
    }
    if (zone.visible === false) return 'closed';
    return 'open';
  }

  // ----------------------------------------------------------------
  // Three-state model — Studio Shell Recovery §E
  //   OPEN       full panel visible (header + body)
  //   MINIMIZED  header/tab strip visible, body collapsed
  //   CLOSED     panel fully hidden
  //
  // State lives in Layout.studioPanel.state (single SSOT). Backward-
  // compat field .visible is auto-maintained by Layout.set; existing
  // readers of `.visible` still see the right boolean.
  // ----------------------------------------------------------------

  function show() {
    _setState('open');
  }

  function hide() {
    _setState('closed');
  }

  function minimize() {
    _setState('minimized');
  }

  function restore() {
    _setState('open');
  }

  // Keyboard / View-menu toggle (Ctrl+J / Ctrl+`):
  //   open      → closed  (hide the panel)
  //   minimized → open    (restore in one keystroke — the user
  //                        already minimized the panel, the
  //                        toggle now treats minimized as
  //                        "needs restoring" instead of "needs
  //                        further hiding")
  //   closed    → open    (show the panel)
  //
  // Previous §E behaviour mapped minimized → closed, which forced
  // users to press the shortcut TWICE to bring the panel back from
  // a minimized state (minimized → closed → open). The user-
  // reported regression was: "after minimize you have to open twice
  // to see it again." The new mapping treats minimized as a hidden-
  // ish state for toggle purposes — same UX as VS Code / Cursor
  // where Ctrl+J always brings the panel back from any non-open
  // state.
  function toggle() {
    const cur = _currentState();
    _setState(cur === 'open' ? 'closed' : 'open');
  }

  function _currentState() {
    if (Rga.Shell && Rga.Shell.Layout) {
      return _resolveState(Rga.Shell.Layout.get().studioPanel);
    }
    return 'open';
  }

  function _setState(next) {
    if (next !== 'open' && next !== 'minimized' && next !== 'closed') return;
    if (Rga.Shell && Rga.Shell.Layout) {
      Rga.Shell.Layout.set({ studioPanel: { state: next } });
    } else {
      _syncStateFromLayout(next);  // early-boot fallback
    }
  }

  function _syncStateFromLayout(state) {
    const col = _col();
    if (!col) return;
    // The two CSS classes are mutually exclusive — at most one is set.
    // CLOSED → bottom-collapsed (existing class; hides the whole panel)
    // MINIMIZED → bottom-minimized (new class; hides only the body,
    //                                keeps tab strip visible)
    if (state === 'closed') {
      col.classList.add('bottom-collapsed');
      col.classList.remove('bottom-minimized');
    } else if (state === 'minimized') {
      col.classList.remove('bottom-collapsed');
      col.classList.add('bottom-minimized');
    } else {  // 'open'
      col.classList.remove('bottom-collapsed');
      col.classList.remove('bottom-minimized');
    }
  }

  function _col() {
    return (Rga.$ ? Rga.$('#center-column') : document.getElementById('center-column'));
  }

  // Backward-compat shim — internal callers that still expect the old
  // boolean-driven sync get correctly converted via _setState.
  function _syncVisibilityFromLayout(visible) {
    _syncStateFromLayout(visible ? 'open' : 'closed');
  }

  // ----------------------------------------------------------------
  // Active tab (persisted via Layout.studioPanel.activeTab)
  // ----------------------------------------------------------------

  function switchTo(tabName) {
    if (!tabName) return;
    show();
    if (Rga.Shell && Rga.Shell.Layout) {
      Rga.Shell.Layout.set({ studioPanel: { activeTab: tabName } });
    }
    _renderActiveTab(tabName);
  }

  function activeTab() {
    if (Rga.Shell && Rga.Shell.Layout) {
      return Rga.Shell.Layout.get().studioPanel.activeTab;
    }
    return null;
  }

  function _renderActiveTab(tabName) {
    const $$ = Rga.$$ || function(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
    $$('.bp-tab').forEach(function(tab) {
      tab.classList.toggle('active', tab.dataset.bpTab === tabName);
    });
    $$('.bp-content').forEach(function(content) {
      content.classList.toggle('active', content.dataset.bpTab === tabName);
    });
  }

  function _wireTabs() {
    const $$ = Rga.$$ || function(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
    $$('.bp-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        switchTo(tab.dataset.bpTab);
      });
    });
  }

  function _wireCloseButton() {
    const closeBtn = Rga.$ ? Rga.$('#btn-close-bottom-panel') : document.getElementById('btn-close-bottom-panel');
    if (closeBtn) {
      // Studio Shell Recovery §E: close button now unambiguously CLOSES
      // (not toggles). The toggle keyboard shortcut continues to flip
      // closed ↔ open. Distinguishing the two affordances was the
      // original §E pain point — "minimize ≠ close".
      closeBtn.addEventListener('click', function() { hide(); });
    }
    const minBtn = Rga.$ ? Rga.$('#btn-minimize-bottom-panel') : document.getElementById('btn-minimize-bottom-panel');
    if (minBtn) {
      // Minimize button = minimize when open, restore when minimized.
      minBtn.addEventListener('click', function() {
        const cur = _currentState();
        if (cur === 'minimized') restore();
        else                     minimize();
      });
    }
    // Studio Shell Recovery §E acceptance: "user can restore with one
    // click" from minimized. Clicking anywhere on the tab strip
    // (except on the buttons / tabs themselves) when minimized
    // restores the panel.
    const tabs = Rga.$ ? Rga.$('#bottom-panel-tabs') : document.getElementById('bottom-panel-tabs');
    if (tabs) {
      tabs.addEventListener('click', function(e) {
        if (_currentState() !== 'minimized') return;
        // If the click hit an interactive child (tab or action button),
        // let that child's handler win — those handlers already call
        // switchTo() which calls show() and restores the panel anyway.
        if (e.target.closest('.bp-tab') || e.target.closest('.bp-tab-action')) return;
        restore();
      });
    }
  }

  function _wireKeyboardShortcut() {
    // Ctrl-J — Studio Panel toggle. Studio Shell Recovery §A4.1
    // routes through KR.registerCommand so the View → Studio Panel
    // menu item resolves its accelerator label by command id.
    // (Cmd+` is registered separately in shell/index.js as
    // 'view.studioPanelAlt' and also routes through this toggle.)
    if (Rga.KeyboardRegistry && typeof Rga.KeyboardRegistry.registerCommand === 'function') {
      Rga.KeyboardRegistry.registerCommand({
        command: 'view.studioPanel',
        label: 'Studio Panel',
        key: 'j', mods: { ctrl: true },
        handler: function() { toggle(); },
        source: 'Rga.Shell.StudioPanel'
      });
    }
  }

  // ----------------------------------------------------------------
  // Inspector routing (right-rail panel)
  // ----------------------------------------------------------------

  // Responsive Shell: the controlling class is `inspector-collapsed`.
  // Inspector is FIRST-CLASS — collapsed = 32px rail with a reopen
  // button, never `display: none`, never width:0. StudioPanel is the
  // SOLE writer of the class (G12 guard).
  //
  // The opts.userInitiated parameter is retained for API symmetry but
  // no longer drives an override flag: the responsive engine always
  // applies its mode-based decision on screen-size change. Rationale:
  // in compact / narrow modes the editor needs the space, and a stuck
  // "user wants it open" preference would block the manuscript. The
  // user's manual toggles still hold WITHIN a mode (the engine only
  // fires on resize → mode change). Full-close remains forbidden:
  // resize.js clamps inspector drag at 240, and _ensureExpandedWidth
  // restores any stuck width:0.
  function toggleInspector(/* opts */) {
    const ws = Rga.$ ? Rga.$('#workspace') : document.getElementById('workspace');
    if (!ws) return;
    // Ensure width is sane before EITHER direction of toggle. The helper
    // is idempotent — only writes when width < 240 (the historic
    // stuck-state recovery), no-op otherwise. Called unconditionally so
    // shell-side code never has to read classList as a source of truth
    // (source-audit rule b).
    _ensureExpandedWidth();
    ws.classList.toggle('inspector-collapsed');
  }

  // Slice 9 §A: openInspector implements the API surface engine plugin
  // context-menu.js has always called (`Rga.Inspector.open()`). Pre-Slice-9
  // the call was defensively guarded against the missing method —
  // `if (Rga.Inspector && Rga.Inspector.open) Rga.Inspector.open();` —
  // so the right-click-to-inspect path was a silent no-op. Adding the
  // method restores the documented behavior; it's not a new feature.
  function openInspector(/* opts */) {
    const ws = Rga.$ ? Rga.$('#workspace') : document.getElementById('workspace');
    if (!ws) return;
    _ensureExpandedWidth();
    ws.classList.remove('inspector-collapsed');
  }

  // Responsive Shell first-class recovery: if the persisted inspector
  // width is below the expanded minimum (240px) — typically because
  // an earlier session drag-closed it to 0 before the first-class drag
  // clamp was added in resize.js — reset to the default 280 before
  // un-collapsing so the panel actually shows. Single owner: Layout.
  function _ensureExpandedWidth() {
    if (!Rga.Shell || !Rga.Shell.Layout) return;
    const cur = Rga.Shell.Layout.get();
    if (!cur || !cur.inspector) return;
    const w = cur.inspector.width;
    if (typeof w !== 'number' || w < 240) {
      Rga.Shell.Layout.set({ inspector: { width: 280 } });
    }
  }

  // Responsive Shell — wire the #inspector-toggle button.
  // Click routes through toggleInspector so StudioPanel stays the SOLE
  // writer of inspector-collapsed (G12 invariant unchanged). Button is
  // visible in BOTH states (expanded → click collapses; collapsed →
  // click expands), so the user has an explicit collapse path without
  // needing the menu.
  function _wireInspectorToggle() {
    const btn = document.getElementById('inspector-toggle');
    if (!btn) return;
    btn.addEventListener('click', function() { toggleInspector(); });
  }

  // ----------------------------------------------------------------
  // Bottom-panel Scene Notes routing — F1A.5 migration (2026-05-29)
  // ----------------------------------------------------------------
  //
  // Pre-F1A.5: studio-panel.js owned a private _notesBySceneId map AND
  // walked the editor DOM to detect the enclosing scene. The Rga.Scene-
  // Manager dual-write here was dead code (no module defined Scene-
  // Manager). Notes existed only inside this closure.
  //
  // Post-F1A.5: the data + change notifications live in Rga.SceneNotes
  // (a screenplay-plugin-owned shared source — see
  // doc-types/screenplay/scene-notes.js). The DOM-walk to find the
  // current scene STAYS here for now (per the F1A.5 brief's "if a
  // parallel path is safer, use it and document the remaining
  // cleanup") — moving the walk requires routing through the engine's
  // framework layer, which is out of scope. The walk publishes its
  // result via Rga.SceneNotes.setCurrentScene so the inspector panel
  // (also screenplay-owned) can react. The bottom-panel UI subscribes
  // to the shared source so notes written from the inspector reflect
  // here, and vice versa.
  //
  // Remaining CORE cleanup deferred to a future slice:
  //   - _detectCurrentScene's DOM walk should move into the screenplay
  //     plugin (it reads screenplay-specific attributes). When the
  //     engine surfaces a "current scene" event from PM state, this
  //     wiring becomes a subscriber to that event and the DOM walk
  //     retires entirely.
  function _wireSceneNotesConnector() {
    if (!Rga.debounce) return;   // defensive — Rga.debounce comes from utils.js
    if (!Rga.SceneNotes) return; // F1A.5 — the shared source must exist
    document.addEventListener('selectionchange', Rga.debounce(function() {
      _detectCurrentScene();
    }, 150));
    const textarea = Rga.$ ? Rga.$('#notes-textarea') : document.getElementById('notes-textarea');
    if (textarea) {
      textarea.addEventListener('input', Rga.debounce(function() {
        const sceneId = Rga.SceneNotes.currentSceneId();
        if (sceneId) Rga.SceneNotes.set(sceneId, textarea.value);
      }, 300));
    }
    // Inbound — subscribe to the shared source so writes from the
    // inspector panel (or any future surface) reflect in this textarea.
    // We unsubscribe in _reset; the wiring is idempotent because
    // _wireSceneNotesConnector is called only from init() which is
    // _initialized-gated.
    _sceneNotesUnsub = Rga.SceneNotes.subscribe(function(event, payload) {
      const ta = Rga.$ ? Rga.$('#notes-textarea') : document.getElementById('notes-textarea');
      if (!ta) return;
      if (event === 'current') {
        _renderBottomNotesUiForCurrentScene();
        return;
      }
      if (event === 'notes' && payload
          && payload.sceneId === Rga.SceneNotes.currentSceneId()) {
        if (ta.value !== payload.value) ta.value = payload.value;
      }
    });
  }

  function _detectCurrentScene() {
    const editor = Rga.$ ? Rga.$('#editor') : document.getElementById('editor');
    if (!editor) return;
    if (!Rga.Cursor || typeof Rga.Cursor.getCurrentBlock !== 'function') return;
    const block = Rga.Cursor.getCurrentBlock();
    if (!block) return;
    let sceneId = null;
    let sceneName = '';
    let el = block;
    while (el) {
      if (el.dataset && el.dataset.blockType === 'scene-header' && el.dataset.sceneId) {
        sceneId = el.dataset.sceneId;
        const numEl = Rga.$ ? Rga.$('.sh-number', el) : el.querySelector('.sh-number');
        const locEl = Rga.$ ? Rga.$('.sh-location', el) : el.querySelector('.sh-location');
        sceneName = (numEl ? numEl.textContent : '') +
          (locEl && locEl.value ? ' — ' + locEl.value : '');
        break;
      }
      el = el.previousElementSibling;
    }
    // F1A.5 — publish to the shared source. The subscriber installed
    // in _wireSceneNotesConnector calls _renderBottomNotesUiForCurrent-
    // Scene to repaint the bottom-panel UI; the inspector panel (if
    // active) repaints itself via its own subscription.
    if (Rga.SceneNotes && typeof Rga.SceneNotes.setCurrentScene === 'function') {
      Rga.SceneNotes.setCurrentScene(sceneId, sceneName);
    }
  }

  function _renderBottomNotesUiForCurrentScene() {
    const label = Rga.$ ? Rga.$('#notes-scene-label') : document.getElementById('notes-scene-label');
    const textarea = Rga.$ ? Rga.$('#notes-textarea') : document.getElementById('notes-textarea');
    const sceneId = Rga.SceneNotes ? Rga.SceneNotes.currentSceneId() : null;
    const sceneName = Rga.SceneNotes ? Rga.SceneNotes.currentSceneName() : '';
    if (label) {
      label.textContent = sceneId ? 'Notes — Scene ' + sceneName : 'Notes — No scene selected';
    }
    if (textarea) {
      if (sceneId) {
        textarea.disabled = false;
        const v = Rga.SceneNotes.get(sceneId);
        if (textarea.value !== v) textarea.value = v;
        textarea.placeholder = 'Add notes for Scene ' + sceneName + '...';
      } else {
        textarea.disabled = true;
        textarea.value = '';
        textarea.placeholder = 'Select a scene to add notes...';
      }
    }
  }

  // ----------------------------------------------------------------
  // Test surface
  // ----------------------------------------------------------------

  function _reset() {
    if (_unsubLayout) { _unsubLayout(); _unsubLayout = null; }
    if (_sceneNotesUnsub) { _sceneNotesUnsub(); _sceneNotesUnsub = null; }
    _initialized = false;
    // The shared scene-notes source (Rga.SceneNotes) owns its own
    // reset; test harnesses that want a pristine notes map call
    // Rga.SceneNotes._reset() directly.
  }

  Rga.Shell.StudioPanel = {
    init: init,
    show: show,
    hide: hide,
    toggle: toggle,
    // Studio Shell Recovery §E — three-state model
    minimize: minimize,
    restore: restore,
    state: _currentState,
    switchTo: switchTo,
    activeTab: activeTab,
    toggleInspector: toggleInspector,
    openInspector: openInspector,
    _reset: _reset,
    _syncVisibilityFromLayout: _syncVisibilityFromLayout,
    _syncStateFromLayout: _syncStateFromLayout,
    _resolveState: _resolveState,
    _renderActiveTab: _renderActiveTab
  };
})();
