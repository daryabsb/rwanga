// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
/* ============================================================
   RWANGA SCRIPT EDITOR — app-shell.js
   Theme manager, resize handles, sidebar panel switching,
   tab manager, keyboard shortcut registry, status bar updates,
   command palette.
   Depends on: utils.js, icons.js
   ============================================================ */

window.Rga = window.Rga || {};

/* ============================================================
   THEME MANAGER — single SSOT per the Ownership Matrix (Runtime
   Ownership Stab. Slice 2 §B). Owns: active theme + persistence +
   theme-change events. The shell + future consumers subscribe via
   Rga.Theme.onChange(fn) instead of polling data-theme or
   localStorage.
   ============================================================ */
Rga.Theme = {
  current: 'dark',
  _listeners: [],

  init: function() {
    var saved = null;
    try { saved = localStorage.getItem('rga-theme'); } catch (_) {}
    this.apply(saved || 'dark');
  },

  apply: function(theme) {
    if (theme !== 'dark' && theme !== 'light') return;
    var prev = this.current;
    this.current = theme;
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('rga-theme', theme); } catch (_) {}

    // Force repaint of all themed elements.
    document.body.style.display = 'none';
    // eslint-disable-next-line no-unused-expressions
    document.body.offsetHeight; // trigger reflow
    document.body.style.display = '';

    if (prev !== theme) this._notify(theme, prev);
  },

  toggle: function() {
    var next = this.current === 'dark' ? 'light' : 'dark';
    this.apply(next);
    if (Rga.Toast && typeof Rga.Toast.show === 'function') {
      Rga.Toast.show('Switched to ' + next + ' theme', 'success', 1500);
    }
  },

  // Subscribe to theme-change events. fn receives (newTheme, prevTheme).
  // Returns an unsubscribe function. Idempotent for the same fn.
  onChange: function(fn) {
    if (typeof fn !== 'function') return function() {};
    if (this._listeners.indexOf(fn) < 0) this._listeners.push(fn);
    var self = this;
    return function unsubscribe() {
      var idx = self._listeners.indexOf(fn);
      if (idx >= 0) self._listeners.splice(idx, 1);
    };
  },

  _notify: function(next, prev) {
    // Snapshot copy so a subscriber's unsubscribe during dispatch
    // doesn't skip later subscribers in the same notification.
    var snapshot = this._listeners.slice();
    for (var i = 0; i < snapshot.length; i += 1) {
      try { snapshot[i](next, prev); }
      catch (err) { console.error('[Rga.Theme] onChange subscriber threw:', err); }
    }
  },

  _reset: function() {
    this._listeners = [];
    this.current = 'dark';
  }
};

/* Rga.Resize — EXTRACTED to renderer/js/shell/resize.js in
   Runtime Ownership Stab. Slice 8 §A. */
/* Rga.CommandPalette — EXTRACTED to renderer/js/shell/command-palette.js
   in Runtime Ownership Stab. Slice 8 §A. */
/* Rga.ScriptLanguage — EXTRACTED to renderer/js/shell/script-language.js
   in Runtime Ownership Stab. Slice 8 §A. */

/* ============================================================
   SIDEBAR MANAGER — Slice 2 compatibility shim.
   The legacy Rga.Sidebar was retired by Slice 2 (entries #2/#3 in the
   shell compatibility inventory). Reduced here to a minimal no-op shim
   so the engine plugin `tags.js:206` (which calls
   `Rga.Sidebar.switchTo('tags')` after tagging) keeps working without
   an engine change. Compatibility Inventory entry #2 is BLOCKED on
   that engine dependency; full removal of this shim happens in Slice 3
   when the Characters panel + Breakdown tab subsume the legacy tags
   concept. The new shell's sidebar is owned by Rga.Shell.Sidebar +
   Rga.Shell.Layout.
   ============================================================ */
Rga.Sidebar = {
  activePanel: null,
  init:           function() { /* no-op — Rga.Shell.init owns the sidebar now */ },
  switchTo:       function(/* panelName */) { /* no-op shim for engine consumer; intentional */ },
  toggleCollapse: function() { /* no-op shim — see Rga.Shell.Layout.set({sidebar:{visible:...}}) */ }
};

/* ============================================================
   Rga.Tabs — DELETED in Runtime Ownership Stab. Slice 3 §A.
   The 185-line legacy module had zero consumers across renderer/
   and tests/. It predated `Rga.TabManager` (renderer/js/tab-manager.js),
   which owns tabs end-to-end (open/close/activate, session restore,
   dirty tracking) via a ProseMirror EditorView mount. No replacement
   needed; see git history for the pre-deletion source.
   ============================================================ */

/* ============================================================
   KEYBOARD SHORTCUT MANAGER (legacy API → KeyboardRegistry shim)
   Runtime Ownership Stab. Slice 2: this used to own its own
   document.keydown listener and its own _shortcuts map. Now it
   delegates to Rga.KeyboardRegistry (the SSOT) so engine consumers
   like renderer/js/editor/page-setup-dialog.js — which we must not
   touch per slice rules — keep working unchanged. New code should
   call Rga.KeyboardRegistry.register directly.
   ============================================================ */
