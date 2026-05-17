// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Modal — modal dialog primitive (currently single API: showUnsaved).
//
// Extracted from app-shell.js in Runtime Ownership Stab. Slice 8 §A.
// Single consumer: `Rga.TabManager` (`renderer/js/tab-manager.js`)
// calls `Rga.Modal.showUnsaved(filename)` when closing a tab with
// unsaved changes. No engine consumers.
//
// API:
//   Rga.Modal.showUnsaved(filename) → Promise<'save' | 'discard' | 'cancel'>
//
// When a second modal surface arrives (Discard / Confirm / Pick-One)
// the API should grow into a generic
//   Rga.Modal.show({title, message, choices}) → Promise<choiceId>
// per the extraction roadmap.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  Rga.Modal = {
    showUnsaved: function(filename) {
      return new Promise(function(resolve) {
        var el = document.getElementById('unsaved-modal');
        if (!el) { resolve('discard'); return; }
        var msgEl = document.getElementById('unsaved-modal-msg');
        if (msgEl) msgEl.textContent = '"' + filename + '" has unsaved changes.';
        el.hidden = false;
        function onBtnClick(e) {
          var btn = e.target.closest('[data-choice]');
          if (!btn) return;
          el.hidden = true;
          el.removeEventListener('click', onBtnClick);
          resolve(btn.dataset.choice);
        }
        el.addEventListener('click', onBtnClick);
      });
    }
  };
})();
