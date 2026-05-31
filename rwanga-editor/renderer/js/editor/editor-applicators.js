// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Editor settings applicators — Slice 4A + S9.1.
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
//   - editor.scriptLanguage      → Rga.ScriptLanguage._applyDom (S12)
//
// S9.1 — Saturation Reduction (2026-05-28):
//   - editor.wordWrap            → data-word-wrap attr on <body>
//                                  ('page' | 'viewport' | 'off');
//                                  editor.css picks up the mode.
//   - editor.autocomplete        → data-autocomplete attr on <body>
//                                  ('on' | 'off'). Engine is a stub —
//                                  Rga.Autocomplete.setEnabled hook
//                                  exists so the future engine can
//                                  pick up the flag without a wiring
//                                  retrofit (plan §6 / S9.1).
//   - editor.showLineNumbers     → .rga-no-line-numbers class on
//                                  <body>; CSS hides .flow-line-gutter
//                                  when present. Registry default
//                                  changed false → true to match the
//                                  locked Flow gutter visible-default.
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

  // ----- editor.wordWrap (S9.1 — Saturation Reduction) -------------------
  // Registry: select ['page' | 'viewport' | 'off'], default 'page'.
  // The applicator writes the chosen mode to data-word-wrap on <body>.
  // editor.css selectors respond:
  //   - 'page'     → no override; #editor inherits the page-width column
  //                  (current locked Flow behaviour).
  //   - 'viewport' → #editor + .rga-page-row stretch to viewport.
  //   - 'off'      → #editor white-space: pre, overflow-x: auto.
  // Defensive: any unknown value is normalised to 'page' so the body
  // attr never holds a junk token.
  const _WRAP_MODES = ['page', 'viewport', 'off'];
  register('editor.wordWrap', function(value) {
    if (!document.body) return;
    const mode = _WRAP_MODES.indexOf(value) >= 0 ? value : 'page';
    document.body.setAttribute('data-word-wrap', mode);
  }, { owner: 'editor' });

  // ----- editor.autocomplete (S9.1 — Saturation Reduction) ----------------
  // Registry: toggle, default true.
  // The character/location/transition engine does not yet exist; this
  // applicator is the engine-ready flag (plan §6 / S9.1: "Stub flag in
  // Rga.Autocomplete (engine doesn't exist yet — flag is wired even if
  // the engine is no-op)"). Two effects:
  //   1. data-autocomplete attr on <body> — testable visible-DOM delta.
  //   2. window.Rga.Autocomplete.setEnabled(value) — called if the hook
  //      exists; otherwise no-op. The future autocomplete engine should
  //      define this hook to receive the boot value automatically.
  register('editor.autocomplete', function(value) {
    if (document.body) {
      document.body.setAttribute('data-autocomplete', value ? 'on' : 'off');
    }
    const AC = window.Rga && window.Rga.Autocomplete;
    if (AC && typeof AC.setEnabled === 'function') {
      try { AC.setEnabled(!!value); }
      catch (err) { console.error('[editor-applicators] Autocomplete.setEnabled threw:', err); }
    }
  }, { owner: 'editor' });

  // ----- editor.showLineNumbers (S9.1 — Saturation Reduction) -------------
  // Registry: toggle. Default changed false → true in S9.1 so the
  // applicator's "on" state matches the locked Flow gutter visible-
  // default (editor-prosemirror.css line 49). When the setting is OFF,
  // the applicator adds .rga-no-line-numbers to <body>; CSS in
  // editor-prosemirror.css (higher specificity than the .view-flow rule)
  // hides .flow-line-gutter.
  register('editor.showLineNumbers', function(value) {
    if (!document.body) return;
    document.body.classList.toggle('rga-no-line-numbers', !value);
  }, { owner: 'editor' });

  // ----- editor.pageColor (Filmustageation F7) ----------------------------
  // Registry: select ['white' | 'dark'], default 'white', scope 'flow'.
  // Writes data-flow-page-color on <body>. CSS in editor-prosemirror.css
  // overrides ONLY the Flow paper + ink tokens (--editor-page-bg /
  // --text-primary, scoped to #editor-container.view-flow) when 'dark' is
  // chosen; 'white' keeps the current paper. Flow-scoped: the print sheet
  // (.rga-page-sheet) uses its own hardcoded white/ink, so Print Preview and
  // PDF export are untouched (page truth stays white). Unknown values are
  // normalised to 'white' so the body attr never holds a junk token.
  const _PAGE_COLORS = ['white', 'dark'];
  register('editor.pageColor', function(value) {
    if (!document.body) return;
    const mode = _PAGE_COLORS.indexOf(value) >= 0 ? value : 'white';
    document.body.setAttribute('data-flow-page-color', mode);
  }, { owner: 'editor' });
})();
