// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Screenplay doc-type module — registers with Rga.DocTypes at load time.
// F1 contribution: outer-schema additions + the placeholder NodeView factory.
// F2+ will add: innerSchema, innerKeymap, innerPlugins, slug NodeView, etc.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.DocTypes || typeof Rga.DocTypes.register !== 'function') {
    console.error('[doc-types/screenplay] doc-type-registry not loaded — script order is wrong');
    return;
  }
  const sp = Rga.DocTypes.screenplay || {};
  if (!sp.outerNodes || !sp.outerNodes.sceneFrame) {
    console.error('[doc-types/screenplay] outer-schema-additions not loaded — script order is wrong');
    return;
  }
  if (typeof sp.sceneFramePlaceholderFactory !== 'function') {
    console.error('[doc-types/screenplay] scene-frame-placeholder not loaded — script order is wrong');
    return;
  }

  Rga.DocTypes.register('screenplay', {
    outerNodes: sp.outerNodes,
    placeholderNodeViewFactory: sp.sceneFramePlaceholderFactory
    // F2+ keys (innerSchema, innerKeymap, innerPlugins, nodeViewFactory,
    //  elementStyles, vocabulary, toolbox, exporters) are added in later steps.
  });
})();
