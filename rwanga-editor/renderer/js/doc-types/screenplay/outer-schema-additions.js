// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Screenplay doc-type — additions to the outer schema.
// F1 contribution: the sceneFrame atom node.
// Inner-grammar nodes (sceneLine, action, character, dialogue, etc.)
// are NOT in the outer schema. They live inside attrs.innerDoc as JSON
// and will be parsed by the inner EditorView mounted in F2.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  const sceneFrame = {
    group: 'block',
    atom: true,
    selectable: true,
    attrs: {
      id:           { default: null },
      number:       { default: null },
      headingStyle: { default: null },
      innerDoc:     { default: null }
    },
    toDOM: function(node) {
      return ['div', {
        class: 'rga-scene-frame',
        'data-scene-id':     node.attrs.id || '',
        'data-scene-number': node.attrs.number == null ? '' : String(node.attrs.number)
      }];
    },
    parseDOM: [{ tag: 'div.rga-scene-frame' }]
  };

  Rga.DocTypes.screenplay.outerNodes = { sceneFrame: sceneFrame };
})();
