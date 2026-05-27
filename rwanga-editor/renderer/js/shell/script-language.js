// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Rga.ScriptLanguage — per-script writing-language facade.
//
// S12 (Settings Recovery — legacy paths cleanup): the canonical script-
// language choice now lives in the Settings Store under id
// `editor.scriptLanguage` (script tier — travels with the .rga file).
// Rga.ScriptLanguage is a thin facade:
//   - init()         binds the status-bar language button.
//   - apply(key)     deprecated entry point; routes through Store.set so
//                    the per-script applicator drives the DOM.
//   - _applyDom(key) PURE DOM mutation (no storage, no Store). Called by
//                    the editor.scriptLanguage applicator on every Store
//                    effective change. Safe to invoke from tests with no
//                    Store loaded.
//   - showPicker()   writes the user's choice through Store.set.
//
// As of RTL Recovery Slice A this module no longer owns the editor
// surface direction or font — those are document-owned
// (screenplayProfile.direction → TabManager.applyDocumentDirection; the
// dir=rtl CSS owns the RTL font). ScriptLanguage carries only the UI
// writing-language label (the `lang` attribute + status-bar button).
//
// Legacy `rga-script-lang` localStorage path: retired in S12. New
// scripts adopt the registry default ('en') until the user picks a
// different language; the pick is persisted to doc.settings via Store's
// script tier and travels with the .rga.
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
      // No legacy localStorage read. The editor.scriptLanguage applicator
      // (registered in editor-applicators.js) fires on Store.applyAll
      // with the effective value and drives _applyDom.
      this._bindStatusBarButton();
    },

    // Routes through Settings.Store so the script-tier write lands on
    // doc.settings.editor.scriptLanguage. The applicator drives the DOM.
    // Pre-Store / no-doc fallback applies the DOM directly so legacy
    // callers and early-boot tests still work.
    apply: function(langKey) {
      if (!this.LANGUAGES[langKey]) langKey = 'en';
      const Store = window.Rga && window.Rga.Settings && window.Rga.Settings.Store;
      if (Store && typeof Store.set === 'function') {
        const ok = Store.set('editor.scriptLanguage', langKey);
        if (ok) return;  // applicator handles DOM
      }
      this._applyDom(langKey);
    },

    // Pure DOM application. The editor.scriptLanguage applicator calls
    // this on every effective change (including tab switches via the
    // Store's editor.tabActivated re-emit).
    _applyDom: function(langKey) {
      var lang = this.LANGUAGES[langKey];
      if (!lang) { langKey = 'en'; lang = this.LANGUAGES.en; }

      this.current = langKey;

      var editor = Rga.$ && Rga.$('#editor');
      if (editor) {
        editor.setAttribute('lang', langKey);
      }
      var container = Rga.$ && Rga.$('#editor-container');
      if (container) {
        container.style.direction = (lang.dir === 'rtl') ? 'rtl' : 'ltr';
      }
      if (Rga.$$) {
        Rga.$$('.sh-location').forEach(function(input) { input.dir = lang.dir; });
      }

      var langBtn = Rga.$ && Rga.$('#status-language');
      if (langBtn) {
        langBtn.textContent = lang.code;
        langBtn.title = 'Script Language: ' + lang.label + ' (' + lang.dir.toUpperCase() + ')';
      }
    },

    showPicker: function() {
      var self = this;
      var btn = Rga.$ && Rga.$('#status-language');
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
      var langBtn = Rga.$ && Rga.$('#status-language');
      if (langBtn) {
        langBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          self.showPicker();
        });
      }
    }
  };
})();
