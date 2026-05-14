// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 5 — persistent editor toolbar with context-sensitive state.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  let _view = null;

  // ---------------------------------------------------------------
  // Toolbar DOM builder
  // ---------------------------------------------------------------

  function _btn(label, title, action, className) {
    const b = document.createElement('button');
    b.className = 'tb-btn' + (className ? ' ' + className : '');
    b.title = title;
    b.innerHTML = label;
    b.addEventListener('mousedown', function(e) {
      e.preventDefault();
      if (_view) action(_view);
    });
    return b;
  }

  function _sep() {
    const s = document.createElement('span');
    s.className = 'tb-sep';
    return s;
  }

  function _markBtn(markName, label, title) {
    const b = _btn(label, title, function(view) {
      const PM = window.RgaProseMirror;
      const mark = view.state.schema.marks[markName];
      if (mark) PM.toggleMark(mark)(view.state, view.dispatch);
      view.focus();
    }, 'tb-mark');
    b.dataset.mark = markName;
    return b;
  }

  function _buildToolbar(container) {
    container.innerHTML = '';
    container.className = 'editor-toolbar';

    // ---- Formatting marks ----
    const fmtGroup = document.createElement('div');
    fmtGroup.className = 'tb-group';
    fmtGroup.appendChild(_markBtn('bold',          '<b>B</b>',       'Bold (Ctrl+B)'));
    fmtGroup.appendChild(_markBtn('italic',        '<i>I</i>',       'Italic (Ctrl+I)'));
    fmtGroup.appendChild(_markBtn('underline',     '<u>U</u>',       'Underline (Ctrl+U)'));
    fmtGroup.appendChild(_markBtn('strikethrough', '<s>S</s>',       'Strikethrough'));
    container.appendChild(fmtGroup);

    container.appendChild(_sep());

    // ---- Undo / Redo ----
    const histGroup = document.createElement('div');
    histGroup.className = 'tb-group';
    histGroup.appendChild(_btn('↩', 'Undo (Ctrl+Z)', function(view) {
      window.RgaProseMirror.undo(view.state, view.dispatch);
      view.focus();
    }, 'tb-undo'));
    histGroup.appendChild(_btn('↪', 'Redo (Ctrl+Y)', function(view) {
      window.RgaProseMirror.redo(view.state, view.dispatch);
      view.focus();
    }, 'tb-redo'));
    container.appendChild(histGroup);

    container.appendChild(_sep());

    // ---- Block type dropdown (context-sensitive) ----
    const blockGroup = document.createElement('div');
    blockGroup.className = 'tb-group';

    const blockSel = document.createElement('select');
    blockSel.className = 'tb-select';
    blockSel.id = 'tb-block-type';
    blockSel.title = 'Block type';

    // Options populated dynamically in update()
    blockGroup.appendChild(blockSel);
    container.appendChild(blockGroup);

    blockSel.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    blockSel.addEventListener('change', function() {
      if (!_view) return;
      _applyBlockType(_view, blockSel.value);
      _view.focus();
    });

    container.appendChild(_sep());

    // ---- Writer mark actions (right side) ----
    const actionsGroup = document.createElement('div');
    actionsGroup.className = 'tb-group tb-actions';

    const annotBtn = _btn('✎', 'Add note (Ctrl+Shift+H)', function(view) {
      if (view.state.selection.empty) return;
      if (Rga.Annotations && Rga.Annotations.addNoteFromMenu) Rga.Annotations.addNoteFromMenu(view);
    }, 'tb-action');
    annotBtn.id = 'tb-btn-annot';

    const tagBtn = _btn('⊕', 'Tag as... ', function(view) {
      if (view.state.selection.empty) return;
      if (Rga.Tags && Rga.Tags.showTagDialog) Rga.Tags.showTagDialog(view, 'character');
    }, 'tb-action');
    tagBtn.id = 'tb-btn-tag';

    const flagBtn = _btn('⚑', 'Flag for revision (Ctrl+Shift+F)', function(view) {
      if (view.state.selection.empty) return;
      if (Rga.RevisionFlags && Rga.RevisionFlags.showRevisionEditor) Rga.RevisionFlags.showRevisionEditor(view);
    }, 'tb-action');
    flagBtn.id = 'tb-btn-flag';

    actionsGroup.appendChild(annotBtn);
    actionsGroup.appendChild(tagBtn);
    actionsGroup.appendChild(flagBtn);
    container.appendChild(actionsGroup);
  }

  // ---------------------------------------------------------------
  // Update toolbar state to match current editor state
  // ---------------------------------------------------------------

  const OUTSIDE_BLOCK_TYPES = [
    { value: 'paragraph',  label: 'Paragraph' },
    { value: 'heading-1',  label: 'Heading 1' },
    { value: 'heading-2',  label: 'Heading 2' },
    { value: 'heading-3',  label: 'Heading 3' },
    { value: 'quote',      label: 'Quote' },
  ];

  const INSIDE_BLOCK_TYPES = [
    { value: 'action',        label: 'Action' },
    { value: 'character',     label: 'Character' },
    { value: 'dialogue',      label: 'Dialogue' },
    { value: 'parenthetical', label: 'Parenthetical' },
    { value: 'transition',    label: 'Transition' },
    { value: 'shot',          label: 'Shot' },
    { value: 'sceneLine',     label: 'Scene header' },
  ];

  function _isInsideScene($from) {
    for (let d = 0; d <= $from.depth; d++) {
      if ($from.node(d).type.name === 'scene') return true;
    }
    return false;
  }

  function _currentBlockValue($from) {
    const parent = $from.parent;
    const name = parent.type.name;
    if (name === 'heading') return 'heading-' + (parent.attrs.level || 1);
    return name;
  }

  function update(view) {
    _view = view;
    const container = document.getElementById('editor-toolbar');
    if (!container) return;

    const state = view.state;
    const { $from } = state.selection;
    const inside = _isInsideScene($from);
    const hasSelection = !state.selection.empty;

    // ---- Mark buttons active state ----
    container.querySelectorAll('.tb-mark[data-mark]').forEach(function(btn) {
      const markType = state.schema.marks[btn.dataset.mark];
      if (!markType) { btn.disabled = true; return; }
      btn.disabled = false;
      // Check if mark is active at cursor
      const active = markType.isInSet(state.storedMarks || $from.marks());
      btn.classList.toggle('active', !!active);
    });

    // ---- Block type dropdown ----
    const blockSel = container.querySelector('#tb-block-type');
    if (blockSel) {
      const types = inside ? INSIDE_BLOCK_TYPES : OUTSIDE_BLOCK_TYPES;
      const current = _currentBlockValue($from);

      // Only repopulate when context switches (inside ↔ outside)
      const wasInside = blockSel.dataset.context === 'inside';
      if (wasInside !== inside) {
        blockSel.innerHTML = '';
        types.forEach(function(t) {
          const opt = document.createElement('option');
          opt.value = t.value;
          opt.textContent = t.label;
          blockSel.appendChild(opt);
        });
        blockSel.dataset.context = inside ? 'inside' : 'outside';
      }

      // Sync selected value without triggering change event
      if (blockSel.value !== current) blockSel.value = current;
    }

    // ---- Writer action buttons ----
    ['tb-btn-annot', 'tb-btn-tag', 'tb-btn-flag'].forEach(function(id) {
      const btn = container.querySelector('#' + id);
      if (btn) btn.disabled = !hasSelection;
    });

    // ---- Undo/Redo ----
    const PM = window.RgaProseMirror;
    const undoBtn = container.querySelector('.tb-undo');
    const redoBtn = container.querySelector('.tb-redo');
    if (undoBtn) undoBtn.disabled = !PM.undoDepth(state);
    if (redoBtn) redoBtn.disabled = !PM.redoDepth(state);
  }

  // ---------------------------------------------------------------
  // Apply block type from dropdown value
  // ---------------------------------------------------------------

  function _applyBlockType(view, value) {
    const PM = window.RgaProseMirror;
    const { state, dispatch } = view;
    const s = state.schema;
    const { $from, $to } = state.selection;

    if (value === 'paragraph') {
      dispatch(state.tr.setNodeMarkup($from.before($from.depth), s.nodes.paragraph));
    } else if (value.startsWith('heading-')) {
      const level = parseInt(value.split('-')[1], 10) || 1;
      dispatch(state.tr.setNodeMarkup($from.before($from.depth), s.nodes.heading, { level }));
    } else if (value === 'quote') {
      dispatch(state.tr.setNodeMarkup($from.before($from.depth), s.nodes.quote));
    } else if (s.nodes[value]) {
      // Screenplay block types: action, character, dialogue, etc.
      dispatch(state.tr.setNodeMarkup($from.before($from.depth), s.nodes[value]));
    }
  }

  // ---------------------------------------------------------------
  // ProseMirror plugin — fires update() on every state change
  // ---------------------------------------------------------------

  function toolbarPlugin() {
    const PM = window.RgaProseMirror;
    return new PM.Plugin({
      view: function() {
        return {
          update: function(view) {
            update(view);
          }
        };
      }
    });
  }

  // ---------------------------------------------------------------
  // Init — build toolbar DOM (called after DOM ready)
  // ---------------------------------------------------------------

  function init() {
    const container = document.getElementById('editor-toolbar');
    if (!container) return;
    _buildToolbar(container);
  }

  Rga.Toolbar = { init, update, toolbarPlugin };

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.toolbarPlugin = toolbarPlugin;
})();
