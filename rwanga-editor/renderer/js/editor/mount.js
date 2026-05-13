// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // PHASE 1 MINIMAL SCHEMA — replaced in Phase 2 by doc-types/screenplay/schema.js
  function buildMinimalSchema(PM) {
    return new PM.Schema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: {
          content: 'inline*',
          group: 'block',
          parseDOM: [{ tag: 'p' }],
          toDOM() { return ['p', 0]; }
        },
        text: { group: 'inline' }
      },
      marks: {
        bold: {
          parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
          toDOM() { return ['strong', 0]; }
        },
        italic: {
          parseDOM: [{ tag: 'em' }, { tag: 'i' }],
          toDOM() { return ['em', 0]; }
        }
      }
    });
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
    const schema = opts.schema || buildMinimalSchema(PM);

    const boldMark = schema.marks.bold;
    const italicMark = schema.marks.italic;

    const keymapEntries = {
      'Mod-z': PM.undo,
      'Mod-y': PM.redo,
      'Mod-Shift-z': PM.redo,
    };
    if (boldMark) keymapEntries['Mod-b'] = PM.toggleMark(boldMark);
    if (italicMark) keymapEntries['Mod-i'] = PM.toggleMark(italicMark);

    const plugins = [
      PM.history(),
      PM.keymap(keymapEntries),
      PM.keymap(PM.baseKeymap),
    ].concat(opts.plugins || []);

    const initialDoc = opts.initialDoc
      || schema.node('doc', null, [schema.node('paragraph')]);

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
    const PM = window.RgaProseMirror;
    if (!PM) return null;
    schema = schema || buildMinimalSchema(PM);
    return schema.node('doc', null, [schema.node('paragraph')]);
  }

  Rga.Editor = Rga.Editor || {};
  Rga.Editor.mount = mount;
  Rga.Editor.swapState = swapState;
  Rga.Editor.setDoc = setDoc;
  Rga.Editor.emptyDoc = emptyDoc;
})();
