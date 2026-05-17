// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
/* ============================================================
   RWANGA SCRIPT EDITOR — app-shell.js
   Theme manager, resize handles, sidebar panel switching,
   tab manager, keyboard shortcut registry, status bar updates,
   command palette.
   Depends on: utils.js, icons.js
   ============================================================ */

window.Rga = window.Rga || {};

/* ============================================================
   THEME MANAGER
   ============================================================ */
Rga.Theme = {
  current: 'dark',

  init: function() {
    var saved = localStorage.getItem('rga-theme') || 'dark';
    this.apply(saved);
  },

  apply: function(theme) {
    this.current = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rga-theme', theme);

    // Force repaint of all themed elements
    document.body.style.display = 'none';
    document.body.offsetHeight; // trigger reflow
    document.body.style.display = '';

    // Slice 2: Rga.StatusBar.update() removed — entry #1 resolution.
    // Theme changes propagate visually via CSS; no status-bar update needed.
  },

  toggle: function() {
    var next = this.current === 'dark' ? 'light' : 'dark';
    this.apply(next);
    Rga.Toast.show('Switched to ' + next + ' theme', 'success', 1500);
  }
};

/* ============================================================
   RESIZE HANDLES
   Allows dragging dividers between panels.
   ============================================================ */
Rga.Resize = {
  init: function() {
    var handles = Rga.$$('.resize-handle');
    handles.forEach(function(handle) {
      handle.addEventListener('mousedown', function(e) {
        Rga.Resize._startDrag(e, handle);
      });
    });
  },

  _startDrag: function(e, handle) {
    e.preventDefault();
    handle.classList.add('dragging');
    document.body.style.cursor = handle.dataset.resize === 'bottom-panel' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';

    var target = handle.dataset.resize;
    var isVertical = target === 'bottom-panel';
    var startPos = isVertical ? e.clientY : e.clientX;
    var prop = target === 'sidebar' ? '--sidebar-width'
             : target === 'inspector' ? '--inspector-width'
             : '--bottom-panel-height';

    var startSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue(prop)) || 0;

    function onMove(e2) {
      var delta;
      if (isVertical) {
        delta = startPos - e2.clientY; // drag up = larger
      } else if (target === 'inspector') {
        delta = startPos - e2.clientX; // drag left = larger
      } else {
        delta = e2.clientX - startPos; // drag right = larger
      }

      var newSize = startSize + delta;
      var minSize = isVertical ? 100 : 180;
      var collapseThreshold = 60;

      if (newSize < collapseThreshold) {
        newSize = 0;
      } else {
        newSize = Math.max(newSize, minSize);
      }

      document.documentElement.style.setProperty(prop, newSize + 'px');
    }

    function onUp() {
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
};

/* ============================================================
   SIDEBAR MANAGER — Slice 2 compatibility shim.
   The legacy Rga.Sidebar was retired by Slice 2 (entries #2/#3 in the
   shell compatibility inventory). Reduced here to a minimal no-op shim
   so the engine plugin `tags.js:206` (which calls
   `Rga.Sidebar.switchTo('tags')` after tagging) keeps working without
   an engine change. Compatibility Inventory entry #2 is BLOCKED on
   that engine dependency; full removal of this shim happens in Slice 3
   when the Characters panel + Breakdown tab subsume the legacy tags
   concept. The new shell's sidebar is owned by Rga.Shell.Sidebar +
   Rga.Shell.Layout.
   ============================================================ */
Rga.Sidebar = {
  activePanel: null,
  init:           function() { /* no-op — Rga.Shell.init owns the sidebar now */ },
  switchTo:       function(/* panelName */) { /* no-op shim for engine consumer; intentional */ },
  toggleCollapse: function() { /* no-op shim — see Rga.Shell.Layout.set({sidebar:{visible:...}}) */ }
};

/* ============================================================
   TAB MANAGER
   Manages editor tabs (create, switch, close, dirty state).
   ============================================================ */
Rga.Tabs = {
  tabs: [],
  activeTabId: null,

  init: function() {
    var self = this;
    // "New tab" button
    var newBtn = Rga.$('#tab-new');
    if (newBtn) {
      newBtn.addEventListener('click', function() {
        self.create('Untitled.rga', 'rga');
      });
    }
  },

  /**
   * Create a new tab.
   * @param {string} title
   * @param {string} fileType - 'rga', 'txt', 'md'
   * @returns {string} tabId
   */
  create: function(title, fileType) {
    var tabId = Rga.generateId('tab');
    var tab = {
      id: tabId,
      title: title || 'Untitled.rga',
      fileType: fileType || 'rga',
      filePath: null,
      isDirty: false,
      editorHTML: '',
      scrollPosition: 0,
      scenes: [],
      tagRegistry: {},
      notes: {},
      problems: []
    };
    this.tabs.push(tab);
    this._renderTab(tab);
    this.switchTo(tabId);
    return tabId;
  },

  /**
   * Switch to a tab by ID.
   */
  switchTo: function(tabId) {
    // Save current tab state
    if (this.activeTabId) {
      this._saveCurrentState();
    }

    this.activeTabId = tabId;

    // Update tab bar UI
    Rga.$$('.tab').forEach(function(el) {
      el.classList.toggle('active', el.dataset.tabId === tabId);
    });

    // Load tab state into editor
    var tab = this._getTab(tabId);
    if (tab) {
      this._loadState(tab);
    }
  },

  /**
   * Close a tab by ID.
   */
  close: function(tabId) {
    var index = this.tabs.findIndex(function(t) { return t.id === tabId; });
    if (index === -1) return;

    // Remove tab data
    this.tabs.splice(index, 1);

    // Remove tab element
    var tabEl = Rga.$('.tab[data-tab-id="' + tabId + '"]');
    if (tabEl) tabEl.remove();

    // If we closed the active tab, switch to nearest
    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        var newIndex = Math.min(index, this.tabs.length - 1);
        this.switchTo(this.tabs[newIndex].id);
      } else {
        // No tabs left — create a new one
        this.create('Untitled.rga', 'rga');
      }
    }
  },

  /**
   * Mark a tab as dirty (unsaved changes).
   */
  setDirty: function(tabId, isDirty) {
    var tab = this._getTab(tabId);
    if (!tab) return;
    tab.isDirty = isDirty;

    var tabEl = Rga.$('.tab[data-tab-id="' + tabId + '"]');
    if (!tabEl) return;
    var dirtyDot = Rga.$('.tab-dirty', tabEl);
    if (dirtyDot) dirtyDot.hidden = !isDirty;
  },

  /* ---- Internal methods ---- */

  _getTab: function(tabId) {
    return this.tabs.find(function(t) { return t.id === tabId; }) || null;
  },

  _renderTab: function(tab) {
    var tabBar = Rga.$('#tab-bar');
    var newBtn = Rga.$('#tab-new');

    var tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.dataset.tabId = tab.id;

    // Icon
    var iconEl = document.createElement('span');
    iconEl.className = 'tab-icon';
    var iconMap = { rga: 'fileRga', txt: 'fileTxt', md: 'fileMd' };
    iconEl.innerHTML = Rga.Icons[iconMap[tab.fileType] || 'fileTxt'] || '';
    tabEl.appendChild(iconEl);

    // Title
    var titleEl = document.createElement('span');
    titleEl.className = 'tab-title';
    titleEl.textContent = tab.title;
    tabEl.appendChild(titleEl);

    // Dirty indicator
    var dirtyEl = document.createElement('span');
    dirtyEl.className = 'tab-dirty';
    dirtyEl.textContent = '\u25CF'; // ●
    dirtyEl.hidden = !tab.isDirty;
    tabEl.appendChild(dirtyEl);

    // Close button
    var closeEl = document.createElement('button');
    closeEl.className = 'tab-close';
    closeEl.title = 'Close';
    closeEl.innerHTML = Rga.Icons.close;
    tabEl.appendChild(closeEl);

    // Events
    var self = this;
    tabEl.addEventListener('click', function(e) {
      if (!e.target.closest('.tab-close')) {
        self.switchTo(tab.id);
      }
    });
    closeEl.addEventListener('click', function(e) {
      e.stopPropagation();
      self.close(tab.id);
    });

    tabBar.insertBefore(tabEl, newBtn);
  },

  _saveCurrentState: function() {
    var tab = this._getTab(this.activeTabId);
    if (!tab) return;
    var editor = Rga.$('#editor');
    var container = Rga.$('#editor-container');
    if (editor) tab.editorHTML = editor.innerHTML;
    if (container) tab.scrollPosition = container.scrollTop;
  },

  _loadState: function(tab) {
    var editor = Rga.$('#editor');
    var container = Rga.$('#editor-container');
    if (editor) editor.innerHTML = tab.editorHTML;
    if (container) container.scrollTop = tab.scrollPosition;
  }
};

