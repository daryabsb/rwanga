// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Characters sidebar panel — Tags Panel V1 (Visible Intelligence).
//
// The writer's window into every tagged entity in the screenplay.
// CORE owns the panel frame + lifecycle (this file); the screenplay
// plugin owns the content rendering (Rga.Tags.renderTagsPanel — entity
// groups by category, occurrence counts, click-to-jump, RTL mirroring).
//
// Boundary discipline (F1A): this shell panel never reads the registry
// and never renders screenplay vocabulary itself — it delegates to the
// doc-type's renderer when present and degrades to the approved empty
// state when it isn't (non-screenplay docs, stripped test scaffolds).
//
// Empty state (Bundle 1 §B approved copy, unchanged):
//   "Your characters will appear here as you write."
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Shell || !Rga.Shell.Sidebar || typeof Rga.Shell.Sidebar.registerPanel !== 'function') return;

  let _container = null;
  let _unsubscribeSession = null;
  let _tagListener = null;

  function _renderEmpty(container) {
    Rga.Shell.Sidebar.renderEmpty(container, {
      title: 'Characters',
      body: 'Your characters will appear here as you write.'
    });
  }

  function _render() {
    if (!_container) return;
    const Tags = Rga.Tags;
    // No screenplay plugin (non-screenplay doc-type) → approved empty state.
    if (!Tags || typeof Tags.renderTagsPanel !== 'function') {
      _renderEmpty(_container);
      return;
    }
    // Screenplay renderer owns the content; zero entities → empty state.
    const rendered = Tags.renderTagsPanel(_container);
    if (rendered === 0) _renderEmpty(_container);
  }

  Rga.Shell.Sidebar.registerPanel({
    id: 'characters',
    label: 'Characters',
    icon: 'users',
    shortcut: 'Cmd-Shift-C',
    available: true,
    mount: function(container) {
      _container = container || null;
      _render();
      // Re-render on session ticks (doc switches, document edits)…
      if (_unsubscribeSession) _unsubscribeSession();
      if (Rga.ScriptSession && typeof Rga.ScriptSession.subscribe === 'function') {
        _unsubscribeSession = Rga.ScriptSession.subscribe(function() { _render(); });
      }
      // …and immediately when a tag is applied/removed (the screenplay
      // plugin dispatches these document events on every tag mutation).
      if (!_tagListener) {
        _tagListener = function() { _render(); };
        document.addEventListener('editor.tagApplied', _tagListener);
        document.addEventListener('editor.tagRemoved', _tagListener);
      }
    },
    unmount: function() {
      if (_unsubscribeSession) { _unsubscribeSession(); _unsubscribeSession = null; }
      if (_tagListener) {
        document.removeEventListener('editor.tagApplied', _tagListener);
        document.removeEventListener('editor.tagRemoved', _tagListener);
        _tagListener = null;
      }
      _container = null;
    }
  });
})();
