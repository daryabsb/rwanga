// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Search panel placeholder (slice-1 plan §3.7).
// Bundle 1 §B: unified empty-state pattern + writer-voice copy.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Shell || !Rga.Shell.Sidebar || typeof Rga.Shell.Sidebar.registerPanel !== 'function') return;
  Rga.Shell.Sidebar.registerPanel({
    id: 'search',
    label: 'Search',
    icon: 'search',
    shortcut: 'Cmd-Shift-F',
    available: false,
    mount: function(container) {
      if (!container) return;
      Rga.Shell.Sidebar.renderEmpty(container, {
        title: 'Search',
        body: 'Search across your scripts will live here. Try right-click → Find in this script for now.'
      });
    },
    unmount: function() {}
  });
})();
