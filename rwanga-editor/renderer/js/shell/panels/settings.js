// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings sidebar-panel — REGISTRATION-ONLY shim.
//
// Settings is a workspace tab, not a sidebar panel. The registration
// below exists purely so the rail's bottom-group button renders
// (the rail builds buttons from Rga.Shell.Sidebar.registered()).
//
// Two safety paths guarantee there is exactly ONE Settings surface:
//   1. The rail's _onClick short-circuits on id === 'settings' and
//      calls Rga.SettingsWorkspace.open() directly (see activity-
//      rail.js). The mount() below is never reached on a normal
//      rail click.
//   2. Belt-and-suspenders: if any other surface programmatically
//      calls Rga.Shell.Sidebar.activate('settings') (command palette,
//      future code, dev console), mount() below redirects to the
//      canonical opener and deactivates the sidebar so no empty-
//      state UI ever renders inside the sidebar slot.
//
// No empty-state, no descriptive copy, no UI — this file is a
// reachability shim, not a surface.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Shell || !Rga.Shell.Sidebar ||
      typeof Rga.Shell.Sidebar.registerPanel !== 'function') return;

  Rga.Shell.Sidebar.registerPanel({
    id:        'settings',
    label:     'Settings',
    icon:      'settings',
    shortcut:  'Ctrl+,',
    available: false,
    mount: function() {
      // Redirect to the canonical workspace opener. Deactivate the
      // sidebar so the rail click visual stays clean if this path is
      // ever hit programmatically.
      if (Rga.SettingsWorkspace && typeof Rga.SettingsWorkspace.open === 'function') {
        Rga.SettingsWorkspace.open();
      }
      if (typeof Rga.Shell.Sidebar.deactivate === 'function') {
        try { Rga.Shell.Sidebar.deactivate(); } catch (_) {}
      }
      if (Rga.Shell.Layout && typeof Rga.Shell.Layout.set === 'function') {
        try { Rga.Shell.Layout.set({ sidebar: { visible: false } }); } catch (_) {}
      }
    },
    unmount: function() {}
  });
})();
