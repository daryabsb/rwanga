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
   BOTTOM PANEL — shim → Rga.Shell.StudioPanel (Slice 9 §A)
   The full implementation moved to renderer/js/shell/studio-panel.js.
   This shim preserves the public API engine plugins depend on:
     • annotations.js:117,154 → Rga.BottomPanel.switchTo('notes')
     • revision-flags.js:227  → Rga.BottomPanel.switchTo('flags')
   The shell-side callers (index.html init, shell/index.js Cmd+`) also
   continue to work unchanged.
   ============================================================ */
Rga.BottomPanel = {
  init: function() {
    if (Rga.Shell && Rga.Shell.StudioPanel) Rga.Shell.StudioPanel.init();
  },
  open: function() {
    if (Rga.Shell && Rga.Shell.StudioPanel) Rga.Shell.StudioPanel.show();
  },
  switchTo: function(tabName) {
    if (Rga.Shell && Rga.Shell.StudioPanel) Rga.Shell.StudioPanel.switchTo(tabName);
  },
  toggleCollapse: function() {
    if (Rga.Shell && Rga.Shell.StudioPanel) Rga.Shell.StudioPanel.toggle();
  }
};

/* ============================================================
   INSPECTOR — shim → Rga.Shell.StudioPanel (Slice 9 §A)
   The inspector routing moved to renderer/js/shell/studio-panel.js.
   Engine consumer context-menu.js calls Rga.Inspector.open(); pre-
   Slice-9 the method didn't exist (defensively guarded). Slice 9
   adds open() (and keeps toggle()) so the documented API works.
   ============================================================ */
Rga.Inspector = {
  toggle: function() {
    if (Rga.Shell && Rga.Shell.StudioPanel) Rga.Shell.StudioPanel.toggleInspector();
  },
  open: function() {
    if (Rga.Shell && Rga.Shell.StudioPanel) Rga.Shell.StudioPanel.openInspector();
  }
};

/* Rga.SceneNotesConnector — DELETED in Runtime Ownership Stab. Slice
   9 §A. The module had zero callers (init was never wired at boot).
   Its scene-notes-routing behavior was folded into Rga.Shell.StudioPanel
   where StudioPanel.init now wires the selectionchange listener +
   per-scene notes textarea via _wireSceneNotesConnector. */


