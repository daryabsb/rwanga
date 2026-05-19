// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Shell.StatusBar — 22px bottom strip with five segments.
// Plan §3.4. Reads exclusively from Rga.ScriptSession (writer-context
// truth) for derived state. Language segment reads per-script settings
// directly from Rga.TabManager.activeDoc (language is a script setting,
// not writer-context).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Shell = Rga.Shell || {};
  Rga.Shell.StatusBar = Rga.Shell.StatusBar || {};

  let _container = null;
  let _segments = {};
  let _sections = {};                       // Studio Shell Recovery §F: { left, center, right }
  let _unsubscribeSession = null;
  let _unsubscribeTheme = null;             // Studio Shell Recovery §F
  let _tabActivatedHandler = null;

  function init(container) {
    if (!container) return false;
    _container = container;
    _build();
    refresh();
    if (_unsubscribeSession) _unsubscribeSession();
    if (Rga.ScriptSession && typeof Rga.ScriptSession.subscribe === 'function') {
      _unsubscribeSession = Rga.ScriptSession.subscribe(function() { refresh(); });
    }
    // Language is per-script (not writer-context) — listen to tab-activated.
    _tabActivatedHandler = function() { _renderLanguage(); };
    document.addEventListener('editor.tabActivated', _tabActivatedHandler);
    // Studio Shell Recovery §F: theme is a right-side instrument now;
    // re-render on theme change so the "Dark" / "Light" label stays
    // synced with Rga.Theme.current (the single owner).
    if (_unsubscribeTheme) _unsubscribeTheme();
    if (Rga.Theme && typeof Rga.Theme.onChange === 'function') {
      _unsubscribeTheme = Rga.Theme.onChange(function() { _renderTheme(); });
    }
    return true;
  }

  function _build() {
    _container.innerHTML = '';
    _container.classList.add('rga-shell-statusbar');

    // Studio Shell Recovery §F: three-section layout. Existing 7 segments
    // are regrouped (no new sources, no new features) plus one new
    // right-side instrument (theme indicator that reads Rga.Theme.current
    // — an existing SSOT — and toggles via Rga.Theme.toggle on click).
    //
    //   LEFT    sync/local state   →  offline  (the "Local" indicator)
    //           scene position     →  scene
    //   CENTER  current context    →  blockType ("Scene Heading" etc.)
    //           page position      →  page ("Page: N/M")
    //   RIGHT   words              →  wordCount
    //           view mode          →  viewMode (the dropdown)
    //           language           →  language
    //           theme              →  theme  (NEW instrument; reads
    //                                         existing Rga.Theme SSOT)
    //
    // The segment data-segment attributes are preserved unchanged so
    // ScriptSession / ScriptMetrics / ViewMode wiring keeps working.

    _sections = {
      left:   _appendSection('rga-shell-statusbar-left'),
      center: _appendSection('rga-shell-statusbar-center'),
      right:  _appendSection('rga-shell-statusbar-right')
    };

    const defs = [
      { id: 'offline',   section: 'left',   cls: 'rga-shell-status-offline',   initial: 'Local' },
      { id: 'scene',     section: 'left',   cls: 'rga-shell-status-scene',     initial: 'Scene: —' },
      { id: 'blockType', section: 'center', cls: 'rga-shell-status-blocktype', initial: '—' },
      { id: 'page',      section: 'center', cls: 'rga-shell-status-page',      initial: 'Page: —/—' },
      { id: 'wordCount', section: 'right',  cls: 'rga-shell-status-wordcount', initial: '0 words' },
      { id: 'viewMode',  section: 'right',  cls: 'rga-shell-status-viewmode',  build: _buildViewModeSegment },
      { id: 'language',  section: 'right',  cls: 'rga-shell-status-language',  initial: '—' },
      { id: 'theme',     section: 'right',  cls: 'rga-shell-status-theme',     build: _buildThemeSegment }
    ];
    _segments = {};
    defs.forEach(function(d) {
      const sp = document.createElement('span');
      sp.className = 'rga-shell-status-segment ' + d.cls;
      sp.setAttribute('data-segment', d.id);
      if (d.build) d.build(sp);
      else sp.textContent = d.initial;
      _sections[d.section].appendChild(sp);
      _segments[d.id] = sp;
    });
  }

  function _appendSection(cls) {
    const sec = document.createElement('div');
    sec.className = 'rga-shell-statusbar-section ' + cls;
    _container.appendChild(sec);
    return sec;
  }

  // Studio Shell Recovery §F: theme instrument. Reads Rga.Theme.current
  // (existing SSOT), shows "Dark" / "Light" as a text instrument, and
  // toggles on click via Rga.Theme.toggle (existing API). No new
  // toggle button — this is a text segment that happens to be clickable,
  // matching the brief's "text/light-icons as instruments, do not turn
  // status bar into a button strip" rule.
  function _buildThemeSegment(spanEl) {
    spanEl.textContent = _themeLabel();
    spanEl.setAttribute('role', 'button');
    spanEl.setAttribute('aria-label', 'Toggle theme');
    spanEl.addEventListener('click', _onThemeClick);
  }
  function _onThemeClick() {
    if (Rga.Theme && typeof Rga.Theme.toggle === 'function') {
      Rga.Theme.toggle();
    }
  }
  function _themeLabel() {
    const t = (Rga.Theme && Rga.Theme.current) || 'dark';
    return t === 'light' ? 'Light' : 'Dark';
  }
  function _renderTheme() {
    if (!_segments.theme) return;
    _segments.theme.textContent = _themeLabel();
  }

  // Bundle 1 §A — labelled View dropdown. Native <select> for native
  // platform feel + a11y. Calls Rga.ViewMode.set(mode) on change for
  // Flow / Draft / Print. Print Preview is routed to
  // Rga.PrintPreview.open() because printPreview is NOT a ViewMode
  // mode (it is a separate ViewManager view; ViewMode.set would no-op).
  // The printPreview option is now a live, pickable option (D.1 / SP-07).
  function _buildViewModeSegment(spanEl) {
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
    // D.1 / SP-07 — Print Preview is now a live, pickable option.
    // The option value is still 'printPreview' so _renderViewMode can
    // set select.value = 'printPreview' when the preview is active and
    // the label reads "Print Preview" in the dropdown.
    const pp = document.createElement('option');
    pp.value = 'printPreview';
    pp.textContent = 'Print Preview';
    select.appendChild(pp);

    select.addEventListener('change', _onViewModeChange);
    spanEl.appendChild(select);
  }

  // Route changes through the appropriate SSOT:
  //   - Flow / Draft / Print → Rga.ViewMode.set (persistence + Esc-exit)
  //   - printPreview → Rga.PrintPreview.open() (separate ViewManager view;
  //     ViewMode.set('printPreview') would no-op because printPreview
  //     is not in MODES). After open() succeeds, the existing
  //     ViewManager.onChange subscription will refresh the select.value.
  function _onViewModeChange(e) {
    const mode = e && e.target && e.target.value;
    if (!mode) return;
    if (mode === 'printPreview') {
      if (Rga.PrintPreview && typeof Rga.PrintPreview.open === 'function') {
        Rga.PrintPreview.open();
      }
      return;
    }
    if (Rga.ViewMode && typeof Rga.ViewMode.set === 'function') {
      Rga.ViewMode.set(mode);
    }
  }

  function refresh() {
    if (!_container) return;
    // Writer-context fields (scene / page / viewMode) read from
    // Rga.ScriptSession (the writer-context SSOT). Derived analytics
    // (wordCount / currentBlockType) read from Rga.ScriptMetrics
    // (the analytics SSOT — Slice 5 §A). Language reads from the
    // active doc's metadata (per-script setting, not writer-context).
    const ss = (Rga.ScriptSession && typeof Rga.ScriptSession.get === 'function')
      ? Rga.ScriptSession.get() : null;
    const sm = (Rga.ScriptMetrics && typeof Rga.ScriptMetrics.get === 'function')
      ? Rga.ScriptMetrics.get() : null;
    _renderScene(ss);
    _renderPage(ss);
    _renderBlockType(sm);
    _renderWordCount(sm);
    _renderViewMode(ss);
    _renderLanguage();
    _renderTheme();
    // offline is static in slice 1
  }

  function _renderScene(snap) {
    if (!_segments.scene) return;
    const s = snap && snap.currentScene;
    _segments.scene.textContent = s && s.sceneNumber != null
      ? 'Scene: S' + s.sceneNumber
      : 'Scene: —';
  }

  function _renderPage(snap) {
    if (!_segments.page) return;
    const p = snap && snap.currentPage;
    if (!p) {
      _segments.page.textContent = 'Page: —/—';
      return;
    }
    const num = p.number != null ? String(p.number) : '—';
    const total = p.total != null ? String(p.total) : '—';
    _segments.page.textContent = 'Page: ' + num + '/' + total;
  }

  function _renderBlockType(snap) {
    if (!_segments.blockType) return;
    const bt = snap && snap.currentBlockType;
    _segments.blockType.textContent = _blockTypeLabel(bt);
  }

  // Title-cases the structural block name. `sceneHeading` → `Scene Heading`.
  function _blockTypeLabel(bt) {
    if (bt == null) return '—';
    if (bt === 'sceneHeading') return 'Scene Heading';
    return bt.charAt(0).toUpperCase() + bt.slice(1);
  }

  function _renderWordCount(snap) {
    if (!_segments.wordCount) return;
    const wc = snap && snap.wordCount;
    if (wc == null) {
      _segments.wordCount.textContent = '— words';
      return;
    }
    if (wc === 1) {
      _segments.wordCount.textContent = '1 word';
      return;
    }
    _segments.wordCount.textContent = _formatThousands(wc) + ' words';
  }

  function _formatThousands(n) {
    // Format with thousands separator. Plain JS (no Intl dependency for
    // platform portability — same posture as the engine layer).
    const s = String(Math.max(0, Math.floor(n)));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function _renderViewMode(snap) {
    if (!_segments.viewMode) return;
    const select = _segments.viewMode.querySelector('select.rga-shell-status-viewmode-select');
    if (!select) return;
    const v = snap && snap.currentView;
    if (v == null) return;
    // Selecting an option that doesn't exist is a no-op in browsers
    // (select.value remains unchanged). printPreview is held by the
    // hidden disabled option; flow/draft/print map to the live options.
    if (Array.prototype.some.call(select.options, function(o) { return o.value === v; })) {
      select.value = v;
    }
  }

  function _renderLanguage() {
    if (!_segments.language) return;
    const doc = (Rga.TabManager && typeof Rga.TabManager.activeDoc === 'function') ? Rga.TabManager.activeDoc() : null;
    const lang = doc && doc.metadata && doc.metadata.screenplayProfile && doc.metadata.screenplayProfile.language;
    _segments.language.textContent = lang || '—';
  }

  function _reset() {
    if (_unsubscribeSession) { _unsubscribeSession(); _unsubscribeSession = null; }
    if (_unsubscribeTheme) { _unsubscribeTheme(); _unsubscribeTheme = null; }
    if (_tabActivatedHandler) {
      document.removeEventListener('editor.tabActivated', _tabActivatedHandler);
      _tabActivatedHandler = null;
    }
    if (_container) _container.innerHTML = '';
    _container = null;
    _segments = {};
    _sections = {};
  }

  Rga.Shell.StatusBar.init    = init;
  Rga.Shell.StatusBar.refresh = refresh;
  Rga.Shell.StatusBar._reset  = _reset;
})();
