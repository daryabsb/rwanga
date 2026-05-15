// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.FormatToolbar — top-of-editor formatting toolbar.
//
// v1 buttons: Bold / Italic / Underline / Strikethrough / Text color /
//             Highlight / Link.
// Selection-aware: each button reflects whether its mark is currently active
// at the cursor. Recomputed on PM state change (we listen for both selection
// changes and the broader tab-activated event).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // ============================================================
  // Helpers
  // ============================================================

  function _PM() { return window.RgaProseMirror; }
  function _view() {
    return Rga.TabManager && Rga.TabManager._editorView && Rga.TabManager._editorView();
  }
  function _markType(name) {
    const view = _view();
    if (!view) return null;
    return view.state.schema.marks[name] || null;
  }

  function _markActive(state, markType) {
    const { from, $from, to, empty } = state.selection;
    if (!markType) return false;
    if (empty) return !!markType.isInSet(state.storedMarks || $from.marks());
    return state.doc.rangeHasMark(from, to, markType);
  }

  function _markAttrs(state, markType) {
    if (!markType) return null;
    const { $from, from, to, empty } = state.selection;
    if (empty) {
      const marks = state.storedMarks || $from.marks();
      const m = markType.isInSet(marks);
      return m ? m.attrs : null;
    }
    let found = null;
    state.doc.nodesBetween(from, to, function(node) {
      if (found) return false;
      const m = markType.isInSet(node.marks);
      if (m) found = m.attrs;
      return true;
    });
    return found;
  }

  // ============================================================
  // Commands
  // ============================================================

  function toggleMarkSimple(markName) {
    return function() {
      const view = _view();
      if (!view) return;
      const mt = _markType(markName);
      if (!mt) return;
      const PM = _PM();
      PM.toggleMark(mt)(view.state, view.dispatch);
      view.focus();
    };
  }

  function applyMarkAttrs(markName, attrs) {
    const view = _view();
    if (!view) return;
    const mt = _markType(markName);
    if (!mt) return;
    const PM = _PM();
    const { from, to, empty } = view.state.selection;
    if (empty) return; // marks with attrs need a selection range
    let tr = view.state.tr.removeMark(from, to, mt);
    if (attrs) tr = tr.addMark(from, to, mt.create(attrs));
    view.dispatch(tr);
    view.focus();
  }

  function clearMark(markName) {
    const view = _view();
    if (!view) return;
    const mt = _markType(markName);
    if (!mt) return;
    const { from, to, empty } = view.state.selection;
    if (empty) return;
    view.dispatch(view.state.tr.removeMark(from, to, mt));
    view.focus();
  }

  // ============================================================
  // Color popover
  // ============================================================

  let activeColorMark = null; // 'color' | 'highlight'

  function _toolbar()  { return document.getElementById('format-toolbar'); }
  function _popover()  { return document.getElementById('format-color-popover'); }
  function _customColor() { return document.getElementById('format-color-custom'); }

  function openColorPopover(markName, anchorEl) {
    const pop = _popover();
    if (!pop || !anchorEl) return;
    activeColorMark = markName;
    const rect = anchorEl.getBoundingClientRect();
    pop.style.left = rect.left + 'px';
    pop.style.top = (rect.bottom + 4) + 'px';
    pop.hidden = false;
    setTimeout(function() {
      document.addEventListener('mousedown', _onDocClickClose, { once: true });
    }, 0);
  }
  function closeColorPopover() {
    const pop = _popover();
    if (pop) pop.hidden = true;
    activeColorMark = null;
  }
  function _onDocClickClose(e) {
    const pop = _popover();
    if (pop && !pop.contains(e.target)) closeColorPopover();
  }

  function wireColorPopover() {
    const pop = _popover();
    if (!pop) return;
    pop.addEventListener('click', function(e) {
      const sw = e.target.closest('.format-swatch');
      if (!sw) return;
      const color = sw.dataset.color || '';
      if (!activeColorMark) return;
      if (color) applyMarkAttrs(activeColorMark, { value: color });
      else clearMark(activeColorMark);
      closeColorPopover();
    });
    const custom = _customColor();
    if (custom) {
      custom.addEventListener('input', function() {
        if (!activeColorMark) return;
        applyMarkAttrs(activeColorMark, { value: custom.value });
        // Don't close — let user fine-tune
      });
    }
  }

  // ============================================================
  // Link dialog
  // ============================================================

  function _linkDialog()  { return document.getElementById('format-link-dialog'); }
  function _linkInput()   { return document.getElementById('format-link-input'); }
  function openLinkDialog() {
    const view = _view();
    if (!view) return;
    const dlg = _linkDialog();
    if (!dlg) return;
    const linkType = _markType('link');
    const attrs = _markAttrs(view.state, linkType);
    _linkInput().value = (attrs && attrs.href) || '';
    dlg.hidden = false;
    setTimeout(function() { _linkInput().focus(); }, 0);
  }
  function closeLinkDialog() {
    const dlg = _linkDialog();
    if (dlg) dlg.hidden = true;
  }
  function applyLink() {
    const view = _view();
    if (!view) return;
    const href = (_linkInput().value || '').trim();
    if (!href) return closeLinkDialog();
    applyMarkAttrs('link', { href: href, title: null });
    closeLinkDialog();
  }
  function removeLink() {
    clearMark('link');
    closeLinkDialog();
  }
  function wireLinkDialog() {
    const ok     = document.getElementById('format-link-ok');
    const cancel = document.getElementById('format-link-cancel');
    const remove = document.getElementById('format-link-remove');
    if (ok)     ok.addEventListener('click', applyLink);
    if (cancel) cancel.addEventListener('click', closeLinkDialog);
    if (remove) remove.addEventListener('click', removeLink);
    const input = _linkInput();
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
        if (e.key === 'Escape') { e.preventDefault(); closeLinkDialog(); }
      });
    }
  }

  // ============================================================
  // Button state refresh
  // ============================================================

  function refreshActiveStates() {
    const view = _view();
    const toolbar = _toolbar();
    if (!view || !toolbar) return;
    const state = view.state;
    const schema = state.schema;
    toolbar.querySelectorAll('.format-btn[data-mark]').forEach(function(btn) {
      const name = btn.dataset.mark;
      const mt = schema.marks[name];
      if (!mt) return;
      btn.classList.toggle('active', _markActive(state, mt));
    });
    // Color swatches reflect current selection's color value, if any
    const colorAttrs = _markAttrs(state, schema.marks.color);
    const sw = document.getElementById('format-color-swatch');
    if (sw) sw.style.background = (colorAttrs && colorAttrs.value) || 'transparent';
    const hlAttrs = _markAttrs(state, schema.marks.highlight);
    const hl = document.getElementById('format-highlight-icon');
    if (hl) hl.style.background = (hlAttrs && hlAttrs.value) || 'transparent';
  }

  // ============================================================
  // Init
  // ============================================================

  function init() {
    const toolbar = _toolbar();
    if (!toolbar) return;

    // Simple toggle buttons
    ['bold', 'italic', 'underline', 'strikethrough'].forEach(function(name) {
      const btn = toolbar.querySelector('.format-btn[data-mark="' + name + '"]');
      if (btn) btn.addEventListener('click', toggleMarkSimple(name));
    });

    // Color + highlight popover triggers
    const colorBtn = document.getElementById('format-btn-color');
    if (colorBtn) {
      colorBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openColorPopover('color', colorBtn);
      });
    }
    const highlightBtn = document.getElementById('format-btn-highlight');
    if (highlightBtn) {
      highlightBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openColorPopover('highlight', highlightBtn);
      });
    }
    wireColorPopover();

    // Link
    const linkBtn = toolbar.querySelector('.format-btn[data-mark="link"]');
    if (linkBtn) linkBtn.addEventListener('click', openLinkDialog);
    wireLinkDialog();

    // Selection-aware refresh
    document.addEventListener('selectionchange', refreshActiveStates);
    document.addEventListener('editor.tabActivated', refreshActiveStates);
    document.addEventListener('mouseup', refreshActiveStates);
    document.addEventListener('keyup', refreshActiveStates);

    // Initial paint after editor mounts
    setTimeout(refreshActiveStates, 200);
  }

  Rga.FormatToolbar = { init, refresh: refreshActiveStates };
})();
