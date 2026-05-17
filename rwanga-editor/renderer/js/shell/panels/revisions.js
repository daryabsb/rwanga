// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Revisions panel placeholder (slice-1 plan §3.7; writer-vocab plan §5.5).
// Bundle 1 §B: unified empty-state pattern + writer-voice copy.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Shell || !Rga.Shell.Sidebar || typeof Rga.Shell.Sidebar.registerPanel !== 'function') return;
  Rga.Shell.Sidebar.registerPanel({
    id: 'revisions',
    label: 'Revisions',
    icon: 'history',
    shortcut: 'Cmd-Shift-R',
    available: false,
    mount: function(container) {
      if (!container) return;
      Rga.Shell.Sidebar.renderEmpty(container, {
        title: 'Revisions',
        body: 'Revisions will let you see every change you made. Your work is auto-saved while we build this.'
      });
    },
    unmount: function() {}
  });
})();
