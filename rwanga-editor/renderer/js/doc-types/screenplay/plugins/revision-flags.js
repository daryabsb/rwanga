// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // ---------------------------------------------------------------
  // Transaction helpers
  // ---------------------------------------------------------------

  function addRevisionFlag(view, payload) {
    const { schema, selection } = view.state;
    const { from, to } = selection;
    const mark = schema.marks.revisionFlag.create({
      reason: payload.reason || '',
      createdAt: payload.createdAt || new Date().toISOString(),
      status: payload.status || 'open',
    });
    view.dispatch(view.state.tr.addMark(from, to, mark));
  }

  function updateRevisionFlag(view, fromPos, toPos, updates) {
    const { doc, schema } = view.state;
    let tr = view.state.tr;
    // Find the exact mark in the range and update it
    doc.nodesBetween(fromPos, toPos, function(node, pos) {
      node.marks.forEach(function(m) {
        if (m.type === schema.marks.revisionFlag) {
          const newMark = m.type.create(Object.assign({}, m.attrs, updates));
          tr = tr.removeMark(pos, pos + node.nodeSize, m.type);
          tr = tr.addMark(pos, pos + node.nodeSize, newMark);
        }
      });
    });
    view.dispatch(tr);
  }

  function removeRevisionFlag(view, fromPos, toPos) {
    const { schema } = view.state;
    view.dispatch(view.state.tr.removeMark(fromPos, toPos, schema.marks.revisionFlag));
  }

  // ---------------------------------------------------------------
  // Popup UI
  // ---------------------------------------------------------------

  let _popup = null;
  let _flagRange = null; // { from, to } of the clicked flag

  function closePopup() {
    if (_popup && _popup.parentNode) _popup.parentNode.removeChild(_popup);
    _popup = null;
    _flagRange = null;
  }

  function showRevisionEditor(view, existingMark, range) {
    closePopup();
    if (Rga.ContextMenu) Rga.ContextMenu.hide();

    const { selection } = view.state;
    if (selection.empty && !existingMark) return;

    const popup = document.createElement('div');
    popup.className = 'rga-revision-popup';

    // Reason textarea
    const reasonLabel = document.createElement('div');
    reasonLabel.className = 'rga-popup-label';
    reasonLabel.textContent = 'Revision note';
    popup.appendChild(reasonLabel);

    const textarea = document.createElement('textarea');
    textarea.className = 'rga-popup-textarea';
    textarea.placeholder = 'Reason for revision…';
    textarea.rows = 3;
    if (existingMark) textarea.value = existingMark.attrs.reason || '';
    popup.appendChild(textarea);

    // Status radio row
    const statusRow = document.createElement('div');
    statusRow.className = 'rga-popup-radio-row';

    ['open', 'resolved'].forEach(function(status) {
      const lbl = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'revision-status-' + Date.now();
      radio.value = status;
      if (existingMark ? existingMark.attrs.status === status : status === 'open') {
        radio.checked = true;
      }
      lbl.appendChild(radio);
      lbl.appendChild(document.createTextNode(' ' + capitalize(status)));
      statusRow.appendChild(lbl);
    });
    popup.appendChild(statusRow);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'rga-popup-btns';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'rga-popup-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function() {
      closePopup();
      view.focus();
    });

    const saveBtn = document.createElement('button');
    saveBtn.className = 'rga-popup-btn primary';
    saveBtn.textContent = existingMark ? 'Update' : 'Save';

    if (existingMark && range) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'rga-popup-btn danger';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', function() {
        removeRevisionFlag(view, range.from, range.to);
        closePopup();
        view.focus();
      });
      btnRow.appendChild(removeBtn);
    }

    saveBtn.addEventListener('click', function() {
      const checkedRadio = statusRow.querySelector('input[type=radio]:checked');
      const status = checkedRadio ? checkedRadio.value : 'open';
      const updates = { reason: textarea.value, status };

      if (existingMark && range) {
        updateRevisionFlag(view, range.from, range.to, updates);
      } else {
        addRevisionFlag(view, updates);
      }
      closePopup();
      view.focus();
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    popup.appendChild(btnRow);
    document.body.appendChild(popup);
    _popup = popup;

    // Position near selection
    const pos = range ? range.from : selection.from;
    const coords = view.coordsAtPos(pos);
    const x = Math.min(coords.left, window.innerWidth - 260);
    const y = Math.min(coords.bottom + 6, window.innerHeight - 200);
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';

    textarea.focus();

    setTimeout(function() {
      function onOutside(e) {
        if (_popup && !_popup.contains(e.target)) closePopup();
      }
      document.addEventListener('mousedown', onOutside, true);
    }, 0);
  }

  // ---------------------------------------------------------------
  // ProseMirror plugin — click flagged text to re-open editor
  // ---------------------------------------------------------------

  function revisionFlagsPlugin() {
    const PM = window.RgaProseMirror;
    return new PM.Plugin({
      props: {
        handleClickOn: function(view, pos, node, nodePos, event) {
          const schema = view.state.schema;
          if (!schema.marks.revisionFlag) return false;

          const $pos = view.state.doc.resolve(pos);
          const marks = $pos.marks();
          const flagMark = marks.find(function(m) {
            return m.type === schema.marks.revisionFlag;
          });
          if (!flagMark) return false;

          // Find the extent of this mark around the click position
          const range = _markRange(view.state.doc, pos, schema.marks.revisionFlag);
          showRevisionEditor(view, flagMark, range);
          return true;
        }
      }
    });
  }

  // Walk outward from pos to find the full extent of a mark
  function _markRange(doc, pos, markType) {
    let from = pos;
    let to = pos;
    doc.nodesBetween(0, doc.content.size, function(node, nodePos) {
      if (!node.isText) return;
      const hasMark = node.marks.some(function(m) { return m.type === markType; });
      if (!hasMark) return;
      const start = nodePos;
      const end = nodePos + node.nodeSize;
      if (start <= pos && end >= pos) {
        from = Math.min(from, start);
        to = Math.max(to, end);
      }
    });
    return { from, to };
  }

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
  }

  Rga.RevisionFlags = {
    addRevisionFlag,
    updateRevisionFlag,
    removeRevisionFlag,
    showRevisionEditor,
    closePopup,
    revisionFlagsPlugin,
  };

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.revisionFlagsPlugin = revisionFlagsPlugin;
})();