Rga.Keyboard = {
  init: function() {
    // Ensure the registry's document listener is attached. Idempotent.
    if (Rga.KeyboardRegistry && typeof Rga.KeyboardRegistry.init === 'function') {
      Rga.KeyboardRegistry.init();
    }
  },
  register: function(key, mods, action) {
    if (!Rga.KeyboardRegistry || typeof Rga.KeyboardRegistry.register !== 'function') return;
    Rga.KeyboardRegistry.register(key, mods, action, 'Rga.Keyboard.register (legacy shim)');
  }
};

/* ============================================================
   STATUS BAR — removed in Slice 2.
   Compatibility Inventory entry #1 RESOLVED. Rga.Shell.StatusBar
   (renderer/js/shell/status-bar.js) populates #status-bar from
   Rga.ScriptSession; segment list per slice-2 plan §3.4.
   ============================================================ */

/* ============================================================

/* ============================================================
   MODAL UTILITY
   ============================================================ */
/* Rga.Modal — EXTRACTED to renderer/js/shell/modal.js in
   Runtime Ownership Stab. Slice 8 §A. The IIFE there sets the global
   Rga.Modal so all existing consumers (Rga.TabManager) keep working.
   See the legacy-extraction-roadmap. */

/* ============================================================
   BOTTOM PANEL MANAGER
   ============================================================ */
// V1.1 fix 6 (Bottom panel reopen): visibility state now lives in
// Rga.Shell.Layout.studioPanel.visible. The DOM class is a SIDE EFFECT
// of that state (applied by _syncDomFromLayout below) rather than the
// source of truth. This means any caller — close button, keyboard
// shortcut, future menu action, command palette, layout restore —
// hits one entry point (Rga.Shell.Layout.set) and the DOM follows.
// The earlier DOM-only classList.toggle was unreversible whenever the
// keyboard shortcut never reached the handler (Electron/Chromium
// shadowing Ctrl+J), leaving the panel stuck closed.
Rga.BottomPanel = {
  activeTab: 'scene',

  init: function() {
    var self = this;

    // Tab switching
    Rga.$$('.bp-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        self.switchTo(tab.dataset.bpTab);
      });
    });

    // Close button — flips Layout, which then updates the DOM.
    var closeBtn = Rga.$('#btn-close-bottom-panel');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        self.toggleCollapse();
      });
    }

    // Ctrl+J toggles the panel — registered ONCE by the init script
    // in index.html (see registerShortcuts()). The Slice-2 keyboard
    // consolidation removed the duplicate registration that used to
    // live here. Cmd+` is registered separately by the shell keyboard
    // wiring (shell/index.js) and routes through the same public
    // API (Rga.BottomPanel.toggleCollapse), so all three entry points
    // share one mutator + one keyboard SSOT.

    // Initial Layout sync (Slice 4 §A — simplified).
    //
    // Persistence is now owned by Rga.WorkspaceState, which has
    // already hydrated Layout from `rga-workspace-layout` before
    // this init runs (boot order in index.html guarantees it).
    // BottomPanel's only job here is to:
    //   1. Sync the DOM class from Layout's current studioPanel.visible
    //      (whatever WorkspaceState restored, or the default).
    //   2. Subscribe so future toggle/open writes keep the DOM aligned.
    // The earlier scoped-key (`rga-shell-studio-panel-visible`) and
    // its read/write helpers were removed; WorkspaceState's legacy
    // migration absorbed any pre-existing value on the first boot
    // after this slice.
    if (Rga.Shell && Rga.Shell.Layout) {
      var initialVisible = Rga.Shell.Layout.get().studioPanel.visible;
      self._syncDomFromLayout(initialVisible);
      Rga.Shell.Layout.subscribe(function(next, prev) {
        if (!next || !next.studioPanel) return;
        if (prev && prev.studioPanel && prev.studioPanel.visible === next.studioPanel.visible) return;
        self._syncDomFromLayout(next.studioPanel.visible);
      });
    }
  },

  open: function() {
    if (Rga.Shell && Rga.Shell.Layout) {
      Rga.Shell.Layout.set({ studioPanel: { visible: true } });
    } else {
      this._syncDomFromLayout(true);
    }
  },

  switchTo: function(tabName) {
    this.open();
    this.activeTab = tabName;

    Rga.$$('.bp-tab').forEach(function(tab) {
      tab.classList.toggle('active', tab.dataset.bpTab === tabName);
    });

    Rga.$$('.bp-content').forEach(function(content) {
      content.classList.toggle('active', content.dataset.bpTab === tabName);
    });
  },

  toggleCollapse: function() {
    if (Rga.Shell && Rga.Shell.Layout) {
      var current = Rga.Shell.Layout.get().studioPanel.visible;
      Rga.Shell.Layout.set({ studioPanel: { visible: !current } });
    } else {
      // Fallback (early-boot / test contexts where Layout absent).
      var col = Rga.$('#center-column');
      if (col) col.classList.toggle('bottom-collapsed');
    }
  },

  _syncDomFromLayout: function(visible) {
    var col = Rga.$('#center-column');
    if (!col) return;
    if (visible) col.classList.remove('bottom-collapsed');
    else         col.classList.add('bottom-collapsed');
  }
  // _STORAGE_KEY / _readPersistedVisibility / _writePersistedVisibility
  // removed in Runtime Ownership Stab. Slice 4 §A. Persistence is now
  // owned by Rga.WorkspaceState (single owner of layout state).
};

