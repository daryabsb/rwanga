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

  // ---------------------------------------------------------------
  // Scene-level note and revision flag helpers
  // These mutate scene node attrs via setNodeMarkup transactions.
  // ---------------------------------------------------------------

  function _findScenePos(doc, sceneId) {
    let found = null;
    doc.descendants(function(node, pos) {
      if (found) return false;
      if (node.type.name === 'scene' && node.attrs.id === sceneId) {
        found = { node, pos };
        return false;
      }
    });
    return found;
  }

  function setSceneNote(view, sceneId, text) {
    const hit = _findScenePos(view.state.doc, sceneId);
    if (!hit) return false;
    const tr = view.state.tr.setNodeMarkup(hit.pos, null, Object.assign({}, hit.node.attrs, { notes: text }));
    view.dispatch(tr);
    return true;
  }

  function flagSceneForRevision(view, sceneId, payload) {
    const hit = _findScenePos(view.state.doc, sceneId);
    if (!hit) return false;
    const flag = payload
      ? { reason: payload.reason || '', status: payload.status || 'open', createdAt: payload.createdAt || new Date().toISOString() }
      : null;
    const tr = view.state.tr.setNodeMarkup(hit.pos, null, Object.assign({}, hit.node.attrs, { revisionFlag: flag }));
    view.dispatch(tr);
    return true;
  }

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.activeScenePlugin = activeScenePlugin;
  Rga.DocTypes.screenplay.setSceneNote = setSceneNote;
  Rga.DocTypes.screenplay.flagSceneForRevision = flagSceneForRevision;
})();
