// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
/* ============================================================
   RWANGA SCRIPT EDITOR — problems.js
   Validation engine: scans editor blocks for formatting issues,
   renders the Problems tab in the bottom panel.
   Depends on: utils.js, editor-engine.js
   ============================================================ */

window.Rga = window.Rga || {};

Rga.Problems = {
  /** @type {Array<{ severity, message, blockIndex, blockEl }>} */
  _problems: [],

  init: function() {
    // Initial run after editor is populated
    this.run();
  },

  /**
   * Run the full validation pass. Debounced call from editor input events.
   */
  run: function() {
    var editor = Rga.$('#editor');
    if (!editor) return;

    this._problems = [];
    var blocks = Rga.$$('.editor-block', editor);
    var self = this;

    blocks.forEach(function(block, index) {
      var text = block.textContent || '';
      var type = block.dataset.blockType;

      // ---- Rule 1: Shift+Enter line breaks (<br> inside a block) ----
      if (block.querySelector('br')) {
        self._add('warning',
          'Line break within block. Use Enter to create a new screenplay element.',
          index, block);
      }

      // ---- Rule 2: Scene header text in a non-header block ----
      if (type !== 'scene-header' && /^#\d+\s*[\-\u2014]/.test(text.trim())) {
        self._add('error',
          'Looks like a scene header but formatted as ' +
          Rga.formatBlockTypeName(type) +
          '. Use Tab to change block type.',
          index, block);
      }

      // ---- Rule 3: Empty scene (header followed by another header) ----
      if (type === 'scene-header') {
        var next = block.nextElementSibling;
        if (next && next.dataset.blockType === 'scene-header') {
          self._add('warning',
            'Empty scene \u2014 no content between scene headers.',
            index, block);
        }
      }

      // ---- Rule 4: Dialogue without a preceding character ----
      if (type === 'dialogue') {
        var prev = block.previousElementSibling;
        if (prev &&
            prev.dataset.blockType !== 'character' &&
            prev.dataset.blockType !== 'parenthetical') {
          self._add('warning',
            'Dialogue block without a preceding character name.',
            index, block);
        }
      }

      // ---- Rule 5: Parenthetical without adjacent dialogue/character ----
      if (type === 'parenthetical') {
        var prevP = block.previousElementSibling;
        var nextP = block.nextElementSibling;
        var prevOk = prevP && (prevP.dataset.blockType === 'character' || prevP.dataset.blockType === 'dialogue');
        var nextOk = nextP && nextP.dataset.blockType === 'dialogue';
        if (!prevOk && !nextOk) {
          self._add('info',
            'Parenthetical is typically placed between a character name and dialogue.',
            index, block);
        }
      }

      // ---- Rule 6: ALL CAPS text in action block (possible untagged character) ----
      if (type === 'action' && text.trim().length > 0) {
        var capsWords = text.match(/\b[A-Z]{2,}(?:\s+[A-Z]{2,})*\b/g);
        if (capsWords) {
          // Filter out common non-character caps words
          var ignore = ['INT', 'EXT', 'CUT', 'FADE', 'THE', 'AND', 'SFX', 'VFX', 'POV'];
          capsWords = capsWords.filter(function(w) {
            return w.length > 2 && ignore.indexOf(w) === -1;
          });
          // Check if any of these are untagged (not wrapped in .tag-highlight)
          capsWords.forEach(function(word) {
            var tagged = Rga.$$('.tag-highlight', block).some(function(hl) {
              return hl.textContent.trim().toUpperCase() === word;
            });
            if (!tagged) {
              self._add('info',
                '"' + word + '" may be a character or entity \u2014 consider tagging it.',
                index, block);
            }
          });
        }
      }

      // ---- Rule 7: Very long block (potential pasted content) ----
      if (text.length > 800 && type === 'action') {
        self._add('info',
          'This action block is very long (' + text.length + ' chars). Consider splitting into shorter blocks.',
          index, block);
      }

      // ---- Rule 8: Transition not uppercase ----
      if (type === 'transition' && text.trim() && text.trim() !== text.trim().toUpperCase()) {
        self._add('info',
          'Transitions are typically ALL CAPS (e.g. CUT TO:, FADE OUT).',
          index, block);
      }
    });

    this._render();
    this._updateBadge();
  },

  /**
   * Add a problem from outside (e.g. editor-engine Shift+Enter detection).
   * @param {HTMLElement} block
   * @param {string} message
   */
  addInline: function(block, message) {
    var editor = Rga.$('#editor');
    if (!editor || !block) return;
    var blocks = Rga.$$('.editor-block', editor);
    var index = blocks.indexOf(block);
    this._add('warning', message, index >= 0 ? index : 0, block);
    this._render();
    this._updateBadge();
  },

  /* ---- Internal ---- */

  _add: function(severity, message, blockIndex, blockEl) {
    this._problems.push({
      severity: severity,
      message: message,
      blockIndex: blockIndex,
      blockEl: blockEl
    });
  },

  /**
   * Render the problems list into the bottom panel.
   */
  _render: function() {
    var list = Rga.$('.problems-list');
    if (!list) return;

    list.innerHTML = '';

    if (this._problems.length === 0) {
      list.innerHTML = '<div style="padding:12px;color:var(--text-tertiary);font-size:12px;">No problems detected.</div>';
      return;
    }

    // Sort: errors first, then warnings, then info
    var order = { error: 0, warning: 1, info: 2 };
    this._problems.sort(function(a, b) {
      return (order[a.severity] || 9) - (order[b.severity] || 9);
    });

    this._problems.forEach(function(problem) {
      var item = document.createElement('div');
      item.className = 'problem-item';

      var sev = document.createElement('div');
      sev.className = 'problem-severity ' + problem.severity;
      item.appendChild(sev);

      var textDiv = document.createElement('div');
      textDiv.className = 'problem-text';

      var msg = document.createElement('div');
      msg.className = 'problem-message';
      msg.textContent = problem.message;
      textDiv.appendChild(msg);

      // Determine scene context
      var sceneLabel = 'Line ' + (problem.blockIndex + 1);
      if (problem.blockEl) {
        var search = problem.blockEl;
        while (search) {
          if (search.dataset && search.dataset.blockType === 'scene-header') {
            var numEl = Rga.$('.sh-number', search);
            if (numEl) sceneLabel = 'Scene ' + numEl.textContent;
            break;
          }
          search = search.previousElementSibling;
        }
      }

      var loc = document.createElement('div');
      loc.className = 'problem-location';
      loc.textContent = sceneLabel;
      textDiv.appendChild(loc);

      item.appendChild(textDiv);

      // Click to navigate to the block
      item.addEventListener('click', function() {
        if (!problem.blockEl) return;
        var container = Rga.$('#editor-container');
        if (container) {
          var containerRect = container.getBoundingClientRect();
          var blockRect = problem.blockEl.getBoundingClientRect();
          var offset = blockRect.top - containerRect.top + container.scrollTop - 40;
          container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
        }
        // Highlight the block briefly
        problem.blockEl.classList.add('active-block');
        setTimeout(function() {
          problem.blockEl.classList.remove('active-block');
        }, 2000);
      });

      list.appendChild(item);
    });
  },

  _updateBadge: function() {
    var badge = Rga.$('.problems-badge');
    if (!badge) return;

    var errorCount = this._problems.filter(function(p) { return p.severity === 'error'; }).length;
    var warnCount = this._problems.filter(function(p) { return p.severity === 'warning'; }).length;
    var total = errorCount + warnCount;

    if (total > 0) {
      badge.textContent = total;
      badge.hidden = false;
      badge.className = 'badge ' + (errorCount > 0 ? 'error' : 'warning');
    } else {
      badge.hidden = true;
    }
  },

  /**
   * Get current problem count by severity.
   */
  getCounts: function() {
    var counts = { error: 0, warning: 0, info: 0 };
    this._problems.forEach(function(p) {
      if (counts[p.severity] !== undefined) counts[p.severity]++;
    });
    return counts;
  }
};
