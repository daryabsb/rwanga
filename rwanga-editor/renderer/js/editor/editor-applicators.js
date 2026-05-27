// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Editor settings applicators — Slice 4A.
//
// Registers handlers for the editor.* settings that can be wired
// today. The applicator-registry layer owns the Store subscription;
// this module is one register() call per setting, no init dance.
//
// Wired:
//   - editor.fontFamily          → --font-editor on #editor
//   - editor.fontSize            → --editor-font-size on #editor (pt unit)
//   - editor.lineHeight          → --editor-line-height on #editor
//   - editor.spellcheck          → spellcheck="true"/"false" on #editor
//   - editor.highlightCurrentLine → toggles .rga-line-highlight-on
//     (consolidated here in Slice 4A; was a separate file in Slice 2
//     / Slice 3D — behavior unchanged)
//
// Intentionally deferred (no real wiring possible without out-of-
// scope work — Slice 4A scope forbids fake behavior):
//   - editor.autocomplete   — character/location/transition engine
//                             does not exist yet
//   - editor.wordWrap       — requires a column-mode switcher
//                             (page/viewport/off) that does not exist
//   - editor.showLineNumbers — would conflict with the Phase 3 Flow
//                              View gutter default; needs a UX
//                              decision about which default wins
//
// Future slices add applicators for the deferred items as their
// supporting machinery lands.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Settings || !Rga.Settings.Applicators ||
      typeof Rga.Settings.Applicators.register !== 'function') {
    // Applicator registry not loaded — module is inert. The boot path
    // in index.html ensures the registry loads first; this branch
    // only fires in stripped-down test scaffolding.
    return;
  }

  const register = Rga.Settings.Applicators.register;

  function _editor() {
    return document.getElementById('editor');
  }

  // Drift guard (post-Slice-5B fix): setProperty-style applicators
  // must only push an inline CSS var when the user has actually
  // chosen a non-builtin value. Pushing the registry default inline
  // would override the CSS fallback (e.g. line-height: var(...,
  // 1.5)) with the registry default (1.0), changing the visible
  // surface without explicit user authorization. When no override
  // exists, remove any inline value so the CSS fallback flows.
  function _hasUserOverride(id) {
    const Store = Rga.Settings && Rga.Settings.Store;
    if (!Store || typeof Store.get !== 'function') return false;
    return Store.get(id, 'user')    !== undefined
        || Store.get(id, 'session') !== undefined
        || Store.get(id, 'script')  !== undefined;
  }

  // ----- editor.fontFamily ------------------------------------------------
  // The chosen face is set as --font-editor on #editor so descendant
  // rules (.ProseMirror, .gutter-line, etc.) that read var(--font-editor)
  // pick it up. The font name is quoted; the fallback stack mirrors
  // the existing tokens.css default so an invalid local font does not
  // strand the surface in an unstyled state.
  register('editor.fontFamily', function(value) {
    const el = _editor();
    if (!el) return;
    const stack = '"' + String(value) + '", "Courier Prime", "Courier New", monospace';
    el.style.setProperty('--font-editor', stack);
  }, { owner: 'editor' });

  // ----- editor.fontSize --------------------------------------------------
  // .ProseMirror already reads var(--editor-font-size, 12pt). The
  // registry default (12) keeps that fallback aligned. Value is a
  // number; the applicator attaches the pt unit.
  register('editor.fontSize', function(value) {
    const el = _editor();
    if (!el) return;
    el.style.setProperty('--editor-font-size', String(value) + 'pt');
  }, { owner: 'editor' });

  // ----- editor.lineHeight ------------------------------------------------
  // Registry stores '1.0' / '1.15' / '1.5' / '2.0' as strings. CSS
  // line-height accepts unitless numbers, so the value passes through
  // as-is. Gated on user-override (see _hasUserOverride) — the CSS
  // fallback (1.5) is the prior visible default and must remain when
  // the user has not chosen otherwise.
  register('editor.lineHeight', function(value, id) {
    const el = _editor();
    if (!el) return;
    if (!_hasUserOverride(id)) {
      el.style.removeProperty('--editor-line-height');
      return;
    }
    el.style.setProperty('--editor-line-height', String(value));
  }, { owner: 'editor' });

  // ----- editor.spellcheck ------------------------------------------------
  // ProseMirror's contenteditable lives inside #editor — toggling the
  // attribute on the wrapper propagates to the contenteditable child
  // via DOM inheritance.
  register('editor.spellcheck', function(value) {
    const el = _editor();
    if (!el) return;
    el.setAttribute('spellcheck', value ? 'true' : 'false');
  }, { owner: 'editor' });

  // ----- editor.highlightCurrentLine --------------------------------------
  // Toggles the rga-line-highlight-on class on #editor; the CSS that
  // styles the current-line ribbon hangs off that class. Behavior
  // matches the prior dedicated module — moved here as Slice 4A's
  // consolidation of editor.* applicators.
  register('editor.highlightCurrentLine', function(value) {
    const el = _editor();
    if (!el) return;
    el.classList.toggle('rga-line-highlight-on', !!value);
  }, { owner: 'editor' });

  // ----- editor.scriptLanguage (S12 — Promoted from legacy module) --------
  // Per-script writing language. Drives the `lang` attribute on #editor,
  // editor-container direction, .sh-location input direction, and the
  // status-bar language indicator. Rga.ScriptLanguage._applyDom is the
  // pure-DOM mutation entry point; the legacy localStorage path
  // ('rga-script-lang') was retired in S12.
  register('editor.scriptLanguage', function(value) {
    const SL = window.Rga && window.Rga.ScriptLanguage;
    if (!SL || typeof SL._applyDom !== 'function') return;
    if (typeof value !== 'string' || !SL.LANGUAGES[value]) return;
    SL._applyDom(value);
  }, { owner: 'editor' });
})();
