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
      status: payload.status || 'open',
    });
    view.dispatch(view.state.tr.addMark(from, to, mark));
    // Capture marked text from the doc state we just dispatched.
    const markedText = view.state.doc.textBetween(from, to, ' ');
    document.dispatchEvent(new CustomEvent('editor.annotationAdded', {
      detail: {
        id: mark.attrs.id,
        color: mark.attrs.color,
        text: mark.attrs.text,
        markedText: markedText,
        status: mark.attrs.status,
      }
    }));
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

  // Flip the status attr in place. Keeps the mark in the doc so restore can
  // bring the highlight back without searching for the original range.
  function _setAnnotationStatus(view, id, status) {
    const { doc, schema } = view.state;
    let tr = view.state.tr;
    let changed = false;
    doc.descendants(function(node, pos) {
      node.marks.forEach(function(m) {
        if (m.type === schema.marks.annotation && m.attrs.id === id && m.attrs.status !== status) {
          const newMark = m.type.create(Object.assign({}, m.attrs, { status: status }));
          tr = tr.removeMark(pos, pos + node.nodeSize, m.type);
          tr = tr.addMark(pos, pos + node.nodeSize, newMark);
          changed = true;
        }
      });
    });
    if (changed) view.dispatch(tr);
    return changed;
  }

  function resolveAnnotation(view, id) {
    if (_setAnnotationStatus(view, id, 'resolved')) {
      document.dispatchEvent(new CustomEvent('editor.annotationResolved', { detail: { id } }));
    }
  }

  function restoreAnnotation(view, id) {
    if (_setAnnotationStatus(view, id, 'open')) {
      document.dispatchEvent(new CustomEvent('editor.annotationRestored', { detail: { id } }));
    }
  }

  // ---------------------------------------------------------------
  // "Add note" triggered from context menu
  // Applies the mark and fires editor.annotationAdded so the Notes
  // panel can create a card for it.
  // ---------------------------------------------------------------
  function addNoteFromMenu(view) {
    const { selection } = view.state;
    if (selection.empty) return;
    // addAnnotation already fires editor.annotationAdded for the panel.
    addAnnotation(view, { id: crypto.randomUUID(), color: ANNOTATION_COLORS[0] });
    if (Rga.BottomPanel) Rga.BottomPanel.switchTo('notes');
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
      if (Rga.BottomPanel) Rga.BottomPanel.switchTo('notes');
      if (Rga.AnnotationNotes) {
        Rga.AnnotationNotes.highlightCard(mark.attrs.id);
        setTimeout(function() { Rga.AnnotationNotes.focusCard(mark.attrs.id); }, 0);
      }
    });

    const isResolved = mark.attrs.status === 'resolved';
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'rga-info-btn';
    toggleBtn.textContent = isResolved ? 'Restore' : 'Resolve';
    toggleBtn.title = isResolved
      ? 'Restore the highlight and move the card back to open'
      : 'Mark resolved — removes the highlight, keeps the note in the panel struck through';
    toggleBtn.addEventListener('click', function() {
      hideInfoPopup();
      if (isResolved) restoreAnnotation(view, mark.attrs.id);
      else resolveAnnotation(view, mark.attrs.id);
      view.focus();
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'rga-info-btn danger';
    removeBtn.textContent = 'Remove';
    removeBtn.title = 'Delete the note entirely (cannot be restored)';
    removeBtn.addEventListener('click', function() {
      hideInfoPopup();
      removeAnnotation(view, mark.attrs.id);
      view.focus();
    });

    actions.appendChild(editBtn);
    actions.appendChild(toggleBtn);
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

  let _lastAnnotId = null;

  function annotationsPlugin() {
    const PM = window.RgaProseMirror;
    return new PM.Plugin({
      view: function() {
        return {
          update: function(view) {
            const schema = view.state.schema;
            if (!schema.marks.annotation) return;
            const { from } = view.state.selection;
            const $pos = view.state.doc.resolve(from);
            const annotMark = $pos.marks().find(function(m) {
              return m.type === schema.marks.annotation;
            });
            const id = annotMark ? annotMark.attrs.id : null;
            if (id !== _lastAnnotId) {
              _lastAnnotId = id;
              if (id) {
                document.dispatchEvent(new CustomEvent('editor.annotationFocused', { detail: { id } }));
              }
            }
          }
        };
      },
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
    resolveAnnotation,
    restoreAnnotation,
    addNoteFromMenu,
    hideInfoPopup,
    annotationsPlugin,
    ANNOTATION_COLORS,
  };

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.annotationsPlugin = annotationsPlugin;
})();
