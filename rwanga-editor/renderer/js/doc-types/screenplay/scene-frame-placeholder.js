// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// SceneFramePlaceholder — F1-only NodeView. Renders a non-editable box
// labeled "Scene N" with an optional one-line slug preview drawn from
// attrs.innerDoc. Replaced by the real inner-editor NodeView in F2.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  function _slugPreview(innerDoc) {
    if (!innerDoc || !Array.isArray(innerDoc.content) || innerDoc.content.length === 0) return null;
    const first = innerDoc.content[0];
    if (!first || first.type !== 'sceneLine') return null;
    const setting = (first.attrs && first.attrs.setting) || 'INT.';
    const time    = (first.attrs && first.attrs.time)    || 'DAY';
    let locationText = '';
    if (Array.isArray(first.content)) {
      first.content.forEach(function(child) {
        if (child.type === 'text' && typeof child.text === 'string') locationText += child.text;
      });
    }
    locationText = locationText.trim();
    return locationText
      ? (setting + ' ' + locationText + ' — ' + time)
      : (setting + ' — ' + time);
  }

  function SceneFramePlaceholder(node) {
    this.dom = document.createElement('div');
    this.dom.className = 'rga-scene-frame-placeholder';
    this.dom.setAttribute('contenteditable', 'false');
    this._render(node);
  }

  SceneFramePlaceholder.prototype._render = function(node) {
    while (this.dom.firstChild) this.dom.removeChild(this.dom.firstChild);

    const num = document.createElement('div');
    num.className = 'rga-scene-frame-placeholder-num';
    num.textContent = 'Scene ' + (node.attrs.number == null ? '?' : node.attrs.number);

    this.dom.appendChild(num);

    const preview = _slugPreview(node.attrs.innerDoc);
    if (preview) {
      const slug = document.createElement('div');
      slug.className = 'rga-scene-frame-placeholder-slug';
      slug.textContent = preview;
      this.dom.appendChild(slug);
    }

    this.dom.dataset.sceneId     = node.attrs.id     || '';
    this.dom.dataset.sceneNumber = node.attrs.number == null ? '' : String(node.attrs.number);
  };

  SceneFramePlaceholder.prototype.update = function(node) {
    if (node.type.name !== 'sceneFrame') return false;
    this._render(node);
    return true;
  };

  SceneFramePlaceholder.prototype.stopEvent = function() {
    return false; // F1: read-only; PM handles selection/click normally
  };

  function sceneFramePlaceholderFactory() {
    return function(node /*, view, getPos */) {
      return new SceneFramePlaceholder(node);
    };
  }

  Rga.DocTypes.screenplay.sceneFramePlaceholderFactory = sceneFramePlaceholderFactory;
  Rga.DocTypes.screenplay._slugPreview = _slugPreview; // exposed for unit tests
})();