/* ============================================================
   KEYBOARD SHORTCUT MANAGER
   ============================================================ */
Rga.Keyboard = {
  _shortcuts: {},

  init: function() {
    var self = this;
    document.addEventListener('keydown', function(e) {
      self._handle(e);
    });
  },

  /**
   * Register a keyboard shortcut.
   * @param {string} key - e.g. 'p', 's', 'b'
   * @param {object} mods - { ctrl: bool, shift: bool, alt: bool }
   * @param {Function} action
   */
  register: function(key, mods, action) {
    var id = this._makeId(key, mods);
    this._shortcuts[id] = action;
  },

  _makeId: function(key, mods) {
    return (mods.ctrl ? 'C' : '') +
           (mods.shift ? 'S' : '') +
           (mods.alt ? 'A' : '') +
           key.toUpperCase();
  },

  _handle: function(e) {
    if (e.defaultPrevented) return;
    var id = this._makeId(e.key, {
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey
    });
    var action = this._shortcuts[id];
    if (action) {
      e.preventDefault();
      action();
    }
  }
};

/* ============================================================
   STATUS BAR — removed in Slice 2.
   Compatibility Inventory entry #1 RESOLVED. Rga.Shell.StatusBar
   (renderer/js/shell/status-bar.js) populates #status-bar from
   Rga.ScriptSession; segment list per slice-2 plan §3.4.
   ============================================================ */

