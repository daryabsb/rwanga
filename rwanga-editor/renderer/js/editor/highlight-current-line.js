// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Settings applicator (Slice 2 proof, Slice 3D refactor) — consumes
// `editor.highlightCurrentLine` from Rga.Settings.Store and toggles
// the `rga-line-highlight-on` class on #editor.
//
// As of Slice 3D this module no longer manages its own Store
// subscription or init dance. It registers a handler with
// Rga.Settings.Applicators at load time; the registry owns the
// Store.subscribe and the boot-time applyAll() fanout. Behavior is
// unchanged — when the effective value changes, #editor toggles the
// CSS class.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Settings || !Rga.Settings.Applicators ||
      typeof Rga.Settings.Applicators.register !== 'function') {
    // Applicator registry not available — module is inert. The boot
    // path in index.html loads settings-applicators.js BEFORE this
    // file, so this branch only triggers in atypical test
    // scaffolding.
    return;
  }

  const SETTING_ID = 'editor.highlightCurrentLine';
  const CLASS = 'rga-line-highlight-on';

  Rga.Settings.Applicators.register(SETTING_ID, function(value) {
    const el = document.getElementById('editor');
    if (!el) return;
    el.classList.toggle(CLASS, !!value);
  }, { owner: 'editor' });
})();
