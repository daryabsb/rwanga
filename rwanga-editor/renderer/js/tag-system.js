/* ============================================================
   RWANGA SCRIPT EDITOR — tag-system.js
   Tag type definitions, tag registry, right-click "Tag As"
   context menu, inline highlight wrapping, tag manager sidebar,
   custom tag creation, tag removal.
   Depends on: utils.js, icons.js
   ============================================================ */

window.Rga = window.Rga || {};

/* ============================================================
   TAG TYPE DEFINITIONS
   ============================================================ */
Rga.TAG_TYPES = {
  character:  { label: 'Character',  varName: 'character' },
  prop:       { label: 'Prop',       varName: 'prop' },
  wardrobe:   { label: 'Wardrobe',   varName: 'wardrobe' },
  location:   { label: 'Location',   varName: 'location' },
  sfx:        { label: 'SFX',        varName: 'sfx' },
  vfx:        { label: 'VFX',        varName: 'vfx' },
  vehicle:    { label: 'Vehicle',    varName: 'vehicle' },
  animal:     { label: 'Animal',     varName: 'animal' },
  makeup:     { label: 'Makeup',     varName: 'makeup' },
  music:      { label: 'Music',      varName: 'music' }
};

/* ============================================================
   TAG SYSTEM
   ============================================================ */
