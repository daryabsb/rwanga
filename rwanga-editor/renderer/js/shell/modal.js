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

  // Persistence Safety Contract §5 — relative "last autosaved" wording.
  function _relativeTime(ts) {
    if (!ts) return 'recently';
    var secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (secs < 60) return 'less than a minute ago';
    var mins = Math.round(secs / 60);
    if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    var hrs = Math.round(mins / 60);
    return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
  }

  Rga.Modal = {
    // Persistence Safety Contract §5 — the crash-recovery prompt. Lists every
    // orphan; Restore / Discard apply to all. Resolves 'restore' | 'discard'.
    showRecovery: function(orphans) {
      return new Promise(function(resolve) {
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'recovery-modal';

        var dialog = document.createElement('div');
        dialog.className = 'modal-dialog';

        var title = document.createElement('div');
        title.className = 'modal-title';
        title.textContent = 'Recover unsaved work?';
        dialog.appendChild(title);

        var msg = document.createElement('div');
        msg.className = 'modal-msg';
        msg.textContent = 'Rwanga found unsaved changes from a previous session:';
        dialog.appendChild(msg);

        var list = document.createElement('ul');
        list.className = 'recovery-list';
        (orphans || []).forEach(function(o) {
          var li = document.createElement('li');
          li.textContent = (o.baseDisplayName || 'Untitled.rga')
            + ' — last autosaved ' + _relativeTime(o.savedAt);
          list.appendChild(li);
        });
        dialog.appendChild(list);

        var actions = document.createElement('div');
        actions.className = 'modal-actions';
        [['discard', 'Discard'], ['restore', 'Restore']].forEach(function(pair) {
          var btn = document.createElement('button');
          btn.className = 'modal-btn' + (pair[0] === 'restore' ? ' primary' : '');
          btn.dataset.choice = pair[0];
          btn.textContent = pair[1];
          actions.appendChild(btn);
        });
        dialog.appendChild(actions);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function onClick(e) {
          var btn = e.target.closest('[data-choice]');
          if (!btn) return;
          overlay.removeEventListener('click', onClick);
          overlay.remove();
          resolve(btn.dataset.choice);
        });
      });
    },

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
