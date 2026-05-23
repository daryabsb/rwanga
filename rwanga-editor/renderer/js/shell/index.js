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

    // Activate the panel the user last had open. Order:
    //   1. Layout.sidebar.activePanel — restored by WorkspaceState
    //      from `rga-workspace-layout`. If the restored id is still
    //      a registered panel, use it.
    //   2. Otherwise fall back to DEFAULT_PANEL (sceneNavigator), or
    //      the first registered panel if even that isn't present.
    // Layout.sidebar.visible is similarly trusted from WorkspaceState
    // (or DEFAULTS) — the boot no longer hard-codes `visible: true`.
    // Slice 5 §B: Sidebar.activate now syncs its own activePanel
    // mirror into Layout (see sidebar.js _syncLayoutMirror), so no
    // explicit Layout.set is needed here.
    const layoutSnap   = Rga.Shell.Layout.get();
    const persistedId  = layoutSnap && layoutSnap.sidebar && layoutSnap.sidebar.activePanel;
    const registeredIds = Rga.Shell.Sidebar.registered();
    let panelToActivate = null;
    if (persistedId && registeredIds.indexOf(persistedId) >= 0) {
      panelToActivate = persistedId;
    } else {
      panelToActivate = _resolveDefaultPanel();
    }
    if (panelToActivate) {
      Rga.Shell.Sidebar.activate(panelToActivate);
      // Ensure visibility tracks Layout's restored value, defaulting
      // to true on fresh boots (per Layout DEFAULTS).
      if (layoutSnap.sidebar.visible !== true) {
        // Honour persisted-hidden state: don't force visible if the
        // user closed it last session.
        // _syncLayoutMirror above already wrote activePanel; nothing
        // more to do here.
      } else {
        Rga.Shell.Layout.set({ sidebar: { visible: true } });
      }
    }

    _initialized = true;
    return true;
  }

  // ----------------------------------------------------------------
  // Keyboard shortcuts (plan §6.3, §11.4)
  // Migrated to Rga.KeyboardRegistry in Runtime Ownership Stab. Slice
  // 2 — this file no longer owns a document.keydown listener.
  // ----------------------------------------------------------------
  // Studio Shell Recovery §A4.1: panel.sceneNavigator moves OFF
  // Ctrl+Shift+S (which is the industry-standard Save As accelerator
  // and was lost to native-menu suppression in A4). It moves to
  // Ctrl+Shift+1 — VS-Code-style numbered panel access. All other
  // panel shortcuts keep their letter mnemonic.
  const _PANEL_SHORTCUTS = [
    { key: '1', panel: 'sceneNavigator' },
    { key: 'e', panel: 'scriptWorkspace' },
    { key: 'o', panel: 'outline' },
    { key: 'c', panel: 'characters' },
    { key: 'f', panel: 'search' },
    { key: 'r', panel: 'revisions' }
  ];

  function _wireKeyboardShortcuts() {
    if (!Rga.KeyboardRegistry || typeof Rga.KeyboardRegistry.registerCommand !== 'function') return;
    const KR = Rga.KeyboardRegistry;

    // Cmd-Shift-{1,E,O,C,F,R} → panel toggles. §A4.1 routes these
    // through KR.registerCommand so the menu / command palette can
    // resolve their accelerator labels by command id.
    _PANEL_SHORTCUTS.forEach(function(spec) {
      KR.registerCommand({
        command: 'panel.' + spec.panel,
        label: 'Toggle ' + spec.panel,
        key: spec.key,
        mods: { ctrl: true, shift: true },
        handler: function() {
          if (Rga.Shell.Sidebar.registered().indexOf(spec.panel) < 0) return;
          _togglePanel(spec.panel);
        },
        source: 'Rga.Shell (panel toggle: ' + spec.panel + ')'
      });
    });

    // Cmd-, → Settings panel toggle.
    KR.registerCommand({
      command: 'panel.settings',
      label: 'Settings',
      key: ',', mods: { ctrl: true },
      handler: function() {
        if (Rga.Shell.Sidebar.registered().indexOf('settings') < 0) return;
        _togglePanel('settings');
      },
      source: 'Rga.Shell (panel toggle: settings)'
    });

    // Cmd-B → Sidebar visibility toggle.
    // Responsive Shell: also flag userOverride so the responsive engine
    // stops auto-toggling the sidebar based on window width once the
    // user has expressed an explicit preference.
    KR.registerCommand({
      command: 'view.toggleSidebar',
      label: 'Toggle Sidebar',
      key: 'b', mods: { ctrl: true },
      handler: function() {
        const visible = Rga.Shell.Layout.get().sidebar.visible;
        Rga.Shell.Layout.set({ sidebar: { visible: !visible, userOverride: true } });
      },
      source: 'Rga.Shell (sidebar visibility toggle)'
    });

    // Cmd-` → Studio (bottom) Panel toggle. Routes through the same
    // public mutator (Rga.BottomPanel.toggleCollapse) as the close
    // button + the command palette entry → single mutator surface.
    KR.registerCommand({
      command: 'view.studioPanelAlt',
      label: 'Toggle Studio Panel (alt)',
      key: '`', mods: { ctrl: true },
      handler: function() {
        if (Rga.BottomPanel && typeof Rga.BottomPanel.toggleCollapse === 'function') {
          Rga.BottomPanel.toggleCollapse();
        } else if (Rga.Shell.Layout) {
          const sv = Rga.Shell.Layout.get().studioPanel.visible;
          Rga.Shell.Layout.set({ studioPanel: { visible: !sv } });
        }
      },
      source: 'Rga.Shell (studio panel toggle — Ctrl+`)'
    });
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

  // _comboString lived here pre-Slice-2 to normalise events to combo
  // strings. Rga.KeyboardRegistry owns the normaliser now.

  function _resolveDefaultPanel() {
    const registered = Rga.Shell.Sidebar.registered();
    if (registered.indexOf(DEFAULT_PANEL) >= 0) return DEFAULT_PANEL;
    return registered.length > 0 ? registered[0] : null;
  }

  function _reset() {
    // Pre-Slice-2: removed our own document keydown listener. Now the
    // registry owns the listener; tests that need to wipe bindings
    // call Rga.KeyboardRegistry._reset() directly.
    _initialized = false;
  }

  Rga.Shell.init   = init;
  Rga.Shell._reset = _reset;
})();
