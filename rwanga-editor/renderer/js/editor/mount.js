// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // Active schema — provided by the active document's type package.
  // Phase 2: screenplay only. Future: lookup by doc.document_type.
  function activeSchema() {
    const s = Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.schema;
    if (!s) console.error('[Rga.Editor] No screenplay schema — is doc-types/screenplay/schema.js loaded after bundle.js?');
    return s || null;
  }

  /**
   * Mount a ProseMirror editor into the given DOM container.
   * @param {HTMLElement} container - the target element (will be cleared)
   * @param {object} [opts] - { initialDoc, schema, plugins }
   * @returns {{ view: EditorView, state: EditorState } | null}
   */
  function mount(container, opts) {
    const PM = window.RgaProseMirror;
    if (!PM) {
      console.error('[Rga.Editor] ProseMirror bundle not loaded — window.RgaProseMirror is undefined');
      return null;
    }

    opts = opts || {};
    const schema = opts.schema || activeSchema();
    if (!schema) return null;

    const boldMark = schema.marks.bold;
    const italicMark = schema.marks.italic;

    const keymapEntries = {
      'Mod-z': PM.undo,
      'Mod-y': PM.redo,
      'Mod-Shift-z': PM.redo,
      // Prevent Tab from escaping the editor when not in a scene (screenplay keymap handles in-scene Tab).
      'Tab': () => true,
      'Shift-Tab': () => true,
    };
    if (boldMark) keymapEntries['Mod-b'] = PM.toggleMark(boldMark);
    if (italicMark) keymapEntries['Mod-i'] = PM.toggleMark(italicMark);

    const plugins = [
      PM.history(),
      PM.keymap(keymapEntries),
      PM.keymap(PM.baseKeymap),
    ].concat(opts.plugins || []);

    // Prepend screenplay keymap so it takes priority over base keymap
    if (Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.buildKeymap) {
      const screenplayKeymap = Rga.DocTypes.screenplay.buildKeymap(schema);
      plugins.unshift(PM.keymap(screenplayKeymap));
    }

    // Active-scene tracker plugin
    if (Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.activeScenePlugin) {
      plugins.push(Rga.DocTypes.screenplay.activeScenePlugin());
    }

    // Mark plugins: context-menu, annotations, tags (click handler), revision flags
    if (Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.contextMenuPlugin) {
      plugins.push(Rga.DocTypes.screenplay.contextMenuPlugin());
    }
    if (Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.annotationsPlugin) {
      plugins.push(Rga.DocTypes.screenplay.annotationsPlugin());
    }
    if (Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.tagsPlugin) {
      plugins.push(Rga.DocTypes.screenplay.tagsPlugin());
    }
    if (Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.revisionFlagsPlugin) {
      plugins.push(Rga.DocTypes.screenplay.revisionFlagsPlugin());
    }

    const initialDoc = opts.initialDoc || emptyDoc(schema);

    const state = PM.EditorState.create({ schema, doc: initialDoc, plugins });

    container.innerHTML = '';
    const view = new PM.EditorView(container, { state });

    return { view, state };
  }

  /**
   * Swap the EditorView to a different EditorState (used on tab switch).
   * @param {EditorView} view
   * @param {EditorState} newState
   */
  function swapState(view, newState) {
    if (view) view.updateState(newState);
  }

  /**
   * Re-attach the EditorView to a new document.
   * @param {EditorView} view
   * @param {Node} doc
   */
  function setDoc(view, doc) {
    if (!view) return;
    const newState = window.RgaProseMirror.EditorState.create({
      schema: view.state.schema,
      doc,
      plugins: view.state.plugins
    });
    view.updateState(newState);
  }

  /**
   * Create a fresh document (one empty paragraph) under the given schema.
   * @param {Schema} [schema]
   * @returns {Node}
   */
  function emptyDoc(schema) {
    schema = schema || activeSchema();
    return schema.node('doc', null, [
      schema.node('body', null, [
        schema.node('paragraph')
      ])
    ]);
  }

  Rga.Editor = Rga.Editor || {};
  Rga.Editor.mount = mount;
  Rga.Editor.swapState = swapState;
  Rga.Editor.setDoc = setDoc;
  Rga.Editor.emptyDoc = emptyDoc;
})();
