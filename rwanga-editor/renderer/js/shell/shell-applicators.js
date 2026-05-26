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
//   - theme                       → Rga.Theme.apply, resolving 'system'
//                                  via matchMedia (H2 — Theme
//                                  Constitutional Activation).
//
// Theme bridge contract (H2):
//   The Settings store is canonical for the user's CHOICE
//   ('dark' | 'light' | 'system'). Rga.Theme remains the SSOT for the
//   RESOLVED theme that actually paints ('dark' | 'light'). The
//   applicator maps choice → resolved and pushes through Rga.Theme.
//   An inverse-sync hook reflects Rga.Theme changes (e.g. from
//   Ctrl+Shift+T) back into the Store. The legacy localStorage key
//   `rga-theme` is migrated once at boot by settings-migrations.js.
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

  // Drift guard (post-Slice-5B fix): setProperty-style applicators
  // must only push an inline CSS variable when the user has explicitly
  // chosen a non-builtin value. Pushing the registry default inline
  // would override theme-scoped tokens (e.g. [data-theme="light"]
  // { --editor-bg: #d6d6d6 }) because inline styles win over selector
  // specificity, turning light theme black on first boot. When no
  // override exists, remove any inline value so theme tokens flow.
  function _hasUserOverride(id) {
    const Store = Rga.Settings && Rga.Settings.Store;
    if (!Store || typeof Store.get !== 'function') return false;
    return Store.get(id, 'user')    !== undefined
        || Store.get(id, 'session') !== undefined
        || Store.get(id, 'script')  !== undefined;
  }

  // ----- appearance.editorDeskColor ---------------------------------------
  // Overrides the --editor-bg token at the documentElement level so
  // every CSS rule that reads var(--editor-bg) picks up the user's
  // chosen hex. The color validator (Slice 3C) accepts only 6-digit
  // hex; invalid values never reach this handler.
  //
  // Only sets the inline value when the user has actually chosen one
  // (see _hasUserOverride above) — otherwise theme tokens own the
  // desk color, so [data-theme="light"] gets its #d6d6d6 desk back.
  register('appearance.editorDeskColor', function(value, id) {
    if (!_hasUserOverride(id)) {
      document.documentElement.style.removeProperty('--editor-bg');
      return;
    }
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

  // ----- theme ------------------------------------------------------------
  // Bridges the Settings store choice to Rga.Theme. Re-entrancy is
  // guarded by a shared flag so the inverse-sync hook (Rga.Theme ->
  // Store) doesn't loop. 'system' resolution subscribes to matchMedia
  // once and re-resolves on OS-theme change while 'system' is active.
  //
  // The inverse-sync hook is installed lazily on first invocation
  // because Rga.Theme is defined in app-shell.js which loads AFTER
  // this file in renderer/index.html. By the time applyAll() runs,
  // Rga.Theme.init() has already executed.

  let _themeSyncInProgress = false;
  let _currentThemeSetting = null;
  let _mediaQuery          = null;
  let _mediaListener       = null;
  let _inverseSyncInstalled = false;

  function _resolveSystem() {
    if (!_mediaQuery && typeof window.matchMedia === 'function') {
      try { _mediaQuery = window.matchMedia('(prefers-color-scheme: dark)'); }
      catch (_) { _mediaQuery = null; }
    }
    return (_mediaQuery && _mediaQuery.matches) ? 'dark' : 'light';
  }

  function _attachMediaListener() {
    if (!_mediaQuery || _mediaListener) return;
    _mediaListener = function() {
      if (_currentThemeSetting !== 'system') return;
      const resolved = _mediaQuery.matches ? 'dark' : 'light';
      if (window.Rga && window.Rga.Theme && window.Rga.Theme.current !== resolved) {
        _themeSyncInProgress = true;
        try { window.Rga.Theme.apply(resolved); }
        finally { _themeSyncInProgress = false; }
      }
    };
    if (typeof _mediaQuery.addEventListener === 'function') {
      _mediaQuery.addEventListener('change', _mediaListener);
    } else if (typeof _mediaQuery.addListener === 'function') {
      _mediaQuery.addListener(_mediaListener);
    }
  }

  function _detachMediaListener() {
    if (!_mediaQuery || !_mediaListener) return;
    if (typeof _mediaQuery.removeEventListener === 'function') {
      _mediaQuery.removeEventListener('change', _mediaListener);
    } else if (typeof _mediaQuery.removeListener === 'function') {
      _mediaQuery.removeListener(_mediaListener);
    }
    _mediaListener = null;
  }

  function _ensureInverseSync() {
    if (_inverseSyncInstalled) return;
    const Theme = window.Rga && window.Rga.Theme;
    if (!Theme || typeof Theme.onChange !== 'function') return;
    Theme.onChange(function(next) {
      if (_themeSyncInProgress) return;
      // A non-suppressed Rga.Theme change means the user invoked
      // Ctrl+Shift+T (or some other direct path). Reflect into Store
      // as an explicit user choice — this overrides 'system' if it
      // was the prior setting, which matches the intent of an
      // explicit toggle.
      const Store = window.Rga && window.Rga.Settings && window.Rga.Settings.Store;
      if (!Store || typeof Store.set !== 'function') return;
      Store.set('theme', next);
    });
    _inverseSyncInstalled = true;
  }

  register('theme', function(value) {
    _ensureInverseSync();
    _currentThemeSetting = value;
    const Theme = window.Rga && window.Rga.Theme;
    if (!Theme || typeof Theme.apply !== 'function') return;

    let resolved;
    if (value === 'system') {
      resolved = _resolveSystem();
      _attachMediaListener();
    } else {
      resolved = value;
      _detachMediaListener();
    }
    if (resolved !== 'dark' && resolved !== 'light') return;
    if (Theme.current === resolved) return;
    _themeSyncInProgress = true;
    try { Theme.apply(resolved); }
    finally { _themeSyncInProgress = false; }
  }, { owner: 'appearance' });
})();
