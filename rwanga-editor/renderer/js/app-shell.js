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

/* ============================================================
   RESIZE HANDLES
   Allows dragging dividers between panels.

   Runtime Ownership Stab. Slice 4 §A: drag mid-move still writes
   CSS variables directly (so the resize feels live), but on
   drag-end the final size is COMMITTED to Rga.Shell.Layout.
   WorkspaceState picks it up via its Layout subscriber and
   persists. On boot, _applyLayoutToCss() pushes the persisted
   Layout values back into the CSS variables before the user
   sees the first paint.

   Mapping (CSS var ↔ Layout path):
     --sidebar-width        ↔ Layout.sidebar.width
     --inspector-width      ↔ Layout.inspector.width
     --bottom-panel-height  ↔ Layout.studioPanel.height
   ============================================================ */
Rga.Resize = {
  _SIZE_MAP: [
    { target: 'sidebar',      cssVar: '--sidebar-width',       zone: 'sidebar',     field: 'width'  },
    { target: 'inspector',    cssVar: '--inspector-width',     zone: 'inspector',   field: 'width'  },
    { target: 'bottom-panel', cssVar: '--bottom-panel-height', zone: 'studioPanel', field: 'height' }
  ],

  init: function() {
    var handles = Rga.$$('.resize-handle');
    handles.forEach(function(handle) {
      handle.addEventListener('mousedown', function(e) {
        Rga.Resize._startDrag(e, handle);
      });
    });
    // Slice 4 §A: hydrate CSS vars from Layout on init (covers the
    // post-WorkspaceState-restore first paint). Then subscribe so
    // any non-drag write to Layout (programmatic or via fromJSON)
    // re-applies to CSS.
    Rga.Resize._applyLayoutToCss();
    if (Rga.Shell && Rga.Shell.Layout && typeof Rga.Shell.Layout.subscribe === 'function') {
      Rga.Shell.Layout.subscribe(function() { Rga.Resize._applyLayoutToCss(); });
    }
  },

  _findMapByTarget: function(target) {
    for (var i = 0; i < Rga.Resize._SIZE_MAP.length; i += 1) {
      if (Rga.Resize._SIZE_MAP[i].target === target) return Rga.Resize._SIZE_MAP[i];
    }
    return null;
  },

  _applyLayoutToCss: function() {
    if (!Rga.Shell || !Rga.Shell.Layout) return;
    var snap = Rga.Shell.Layout.get();
    Rga.Resize._SIZE_MAP.forEach(function(m) {
      var zone = snap[m.zone];
      if (!zone) return;
      var val = zone[m.field];
      if (typeof val !== 'number') return;
      document.documentElement.style.setProperty(m.cssVar, val + 'px');
    });
  },

  _startDrag: function(e, handle) {
    e.preventDefault();
    handle.classList.add('dragging');
    document.body.style.cursor = handle.dataset.resize === 'bottom-panel' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';

    var target = handle.dataset.resize;
    var map = Rga.Resize._findMapByTarget(target);
    var prop = map ? map.cssVar : '--sidebar-width';
    var isVertical = target === 'bottom-panel';
    var startPos = isVertical ? e.clientY : e.clientX;

    var startSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue(prop)) || 0;
    var lastSize = startSize;

    function onMove(e2) {
      var delta;
      if (isVertical) {
        delta = startPos - e2.clientY; // drag up = larger
      } else if (target === 'inspector') {
        delta = startPos - e2.clientX; // drag left = larger
      } else {
        delta = e2.clientX - startPos; // drag right = larger
      }

      var newSize = startSize + delta;
      var minSize = isVertical ? 100 : 180;
      var collapseThreshold = 60;

      if (newSize < collapseThreshold) {
        newSize = 0;
      } else {
        newSize = Math.max(newSize, minSize);
      }

      lastSize = newSize;
      document.documentElement.style.setProperty(prop, newSize + 'px');
    }

    function onUp() {
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // Slice 4 §A: commit the final size to Layout. Layout
      // subscriber (WorkspaceState) persists. We deliberately
      // commit only on drag-end, not on every mousemove tick, to
      // avoid hammering localStorage during the drag.
      if (map && Rga.Shell && Rga.Shell.Layout) {
        var patch = {};
        patch[map.zone] = {};
        patch[map.zone][map.field] = lastSize;
        Rga.Shell.Layout.set(patch);
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
};

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
   COMMAND PALETTE
   ============================================================ */
Rga.CommandPalette = {
  _commands: [],
  _isOpen: false,
  _activeIndex: 0,

  init: function() {
    // Build will register commands after all modules are loaded
  },

  /**
   * Register a command.
   * @param {object} cmd - { label, shortcut?, category?, action }
   */
  register: function(cmd) {
    this._commands.push(cmd);
  },

  open: function() {
    var paletteEl = Rga.$('#command-palette');
    if (!paletteEl) return;

    paletteEl.hidden = false;
    this._isOpen = true;
    this._activeIndex = 0;

    var input = Rga.$('.palette-input', paletteEl);
    if (input) {
      input.value = '';
      input.focus();
    }

    this._renderResults('');
    this._bindEvents();
  },

  close: function() {
    var paletteEl = Rga.$('#command-palette');
    if (!paletteEl) return;

    paletteEl.hidden = true;
    this._isOpen = false;
    this._unbindEvents();

    // Return focus to editor
    var editor = Rga.$('#editor');
    if (editor) editor.focus();
  },

  _renderResults: function(query) {
    var results = Rga.$('.palette-results');
    if (!results) return;

    var filtered;
    if (!query) {
      filtered = this._commands.slice(0, 20);
    } else {
      filtered = this._commands
        .map(function(cmd) {
          var score = Rga.CommandPalette._fuzzyMatch(query, cmd.label);
          return { cmd: cmd, score: score };
        })
        .filter(function(item) { return item.score >= 0; })
        .sort(function(a, b) { return b.score - a.score; })
        .slice(0, 15)
        .map(function(item) { return item.cmd; });
    }

    results.innerHTML = '';
    if (filtered.length === 0) {
      results.innerHTML = '<div class="palette-empty">No matching commands</div>';
      return;
    }

    var self = this;
    filtered.forEach(function(cmd, index) {
      var item = document.createElement('div');
      item.className = 'palette-item' + (index === self._activeIndex ? ' active' : '');
      item.dataset.index = index;

      var label = document.createElement('span');
      label.className = 'palette-label';
      label.textContent = cmd.label;
      item.appendChild(label);

      if (cmd.shortcut) {
        var shortcut = document.createElement('span');
        shortcut.className = 'palette-shortcut';
        shortcut.textContent = cmd.shortcut;
        item.appendChild(shortcut);
      }

      if (cmd.category) {
        var cat = document.createElement('span');
        cat.className = 'palette-category';
        cat.textContent = cmd.category;
        item.appendChild(cat);
      }

      item.addEventListener('click', function() {
        self.close();
        cmd.action();
      });

      results.appendChild(item);
    });
  },

  _fuzzyMatch: function(query, text) {
    var lq = query.toLowerCase();
    var lt = text.toLowerCase();
    var qi = 0;
    var score = 0;
    var consecutive = 0;

    for (var ti = 0; ti < lt.length && qi < lq.length; ti++) {
      if (lt[ti] === lq[qi]) {
        qi++;
        consecutive++;
        score += consecutive * 2;
        if (ti === 0 || lt[ti - 1] === ' ') score += 5;
      } else {
        consecutive = 0;
      }
    }

    return qi === lq.length ? score : -1;
  },

  _onKeydown: null,
  _onInput: null,
  _onBackdropClick: null,

  _bindEvents: function() {
    var self = this;
    var paletteEl = Rga.$('#command-palette');
    var input = Rga.$('.palette-input', paletteEl);
    var results = Rga.$('.palette-results', paletteEl);

    this._onInput = function() {
      self._activeIndex = 0;
      self._renderResults(input.value);
    };

    this._onKeydown = function(e) {
      var items = Rga.$$('.palette-item', results);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        self._activeIndex = Math.min(self._activeIndex + 1, items.length - 1);
        self._highlightActive(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        self._activeIndex = Math.max(self._activeIndex - 1, 0);
        self._highlightActive(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var active = items[self._activeIndex];
        if (active) active.click();
      } else if (e.key === 'Escape') {
        self.close();
      }
    };

    this._onBackdropClick = function(e) {
      if (e.target.classList.contains('palette-backdrop')) {
        self.close();
      }
    };

    input.addEventListener('input', this._onInput);
    paletteEl.addEventListener('keydown', this._onKeydown);
    paletteEl.addEventListener('click', this._onBackdropClick);
  },

  _unbindEvents: function() {
    var paletteEl = Rga.$('#command-palette');
    var input = Rga.$('.palette-input', paletteEl);
    if (input && this._onInput) input.removeEventListener('input', this._onInput);
    if (paletteEl && this._onKeydown) paletteEl.removeEventListener('keydown', this._onKeydown);
    if (paletteEl && this._onBackdropClick) paletteEl.removeEventListener('click', this._onBackdropClick);
  },

  _highlightActive: function(items) {
    items.forEach(function(item, i) {
      item.classList.toggle('active', i === Rga.CommandPalette._activeIndex);
    });
  }
};

/* ============================================================
   MODAL UTILITY
   ============================================================ */
Rga.Modal = {
  showUnsaved: function(filename) {
    return new Promise(function(resolve) {
      var el = document.getElementById('unsaved-modal');
      if (!el) { resolve('discard'); return; }
      var msgEl = document.getElementById('unsaved-modal-msg');
      if (msgEl) msgEl.textContent = '"' + filename + '" has unsaved changes.';
      el.hidden = false;
      function onBtnClick(e) {
        var btn = e.target.closest('[data-choice]');
        if (!btn) return;
        el.hidden = true;
        el.removeEventListener('click', onBtnClick);
        resolve(btn.dataset.choice);
      }
      el.addEventListener('click', onBtnClick);
    });
  }
};

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

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
Rga.Toast = {
  /**
   * Show a toast notification.
   * @param {string} message
   * @param {string} type - 'success', 'error', 'warning', 'info'
   * @param {number} duration - ms, default 3000
   */
  show: function(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;

    var container = Rga.$('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast';

    var iconEl = document.createElement('span');
    iconEl.className = 'toast-icon ' + type;
    var iconMap = { success: 'check', error: 'close', warning: 'warning', info: 'info' };
    iconEl.innerHTML = Rga.Icons[iconMap[type]] || '';
    toast.appendChild(iconEl);

    var msgEl = document.createElement('span');
    msgEl.className = 'toast-message';
    msgEl.textContent = message;
    toast.appendChild(msgEl);

    var closeEl = document.createElement('button');
    closeEl.className = 'toast-close';
    closeEl.innerHTML = Rga.Icons.close;
    closeEl.addEventListener('click', function() { dismiss(); });
    toast.appendChild(closeEl);

    container.appendChild(toast);

    var timer = setTimeout(dismiss, duration);

    function dismiss() {
      clearTimeout(timer);
      toast.classList.add('leaving');
      setTimeout(function() { toast.remove(); }, 200);
    }
  }
};

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

/* ============================================================
   SCRIPT LANGUAGE MANAGER
   Handles the writing language/direction of the script content.
   This is separate from UI i18n — it controls the editor surface
   direction + font, not the application menus.
   ============================================================ */
Rga.ScriptLanguage = {
  /** Available script languages */
  LANGUAGES: {
    en:  { label: 'English',        code: 'EN',  dir: 'ltr', font: 'var(--font-editor)' },
    ku:  { label: 'Kurdish (Sorani)', code: 'KU', dir: 'rtl', font: 'var(--font-editor-rtl)' },
    ar:  { label: 'Arabic',         code: 'AR',  dir: 'rtl', font: 'var(--font-editor-rtl)' },
    fa:  { label: 'Persian',        code: 'FA',  dir: 'rtl', font: 'var(--font-editor-rtl)' }
  },

  current: 'en',

  init: function() {
    var saved = localStorage.getItem('rga-script-lang') || 'en';
    this.apply(saved);
    this._bindStatusBarButton();
  },

  /**
   * Apply a script language to the editor surface.
   * @param {string} langKey - 'en', 'ku', 'ar', 'fa'
   */
  apply: function(langKey) {
    var lang = this.LANGUAGES[langKey];
    if (!lang) langKey = 'en', lang = this.LANGUAGES.en;

    this.current = langKey;
    localStorage.setItem('rga-script-lang', langKey);

    var editor = Rga.$('#editor');
    if (editor) {
      editor.setAttribute('dir', lang.dir);
      editor.style.fontFamily = lang.font;
      editor.setAttribute('lang', langKey);
    }

    // Update gutter position for RTL
    var container = Rga.$('#editor-container');
    if (container) {
      if (lang.dir === 'rtl') {
        container.style.direction = 'rtl';
      } else {
        container.style.direction = 'ltr';
      }
    }

    // Update scene header inputs direction
    Rga.$$('.sh-location').forEach(function(input) {
      input.dir = lang.dir;
    });

    // Update status bar
    var langBtn = Rga.$('#status-language');
    if (langBtn) {
      langBtn.textContent = lang.code;
      langBtn.title = 'Script Language: ' + lang.label + ' (' + lang.dir.toUpperCase() + ')';
    }
  },

  /**
   * Show a language picker (small menu from status bar).
   */
  showPicker: function() {
    var self = this;
    var btn = Rga.$('#status-language');
    if (!btn) return;

    var rect = btn.getBoundingClientRect();
    var items = Object.keys(this.LANGUAGES).map(function(key) {
      var lang = self.LANGUAGES[key];
      var isCurrent = key === self.current;
      return {
        label: lang.label + ' (' + lang.dir.toUpperCase() + ')' + (isCurrent ? ' ✓' : ''),
        action: function() {
          self.apply(key);
          Rga.Toast.show('Script language: ' + lang.label, 'info', 1500);
        }
      };
    });

    Rga.ContextMenu.show(items, rect.left, rect.top - (items.length * 32) - 8);
  },

  _bindStatusBarButton: function() {
    var self = this;
    var langBtn = Rga.$('#status-language');
    if (langBtn) {
      langBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        self.showPicker();
      });
    }
  }
};
