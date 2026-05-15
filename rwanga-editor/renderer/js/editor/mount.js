// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // Base nodes present in every outer document, regardless of doc-type.
  const baseOuterNodes = {
    doc:        { content: 'titleStrip? body' },
    titleStrip: {
      content: 'text*',
      attrs: { removable: { default: true } },
      parseDOM: [{ tag: 'div.rga-title-strip' }],
      toDOM: function(node) {
        return ['div', { class: 'rga-title-strip', 'data-removable': String(node.attrs.removable) }, 0];
      }
    },
    body: {
      content: 'block*',
      parseDOM: [{ tag: 'div.rga-body' }],
      toDOM: function() { return ['div', { class: 'rga-body' }, 0]; }
    },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM: function() { return ['p', 0]; }
    },
    heading: {
      content: 'inline*',
      group: 'block',
      attrs: { level: { default: 1 } },
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } }
      ],
      toDOM: function(node) { return ['h' + node.attrs.level, 0]; }
    },
    blockquote: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'blockquote' }],
      toDOM: function() { return ['blockquote', 0]; }
    },
    bulletList: {
      content: 'listItem+',
      group: 'block',
      parseDOM: [{ tag: 'ul' }],
      toDOM: function() { return ['ul', 0]; }
    },
    orderedList: {
      content: 'listItem+',
      group: 'block',
      attrs: { start: { default: 1 } },
      parseDOM: [{ tag: 'ol', getAttrs: function(dom) { return { start: +dom.getAttribute('start') || 1 }; } }],
      toDOM: function(node) {
        return node.attrs.start === 1 ? ['ol', 0] : ['ol', { start: node.attrs.start }, 0];
      }
    },
    listItem: {
      content: 'paragraph block*',
      parseDOM: [{ tag: 'li' }],
      toDOM: function() { return ['li', 0]; }
    },
    horizontalRule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM: function() { return ['hr']; }
    },
    pageBreak: {
      group: 'block',
      attrs: { manual: { default: true } },
      parseDOM: [{ tag: 'div.rga-page-break' }],
      toDOM: function() { return ['div', { class: 'rga-page-break' }]; }
    },
    text: { group: 'inline' }
  };

  // Build the active outer schema by composing base nodes/marks with the
  // registered doc-type's outerNodes.
  function activeSchema(documentType) {
    const PM = window.RgaProseMirror;
    if (!PM) {
      console.error('[Rga.Editor] ProseMirror bundle not loaded');
      return null;
    }
    if (!Rga.DocTypes || !Rga.DocTypes.has(documentType)) {
      console.error('[Rga.Editor] No doc-type registered for "' + documentType + '"');
      return null;
    }
    const docType = Rga.DocTypes.get(documentType);
    const nodes = Object.assign({}, baseOuterNodes, docType.outerNodes);
    const marks = (Rga.Framework && Rga.Framework.baseOuterMarks) || {};
    return new PM.Schema({ nodes: nodes, marks: marks });
  }

  /**
   * Mount a ProseMirror editor into the given DOM container.
   * @param {HTMLElement} container
   * @param {object} [opts] - { initialDoc, schema, documentType }
   * @returns {{ view: EditorView, state: EditorState } | null}
   */
  function mount(container, opts) {
    const PM = window.RgaProseMirror;
    if (!PM) {
      console.error('[Rga.Editor] ProseMirror bundle not loaded — window.RgaProseMirror is undefined');
      return null;
    }

    opts = opts || {};
    const documentType = opts.documentType || 'screenplay';
    const schema = opts.schema || activeSchema(documentType);
    if (!schema) return null;

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

    // Mark plugins: context-menu, annotations, tags, revision flags, page-breaks.
    // These are no-ops on atom nodes (sceneFrame) in F1 but become active in F2+.
    const sp = Rga.DocTypes && Rga.DocTypes.screenplay;
    if (sp && sp.contextMenuPlugin) {
      plugins.push(sp.contextMenuPlugin());
    }
    if (sp && sp.annotationsPlugin) {
      plugins.push(sp.annotationsPlugin());
    }
    if (sp && sp.tagsPlugin) {
      plugins.push(sp.tagsPlugin());
    }
    if (sp && sp.revisionFlagsPlugin) {
      plugins.push(sp.revisionFlagsPlugin());
    }
    if (sp && sp.pageBreaksPlugin) {
      plugins.push(sp.pageBreaksPlugin(function() {
        const doc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
        return doc && doc.settings ? doc.settings.pageSetup : null;
      }));
    }

    const docType = Rga.DocTypes.get(documentType);
    const nodeViews = {};
    if (typeof docType.placeholderNodeViewFactory === 'function') {
      nodeViews.sceneFrame = docType.placeholderNodeViewFactory();
    }

    const initialDoc = opts.initialDoc || emptyDoc(schema);

    const state = PM.EditorState.create({ schema, doc: initialDoc, plugins });

    container.innerHTML = '';
    const view = new PM.EditorView(container, {
      state,
      nodeViews,
      dispatchTransaction: function(tr) {
        const newState = view.state.apply(tr);
        view.updateState(newState);
        if (tr.docChanged) {
          const doc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
          if (doc) {
            const wasClean = !doc.dirty;
            Rga.Doc.markDirty(doc);
            if (wasClean) {
              if (Rga.TabManager.renderTabBar) Rga.TabManager.renderTabBar();
              if (Rga.FileManager && Rga.FileManager.notifyTitle) Rga.FileManager.notifyTitle();
            }
          }
        }
      }
    });

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
    schema = schema || activeSchema('screenplay');
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
