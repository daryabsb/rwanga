// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Characters panel placeholder (slice-1 plan §3.7).
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
      container.innerHTML = '';
      const el = document.createElement('div');
      el.className = 'rga-shell-panel-placeholder';
      el.textContent = 'Characters panel arrives in 0.2. For now, see the Breakdown tab in the Bottom Panel for tag-driven character listings.';
      container.appendChild(el);
    },
    unmount: function() {}
  });
})();
