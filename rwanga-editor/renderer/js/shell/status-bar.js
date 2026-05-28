// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Shell.StatusBar — 22px bottom strip with three sections.
// Plan §3.4 / Studio Shell Recovery §F (three-section layout).
//
// Filmustageation F1A.4 (2026-05-28) — status-bar contribution API.
// CORE owns the frame (#status-bar, the three section wrappers, the
// span anatomy, the registry). Plugins own their segments.
//
// CORE-built-in segments (document-neutral):
//   - offline   (left,  order 10)  — static "Local" indicator
//   - wordCount (right, order 100) — Rga.ScriptMetrics.wordCount
//   - viewMode  (right, order 110) — Rga.ScriptSession.currentView select
//   - theme     (right, order 130) — Rga.Theme.current text instrument
//
// Plugin-contributed segments live OUTSIDE this module and call
// Rga.Shell.StatusBar.registerSegment(controller) at script-load time.
// The screenplay plugin contributes:
//   - scene     (left,   order 20)  — current scene number
//   - blockType (center, order 50)  — current block type label
//   - page      (center, order 60)  — current page / total
//   - language  (right,  order 120) — doc.metadata.screenplayProfile.language
//
// Display order — `section` first, then `order` (ascending). Visible
// behaviour pre-F1A.4 is preserved exactly when the screenplay plugin
// contributes its four segments at boot.
//
// Each segment supplies a `mount(spanEl) → cleanupFn?` function and is
// responsible for its own subscriptions. CORE never reads plugin-shaped
// document metadata directly — that was the pre-F1A.4 violation, removed
// by moving the screenplayProfile.language read into screenplay's
// contribution file.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};
  Rga.Shell.StatusBar = Rga.Shell.StatusBar || {};

  // -- Section ordering ------------------------------------------------------
  const SECTION_ORDER = ['left', 'center', 'right'];
  const SECTION_INDEX = { left: 0, center: 1, right: 2 };

  // -- Module state ----------------------------------------------------------
  let _container = null;
  let _sections = {};                  // { left, center, right } → div
  // Registered segments: id → controller. Order-preserved by insertion
  // for tie-breaking when two segments declare the same `order`.
  const _segments = new Map();
  // Mounted spans + cleanups (populated at init / register after init).
  const _spans = new Map();            // id → span element
  const _cleanups = new Map();         // id → cleanup fn returned by mount
  // Lifecycle flag — false until init() runs. registerSegment before
  // init queues; after init mounts immediately.
  let _initialized = false;

  // ==========================================================================
  // CORE built-in segments
  // ==========================================================================
  //
  // Each is a controller registered into _segments BEFORE init runs. They
  // use the same shape plugin segments use, so the build path is uniform.

  function _coreOfflineController() {
    return {
      id:        'offline',
      section:   'left',
      order:     10,
      className: 'rga-shell-status-offline',
      mount: function(spanEl) {
        spanEl.textContent = 'Local';
        return null;   // static; no subscription, no cleanup needed
      }
    };
  }

  function _coreWordCountController() {
    return {
      id:        'wordCount',
      section:   'right',
      order:     100,
      className: 'rga-shell-status-wordcount',
      mount: function(spanEl) {
        // Initial render + subscribe. ScriptSession is the cheap trigger
        // (it dispatches when ANY writer-context field changes, including
        // selection moves that change the active scene/block); we re-derive
        // wordCount via ScriptMetrics on each notification.
        _renderWordCount(spanEl);
        const SS = window.Rga && window.Rga.ScriptSession;
        if (!SS || typeof SS.subscribe !== 'function') return null;
        return SS.subscribe(function() { _renderWordCount(spanEl); });
      }
    };
  }

  function _renderWordCount(spanEl) {
    const sm = (window.Rga && window.Rga.ScriptMetrics
                 && typeof window.Rga.ScriptMetrics.get === 'function')
      ? window.Rga.ScriptMetrics.get() : null;
    const wc = sm && sm.wordCount;
    if (wc == null) { spanEl.textContent = '— words'; return; }
    if (wc === 1)  { spanEl.textContent = '1 word'; return; }
    spanEl.textContent = _formatThousands(wc) + ' words';
  }

  function _formatThousands(n) {
    // Plain JS (no Intl dependency — platform portability).
    const s = String(Math.max(0, Math.floor(n)));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function _coreViewModeController() {
    return {
      id:        'viewMode',
      section:   'right',
      order:     110,
      className: 'rga-shell-status-viewmode',
      mount: function(spanEl) {
        const prefix = document.createElement('span');
        prefix.className = 'rga-shell-status-viewmode-prefix';
        prefix.textContent = 'View:';
        spanEl.appendChild(prefix);

        const select = document.createElement('select');
        select.className = 'rga-shell-status-viewmode-select';
        select.setAttribute('aria-label', 'Switch view mode');
        [['flow', 'Flow'], ['draft', 'Draft'], ['print', 'Print']].forEach(function(pair) {
          const opt = document.createElement('option');
          opt.value = pair[0];
          opt.textContent = pair[1];
          select.appendChild(opt);
        });
        // Bundle 1 §A / D.1 / SP-07 — Print Preview is a live option.
        const pp = document.createElement('option');
        pp.value = 'printPreview';
        pp.textContent = 'Print Preview';
        select.appendChild(pp);

        select.addEventListener('change', _onViewModeChange);
        spanEl.appendChild(select);

        // Initial sync + subscribe.
        _renderViewModeSelect(select);
        const SS = window.Rga && window.Rga.ScriptSession;
        if (!SS || typeof SS.subscribe !== 'function') return null;
        return SS.subscribe(function() { _renderViewModeSelect(select); });
      }
    };
  }

  function _renderViewModeSelect(select) {
    const SS = window.Rga && window.Rga.ScriptSession;
    const snap = SS && typeof SS.get === 'function' ? SS.get() : null;
    const v = snap && snap.currentView;
    if (v == null) return;
    if (Array.prototype.some.call(select.options, function(o) { return o.value === v; })) {
      select.value = v;
    }
  }

  function _onViewModeChange(e) {
    const mode = e && e.target && e.target.value;
    if (!mode) return;
    if (mode === 'printPreview') {
      if (window.Rga && window.Rga.PrintPreview
          && typeof window.Rga.PrintPreview.open === 'function') {
        window.Rga.PrintPreview.open();
      }
      return;
    }
    if (window.Rga && window.Rga.ViewMode
        && typeof window.Rga.ViewMode.set === 'function') {
      window.Rga.ViewMode.set(mode);
    }
  }

  function _coreThemeController() {
    return {
      id:        'theme',
      section:   'right',
      order:     130,
      className: 'rga-shell-status-theme',
      mount: function(spanEl) {
        spanEl.textContent = _themeLabel();
        spanEl.setAttribute('role', 'button');
        spanEl.setAttribute('aria-label', 'Toggle theme');
        spanEl.addEventListener('click', _onThemeClick);
        const T = window.Rga && window.Rga.Theme;
        if (!T || typeof T.onChange !== 'function') return null;
        return T.onChange(function() { spanEl.textContent = _themeLabel(); });
      }
    };
  }

  function _themeLabel() {
    const t = (window.Rga && window.Rga.Theme && window.Rga.Theme.current) || 'dark';
    return t === 'light' ? 'Light' : 'Dark';
  }

  function _onThemeClick() {
    // H2B constitutional path — Settings.Store is the SSOT.
    if (window.Rga && window.Rga.SettingsTheme
        && typeof window.Rga.SettingsTheme.toggle === 'function') {
      window.Rga.SettingsTheme.toggle();
    }
  }

  // ==========================================================================
  // Registration API (F1A.4 — contribution surface for plugins)
  // ==========================================================================

  function registerSegment(controller) {
    if (!_isValidController(controller)) return false;
    if (_segments.has(controller.id)) return false;   // duplicate — reject
    _segments.set(controller.id, controller);
    if (_initialized) _mountSegmentNow(controller);
    return true;
  }

  function unregisterSegment(id) {
    if (typeof id !== 'string' || !_segments.has(id)) return false;
    const cleanup = _cleanups.get(id);
    if (typeof cleanup === 'function') {
      try { cleanup(); }
      catch (err) { console.error('[Rga.Shell.StatusBar] cleanup threw for "' + id + '":', err); }
    }
    const ctrl = _segments.get(id);
    const span = _spans.get(id);
    if (ctrl && typeof ctrl.unmount === 'function' && span) {
      try { ctrl.unmount(span); }
      catch (err) { console.error('[Rga.Shell.StatusBar] unmount threw for "' + id + '":', err); }
    }
    if (span && span.parentNode) span.parentNode.removeChild(span);
    _spans.delete(id);
    _cleanups.delete(id);
    _segments.delete(id);
    return true;
  }

  function registered() {
    return Array.from(_segments.keys());
  }

  function _isValidController(c) {
    if (!c || typeof c !== 'object') return false;
    if (typeof c.id !== 'string' || c.id.length === 0) return false;
    if (typeof c.section !== 'string' || !SECTION_INDEX.hasOwnProperty(c.section)) return false;
    if (typeof c.mount !== 'function') return false;
    if (c.order != null && typeof c.order !== 'number') return false;
    return true;
  }

  // ==========================================================================
  // CORE registers its own segments at module load. Doing it here keeps
  // the build/mount path uniform between CORE and plugin segments.
  // ==========================================================================
  [
    _coreOfflineController(),
    _coreWordCountController(),
    _coreViewModeController(),
    _coreThemeController()
  ].forEach(function(c) { _segments.set(c.id, c); });

  // ==========================================================================
  // Lifecycle (init / refresh / _reset)
  // ==========================================================================

  function init(container) {
    if (!container) return false;
    _container = container;
    _build();
    _initialized = true;
    // Mount every currently-registered segment (CORE + any plugin that
    // registered BEFORE init). Sort by (section_index, order, insertion).
    _orderedControllers().forEach(_mountSegmentNow);
    return true;
  }

  function _build() {
    _container.innerHTML = '';
    _container.classList.add('rga-shell-statusbar');
    _sections = {
      left:   _appendSection('rga-shell-statusbar-left'),
      center: _appendSection('rga-shell-statusbar-center'),
      right:  _appendSection('rga-shell-statusbar-right')
    };
  }

  function _appendSection(cls) {
    const sec = document.createElement('div');
    sec.className = 'rga-shell-statusbar-section ' + cls;
    _container.appendChild(sec);
    return sec;
  }

  // Mounting is order-sensitive: when a plugin registers AFTER init we
  // must insert its span in the right position within its section. We
  // recompute the section's expected order each time.
  function _mountSegmentNow(ctrl) {
    if (!_container || !_sections[ctrl.section]) return;
    const span = document.createElement('span');
    span.className = 'rga-shell-status-segment ' + (ctrl.className || '');
    span.setAttribute('data-segment', ctrl.id);
    _insertSpanInSectionOrder(ctrl, span);
    _spans.set(ctrl.id, span);
    // Mount returns a cleanup fn (or void/null). A throw is caught so a
    // buggy segment never blocks the rest of the bar.
    let cleanup = null;
    try { cleanup = ctrl.mount(span); }
    catch (err) {
      console.error('[Rga.Shell.StatusBar] mount threw for "' + ctrl.id + '":', err);
    }
    if (typeof cleanup === 'function') _cleanups.set(ctrl.id, cleanup);
  }

  function _insertSpanInSectionOrder(ctrl, span) {
    const section = _sections[ctrl.section];
    const insertionOrder = _orderedControllers()
      .filter(function(c) { return c.section === ctrl.section; })
      .map(function(c) { return c.id; });
    const myIdx = insertionOrder.indexOf(ctrl.id);
    // Find the first existing span whose controller's position in
    // insertionOrder is greater than mine — insert before it.
    const children = section.children;
    for (let i = 0; i < children.length; i += 1) {
      const childId = children[i].getAttribute('data-segment');
      const childIdx = insertionOrder.indexOf(childId);
      if (childIdx > myIdx) {
        section.insertBefore(span, children[i]);
        return;
      }
    }
    section.appendChild(span);
  }

  function _orderedControllers() {
    return Array.from(_segments.values()).sort(function(a, b) {
      const sa = SECTION_INDEX[a.section];
      const sb = SECTION_INDEX[b.section];
      if (sa !== sb) return sa - sb;
      const oa = (typeof a.order === 'number') ? a.order : 0;
      const ob = (typeof b.order === 'number') ? b.order : 0;
      if (oa !== ob) return oa - ob;
      return 0;   // insertion-order tie-breaker handled by Map iteration
    });
  }

  // Public no-op kept for backward compat. The old `refresh()` re-rendered
  // every segment from a global snapshot; post-F1A.4, every segment owns
  // its own subscription. Callers that still invoke refresh() get a
  // documented no-op.
  function refresh() { /* no-op post-F1A.4 — segments self-refresh */ }

  // Soft reset — tears down mounted DOM + subscriptions; leaves the
  // registry intact. Rationale: plugin segments register at script-load
  // (IIFE) and the test boot sequence is:
  //   1. require() loads CORE + every contributing plugin file
  //   2. _reset() runs to clear any prior init's DOM
  //   3. init() mounts the registry
  // If _reset wiped the registry, step 3 would only see CORE built-ins
  // (the plugin IIFEs already ran). The soft-reset model means plugins
  // can still be unregistered via unregisterSegment.
  function _reset() {
    _cleanups.forEach(function(fn, id) {
      try { fn(); }
      catch (err) { console.error('[Rga.Shell.StatusBar] cleanup threw on reset for "' + id + '":', err); }
    });
    _cleanups.clear();
    _spans.clear();
    if (_container) _container.innerHTML = '';
    _container = null;
    _sections = {};
    _initialized = false;
  }

  Rga.Shell.StatusBar.init                = init;
  Rga.Shell.StatusBar.refresh             = refresh;
  Rga.Shell.StatusBar.registerSegment     = registerSegment;
  Rga.Shell.StatusBar.unregisterSegment   = unregisterSegment;
  Rga.Shell.StatusBar.registered          = registered;
  Rga.Shell.StatusBar._reset              = _reset;
})();