/* ============================================================
   COMMAND PALETTE
   ============================================================ */
Rga.CommandPalette = {
  _commands: [],
  _isOpen: false,
  _activeIndex: 0,

  init: function() {
    // Build will register commands after all modules are loaded
  },

  /**
   * Register a command.
   * @param {object} cmd - { label, shortcut?, category?, action }
   */
  register: function(cmd) {
    this._commands.push(cmd);
  },

  open: function() {
    var paletteEl = Rga.$('#command-palette');
    if (!paletteEl) return;

    paletteEl.hidden = false;
    this._isOpen = true;
    this._activeIndex = 0;

    var input = Rga.$('.palette-input', paletteEl);
    if (input) {
      input.value = '';
      input.focus();
    }

    this._renderResults('');
    this._bindEvents();
  },

  close: function() {
    var paletteEl = Rga.$('#command-palette');
    if (!paletteEl) return;

    paletteEl.hidden = true;
    this._isOpen = false;
    this._unbindEvents();

    // Return focus to editor
    var editor = Rga.$('#editor');
    if (editor) editor.focus();
  },

  _renderResults: function(query) {
    var results = Rga.$('.palette-results');
    if (!results) return;

    var filtered;
    if (!query) {
      filtered = this._commands.slice(0, 20);
    } else {
      filtered = this._commands
        .map(function(cmd) {
          var score = Rga.CommandPalette._fuzzyMatch(query, cmd.label);
          return { cmd: cmd, score: score };
        })
        .filter(function(item) { return item.score >= 0; })
        .sort(function(a, b) { return b.score - a.score; })
        .slice(0, 15)
        .map(function(item) { return item.cmd; });
    }

    results.innerHTML = '';
    if (filtered.length === 0) {
      results.innerHTML = '<div class="palette-empty">No matching commands</div>';
      return;
    }

    var self = this;
    filtered.forEach(function(cmd, index) {
      var item = document.createElement('div');
      item.className = 'palette-item' + (index === self._activeIndex ? ' active' : '');
      item.dataset.index = index;

      var label = document.createElement('span');
      label.className = 'palette-label';
      label.textContent = cmd.label;
      item.appendChild(label);

      if (cmd.shortcut) {
        var shortcut = document.createElement('span');
        shortcut.className = 'palette-shortcut';
        shortcut.textContent = cmd.shortcut;
        item.appendChild(shortcut);
      }

      if (cmd.category) {
        var cat = document.createElement('span');
        cat.className = 'palette-category';
        cat.textContent = cmd.category;
        item.appendChild(cat);
      }

      item.addEventListener('click', function() {
        self.close();
        cmd.action();
      });

      results.appendChild(item);
    });
  },

  _fuzzyMatch: function(query, text) {
    var lq = query.toLowerCase();
    var lt = text.toLowerCase();
    var qi = 0;
    var score = 0;
    var consecutive = 0;

    for (var ti = 0; ti < lt.length && qi < lq.length; ti++) {
      if (lt[ti] === lq[qi]) {
        qi++;
        consecutive++;
        score += consecutive * 2;
        if (ti === 0 || lt[ti - 1] === ' ') score += 5;
      } else {
        consecutive = 0;
      }
    }

    return qi === lq.length ? score : -1;
  },

  _onKeydown: null,
  _onInput: null,
  _onBackdropClick: null,

  _bindEvents: function() {
    var self = this;
    var paletteEl = Rga.$('#command-palette');
    var input = Rga.$('.palette-input', paletteEl);
    var results = Rga.$('.palette-results', paletteEl);

    this._onInput = function() {
      self._activeIndex = 0;
      self._renderResults(input.value);
    };

    this._onKeydown = function(e) {
      var items = Rga.$$('.palette-item', results);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        self._activeIndex = Math.min(self._activeIndex + 1, items.length - 1);
        self._highlightActive(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        self._activeIndex = Math.max(self._activeIndex - 1, 0);
        self._highlightActive(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var active = items[self._activeIndex];
        if (active) active.click();
      } else if (e.key === 'Escape') {
        self.close();
      }
    };

    this._onBackdropClick = function(e) {
      if (e.target.classList.contains('palette-backdrop')) {
        self.close();
      }
    };

    input.addEventListener('input', this._onInput);
    paletteEl.addEventListener('keydown', this._onKeydown);
    paletteEl.addEventListener('click', this._onBackdropClick);
  },

  _unbindEvents: function() {
    var paletteEl = Rga.$('#command-palette');
    var input = Rga.$('.palette-input', paletteEl);
    if (input && this._onInput) input.removeEventListener('input', this._onInput);
    if (paletteEl && this._onKeydown) paletteEl.removeEventListener('keydown', this._onKeydown);
    if (paletteEl && this._onBackdropClick) paletteEl.removeEventListener('click', this._onBackdropClick);
  },

  _highlightActive: function(items) {
    items.forEach(function(item, i) {
      item.classList.toggle('active', i === Rga.CommandPalette._activeIndex);
    });
  }
};

/* ============================================================
   MODAL UTILITY
   ============================================================ */
Rga.Modal = {
  showUnsaved: function(filename) {
    return new Promise(function(resolve) {
      var el = document.getElementById('unsaved-modal');
      if (!el) { resolve('discard'); return; }
      var msgEl = document.getElementById('unsaved-modal-msg');
      if (msgEl) msgEl.textContent = '"' + filename + '" has unsaved changes.';
      el.hidden = false;
      function onBtnClick(e) {
        var btn = e.target.closest('[data-choice]');
        if (!btn) return;
        el.hidden = true;
        el.removeEventListener('click', onBtnClick);
        resolve(btn.dataset.choice);
      }
      el.addEventListener('click', onBtnClick);
    });
  }
};

/* ============================================================
   BOTTOM PANEL MANAGER
   ============================================================ */
// V1.1 fix 6 (Bottom panel reopen): visibility state now lives in
// Rga.Shell.Layout.studioPanel.visible. The DOM class is a SIDE EFFECT
// of that state (applied by _syncDomFromLayout below) rather than the
// source of truth. This means any caller — close button, keyboard
// shortcut, future menu action, command palette, layout restore —
// hits one entry point (Rga.Shell.Layout.set) and the DOM follows.
// The earlier DOM-only classList.toggle was unreversible whenever the
// keyboard shortcut never reached the handler (Electron/Chromium
// shadowing Ctrl+J), leaving the panel stuck closed.
Rga.BottomPanel = {
  activeTab: 'scene',

  init: function() {
    var self = this;

    // Tab switching
    Rga.$$('.bp-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        self.switchTo(tab.dataset.bpTab);
      });
    });

    // Close button — flips Layout, which then updates the DOM.
    var closeBtn = Rga.$('#btn-close-bottom-panel');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        self.toggleCollapse();
      });
    }

    // Ctrl+J toggles the panel (keep for back-compat with VS Code
    // muscle memory). Ctrl+` is registered separately by the shell
    // keyboard wiring (shell/index.js) because Electron/Chromium can
    // shadow Ctrl+J in some build configurations.
    Rga.Keyboard.register('j', { ctrl: true, shift: false, alt: false }, function() {
      self.toggleCollapse();
    });

    // Initial Layout sync — order:
    //   1. Read persisted visibility from localStorage (if set on a
    //      prior session). Persistence is Runtime-Ownership-Slice-1
    //      scope — full workspace persistence is Slice 4 territory.
    //   2. If no persisted value, fall back to the DOM-as-shipped
    //      state (legacy default: open) so reload behaviour is
    //      unchanged for first-time users.
    //   3. Write the resolved value to Layout (SSOT) and let the
    //      subscriber paint the DOM.
    // Save on every Layout.studioPanel.visible change so a reload
    // restores the panel state the user last left.
    if (Rga.Shell && Rga.Shell.Layout) {
      var persisted = self._readPersistedVisibility();
      var col = Rga.$('#center-column');
      var domOpen = !(col && col.classList.contains('bottom-collapsed'));
      var initialVisible = persisted == null ? domOpen : persisted;
      Rga.Shell.Layout.set({ studioPanel: { visible: initialVisible } });
      // Explicit DOM sync after init: Layout.set is a no-op (no
      // subscriber notify) when the value matches Layout's default
      // (false). When persisted=false and Layout's default is false,
      // the subscriber would never fire and the DOM (which may have
      // started open from the legacy HTML default) would be left
      // out of sync. Force-sync once on init to bridge that gap.
      self._syncDomFromLayout(initialVisible);
      Rga.Shell.Layout.subscribe(function(next, prev) {
        if (!next || !next.studioPanel) return;
        if (prev && prev.studioPanel && prev.studioPanel.visible === next.studioPanel.visible) return;
        self._syncDomFromLayout(next.studioPanel.visible);
        self._writePersistedVisibility(next.studioPanel.visible);
      });
    }
  },

  open: function() {
    if (Rga.Shell && Rga.Shell.Layout) {
      Rga.Shell.Layout.set({ studioPanel: { visible: true } });
    } else {
      this._syncDomFromLayout(true);
    }
  },

  switchTo: function(tabName) {
    this.open();
    this.activeTab = tabName;

    Rga.$$('.bp-tab').forEach(function(tab) {
      tab.classList.toggle('active', tab.dataset.bpTab === tabName);
    });

    Rga.$$('.bp-content').forEach(function(content) {
      content.classList.toggle('active', content.dataset.bpTab === tabName);
    });
  },

  toggleCollapse: function() {
    if (Rga.Shell && Rga.Shell.Layout) {
      var current = Rga.Shell.Layout.get().studioPanel.visible;
      Rga.Shell.Layout.set({ studioPanel: { visible: !current } });
    } else {
      // Fallback (early-boot / test contexts where Layout absent).
      var col = Rga.$('#center-column');
      if (col) col.classList.toggle('bottom-collapsed');
    }
  },

  _syncDomFromLayout: function(visible) {
    var col = Rga.$('#center-column');
    if (!col) return;
    if (visible) col.classList.remove('bottom-collapsed');
    else         col.classList.add('bottom-collapsed');
  },

  // Persistence — scoped to the studio panel only. Slice 4 will own
  // full workspace persistence; this is the minimal slice needed for
  // the user-facing reload-survives-state acceptance.
  _STORAGE_KEY: 'rga-shell-studio-panel-visible',
  _readPersistedVisibility: function() {
    try {
      var raw = localStorage.getItem(this._STORAGE_KEY);
      if (raw === '0' || raw === 'false') return false;
      if (raw === '1' || raw === 'true')  return true;
      return null;
    } catch (_) { return null; }
  },
  _writePersistedVisibility: function(visible) {
    try { localStorage.setItem(this._STORAGE_KEY, visible ? '1' : '0'); }
    catch (_) { /* private mode / quota — silent. */ }
  }
};

