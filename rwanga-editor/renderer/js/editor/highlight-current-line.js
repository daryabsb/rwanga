// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings applicator (Slice 2 proof) — consumes
// `editor.highlightCurrentLine` from Rga.Settings.Store and toggles the
// `rga-line-highlight-on` class on #editor.
//
// The applicator is the smallest possible Settings Store consumer: one
// subscribe, one DOM toggle. Future settings get their own applicators
// in the same shape. The CSS treatment for the class can land later;
// what matters for the substrate is that a change to the store reaches
// the editor DOM observably.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const SETTING_ID = 'editor.highlightCurrentLine';
  const CLASS = 'rga-line-highlight-on';

  function apply(value) {
    const el = document.getElementById('editor');
    if (!el) return;
    el.classList.toggle(CLASS, !!value);
  }

  async function init() {
    if (!Rga.Settings || !Rga.Settings.Store) return;
    // Store.init() is idempotent; awaiting here means apply() sees the
    // hydrated user-tier value rather than the built-in default.
    await Rga.Settings.Store.init();
    apply(Rga.Settings.Store.effective(SETTING_ID));
    Rga.Settings.Store.subscribe(SETTING_ID, function(newVal) { apply(newVal); });
  }

  Rga.Editor = Rga.Editor || {};
  Rga.Editor.initHighlightCurrentLine = init;
})();
