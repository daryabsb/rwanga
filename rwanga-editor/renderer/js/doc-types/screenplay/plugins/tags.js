// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const TAG_TYPES = [
    'character', 'prop', 'wardrobe', 'location',
    'sfx', 'vfx', 'vehicle', 'animal', 'custom',
  ];

  // ---------------------------------------------------------------
  // Transaction helpers
  // ---------------------------------------------------------------

  function applyTag(view, tagType, entityId) {
    const { schema, selection } = view.state;
    const { from, to } = selection;
    const mark = schema.marks.tag.create({ tagType, entityId });
    view.dispatch(view.state.tr.addMark(from, to, mark));
  }

  function removeTag(view, tagType, entityId) {
    const { doc, schema } = view.state;
    let tr = view.state.tr;
    doc.descendants(function(node, pos) {
      node.marks.forEach(function(m) {
        if (m.type === schema.marks.tag
            && m.attrs.tagType === tagType
            && m.attrs.entityId === entityId) {
          tr = tr.removeMark(pos, pos + node.nodeSize, m);
        }
      });
    });
    view.dispatch(tr);
  }

  // Remove all tag marks pointing to a given entityId (any type)
  function removeAllMarksForEntity(view, entityId) {
    const { doc, schema } = view.state;
    let tr = view.state.tr;
    doc.descendants(function(node, pos) {
      node.marks.forEach(function(m) {
        if (m.type === schema.marks.tag && m.attrs.entityId === entityId) {
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

  function showTagDialog(view, tagType) {
    closePopup();
    if (Rga.ContextMenu) Rga.ContextMenu.hide();

    const { selection } = view.state;
    if (selection.empty) return;

    // Get existing entities for this type from current doc
    const activeTab = Rga.TabManager && Rga.TabManager.activeTab && Rga.TabManager.activeTab();
    const doc = activeTab && activeTab.doc;
    const keyMap = Rga.Doc && Rga.Doc._registryKey;
    const registryKey = keyMap ? (keyMap[tagType] || tagType) : tagType;
    const existingEntities = (doc && doc.tagRegistry && doc.tagRegistry[registryKey]) || [];

    const popup = document.createElement('div');
    popup.className = 'rga-tag-popup';

    // Header label
    const label = document.createElement('div');
    label.className = 'rga-popup-label';
    label.textContent = 'Tag as ' + capitalize(tagType);
    popup.appendChild(label);

    // Entity select
    const select = document.createElement('select');
    select.className = 'rga-popup-select';

    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ New entity';
    select.appendChild(newOpt);

    existingEntities.forEach(function(entity) {
      const opt = document.createElement('option');
      opt.value = entity.id;
      opt.textContent = entity.name;
      select.appendChild(opt);
    });
    popup.appendChild(select);

    // New entity name input (shown when "+ New entity" selected)
    const newNameInput = document.createElement('input');
    newNameInput.className = 'rga-popup-input';
    newNameInput.placeholder = 'Entity name…';
    newNameInput.type = 'text';
    popup.appendChild(newNameInput);

    function updateVisibility() {
      newNameInput.style.display = select.value === '__new__' ? '' : 'none';
    }
    updateVisibility();
    select.addEventListener('change', updateVisibility);

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

    const applyBtn = document.createElement('button');
    applyBtn.className = 'rga-popup-btn primary';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', function() {
      let entityId;
      if (select.value === '__new__') {
        const name = newNameInput.value.trim();
        if (!name) { newNameInput.focus(); return; }
        entityId = crypto.randomUUID();
        if (doc && Rga.Doc && Rga.Doc.addEntity) {
          Rga.Doc.addEntity(doc, tagType, { id: entityId, name, color: null, notes: '' });
        }
      } else {
        entityId = select.value;
      }
      applyTag(view, tagType, entityId);
      closePopup();
      view.focus();
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(applyBtn);
    popup.appendChild(btnRow);
    document.body.appendChild(popup);
    _popup = popup;

    // Position near selection
    const coords = view.coordsAtPos(selection.from);
    const x = Math.min(coords.left, window.innerWidth - 260);
    const y = Math.min(coords.bottom + 6, window.innerHeight - 180);
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';

    newNameInput.focus();

    // Dismiss on outside click
    setTimeout(function() {
      function onOutside(e) {
        if (_popup && !_popup.contains(e.target)) closePopup();
      }
      document.addEventListener('mousedown', onOutside, true);
    }, 0);
  }

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
  }

  // ---------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------

  Rga.Tags = {
    applyTag,
    removeTag,
    removeAllMarksForEntity,
    showTagDialog,
    TAG_TYPES,
  };
})();
