// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Manages the annotation-notes-list section in the bottom Notes panel.
// Listens for editor.annotationAdded / editor.annotationRemoved / editor.annotationFocused
// and re-syncs the card list with the current document state.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  let _listEl = null;
  let _view = null;   // set when the editor is mounted

  function getListEl() {
    if (!_listEl) _listEl = document.getElementById('annotation-notes-list');
    return _listEl;
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

    // Collect all annotation marks in document order
    const annotations = [];
    const seen = new Set();
    view.state.doc.descendants(function(node, pos) {
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

    renderCards(el, annotations, view);
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
  // Render note cards
  // ---------------------------------------------------------------
  function renderCards(el, annotations, view) {
    el.innerHTML = '';
    if (!annotations.length) {
      el.innerHTML = '<div class="annot-empty">No notes yet — select text and right-click to add a note.</div>';
      return;
    }

    annotations.forEach(function(annot) {
      const card = document.createElement('div');
      card.className = 'annot-card';
      card.dataset.id = annot.id;
      card.style.borderLeftColor = annot.color;

      // Marked text preview
      if (annot.markedText) {
        const preview = document.createElement('div');
        preview.className = 'annot-card-preview';
        preview.textContent = annot.markedText.slice(0, 60) + (annot.markedText.length > 60 ? '…' : '');
        card.appendChild(preview);
      }

      // Editable note textarea
      const textarea = document.createElement('textarea');
      textarea.className = 'annot-card-textarea';
      textarea.placeholder = 'Write your note…';
      textarea.value = annot.text;
      textarea.rows = 2;

      textarea.addEventListener('input', function() {
        if (view && Rga.Annotations && Rga.Annotations.updateAnnotationText) {
          Rga.Annotations.updateAnnotationText(view, annot.id, textarea.value);
        }
      });
      card.appendChild(textarea);

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'annot-card-remove';
      removeBtn.title = 'Remove note';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', function() {
        if (view && Rga.Annotations && Rga.Annotations.removeAnnotation) {
          Rga.Annotations.removeAnnotation(view, annot.id);
        }
        card.remove();
        if (!el.children.length) {
          el.innerHTML = '<div class="annot-empty">No notes yet — select text and right-click to add a note.</div>';
        }
      });
      card.appendChild(removeBtn);

      el.appendChild(card);
    });
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
  function getView() {
    return _view
      || (Rga.TabManager && Rga.TabManager._editorView && Rga.TabManager._editorView())
      || null;
  }

  document.addEventListener('editor.annotationAdded', function(e) {
    const el = getListEl();
    if (!el) return;
    // Lazily acquire the view if refresh() was never called
    if (!_view) _view = getView();
    // Add a single new card immediately rather than full refresh
    const annot = e.detail;
    const empty = el.querySelector('.annot-empty');
    if (empty) empty.remove();

    const card = document.createElement('div');
    card.className = 'annot-card annot-card-active';
    card.dataset.id = annot.id;
    card.style.borderLeftColor = annot.color;

    if (annot.markedText) {
      const preview = document.createElement('div');
      preview.className = 'annot-card-preview';
      preview.textContent = annot.markedText.slice(0, 60) + (annot.markedText.length > 60 ? '…' : '');
      card.appendChild(preview);
    }

    const textarea = document.createElement('textarea');
    textarea.className = 'annot-card-textarea';
    textarea.placeholder = 'Write your note…';
    textarea.rows = 2;
    textarea.addEventListener('input', function() {
      const v = getView();
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
      const v = getView();
      if (v && Rga.Annotations && Rga.Annotations.removeAnnotation) {
        Rga.Annotations.removeAnnotation(v, annot.id);
      }
      card.remove();
    });
    card.appendChild(removeBtn);

    el.appendChild(card);
    setTimeout(function() { textarea.focus(); }, 0);
  });

  document.addEventListener('editor.annotationRemoved', function(e) {
    const el = getListEl();
    if (!el) return;
    const card = el.querySelector('[data-id="' + e.detail.id + '"]');
    if (card) card.remove();
    if (!el.children.length) {
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

  Rga.AnnotationNotes = { refresh, highlightCard };
})();
