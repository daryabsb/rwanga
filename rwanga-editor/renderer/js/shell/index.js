// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Shell.init — slice-1 bootstrap. Plan §3.6.
//
// Order:
//   1. Layout state container — already constructed by IIFE; no-op.
//   2. Rga.ScriptSession.init() — wires upstream listeners.
//   3. Sidebar.setHost(...) — wires the sidebar mount target.
//   4. ActivityRail.init(railContainer) — renders rail buttons from registry.
//   5. (StatusBar + TitleBar are commit 9-10 additions — not yet present.)
//   6. Keyboard shortcuts wiring (commit 11).
//   7. Activate the default panel (Scene Navigator) + show sidebar.
//
// Idempotent: safe to call once per app boot.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};

  const DEFAULT_PANEL = 'sceneNavigator';
  let _initialized = false;

  function init() {
    if (_initialized) return true;
    if (!Rga.Shell.Layout || !Rga.Shell.Sidebar || !Rga.Shell.ActivityRail) {
      console.error('[Rga.Shell.init] missing core modules (Layout / Sidebar / ActivityRail)');
      return false;
    }

    const railContainer = document.getElementById('activity-bar');
    const sidebarHost   = document.getElementById('rga-shell-sidebar-host');
    if (!railContainer || !sidebarHost) {
      console.error('[Rga.Shell.init] missing #activity-bar or #rga-shell-sidebar-host');
      return false;
    }

    // Wire ScriptSession (writer-context aggregator) first so panels can
    // subscribe at mount time and receive a populated initial snapshot.
    if (Rga.ScriptSession && typeof Rga.ScriptSession.init === 'function') {
      Rga.ScriptSession.init();
    }

    // Wire the sidebar host BEFORE rail init so panel mounts have a target.
    Rga.Shell.Sidebar.setHost(sidebarHost);

    // Render the rail from whatever panels have IIFE-registered themselves.
    Rga.Shell.ActivityRail.init(railContainer);

    // Status bar (Slice 2 takeover): mount the new shell status bar
    // unconditionally into #status-bar. The legacy Rga.StatusBar bootstrap
    // call is removed from index.html in the same commit; the legacy
    // module definition is deleted in the next commit (commit 9).
    // Compatibility Inventory entry #4 (the conditional adapter) is
    // resolved by this commit; entry #1 resolves with commit 9.
    const statusBar = document.getElementById('status-bar');
    if (statusBar && Rga.Shell.StatusBar && typeof Rga.Shell.StatusBar.init === 'function') {
      Rga.Shell.StatusBar.init(statusBar);
    }

    // Title bar — populate the "Rwanga • {script name} *" text. Reads from
    // Rga.ScriptSession.activeScript and mirrors to document.title.
    const titleEl = document.getElementById('rga-shell-titlebar-title');
    if (titleEl && Rga.Shell.TitleBar && typeof Rga.Shell.TitleBar.init === 'function') {
      Rga.Shell.TitleBar.init(titleEl);
    }

    // Wire Cmd-Shift-X panel toggle shortcuts. Bare keys (Tab, Enter,
    // Mod-Enter, Backspace) are owned by the engine keymap and never
    // enter this handler.
    _wireKeyboardShortcuts();

    // Activate the default panel + show the sidebar.
    const defaultId = _resolveDefaultPanel();
    if (defaultId) {
      Rga.Shell.Sidebar.activate(defaultId);
      Rga.Shell.Layout.set({ sidebar: { visible: true, activePanel: defaultId } });
    }

    _initialized = true;
    return true;
  }

  // ----------------------------------------------------------------
  // Keyboard shortcuts (plan §6.3, §11.4)
  // ----------------------------------------------------------------
  // Bindings: panel id → key combo. The shell only listens for combos
  // with Cmd/Ctrl + Shift modifiers — never bare keys. PM's keymap
  // plugins handle Tab/Enter/Mod-Enter/Backspace inside the editor.
  const _PANEL_SHORTCUTS = {
    'cmd+shift+s': 'sceneNavigator',
    'cmd+shift+e': 'scriptWorkspace',
    'cmd+shift+o': 'outline',
    'cmd+shift+c': 'characters',
    'cmd+shift+f': 'search',
    'cmd+shift+r': 'revisions',
    'cmd+,':       'settings'
  };

  function _wireKeyboardShortcuts() {
    document.addEventListener('keydown', _onKeydown);
  }

  function _onKeydown(e) {
    if (!e) return;
    // Sidebar toggle: Cmd-B (no Shift) — toggles visibility without
    // switching panel. Studio Panel toggle: Cmd-J (slice 1 minimal — the
    // bottom panel wrapper is the existing #bottom-panel which we don't
    // own; this is a placeholder for now).
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;  // every shell shortcut needs a modifier
    const combo = _comboString(e);
    if (!combo) return;
    // Panel toggles.
    const panelId = _PANEL_SHORTCUTS[combo];
    if (panelId) {
      const registered = Rga.Shell.Sidebar.registered();
      if (registered.indexOf(panelId) >= 0) {
        e.preventDefault();
        e.stopPropagation();
        _togglePanel(panelId);
      }
      return;
    }
    // Sidebar visibility toggle.
    if (combo === 'cmd+b') {
      const visible = Rga.Shell.Layout.get().sidebar.visible;
      Rga.Shell.Layout.set({ sidebar: { visible: !visible } });
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // V1.1 fix 6: Studio Panel (bottom panel) visibility toggle.
    // Ctrl+` matches VS Code convention; Ctrl+J stays via the legacy
    // Rga.Keyboard registration in app-shell.js. Both flip Layout —
    // the DOM follows from there.
    if (combo === 'cmd+`') {
      const sv = Rga.Shell.Layout.get().studioPanel.visible;
      Rga.Shell.Layout.set({ studioPanel: { visible: !sv } });
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function _togglePanel(id) {
    const isCurrent = Rga.Shell.Sidebar.current() === id;
    const sidebarVisible = Rga.Shell.Layout.get().sidebar.visible;
    if (isCurrent && sidebarVisible) {
      Rga.Shell.Sidebar.deactivate();
      Rga.Shell.Layout.set({ sidebar: { visible: false } });
    } else {
      Rga.Shell.Sidebar.activate(id);
      Rga.Shell.Layout.set({ sidebar: { visible: true } });
    }
  }

  function _comboString(e) {
    const parts = [];
    if (e.metaKey || e.ctrlKey) parts.push('cmd');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey)   parts.push('alt');
    const key = (e.key || '').toLowerCase();
    if (!key || key === 'meta' || key === 'control' || key === 'shift' || key === 'alt') return null;
    parts.push(key);
    return parts.join('+');
  }

  function _resolveDefaultPanel() {
    const registered = Rga.Shell.Sidebar.registered();
    if (registered.indexOf(DEFAULT_PANEL) >= 0) return DEFAULT_PANEL;
    return registered.length > 0 ? registered[0] : null;
  }

  function _reset() {
    document.removeEventListener('keydown', _onKeydown);
    _initialized = false;
  }

  Rga.Shell.init   = init;
  Rga.Shell._reset = _reset;
})();
