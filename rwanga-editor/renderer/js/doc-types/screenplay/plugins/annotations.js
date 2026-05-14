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
    view.dispatch(view.state.tr.addMark(from, to, mark));
    return mark;
  }

  function updateAnnotationText(view, id, text) {
    const { doc, schema } = view.state;
    let tr = view.state.tr;
    doc.descendants(function(node, pos) {
      node.marks.forEach(function(m) {
        if (m.type === schema.marks.annotation && m.attrs.id === id) {
          const newMark = m.type.create(Object.assign({}, m.attrs, { text }));
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
    document.dispatchEvent(new CustomEvent('editor.annotationRemoved', { detail: { id } }));
  }

  // ---------------------------------------------------------------
  // "Add note" triggered from context menu
  // Applies the mark and fires editor.annotationAdded so the Notes
  // panel can create a card for it.
  // ---------------------------------------------------------------
  function addNoteFromMenu(view) {
    const { selection } = view.state;
    if (selection.empty) return;

    // Capture the marked text for the card title
    const selectedText = view.state.doc.textBetween(selection.from, selection.to, ' ');
    const id = crypto.randomUUID();
    const mark = addAnnotation(view, { id, color: ANNOTATION_COLORS[0] });

    document.dispatchEvent(new CustomEvent('editor.annotationAdded', {
      detail: {
        id,
        color: mark.attrs.color,
        markedText: selectedText,
        text: '',
      }
    }));

    // Open the Notes panel and focus the new card
    if (Rga.BottomPanel) {
      Rga.BottomPanel.open();
      Rga.BottomPanel.switchTab('notes');
    }
  }

  // ---------------------------------------------------------------
  // Small info popup on click
  // ---------------------------------------------------------------
  let _infoPopup = null;

  function hideInfoPopup() {
    if (_infoPopup && _infoPopup.parentNode) _infoPopup.parentNode.removeChild(_infoPopup);
    _infoPopup = null;
  }

  function showAnnotationInfo(view, mark, pos) {
    hideInfoPopup();

    const popup = document.createElement('div');
    popup.className = 'rga-mark-info-popup';

    const colorDot = document.createElement('span');
    colorDot.className = 'rga-info-dot';
    colorDot.style.background = mark.attrs.color;
    popup.appendChild(colorDot);

    const label = document.createElement('span');
    label.className = 'rga-info-label';
    label.textContent = mark.attrs.text || 'Note (no content yet)';
    popup.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'rga-info-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'rga-info-btn';
    editBtn.textContent = 'Edit in Notes';
    editBtn.addEventListener('click', function() {
      hideInfoPopup();
      if (Rga.BottomPanel) {
        Rga.BottomPanel.open();
        Rga.BottomPanel.switchTab('notes');
        document.dispatchEvent(new CustomEvent('editor.annotationFocused', {
          detail: { id: mark.attrs.id }
        }));
      }
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'rga-info-btn danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', function() {
      hideInfoPopup();
      removeAnnotation(view, mark.attrs.id);
      view.focus();
    });

    actions.appendChild(editBtn);
    actions.appendChild(removeBtn);
    popup.appendChild(actions);
    document.body.appendChild(popup);
    _infoPopup = popup;

    const coords = view.coordsAtPos(pos);
    const x = Math.min(coords.left, window.innerWidth - 260);
    const y = Math.min(coords.bottom + 6, window.innerHeight - 120);
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';

    setTimeout(function() {
      function onOutside(e) {
        if (_infoPopup && !_infoPopup.contains(e.target)) hideInfoPopup();
      }
      document.addEventListener('mousedown', onOutside, true);
    }, 0);
  }

  // ---------------------------------------------------------------
  // ProseMirror plugin
  // ---------------------------------------------------------------

  function annotationsPlugin() {
    const PM = window.RgaProseMirror;
    return new PM.Plugin({
      props: {
        handleClickOn: function(view, pos) {
          const schema = view.state.schema;
          if (!schema.marks.annotation) return false;

          const $pos = view.state.doc.resolve(pos);
          const annotMark = $pos.marks().find(function(m) {
            return m.type === schema.marks.annotation;
          });
          if (!annotMark) return false;

          showAnnotationInfo(view, annotMark, pos);
          return true;
        }
      }
    });
  }

  Rga.Annotations = {
    addAnnotation,
    updateAnnotationText,
    removeAnnotation,
    addNoteFromMenu,
    hideInfoPopup,
    annotationsPlugin,
    ANNOTATION_COLORS,
  };

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.annotationsPlugin = annotationsPlugin;
})();
