// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Manages the Notes panel tab in the bottom panel.
// Listens for editor.annotationAdded / editor.annotationRemoved / editor.annotationFocused
// and re-syncs the card list with the current document state.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  let _listEl = null;
  let _view = null;

  function getListEl() {
    if (!_listEl) _listEl = document.getElementById('annotation-notes-list');
    return _listEl;
  }

  function getView() {
    return _view
      || (Rga.TabManager && Rga.TabManager._editorView && Rga.TabManager._editorView())
      || null;
  }

  // ---------------------------------------------------------------
  // Navigate editor cursor to the first occurrence of an annotation
  // ---------------------------------------------------------------
  function navigateToAnnotation(id) {
    const view = getView();
    if (!view) return;
    const schema = view.state.schema;
    let targetPos = null;
    view.state.doc.descendants(function(node, pos) {
      if (targetPos !== null) return false;
      if (node.marks.some(function(m) {
        return m.type === schema.marks.annotation && m.attrs.id === id;
      })) {
        targetPos = pos;
        return false;
      }
    });
    if (targetPos !== null) {
      const PM = window.RgaProseMirror;
      const tr = view.state.tr.setSelection(PM.TextSelection.create(view.state.doc, targetPos));
      view.dispatch(tr.scrollIntoView());
      view.focus();
    }
  }

  // ---------------------------------------------------------------
  // Build a single card element
  // ---------------------------------------------------------------
  function _buildCard(annot, view) {
    const card = document.createElement('div');
    card.className = 'annot-card';
    card.dataset.id = annot.id;
    card.style.borderLeftColor = annot.color;

    if (annot.markedText) {
      const preview = document.createElement('div');
      preview.className = 'annot-card-preview';
      preview.textContent = annot.markedText.slice(0, 60) + (annot.markedText.length > 60 ? '…' : '');
      preview.title = 'Click to jump to this note in the editor';
      preview.addEventListener('click', function() {
        navigateToAnnotation(annot.id);
      });
      card.appendChild(preview);
    }

    const textarea = document.createElement('textarea');
    textarea.className = 'annot-card-textarea';
    textarea.placeholder = 'Write your note…';
    textarea.value = annot.text;
    textarea.rows = 2;
    textarea.addEventListener('input', function() {
      const v = view || getView();
      if (v && Rga.Annotations && Rga.Annotations.updateAnnotationText) {
        Rga.Annotations.updateAnnotationText(v, annot.id, textarea.value);
      }
    });
    card.appendChild(textarea);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'annot-card-remove';
    removeBtn.title = 'Remove note';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', function() {
      const v = view || getView();
      if (v && Rga.Annotations && Rga.Annotations.removeAnnotation) {
        Rga.Annotations.removeAnnotation(v, annot.id);
      }
    });
    card.appendChild(removeBtn);

    return card;
  }

  // ---------------------------------------------------------------
  // Sync the card list to the current PM document
  // ---------------------------------------------------------------
  function refresh(view) {
    _view = view;
    const el = getListEl();
    if (!el) return;

    const schema = view.state.schema;
    if (!schema || !schema.marks.annotation) return;

    const annotations = [];
    const seen = new Set();
    view.state.doc.descendants(function(node) {
      node.marks.forEach(function(m) {
        if (m.type === schema.marks.annotation && !seen.has(m.attrs.id)) {
          seen.add(m.attrs.id);
          annotations.push({
            id: m.attrs.id,
            color: m.attrs.color,
            text: m.attrs.text || '',
            markedText: _extractMarkedText(view, m.attrs.id),
          });
        }
      });
    });

    el.innerHTML = '';
    if (!annotations.length) {
      el.innerHTML = '<div class="annot-empty">No notes yet — select text and right-click to add a note.</div>';
      return;
    }
    annotations.forEach(function(annot) {
      el.appendChild(_buildCard(annot, view));
    });
  }

  function _extractMarkedText(view, id) {
    const schema = view.state.schema;
    let text = '';
    view.state.doc.descendants(function(node) {
      if (node.isText && node.marks.some(function(m) {
        return m.type === schema.marks.annotation && m.attrs.id === id;
      })) {
        text += node.text;
      }
    });
    return text;
  }

  // ---------------------------------------------------------------
  // Highlight a specific card (when cursor enters annotated text)
  // ---------------------------------------------------------------
  function highlightCard(id) {
    const el = getListEl();
    if (!el) return;
    el.querySelectorAll('.annot-card').forEach(function(card) {
      card.classList.toggle('annot-card-active', card.dataset.id === id);
    });
    const active = el.querySelector('.annot-card[data-id="' + id + '"]');
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------------------------------------------------------------
  // Event listeners
  // ---------------------------------------------------------------

  document.addEventListener('editor.tabActivated', function() {
    const v = getView();
    if (v) refresh(v);
  });

  document.addEventListener('editor.annotationAdded', function(e) {
    const el = getListEl();
    if (!el) return;
    if (!_view) _view = getView();
    const annot = e.detail;
    const empty = el.querySelector('.annot-empty');
    if (empty) empty.remove();

    const card = _buildCard(annot, _view);
    card.classList.add('annot-card-active');
    el.appendChild(card);
    setTimeout(function() {
      const ta = card.querySelector('textarea');
      if (ta) ta.focus();
    }, 0);
  });

  document.addEventListener('editor.annotationRemoved', function(e) {
    const el = getListEl();
    if (!el) return;
    const card = el.querySelector('[data-id="' + e.detail.id + '"]');
    if (card) card.remove();
    if (!el.querySelector('.annot-card')) {
      el.innerHTML = '<div class="annot-empty">No notes yet — select text and right-click to add a note.</div>';
    }
  });

  document.addEventListener('editor.annotationFocused', function(e) {
    highlightCard(e.detail.id);
    const el = getListEl();
    if (el) {
      const card = el.querySelector('[data-id="' + e.detail.id + '"]');
      if (card) {
        const ta = card.querySelector('textarea');
        if (ta) ta.focus();
      }
    }
  });

  Rga.AnnotationNotes = { refresh, highlightCard, navigateToAnnotation };
})();
