// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
/* ============================================================
   RWANGA SCRIPT EDITOR — scene-manager.js
   Scene header widget creation, scene model, scene navigator
   sidebar, scroll-to-scene, location autocomplete.
   Depends on: utils.js, editor-engine.js, icons.js
   ============================================================ */

window.Rga = window.Rga || {};

/* ============================================================
   CONSTANTS
   ============================================================ */
Rga.SCENE_SETTINGS = ['INT', 'EXT', 'INT/EXT', 'EXT/INT'];

Rga.SCENE_TIMES = [
  'DAY', 'NIGHT', 'DAWN', 'DUSK', 'MORNING', 'EVENING',
  'AFTERNOON', 'CONTINUOUS', 'LATER', 'SAME TIME', 'MOMENTS LATER'
];

/* ============================================================
   SCENE MANAGER
   ============================================================ */
Rga.SceneManager = {
  /** @type {Map<string, object>} sceneId → scene data */
  scenes: new Map(),

  init: function() {
    this._ensureDatalist();
  },

  /* ============================================================
     SCENE HEADER CREATION
     ============================================================ */

  /** SVG for the drag grip (6-dot pattern) */
  _dragGripSVG: '<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">' +
    '<circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/>' +
    '<circle cx="3" cy="6" r="1.2"/><circle cx="7" cy="6" r="1.2"/>' +
    '<circle cx="3" cy="10" r="1.2"/><circle cx="7" cy="10" r="1.2"/>' +
    '<circle cx="3" cy="14" r="1.2"/><circle cx="7" cy="14" r="1.2"/>' +
  '</svg>',

  /** SVG for collapse chevron */
  _chevronSVG: '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5l3 3 3-3"/></svg>',

  /**
   * Create a scene header widget and insert it into the editor.
   * @param {object} [data] - { number, setting, location, time }
   * @param {HTMLElement} [afterBlock] - insert after this block
   * @returns {HTMLElement}
   */
  createHeader: function(data, afterBlock) {
    data = data || {};
    var sceneId = Rga.generateId('scene');
    var number = data.number || this._getNextNumber();

    var header = document.createElement('div');
    header.className = 'editor-block scene-header';
    header.dataset.blockType = 'scene-header';
    header.dataset.sceneId = sceneId;
    header.contentEditable = 'false';

    // Build inner HTML — drag handle + collapse chevron + scene fields
    header.innerHTML =
      '<span class="sh-drag-handle" title="Drag to reorder">' + this._dragGripSVG + '</span>' +
      '<button class="sh-collapse-btn" title="Collapse/Expand scene">' + this._chevronSVG + '</button>' +
      '<span class="sh-number">#' + number + '</span>' +
      '<span class="sh-separator">\u2014</span>' +
      this._buildSelect('sh-setting', Rga.SCENE_SETTINGS, data.setting || 'INT') +
      '<span class="sh-dot">.</span>' +
      '<input class="sh-location" type="text"' +
        ' value="' + this._escAttr(data.location || '') + '"' +
        ' placeholder="LOCATION..."' +
        ' list="location-suggestions"' +
        ' autocomplete="off" />' +
      '<span class="sh-separator">\u2014</span>' +
      this._buildSelect('sh-time', Rga.SCENE_TIMES, data.time || 'DAY') +
      '<button class="sh-menu-btn" title="Scene options">' +
        (Rga.Icons.ellipsis || '\u22EF') +
      '</button>';

    // Insert into editor
    var editor = Rga.$('#editor');
    if (afterBlock && afterBlock.parentElement === editor) {
      afterBlock.after(header);
    } else if (editor) {
      editor.appendChild(header);
    }

    // Register scene data
    this.scenes.set(sceneId, {
      id: sceneId,
      number: number,
      setting: data.setting || 'INT',
      location: data.location || '',
      time: data.time || 'DAY',
      notes: data.notes || ''
    });

    // Bind scene header events
    this._bindHeaderEvents(header);

    // Create "+" insert zone BEFORE this header
    this._insertInsertZone(header);

    // Update sidebar & gutter
    this.updateNavigator();
    this.updateLocationSuggestions();
    if (Rga.Editor) Rga.Editor.updateGutter();

    return header;
  },

  /* ============================================================
     HEADER EVENTS
     ============================================================ */

  _bindHeaderEvents: function(header) {
    var self = this;
    var sceneId = header.dataset.sceneId;

    // Setting dropdown change
    var settingEl = Rga.$('.sh-setting', header);
    if (settingEl) {
      settingEl.addEventListener('change', function() {
        self._updateSceneData(sceneId, { setting: settingEl.value });
      });
    }

    // Location input change
    var locationEl = Rga.$('.sh-location', header);
    if (locationEl) {
      locationEl.addEventListener('input', Rga.debounce(function() {
        self._updateSceneData(sceneId, { location: locationEl.value.toUpperCase() });
        self.updateLocationSuggestions();
      }, 200));

      // Auto-uppercase as user types
      locationEl.addEventListener('input', function() {
        var pos = locationEl.selectionStart;
        locationEl.value = locationEl.value.toUpperCase();
        locationEl.selectionStart = pos;
        locationEl.selectionEnd = pos;
      });

      // Tab from location → move to next editable block
      locationEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          // Focus the first block after this header
          var next = header.nextElementSibling;
          if (next && next.dataset.blockType !== 'scene-header') {
            Rga.Cursor.setToStart(next);
            next.focus();
          } else {
            // Create new action block
            var newBlock = Rga.Editor.insertBlock('action', '', header);
            Rga.Cursor.setToStart(newBlock);
          }
        }
      });
    }

    // Time dropdown change
    var timeEl = Rga.$('.sh-time', header);
    if (timeEl) {
      timeEl.addEventListener('change', function() {
        self._updateSceneData(sceneId, { time: timeEl.value });
      });
    }

    // Collapse/Expand button
    var collapseBtn = Rga.$('.sh-collapse-btn', header);
    if (collapseBtn) {
      collapseBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        self.toggleCollapse(sceneId, header);
      });
    }

    // Drag handle
    var dragHandle = Rga.$('.sh-drag-handle', header);
    if (dragHandle) {
      dragHandle.addEventListener('mousedown', function(e) {
        self._startDrag(e, header, sceneId);
      });
    }

    // Menu button
    var menuBtn = Rga.$('.sh-menu-btn', header);
    if (menuBtn) {
      menuBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        self._showSceneMenu(header, e);
      });
    }

    // Click on scene header → show in inspector
    header.addEventListener('click', function(e) {
      if (!e.target.closest('select') && !e.target.closest('input') && !e.target.closest('button')) {
        self._selectScene(sceneId);
      }
    });
  },

  _updateSceneData: function(sceneId, updates) {
    var scene = this.scenes.get(sceneId);
    if (!scene) return;
    Object.assign(scene, updates);
    this.updateNavigator();
    Rga.StatusBar.update();
    if (Rga.Tabs && Rga.Tabs.activeTabId) {
      Rga.Tabs.setDirty(Rga.Tabs.activeTabId, true);
    }
  },

  /* ============================================================
     SCENE MENU (right-click / ⋯ button)
     ============================================================ */

  _showSceneMenu: function(header, event) {
    var self = this;
    var sceneId = header.dataset.sceneId;

    if (!Rga.ContextMenu) return;

    var items = [
      { label: 'Collapse Scene', action: function() { self.toggleCollapse(sceneId, header); } },
      { separator: true },
      { label: 'Insert Scene Above', action: function() { self._insertSceneAbove(header); } },
      { label: 'Insert Scene Below', action: function() { self._insertSceneBelow(header); } },
      { separator: true },
      { label: 'Collapse All Scenes', action: function() { self.collapseAll(); } },
      { label: 'Expand All Scenes', action: function() { self.expandAll(); } },
      { separator: true },
      { label: 'Renumber Scenes', action: function() { self.renumberScenes(); } },
      { separator: true },
      { label: 'Delete Scene', action: function() { self._deleteScene(sceneId, header); } }
    ];

    Rga.ContextMenu.show(items, event.clientX, event.clientY);
  },

  _insertSceneAbove: function(header) {
    var prev = header.previousElementSibling;
    // We'll insert before header by inserting after the previous element
    if (prev) {
      this.createHeader({}, prev);
    } else {
      // It's the first element — prepend
      var editor = Rga.$('#editor');
      var newHeader = this.createHeader({});
      editor.prepend(newHeader);
    }
  },

  _insertSceneBelow: function(header) {
    // Find last block belonging to this scene (everything until next scene-header)
    var last = header;
    var sibling = header.nextElementSibling;
    while (sibling && sibling.dataset.blockType !== 'scene-header') {
      last = sibling;
      sibling = sibling.nextElementSibling;
    }
    this.createHeader({}, last);
  },

  _deleteScene: function(sceneId, header) {
    // Remove header and all blocks until next scene-header
    var toRemove = [header];
    var sibling = header.nextElementSibling;
    while (sibling && sibling.dataset.blockType !== 'scene-header') {
      toRemove.push(sibling);
      sibling = sibling.nextElementSibling;
    }
    toRemove.forEach(function(el) { el.remove(); });
    this.scenes.delete(sceneId);
    this.renumberScenes();
    this.updateNavigator();
    if (Rga.Editor) Rga.Editor.updateGutter();
  },

  _selectScene: function(sceneId) {
    // Highlight in sidebar
    Rga.$$('.scene-item').forEach(function(item) {
      item.classList.toggle('active', item.dataset.sceneId === sceneId);
    });

    // Show in inspector if available
    if (Rga.Inspector && Rga.Inspector.showScene) {
      Rga.Inspector.showScene(sceneId);
    }
  },

  /* ============================================================
     SCENE NAVIGATOR (sidebar)
     ============================================================ */

  /**
   * Doc-scoped scene navigator update (Phase 6: multi-tab).
   * Renders the scene list from a Doc body, not from the DOM.
   */
  updateNavigatorFor: function(doc, container) {
    var sceneList = document.querySelector('[data-panel="scenes"] .scene-list');
    if (!sceneList) return;
    sceneList.innerHTML = '';
    var scenes = (doc && doc.body && doc.body.scenes) || [];
    var badge = document.querySelector('.scenes-badge');
    if (badge) badge.textContent = scenes.length;
    scenes.forEach(function(scene) {
      var item = document.createElement('div');
      item.className = 'scene-item';
      item.dataset.sceneId = scene.id || '';
      item.textContent = '#' + (scene.number || '') + ' ' + (scene.setting || '') + '. ' + (scene.location || '') + ' — ' + (scene.time || '');
      item.addEventListener('click', function() {
        if (!container) return;
        var target = container.querySelector('[data-scene-id="' + scene.id + '"]');
        if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      sceneList.appendChild(item);
    });
  },

  /**
   * Re-render the scene list in the sidebar.
   */
  updateNavigator: function() {
    var list = Rga.$('.scene-list');
    if (!list) return;

    list.innerHTML = '';

    var headers = Rga.$$('.scene-header', Rga.$('#editor'));
    var self = this;

    headers.forEach(function(header) {
      var sceneId = header.dataset.sceneId;
      var scene = self.scenes.get(sceneId);
      if (!scene) return;

      var item = document.createElement('div');
      item.className = 'scene-item';
      item.dataset.sceneId = sceneId;

      var num = document.createElement('span');
      num.className = 'scene-item-number';
      num.textContent = '#' + scene.number;
      item.appendChild(num);

      var text = document.createElement('span');
      text.className = 'scene-item-text';
      text.textContent = scene.setting + '. ' +
        (scene.location || '???') + ' \u2014 ' + scene.time;
      item.appendChild(text);

      item.addEventListener('click', function() {
        self.scrollToScene(sceneId);
        self._selectScene(sceneId);
      });

      list.appendChild(item);
    });

    // Update badge
    var badge = Rga.$('.scenes-badge');
    if (badge) badge.textContent = headers.length;
  },

  /**
   * Scroll the editor to a specific scene.
   * Does NOT use scrollIntoView — uses direct scrollTop calculation.
   */
  scrollToScene: function(sceneId) {
    var header = Rga.$('[data-scene-id="' + sceneId + '"]');
    if (!header) return;

    var container = Rga.$('#editor-container');
    if (!container) return;

    // Calculate the offset of the header relative to the editor's scroll area
    var editor = Rga.$('#editor');
    if (!editor) return;

    // Get the header's position relative to the editor
    var headerTop = 0;
    var el = header;
    while (el && el !== editor) {
      headerTop += el.offsetTop;
      el = el.offsetParent;
      if (el === container || el === document.body) break;
    }

    // If header is inside #editor, we need its offset within the scrollable container
    // The container scrolls, so we set scrollTop to place the header near the top
    var editorRect = editor.getBoundingClientRect();
    var headerRect = header.getBoundingClientRect();
    var currentScroll = container.scrollTop;
    var targetScroll = currentScroll + (headerRect.top - editorRect.top) - 20;

    container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });

    // Expand scene if collapsed
    if (header.classList.contains('collapsed')) {
      this.toggleCollapse(sceneId, header);
    }

    // Flash the header to confirm navigation
    header.style.transition = 'box-shadow 0.3s ease';
    header.style.boxShadow = 'inset 0 0 0 2px var(--accent-primary)';
    setTimeout(function() {
      header.style.boxShadow = '';
    }, 1200);
  },

  /**
   * Highlight the current scene in the sidebar based on scroll position.
   */
  updateActiveInSidebar: function() {
    var container = Rga.$('#editor-container');
    if (!container) return;

    var scrollTop = container.scrollTop;
    var headers = Rga.$$('.scene-header', Rga.$('#editor'));
    var activeSceneId = null;

    headers.forEach(function(h) {
      if (h.offsetTop - 40 <= scrollTop) {
        activeSceneId = h.dataset.sceneId;
      }
    });

    Rga.$$('.scene-item').forEach(function(item) {
      item.classList.toggle('active', item.dataset.sceneId === activeSceneId);
    });
  },

  /* ============================================================
     SCENE NUMBERING
     ============================================================ */

  _getNextNumber: function() {
    return this.scenes.size + 1;
  },

  /**
   * Renumber all scenes sequentially based on document order.
   */
  renumberScenes: function() {
    var headers = Rga.$$('.scene-header', Rga.$('#editor'));
    var self = this;
    headers.forEach(function(header, index) {
      var num = index + 1;
      var numEl = Rga.$('.sh-number', header);
      if (numEl) numEl.textContent = '#' + num;

      var sceneId = header.dataset.sceneId;
      var scene = self.scenes.get(sceneId);
      if (scene) scene.number = num;
    });
    this.updateNavigator();
    if (Rga.Editor) Rga.Editor.updateGutter();
  },

  /* ============================================================
     LOCATION AUTOCOMPLETE
     ============================================================ */

  _ensureDatalist: function() {
    if (!Rga.$('#location-suggestions')) {
      var datalist = document.createElement('datalist');
      datalist.id = 'location-suggestions';
      document.body.appendChild(datalist);
    }
  },

  updateLocationSuggestions: function() {
    var datalist = Rga.$('#location-suggestions');
    if (!datalist) return;

    var locations = new Set();
    Rga.$$('.sh-location').forEach(function(input) {
      var val = input.value.trim().toUpperCase();
      if (val) locations.add(val);
    });

    datalist.innerHTML = Array.from(locations)
      .map(function(loc) { return '<option value="' + loc + '">'; })
      .join('');
  },

  /* ============================================================
     SERIALIZATION
     ============================================================ */

  /**
   * Serialize all scenes to JSON-friendly format.
   * @returns {Array}
   */
  serialize: function() {
    var result = [];
    var editor = Rga.$('#editor');
    var headers = Rga.$$('.scene-header', editor);
    var self = this;

    headers.forEach(function(header) {
      var sceneId = header.dataset.sceneId;
      var scene = self.scenes.get(sceneId) || {};

      // Collect all element blocks until next scene header
      var elements = [];
      var sibling = header.nextElementSibling;
      while (sibling && sibling.dataset.blockType !== 'scene-header') {
        elements.push({
          id: sibling.dataset.id || Rga.generateId('el'),
          type: sibling.dataset.blockType,
          text: sibling.textContent,
          tags: Rga.TagSystem ? Rga.TagSystem.getTagsFromBlock(sibling) : []
        });
        sibling = sibling.nextElementSibling;
      }

      result.push({
        id: sceneId,
        number: scene.number || 0,
        setting: scene.setting || 'INT',
        location: scene.location || '',
        time: scene.time || 'DAY',
        notes: scene.notes || '',
        elements: elements
      });
    });

    return result;
  },

  /**
   * Load scenes from serialized data into the editor.
   * @param {Array} scenesData
   */
  load: function(scenesData) {
    var self = this;
    this.scenes.clear();

    if (Rga.Editor) Rga.Editor.clear();

    scenesData.forEach(function(sceneData) {
      // Create scene header
      self.createHeader({
        number: sceneData.number,
        setting: sceneData.setting,
        location: sceneData.location,
        time: sceneData.time,
        notes: sceneData.notes
      });

      // Create element blocks
      var lastBlock = Rga.$('.scene-header:last-child', Rga.$('#editor'));
      sceneData.elements.forEach(function(el) {
        var block = Rga.Editor.insertBlock(el.type, el.text, lastBlock);
        block.dataset.id = el.id || Rga.generateId('el');

        // Apply tag highlights
        if (el.tags && el.tags.length > 0 && Rga.TagSystem) {
          Rga.TagSystem.applyTagsToBlock(block, el.tags);
        }

        lastBlock = block;
      });
    });

    this.updateNavigator();
    this.updateLocationSuggestions();
    if (Rga.Editor) Rga.Editor.updateGutter();
  },

  /* ============================================================
     SCENE COLLAPSE / EXPAND
     ============================================================ */

  /**
   * Toggle collapse state of a scene.
   * When collapsed, all blocks between this header and the next are hidden.
   */
  toggleCollapse: function(sceneId, header) {
    var isCollapsed = header.classList.contains('collapsed');

    if (isCollapsed) {
      this._expandScene(header);
    } else {
      this._collapseScene(header);
    }

    this.updateNavigator();
    if (Rga.Editor) Rga.Editor.updateGutter();
  },

  _collapseScene: function(header) {
    header.classList.add('collapsed');

    // Build a summary from the first action block
    var summary = '';
    var sibling = header.nextElementSibling;
    while (sibling && sibling.dataset.blockType !== 'scene-header') {
      if (!summary && sibling.dataset.blockType === 'action') {
        summary = Rga.truncate(sibling.textContent.trim(), 40);
      }
      // Hide the block
      sibling.classList.add('scene-collapsed');
      sibling = sibling.nextElementSibling;
    }

    header.dataset.collapseSummary = summary ? '  \u2014 ' + summary : '  (empty scene)';
  },

  _expandScene: function(header) {
    header.classList.remove('collapsed');
    header.dataset.collapseSummary = '';

    var sibling = header.nextElementSibling;
    while (sibling && sibling.dataset.blockType !== 'scene-header') {
      sibling.classList.remove('scene-collapsed');
      sibling = sibling.nextElementSibling;
    }
  },

  /**
   * Collapse all scenes.
   */
  collapseAll: function() {
    var self = this;
    Rga.$$('.scene-header', Rga.$('#editor')).forEach(function(header) {
      if (!header.classList.contains('collapsed')) {
        self._collapseScene(header);
      }
    });
    this.updateNavigator();
    if (Rga.Editor) Rga.Editor.updateGutter();
  },

  /**
   * Expand all scenes.
   */
  expandAll: function() {
    var self = this;
    Rga.$$('.scene-header', Rga.$('#editor')).forEach(function(header) {
      if (header.classList.contains('collapsed')) {
        self._expandScene(header);
      }
    });
    this.updateNavigator();
    if (Rga.Editor) Rga.Editor.updateGutter();
  },

  /* ============================================================
     SCENE DRAG & DROP (reorder scenes)
     ============================================================ */

  _dragState: null,

  _startDrag: function(e, header, sceneId) {
    e.preventDefault();
    var self = this;
    var editor = Rga.$('#editor');
    if (!editor) return;

    header.classList.add('dragging');
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    // Collect all elements belonging to this scene
    var sceneElements = [header];
    var sibling = header.nextElementSibling;
    while (sibling && sibling.dataset.blockType !== 'scene-header') {
      sceneElements.push(sibling);
      sibling = sibling.nextElementSibling;
    }

    // Create drop indicator
    var indicator = document.createElement('div');
    indicator.className = 'scene-drop-indicator';
    indicator.style.display = 'none';

    this._dragState = {
      sceneId: sceneId,
      header: header,
      elements: sceneElements,
      indicator: indicator,
      targetBefore: null
    };

    editor.appendChild(indicator);

    function onMove(e2) {
      // Find which scene header we're hovering over
      var allHeaders = Rga.$$('.scene-header', editor);
      var targetHeader = null;
      var insertBefore = true;

      allHeaders.forEach(function(h) {
        if (h === header) return;
        var rect = h.getBoundingClientRect();
        var midY = rect.top + rect.height / 2;
        if (e2.clientY > rect.top && e2.clientY < rect.bottom) {
          targetHeader = h;
          insertBefore = e2.clientY < midY;
        }
      });

      if (targetHeader) {
        indicator.style.display = 'block';
        if (insertBefore) {
          targetHeader.parentNode.insertBefore(indicator, targetHeader);
        } else {
          // Insert after the last block of the target scene
          var last = targetHeader.nextElementSibling;
          while (last && last.nextElementSibling &&
                 last.nextElementSibling.dataset.blockType !== 'scene-header') {
            last = last.nextElementSibling;
          }
          if (last && last.dataset.blockType !== 'scene-header') {
            last.after(indicator);
          } else if (last) {
            targetHeader.after(indicator);
          }
        }
        self._dragState.targetBefore = indicator.nextElementSibling;
      } else {
        indicator.style.display = 'none';
        self._dragState.targetBefore = null;
      }
    }

    function onUp() {
      header.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      indicator.remove();

      // Perform the move
      if (self._dragState.targetBefore) {
        var parent = editor;
        var before = self._dragState.targetBefore;
        self._dragState.elements.forEach(function(el) {
          parent.insertBefore(el, before);
        });
        self.renumberScenes();
      }

      self._dragState = null;
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  },

  /* ============================================================
     SCENE INSERT ZONES ("+" buttons between scenes)
     ============================================================ */

  /**
   * Create a "+" insert zone before a scene header.
   */
  _insertInsertZone: function(header) {
    var self = this;
    var editor = Rga.$('#editor');
    if (!editor) return;

    var zone = document.createElement('div');
    zone.className = 'scene-insert-zone';
    zone.contentEditable = 'false';

    var btn = document.createElement('button');
    btn.className = 'scene-insert-btn';
    btn.innerHTML = Rga.Icons ? Rga.Icons.plus : '+';
    btn.title = 'Insert new scene here';

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      // Find the block just before this zone
      var prevBlock = zone.previousElementSibling;
      // Remove the zone temporarily (it'll be recreated)
      zone.remove();
      // Create a new scene header at this position
      self.createHeader({}, prevBlock);
      // Also create an empty action block after the new header
      var lastHeader = Rga.$$('.scene-header', editor);
      var newHeader = lastHeader[lastHeader.length - 1]; // might not be right, find by recent
      // The new scene already exists, add a block
      if (newHeader) {
        var newBlock = Rga.Editor.insertBlock('action', '', newHeader);
        Rga.Cursor.setToStart(newBlock);
      }
    });

    zone.appendChild(btn);

    // Insert the zone before the header
    header.parentNode.insertBefore(zone, header);
  },

  /**
   * Refresh all insert zones (call after drag-reorder or scene deletion).
   */
  refreshInsertZones: function() {
    var editor = Rga.$('#editor');
    if (!editor) return;

    // Remove all existing zones
    Rga.$$('.scene-insert-zone', editor).forEach(function(z) { z.remove(); });

    // Re-create for each scene header
    var self = this;
    Rga.$$('.scene-header', editor).forEach(function(header) {
      self._insertInsertZone(header);
    });

    // Also add one at the very end of the editor for "add scene at end"
    var lastZone = document.createElement('div');
    lastZone.className = 'scene-insert-zone';
    lastZone.contentEditable = 'false';

    var lastBtn = document.createElement('button');
    lastBtn.className = 'scene-insert-btn';
    lastBtn.innerHTML = Rga.Icons ? Rga.Icons.plus : '+';
    lastBtn.title = 'Add new scene at end';
    lastBtn.addEventListener('click', function() {
      self.createHeader({});
      var allHeaders = Rga.$$('.scene-header', editor);
      var newHeader = allHeaders[allHeaders.length - 1];
      if (newHeader) {
        var newBlock = Rga.Editor.insertBlock('action', '', newHeader);
        Rga.Cursor.setToStart(newBlock);
      }
    });

    lastZone.appendChild(lastBtn);
    editor.appendChild(lastZone);
  },

  /* ============================================================
     HELPERS
     ============================================================ */

  _buildSelect: function(className, options, selected) {
    var html = '<select class="' + className + '">';
    options.forEach(function(opt) {
      html += '<option value="' + opt + '"' +
        (opt === selected ? ' selected' : '') +
        '>' + opt + '</option>';
    });
    html += '</select>';
    return html;
  },

  _escAttr: function(str) {
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
};
