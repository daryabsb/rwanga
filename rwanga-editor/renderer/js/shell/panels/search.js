// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Search panel placeholder (slice-1 plan §3.7).
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
      container.innerHTML = '';
      const el = document.createElement('div');
      el.className = 'rga-shell-panel-placeholder';
      el.textContent = 'Cross-script search arrives in 0.2. For now, find-in-script is on the editor\'s right-click menu.';
      container.appendChild(el);
    },
    unmount: function() {}
  });
})();
