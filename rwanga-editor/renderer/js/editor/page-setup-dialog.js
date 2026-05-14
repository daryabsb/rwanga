// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Page Setup modal — edits doc.settings.pageSetup (paper size + 4 margins).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  function _paperSizeNames() {
    const sizes = (Rga.Constants && Rga.Constants.PAPER_SIZES) || { Letter: {} };
    return Object.keys(sizes);
  }

  // Build (once) and return the modal overlay element.
  function _ensureModal() {
    let overlay = document.getElementById('page-setup-modal');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'page-setup-modal';
    overlay.className = 'modal-overlay';
    overlay.hidden = true;

    const sizeOptions = _paperSizeNames()
      .map(function(n) { return '<option value="' + n + '">' + n + '</option>'; })
      .join('');

    overlay.innerHTML =
      '<div class="modal-dialog">' +
        '<div class="modal-title">Page Setup</div>' +
        '<div class="modal-msg">' +
          '<label>Paper size ' +
            '<select id="ps-paper">' + sizeOptions + '</select>' +
          '</label>' +
          '<label>Top margin (in) <input id="ps-top" type="number" step="0.1" min="0"></label>' +
          '<label>Right margin (in) <input id="ps-right" type="number" step="0.1" min="0"></label>' +
          '<label>Bottom margin (in) <input id="ps-bottom" type="number" step="0.1" min="0"></label>' +
          '<label>Left margin (in) <input id="ps-left" type="number" step="0.1" min="0"></label>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="modal-btn primary" data-choice="apply">Apply</button>' +
          '<button class="modal-btn secondary" data-choice="cancel">Cancel</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    return overlay;
  }

  // open(doc, onApply): show the modal seeded from doc.settings.pageSetup.
  // On Apply: write doc.settings.pageSetup, mark dirty, call onApply().
  function open(doc, onApply) {
    if (!doc || !doc.settings || !doc.settings.pageSetup) return;
    const overlay = _ensureModal();
    const ps = doc.settings.pageSetup;

    const paper  = overlay.querySelector('#ps-paper');
    const top    = overlay.querySelector('#ps-top');
    const right  = overlay.querySelector('#ps-right');
    const bottom = overlay.querySelector('#ps-bottom');
    const left   = overlay.querySelector('#ps-left');

    paper.value  = ps.paperSize;
    top.value    = ps.margins.top;
    right.value  = ps.margins.right;
    bottom.value = ps.margins.bottom;
    left.value   = ps.margins.left;

    function close() {
      overlay.hidden = true;
      overlay.onclick = null;
    }

    overlay.onclick = function(e) {
      const choice = e.target && e.target.dataset && e.target.dataset.choice;
      if (choice === 'cancel') { close(); return; }
      if (choice === 'apply') {
        ps.paperSize = paper.value;
        ps.margins = {
          top:    parseFloat(top.value)    || 0,
          right:  parseFloat(right.value)  || 0,
          bottom: parseFloat(bottom.value) || 0,
          left:   parseFloat(left.value)   || 0
        };
        if (Rga.Doc && Rga.Doc.markDirty) Rga.Doc.markDirty(doc);
        if (typeof onApply === 'function') onApply(ps);
        close();
      }
    };

    overlay.hidden = false;
  }

  Rga.PageSetup = { open };

  // TEMPORARY trigger for Step A verification — Ctrl+Shift+G opens Page Setup.
  // The permanent trigger (a File menu item) is tracked in the Stop-Point Register.
  if (Rga.Keyboard && Rga.Keyboard.register) {
    Rga.Keyboard.register('g', { ctrl: true, shift: true, alt: false }, function() {
      const doc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
      if (doc) open(doc, function(ps) {
        if (Rga.PageSurface) Rga.PageSurface.apply(ps);
      });
    });
  }
})();
