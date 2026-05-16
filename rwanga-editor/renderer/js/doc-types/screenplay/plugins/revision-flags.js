// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const FLAG_COLORS = [
    { value: '#F44747', label: 'Red',    hint: 'Mistake / fix' },
    { value: '#F5A623', label: 'Yellow', hint: 'Revisit' },
    { value: '#4EC9B0', label: 'Green',  hint: 'Love it' },
  ];

  // ---------------------------------------------------------------
  // Transaction helpers
  // ---------------------------------------------------------------

  function _dispatchFlagChanged() {
    document.dispatchEvent(new CustomEvent('editor.flagChanged'));
  }

  function addRevisionFlag(view, payload, from, to) {
    const { schema, selection } = view.state;
    if (from === undefined) from = selection.from;
    if (to === undefined) to = selection.to;
    const mark = schema.marks.revisionFlag.create({
      id: payload.id || crypto.randomUUID(),
      reason: payload.reason || '',
      color:  payload.color  || FLAG_COLORS[0].value,
      createdAt: payload.createdAt || new Date().toISOString(),
      status: 'open',
    });
    view.dispatch(view.state.tr.addMark(from, to, mark));
    _dispatchFlagChanged();
  }

  function updateRevisionFlag(view, from, to, updates) {
    const { doc, schema } = view.state;
    let tr = view.state.tr;
    doc.nodesBetween(from, to, function(node, pos) {
      node.marks.forEach(function(m) {
        if (m.type === schema.marks.revisionFlag) {
          const newMark = m.type.create(Object.assign({}, m.attrs, updates));
          tr = tr.removeMark(pos, pos + node.nodeSize, m.type);
          tr = tr.addMark(pos, pos + node.nodeSize, newMark);
        }
      });
    });
    view.dispatch(tr);
    _dispatchFlagChanged();
  }

  function removeRevisionFlag(view, from, to) {
    const { schema } = view.state;
    view.dispatch(view.state.tr.removeMark(from, to, schema.marks.revisionFlag));
    _dispatchFlagChanged();
  }

  function resolveFlag(view, id) {
    const schema = view.state.schema;
    let flagMark = null;
    let firstPos = null;
    view.state.doc.descendants(function(node, pos) {
      if (firstPos !== null) return false;
      if (node.isText) {
        const m = node.marks.find(function(mk) {
          return mk.type === schema.marks.revisionFlag && mk.attrs.id === id;
        });
        if (m) { flagMark = m; firstPos = pos; }
      }
    });
    if (!flagMark || firstPos === null) return;

    const range = _markRange(view.state.doc, firstPos, schema.marks.revisionFlag);
    const markedText = view.state.doc.textBetween(range.from, range.to, ' ');
    const fc = FLAG_COLORS.find(function(c) { return c.value === flagMark.attrs.color; });

    // Log entry persisted to doc before mark removal so panel refresh sees it
    const activeDoc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
    if (activeDoc && Rga.Doc && Rga.Doc.addFlagLogEntry) {
      Rga.Doc.addFlagLogEntry(activeDoc, {
        id: flagMark.attrs.id,
        flaggedText: markedText,
        color: flagMark.attrs.color,
        hint: fc ? fc.hint : 'Flag',
        reason: flagMark.attrs.reason || '',
        resolvedAt: new Date().toISOString(),
      });
      Rga.Doc.markDirty(activeDoc);
    }

    view.dispatch(view.state.tr.removeMark(range.from, range.to, schema.marks.revisionFlag));
    _dispatchFlagChanged();
    view.focus();
  }

  // Locate the EditorView that currently owns a revisionFlag by id —
  // outer view first, then walks every mounted v2 inner editor. Returns
  // null if the flag has been deleted everywhere.
  function _findViewForFlag(id) {
    const outer = _getView();
    if (outer) {
      const schema = outer.state.schema;
      const flagMark = schema && schema.marks.revisionFlag;
      if (flagMark) {
        let found = false;
        outer.state.doc.descendants(function(node) {
          if (found) return false;
          if (node.isText) {
            if (node.marks.some(function(m) { return m.type === flagMark && m.attrs.id === id; })) {
              found = true;
            }
          }
        });
        if (found) return outer;
      }
    }
    const blocks = document.querySelectorAll('.rga-scene-block');
    for (let i = 0; i < blocks.length; i++) {
      const v = blocks[i]._innerView;
      if (!v) continue;
      const innerFlag = v.state.schema.marks.revisionFlag;
      if (!innerFlag) continue;
      let found = false;
      v.state.doc.descendants(function(node) {
        if (found) return false;
        if (node.isText) {
          if (node.marks.some(function(m) { return m.type === innerFlag && m.attrs.id === id; })) {
            found = true;
          }
        }
      });
      if (found) return v;
    }
    return null;
  }

  function _markRange(doc, pos, markType) {
    let from = pos, to = pos;
    doc.nodesBetween(0, doc.content.size, function(node, nodePos) {
      if (!node.isText) return;
      if (!node.marks.some(function(m) { return m.type === markType; })) return;
      const start = nodePos, end = nodePos + node.nodeSize;
      if (start <= pos && end >= pos) {
        from = Math.min(from, start);
        to = Math.max(to, end);
      }
    });
    return { from, to };
  }

  // ---------------------------------------------------------------
  // Editor popup — color-coded (red / yellow / green) + reason
  // ---------------------------------------------------------------

  let _popup = null;
  let _flagRange = null;

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
    // Capture before textarea.focus() moves browser selection out of the editor
    const capturedFrom = selection.from;
    const capturedTo = selection.to;

    const popup = document.createElement('div');
    popup.className = 'rga-revision-popup';

    // Title
    const title = document.createElement('div');
    title.className = 'rga-popup-label';
    title.textContent = existingMark ? 'Edit flag' : 'Flag for revision';
    popup.appendChild(title);

    // Color swatches (red / yellow / green)
    const swatchRow = document.createElement('div');
    swatchRow.className = 'rga-flag-swatches';
    let selectedColor = (existingMark && existingMark.attrs.color) || FLAG_COLORS[0].value;

    FLAG_COLORS.forEach(function(fc) {
      const btn = document.createElement('button');
      btn.className = 'rga-flag-swatch' + (fc.value === selectedColor ? ' active' : '');
      btn.style.background = fc.value;
      btn.title = fc.label + ' — ' + fc.hint;

      const dot = document.createElement('span');
      dot.className = 'rga-flag-swatch-dot';

      const lbl = document.createElement('span');
      lbl.className = 'rga-flag-swatch-label';
      lbl.textContent = fc.label;

      const hint = document.createElement('span');
      hint.className = 'rga-flag-swatch-hint';
      hint.textContent = fc.hint;

      btn.appendChild(dot);
      btn.appendChild(lbl);
      btn.appendChild(hint);

      btn.addEventListener('click', function() {
        selectedColor = fc.value;
        swatchRow.querySelectorAll('.rga-flag-swatch').forEach(function(s) {
          s.classList.remove('active');
        });
        btn.classList.add('active');
      });
      swatchRow.appendChild(btn);
    });
    popup.appendChild(swatchRow);

    // Reason textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'rga-popup-textarea';
    textarea.placeholder = 'Short reason (optional)…';
    textarea.rows = 2;
    if (existingMark) textarea.value = existingMark.attrs.reason || '';
    popup.appendChild(textarea);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'rga-popup-btns';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'rga-popup-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function() { closePopup(); view.focus(); });

    const saveBtn = document.createElement('button');
    saveBtn.className = 'rga-popup-btn primary';
    saveBtn.textContent = existingMark ? 'Update' : 'Save';
    saveBtn.addEventListener('click', function() {
      const updates = { reason: textarea.value, color: selectedColor };
      if (existingMark && range) {
        updateRevisionFlag(view, range.from, range.to, updates);
      } else {
        addRevisionFlag(view, updates, capturedFrom, capturedTo);
      }
      closePopup();
      if (Rga.BottomPanel) Rga.BottomPanel.switchTo('flags');
      view.focus();
    });

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

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    popup.appendChild(btnRow);
    document.body.appendChild(popup);
    _popup = popup;

    const pos = range ? range.from : selection.from;
    const coords = view.coordsAtPos(pos);
    const x = Math.min(coords.left, window.innerWidth - 260);
    const y = Math.min(coords.bottom + 6, window.innerHeight - 220);
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
  // Small info popup on click
  // ---------------------------------------------------------------

  let _infoPopup = null;

  function hideInfoPopup() {
    if (_infoPopup && _infoPopup.parentNode) _infoPopup.parentNode.removeChild(_infoPopup);
    _infoPopup = null;
  }

  function showFlagInfo(view, mark, pos, range) {
    hideInfoPopup();

    const popup = document.createElement('div');
    popup.className = 'rga-mark-info-popup';

    const dot = document.createElement('span');
    dot.className = 'rga-info-dot';
    dot.style.background = mark.attrs.color;
    popup.appendChild(dot);

    const label = document.createElement('span');
    label.className = 'rga-info-label';
    const fc = FLAG_COLORS.find(function(f) { return f.value === mark.attrs.color; });
    const colorLabel = fc ? fc.hint : 'Flag';
    label.textContent = mark.attrs.reason ? colorLabel + ': ' + mark.attrs.reason : colorLabel;
    popup.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'rga-info-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'rga-info-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function() {
      hideInfoPopup();
      showRevisionEditor(view, mark, range);
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'rga-info-btn danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', function() {
      hideInfoPopup();
      if (range) removeRevisionFlag(view, range.from, range.to);
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
  // Flags panel refresh
  // ---------------------------------------------------------------

  function refreshFlagsPanel(view) {
    const container = document.getElementById('revision-flags-list');
    if (!container) return;

    const schema = view.state.schema;
    container.innerHTML = '';

    // ---- Open flags ----
    const openFlags = [];
    const seenIds = new Set();

    // 1. Outer-doc revisionFlag marks.
    if (schema && schema.marks.revisionFlag) {
      view.state.doc.descendants(function(node, pos) {
        if (!node.isText) return;
        const flagMark = node.marks.find(function(m) { return m.type === schema.marks.revisionFlag; });
        if (!flagMark) return;
        const id = flagMark.attrs.id;
        const range = _markRange(view.state.doc, pos, schema.marks.revisionFlag);
        const rangeKey = id || (range.from + ':' + range.to);
        if (seenIds.has(rangeKey)) return;
        seenIds.add(rangeKey);
        openFlags.push({
          id: id,
          mark: flagMark,
          markedText: view.state.doc.textBetween(range.from, range.to, ' ')
        });
      });
    }

    // 2. Inner-doc revisionFlag marks — walk every sceneFrame's attrs.
    //    innerDoc JSON so flags created inside scenes appear on file open
    //    as well as runtime via events.
    view.state.doc.descendants(function(node) {
      if (!node.type || node.type.name !== 'sceneFrame') return;
      const innerDoc = node.attrs && node.attrs.innerDoc;
      if (!innerDoc || !Array.isArray(innerDoc.content)) return;
      innerDoc.content.forEach(function(block) {
        if (!block || !Array.isArray(block.content)) return;
        block.content.forEach(function(textNode) {
          if (!textNode || textNode.type !== 'text' || !Array.isArray(textNode.marks)) return;
          textNode.marks.forEach(function(m) {
            if (!m || m.type !== 'revisionFlag' || !m.attrs) return;
            const id = m.attrs.id;
            if (!id || seenIds.has(id)) return;
            seenIds.add(id);
            openFlags.push({
              id: id,
              mark: { attrs: m.attrs },  // shape-compatible with PM mark for _buildFlagCard
              markedText: textNode.text || ''
            });
          });
        });
      });
    });

    if (!openFlags.length) {
      container.innerHTML = '<div class="flags-empty">No open flags — select text and right-click to flag.</div>';
    } else {
      openFlags.forEach(function(f) {
        container.appendChild(_buildFlagCard(f, view));
      });
    }

    // ---- Resolved log ----
    const activeDoc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
    const flagLog = (activeDoc && activeDoc.flagLog) || [];
    if (!flagLog.length) return;

    const divider = document.createElement('div');
    divider.className = 'flags-log-divider';
    divider.textContent = 'Resolved (' + flagLog.length + ')';
    container.appendChild(divider);

    flagLog.slice().reverse().forEach(function(entry) {
      const row = document.createElement('div');
      row.className = 'flag-card flag-card-resolved';
      row.style.borderLeftColor = entry.color;

      const dot = document.createElement('span');
      dot.className = 'rga-info-dot';
      dot.style.background = entry.color;
      dot.style.opacity = '0.4';
      row.appendChild(dot);

      const textCol = document.createElement('div');
      textCol.className = 'flag-card-text';

      if (entry.flaggedText) {
        const preview = document.createElement('div');
        preview.className = 'flag-card-preview';
        preview.textContent = entry.flaggedText.slice(0, 60) + (entry.flaggedText.length > 60 ? '…' : '');
        textCol.appendChild(preview);
      }

      const label = document.createElement('div');
      label.className = 'flag-card-label';
      label.textContent = entry.hint + (entry.reason ? ': ' + entry.reason : '');
      textCol.appendChild(label);

      const ts = document.createElement('div');
      ts.className = 'flag-card-ts';
      ts.textContent = '✓ ' + new Date(entry.resolvedAt).toLocaleString();
      textCol.appendChild(ts);

      row.appendChild(textCol);
      container.appendChild(row);
    });
  }

  function _buildFlagCard(f, view) {
    const fc = FLAG_COLORS.find(function(c) { return c.value === f.mark.attrs.color; });
    const row = document.createElement('div');
    row.className = 'flag-card';
    row.style.borderLeftColor = f.mark.attrs.color;

    const dot = document.createElement('span');
    dot.className = 'rga-info-dot';
    dot.style.background = f.mark.attrs.color;
    row.appendChild(dot);

    const textCol = document.createElement('div');
    textCol.className = 'flag-card-text';

    if (f.markedText) {
      const preview = document.createElement('div');
      preview.className = 'flag-card-preview';
      preview.textContent = f.markedText.slice(0, 60) + (f.markedText.length > 60 ? '…' : '');
      textCol.appendChild(preview);
    }

    const label = document.createElement('div');
    label.className = 'flag-card-label';
    label.textContent = (fc ? fc.hint : 'Flag') + (f.mark.attrs.reason ? ': ' + f.mark.attrs.reason : '');
    textCol.appendChild(label);

    row.appendChild(textCol);

    if (f.id) {
      const resolveBtn = document.createElement('button');
      resolveBtn.className = 'flag-resolve-btn';
      resolveBtn.title = 'Accept — marks resolved, keeps the entry in the log below';
      resolveBtn.textContent = '✓';
      resolveBtn.addEventListener('click', function() {
        const liveView = _findViewForFlag(f.id) || view;
        resolveFlag(liveView, f.id);
      });
      row.appendChild(resolveBtn);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'flag-remove-btn';
      removeBtn.title = 'Remove flag entirely — does not appear in the log';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', function() {
        const liveView = _findViewForFlag(f.id) || view;
        const flagMark = liveView.state.schema.marks.revisionFlag;
        const range = _markRange(liveView.state.doc, _firstFlagPos(liveView, f.id), flagMark);
        if (range) removeRevisionFlag(liveView, range.from, range.to);
      });
      row.appendChild(removeBtn);
    }

    return row;
  }

  function _firstFlagPos(view, id) {
    const schema = view.state.schema;
    let pos = 0;
    view.state.doc.descendants(function(node, nodePos) {
      if (pos) return false;
      if (node.isText && node.marks.some(function(m) {
        return m.type === schema.marks.revisionFlag && m.attrs.id === id;
      })) {
        pos = nodePos;
        return false;
      }
    });
    return pos;
  }

  function _getView() {
    return Rga.TabManager && Rga.TabManager._editorView && Rga.TabManager._editorView();
  }

  document.addEventListener('editor.tabActivated', function() {
    const view = _getView();
    if (view) refreshFlagsPanel(view);
  });

  document.addEventListener('editor.flagChanged', function() {
    const view = _getView();
    if (view) refreshFlagsPanel(view);
  });

  // ---------------------------------------------------------------
  // ProseMirror plugin
  // ---------------------------------------------------------------

  function revisionFlagsPlugin() {
    const PM = window.RgaProseMirror;
    return new PM.Plugin({
      props: {
        handleClickOn: function(view, pos) {
          const schema = view.state.schema;
          if (!schema.marks.revisionFlag) return false;
          const $pos = view.state.doc.resolve(pos);
          const flagMark = $pos.marks().find(function(m) {
            return m.type === schema.marks.revisionFlag;
          });
          if (!flagMark) return false;
          const range = _markRange(view.state.doc, pos, schema.marks.revisionFlag);
          showFlagInfo(view, flagMark, pos, range);
          return true;
        }
      }
    });
  }

  Rga.RevisionFlags = {
    addRevisionFlag,
    updateRevisionFlag,
    removeRevisionFlag,
    resolveFlag,
    showRevisionEditor,
    hideInfoPopup,
    revisionFlagsPlugin,
    refreshFlagsPanel,
    FLAG_COLORS,
  };

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.revisionFlagsPlugin = revisionFlagsPlugin;
})();
