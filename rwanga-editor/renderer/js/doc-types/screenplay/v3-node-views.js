// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// v3 NodeViews — Scene + SceneHeading only (per directive rule 2).
//
// Both NodeViews use contentDOM so PM owns the editable surface; the
// NodeView only paints the surrounding chrome (scene number badge,
// setting/time pickers, em-dash + slash separators). NO nested
// EditorView is created. NO PM transaction is dispatched from chrome
// except via setNodeMarkup when pickers change.
//
// Scene number is a DERIVED visual value (rule 3): computed by counting
// preceding scene siblings in body on every update(). Never stored on
// scene.attrs.
//
// Exposes (under Rga.DocTypes.screenplay):
//   buildV3NodeViews() → { scene: factory, sceneHeading: factory }
// where each factory returns a function (node, view, getPos) → NodeView.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  // ============================================================
  // SceneNodeView — chrome + contentDOM
  // ============================================================

  // Scene numbers arrive via NodeDecoration spec from the scene-index
  // plugin (renderer/js/framework/nav-index.js). The NodeView NEVER
  // walks the doc or queries the DOM for numbering — it only reads
  // whatever decoration PM hands it. When numbers shift (insert/delete
  // of a sibling scene), the plugin emits new decoration specs and PM
  // re-calls update() on every affected NodeView automatically.
  function SceneNodeView(node, view, getPos, decorations) {
    this._view = view;
    this._getPos = getPos;
    this._node = node;

    this.dom = document.createElement('div');
    this.dom.className = 'rga-scene-v3';
    if (node.attrs.id) this.dom.dataset.sceneId = node.attrs.id;

    // Number badge (chrome — not editable).
    this._numEl = document.createElement('div');
    this._numEl.className = 'rga-scene-v3-num';
    this._numEl.contentEditable = 'false';
    this._numEl.setAttribute('aria-hidden', 'true');
    this.dom.appendChild(this._numEl);

    // Reserved chrome slot for future drag handle / remove button —
    // see memory: project-scene-header-actions-deferred. Empty for now.
    this._chromeRight = document.createElement('div');
    this._chromeRight.className = 'rga-scene-v3-chrome-right';
    this._chromeRight.contentEditable = 'false';
    this._chromeRight.setAttribute('aria-hidden', 'true');
    this.dom.appendChild(this._chromeRight);

    // contentDOM — PM renders sceneHeading + sceneBody+ into here.
    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'rga-scene-v3-content';
    this.dom.appendChild(this.contentDOM);

    this._refreshNumber(_readNumber(decorations));
  }

  SceneNodeView.prototype._refreshNumber = function(n) {
    const word = _sceneWord();
    this._numEl.textContent = word + ' ' + (n == null ? '?' : n);
    if (n != null) this.dom.dataset.sceneNumber = String(n);
    else if (this.dom.dataset.sceneNumber) delete this.dom.dataset.sceneNumber;
  };

  SceneNodeView.prototype.update = function(node, decorations) {
    if (node.type.name !== 'scene') return false;
    this._node = node;
    if (node.attrs.id) this.dom.dataset.sceneId = node.attrs.id;
    this._refreshNumber(_readNumber(decorations));
    return true;
  };

  // stopEvent: false everywhere — PM should handle clicks / typing inside
  // contentDOM. Chrome elements have contentEditable=false so PM ignores
  // them naturally.
  SceneNodeView.prototype.stopEvent = function() { return false; };
  // PM owns the children inside contentDOM; we don't ignore mutations.
  SceneNodeView.prototype.ignoreMutation = function(m) {
    // Ignore mutations to chrome (number badge etc.), not to contentDOM.
    return m.target === this._numEl || m.target === this._chromeRight ||
           (m.target.parentNode && (m.target.parentNode === this._numEl || m.target.parentNode === this._chromeRight));
  };
  SceneNodeView.prototype.destroy = function() { /* nothing to clean */ };

  // ============================================================
  // SceneHeadingNodeView — pickers + content
  // ============================================================

  function SceneHeadingNodeView(node, view, getPos) {
    this._view = view;
    this._getPos = getPos;
    this._node = node;

    this.dom = document.createElement('div');
    this.dom.className = 'rga-scene-heading-v3';

    const self = this;

    // Setting picker (chrome).
    this._settingSelect = _buildPicker(
      'rga-scene-heading-v3-setting',
      _settingOptions(),
      node.attrs.setting,
      function(value) { self._setAttr('setting', value); }
    );
    this.dom.appendChild(this._settingSelect);

    // Em-dash separator (chrome).
    const sepEm = document.createElement('span');
    sepEm.className = 'rga-scene-heading-v3-sep';
    sepEm.contentEditable = 'false';
    sepEm.textContent = ' — ';
    this.dom.appendChild(sepEm);

    // Time picker (chrome).
    this._timeSelect = _buildPicker(
      'rga-scene-heading-v3-time',
      _timeOptions(),
      node.attrs.time,
      function(value) { self._setAttr('time', value); }
    );
    this.dom.appendChild(this._timeSelect);

    // Slash separator (chrome).
    const sepSlash = document.createElement('span');
    sepSlash.className = 'rga-scene-heading-v3-sep';
    sepSlash.contentEditable = 'false';
    sepSlash.textContent = ' / ';
    this.dom.appendChild(sepSlash);

    // contentDOM — PM renders the location text inline here.
    this.contentDOM = document.createElement('span');
    this.contentDOM.className = 'rga-scene-heading-v3-location';
    this.dom.appendChild(this.contentDOM);
  }

  SceneHeadingNodeView.prototype._setAttr = function(key, value) {
    if (!this._view || typeof this._getPos !== 'function') return;
    const pos = this._getPos();
    if (typeof pos !== 'number') return;
    const currentNode = this._view.state.doc.nodeAt(pos);
    if (!currentNode) return;
    const newAttrs = Object.assign({}, currentNode.attrs);
    newAttrs[key] = value;
    const tr = this._view.state.tr.setNodeMarkup(pos, null, newAttrs);
    this._view.dispatch(tr);
  };

  SceneHeadingNodeView.prototype.update = function(node) {
    if (node.type.name !== 'sceneHeading') return false;
    this._node = node;
    // Refresh picker values if attrs changed externally (e.g. undo, paste).
    if (this._settingSelect.value !== node.attrs.setting) {
      _setPickerValue(this._settingSelect, node.attrs.setting, _settingOptions());
    }
    if (this._timeSelect.value !== node.attrs.time) {
      _setPickerValue(this._timeSelect, node.attrs.time, _timeOptions());
    }
    return true;
  };

  SceneHeadingNodeView.prototype.stopEvent = function(event) {
    // Picker change events shouldn't bubble to PM (we already dispatched).
    // Other events fall through.
    if (event.target === this._settingSelect || event.target === this._timeSelect) {
      return event.type === 'change' || event.type === 'mousedown' || event.type === 'click';
    }
    return false;
  };
  SceneHeadingNodeView.prototype.ignoreMutation = function(m) {
    return m.target === this._settingSelect || m.target === this._timeSelect;
  };
  SceneHeadingNodeView.prototype.destroy = function() { /* nothing to clean */ };

  // ============================================================
  // Helpers — picker construction + vocabulary lookup
  // ============================================================

  function _buildPicker(className, options, currentValue, onChange) {
    const select = document.createElement('select');
    select.className = className;
    select.contentEditable = 'false';
    _setPickerValue(select, currentValue, options);
    select.addEventListener('change', function() { onChange(select.value); });
    // Prevent the picker from grabbing focus into PM editor selection.
    select.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    return select;
  }

  function _setPickerValue(select, value, options) {
    // Rebuild options if changed.
    if (select.options.length !== options.length) {
      while (select.firstChild) select.removeChild(select.firstChild);
      options.forEach(function(opt) {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        select.appendChild(o);
      });
    }
    // Append custom value if not in list.
    if (options.indexOf(value) === -1 && value) {
      const o = document.createElement('option');
      o.value = value; o.textContent = value;
      select.appendChild(o);
    }
    select.value = value || (options[0] || '');
  }

  function _activeDoc() {
    return (Rga.TabManager && typeof Rga.TabManager.activeDoc === 'function') ? Rga.TabManager.activeDoc() : null;
  }
  function _vocab() {
    const doc = _activeDoc();
    return (doc && doc.settings && doc.settings.vocabulary) ||
           (Rga.Constants && Rga.Constants.DEFAULT_VOCABULARY) ||
           { settings: ['INT.', 'EXT.'], times: ['DAY', 'NIGHT'], sceneWord: 'SCENE' };
  }
  function _settingOptions() { return _vocab().settings || ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.']; }
  function _timeOptions()    { return _vocab().times    || ['DAY', 'NIGHT', 'CONTINUOUS', 'DUSK', 'DAWN']; }
  function _sceneWord()      { return _vocab().sceneWord || 'SCENE'; }

  // ============================================================
  // Scene plugins — pure doc-state derived index + decorations
  // ============================================================
  // Numbering is delivered to SceneNodeView via NodeDecoration specs
  // emitted by Rga.Nav.buildIndexPlugin(). There is NO DOM walk; the
  // index is computed from the PM document and survives any future
  // filter / focus / pagination transform.
  function buildV3ScenePlugins() {
    if (!(window.Rga && Rga.Nav && typeof Rga.Nav.buildIndexPlugin === 'function')) {
      console.error('[v3-scene-plugins] Rga.Nav.buildIndexPlugin missing — load framework/nav-index.js first');
      return [];
    }
    const plugin = Rga.Nav.buildIndexPlugin();
    return plugin ? [plugin] : [];
  }

  // Helper: read derived scene number off the decoration list PM passes
  // to SceneNodeView's constructor + update().
  function _readNumber(decorations) {
    if (window.Rga && Rga.Nav && typeof Rga.Nav.readNumberFromDecorations === 'function') {
      return Rga.Nav.readNumberFromDecorations(decorations);
    }
    return null;
  }

  // ============================================================
  // Factory aggregator
  // ============================================================

  function buildV3NodeViews() {
    return {
      scene: function(node, view, getPos, decorations) {
        return new SceneNodeView(node, view, getPos, decorations);
      },
      sceneHeading: function(node, view, getPos) {
        return new SceneHeadingNodeView(node, view, getPos);
      }
    };
  }

  Rga.DocTypes.screenplay.buildV3NodeViews = buildV3NodeViews;
  Rga.DocTypes.screenplay.buildV3ScenePlugins = buildV3ScenePlugins;
  // Exposed for tests.
  Rga.DocTypes.screenplay._v3SceneNodeView = SceneNodeView;
  Rga.DocTypes.screenplay._v3SceneHeadingNodeView = SceneHeadingNodeView;
})();
