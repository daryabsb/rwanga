// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Shell.Responsive — automatic shell mode transitions.
//
// SINGLE responsibility: watch the window, decide a mode, apply shell
// classes. CSS reacts to the classes. The engine never touches a
// specific element by name and never carries a literal pixel breakpoint
// — every threshold is DERIVED from the CSS variables the workspace
// grid already consumes (--activity-bar-width / --sidebar-width /
// --inspector-width / --page-width), so re-tuning a panel width or
// page size automatically shifts the mode thresholds without code
// changes.
//
// Mode classes applied to #app:
//   .mode-wide     editor track >= page-width + shell fixed cost
//   .mode-compact  editor track >= 0.6 * page-width + shell fixed cost
//   .mode-narrow   smaller — aggressive collapse
//
// Per-zone routing (engine NEVER writes DOM classes directly — it
// calls public APIs so existing single-writer invariants like G12
// stay intact):
//   inspector → Rga.Shell.StudioPanel.{toggleInspector|openInspector}
//               with {userInitiated: false} so override is not set
//   sidebar   → Rga.Shell.Layout.set({sidebar:{visible}}); the engine's
//               Layout subscriber translates the boolean to the DOM
//               class. Engine never sets sidebar.userOverride; that
//               flag is owned by the user-initiated paths
//               (activity-rail click, Cmd-B, etc.).
//
// userOverride contract:
//   When a user manually toggles a zone, that zone's userOverride is
//   set to true. The engine reads userOverride before applying any
//   auto-collapse to that zone — true means "user expressed a
//   preference, don't fight them." Session-scoped (not persisted).
//
// Hysteresis: 40px buffer at each boundary prevents flapping when the
// user drags the window across a threshold pixel.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};

  const MODE_CLASSES = ['mode-wide', 'mode-compact', 'mode-narrow'];
  const HYSTERESIS_PX = 40;
  const RESIZE_DEBOUNCE_MS = 100;
  const HANDLE_WIDTH_PX = 8;   // two 4px resize handles in the workspace grid

  let _initialized = false;
  let _currentMode = null;
  let _resizeTimer = null;
  let _unsubLayout = null;
  let _boundResizeHandler = null;

  // ----------------------------------------------------------------
  // CSS variable reading — every breakpoint is derived, never literal.
  // ----------------------------------------------------------------

  function _readVarPx(name, fallback) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
    const trimmed = (raw || '').trim();
    if (!trimmed) return fallback;
    const m = trimmed.match(/^(-?\d*\.?\d+)\s*([a-z%]*)$/i);
    if (!m) return fallback;
    const num = parseFloat(m[1]);
    const unit = (m[2] || 'px').toLowerCase();
    if (isNaN(num)) return fallback;
    if (unit === 'px' || unit === '') return num;
    if (unit === 'in') return num * 96;
    if (unit === 'cm') return num * 37.795;
    if (unit === 'mm') return num * 3.7795;
    if (unit === 'pt') return num * (96 / 72);
    if (unit === 'rem' || unit === 'em') return num * 16; // approx
    return fallback;
  }

  function _shellFixedCost() {
    const rail = _readVarPx('--activity-bar-width', 48);
    const side = _readVarPx('--sidebar-width',      260);
    const insp = _readVarPx('--inspector-width',    280);
    return rail + side + insp + HANDLE_WIDTH_PX;
  }

  function _pageWidthPx() {
    return _readVarPx('--page-width', 816);
  }

  // ----------------------------------------------------------------
  // Mode decision — pure function of window width + derived constants.
  // Exposed for tests via Rga.Shell.Responsive._decideMode.
  // ----------------------------------------------------------------

  function _decideMode(windowWidth) {
    const cost = _shellFixedCost();
    const page = _pageWidthPx();
    const wideThreshold    = cost + page;
    const compactThreshold = cost + page * 0.6;
    if (windowWidth >= wideThreshold)    return 'wide';
    if (windowWidth >= compactThreshold) return 'compact';
    return 'narrow';
  }

  function _modeOrder(mode) {
    if (mode === 'wide')    return 2;
    if (mode === 'compact') return 1;
    return 0;
  }

  // ----------------------------------------------------------------
  // Apply / route
  // ----------------------------------------------------------------

  function _maybeApply() {
    const w = window.innerWidth;
    const desired = _decideMode(w);
    if (desired === _currentMode) return;

    if (_currentMode) {
      // Hysteresis: switching UP a mode (toward wide) requires
      // exceeding the threshold by HYSTERESIS_PX; switching DOWN
      // requires falling below the threshold by HYSTERESIS_PX. This
      // gives a 80px "neutral zone" at each boundary inside which
      // the current mode sticks — prevents flapping when the user
      // drags the window right on a threshold pixel.
      const cost = _shellFixedCost();
      const page = _pageWidthPx();
      const wideT    = cost + page;
      const compactT = cost + page * 0.6;
      const goingUp = _modeOrder(desired) > _modeOrder(_currentMode);
      if (goingUp) {
        if (desired === 'compact' && w < compactT + HYSTERESIS_PX) return;
        if (desired === 'wide'    && w < wideT    + HYSTERESIS_PX) return;
      } else {
        if (_currentMode === 'wide'    && w > wideT    - HYSTERESIS_PX) return;
        if (_currentMode === 'compact' && w > compactT - HYSTERESIS_PX) return;
      }
    }

    _applyMode(desired);
  }

  function _applyMode(mode) {
    const app = document.getElementById('app');
    if (!app) return;
    MODE_CLASSES.forEach(function(c) {
      if (c === 'mode-' + mode) app.classList.add(c);
      else                       app.classList.remove(c);
    });
    _currentMode = mode;

    const layout = (Rga.Shell.Layout && typeof Rga.Shell.Layout.get === 'function')
      ? Rga.Shell.Layout.get()
      : null;
    if (!layout) return;

    _routeInspector(mode !== 'wide', layout);
    _routeSidebar(mode === 'narrow', layout);
  }

  // Inspector first-class contract: the engine ALWAYS applies its
  // mode-based decision on screen-size change. The user can manually
  // toggle the inspector within a mode (no engine fire, so the toggle
  // sticks), but the next mode transition re-applies the engine's
  // preferred state. Rationale: in compact/narrow modes the editor
  // needs the space; allowing a userOverride to keep the inspector
  // expanded would block the manuscript. Full-close is still forbidden
  // (see resize.js drag clamp + StudioPanel._ensureExpandedWidth),
  // but auto-collapse on screen change is required.
  function _routeInspector(shouldBeCollapsed, layout) {
    if (!Rga.Shell.StudioPanel) return;
    const ws = document.getElementById('workspace');
    if (!ws) return;
    const isCollapsed = ws.classList.contains('inspector-collapsed');
    if (shouldBeCollapsed && !isCollapsed) {
      Rga.Shell.StudioPanel.toggleInspector({ userInitiated: false });
    } else if (!shouldBeCollapsed && isCollapsed) {
      Rga.Shell.StudioPanel.openInspector({ userInitiated: false });
    }
  }

  function _routeSidebar(shouldBeCollapsed, layout) {
    if (layout.sidebar && layout.sidebar.userOverride) return;
    const want = !shouldBeCollapsed;
    if (!layout.sidebar || layout.sidebar.visible === want) return;
    if (!Rga.Shell.Layout || typeof Rga.Shell.Layout.set !== 'function') return;
    Rga.Shell.Layout.set({ sidebar: { visible: want } });
    // _applySidebarClass fires from the Layout subscriber below.
  }

  // ----------------------------------------------------------------
  // Sidebar DOM class — single writer for #workspace.sidebar-collapsed
  // (no other module currently writes this class; this engine owns it).
  // ----------------------------------------------------------------

  function _applySidebarClass(visible) {
    const ws = document.getElementById('workspace');
    if (!ws) return;
    if (visible) ws.classList.remove('sidebar-collapsed');
    else         ws.classList.add('sidebar-collapsed');
  }

  // ----------------------------------------------------------------
  // Resize handling — debounced.
  // ----------------------------------------------------------------

  function _onWindowResize() {
    if (_resizeTimer) return;
    _resizeTimer = setTimeout(function() {
      _resizeTimer = null;
      _maybeApply();
    }, RESIZE_DEBOUNCE_MS);
  }

  // ----------------------------------------------------------------
  // Init / lifecycle
  // ----------------------------------------------------------------

  function init() {
    if (_initialized) return;
    _initialized = true;

    // First-paint mode decision.
    _maybeApply();

    // Apply the current Layout.sidebar.visible to the DOM class
    // immediately — fixes Cmd-B / activity-rail clicks which set the
    // Layout boolean but previously had no DOM consumer.
    if (Rga.Shell.Layout && typeof Rga.Shell.Layout.get === 'function') {
      const initial = Rga.Shell.Layout.get();
      if (initial && initial.sidebar) _applySidebarClass(initial.sidebar.visible);
    }

    // Stay in sync with Layout changes (Cmd-B, activity-rail clicks,
    // restored workspace state, etc.).
    if (Rga.Shell.Layout && typeof Rga.Shell.Layout.subscribe === 'function') {
      _unsubLayout = Rga.Shell.Layout.subscribe(function(next, prev) {
        if (!next || !prev) return;
        if (next.sidebar && prev.sidebar &&
            next.sidebar.visible !== prev.sidebar.visible) {
          _applySidebarClass(next.sidebar.visible);
        }
      });
    }

    _boundResizeHandler = _onWindowResize;
    window.addEventListener('resize', _boundResizeHandler);
  }

  function currentMode() { return _currentMode; }

  function _reset() {
    if (_unsubLayout) { _unsubLayout(); _unsubLayout = null; }
    if (_resizeTimer) { clearTimeout(_resizeTimer); _resizeTimer = null; }
    if (_boundResizeHandler) {
      window.removeEventListener('resize', _boundResizeHandler);
      _boundResizeHandler = null;
    }
    _initialized = false;
    _currentMode = null;
  }

  Rga.Shell.Responsive = {
    init: init,
    currentMode: currentMode,
    // Exposed for tests + external triggers.
    _decideMode: _decideMode,
    _maybeApply: _maybeApply,
    _reset: _reset
  };
})();
