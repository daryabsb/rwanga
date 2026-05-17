// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Revisions panel placeholder (slice-1 plan §3.7; writer-vocab plan §5.5).
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
      container.innerHTML = '';
      const el = document.createElement('div');
      el.className = 'rga-shell-panel-placeholder';
      el.textContent = 'Version history is coming in 0.2. For now, your scripts are auto-saved every 30 seconds — see Storage in Settings for autosaves.';
      container.appendChild(el);
    },
    unmount: function() {}
  });
})();
