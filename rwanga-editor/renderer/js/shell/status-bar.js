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
  let _unsubscribeSession = null;
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
    return true;
  }

  function _build() {
    _container.innerHTML = '';
    _container.classList.add('rga-shell-statusbar');
    // Segment order per slice-2 plan §3.4 / §12 OQ1:
    //   scene · page · blockType · wordCount · viewMode · lang · offline
    // Grouped: writer-context (scene/page/block/words) then tool-context
    // (view/lang/sync).
    const defs = [
      { id: 'scene',     cls: 'rga-shell-status-scene',     initial: 'Scene: —' },
      { id: 'page',      cls: 'rga-shell-status-page',      initial: 'Page: —/—' },
      { id: 'blockType', cls: 'rga-shell-status-blocktype', initial: '—' },
      { id: 'wordCount', cls: 'rga-shell-status-wordcount', initial: '0 words' },
      { id: 'viewMode',  cls: 'rga-shell-status-viewmode',  initial: 'Flow', click: _onViewModeClick },
      { id: 'language',  cls: 'rga-shell-status-language',  initial: '—' },
      { id: 'offline',   cls: 'rga-shell-status-offline',   initial: 'Local' }
    ];
    _segments = {};
    defs.forEach(function(d) {
      const sp = document.createElement('span');
      sp.className = 'rga-shell-status-segment ' + d.cls;
      sp.setAttribute('data-segment', d.id);
      sp.textContent = d.initial;
      if (d.click) {
        sp.style.cursor = 'pointer';
        sp.addEventListener('click', d.click);
      }
      _container.appendChild(sp);
      _segments[d.id] = sp;
    });
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
    const v = snap && snap.currentView;
    _segments.viewMode.textContent = _viewModeLabel(v);
  }

  function _viewModeLabel(v) {
    if (v === 'draft') return 'Draft';
    if (v === 'printPreview') return 'Print Preview';
    if (v === 'flow') return 'Flow';
    if (v == null) return '—';
    return String(v);
  }

  function _renderLanguage() {
    if (!_segments.language) return;
    const doc = (Rga.TabManager && typeof Rga.TabManager.activeDoc === 'function') ? Rga.TabManager.activeDoc() : null;
    const lang = doc && doc.metadata && doc.metadata.screenplayProfile && doc.metadata.screenplayProfile.language;
    _segments.language.textContent = lang || '—';
  }

  // Click-to-cycle view mode (calls the OWNER of view-mode state).
  const _VIEW_CYCLE = ['flow', 'draft', 'printPreview'];
  function _onViewModeClick() {
    if (!Rga.ViewManager || typeof Rga.ViewManager.activate !== 'function') return;
    const cur = Rga.ViewManager.current();
    const idx = _VIEW_CYCLE.indexOf(cur);
    const next = _VIEW_CYCLE[(idx + 1) % _VIEW_CYCLE.length];
    Rga.ViewManager.activate(next);
  }

  function _reset() {
    if (_unsubscribeSession) { _unsubscribeSession(); _unsubscribeSession = null; }
    if (_tabActivatedHandler) {
      document.removeEventListener('editor.tabActivated', _tabActivatedHandler);
      _tabActivatedHandler = null;
    }
    if (_container) _container.innerHTML = '';
    _container = null;
    _segments = {};
  }

  Rga.Shell.StatusBar.init    = init;
  Rga.Shell.StatusBar.refresh = refresh;
  Rga.Shell.StatusBar._reset  = _reset;
})();
