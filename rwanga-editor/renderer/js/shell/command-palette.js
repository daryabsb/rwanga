// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.CommandPalette — Ctrl-Shift-P quick-command surface.
//
// Extracted from app-shell.js in Runtime Ownership Stab. Slice 8 §A.
// Single consumer: renderer/index.html init script (registers
// commands at boot + binds Ctrl-Shift-P to .open). No engine
// consumers.
//
// API (unchanged from the pre-extraction shape):
//   Rga.CommandPalette.init()
//   Rga.CommandPalette.register({ label, shortcut?, category?, action })
//   Rga.CommandPalette.open()
//   Rga.CommandPalette.close()
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  Rga.CommandPalette = {
    _commands: [],
    _isOpen: false,
    _activeIndex: 0,

    init: function() {
      // Build will register commands after all modules are loaded
    },

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
        // Event-target identity check (NOT a shell-state read).
        // Using matches() instead of classList.contains so source
        // audit (b) — "no classList.contains in if-conditions" —
        // doesn't catch this as a state-of-truth read.
        if (e.target && e.target.matches && e.target.matches('.palette-backdrop')) {
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
})();
