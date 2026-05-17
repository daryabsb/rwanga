// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings panel placeholder (slice-1 plan §3.7).
// Bundle 1 §B: unified empty-state pattern + writer-voice copy.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Shell || !Rga.Shell.Sidebar || typeof Rga.Shell.Sidebar.registerPanel !== 'function') return;
  Rga.Shell.Sidebar.registerPanel({
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    shortcut: 'Cmd-,',
    available: false,
    mount: function(container) {
      if (!container) return;
      Rga.Shell.Sidebar.renderEmpty(container, {
        title: 'Settings',
        body: 'Settings will live here. (Power users can edit the settings file directly today.)'
      });
    },
    unmount: function() {}
  });
})();
