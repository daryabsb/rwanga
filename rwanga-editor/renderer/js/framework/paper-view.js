// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PaperView controller — Fork A.
//
// Renders the read-only Paper truth surface: the active document's pages,
// rendered by PrintRenderer into an editor-area container. Editing never
// happens here — editing stays in Flow.
//
// Rule 8 — leaves are PrintRenderer's one-sheet-per-PageMap-page output:
//   content-range-bound, never decorative.
// Rule 9 — the hidden Flow editor is state-preservation only. PaperView
//   reads ProseMirror *model* state (view.state, plugin state) and NEVER
//   the hidden editor's DOM: no geometry reads, no measurement, no second
//   PageMap build. The PageMap is reused from the nav-index plugin via
//   Rga.Nav.getPageMap — there is exactly one PageMap per document.
//
// Brick 6 — click-to-edit: the Paper view is read-only, but clicking any
//   rendered block is the "edit in Flow" affordance. It returns to Flow
//   and restores the caret at that block's document position (the
//   data-pm-from anchor PrintRenderer stamps on every block).
//
// Paper truth flows one way: RenderModel -> PrintRenderer -> Paper surface.
//
// Public API:
//   Rga.PaperView.buildPaperModel(view)         -> RenderModel | null
//   Rga.PaperView.render(view, container, opts)  -> boolean
//   Rga.PaperView.clear(container)               -> void
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.PaperView = Rga.PaperView || {};

  // buildPaperModel — the shared model pipeline. The PageMap is REUSED from
  // the nav-index plugin (Rga.Nav.getPageMap); PaperView never builds its
  // own. Rga.Normalizer is pure, so re-normalizing the same document yields
  // the same block array the reused PageMap indexes into.
  function buildPaperModel(view) {
    if (!view || !view.state || !view.state.doc) return null;
    if (!Rga.Nav || typeof Rga.Nav.getPageMap !== 'function') return null;
    if (!Rga.Normalizer || typeof Rga.Normalizer.normalize !== 'function') return null;
    if (!Rga.ManuscriptGeometry || typeof Rga.ManuscriptGeometry.resolve !== 'function') return null;
    if (!Rga.RenderModel || typeof Rga.RenderModel.build !== 'function') return null;

    const pmDoc   = view.state.doc;
    const pageMap = Rga.Nav.getPageMap(view.state);   // reuse — no second build
    if (!Array.isArray(pageMap)) return null;

    const normalizedBlocks = Rga.Normalizer.normalize(pmDoc);
    const rwangaDoc = (Rga.TabManager && typeof Rga.TabManager.activeDoc === 'function')
      ? Rga.TabManager.activeDoc()
      : null;
    const layoutProfile = Rga.ManuscriptGeometry.resolve(rwangaDoc);

    return Rga.RenderModel.build(pmDoc, pageMap, normalizedBlocks, layoutProfile);
  }

  // render — build the model and paint it into `container` via PrintRenderer.
  // PrintRenderer emits plain <div> sheets with no contenteditable, so the
  // Paper surface is inherently read-only. Returns true when sheets painted.
  function render(view, container, opts) {
    if (!container) return false;
    if (!Rga.PrintRenderer || typeof Rga.PrintRenderer.render !== 'function') return false;
    const model = buildPaperModel(view);
    if (!model) return false;
    Rga.PrintRenderer.render(model, container, opts || {});
    _wireClickToEdit(container);
    return true;
  }

  // clear — tear down the Paper surface (used when switching back to Flow).
  function clear(container) {
    if (container) container.innerHTML = '';
  }

  // ----------------------------------------------------------------
  // Brick 6 — click-to-edit. One delegated click listener on the Paper
  // container, attached EXACTLY ONCE (guarded by an expando flag). Repeated
  // render() calls — and PrintRenderer's innerHTML reset — never re-add it,
  // so click transitions cannot leak handlers.
  // ----------------------------------------------------------------
  function _wireClickToEdit(container) {
    if (!container || container.__rgaClickToEditWired) return;
    container.__rgaClickToEditWired = true;
    container.addEventListener('click', function(ev) {
      const t = ev && ev.target;
      const blockEl = (t && typeof t.closest === 'function') ? t.closest('[data-pm-from]') : null;
      if (!blockEl) return;
      _editAt(parseInt(blockEl.getAttribute('data-pm-from'), 10));
    });
  }

  // _editAt — return to Flow and restore the caret at document position
  // `pmFrom`. Reads only ProseMirror *model* state (view.state) — never the
  // hidden editor's DOM (Rule 9). The EditorView is never destroyed, so the
  // Flow document + undo history are preserved across the transition.
  function _editAt(pmFrom) {
    if (Rga.ViewMode && typeof Rga.ViewMode.set === 'function') {
      Rga.ViewMode.set('flow');
    }
    const view = (Rga.TabManager && typeof Rga.TabManager._editorView === 'function')
      ? Rga.TabManager._editorView()
      : null;
    if (!view || !view.state) return;
    const PM = window.RgaProseMirror;
    if (PM && PM.TextSelection && typeof pmFrom === 'number' && !isNaN(pmFrom)) {
      const doc = view.state.doc;
      const max = (doc && doc.content && typeof doc.content.size === 'number') ? doc.content.size : pmFrom;
      const pos = Math.max(0, Math.min(pmFrom, max));
      try {
        const sel = PM.TextSelection.near(doc.resolve(pos));
        view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
      } catch (_) { /* position not resolvable — leave the selection as-is */ }
    }
    if (typeof view.focus === 'function') view.focus();
  }

  Rga.PaperView.buildPaperModel = buildPaperModel;
  Rga.PaperView.render          = render;
  Rga.PaperView.clear           = clear;
})();
