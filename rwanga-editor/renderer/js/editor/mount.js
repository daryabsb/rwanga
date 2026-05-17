// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Editor mount — composes the v3 screenplay editor:
//   schema (v3, structural scene nodes) +
//   keymap (history + v3 block-cycle/Enter/Mod-Enter/Backspace) +
//   NodeViews (SceneNodeView + SceneHeadingNodeView) +
//   plugins (nav-index → scene numbering & page markers,
//            annotations / tags / revisionFlags / context-menu).
//
// Phase 9: v2 architecture retired. No sceneFrame, no inner EditorViews,
// no paginator-renderer, no compatibility branches. Schema comes from
// the doc-type's selectSchema; for screenplay that is always
// Rga.DocTypes.screenplay.buildSchemaV3().
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // Base nodes present in every outer document, regardless of doc-type.
  // The screenplay v3 schema layers its own node tree (doc → titleStrip? body,
  // with scene structural nodes) on top of these — see schema-v3.js.
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

  // Pick the schema for a given doc-type. The screenplay doc-type returns
  // its v3 schema; future doc-types provide their own selectSchema. If a
  // doc-type has no selectSchema, we compose a baseline outer schema from
  // baseOuterNodes alone — minimal but valid (doc → body → paragraph).
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
    if (typeof docType.selectSchema === 'function') {
      const schema = docType.selectSchema(null);
      if (schema) return schema;
    }
    // Fallback for doc-types that have no selectSchema (none in v3).
    const marks = (Rga.Framework && Rga.Framework.baseOuterMarks) || {};
    return new PM.Schema({ nodes: baseOuterNodes, marks: marks });
  }

  /**
   * Mount a ProseMirror editor into the given DOM container.
   * @param {HTMLElement} container
   * @param {object} [opts] - { initialDoc, schema, documentType, plugins }
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
    const sp = Rga.DocTypes && Rga.DocTypes.screenplay;

    // Universal keymap entries (work on any schema).
    const keymapEntries = {
      'Mod-z': PM.undo,
      'Mod-y': PM.redo,
      'Mod-Shift-z': PM.redo
    };
    if (boldMark) keymapEntries['Mod-b'] = PM.toggleMark(boldMark);
    if (italicMark) keymapEntries['Mod-i'] = PM.toggleMark(italicMark);

    // v3 block-level keymap (Tab/Shift-Tab/Enter/Mod-Enter/Backspace) —
    // layered above the universal entries so block navigation wins
    // where it overlaps.
    if (sp && typeof sp.buildV3Keymap === 'function') {
      const v3Keys = sp.buildV3Keymap(schema);
      if (v3Keys) Object.assign(keymapEntries, v3Keys);
    }

    const plugins = [
      PM.history(),
      PM.keymap(keymapEntries),
      PM.keymap(PM.baseKeymap),
    ].concat(opts.plugins || []);

    // Cross-schema mark plugins (annotations / tags / revisionFlags /
    // context-menu) — schema-agnostic; operate on PM marks directly.
    if (sp && sp.contextMenuPlugin)     plugins.push(sp.contextMenuPlugin());
    if (sp && sp.annotationsPlugin)     plugins.push(sp.annotationsPlugin());
    if (sp && sp.tagsPlugin)            plugins.push(sp.tagsPlugin());
    if (sp && sp.revisionFlagsPlugin)   plugins.push(sp.revisionFlagsPlugin());

    // Scene-index plugin: emits scene-number NodeDecorations + page-break
    // widget decorations (Flow-view page markers) from the canonical PM doc.
    if (sp && typeof sp.buildV3ScenePlugins === 'function') {
      plugins.push.apply(plugins, sp.buildV3ScenePlugins());
    }

    const nodeViews = {};
    if (sp && typeof sp.buildV3NodeViews === 'function') {
      const v3Views = sp.buildV3NodeViews();
      if (v3Views) Object.assign(nodeViews, v3Views);
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
   * Create a fresh v3 document under the given schema:
   *   doc → body → one default scene (sceneHeading INT./DAY +
   *   empty action + CUT transition).
   * The user lands inside a valid scene; the scene-toolbox and page
   * markers are immediately wired.
   * @param {Schema} [schema]
   * @returns {Node}
   */
  function emptyDoc(schema) {
    schema = schema || activeSchema('screenplay');
    if (!schema) return null;
    const sp = Rga.DocTypes && Rga.DocTypes.screenplay;
    const v3Commands = sp && sp.v3Commands;
    let scene;
    if (v3Commands && typeof v3Commands.makeEmptyScene === 'function') {
      scene = v3Commands.makeEmptyScene(schema);
    } else {
      // Defensive — assemble the minimum valid scene by hand.
      scene = schema.node('scene',
        { id: 'scene-' + Date.now().toString(36), notes: '', revisionFlag: null,
          metadata: { linkedScenes: [], references: [], production: {} } },
        [
          schema.node('sceneHeading', { setting: 'INT.', time: 'DAY', headingStyle: null }),
          schema.node('action'),
          schema.node('transition', { presetType: 'CUT' }, schema.text('CUT'))
        ]
      );
    }
    return schema.node('doc', null, [
      schema.node('body', null, [scene])
    ]);
  }

  Rga.Editor = Rga.Editor || {};
  Rga.Editor.mount = mount;
  Rga.Editor.swapState = swapState;
  Rga.Editor.setDoc = setDoc;
  Rga.Editor.emptyDoc = emptyDoc;
  Rga.Editor.activeSchema = activeSchema;
})();
