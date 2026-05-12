// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
/* ============================================================
   RWANGA SCRIPT EDITOR — editor-engine.js
   ContentEditable management: block creation, Tab cycling,
   context-aware Enter, paste sanitization, MutationObserver
   hygiene, gutter sync, active block tracking.
   Depends on: utils.js
   ============================================================ */

window.Rga = window.Rga || {};

/* ============================================================
   CONSTANTS
   ============================================================ */
Rga.BLOCK_TYPES = [
  'scene-header', 'action', 'character', 'dialogue',
  'parenthetical', 'transition', 'shot'
];

/**
 * Map: after pressing Enter on a block of type X,
 * the new block defaults to type Y.
 */
Rga.ENTER_NEXT_MAP = {
  'scene-header': 'action',
  'action':       'action',     // but if text was ALL CAPS → dialogue (see logic)
  'character':    'dialogue',
  'dialogue':     'action',
  'parenthetical':'dialogue',
  'transition':   'scene-header',
  'shot':         'action'
};

/* ============================================================
   EDITOR ENGINE
   ============================================================ */
Rga.Editor = {
  /** @type {HTMLElement} */
  el: null,
  /** @type {HTMLElement} */
  containerEl: null,
  /** @type {HTMLElement} */
  gutterEl: null,
  /** @type {MutationObserver} */
  _observer: null,

  /**
   * Initialize the editor engine.
   * Call once after DOM is ready.
   */
  init: function() {
    this.el = Rga.$('#editor');
    this.containerEl = Rga.$('#editor-container');
    this.gutterEl = Rga.$('#gutter');

    if (!this.el) {
      console.error('[Rga.Editor] #editor not found');
      return;
    }

    this._bindKeydown();
    this._bindPaste();
    this._bindSelectionChange();
    this._bindScrollSync();
    this._startObserver();
    this._bindInput();

    // Ensure there's at least one block
    if (this.el.children.length === 0) {
      this.createBlock('action', '');
    }
  },

  /* ============================================================
     BLOCK CREATION
     ============================================================ */

  /**
   * Create a new editor block element.
   * @param {string} type - block type key
   * @param {string} [text] - initial text content
   * @returns {HTMLElement}
   */
  createBlock: function(type, text) {
    var block = document.createElement('div');
    block.className = 'editor-block';
    block.dataset.blockType = type || 'action';
    block.dataset.id = Rga.generateId('el');

    // Placeholder attribute (CSS ::before reads this)
    block.dataset.placeholder = this._getPlaceholder(type);

    if (text) {
      block.textContent = text;
    }

    return block;
  },

  /**
   * Insert a new block after a reference block (or at end of editor).
   * @param {string} type
   * @param {string} [text]
   * @param {HTMLElement} [afterBlock] - insert after this. If null, appends to editor.
   * @returns {HTMLElement}
   */
  insertBlock: function(type, text, afterBlock) {
    var block = this.createBlock(type, text);

    if (afterBlock && afterBlock.parentElement === this.el) {
      afterBlock.after(block);
    } else {
      this.el.appendChild(block);
    }

    this.updateGutter();
    return block;
  },

  /**
   * Change the block type of an existing block.
   * @param {HTMLElement} block
   * @param {string} newType
   */
  setBlockType: function(block, newType) {
    if (!block || !newType) return;
    var oldType = block.dataset.blockType;

    // Don't convert TO scene-header this way — use SceneManager instead
    if (newType === 'scene-header' && oldType !== 'scene-header') {
      // Delegate to SceneManager if available
      if (Rga.SceneManager && Rga.SceneManager.createHeader) {
        var text = block.textContent;
        block.remove();
        Rga.SceneManager.createHeader(null, block.previousElementSibling);
        this.updateGutter();
        return;
      }
    }

    // Don't convert FROM scene-header this way — special handling needed
    if (oldType === 'scene-header' && newType !== 'scene-header') {
      var location = Rga.$('.sh-location', block);
      var extractedText = location ? location.value : '';
      block.contentEditable = 'true';
      block.className = 'editor-block';
      block.dataset.blockType = newType;
      block.dataset.placeholder = this._getPlaceholder(newType);
      block.innerHTML = '';
      block.textContent = extractedText;
      delete block.dataset.sceneId;
      this.updateGutter();
      Rga.StatusBar.update();
      return;
    }

    block.dataset.blockType = newType;
    block.dataset.placeholder = this._getPlaceholder(newType);
    this._showBlockTypeChip(block, newType);
    Rga.StatusBar.update();
  },

  /* ============================================================
     KEYDOWN HANDLER (Tab, Enter, Backspace, Arrow keys)
     ============================================================ */

  _bindKeydown: function() {
    var self = this;
    this.el.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        self._onTab(e);
      } else if (e.key === 'Enter') {
        self._onEnter(e);
      } else if (e.key === 'Backspace') {
        self._onBackspace(e);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        self._onArrow(e);
      }
    });
  },

  /**
   * Tab: cycle block type forward. Shift+Tab: cycle backward.
   */
  _onTab: function(e) {
    e.preventDefault();
    var block = Rga.Cursor.getCurrentBlock();
    if (!block) return;

    var currentType = block.dataset.blockType;
    var idx = Rga.BLOCK_TYPES.indexOf(currentType);
    if (idx === -1) idx = 0;

    var direction = e.shiftKey ? -1 : 1;
    var nextIdx = (idx + direction + Rga.BLOCK_TYPES.length) % Rga.BLOCK_TYPES.length;
    var nextType = Rga.BLOCK_TYPES[nextIdx];

    this.setBlockType(block, nextType);
  },

  /**
   * Enter: create a new block with context-aware type.
   * Shift+Enter: allow line break but flag as problem.
   */
  _onEnter: function(e) {
    if (e.shiftKey) {
      // Allow default <br> but register a problem
      if (Rga.Problems) {
        var block = Rga.Cursor.getCurrentBlock();
        Rga.Problems.addInline(block, 'Shift+Enter used. Screenplay format requires Enter for new elements.');
      }
      return;
    }

    e.preventDefault();
    var block = Rga.Cursor.getCurrentBlock();
    if (!block) return;

    // Don't handle Enter inside scene-header (it's contenteditable=false)
    if (block.dataset.blockType === 'scene-header') {
      // Create action block after scene header
      var newBlock = this.insertBlock('action', '', block);
      Rga.Cursor.setToStart(newBlock);
      return;
    }

    var currentType = block.dataset.blockType;
    var split = Rga.Cursor.splitAtCursor(block);

    // Determine next block type
    var nextType = this._getNextBlockType(currentType, split.before);

    // Keep 'before' text in current block
    block.textContent = split.before;

    // Create new block with 'after' text
    var newBlock = this.insertBlock(nextType, split.after, block);
    Rga.Cursor.setToStart(newBlock);

    this._markDirty();
    Rga.StatusBar.update();
  },

  /**
   * Determine next block type based on current type and text content.
   */
  _getNextBlockType: function(currentType, text) {
    text = (text || '').trim();

    // Action block: if text is ALL CAPS and reasonably short, treat as character → dialogue
    if (currentType === 'action' && text.length > 0 && text.length < 40) {
      if (text === text.toUpperCase() && /^[A-Z\s.''-]+$/.test(text)) {
        return 'dialogue';
      }
    }

    return Rga.ENTER_NEXT_MAP[currentType] || 'action';
  },

  /**
   * Backspace at start of block: merge with previous block or change type.
   */
  _onBackspace: function(e) {
    var block = Rga.Cursor.getCurrentBlock();
    if (!block) return;

    // Only intercept if cursor is at the very start
    if (!Rga.Cursor.isAtStart(block)) return;

    // If block is not action, convert to action first
    if (block.dataset.blockType !== 'action') {
      e.preventDefault();
      this.setBlockType(block, 'action');
      return;
    }

    // If action block with content, merge with previous
    var prev = block.previousElementSibling;
    if (!prev) return; // first block, nothing to merge into
    if (prev.dataset.blockType === 'scene-header') return; // don't merge into scene header

    e.preventDefault();
    var prevText = prev.textContent;
    var currentText = block.textContent;

    // Remove current block
    block.remove();

    // Append text to previous block
    if (currentText) {
      // Set cursor to the join point
      var joinOffset = prevText.length;
      prev.textContent = prevText + currentText;

      // Position cursor at the join point
      if (prev.firstChild && prev.firstChild.nodeType === 3) {
        var range = document.createRange();
        var sel = window.getSelection();
        range.setStart(prev.firstChild, joinOffset);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      Rga.Cursor.setToEnd(prev);
    }

    this.updateGutter();
    this._markDirty();
  },

  /**
   * Arrow keys: skip over scene-header blocks (which are contenteditable=false).
   */
  _onArrow: function(e) {
    var block = Rga.Cursor.getCurrentBlock();
    if (!block) return;

    var isUp = e.key === 'ArrowUp';
    var target = isUp ? block.previousElementSibling : block.nextElementSibling;

    if (target && target.dataset.blockType === 'scene-header') {
      // Skip scene header — jump to the block on the other side
      var beyond = isUp ? target.previousElementSibling : target.nextElementSibling;
      if (beyond && beyond.dataset.blockType !== 'scene-header') {
        e.preventDefault();
        if (isUp) {
          Rga.Cursor.setToEnd(beyond);
        } else {
          Rga.Cursor.setToStart(beyond);
        }
      }
    }
  },

  /* ============================================================
     PASTE HANDLER — strip all formatting
     ============================================================ */

  _bindPaste: function() {
    var self = this;
    this.el.addEventListener('paste', function(e) {
      e.preventDefault();
      var text = e.clipboardData.getData('text/plain');
      if (!text) return;

      var lines = text.split('\n');
      var currentBlock = Rga.Cursor.getCurrentBlock();

      // First line: insert into current block at cursor
      document.execCommand('insertText', false, lines[0]);

      // Remaining lines: create new action blocks
      var lastBlock = currentBlock;
      for (var i = 1; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue; // skip empty lines
        var newBlock = self.insertBlock('action', line, lastBlock);
        lastBlock = newBlock;
      }

      if (lastBlock && lastBlock !== currentBlock) {
        Rga.Cursor.setToEnd(lastBlock);
      }

      self.updateGutter();
      self._markDirty();
    });
  },

  /* ============================================================
     SELECTION CHANGE — track active block
     ============================================================ */

  _bindSelectionChange: function() {
    var self = this;
    document.addEventListener('selectionchange', Rga.debounce(function() {
      self._updateActiveBlock();
      Rga.StatusBar.update();
    }, 50));
  },

  _updateActiveBlock: function() {
    // Remove previous active
    var prev = Rga.$('.editor-block.active-block', this.el);
    if (prev) prev.classList.remove('active-block');

    // Mark current
    var block = Rga.Cursor.getCurrentBlock();
    if (block) {
      block.classList.add('active-block');
    }
  },

  /* ============================================================
     MUTATION OBSERVER — enforce block structure
     ============================================================ */

  _startObserver: function() {
    var self = this;
    this._observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          // Wrap bare text nodes at top level
          if (node.nodeType === 3 && node.parentElement === self.el) {
            var wrapper = self.createBlock('action', node.textContent);
            node.replaceWith(wrapper);
          }

          // Flatten non-block elements (e.g. <span>, <font>, <b> from paste/browser quirks)
          if (node.nodeType === 1 && node.parentElement === self.el &&
              !node.classList.contains('editor-block') &&
              !node.classList.contains('scene-header')) {
            var text = node.textContent;
            var replacement = self.createBlock('action', text);
            node.replaceWith(replacement);
          }
        });
      });
    });

    this._observer.observe(this.el, {
      childList: true,
      subtree: false
    });
  },

  /* ============================================================
     INPUT — auto-save trigger, dirty marking
     ============================================================ */

  _bindInput: function() {
    var self = this;
    this.el.addEventListener('input', Rga.debounce(function() {
      self._markDirty();
      self.updateGutter();
      if (Rga.Problems) Rga.Problems.run();
    }, 300));
  },

  _markDirty: function() {
    if (Rga.Tabs && Rga.Tabs.activeTabId) {
      Rga.Tabs.setDirty(Rga.Tabs.activeTabId, true);
    }
  },

  /* ============================================================
     GUTTER (scene numbers)
     ============================================================ */

  updateGutter: function() {
    if (!this.gutterEl) return;
    this.gutterEl.innerHTML = '';

    var blocks = Rga.$$('.editor-block', this.el);
    var sceneNum = 0;

    blocks.forEach(function(block) {
      var line = document.createElement('div');
      line.className = 'gutter-line';
      // Match block height
      line.style.height = block.offsetHeight + 'px';

      if (block.dataset.blockType === 'scene-header') {
        sceneNum++;
        line.textContent = sceneNum;
        line.classList.add('gutter-scene-number');
      }

      Rga.Editor.gutterEl.appendChild(line);
    });
  },

  /**
   * Sync gutter scroll with editor scroll.
   */
  _bindScrollSync: function() {
    var self = this;
    if (!this.containerEl) return;

    this.containerEl.addEventListener('scroll', function() {
      if (self.gutterEl) {
        self.gutterEl.style.transform = 'translateY(-' + self.containerEl.scrollTop + 'px)';
      }
      // Also update active scene in sidebar
      if (Rga.SceneManager) {
        Rga.SceneManager.updateActiveInSidebar();
      }
    });
  },

  /* ============================================================
     BLOCK TYPE CHIP (visual feedback on Tab cycling)
     ============================================================ */

  _chipTimer: null,

  _showBlockTypeChip: function(block, type) {
    // Remove existing chip
    var existing = Rga.$('.block-type-chip', this.el);
    if (existing) existing.remove();
    clearTimeout(this._chipTimer);

    var chip = document.createElement('div');
    chip.className = 'block-type-chip visible';
    chip.textContent = Rga.formatBlockTypeName(type);
    block.appendChild(chip);

    var self = this;
    this._chipTimer = setTimeout(function() {
      chip.classList.remove('visible');
      setTimeout(function() { chip.remove(); }, 200);
    }, 1200);
  },

  /* ============================================================
     HELPERS
     ============================================================ */

  _getPlaceholder: function(type) {
    var map = {
      'action': 'Action...',
      'character': 'CHARACTER NAME',
      'dialogue': 'Dialogue...',
      'parenthetical': '(parenthetical)',
      'transition': 'CUT TO:',
      'shot': 'SHOT DESCRIPTION',
      'scene-header': ''
    };
    return map[type] || '';
  },

  /**
   * Get all blocks as an ordered array.
   * @returns {HTMLElement[]}
   */
  getBlocks: function() {
    return Rga.$$('.editor-block', this.el);
  },

  /**
   * Clear the editor completely.
   */
  clear: function() {
    this.el.innerHTML = '';
    this.updateGutter();
  }
};
