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
    const isResolved = annot.status === 'resolved';
    const card = document.createElement('div');
    card.className = isResolved ? 'annot-card annot-card-resolved' : 'annot-card';
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

    if (isResolved) {
      // Resolved cards are read-only — the note text shows as a small label
      // and the action buttons toggle restore / remove.
      if (annot.text) {
        const label = document.createElement('div');
        label.className = 'annot-card-text';
        label.textContent = annot.text;
        card.appendChild(label);
      }
    } else {
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
    }

    const actions = document.createElement('div');
    actions.className = 'annot-card-actions';

    if (isResolved) {
      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'annot-card-btn';
      restoreBtn.title = 'Restore the highlight and move the note back to open';
      restoreBtn.textContent = '↺';
      restoreBtn.addEventListener('click', function() {
        const v = view || getView();
        if (v && Rga.Annotations && Rga.Annotations.restoreAnnotation) {
          Rga.Annotations.restoreAnnotation(v, annot.id);
        }
      });
      actions.appendChild(restoreBtn);
    } else {
      const resolveBtn = document.createElement('button');
      resolveBtn.className = 'annot-card-btn';
      resolveBtn.title = 'Resolve — removes the highlight, keeps the note here struck through';
      resolveBtn.textContent = '✓';
      resolveBtn.addEventListener('click', function() {
        const v = view || getView();
        if (v && Rga.Annotations && Rga.Annotations.resolveAnnotation) {
          Rga.Annotations.resolveAnnotation(v, annot.id);
        }
      });
      actions.appendChild(resolveBtn);
    }

    const removeBtn = document.createElement('button');
    removeBtn.className = 'annot-card-btn annot-card-remove';
    removeBtn.title = 'Delete the note entirely (cannot be restored)';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', function() {
      const v = view || getView();
      if (v && Rga.Annotations && Rga.Annotations.removeAnnotation) {
        Rga.Annotations.removeAnnotation(v, annot.id);
      }
    });
    actions.appendChild(removeBtn);

    card.appendChild(actions);
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

    const open = [];
    const resolved = [];
    const seen = new Set();
    view.state.doc.descendants(function(node) {
      node.marks.forEach(function(m) {
        if (m.type === schema.marks.annotation && !seen.has(m.attrs.id)) {
          seen.add(m.attrs.id);
          const card = {
            id: m.attrs.id,
            color: m.attrs.color,
            text: m.attrs.text || '',
            status: m.attrs.status || 'open',
            markedText: _extractMarkedText(view, m.attrs.id),
          };
          if (card.status === 'resolved') resolved.push(card);
          else open.push(card);
        }
      });
    });

    el.innerHTML = '';
    if (!open.length && !resolved.length) {
      el.innerHTML = '<div class="annot-empty">No notes yet — select text and right-click to add a note.</div>';
      return;
    }
    open.forEach(function(annot) { el.appendChild(_buildCard(annot, view)); });

    if (resolved.length) {
      const divider = document.createElement('div');
      divider.className = 'annot-log-divider';
      divider.textContent = 'Resolved (' + resolved.length + ')';
      el.appendChild(divider);
      resolved.forEach(function(annot) { el.appendChild(_buildCard(annot, view)); });
    }
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

  function focusCard(id) {
    const el = getListEl();
    if (!el) return;
    const card = el.querySelector('.annot-card[data-id="' + id + '"]');
    if (!card) return;
    const ta = card.querySelector('textarea');
    if (ta) ta.focus();
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
  });

  // Resolve / restore: full refresh — section membership changes and card
  // shape differs (textarea vs read-only label).
  document.addEventListener('editor.annotationResolved', function() {
    const v = getView();
    if (v) refresh(v);
  });

  document.addEventListener('editor.annotationRestored', function() {
    const v = getView();
    if (v) refresh(v);
  });

  Rga.AnnotationNotes = { refresh, highlightCard, focusCard, navigateToAnnotation };
})();