Rga.TagSystem = {
  /**
   * Registry: tagId → { id, name, type, customColor, notes, occurrences: Set<elementId> }
   * @type {Map<string, object>}
   */
  registry: new Map(),

  /**
   * Custom tag types added by the user.
   * @type {Map<string, { label: string, color: string }>}
   */
  customTypes: new Map(),

  init: function() {
    this._bindEditorContextMenu();
  },

  /* ============================================================
     CONTEXT MENU — right-click in editor
     ============================================================ */

  _bindEditorContextMenu: function() {
    var editor = Rga.$('#editor');
    if (!editor) return;

    var self = this;
    editor.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      self._showContextMenu(e);
    });
  },

  _showContextMenu: function(e) {
    var sel = window.getSelection();
    var hasSelection = sel && !sel.isCollapsed;
    var selectedText = hasSelection ? sel.toString().trim() : '';
    var clickedTag = e.target.closest('.tag-highlight');
    var block = Rga.Cursor.getCurrentBlock();

    var items = [];
    var self = this;

    // === Selection-based items ===
    if (hasSelection && selectedText) {
      items.push({
        label: 'Tag "' + Rga.truncate(selectedText, 20) + '" as\u2026',
        submenu: self._buildTagTypeSubmenu(selectedText)
      });
      items.push({ separator: true });
    }

    // === Clicked on an existing tag ===
    if (clickedTag) {
      var tagId = clickedTag.dataset.tagId;
      var tagEntity = self.registry.get(tagId);
      var tagLabel = tagEntity ? tagEntity.name : 'Tag';

      items.push(
        { label: 'View "' + Rga.truncate(tagLabel, 16) + '" Details', action: function() {
          self._showInInspector(tagId);
        }},
        { label: 'Remove Tag', action: function() {
          self.removeTagHighlight(clickedTag);
        }},
        { label: 'Change Tag Type\u2026', submenu: self._buildChangeTypeSubmenu(tagId, clickedTag) },
        { label: 'Rename\u2026', action: function() {
          self._renameTag(tagId);
        }}
      );
      items.push({ separator: true });
    }

    // === Block type change ===
    if (block && block.dataset.blockType !== 'scene-header') {
      items.push({
        label: 'Change Block Type',
        submenu: Rga.BLOCK_TYPES
          .filter(function(t) { return t !== 'scene-header'; })
          .map(function(type) {
            return {
              label: Rga.formatBlockTypeName(type),
              action: function() { Rga.Editor.setBlockType(block, type); }
            };
          })
      });
      items.push({ separator: true });
    }

    // === Standard edit actions ===
    items.push(
      { label: 'Cut',   shortcut: 'Ctrl+X', action: function() { document.execCommand('cut'); } },
      { label: 'Copy',  shortcut: 'Ctrl+C', action: function() { document.execCommand('copy'); } },
      { label: 'Paste', shortcut: 'Ctrl+V', action: function() { document.execCommand('paste'); } }
    );

    Rga.ContextMenu.show(items, e.clientX, e.clientY);
  },

  /**
   * Build the "Tag As → [Character, Prop, ...]" submenu.
   */
  _buildTagTypeSubmenu: function(selectedText) {
    var self = this;
    var items = [];

    // Built-in types
    Object.keys(Rga.TAG_TYPES).forEach(function(type) {
      var info = Rga.TAG_TYPES[type];
      items.push({
        label: info.label,
        icon: self._createTypeDot(type),
        action: function() { self.tagSelection(type, selectedText); }
      });
    });

    // Custom types
    self.customTypes.forEach(function(typeInfo, typeKey) {
      items.push({
        label: typeInfo.label,
        icon: self._createCustomDot(typeInfo.color),
        action: function() { self.tagSelection(typeKey, selectedText); }
      });
    });

    // Separator + "Custom Tag..."
    items.push({ separator: true });
    items.push({
      label: 'Custom Tag\u2026',
      action: function() { self._showCustomTagDialog(selectedText); }
    });

    return items;
  },

  _buildChangeTypeSubmenu: function(tagId, highlightEl) {
    var self = this;
    return Object.keys(Rga.TAG_TYPES).map(function(type) {
      var info = Rga.TAG_TYPES[type];
      return {
        label: info.label,
        icon: self._createTypeDot(type),
        action: function() {
          self._changeTagType(tagId, highlightEl, type);
        }
      };
    });
  },

  /* ============================================================
     TAGGING — apply a tag to the current selection
     ============================================================ */

  /**
   * Tag the current text selection.
   * @param {string} tagType - e.g. 'character', 'prop'
   * @param {string} text - the selected text
   */
  tagSelection: function(tagType, text) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    var range = sel.getRangeAt(0);

    // Find or create the tag entity
    var entity = this._findByNameAndType(text, tagType);
    if (!entity) {
      entity = this._createEntity(text, tagType);
    }

    // Wrap selection in highlight span
    var span = document.createElement('span');
    span.className = 'tag-highlight';
    span.dataset.tagId = entity.id;
    span.dataset.tagType = tagType;
    span.title = Rga.TAG_TYPES[tagType]
      ? Rga.TAG_TYPES[tagType].label + ': ' + entity.name
      : tagType + ': ' + entity.name;

    try {
      range.surroundContents(span);
    } catch (err) {
      // surroundContents fails if selection crosses element boundaries
      // Fallback: extract, wrap, re-insert
      var fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }

    // Track occurrence
    var block = span.closest('.editor-block');
    if (block && block.dataset.id) {
      entity.occurrences.add(block.dataset.id);
    }

    // Clear selection
    sel.removeAllRanges();

    // Update sidebar & mark dirty
    this.updateManagerPanel();
    if (Rga.Tabs && Rga.Tabs.activeTabId) {
      Rga.Tabs.setDirty(Rga.Tabs.activeTabId, true);
    }

    // Toast confirmation
    var typeLabel = Rga.TAG_TYPES[tagType] ? Rga.TAG_TYPES[tagType].label : tagType;
    Rga.Toast.show('Tagged "' + Rga.truncate(text, 16) + '" as ' + typeLabel, 'success', 2000);
  },

  /* ============================================================
     TAG REMOVAL
     ============================================================ */

  /**
   * Remove a tag highlight, unwrapping the text.
   * @param {HTMLElement} highlightEl - the .tag-highlight span
   */
  removeTagHighlight: function(highlightEl) {
    var tagId = highlightEl.dataset.tagId;

    // Unwrap: replace the span with its text content
    var parent = highlightEl.parentNode;
    while (highlightEl.firstChild) {
      parent.insertBefore(highlightEl.firstChild, highlightEl);
    }
    parent.removeChild(highlightEl);

    // If no more occurrences of this tag, optionally keep entity in registry
    // (user may want to re-tag later)
    this._recountOccurrences(tagId);
    this.updateManagerPanel();
  },

  /* ============================================================
     TAG ENTITY MANAGEMENT
     ============================================================ */

  _createEntity: function(name, type) {
    var id = Rga.generateId('tag');
    var entity = {
      id: id,
      name: name.trim(),
      type: type,
      customColor: null,
      notes: '',
      occurrences: new Set()
    };
    this.registry.set(id, entity);
    return entity;
  },

  _findByNameAndType: function(name, type) {
    var normalized = name.trim().toUpperCase();
    var found = null;
    this.registry.forEach(function(entity) {
      if (entity.name.toUpperCase() === normalized && entity.type === type) {
        found = entity;
      }
    });
    return found;
  },

  _changeTagType: function(tagId, highlightEl, newType) {
    var entity = this.registry.get(tagId);
    if (!entity) return;
    entity.type = newType;
    highlightEl.dataset.tagType = newType;

    var typeLabel = Rga.TAG_TYPES[newType] ? Rga.TAG_TYPES[newType].label : newType;
    highlightEl.title = typeLabel + ': ' + entity.name;

    this.updateManagerPanel();
  },

  _renameTag: function(tagId) {
    var entity = this.registry.get(tagId);
    if (!entity) return;

    var newName = prompt('Rename tag:', entity.name);
    if (!newName || !newName.trim()) return;

    entity.name = newName.trim();

    // Update all highlight spans for this tag
    Rga.$$('.tag-highlight[data-tag-id="' + tagId + '"]').forEach(function(el) {
      var typeLabel = Rga.TAG_TYPES[entity.type] ? Rga.TAG_TYPES[entity.type].label : entity.type;
      el.title = typeLabel + ': ' + entity.name;
    });

    this.updateManagerPanel();
  },

  _recountOccurrences: function(tagId) {
    var entity = this.registry.get(tagId);
    if (!entity) return;

    entity.occurrences.clear();
    Rga.$$('.tag-highlight[data-tag-id="' + tagId + '"]').forEach(function(el) {
      var block = el.closest('.editor-block');
      if (block && block.dataset.id) {
        entity.occurrences.add(block.dataset.id);
      }
    });
  },

  /* ============================================================
     TAG MANAGER SIDEBAR PANEL
     ============================================================ */

  /**
   * Re-render the tag manager sidebar panel.
   */
  updateManagerPanel: function() {
    var panel = Rga.$('.sidebar-panel[data-panel="tags"] .tag-groups-container');
    if (!panel) return;

    panel.innerHTML = '';

    // Group entities by type
    var groups = {};
    this.registry.forEach(function(entity) {
      if (!groups[entity.type]) groups[entity.type] = [];
      groups[entity.type].push(entity);
    });

    var self = this;

    // Render built-in types first, then custom
    var allTypes = Object.keys(Rga.TAG_TYPES);
    this.customTypes.forEach(function(_, key) {
      if (allTypes.indexOf(key) === -1) allTypes.push(key);
    });

    allTypes.forEach(function(type) {
      var entities = groups[type];
      if (!entities || entities.length === 0) return;

      var typeInfo = Rga.TAG_TYPES[type] || self.customTypes.get(type) || { label: type };
      var color = Rga.Color.getTagColor(type);

      var group = document.createElement('div');
      group.className = 'tag-group';

      // Group header
      var header = document.createElement('div');
      header.className = 'tag-group-header';
      header.dataset.collapsed = 'false';
      header.innerHTML =
        '<span class="collapse-chevron">\u25BE</span>' +
        '<span class="tag-group-dot" style="background:' + color + '"></span>' +
        '<span class="tag-group-label">' + typeInfo.label + '</span>' +
        '<span class="badge muted">' + entities.length + '</span>';

      header.addEventListener('click', function() {
        var collapsed = header.dataset.collapsed === 'true';
        header.dataset.collapsed = collapsed ? 'false' : 'true';
      });

      group.appendChild(header);

      // Items container
      var itemsDiv = document.createElement('div');
      itemsDiv.className = 'tag-group-items';

      entities.sort(function(a, b) { return a.name.localeCompare(b.name); });

      entities.forEach(function(entity) {
        var count = Rga.$$('.tag-highlight[data-tag-id="' + entity.id + '"]').length;

        var item = document.createElement('div');
        item.className = 'tag-item';
        item.dataset.tagId = entity.id;
        item.innerHTML =
          '<span class="tag-dot" style="background:' + color + '"></span>' +
          '<span class="tag-name">' + entity.name + '</span>' +
          '<span class="tag-count">' + count + '</span>';

        item.addEventListener('click', function() {
          self._showInInspector(entity.id);
        });

        itemsDiv.appendChild(item);
      });

      group.appendChild(itemsDiv);
      panel.appendChild(group);
    });
  },

  /* ============================================================
     INSPECTOR — show tag details
     ============================================================ */

  _showInInspector: function(tagId) {
    var entity = this.registry.get(tagId);
    if (!entity) return;

    var body = Rga.$('#inspector-panel .inspector-body');
    if (!body) return;

    var typeLabel = Rga.TAG_TYPES[entity.type]
      ? Rga.TAG_TYPES[entity.type].label
      : entity.type;

    var color = Rga.Color.getTagColor(entity.type);
    var highlights = Rga.$$('.tag-highlight[data-tag-id="' + tagId + '"]');

    var html = '<div class="inspector-section">' +
      '<div class="inspector-title">' + typeLabel + '</div>' +
      '<div class="inspector-field">' +
        '<label>Name</label>' +
        '<input class="inspector-input" type="text" value="' + entity.name + '" data-tag-id="' + tagId + '" data-field="name" />' +
      '</div>' +
      '<div class="inspector-field">' +
        '<label>Color</label>' +
        '<div class="color-swatches">' +
          this._buildSwatches(color) +
        '</div>' +
      '</div>' +
      '<div class="inspector-field">' +
        '<label>Occurrences (' + highlights.length + ')</label>' +
        '<div class="occurrence-list">' +
          this._buildOccurrenceList(highlights) +
        '</div>' +
      '</div>' +
      '<div class="inspector-field">' +
        '<label>Notes</label>' +
        '<textarea class="inspector-textarea" data-tag-id="' + tagId + '" data-field="notes" placeholder="Character notes...">' +
          (entity.notes || '') +
        '</textarea>' +
      '</div>' +
    '</div>';

    body.innerHTML = html;

    // Ensure inspector is visible
    Rga.$('#workspace').classList.remove('inspector-hidden');
  },

  _buildSwatches: function(activeColor) {
    var colors = [
      '#4FC1FF', '#FFB347', '#C586C0', '#4EC9B0',
      '#F44747', '#FF79C6', '#56B6C2', '#D19A66',
      '#E06C9F', '#7C6EF6', '#73E0A2', '#FFD700'
    ];
    return colors.map(function(c) {
      var active = c.toLowerCase() === activeColor.toLowerCase() ? ' active' : '';
      return '<button class="swatch' + active + '" style="background:' + c + '" data-color="' + c + '"></button>';
    }).join('');
  },

  _buildOccurrenceList: function(highlights) {
    if (highlights.length === 0) return '<div style="color:var(--text-tertiary);font-size:11px;">No occurrences</div>';

    return highlights.map(function(el, i) {
      var block = el.closest('.editor-block');
      var sceneHeader = null;
      var search = block;
      while (search) {
        if (search.dataset && search.dataset.blockType === 'scene-header') {
          sceneHeader = search;
          break;
        }
        search = search.previousElementSibling;
      }

      var sceneName = sceneHeader
        ? 'Scene #' + (Rga.$('.sh-number', sceneHeader) || {}).textContent
        : 'Before scenes';

      var blockType = Rga.formatBlockTypeName(block ? block.dataset.blockType : 'unknown');

      return '<div class="occurrence-item" data-highlight-index="' + i + '">' +
        sceneName + ' \u2014 ' + blockType +
      '</div>';
    }).join('');
  },

  /* ============================================================
     CUSTOM TAG DIALOG
     ============================================================ */

  _showCustomTagDialog: function(selectedText) {
    var self = this;

    // Create dialog
    var backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';

    var dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML =
      '<div class="dialog-header">' +
        '<span class="dialog-title">Create Custom Tag</span>' +
        '<button class="dialog-close">' + Rga.Icons.close + '</button>' +
      '</div>' +
      '<div class="dialog-body">' +
        '<div class="dialog-field">' +
          '<label>Tag Name</label>' +
          '<input type="text" id="dialog-tag-name" value="' + (selectedText || '') + '" />' +
        '</div>' +
        '<div class="dialog-field">' +
          '<label>Tag Type</label>' +
          '<select id="dialog-tag-type">' +
            Object.keys(Rga.TAG_TYPES).map(function(t) {
              return '<option value="' + t + '">' + Rga.TAG_TYPES[t].label + '</option>';
            }).join('') +
            '<option value="__new__">+ New Type\u2026</option>' +
          '</select>' +
        '</div>' +
        '<div class="dialog-field" id="dialog-new-type-row" style="display:none">' +
          '<label>New Type Name</label>' +
          '<input type="text" id="dialog-new-type-name" placeholder="e.g. Special Effect" />' +
        '</div>' +
        '<div class="dialog-field">' +
          '<label>Color</label>' +
          '<div class="dialog-color-row" id="dialog-colors">' +
            this._buildDialogSwatches() +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="dialog-footer">' +
        '<button class="btn-secondary" id="dialog-cancel">Cancel</button>' +
        '<button class="btn-primary" id="dialog-confirm">Create Tag</button>' +
      '</div>';

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    // Focus name input
    var nameInput = Rga.$('#dialog-tag-name');
    if (nameInput) nameInput.focus();

    // Show/hide "new type" row
    var typeSelect = Rga.$('#dialog-tag-type');
    var newTypeRow = Rga.$('#dialog-new-type-row');
    typeSelect.addEventListener('change', function() {
      newTypeRow.style.display = typeSelect.value === '__new__' ? '' : 'none';
    });

    // Color swatch selection
    var selectedColor = '#4FC1FF';
    Rga.$$('.dialog-color-swatch', dialog).forEach(function(swatch) {
      swatch.addEventListener('click', function() {
        Rga.$$('.dialog-color-swatch', dialog).forEach(function(s) { s.classList.remove('selected'); });
        swatch.classList.add('selected');
        selectedColor = swatch.dataset.color;
      });
    });
    // Select first by default
    var firstSwatch = Rga.$('.dialog-color-swatch', dialog);
    if (firstSwatch) firstSwatch.classList.add('selected');

    // Cancel
    Rga.$('#dialog-cancel', dialog).addEventListener('click', close);
    Rga.$('.dialog-close', dialog).addEventListener('click', close);
    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) close();
    });

    // Confirm
    Rga.$('#dialog-confirm', dialog).addEventListener('click', function() {
      var name = nameInput.value.trim();
      if (!name) return;

      var type = typeSelect.value;

      if (type === '__new__') {
        var newTypeName = Rga.$('#dialog-new-type-name').value.trim();
        if (!newTypeName) return;
        var typeKey = newTypeName.toLowerCase().replace(/\s+/g, '_');
        self.customTypes.set(typeKey, { label: newTypeName, color: selectedColor });
        type = typeKey;

        // Set CSS custom property for this custom type
        document.documentElement.style.setProperty('--tag-' + typeKey, selectedColor);
        document.documentElement.style.setProperty('--tag-' + typeKey + '-bg',
          Rga.Color.hexToRgba(selectedColor, 0.18));
      }

      self.tagSelection(type, name);
      close();
    });

    function close() {
      backdrop.remove();
    }
  },

  _buildDialogSwatches: function() {
    var colors = [
      '#4FC1FF', '#FFB347', '#C586C0', '#4EC9B0',
      '#F44747', '#FF79C6', '#56B6C2', '#D19A66',
      '#E06C9F', '#7C6EF6', '#73E0A2', '#FFD700'
    ];
    return colors.map(function(c) {
      return '<button class="dialog-color-swatch" data-color="' + c + '" style="background:' + c + '"></button>';
    }).join('') +
    '<button class="dialog-color-custom" title="Custom color">+</button>';
  },

  /* ============================================================
     BLOCK-LEVEL TAG QUERIES
     ============================================================ */

  /**
   * Get all tags from a block as serializable objects.
   * @param {HTMLElement} block
   * @returns {Array<{ start, end, tagId, type }>}
   */
  getTagsFromBlock: function(block) {
    var tags = [];
    var highlights = Rga.$$('.tag-highlight', block);
    var fullText = block.textContent;

    highlights.forEach(function(hl) {
      var tagText = hl.textContent;
      var start = fullText.indexOf(tagText);
      tags.push({
        start: start,
        end: start + tagText.length,
        tagId: hl.dataset.tagId,
        type: hl.dataset.tagType
      });
    });

    return tags;
  },

  /**
   * Apply tag highlights to a block from serialized data.
   * @param {HTMLElement} block
   * @param {Array} tags - [{ start, end, tagId, type }]
   */
  applyTagsToBlock: function(block, tags) {
    if (!tags || tags.length === 0) return;

    var text = block.textContent;
    // Sort tags by start position descending (so indices don't shift)
    tags.sort(function(a, b) { return b.start - a.start; });

    // Work with the text node directly
    var textNode = block.firstChild;
    if (!textNode || textNode.nodeType !== 3) return;

    tags.forEach(function(tag) {
      var range = document.createRange();
      try {
        range.setStart(textNode, tag.start);
        range.setEnd(textNode, tag.end);

        var span = document.createElement('span');
        span.className = 'tag-highlight';
        span.dataset.tagId = tag.tagId;
        span.dataset.tagType = tag.type;

        var typeLabel = Rga.TAG_TYPES[tag.type] ? Rga.TAG_TYPES[tag.type].label : tag.type;
        var entity = Rga.TagSystem.registry.get(tag.tagId);
        span.title = typeLabel + ': ' + (entity ? entity.name : '');

        range.surroundContents(span);
      } catch (err) {
        // Silently skip if range is invalid
      }
    });
  },

  /* ============================================================
     SERIALIZATION
     ============================================================ */

  serializeRegistry: function() {
    var result = {};
    this.registry.forEach(function(entity) {
      if (!result[entity.type]) result[entity.type] = [];
      result[entity.type].push({
        id: entity.id,
        name: entity.name,
        customColor: entity.customColor,
        notes: entity.notes
      });
    });
    return result;
  },

  loadRegistry: function(data) {
    var self = this;
    this.registry.clear();
    if (!data) return;

    Object.keys(data).forEach(function(type) {
      var entities = data[type];
      if (!Array.isArray(entities)) return;

      entities.forEach(function(e) {
        self.registry.set(e.id, {
          id: e.id,
          name: e.name,
          type: type,
          customColor: e.customColor || null,
          notes: e.notes || '',
          occurrences: new Set()
        });
      });
    });

    this.updateManagerPanel();
  },

  /* ============================================================
     HELPERS
     ============================================================ */

  _createTypeDot: function(type) {
    var color = Rga.Color.getTagColor(type);
    return Rga.Color.createDot(color);
  },

  _createCustomDot: function(color) {
    return Rga.Color.createDot(color || '#999999');
  }
};

