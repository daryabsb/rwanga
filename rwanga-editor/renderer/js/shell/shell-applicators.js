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

  // ----- windowZoom -------------------------------------------------------
  // H5 — Window Zoom slider (RC1 §5.2.5).
  //
  // Maps the user-facing percentage (50–200) to Electron's zoom factor
  // (0.5–2.0) and pushes it through the webFrame.setZoomFactor bridge
  // exposed in electron/preload.js. The factor scales the ENTIRE
  // renderer including the Settings UI itself — that is the constitution-
  // mandated behavior, not a bug.
  //
  // Bridge fallback: when running under jsdom or any non-Electron host
  // (unit tests, headless harnesses), window.rwanga is absent. The
  // applicator becomes a no-op so the registry-driven boot still
  // succeeds; Playwright proves the live-zoom path on a real Electron
  // window.
  function _setZoomFactor(factor) {
    const api = window.rwanga && window.rwanga.window;
    if (!api || typeof api.setZoomFactor !== 'function') return;
    try { api.setZoomFactor(factor); }
    catch (err) { console.warn('[shell-applicators] setZoomFactor threw:', err); }
  }

  register('windowZoom', function(value) {
    let pct;
    if (typeof value === 'number' && Number.isFinite(value)) {
      pct = value;
    } else {
      pct = 100;
    }
    // Defensive clamp matching the registry's min/max so a stale or
    // out-of-band Store value never escapes into webFrame.
    if (pct < 50)  pct = 50;
    if (pct > 200) pct = 200;
    _setZoomFactor(pct / 100);
  }, { owner: 'general' });

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

  // Constitutional helper (H2B). Every production theme-toggle entry
  // point (titlebar button, status bar instrument, command palette,
  // keyboard shortcut, Tools menu) calls this helper instead of
  // Rga.Theme.toggle directly. Intent is explicit: callers do not
  // touch the DOM or localStorage; they write through Settings.Store.
  // The theme applicator below drives Rga.Theme.apply in response.
  window.Rga.SettingsTheme = window.Rga.SettingsTheme || {};
  window.Rga.SettingsTheme.toggle = function() {
    const Theme = window.Rga && window.Rga.Theme;
    const cur = (Theme && Theme.current) || 'dark';   // resolves 'system' to applied literal
    const next = cur === 'light' ? 'dark' : 'light';
    const Store = window.Rga && window.Rga.Settings && window.Rga.Settings.Store;
    if (Store && typeof Store.set === 'function') {
      Store.set('theme', next, { tier: 'user' });
    } else if (Theme && typeof Theme.apply === 'function') {
      Theme.apply(next);   // pre-Store fallback only
    }
  };

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

  // ----- kb.* (H6 — Shortcut applicators) ---------------------------------
  // RC1 §1A.4 wire path for shortcut settings:
  //   UI shortcut control → Settings.Store.set('kb.<id>', combo)
  //                       → kb.<id> applicator (this file)
  //                       → Rga.KeyboardRegistry.register(key, mods, handler)
  //                       → handler invokes the bound command
  //
  // Per-id model: we keep a private map of the LAST KR binding we
  // installed for each kb.* id. When the Store value moves, we unbind
  // the prior combo and install the new one. KR's last-wins semantics
  // mean a fresh applicator install at boot replaces any hardcoded
  // pre-Settings binding (e.g. index.js's Ctrl+B for view.toggleSidebar)
  // — the registry-driven value becomes the source of truth.
  //
  // Command mapping: each kb.* id targets an existing KR command id.
  // The handler calls KR.invokeCommand(commandId), which dispatches to
  // the command's registered handler. For commands not yet wired
  // (kb.commandPalette, kb.save, kb.find, etc. — many landing slices
  // away), invokeCommand returns false silently; the binding is
  // installed but inert. When the underlying command DOES register, it
  // will start firing through the user-chosen combo with no further
  // wiring.
  //
  // Tolerant of missing host APIs (jsdom / headless): if KR is absent,
  // the applicator becomes a no-op and the Store-side state still
  // persists. Playwright proves the rebinding path on real Electron.

  const _KB_COMMAND_MAP = {
    'kb.commandPalette':  'palette.open',
    'kb.save':            'file.save',
    'kb.saveAs':          'file.saveAs',
    'kb.find':            'edit.find',
    'kb.replace':         'edit.replace',
    'kb.toggleSidebar':   'view.toggleSidebar',
    'kb.toggleTheme':     'theme.toggle',
    'kb.exportPdf':       'export.pdf',
    'kb.sceneNavigator':  'panel.sceneNavigator',
    'kb.quickSceneJump':  'nav.quickSceneJump'
  };

  // Token translation from the Settings.Validators.shortcut grammar to
  // the form KeyboardRegistry expects (KeyboardEvent.key, lowercased).
  // Validator stores Title-cased named keys ('Tab', 'Escape', 'Up')
  // and uppercase letters/digits ('A', '5'); KR normalises to
  // KeyboardEvent.key, lower-cased.
  function _comboToKeyOpts(combo) {
    if (typeof combo !== 'string' || combo.length === 0) return null;
    const parts = combo.split('+');
    if (parts.length === 0) return null;
    const last = parts[parts.length - 1];
    const mods = { ctrl: false, shift: false, alt: false };
    for (let i = 0; i < parts.length - 1; i += 1) {
      const m = parts[i];
      if (m === 'Ctrl' || m === 'Meta') mods.ctrl = true;
      else if (m === 'Shift')           mods.shift = true;
      else if (m === 'Alt')             mods.alt   = true;
      else return null;
    }
    let key;
    if (/^[A-Z0-9]$/.test(last))        key = last.toLowerCase();
    else if (/^F([1-9]|1[0-2])$/.test(last)) key = last.toLowerCase();
    else {
      // Map validator named tokens to KeyboardEvent.key (lower-cased).
      const NAMED = {
        Tab:         'tab',
        Space:       ' ',
        Enter:       'enter',
        Escape:      'escape',
        Backspace:   'backspace',
        Delete:      'delete',
        Up:          'arrowup',
        Down:        'arrowdown',
        Left:        'arrowleft',
        Right:       'arrowright',
        Home:        'home',
        End:         'end',
        PageUp:      'pageup',
        PageDown:    'pagedown',
        Insert:      'insert',
        Comma:       ',',
        Period:      '.',
        Slash:       '/',
        Backslash:   '\\',
        Plus:        '+',
        Minus:       '-',
        Equal:       '=',
        Semicolon:   ';',
        Quote:       "'",
        Tick:        '`',
        OpenBracket: '[',
        CloseBracket:']'
      };
      key = NAMED[last];
      if (!key) return null;
    }
    return { key: key, mods: mods };
  }

  // Per-id KR unregister fns so the next apply() can release the prior
  // binding before installing the new one.
  const _kbUnregister = Object.create(null);

  function _installKbBinding(settingId, combo) {
    const prior = _kbUnregister[settingId];
    if (typeof prior === 'function') {
      try { prior(); } catch (_) {}
      _kbUnregister[settingId] = null;
    }
    const KR = window.Rga && window.Rga.KeyboardRegistry;
    if (!KR || typeof KR.register !== 'function') return;

    const parsed = _comboToKeyOpts(combo);
    if (!parsed) return;

    const commandId = _KB_COMMAND_MAP[settingId];
    const source    = 'kb-applicator:' + settingId;
    const unregister = KR.register(
      parsed.key,
      parsed.mods,
      function(e) {
        if (commandId && typeof KR.invokeCommand === 'function') {
          KR.invokeCommand(commandId, e);
        }
      },
      source
    );
    _kbUnregister[settingId] = unregister;
  }

  Object.keys(_KB_COMMAND_MAP).forEach(function(settingId) {
    register(settingId, function(value) {
      if (typeof value !== 'string' || value.length === 0) return;
      _installKbBinding(settingId, value);
    }, { owner: 'shortcuts' });
  });

  // ----- units (S12 — Measurement units) ----------------------------------
  // S12 promotion: the canonical units choice now lives in the Settings
  // Store under id 'units' (user tier). Rga.Units is a thin facade — see
  // renderer/js/units.js. The applicator's job is to fan the Store-side
  // change out to legacy in-memory subscribers (page-setup-dialog,
  // status-bar unit display, etc.) by invoking Rga.Units._notify.
  register('units', function(value) {
    const Units = window.Rga && window.Rga.Units;
    if (!Units || typeof Units._notify !== 'function') return;
    if (typeof value !== 'string' || Units.UNITS.indexOf(value) === -1) return;
    Units._notify(value);
  }, { owner: 'general' });

  // ----- pageSetup.margins (H7 — Margin group) -----------------------------
  // Mirrors the user's margin choice into four CSS custom properties on
  // documentElement: --page-margin-top/right/bottom/left. Today the
  // existing paper-view / manuscript-geometry code reads margins from
  // doc.settings.pageSetup.margins (the legacy doc-scoped path), so
  // these variables do not yet drive a visible surface. The applicator
  // is registered now so the row clears its PERSISTS_ONLY state and a
  // future paper-view consumer can pick the variables up without
  // adding a new applicator (Settings Constitution §1A.4 — registered
  // applicator is the contract that says "this row is wired"; the
  // visible surface is intentionally deferred per the H7 brief which
  // forbids paper-preview work).
  //
  // Clamping: the control already clamps to [0, 3]. The applicator
  // re-applies the same clamp defensively so a stale or programmatic
  // Store.set with out-of-band values cannot push absurd inline CSS
  // variables that another consumer might honor.
  function _clampMargin(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return null;
    if (n < 0) return 0;
    if (n > 3) return 3;
    return n;
  }
  register('pageSetup.margins', function(value) {
    if (!document.documentElement) return;
    if (!value || typeof value !== 'object') {
      ['top', 'right', 'bottom', 'left'].forEach(function(k) {
        document.documentElement.style.removeProperty('--page-margin-' + k);
      });
      return;
    }
    ['top', 'right', 'bottom', 'left'].forEach(function(k) {
      const clamped = _clampMargin(value[k]);
      if (clamped === null) {
        document.documentElement.style.removeProperty('--page-margin-' + k);
      } else {
        document.documentElement.style.setProperty(
          '--page-margin-' + k, String(clamped) + 'in');
      }
    });
  }, { owner: 'pageSetup' });
})();
