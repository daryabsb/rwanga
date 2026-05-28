// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Screenplay plugin — Tag toolbar group (Filmustageation F1A.7).
//
// Second production consumer of the F1A.6 toolbar contribution API.
// Registers a screenplay-owned group at order 300 (after the Scene
// group at 200, before the CORE-owned Writing group still rendered in
// the static toolbar HTML). The group contains:
//
//   - tag <select> — change to character / prop / wardrobe / location
//     / sfx / vfx / vehicle / animal / custom. On change the
//     screenplay tag system applies the selected category to the
//     current text selection (via Rga.Doc.addEntity into the doc's
//     tag_registry + the schema's `tag` mark). The select resets to
//     its placeholder after each application so reselecting the same
//     category re-fires the handler.
//
// Pre-F1A.7 this dropdown + its handler lived in CORE: the static
// <select id="rga-shell-toolbar-tag"> inside the Writing group of
// renderer/index.html, with applyTagFromSelection in CORE's
// renderer/js/format-toolbar.js. F1A.7 moves both into screenplay
// plugin ownership — CORE's Writing group keeps only Note / Flag /
// Undo / Redo (genuinely document-neutral controls).
//
// Visible position: the tag dropdown now mounts inside the plugin
// slot (after the Scene group), which sits visually just before the
// static Writing group. Pre-F1A.7 the tag dropdown lived between
// "Flag" and "Undo" inside Writing; post-F1A.7 it sits just to the
// left of Writing — a small left-shift that preserves the toolbar's
// conceptual ordering (scene tools → tag tools → writing actions).
// The change is documented honestly here.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Shell || !Rga.Shell.Toolbar
      || typeof Rga.Shell.Toolbar.registerGroup !== 'function') {
    // shell/toolbar.js loads BEFORE doc-types/screenplay/* in
    // renderer/index.html. Stripped-down test scaffolding may import
    // this file before the host; tests that need the group load both
    // files explicitly in order. Bail silently.
    return;
  }

  // Production-vocabulary tag categories. This list IS the screenplay
  // contamination that lived in CORE's index.html pre-F1A.7. It now
  // sits with the plugin where it belongs; future plugins (research:
  // citation / footnote / hypothesis; novel: character / place /
  // timeline) will register their own groups with their own vocabulary.
  const TAG_CATEGORIES = [
    { value: 'character', label: 'Character' },
    { value: 'prop',      label: 'Prop' },
    { value: 'wardrobe',  label: 'Wardrobe' },
    { value: 'location',  label: 'Location' },
    { value: 'sfx',       label: 'SFX' },
    { value: 'vfx',       label: 'VFX' },
    { value: 'vehicle',   label: 'Vehicle' },
    { value: 'animal',    label: 'Animal' },
    { value: 'custom',    label: 'Custom' }
  ];

  // ==========================================================================
  // Engine dispatcher — pure function; same engine touch points the
  // pre-F1A.7 format-toolbar.js used (Rga.Doc.addEntity + the `tag`
  // mark), simply relocated here.
  // ==========================================================================

  function _applyTagFromSelection(tagType) {
    if (!tagType) return;
    const TM = window.Rga && window.Rga.TabManager;
    if (!TM || typeof TM._editorView !== 'function') return;
    const view = TM._editorView();
    if (!view) return;
    const sel = view.state.selection;
    if (!sel || sel.empty) return;
    const text = view.state.doc.textBetween(sel.from, sel.to, ' ').trim();
    if (!text) return;
    const doc = typeof TM.activeDoc === 'function' ? TM.activeDoc() : null;
    if (!doc || !window.Rga.Doc
        || typeof window.Rga.Doc.addEntity !== 'function') return;
    const entityId = window.Rga.Doc.addEntity(doc, tagType, { name: text, color: null });
    const mt = view.state.schema.marks.tag;
    if (!mt) return;
    view.dispatch(view.state.tr.addMark(sel.from, sel.to, mt.create({
      tagType:  tagType,
      entityId: entityId
    })));
    if (typeof view.focus === 'function') view.focus();
    if (typeof window.Rga.Doc.markDirty === 'function') {
      window.Rga.Doc.markDirty(doc);
    }
  }

  // ==========================================================================
  // Toolbar group mount
  // ==========================================================================

  function _mount(groupEl) {
    const select = document.createElement('select');
    select.className = 'rga-shell-toolbar-tag';
    select.id = 'rga-shell-toolbar-tag';
    select.setAttribute('aria-label', 'Tag selected text');
    select.setAttribute('title', 'Tag selected text');

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Tag…';
    select.appendChild(placeholder);

    TAG_CATEGORIES.forEach(function(c) {
      const opt = document.createElement('option');
      opt.value = c.value;
      opt.textContent = c.label;
      select.appendChild(opt);
    });
    groupEl.appendChild(select);

    // Change handler. After apply, reset to placeholder so re-selecting
    // the same category re-fires the change event (same UX the
    // pre-F1A.7 CORE handler enforced).
    const onChange = function() {
      const t = select.value;
      if (!t) return;
      _applyTagFromSelection(t);
      select.value = '';
    };
    select.addEventListener('change', onChange);

    return function _unmount() {
      select.removeEventListener('change', onChange);
    };
  }

  Rga.Shell.Toolbar.registerGroup({
    id:        'tag',
    order:     300,
    dataGroup: 'tag',
    mount:     _mount
  });
})();
