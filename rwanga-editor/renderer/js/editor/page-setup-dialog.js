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
      '<div class="modal-dialog ps-dialog">' +
        '<div class="modal-title">Page Setup</div>' +
        '<div class="ps-body">' +
          '<div class="ps-field-row">' +
            '<label class="ps-label" for="ps-paper">Paper size</label>' +
            '<select class="ps-select" id="ps-paper">' + sizeOptions + '</select>' +
          '</div>' +
          '<div class="ps-section-label">Margins (inches)</div>' +
          '<div class="ps-margins">' +
            '<div class="ps-field">' +
              '<label class="ps-label" for="ps-top">Top</label>' +
              '<input class="ps-input" id="ps-top" type="number" step="0.1" min="0">' +
            '</div>' +
            '<div class="ps-field">' +
              '<label class="ps-label" for="ps-bottom">Bottom</label>' +
              '<input class="ps-input" id="ps-bottom" type="number" step="0.1" min="0">' +
            '</div>' +
            '<div class="ps-field">' +
              '<label class="ps-label" for="ps-left">Left</label>' +
              '<input class="ps-input" id="ps-left" type="number" step="0.1" min="0">' +
            '</div>' +
            '<div class="ps-field">' +
              '<label class="ps-label" for="ps-right">Right</label>' +
              '<input class="ps-input" id="ps-right" type="number" step="0.1" min="0">' +
            '</div>' +
          '</div>' +
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
        // SP-03: Dispatch a zero-text-change transaction carrying rga.forceReindex
        // so the nav-index plugin rebuilds the PageMap (and page-break bands update)
        // without requiring the user to type. onApply(ps) runs first so visual
        // surface updates and pagination updates happen in the same gesture.
        var _view = Rga.TabManager && typeof Rga.TabManager._editorView === 'function'
          ? Rga.TabManager._editorView() : null;
        if (_view) _view.dispatch(_view.state.tr.setMeta('rga.forceReindex', true));
        // Recovery Step 7: the forceReindex dispatch above rebuilds the
        // PageMap, but ScriptSession recomputes only on selection / tab /
        // view / sidebar events — not on a meta-only transaction. Ask
        // ScriptSession to recompute now (after the dispatch, so it reads
        // the rebuilt PageMap) — the status-bar Page X/Y then reflects the
        // new geometry on this same Apply gesture, with no cursor move.
        if (Rga.ScriptSession && typeof Rga.ScriptSession.recompute === 'function') {
          Rga.ScriptSession.recompute();
        }
        // Recovery Step 8: if Print Preview is currently active, re-render
        // it so its sheets reflect the new geometry on this same gesture.
        // refresh() is a no-op when the preview is closed (no wasted
        // render) and re-renders into the existing preview surface when
        // open — it does not create a second render path.
        if (Rga.PrintPreview && typeof Rga.PrintPreview.refresh === 'function') {
          Rga.PrintPreview.refresh();
        }
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
