// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Inner schema for the screenplay doc-type.
// Used by the nested EditorView inside each sceneFrame atom (F2+).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  const PM = window.RgaProseMirror;
  if (!PM || !PM.Schema) {
    console.error('[doc-types/screenplay/inner-schema] RgaProseMirror.Schema not available');
    return;
  }

  const marks = (Rga.Framework && Rga.Framework.baseOuterMarks) || {};

  const nodes = {
    doc: { content: 'block+' },

    sceneLine: {
      content: 'inline*',
      group: 'block',
      defining: true,
      attrs: {
        setting: { default: 'INT.' },
        time:    { default: 'DAY' }
      },
      parseDOM: [{ tag: 'div.rga-scene-line' }],
      toDOM: function(node) {
        return ['div', {
          class: 'rga-scene-line',
          'data-setting': node.attrs.setting,
          'data-time': node.attrs.time
        }, 0];
      }
    },

    action: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'div.rga-action' }],
      toDOM: function() { return ['div', { class: 'rga-action' }, 0]; }
    },

    character: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'div.rga-character' }],
      toDOM: function() { return ['div', { class: 'rga-character' }, 0]; }
    },

    dialogue: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'div.rga-dialogue' }],
      toDOM: function() { return ['div', { class: 'rga-dialogue' }, 0]; }
    },

    parenthetical: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'div.rga-parenthetical' }],
      toDOM: function() { return ['div', { class: 'rga-parenthetical' }, 0]; }
    },

    transition: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'div.rga-transition' }],
      toDOM: function() { return ['div', { class: 'rga-transition' }, 0]; }
    },

    shot: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'div.rga-shot' }],
      toDOM: function() { return ['div', { class: 'rga-shot' }, 0]; }
    },

    inlineFreeText: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'div.rga-inline-free-text' }],
      toDOM: function() { return ['div', { class: 'rga-inline-free-text' }, 0]; }
    },

    text: { group: 'inline' }
  };

  const innerSchema = new PM.Schema({ nodes: nodes, marks: marks });

  function emptyInnerDoc(schema) {
    schema = schema || innerSchema;
    return schema.node('doc', null, [
      schema.node('sceneLine', { setting: 'INT.', time: 'DAY' }),
      schema.node('action')
    ]);
  }

  Rga.DocTypes.screenplay.innerSchema = innerSchema;
  Rga.DocTypes.screenplay.emptyInnerDoc = emptyInnerDoc;
})();
