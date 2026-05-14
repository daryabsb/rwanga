// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 5 — additional keyboard shortcuts wired to editor commands.
// Registered after Rga.Keyboard.init() in the boot sequence.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  function _view() {
    return Rga.TabManager && Rga.TabManager._editorView && Rga.TabManager._editorView();
  }

  function registerShortcuts() {
    const K = Rga.Keyboard;
    if (!K) return;

    // Ctrl+/ — open widget insert menu at cursor
    K.register('/', { ctrl: true, shift: false, alt: false }, function() {
      const view = _view();
      if (view) Rga.WidgetMenu && Rga.WidgetMenu.openWidgetMenu(view, null);
    });

    // Ctrl+Shift+H — add annotation on selection
    K.register('h', { ctrl: true, shift: true, alt: false }, function() {
      const view = _view();
      if (view && !view.state.selection.empty) {
        Rga.Annotations && Rga.Annotations.addNoteFromMenu && Rga.Annotations.addNoteFromMenu(view);
      }
    });

    // Ctrl+Shift+F — flag for revision
    K.register('f', { ctrl: true, shift: true, alt: false }, function() {
      const view = _view();
      if (view && !view.state.selection.empty) {
        Rga.RevisionFlags && Rga.RevisionFlags.showRevisionEditor && Rga.RevisionFlags.showRevisionEditor(view);
      }
    });

    // Ctrl+Shift+T — tag as... (overrides theme-toggle shortcut in favour of tag)
    K.register('t', { ctrl: true, shift: true, alt: false }, function() {
      const view = _view();
      if (view && !view.state.selection.empty) {
        Rga.Tags && Rga.Tags.showTagDialog && Rga.Tags.showTagDialog(view, 'character');
      }
    });
  }

  Rga.EditorShortcuts = { registerShortcuts };
})();
