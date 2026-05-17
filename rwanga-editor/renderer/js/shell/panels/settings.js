// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings panel placeholder (slice-1 plan §3.7).
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
      container.innerHTML = '';
      const el = document.createElement('div');
      el.className = 'rga-shell-panel-placeholder';
      el.textContent = 'Settings UI arrives in 0.2. Edit ~/.rwanga/settings.json directly to customize.';
      container.appendChild(el);
    },
    unmount: function() {}
  });
})();