/* ============================================================
   INSPECTOR MANAGER
   ============================================================ */
Rga.Inspector = {
  toggle: function() {
    Rga.$('#workspace').classList.toggle('inspector-hidden');
  }
};

/* Rga.Toast — EXTRACTED to renderer/js/shell/toast.js in
   Runtime Ownership Stab. Slice 8 §A. The IIFE there sets the global
   Rga.Toast; the only in-shell consumer (Rga.Theme.toggle) keeps
   working. See the legacy-extraction-roadmap. */

/* ============================================================
   Rga.FileTree — DELETED in Runtime Ownership Stab. Slice 3 §A.
   The 85-line module targeted #file-tree, a legacy DOM element that
   was removed when the Script Workspace panel (Slice 2) took over
   workspace navigation. With the target gone, init() always early-
   returned. Zero consumers in renderer/ or tests/.
   ============================================================ */

/* ============================================================
   SCENE NOTES CONNECTOR
   ============================================================ */
Rga.SceneNotesConnector = {
  _currentSceneId: null,
  _notes: {}, // sceneId → note text

  init: function() {
    var self = this;

    // Listen for cursor movement (selectionchange) to detect scene changes
    document.addEventListener('selectionchange', Rga.debounce(function() {
      self._detectCurrentScene();
    }, 150));

    // Save notes when textarea changes
    var textarea = Rga.$('#notes-textarea');
    if (textarea) {
      textarea.addEventListener('input', Rga.debounce(function() {
        if (self._currentSceneId) {
          self._notes[self._currentSceneId] = textarea.value;
          // Also update scene model if SceneManager has the scene
          if (Rga.SceneManager && Rga.SceneManager.scenes) {
            var scene = Rga.SceneManager.scenes.get(self._currentSceneId);
            if (scene) scene.notes = textarea.value;
          }
        }
      }, 300));
    }
  },

  _detectCurrentScene: function() {
    var editor = Rga.$('#editor');
    if (!editor) return;

    // Find the scene header above the current cursor position
    var block = Rga.Cursor.getCurrentBlock();
    if (!block) return;

    var sceneId = null;
    var sceneName = '';
    var el = block;

    // Walk backwards to find the scene header
    while (el) {
      if (el.dataset && el.dataset.blockType === 'scene-header' && el.dataset.sceneId) {
        sceneId = el.dataset.sceneId;
        var numEl = Rga.$('.sh-number', el);
        var locEl = Rga.$('.sh-location', el);
        sceneName = (numEl ? numEl.textContent : '') +
          (locEl && locEl.value ? ' — ' + locEl.value : '');
        break;
      }
      el = el.previousElementSibling;
    }

    // If scene changed, update the bottom panel
    if (sceneId !== this._currentSceneId) {
      this._currentSceneId = sceneId;
      this._updateNotesPanel(sceneId, sceneName);
      this._updateProblemsForScene(sceneId);

      // Highlight in sidebar
      Rga.$$('.scene-item').forEach(function(item) {
        item.classList.toggle('active', item.dataset.sceneId === sceneId);
      });
    }
  },

  _updateNotesPanel: function(sceneId, sceneName) {
    var label = Rga.$('#notes-scene-label');
    var textarea = Rga.$('#notes-textarea');

    if (label) {
      label.textContent = sceneId
        ? 'Notes — Scene ' + sceneName
        : 'Notes — No scene selected';
    }

    if (textarea) {
      if (sceneId) {
        textarea.disabled = false;
        textarea.value = this._notes[sceneId] || '';
        textarea.placeholder = 'Add notes for Scene ' + sceneName + '...';
      } else {
        textarea.disabled = true;
        textarea.value = '';
        textarea.placeholder = 'Select a scene to add notes...';
      }
    }
  },

  _updateProblemsForScene: function(sceneId) {
    // Highlight problems for the current scene
    Rga.$$('.problem-item').forEach(function(item) {
      // Subtle highlight — the Problems panel already works globally,
      // this just adds emphasis to current-scene problems
      item.style.opacity = '1';
    });
  },

  /**
   * Load notes from scene data (called when loading a file).
   */
  loadFromScenes: function() {
    var self = this;
    if (!Rga.SceneManager || !Rga.SceneManager.scenes) return;
    Rga.SceneManager.scenes.forEach(function(scene, sceneId) {
      if (scene.notes) self._notes[sceneId] = scene.notes;
    });
  }
};

