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
//   Rga.Inspector.open()                               →  StudioPanel.openInspector  (new — was undocumented no-op pre-Slice-9)
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};

  let _initialized = false;
  let _unsubLayout = null;
  // Scene-notes state (folded in from the dead Rga.SceneNotesConnector).
  // Kept as private module state; only StudioPanel touches it.
  let _currentSceneId = null;
  const _notesBySceneId = Object.create(null);

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

  // Keyboard / close-button / View-menu toggle: closed ↔ open. Going
  // OUT of minimized goes to open (not closed) — the minimized state
  // is reached only via the explicit minimize button. This matches the
  // long-standing UX where Ctrl+J = "show / hide the panel".
  function toggle() {
    const cur = _currentState();
    _setState(cur === 'closed' ? 'open' : 'closed');
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
    // Ctrl-J — registered via Rga.Keyboard (which delegates to
    // KeyboardRegistry per Slice 2 §A). The Cmd+` shortcut is
    // registered in shell/index.js and also routes through us.
    if (Rga.Keyboard && typeof Rga.Keyboard.register === 'function') {
      Rga.Keyboard.register('j', { ctrl: true, shift: false, alt: false }, function() {
        toggle();
      });
    }
  }

  // ----------------------------------------------------------------
  // Inspector routing (right-rail panel)
  // ----------------------------------------------------------------

  function toggleInspector() {
    const ws = Rga.$ ? Rga.$('#workspace') : document.getElementById('workspace');
    if (ws) ws.classList.toggle('inspector-hidden');
  }

  // Slice 9 §A: openInspector implements the API surface engine plugin
  // context-menu.js has always called (`Rga.Inspector.open()`). Pre-Slice-9
  // the call was defensively guarded against the missing method —
  // `if (Rga.Inspector && Rga.Inspector.open) Rga.Inspector.open();` —
  // so the right-click-to-inspect path was a silent no-op. Adding the
  // method restores the documented behavior; it's not a new feature.
  function openInspector() {
    const ws = Rga.$ ? Rga.$('#workspace') : document.getElementById('workspace');
    if (ws) ws.classList.remove('inspector-hidden');
  }

  // ----------------------------------------------------------------
  // Scene-notes routing (folded in from the dead Rga.SceneNotesConnector)
  // ----------------------------------------------------------------
  //
  // Pre-Slice-9 the connector module existed in app-shell.js but its
  // init() was never wired at boot — zero call sites. Slice 9 folds
  // the connector's behavior into StudioPanel and wires it in init().
  // The behavior: cursor moves → detect the enclosing scene-header
  // DOM element → update the notes textarea + label.
  //
  // This intentionally walks editor DOM rather than going through the
  // engine (`framework/`, off-limits this slice). If the BottomPanel
  // re-design ever surfaces a structured "current scene" event, this
  // wiring should be replaced by a subscriber to that event.
  function _wireSceneNotesConnector() {
    if (!Rga.debounce) return;  // defensive — Rga.debounce comes from utils.js
    document.addEventListener('selectionchange', Rga.debounce(function() {
      _detectCurrentScene();
    }, 150));
    const textarea = Rga.$ ? Rga.$('#notes-textarea') : document.getElementById('notes-textarea');
    if (textarea) {
      textarea.addEventListener('input', Rga.debounce(function() {
        if (_currentSceneId) {
          _notesBySceneId[_currentSceneId] = textarea.value;
          if (Rga.SceneManager && Rga.SceneManager.scenes) {
            const scene = Rga.SceneManager.scenes.get(_currentSceneId);
            if (scene) scene.notes = textarea.value;
          }
        }
      }, 300));
    }
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
    if (sceneId !== _currentSceneId) {
      _currentSceneId = sceneId;
      _updateNotesUi(sceneId, sceneName);
    }
  }

  function _updateNotesUi(sceneId, sceneName) {
    const label = Rga.$ ? Rga.$('#notes-scene-label') : document.getElementById('notes-scene-label');
    const textarea = Rga.$ ? Rga.$('#notes-textarea') : document.getElementById('notes-textarea');
    if (label) {
      label.textContent = sceneId ? 'Notes — Scene ' + sceneName : 'Notes — No scene selected';
    }
    if (textarea) {
      if (sceneId) {
        textarea.disabled = false;
        textarea.value = _notesBySceneId[sceneId] || '';
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
    _initialized = false;
    _currentSceneId = null;
    Object.keys(_notesBySceneId).forEach(function(k) { delete _notesBySceneId[k]; });
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
