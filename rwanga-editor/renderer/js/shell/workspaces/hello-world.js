// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Slice 1 wiring proof — the smallest possible workspace tab.
// Confirms TabManager.openWorkspace + Rga.Workspaces.register +
// the #tab-content-host visibility toggle work end-to-end.
//
// This is NOT user-facing. There is no menu item, no shortcut, no
// command palette entry. Trigger from devtools during verification:
//   Rga.TabManager.openWorkspace('hello-world')
//
// Will be removed (or kept as a debug aid) once Settings ships as the
// first real workspace tab.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Workspaces || typeof Rga.Workspaces.register !== 'function') return;

  Rga.Workspaces.register({
    kind: 'hello-world',
    title: 'Hello World',
    restoreOnSession: false,
    mount: function(el) {
      el.innerHTML = '<div class="hw-proof">Workspace tab works</div>';
    },
    unmount: function(el) {
      el.innerHTML = '';
    }
  });
})();
