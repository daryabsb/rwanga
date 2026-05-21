// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.ScriptLanguage — per-app writing language for the editor surface.
//
// Extracted from app-shell.js in Runtime Ownership Stab. Slice 8 §A.
// Owns the localStorage key `rga-script-lang` (per the storage-
// ownership registry). Single consumer outside its own definition:
// renderer/index.html init script (calls init()). No engine consumers.
//
// Separate from UI i18n. As of RTL Recovery Slice A this no longer owns
// the editor surface direction or font — those are document-owned
// (screenplayProfile.direction → TabManager.applyDocumentDirection; the
// dir=rtl CSS owns the RTL font). ScriptLanguage now carries only the
// UI writing-language label (the `lang` attribute + status-bar button).
//
// Storage-ownership note: the G4 drift guard now expects this file as
// the owner of `rga-script-lang` writes; the guard's STORAGE_OWNERS
// registry is updated alongside this extraction.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  Rga.ScriptLanguage = {
    LANGUAGES: {
      en: { label: 'English',          code: 'EN', dir: 'ltr', font: 'var(--font-editor)' },
      ku: { label: 'Kurdish (Sorani)', code: 'KU', dir: 'rtl', font: 'var(--font-editor-rtl)' },
      ar: { label: 'Arabic',           code: 'AR', dir: 'rtl', font: 'var(--font-editor-rtl)' },
      fa: { label: 'Persian',          code: 'FA', dir: 'rtl', font: 'var(--font-editor-rtl)' }
    },

    current: 'en',

    init: function() {
      var saved = null;
      try { saved = localStorage.getItem('rga-script-lang'); } catch (_) {}
      this.apply(saved || 'en');
      this._bindStatusBarButton();
    },

    apply: function(langKey) {
      var lang = this.LANGUAGES[langKey];
      if (!lang) { langKey = 'en'; lang = this.LANGUAGES.en; }

      this.current = langKey;
      try { localStorage.setItem('rga-script-lang', langKey); } catch (_) {}

      // RTL Recovery Slice A — #editor direction and the RTL font are owned
      // by the DOCUMENT (TabManager.applyDocumentDirection reads
      // screenplayProfile.direction; the dir=rtl CSS resolves the font).
      // ScriptLanguage keeps only the UI-language concerns: the `lang`
      // attribute and the status-bar language button.
      var editor = Rga.$('#editor');
      if (editor) {
        editor.setAttribute('lang', langKey);
      }
      var container = Rga.$('#editor-container');
      if (container) {
        container.style.direction = (lang.dir === 'rtl') ? 'rtl' : 'ltr';
      }
      Rga.$$('.sh-location').forEach(function(input) { input.dir = lang.dir; });

      var langBtn = Rga.$('#status-language');
      if (langBtn) {
        langBtn.textContent = lang.code;
        langBtn.title = 'Script Language: ' + lang.label + ' (' + lang.dir.toUpperCase() + ')';
      }
    },

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
            if (Rga.Toast && typeof Rga.Toast.show === 'function') {
              Rga.Toast.show('Script language: ' + lang.label, 'info', 1500);
            }
          }
        };
      });
      if (Rga.ContextMenu && typeof Rga.ContextMenu.show === 'function') {
        Rga.ContextMenu.show(items, rect.left, rect.top - (items.length * 32) - 8);
      }
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
})();
