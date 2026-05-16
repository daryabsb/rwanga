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

  // Cached references so the scene toolbox can act on the prior scene block
  // even after focus moves to one of the toolbar's own controls. activeElement
  // becomes the <select> the instant the user clicks it, which is too late to
  // resolve the block being edited. Tracked via a focusin listener (see init).
  let _lastSceneBlock = null;
  let _lastSceneFrame = null;

  function _isToolbarFocus(node) {
    if (!node || !node.closest) return false;
    return !!(
      node.closest('#format-toolbar') ||
      node.closest('#scene-toolbox') ||
      node.closest('#format-color-popover') ||
      node.closest('#format-link-dialog') ||
      node.closest('#format-annotation-dialog') ||
      node.closest('#format-flag-dialog')
    );
  }

  function _validSceneBlock() {
    if (_lastSceneBlock && document.body && document.body.contains(_lastSceneBlock)) {
      return _lastSceneBlock;
    }
    _lastSceneBlock = null;
    return null;
  }

  function _validSceneFrame() {
    if (_lastSceneFrame && document.body && document.body.contains(_lastSceneFrame)) {
      return _lastSceneFrame;
    }
    _lastSceneFrame = null;
    return null;
  }

  function _onFocusIn(e) {
    const t = e.target;
    if (!t) return;
    // While focus lives in the toolbar, popovers, or modal dialogs, preserve
    // the cached scene-block so the user can still act on it.
    if (_isToolbarFocus(t)) return;
    if (t.classList && t.classList.contains('rga-scene-block')) {
      _lastSceneBlock = t;
    } else {
      _lastSceneBlock = null;
    }
    _lastSceneFrame = (t.closest && t.closest('.rga-scene-frame-placeholder')) || null;
    refreshActiveStates();
  }

  function _placeholderRefFor(blockEl) {
    if (!blockEl) return null;
    const root = blockEl.closest('.rga-scene-frame-placeholder');
    return root ? root._rgaScenePlaceholder : null;
  }

  function changeBlockType(newType) {
    const blockEl = _validSceneBlock();
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
    const blockEl = _validSceneBlock();
    if (!blockEl) {
      select.value = '';
      return;
    }
    select.value = blockEl.dataset.blockType || '';
  }

  // Scene toolbox is enabled when the most recent non-toolbar focus was
  // inside a scene frame (block, slug pickers, transition picker). Reading
  // the cache rather than activeElement keeps the toolbox usable while the
  // user is interacting with its own controls.
  function refreshSceneToolboxState() {
    const tb = document.getElementById('scene-toolbox');
    if (!tb) return;
    tb.classList.toggle('disabled', !_validSceneFrame());
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

  // The toolbar Flag button delegates to Rga.RevisionFlags.showRevisionEditor,
  // which is the same rich popup the right-click menu uses (3 severity
  // swatches + reason). No local dialog is needed.
  function openFlagPopup() {
    const view = _view();
    if (!view) return;
    if (view.state.selection.empty) return;
    if (Rga.RevisionFlags && typeof Rga.RevisionFlags.showRevisionEditor === 'function') {
      Rga.RevisionFlags.showRevisionEditor(view, null, null);
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

    // Revision flag — opens the same rich popup as right-click.
    const flagBtn = document.getElementById('format-btn-flag');
    if (flagBtn) flagBtn.addEventListener('click', openFlagPopup);

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

    // Focus tracking — keeps a cached reference to the last scene block /
    // frame so toolbar controls can target it after stealing focus.
    document.addEventListener('focusin', _onFocusIn);

    // Selection-aware refresh
    document.addEventListener('selectionchange', refreshActiveStates);
    document.addEventListener('editor.tabActivated', function() {
      _lastSceneBlock = null;
      _lastSceneFrame = null;
      refreshActiveStates();
    });
    document.addEventListener('mouseup', refreshActiveStates);
    document.addEventListener('keyup', refreshActiveStates);

    // Initial paint after editor mounts
    setTimeout(refreshActiveStates, 200);
  }

  Rga.FormatToolbar = { init, refresh: refreshActiveStates };
})();