/* ============================================================
   INSPECTOR MANAGER
   ============================================================ */
Rga.Inspector = {
  toggle: function() {
    Rga.$('#workspace').classList.toggle('inspector-hidden');
  }
};

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
Rga.Toast = {
  /**
   * Show a toast notification.
   * @param {string} message
   * @param {string} type - 'success', 'error', 'warning', 'info'
   * @param {number} duration - ms, default 3000
   */
  show: function(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;

    var container = Rga.$('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast';

    var iconEl = document.createElement('span');
    iconEl.className = 'toast-icon ' + type;
    var iconMap = { success: 'check', error: 'close', warning: 'warning', info: 'info' };
    iconEl.innerHTML = Rga.Icons[iconMap[type]] || '';
    toast.appendChild(iconEl);

    var msgEl = document.createElement('span');
    msgEl.className = 'toast-message';
    msgEl.textContent = message;
    toast.appendChild(msgEl);

    var closeEl = document.createElement('button');
    closeEl.className = 'toast-close';
    closeEl.innerHTML = Rga.Icons.close;
    closeEl.addEventListener('click', function() { dismiss(); });
    toast.appendChild(closeEl);

    container.appendChild(toast);

    var timer = setTimeout(dismiss, duration);

    function dismiss() {
      clearTimeout(timer);
      toast.classList.add('leaving');
      setTimeout(function() { toast.remove(); }, 200);
    }
  }
};

/* ============================================================
   FILE TREE — interactive folder expand/collapse + file select
   ============================================================ */
Rga.FileTree = {
  init: function() {
    var tree = Rga.$('#file-tree');
    if (!tree) return;

    tree.addEventListener('click', function(e) {
      var item = e.target.closest('.tree-item');
      if (!item) return;

      if (item.classList.contains('folder')) {
        // Toggle folder open/closed
        item.classList.toggle('open');
        var chevron = Rga.$('.tree-chevron', item);
        if (chevron) {
          chevron.innerHTML = item.classList.contains('open')
            ? Rga.Icons.chevronDown
            : Rga.Icons.chevronRight;
        }
        var icon = Rga.$('.tree-icon', item);
        if (icon) {
          icon.innerHTML = item.classList.contains('open')
            ? (Rga.Icons.folderOpen || Rga.Icons.folder)
            : Rga.Icons.folder;
        }

        // Toggle visibility of children (items with greater indent)
        var indent = parseInt(item.style.paddingLeft) || 0;
        var sibling = item.nextElementSibling;
        while (sibling && sibling.classList.contains('tree-item')) {
          var sibIndent = parseInt(sibling.style.paddingLeft) || 0;
          if (sibIndent <= indent) break;

          sibling.hidden = !item.classList.contains('open');
          sibling = sibling.nextElementSibling;
        }
      } else if (item.classList.contains('file')) {
        // Select file
        Rga.$$('.tree-item', tree).forEach(function(i) {
          i.classList.remove('active');
        });
        item.classList.add('active');

        // Get filename
        var label = Rga.$('.tree-label', item);
        var filename = label ? label.textContent : '';
        Rga.Toast.show('Opened: ' + filename, 'info', 1500);
      }
    });

    // Double-click to rename
    tree.addEventListener('dblclick', function(e) {
      var label = e.target.closest('.tree-label');
      if (!label) return;
      var item = label.closest('.tree-item');
      if (!item) return;

      var currentName = label.textContent;
      var input = document.createElement('input');
      input.type = 'text';
      input.value = currentName;
      input.style.cssText = 'width:100%;background:var(--bg-primary);border:1px solid var(--border-focus);' +
        'border-radius:2px;padding:1px 4px;font:inherit;color:inherit;outline:none;';

      label.textContent = '';
      label.appendChild(input);
      input.focus();
      input.select();

      function finish() {
        var newName = input.value.trim() || currentName;
        label.textContent = newName;
      }

      input.addEventListener('blur', finish);
      input.addEventListener('keydown', function(e2) {
        if (e2.key === 'Enter') { e2.preventDefault(); input.blur(); }
        if (e2.key === 'Escape') { input.value = currentName; input.blur(); }
      });
    });
  }
};

/* ============================================================
   SCENE ↔ BOTTOM PANEL CONNECTOR
   Tracks which scene the cursor is in and updates the Notes tab.
   ============================================================ */
Rga.SceneNotesConnector = {
  _currentSceneId: null,
  _notes: {}, // sceneId → note text

  init: function() {
    var self = this;

    // Listen for cursor movement (selectionchange) to detect scene changes
    document.addEventListener('selectionchange', Rga.debounce(function() {
      self._detectCurrentScene();
    }, 150));

    // Save notes when textarea changes
    var textarea = Rga.$('#notes-textarea');
    if (textarea) {
      textarea.addEventListener('input', Rga.debounce(function() {
        if (self._currentSceneId) {
          self._notes[self._currentSceneId] = textarea.value;
          // Also update scene model if SceneManager has the scene
          if (Rga.SceneManager && Rga.SceneManager.scenes) {
            var scene = Rga.SceneManager.scenes.get(self._currentSceneId);
            if (scene) scene.notes = textarea.value;
          }
        }
      }, 300));
    }
  },

  _detectCurrentScene: function() {
    var editor = Rga.$('#editor');
    if (!editor) return;

    // Find the scene header above the current cursor position
    var block = Rga.Cursor.getCurrentBlock();
    if (!block) return;

    var sceneId = null;
    var sceneName = '';
    var el = block;

    // Walk backwards to find the scene header
    while (el) {
      if (el.dataset && el.dataset.blockType === 'scene-header' && el.dataset.sceneId) {
        sceneId = el.dataset.sceneId;
        var numEl = Rga.$('.sh-number', el);
        var locEl = Rga.$('.sh-location', el);
        sceneName = (numEl ? numEl.textContent : '') +
          (locEl && locEl.value ? ' — ' + locEl.value : '');
        break;
      }
      el = el.previousElementSibling;
    }

    // If scene changed, update the bottom panel
    if (sceneId !== this._currentSceneId) {
      this._currentSceneId = sceneId;
      this._updateNotesPanel(sceneId, sceneName);
      this._updateProblemsForScene(sceneId);

      // Highlight in sidebar
      Rga.$$('.scene-item').forEach(function(item) {
        item.classList.toggle('active', item.dataset.sceneId === sceneId);
      });
    }
  },

  _updateNotesPanel: function(sceneId, sceneName) {
    var label = Rga.$('#notes-scene-label');
    var textarea = Rga.$('#notes-textarea');

    if (label) {
      label.textContent = sceneId
        ? 'Notes — Scene ' + sceneName
        : 'Notes — No scene selected';
    }

    if (textarea) {
      if (sceneId) {
        textarea.disabled = false;
        textarea.value = this._notes[sceneId] || '';
        textarea.placeholder = 'Add notes for Scene ' + sceneName + '...';
      } else {
        textarea.disabled = true;
        textarea.value = '';
        textarea.placeholder = 'Select a scene to add notes...';
      }
    }
  },

  _updateProblemsForScene: function(sceneId) {
    // Highlight problems for the current scene
    Rga.$$('.problem-item').forEach(function(item) {
      // Subtle highlight — the Problems panel already works globally,
      // this just adds emphasis to current-scene problems
      item.style.opacity = '1';
    });
  },

  /**
   * Load notes from scene data (called when loading a file).
   */
  loadFromScenes: function() {
    var self = this;
    if (!Rga.SceneManager || !Rga.SceneManager.scenes) return;
    Rga.SceneManager.scenes.forEach(function(scene, sceneId) {
      if (scene.notes) self._notes[sceneId] = scene.notes;
    });
  }
};

/* ============================================================
   SCRIPT LANGUAGE MANAGER
   Handles the writing language/direction of the script content.
   This is separate from UI i18n — it controls the editor surface
   direction + font, not the application menus.
   ============================================================ */
Rga.ScriptLanguage = {
  /** Available script languages */
  LANGUAGES: {
    en:  { label: 'English',        code: 'EN',  dir: 'ltr', font: 'var(--font-editor)' },
    ku:  { label: 'Kurdish (Sorani)', code: 'KU', dir: 'rtl', font: 'var(--font-editor-rtl)' },
    ar:  { label: 'Arabic',         code: 'AR',  dir: 'rtl', font: 'var(--font-editor-rtl)' },
    fa:  { label: 'Persian',        code: 'FA',  dir: 'rtl', font: 'var(--font-editor-rtl)' }
  },

  current: 'en',

  init: function() {
    var saved = localStorage.getItem('rga-script-lang') || 'en';
    this.apply(saved);
    this._bindStatusBarButton();
  },

  /**
   * Apply a script language to the editor surface.
   * @param {string} langKey - 'en', 'ku', 'ar', 'fa'
   */
  apply: function(langKey) {
    var lang = this.LANGUAGES[langKey];
    if (!lang) langKey = 'en', lang = this.LANGUAGES.en;

    this.current = langKey;
    localStorage.setItem('rga-script-lang', langKey);

    var editor = Rga.$('#editor');
    if (editor) {
      editor.setAttribute('dir', lang.dir);
      editor.style.fontFamily = lang.font;
      editor.setAttribute('lang', langKey);
    }

    // Update gutter position for RTL
    var container = Rga.$('#editor-container');
    if (container) {
      if (lang.dir === 'rtl') {
        container.style.direction = 'rtl';
      } else {
        container.style.direction = 'ltr';
      }
    }

    // Update scene header inputs direction
    Rga.$$('.sh-location').forEach(function(input) {
      input.dir = lang.dir;
    });

    // Update status bar
    var langBtn = Rga.$('#status-language');
    if (langBtn) {
      langBtn.textContent = lang.code;
      langBtn.title = 'Script Language: ' + lang.label + ' (' + lang.dir.toUpperCase() + ')';
    }
  },

  /**
   * Show a language picker (small menu from status bar).
   */
  showPicker: function() {
    var self = this;
    var btn = Rga.$('#status-language');
    if (!btn) return;

    var rect = btn.getBoundingClientRect();
    var items = Object.keys(this.LANGUAGES).map(function(key) {
      var lang = self.LANGUAGES[key];
      var isCurrent = key === self.current;
      return {
        label: lang.label + ' (' + lang.dir.toUpperCase() + ')' + (isCurrent ? ' ✓' : ''),
        action: function() {
          self.apply(key);
          Rga.Toast.show('Script language: ' + lang.label, 'info', 1500);
        }
      };
    });

    Rga.ContextMenu.show(items, rect.left, rect.top - (items.length * 32) - 8);
  },

  _bindStatusBarButton: function() {
    var self = this;
    var langBtn = Rga.$('#status-language');
    if (langBtn) {
      langBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        self.showPicker();
      });
    }
  }
};
