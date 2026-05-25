// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Shell / appearance settings applicators — Slice 4B.
//
// Wires the appearance.* settings that have real, low-risk
// behavior today. Each handler is one register() call against
// Rga.Settings.Applicators (Slice 3D); the registry owns the
// Store subscription and the boot-time applyAll() fanout.
//
// Wired:
//   - appearance.editorDeskColor → --editor-bg on documentElement
//   - appearance.statusBar       → toggle .rga-no-status-bar on <body>
//                                  (CSS hides #status-bar and zeroes
//                                  --status-bar-height when present)
//
// Intentionally deferred (Slice 4B scope forbids fake behavior):
//   - theme                       → Rga.Theme is the existing
//                                  localStorage SSOT; wiring through
//                                  Settings.Store without a migration
//                                  would silently overwrite users'
//                                  prior theme choices on first boot.
//                                  Requires a migration slice.
//   - appearance.sidebarPosition  → multiple grid-template-columns
//                                  definitions need reworking; out of
//                                  scope for an applicator slice.
//   - appearance.activityBar      → same hide-by-class pattern as
//   - appearance.formatToolbar     statusBar but each introduces a
//                                  new empty-grid-track visual state
//                                  that needs responsive-shell and
//                                  a11y verification beyond owned
//                                  tests; queued for follow-up.
//   - appearance.minimap          → overview engine does not exist.
//   - appearance.editorPageShadow → touches paper-view CSS ownership;
//                                  defer to a paper-view slice.
//
// User-listed candidates not present in the registry (cannot wire
// without a registry slice to add them): accentColor, uiDensity,
// reduceMotion, inspectorCollapseMode.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Settings || !Rga.Settings.Applicators ||
      typeof Rga.Settings.Applicators.register !== 'function') {
    return;
  }

  const register = Rga.Settings.Applicators.register;
  const HIDE_STATUS_BAR_CLASS = 'rga-no-status-bar';

  // ----- appearance.editorDeskColor ---------------------------------------
  // Overrides the --editor-bg token at the documentElement level so
  // every CSS rule that reads var(--editor-bg) picks up the user's
  // chosen hex. The color validator (Slice 3C) accepts only 6-digit
  // hex; invalid values never reach this handler.
  register('appearance.editorDeskColor', function(value) {
    document.documentElement.style.setProperty('--editor-bg', String(value));
  }, { owner: 'appearance' });

  // ----- appearance.statusBar ---------------------------------------------
  // Toggles a class on <body>. CSS in shell.css responds to the class
  // by hiding #status-bar and zeroing --status-bar-height so the
  // grid row collapses. Default registry value (true) → no class →
  // status bar visible.
  register('appearance.statusBar', function(value) {
    if (!document.body) return;
    document.body.classList.toggle(HIDE_STATUS_BAR_CLASS, !value);
  }, { owner: 'appearance' });
})();
