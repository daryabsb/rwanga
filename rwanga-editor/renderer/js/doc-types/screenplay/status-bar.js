// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Screenplay plugin — status-bar segments (Filmustageation F1A.4).
//
// Registers the four status-bar segments that were screenplay-specific
// pre-F1A.4 but lived inside the CORE shell/status-bar.js module:
//
//   scene     (left,   order 20)  — current scene number from
//                                   Rga.ScriptSession.currentScene.
//   blockType (center, order 50)  — current block type from
//                                   Rga.ScriptMetrics.currentBlockType.
//                                   Block-type label table is
//                                   screenplay-specific (sceneHeading,
//                                   action, dialogue, …).
//   page      (center, order 60)  — current page from
//                                   Rga.ScriptSession.currentPage (the
//                                   value comes from Rga.Nav.getPageMap
//                                   which is today screenplay-coupled).
//   language  (right,  order 120) — doc.metadata.screenplayProfile
//                                   .language — the one read CORE used
//                                   to make of plugin-shaped metadata.
//                                   Now owned here, where it belongs.
//
// Visible behaviour is preserved exactly. Each segment owns its own
// subscription and updates the span on every relevant change.
//
// The screenplay status-bar contributions register at script-load via
// IIFE — the same load pattern doc-types/screenplay/index.js uses.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Shell || !Rga.Shell.StatusBar
      || typeof Rga.Shell.StatusBar.registerSegment !== 'function') {
    // status-bar.js loads BEFORE doc-types/screenplay/* in
    // renderer/index.html, so this branch only fires in stripped-down
    // test scaffolding. Bail silently — the script-load IIFE pattern
    // means tests that need these segments load the file explicitly.
    return;
  }

  const StatusBar = Rga.Shell.StatusBar;

  // -- scene -----------------------------------------------------------------
  StatusBar.registerSegment({
    id:        'scene',
    section:   'left',
    order:     20,
    className: 'rga-shell-status-scene',
    mount: function(spanEl) {
      _renderScene(spanEl);
      const SS = window.Rga && window.Rga.ScriptSession;
      if (!SS || typeof SS.subscribe !== 'function') return null;
      return SS.subscribe(function() { _renderScene(spanEl); });
    }
  });
  function _renderScene(spanEl) {
    const SS = window.Rga && window.Rga.ScriptSession;
    const snap = SS && typeof SS.get === 'function' ? SS.get() : null;
    const s = snap && snap.currentScene;
    spanEl.textContent = s && s.sceneNumber != null
      ? 'Scene: S' + s.sceneNumber
      : 'Scene: —';
  }

  // -- blockType -------------------------------------------------------------
  // Title-cases the structural block name. `sceneHeading` → `Scene Heading`.
  // The label table contains screenplay block names; this is the
  // screenplay-specific knowledge that does NOT belong in CORE.
  StatusBar.registerSegment({
    id:        'blockType',
    section:   'center',
    order:     50,
    className: 'rga-shell-status-blocktype',
    mount: function(spanEl) {
      spanEl.textContent = '—';
      _renderBlockType(spanEl);
      const SS = window.Rga && window.Rga.ScriptSession;
      if (!SS || typeof SS.subscribe !== 'function') return null;
      return SS.subscribe(function() { _renderBlockType(spanEl); });
    }
  });
  function _renderBlockType(spanEl) {
    const SM = window.Rga && window.Rga.ScriptMetrics;
    const sm = SM && typeof SM.get === 'function' ? SM.get() : null;
    const bt = sm && sm.currentBlockType;
    spanEl.textContent = _blockTypeLabel(bt);
  }
  function _blockTypeLabel(bt) {
    if (bt == null) return '—';
    if (bt === 'sceneHeading') return 'Scene Heading';
    return bt.charAt(0).toUpperCase() + bt.slice(1);
  }

  // -- page ------------------------------------------------------------------
  StatusBar.registerSegment({
    id:        'page',
    section:   'center',
    order:     60,
    className: 'rga-shell-status-page',
    mount: function(spanEl) {
      _renderPage(spanEl);
      const SS = window.Rga && window.Rga.ScriptSession;
      if (!SS || typeof SS.subscribe !== 'function') return null;
      return SS.subscribe(function() { _renderPage(spanEl); });
    }
  });
  function _renderPage(spanEl) {
    const SS = window.Rga && window.Rga.ScriptSession;
    const snap = SS && typeof SS.get === 'function' ? SS.get() : null;
    const p = snap && snap.currentPage;
    if (!p) { spanEl.textContent = 'Page: —/—'; return; }
    const num   = p.number != null ? String(p.number) : '—';
    const total = p.total  != null ? String(p.total)  : '—';
    spanEl.textContent = 'Page: ' + num + '/' + total;
  }

  // -- language --------------------------------------------------------------
  // The screenplay-metadata read that previously lived in CORE
  // (shell/status-bar.js's _renderLanguage). Lives here now — only the
  // screenplay plugin knows the shape of doc.metadata.screenplayProfile.
  StatusBar.registerSegment({
    id:        'language',
    section:   'right',
    order:     120,
    className: 'rga-shell-status-language',
    mount: function(spanEl) {
      _renderLanguage(spanEl);
      // language is per-doc — listen to tab activation, not session
      // (which fires on every selection change and would be wasteful).
      const handler = function() { _renderLanguage(spanEl); };
      document.addEventListener('editor.tabActivated', handler);
      return function() { document.removeEventListener('editor.tabActivated', handler); };
    }
  });
  function _renderLanguage(spanEl) {
    const TM = window.Rga && window.Rga.TabManager;
    const doc = TM && typeof TM.activeDoc === 'function' ? TM.activeDoc() : null;
    const lang = doc && doc.metadata
                 && doc.metadata.screenplayProfile
                 && doc.metadata.screenplayProfile.language;
    spanEl.textContent = lang || '—';
  }
})();
