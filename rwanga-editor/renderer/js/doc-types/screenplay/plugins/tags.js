// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const TAG_TYPES = [
    'character', 'prop', 'wardrobe', 'location',
    'sfx', 'vfx', 'vehicle', 'animal', 'custom',
  ];

  const TAG_LABELS = {
    character: 'Character', prop: 'Prop', wardrobe: 'Wardrobe',
    location: 'Location', sfx: 'SFX', vfx: 'VFX',
    vehicle: 'Vehicle', animal: 'Animal', custom: 'Custom',
  };

  // ---------------------------------------------------------------
  // Transaction helpers
  // ---------------------------------------------------------------

  function applyTag(view, tagType, entityId) {
    const { schema, selection } = view.state;
    const { from, to } = selection;
    const mark = schema.marks.tag.create({ tagType, entityId });
    view.dispatch(view.state.tr.addMark(from, to, mark));
    document.dispatchEvent(new CustomEvent('editor.tagApplied', { detail: { tagType, entityId } }));
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
    document.dispatchEvent(new CustomEvent('editor.tagRemoved', { detail: { tagType, entityId } }));
  }

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
  // Tags panel refresh
  // ---------------------------------------------------------------

  function refreshTagsPanel(doc) {
    const container = document.getElementById('tag-groups-container');
    if (!container) return;
    if (!doc || !doc.tagRegistry) { container.innerHTML = ''; return; }

    container.innerHTML = '';
    const reg = doc.tagRegistry;

    TAG_TYPES.forEach(function(type) {
      const keyMap = Rga.Doc && Rga.Doc._registryKey;
      const key = keyMap ? (keyMap[type] || type) : type;
      const entities = reg[key] || [];
      if (!entities.length) return;

      const group = document.createElement('div');
      group.className = 'tag-group';

      const header = document.createElement('div');
      header.className = 'tag-group-header';
      header.textContent = TAG_LABELS[type] || capitalize(type);
      group.appendChild(header);

      entities.forEach(function(entity) {
        const row = document.createElement('div');
        row.className = 'tag-entity-row';

        const dot = document.createElement('span');
        dot.className = 'tag-entity-dot';
        dot.style.background = entity.color || 'var(--accent-primary)';
        row.appendChild(dot);

        const name = document.createElement('span');
        name.className = 'tag-entity-name';
        name.textContent = entity.name;
        row.appendChild(name);

        group.appendChild(row);
      });

      container.appendChild(group);
    });
  }

  // Listen for tag events and refresh the panel
  document.addEventListener('editor.tagApplied', function() {
    const activeTab = Rga.TabManager && Rga.TabManager.activeTab && Rga.TabManager.activeTab();
    if (activeTab && activeTab.doc) refreshTagsPanel(activeTab.doc);
  });
  document.addEventListener('editor.tagRemoved', function() {
    const activeTab = Rga.TabManager && Rga.TabManager.activeTab && Rga.TabManager.activeTab();
    if (activeTab && activeTab.doc) refreshTagsPanel(activeTab.doc);
  });

  // ---------------------------------------------------------------
  // Apply tag from context menu
  // Uses the selected text as the entity name:
  //   - exact case-insensitive match in registry → reuse that entity
  //   - no match → create a new entity named after the selected text
  // No dialog shown — the selection IS the entity identifier.
  // ---------------------------------------------------------------

  function _entityList(doc, tagType) {
    const keyMap = Rga.Doc && Rga.Doc._registryKey;
    const key = keyMap ? (keyMap[tagType] || tagType) : tagType;
    return (doc && doc.tagRegistry && doc.tagRegistry[key]) || [];
  }

  // Registry Integrity Slice A — THE single reuse-before-create path.
  // Every tagging surface (toolbar dropdown, context-menu/Ctrl+Shift+T
  // dialog, future recognizers) must acquire entity ids through this
  // function so the lookup logic can never diverge between paths again.
  //
  //   - exact case-insensitive name match within the tagType's registry
  //     list → reuse that entity's id (curation: color/notes survive)
  //   - no match → register one new entity via Rga.Doc.addEntity
  //   - identity is type-scoped: Character:NALI ≠ Prop:NALI
  //
  // Returns the entityId, or null when name is empty.
  function findOrCreateEntity(doc, tagType, name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;

    const existing = _entityList(doc, tagType).find(function(e) {
      return String(e.name || '').toLowerCase() === trimmed.toLowerCase();
    });
    if (existing) return existing.id;

    const entityId = crypto.randomUUID();
    if (doc && Rga.Doc && Rga.Doc.addEntity) {
      Rga.Doc.addEntity(doc, tagType, { id: entityId, name: trimmed, color: null, notes: '' });
    }
    return entityId;
  }

  function showTagDialog(view, tagType) {
    if (Rga.ContextMenu) Rga.ContextMenu.hide();

    const { selection } = view.state;
    if (selection.empty) return;

    const selectedText = view.state.doc.textBetween(selection.from, selection.to, ' ').trim();
    if (!selectedText) return;

    const activeTab = Rga.TabManager && Rga.TabManager.activeTab && Rga.TabManager.activeTab();
    const doc = activeTab && activeTab.doc;

    const entityId = findOrCreateEntity(doc, tagType, selectedText);
    if (!entityId) return;

    applyTag(view, tagType, entityId);
    view.focus();
  }

  // ---------------------------------------------------------------
  // Small info popup on click of tagged text
  // ---------------------------------------------------------------

  let _infoPopup = null;

  function hideInfoPopup() {
    if (_infoPopup && _infoPopup.parentNode) _infoPopup.parentNode.removeChild(_infoPopup);
    _infoPopup = null;
  }

  function showTagInfo(view, mark, pos) {
    hideInfoPopup();

    // Look up entity name from registry
    const activeTab = Rga.TabManager && Rga.TabManager.activeTab && Rga.TabManager.activeTab();
    const doc = activeTab && activeTab.doc;
    let entityName = mark.attrs.entityId;
    if (doc && Rga.Doc && Rga.Doc.findEntity) {
      const ent = Rga.Doc.findEntity(doc, mark.attrs.tagType, mark.attrs.entityId);
      if (ent) entityName = ent.name;
    }

    const popup = document.createElement('div');
    popup.className = 'rga-mark-info-popup';

    const typeClass = 'rga-info-dot rga-tag-dot-' + mark.attrs.tagType;
    const dot = document.createElement('span');
    dot.className = typeClass;
    popup.appendChild(dot);

    const label = document.createElement('span');
    label.className = 'rga-info-label';
    label.textContent = (TAG_LABELS[mark.attrs.tagType] || capitalize(mark.attrs.tagType)) + ': ' + entityName;
    popup.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'rga-info-actions';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'rga-info-btn';
    viewBtn.textContent = 'View Tags';
    viewBtn.addEventListener('click', function() {
      hideInfoPopup();
      if (Rga.Sidebar) Rga.Sidebar.switchTo('tags');
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'rga-info-btn danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', function() {
      hideInfoPopup();
      removeTag(view, mark.attrs.tagType, mark.attrs.entityId);
      view.focus();
    });

    actions.appendChild(viewBtn);
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

  function tagsPlugin() {
    const PM = window.RgaProseMirror;
    return new PM.Plugin({
      props: {
        handleClickOn: function(view, pos) {
          const schema = view.state.schema;
          if (!schema.marks.tag) return false;
          const $pos = view.state.doc.resolve(pos);
          const tagMark = $pos.marks().find(function(m) {
            return m.type === schema.marks.tag;
          });
          if (!tagMark) return false;
          showTagInfo(view, tagMark, pos);
          return true;
        }
      }
    });
  }

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
  }

  Rga.Tags = {
    applyTag,
    removeTag,
    removeAllMarksForEntity,
    findOrCreateEntity,
    showTagDialog,
    refreshTagsPanel,
    tagsPlugin,
    TAG_TYPES,
    TAG_LABELS,
  };

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.tagsPlugin = tagsPlugin;
})();
