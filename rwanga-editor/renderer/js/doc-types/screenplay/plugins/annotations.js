// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const ANNOTATION_COLORS = [
    '#FFE08A', // yellow (default)
    '#A8F0A8', // green
    '#A8D8F0', // blue
    '#F0A8D8', // pink
    '#F0C8A8', // orange
    '#D8A8F0', // purple
  ];

  // ---------------------------------------------------------------
  // Transaction helpers
  // ---------------------------------------------------------------

  function addAnnotation(view, payload) {
    const { schema, selection } = view.state;
    const { from, to } = selection;
    const mark = schema.marks.annotation.create({
      id: payload.id || crypto.randomUUID(),
      text: payload.text || '',
      color: payload.color || ANNOTATION_COLORS[0],
      createdAt: payload.createdAt || new Date().toISOString(),
      author: payload.author || null,
    });
    const tr = view.state.tr.addMark(from, to, mark);
    view.dispatch(tr);
  }

  function updateAnnotation(view, id, updates) {
    const { doc, schema } = view.state;
    let tr = view.state.tr;
    doc.descendants(function(node, pos) {
      node.marks.forEach(function(m) {
        if (m.type === schema.marks.annotation && m.attrs.id === id) {
          const newMark = m.type.create(Object.assign({}, m.attrs, updates));
          tr = tr.removeMark(pos, pos + node.nodeSize, m.type);
          tr = tr.addMark(pos, pos + node.nodeSize, newMark);
        }
      });
    });
    view.dispatch(tr);
  }

  function removeAnnotation(view, id) {
    const { doc, schema } = view.state;
    let tr = view.state.tr;
    doc.descendants(function(node, pos) {
      node.marks.forEach(function(m) {
        if (m.type === schema.marks.annotation && m.attrs.id === id) {
          tr = tr.removeMark(pos, pos + node.nodeSize, m);
        }
      });
    });
    view.dispatch(tr);
  }

  // ---------------------------------------------------------------
  // Popup UI
  // ---------------------------------------------------------------

  let _popup = null;

  function closePopup() {
    if (_popup && _popup.parentNode) _popup.parentNode.removeChild(_popup);
    _popup = null;
  }

  function positionPopup(popup, anchorRect) {
    const x = Math.min(anchorRect.left, window.innerWidth - 260);
    const y = anchorRect.bottom + 6;
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';
  }

  function showAnnotationEditor(view, existingMark) {
    closePopup();
    if (Rga.ContextMenu) Rga.ContextMenu.hide();

    const { selection } = view.state;
    if (selection.empty && !existingMark) return;

    const popup = document.createElement('div');
    popup.className = 'rga-annotation-popup';

    // Color swatches
    const swatchRow = document.createElement('div');
    swatchRow.className = 'rga-popup-swatches';
    let selectedColor = (existingMark && existingMark.attrs.color) || ANNOTATION_COLORS[0];

    ANNOTATION_COLORS.forEach(function(color) {
      const swatch = document.createElement('button');
      swatch.className = 'rga-swatch' + (color === selectedColor ? ' active' : '');
      swatch.style.background = color;
      swatch.title = color;
      swatch.addEventListener('click', function() {
        selectedColor = color;
        swatchRow.querySelectorAll('.rga-swatch').forEach(function(s) {
          s.classList.toggle('active', s.style.background === color || s.style.backgroundColor === color);
        });
      });
      swatchRow.appendChild(swatch);
    });

    // Textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'rga-popup-textarea';
    textarea.placeholder = 'Add a note…';
    textarea.rows = 3;
    if (existingMark) textarea.value = existingMark.attrs.text || '';

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'rga-popup-btns';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'rga-popup-btn primary';
    saveBtn.textContent = existingMark ? 'Update' : 'Save';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'rga-popup-btn';
    cancelBtn.textContent = 'Cancel';

    if (existingMark) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'rga-popup-btn danger';
      deleteBtn.textContent = 'Remove';
      deleteBtn.addEventListener('click', function() {
        removeAnnotation(view, existingMark.attrs.id);
        closePopup();
        view.focus();
      });
      btnRow.appendChild(deleteBtn);
    }

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);

    popup.appendChild(swatchRow);
    popup.appendChild(textarea);
    popup.appendChild(btnRow);
    document.body.appendChild(popup);
    _popup = popup;

    // Position near selection
    const coords = view.coordsAtPos(selection.from);
    positionPopup(popup, { left: coords.left, bottom: coords.bottom });

    textarea.focus();

    saveBtn.addEventListener('click', function() {
      if (existingMark) {
        updateAnnotation(view, existingMark.attrs.id, {
          text: textarea.value,
          color: selectedColor,
        });
      } else {
        addAnnotation(view, { text: textarea.value, color: selectedColor });
      }
      closePopup();
      view.focus();
    });

    cancelBtn.addEventListener('click', function() {
      closePopup();
      view.focus();
    });

    // Dismiss on outside click
    setTimeout(function() {
      function onOutside(e) {
        if (_popup && !_popup.contains(e.target)) closePopup();
      }
      document.addEventListener('mousedown', onOutside, true);
      popup._dismissOutside = onOutside;
    }, 0);
  }

  // ---------------------------------------------------------------
  // ProseMirror plugin — click annotated text to re-open editor
  // ---------------------------------------------------------------

  function annotationsPlugin() {
    const PM = window.RgaProseMirror;
    return new PM.Plugin({
      props: {
        handleClickOn: function(view, pos, node, nodePos, event) {
          const schema = view.state.schema;
          if (!schema.marks.annotation) return false;

          // Find an annotation mark at click position
          const $pos = view.state.doc.resolve(pos);
          const marks = $pos.marks();
          const annotMark = marks.find(function(m) {
            return m.type === schema.marks.annotation;
          });
          if (!annotMark) return false;

          showAnnotationEditor(view, annotMark);
          return true;
        }
      }
    });
  }

  Rga.Annotations = {
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    showAnnotationEditor,
    closePopup,
    annotationsPlugin,
    ANNOTATION_COLORS,
  };

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.annotationsPlugin = annotationsPlugin;
})();
