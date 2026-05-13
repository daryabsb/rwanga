// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  function activeScenePlugin() {
    const PM = window.RgaProseMirror;
    const key = new PM.PluginKey('activeScene');

    return new PM.Plugin({
      key: key,

      state: {
        init: function() { return null; },
        apply: function(tr, prev) {
          if (!tr.selectionSet && !tr.docChanged) return prev;
          const $head = tr.selection.$head;
          for (let d = $head.depth; d >= 0; d--) {
            const node = $head.node(d);
            if (node.type.name === 'scene') {
              return node.attrs.id || null;
            }
          }
          return null;
        }
      },

      view: function() {
        let lastSceneId = null;
        return {
          update: function(view) {
            const sceneId = key.getState(view.state);
            if (sceneId !== lastSceneId) {
              lastSceneId = sceneId;
              document.dispatchEvent(new CustomEvent('editor.activeSceneChange', {
                detail: { sceneId: sceneId }
              }));
            }
          }
        };
      }
    });
  }

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.activeScenePlugin = activeScenePlugin;
})();
