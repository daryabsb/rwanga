// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// SceneFrame NodeView — mounts a nested ProseMirror EditorView per
// sceneFrame atom node. Replaces SceneFramePlaceholder when registered.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  const PM = window.RgaProseMirror;
  if (!PM || !PM.EditorState || !PM.EditorView) {
    console.error('[scene-frame-node-view] RgaProseMirror not available');
    return;
  }

  function _getInnerSchema() {
    return Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.innerSchema;
  }

  function _buildInnerDoc(node, innerSchema) {
    if (node.attrs.innerDoc) {
      try {
        return innerSchema.nodeFromJSON(node.attrs.innerDoc);
      } catch (err) {
        console.error('[SceneFrameNodeView] innerDoc invalid; using empty doc', err);
      }
    }
    const empty = Rga.DocTypes.screenplay.emptyInnerDoc;
    return empty ? empty(innerSchema) : innerSchema.node('doc');
  }

  function _buildInnerPlugins(innerSchema) {
    const sp = Rga.DocTypes.screenplay;
    const plugins = [];
    if (PM.history) plugins.push(PM.history());
    if (sp.buildInnerKeymap) plugins.push(sp.buildInnerKeymap(innerSchema));
    if (sp.buildZoneKeyPlugin) plugins.push(sp.buildZoneKeyPlugin());
    return plugins;
  }

  function _settingsAccessor() {
    return (Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc())
      ? Rga.TabManager.activeDoc().settings
      : null;
  }

  function SceneFrameNodeView(node, outerView, getPos) {
    this._node = node;
    this._outerView = outerView;
    this._getPos = getPos;
    this._lastSentInnerDoc = node.attrs.innerDoc;

    const innerSchema = _getInnerSchema();

    this.dom = document.createElement('div');
    this.dom.className = 'rga-scene-frame';
    this.dom.setAttribute('contenteditable', 'false');

    const header = document.createElement('div');
    header.className = 'rga-scene-frame-header';
    this._numberEl = document.createElement('span');
    this._numberEl.className = 'rga-scene-number';
    this._numberEl.textContent = (node.attrs.number == null) ? '?' : String(node.attrs.number);
    header.appendChild(this._numberEl);

    const body = document.createElement('div');
    body.className = 'rga-scene-frame-body';
    body.setAttribute('contenteditable', 'true');

    this.dom.appendChild(header);
    this.dom.appendChild(body);

    const innerDoc = _buildInnerDoc(node, innerSchema);
    const plugins = _buildInnerPlugins(innerSchema);

    const innerState = PM.EditorState.create({ schema: innerSchema, doc: innerDoc, plugins: plugins });

    const self = this;
    const nodeViews = {};
    if (typeof Rga.DocTypes.screenplay.sceneLineNodeViewFactory === 'function') {
      nodeViews.sceneLine = Rga.DocTypes.screenplay.sceneLineNodeViewFactory(_settingsAccessor);
    }

    this._innerView = new PM.EditorView(body, {
      state: innerState,
      nodeViews: nodeViews,
      dispatchTransaction: function(tr) {
        const newState = self._innerView.state.apply(tr);
        self._innerView.updateState(newState);
        if (tr.docChanged) {
          self._propagateToOuter(newState.doc);
        }
      }
    });
  }

  SceneFrameNodeView.prototype._propagateToOuter = function(innerDocNode) {
    const json = innerDocNode.toJSON();
    this._lastSentInnerDoc = json;
    const pos = this._getPos();
    if (pos == null) return;
    const outerView = this._outerView;
    const outerNode = outerView.state.doc.nodeAt ? outerView.state.doc.nodeAt(pos) : null;
    if (!outerNode) return;
    const newAttrs = Object.assign({}, outerNode.attrs, { innerDoc: json });
    const tr = outerView.state.tr.setNodeMarkup(pos, null, newAttrs);
    outerView.dispatch(tr);
  };

  SceneFrameNodeView.prototype.update = function(node) {
    if (node.type.name !== 'sceneFrame') return false;
    this._node = node;
    this._numberEl.textContent = (node.attrs.number == null) ? '?' : String(node.attrs.number);

    // Reference equality: if we sent this innerDoc ourselves, skip rebuild to
    // avoid the infinite-update loop (outer dispatch → update → inner rebuild).
    if (node.attrs.innerDoc === this._lastSentInnerDoc) {
      return true;
    }

    // External change (undo/redo or tab switch) — rebuild inner state
    const innerSchema = _getInnerSchema();
    const newInnerDoc = _buildInnerDoc(node, innerSchema);
    const newInnerState = PM.EditorState.create({
      schema: innerSchema,
      doc: newInnerDoc,
      plugins: this._innerView.state.plugins
    });
    this._innerView.updateState(newInnerState);
    this._lastSentInnerDoc = node.attrs.innerDoc;
    return true;
  };

  SceneFrameNodeView.prototype.destroy = function() {
    if (this._innerView) this._innerView.destroy();
  };

  SceneFrameNodeView.prototype.stopEvent = function() {
    return true;
  };

  SceneFrameNodeView.prototype.ignoreMutation = function() {
    return true;
  };

  SceneFrameNodeView.prototype.selectNode = function() {
    if (this._innerView && this._innerView.focus) this._innerView.focus();
  };

  function sceneFrameNodeViewFactory() {
    return function(node, outerView, getPos) {
      return new SceneFrameNodeView(node, outerView, getPos);
    };
  }

  Rga.DocTypes.screenplay.sceneFrameNodeViewFactory = sceneFrameNodeViewFactory;
})();
