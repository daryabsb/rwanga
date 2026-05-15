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
    // Block-type select reflects the focused inner block
    refreshBlockTypeSelect();
    // Scene toolbox enabled only when in a scene frame
    refreshSceneToolboxState();
  }

  // ============================================================
  // Block-type dropdown
  // ============================================================

  function _focusedSceneBlock() {
    const ae = document.activeElement;
    if (!ae || !ae.classList) return null;
    if (ae.classList.contains('rga-scene-block')) return ae;
    return null;
  }

  function _placeholderRefFor(blockEl) {
    if (!blockEl) return null;
    const root = blockEl.closest('.rga-scene-frame-placeholder');
    return root ? root._rgaScenePlaceholder : null;
  }

  function changeBlockType(newType) {
    const blockEl = _focusedSceneBlock();
    const ref = _placeholderRefFor(blockEl);
    if (!blockEl || !ref || !newType) return;
    if (typeof ref._changeBlockType !== 'function') return;
    ref._changeBlockType(blockEl, newType);
    if (typeof ref._dispatchInner === 'function') ref._dispatchInner();
    blockEl.focus();
  }

  function refreshBlockTypeSelect() {
    const select = document.getElementById('format-block-type');
    if (!select) return;
    const blockEl = _focusedSceneBlock();
    if (!blockEl) {
      select.value = '';
      return;
    }
    select.value = blockEl.dataset.blockType || '';
  }

  // Scene toolbox is enabled only when the cursor / focus is inside a
  // scene frame (a block or one of the slug/transition pickers).
  function refreshSceneToolboxState() {
    const tb = document.getElementById('scene-toolbox');
    if (!tb) return;
    const ae = document.activeElement;
    const inFrame = !!(ae && ae.closest && ae.closest('.rga-scene-frame-placeholder'));
    tb.classList.toggle('disabled', !inFrame);
  }

  // ============================================================
  // Tag selection (Scene toolbox)
  // ============================================================

  function applyTagFromSelection(tagType) {
    if (!tagType) return;
    const view = _view();
    if (!view) return;
    const { from, to, empty } = view.state.selection;
    if (empty) return;
    const text = view.state.doc.textBetween(from, to, ' ').trim();
    if (!text) return;
    const doc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
    if (!doc || !Rga.Doc || typeof Rga.Doc.addEntity !== 'function') return;
    // Add to tag_registry, get its id
    const entityId = Rga.Doc.addEntity(doc, tagType, { name: text, color: null });
    const mt = view.state.schema.marks.tag;
    if (!mt) return;
    view.dispatch(view.state.tr.addMark(from, to, mt.create({ tagType: tagType, entityId: entityId })));
    view.focus();
    // Mark doc dirty so save knows
    if (Rga.Doc.markDirty) Rga.Doc.markDirty(doc);
  }

  // ============================================================
  // Annotation + Revision flag dialogs
  // ============================================================

  let _annotationSelectedColor = '#FFE08A';

  function _annotationDialog() { return document.getElementById('format-annotation-dialog'); }
  function _annotationText()   { return document.getElementById('format-annotation-text'); }
  function openAnnotationDialog() {
    const view = _view();
    if (!view) return;
    const { from, to, empty } = view.state.selection;
    if (empty) return; // need a selection
    const dlg = _annotationDialog();
    if (!dlg) return;
    _annotationText().value = '';
    _annotationSelectedColor = '#FFE08A';
    _refreshAnnotationSwatchSelection();
    dlg.hidden = false;
    setTimeout(function() { _annotationText().focus(); }, 0);
  }
  function closeAnnotationDialog() {
    const dlg = _annotationDialog();
    if (dlg) dlg.hidden = true;
  }
  function applyAnnotation() {
    const view = _view();
    if (!view) return closeAnnotationDialog();
    const text = (_annotationText().value || '').trim();
    if (!Rga.Annotations || typeof Rga.Annotations.addAnnotation !== 'function') {
      return closeAnnotationDialog();
    }
    Rga.Annotations.addAnnotation(view, { text: text, color: _annotationSelectedColor });
    closeAnnotationDialog();
    view.focus();
  }
  function _refreshAnnotationSwatchSelection() {
    const grid = document.getElementById('format-annotation-colors');
    if (!grid) return;
    grid.querySelectorAll('.format-swatch').forEach(function(s) {
      s.classList.toggle('selected', s.dataset.color === _annotationSelectedColor);
    });
  }
  function wireAnnotationDialog() {
    const ok     = document.getElementById('format-annotation-ok');
    const cancel = document.getElementById('format-annotation-cancel');
    const grid   = document.getElementById('format-annotation-colors');
    if (ok)     ok.addEventListener('click', applyAnnotation);
    if (cancel) cancel.addEventListener('click', closeAnnotationDialog);
    if (grid) {
      grid.addEventListener('click', function(e) {
        const sw = e.target.closest('.format-swatch');
        if (!sw) return;
        _annotationSelectedColor = sw.dataset.color || _annotationSelectedColor;
        _refreshAnnotationSwatchSelection();
      });
    }
    const input = _annotationText();
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter')  { e.preventDefault(); applyAnnotation(); }
        if (e.key === 'Escape') { e.preventDefault(); closeAnnotationDialog(); }
      });
    }
  }

  function _flagDialog() { return document.getElementById('format-flag-dialog'); }
  function _flagReason() { return document.getElementById('format-flag-reason'); }
  function _flagStatus() { return document.getElementById('format-flag-status'); }
  function openFlagDialog() {
    const view = _view();
    if (!view) return;
    const { empty } = view.state.selection;
    if (empty) return;
    const dlg = _flagDialog();
    if (!dlg) return;
    _flagReason().value = '';
    _flagStatus().value = 'open';
    dlg.hidden = false;
    setTimeout(function() { _flagReason().focus(); }, 0);
  }
  function closeFlagDialog() {
    const dlg = _flagDialog();
    if (dlg) dlg.hidden = true;
  }
  function applyFlag() {
    const view = _view();
    if (!view) return closeFlagDialog();
    if (!Rga.RevisionFlags || typeof Rga.RevisionFlags.addRevisionFlag !== 'function') {
      return closeFlagDialog();
    }
    const reason = (_flagReason().value || '').trim();
    Rga.RevisionFlags.addRevisionFlag(view, { reason: reason });
    // If user picked 'resolved' we'd update post-add, but the addRevisionFlag
    // hard-codes status='open'. The Notes/Flags panel handles status changes.
    closeFlagDialog();
    view.focus();
  }
  function wireFlagDialog() {
    const ok     = document.getElementById('format-flag-ok');
    const cancel = document.getElementById('format-flag-cancel');
    if (ok)     ok.addEventListener('click', applyFlag);
    if (cancel) cancel.addEventListener('click', closeFlagDialog);
    const input = _flagReason();
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter')  { e.preventDefault(); applyFlag(); }
        if (e.key === 'Escape') { e.preventDefault(); closeFlagDialog(); }
      });
    }
  }

  // ============================================================
  // Clear formatting + Undo / Redo
  // ============================================================

  function clearAllFormatting() {
    const view = _view();
    if (!view) return;
    const { from, to, empty } = view.state.selection;
    if (empty) return;
    const PM = _PM();
    let tr = view.state.tr;
    const marks = view.state.schema.marks;
    Object.keys(marks).forEach(function(name) {
      tr = tr.removeMark(from, to, marks[name]);
    });
    view.dispatch(tr);
    view.focus();
  }

  function doUndo() {
    const view = _view();
    if (!view) return;
    const PM = _PM();
    PM.undo(view.state, view.dispatch);
    view.focus();
  }
  function doRedo() {
    const view = _view();
    if (!view) return;
    const PM = _PM();
    PM.redo(view.state, view.dispatch);
    view.focus();
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

    // Block-type dropdown
    const blockTypeSelect = document.getElementById('format-block-type');
    if (blockTypeSelect) {
      blockTypeSelect.addEventListener('change', function() {
        if (blockTypeSelect.value) changeBlockType(blockTypeSelect.value);
      });
    }

    // Undo / Redo
    const undoBtn = document.getElementById('format-btn-undo');
    const redoBtn = document.getElementById('format-btn-redo');
    if (undoBtn) undoBtn.addEventListener('click', doUndo);
    if (redoBtn) redoBtn.addEventListener('click', doRedo);

    // Annotation
    const annotationBtn = document.getElementById('format-btn-annotation');
    if (annotationBtn) annotationBtn.addEventListener('click', openAnnotationDialog);
    wireAnnotationDialog();

    // Revision flag
    const flagBtn = document.getElementById('format-btn-flag');
    if (flagBtn) flagBtn.addEventListener('click', openFlagDialog);
    wireFlagDialog();

    // Clear formatting
    const clearBtn = document.getElementById('format-btn-clear');
    if (clearBtn) clearBtn.addEventListener('click', clearAllFormatting);

    // Tag dropdown (Scene toolbox)
    const tagSel = document.getElementById('scene-tb-tag');
    if (tagSel) {
      tagSel.addEventListener('change', function() {
        const t = tagSel.value;
        if (!t) return;
        applyTagFromSelection(t);
        tagSel.value = '';
      });
    }

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
