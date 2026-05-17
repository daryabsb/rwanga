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
    _syncVisibilityFromLayout(layoutSnap.studioPanel.visible);
    // Restore the persisted active tab if Layout has one. Pre-Slice-9
    // the field was never written; post-Slice-9 it's the SSOT.
    if (layoutSnap.studioPanel.activeTab) {
      _renderActiveTab(layoutSnap.studioPanel.activeTab);
    }
    _unsubLayout = Rga.Shell.Layout.subscribe(function(next, prev) {
      if (!next || !next.studioPanel) return;
      if (prev && prev.studioPanel) {
        if (prev.studioPanel.visible !== next.studioPanel.visible) {
          _syncVisibilityFromLayout(next.studioPanel.visible);
        }
        if (prev.studioPanel.activeTab !== next.studioPanel.activeTab && next.studioPanel.activeTab) {
          _renderActiveTab(next.studioPanel.activeTab);
        }
      }
    });
  }

  // ----------------------------------------------------------------
  // Visibility (delegates to Layout.studioPanel.visible — single SSOT)
  // ----------------------------------------------------------------

  function show() {
    if (Rga.Shell && Rga.Shell.Layout) {
      Rga.Shell.Layout.set({ studioPanel: { visible: true } });
    } else {
      _syncVisibilityFromLayout(true);  // early-boot fallback
    }
  }

  function hide() {
    if (Rga.Shell && Rga.Shell.Layout) {
      Rga.Shell.Layout.set({ studioPanel: { visible: false } });
    } else {
      _syncVisibilityFromLayout(false);
    }
  }

  function toggle() {
    if (Rga.Shell && Rga.Shell.Layout) {
      const cur = Rga.Shell.Layout.get().studioPanel.visible;
      Rga.Shell.Layout.set({ studioPanel: { visible: !cur } });
    } else {
      const col = _col();
      if (col) col.classList.toggle('bottom-collapsed');
    }
  }

  function _syncVisibilityFromLayout(visible) {
    const col = _col();
    if (!col) return;
    if (visible) col.classList.remove('bottom-collapsed');
    else         col.classList.add('bottom-collapsed');
  }

  function _col() {
    return (Rga.$ ? Rga.$('#center-column') : document.getElementById('center-column'));
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
    const btn = Rga.$ ? Rga.$('#btn-close-bottom-panel') : document.getElementById('btn-close-bottom-panel');
    if (!btn) return;
    btn.addEventListener('click', function() { toggle(); });
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
    switchTo: switchTo,
    activeTab: activeTab,
    toggleInspector: toggleInspector,
    openInspector: openInspector,
    _reset: _reset,
    _syncVisibilityFromLayout: _syncVisibilityFromLayout,
    _renderActiveTab: _renderActiveTab
  };
})();
