// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Characters panel placeholder (slice-1 plan §3.7).
// Bundle 1 §B: unified empty-state pattern + writer-voice copy.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Shell || !Rga.Shell.Sidebar || typeof Rga.Shell.Sidebar.registerPanel !== 'function') return;
  Rga.Shell.Sidebar.registerPanel({
    id: 'characters',
    label: 'Characters',
    icon: 'users',
    shortcut: 'Cmd-Shift-C',
    available: false,
    mount: function(container) {
      if (!container) return;
      Rga.Shell.Sidebar.renderEmpty(container, {
        title: 'Characters',
        body: 'Your characters will appear here as you write.'
      });
    },
    unmount: function() {}
  });
})();
