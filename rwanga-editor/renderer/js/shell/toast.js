// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.Toast — top-of-screen toast notification primitive.
//
// Extracted from app-shell.js in Runtime Ownership Stab. Slice 8 §A
// per the legacy-extraction-roadmap. Single API (`show`); single
// consumer in shell code (`Rga.Theme.toggle`). No engine consumers.
//
// API:
//   Rga.Toast.show(message, type, duration)
//     message  - string
//     type     - 'success' | 'error' | 'warning' | 'info' (default 'info')
//     duration - ms (default 3000)
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  Rga.Toast = {
    show: function(message, type, duration) {
      type = type || 'info';
      duration = duration || 3000;

      var container = Rga.$ ? Rga.$('.toast-container') : document.querySelector('.toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
      }

      var toast = document.createElement('div');
      toast.className = 'toast';

      var iconEl = document.createElement('span');
      iconEl.className = 'toast-icon ' + type;
      var iconMap = { success: 'check', error: 'close', warning: 'warning', info: 'info' };
      iconEl.innerHTML = (Rga.Icons && Rga.Icons[iconMap[type]]) || '';
      toast.appendChild(iconEl);

      var msgEl = document.createElement('span');
      msgEl.className = 'toast-message';
      msgEl.textContent = message;
      toast.appendChild(msgEl);

      var closeEl = document.createElement('button');
      closeEl.className = 'toast-close';
      closeEl.innerHTML = (Rga.Icons && Rga.Icons.close) || '×';
      closeEl.addEventListener('click', function() { dismiss(); });
      toast.appendChild(closeEl);

      container.appendChild(toast);

      var timer = setTimeout(dismiss, duration);

      function dismiss() {
        clearTimeout(timer);
        toast.classList.add('leaving');
        setTimeout(function() { toast.remove(); }, 200);
      }
    }
  };
})();
