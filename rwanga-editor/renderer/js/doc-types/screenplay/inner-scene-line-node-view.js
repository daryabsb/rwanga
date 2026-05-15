// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// SceneLine NodeView for the inner EditorView — segmented Setting/Location/Time
// zones with vocabulary pickers.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  function _pickerItems(zone, docSettings) {
    const vocab = (docSettings && docSettings.vocabulary)
      || (Rga.Constants && Rga.Constants.DEFAULT_VOCABULARY)
      || {};
    if (zone === 'setting') return (vocab.settings || ['INT.', 'EXT.']).slice();
    if (zone === 'time')    return (vocab.times    || ['DAY', 'NIGHT']).slice();
    return [];
  }

  function SceneLineNodeView(node, view, getPos, getSettings) {
    this._view = view;
    this._getPos = getPos;
    this._getSettings = getSettings;
    this._node = node;
    this._picker = null;

    this.dom = document.createElement('div');
    this.dom.className = 'rga-scene-line';
    this.dom._rgaNodeView = this;

    this._settingSpan = document.createElement('span');
    this._settingSpan.className = 'rga-slug-setting';
    this._settingSpan.contentEditable = 'false';
    this._settingSpan.textContent = node.attrs.setting;

    const sep1 = document.createElement('span');
    sep1.className = 'rga-slug-sep';
    sep1.contentEditable = 'false';
    sep1.textContent = ' — ';

    this.contentDOM = document.createElement('span');
    this.contentDOM.className = 'rga-slug-location';

    const sep2 = document.createElement('span');
    sep2.className = 'rga-slug-sep';
    sep2.contentEditable = 'false';
    sep2.textContent = ' — ';

    this._timeSpan = document.createElement('span');
    this._timeSpan.className = 'rga-slug-time';
    this._timeSpan.contentEditable = 'false';
    this._timeSpan.textContent = node.attrs.time;

    this.dom.appendChild(this._settingSpan);
    this.dom.appendChild(sep1);
    this.dom.appendChild(this.contentDOM);
    this.dom.appendChild(sep2);
    this.dom.appendChild(this._timeSpan);

    this._activeZone = 'location';
    this.dom.dataset.activeZone = 'location';

    const self = this;
    this._settingSpan.addEventListener('mousedown', function(e) {
      e.preventDefault();
      self.activateZone('setting');
      self._showPicker('setting');
    });
    this._timeSpan.addEventListener('mousedown', function(e) {
      e.preventDefault();
      self.activateZone('time');
      self._showPicker('time');
    });
  }

  SceneLineNodeView.prototype.activateZone = function(zone) {
    this._activeZone = zone;
    this.dom.dataset.activeZone = zone;
    if (zone === 'location') this._closePicker();
  };

  SceneLineNodeView.prototype.update = function(node) {
    if (node.type.name !== 'sceneLine') return false;
    this._node = node;
    this._settingSpan.textContent = node.attrs.setting;
    this._timeSpan.textContent = node.attrs.time;
    return true;
  };

  SceneLineNodeView.prototype.destroy = function() {
    this._closePicker();
  };

  SceneLineNodeView.prototype._closePicker = function() {
    if (this._picker && this._picker.parentNode) {
      this._picker.parentNode.removeChild(this._picker);
    }
    this._picker = null;
  };

  SceneLineNodeView.prototype._showPicker = function(zone) {
    this._closePicker();
    const settings = this._getSettings ? this._getSettings() : null;
    const items = _pickerItems(zone, settings);
    if (!items.length) return;

    const picker = document.createElement('div');
    picker.className = 'rga-slug-picker';
    picker.contentEditable = 'false';
    const self = this;
    items.forEach(function(item) {
      const opt = document.createElement('div');
      opt.className = 'rga-slug-picker-item';
      opt.textContent = item;
      opt.addEventListener('mousedown', function(e) {
        e.preventDefault();
        self._applyZoneValue(zone, item);
        self._closePicker();
        self.activateZone('location');
      });
      picker.appendChild(opt);
    });

    this.dom.appendChild(picker);
    this._picker = picker;
  };

  SceneLineNodeView.prototype._applyZoneValue = function(zone, value) {
    if (!this._view) return;
    const pos = this._getPos();
    const node = this._view.state.doc.nodeAt(pos);
    if (!node) return;
    const newAttrs = Object.assign({}, node.attrs);
    newAttrs[zone] = value;
    const tr = this._view.state.tr.setNodeMarkup(pos, null, newAttrs);
    this._view.dispatch(tr);
  };

  function sceneLineNodeViewFactory(getSettings) {
    return function(node, view, getPos) {
      return new SceneLineNodeView(node, view, getPos, getSettings);
    };
  }

  Rga.DocTypes.screenplay.sceneLineNodeViewFactory = sceneLineNodeViewFactory;
  Rga.DocTypes.screenplay._sceneLineNodeViewInternals = {
    _pickerItems: _pickerItems,
    SceneLineNodeView: SceneLineNodeView
  };
})();