/* ============================================================
   CONTEXT MENU RENDERER (shared by tag system + scene menus)
   ============================================================ */
Rga.ContextMenu = {
  _el: null,

  /**
   * Show a context menu at the given position.
   * @param {Array} items - menu item definitions
   * @param {number} x
   * @param {number} y
   */
  show: function(items, x, y) {
    this.close();

    this._el = document.createElement('div');
    this._el.className = 'overlay-menu';
    this._el.style.position = 'fixed';
    this._el.style.zIndex = '1000';

    this._renderItems(this._el, items);
    document.body.appendChild(this._el);

    // Position — keep within viewport
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var rect = this._el.getBoundingClientRect();
    this._el.style.left = Math.min(x, vw - rect.width - 8) + 'px';
    this._el.style.top = Math.min(y, vh - rect.height - 8) + 'px';

    // Close on outside click
    var self = this;
    setTimeout(function() {
      document.addEventListener('click', self._onOutsideClick);
      document.addEventListener('keydown', self._onEscape);
    }, 0);
  },

  close: function() {
    if (this._el) {
      this._el.remove();
      this._el = null;
    }
    document.removeEventListener('click', Rga.ContextMenu._onOutsideClick);
    document.removeEventListener('keydown', Rga.ContextMenu._onEscape);
  },

  _onOutsideClick: function(e) {
    if (Rga.ContextMenu._el && !Rga.ContextMenu._el.contains(e.target)) {
      Rga.ContextMenu.close();
    }
  },

  _onEscape: function(e) {
    if (e.key === 'Escape') Rga.ContextMenu.close();
  },

  _renderItems: function(container, items) {
    var self = this;

    items.forEach(function(item) {
      if (item.separator) {
        var sep = document.createElement('div');
        sep.className = 'menu-separator';
        container.appendChild(sep);
        return;
      }

      var option = document.createElement('div');
      option.className = 'menu-option';

      var label = document.createElement('span');
      label.className = 'menu-option-label';

      if (item.icon && item.icon instanceof HTMLElement) {
        label.appendChild(item.icon);
      }

      var text = document.createElement('span');
      text.textContent = item.label;
      label.appendChild(text);
      option.appendChild(label);

      if (item.shortcut) {
        var shortcut = document.createElement('span');
        shortcut.className = 'menu-option-shortcut';
        shortcut.textContent = item.shortcut;
        option.appendChild(shortcut);
      }

      if (item.submenu) {
        var arrow = document.createElement('span');
        arrow.className = 'menu-option-arrow';
        arrow.textContent = '\u25B8';
        option.appendChild(arrow);

        option.addEventListener('mouseenter', function() {
          // Close sibling submenus
          Rga.$$('.overlay-menu', container).forEach(function(m) { m.remove(); });

          var subMenu = document.createElement('div');
          subMenu.className = 'overlay-menu';
          subMenu.style.position = 'absolute';
          subMenu.style.left = '100%';
          subMenu.style.top = (option.offsetTop - 4) + 'px';
          self._renderItems(subMenu, item.submenu);
          option.style.position = 'relative';
          option.appendChild(subMenu);
        });
      } else if (item.action) {
        option.addEventListener('click', function(e) {
          e.stopPropagation();
          self.close();
          item.action();
        });
      }

      container.appendChild(option);
    });
  }
};
