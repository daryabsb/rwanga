// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// SceneLine NodeView — segmented slug zones (Setting / Location / Time).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  const PM = window.RgaProseMirror;

  // ============================================================
  // SceneLineNodeView
  // ============================================================

  function SceneLineNodeView(node, view, getPos, getSettings) {
    this._view = view;
    this._getPos = getPos;
    this._getSettings = getSettings;
    this._picker = null;

    // Root element — PM treats this as `dom`
    this.dom = document.createElement('div');
    this.dom.className = 'rga-scene-line';
    this.dom._rgaNodeView = this;  // backref for keymap commands

    // Setting zone (non-editable)
    this._settingSpan = document.createElement('span');
    this._settingSpan.className = 'rga-slug-setting';
    this._settingSpan.contentEditable = 'false';
    this._settingSpan.textContent = node.attrs.setting;

    // Separator 1
    var sep1 = document.createElement('span');
    sep1.className = 'rga-slug-sep';
    sep1.contentEditable = 'false';
    sep1.textContent = ' — ';  // em dash

    // Location zone — this is contentDOM (PM renders inline* here)
    this.contentDOM = document.createElement('span');
    this.contentDOM.className = 'rga-slug-location';

    // Separator 2
    var sep2 = document.createElement('span');
    sep2.className = 'rga-slug-sep';
    sep2.contentEditable = 'false';
    sep2.textContent = ' — ';

    // Time zone (non-editable)
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

    this._settingSpan.addEventListener('mousedown', this._onZoneClick.bind(this, 'setting'));
    this._timeSpan.addEventListener('mousedown', this._onZoneClick.bind(this, 'time'));
  }

  SceneLineNodeView.prototype.activateZone = function(zone) {
    this._activeZone = zone;
    this.dom.dataset.activeZone = zone;
    if (zone === 'location') this._closePicker();
  };

  SceneLineNodeView.prototype._onZoneClick = function(zone, e) {
    e.preventDefault();
    this.activateZone(zone);
    this._showPicker(zone);
  };

  SceneLineNodeView.prototype._showPicker = function(zone) {
    this._closePicker();

    var self = this;
    var settings = this._getSettings && this._getSettings();
    var vocab = (settings && settings.vocabulary)
      || (Rga.Constants && Rga.Constants.DEFAULT_VOCABULARY)
      || {};
    var items = zone === 'setting'
      ? (vocab.settings || ['INT.', 'EXT.', 'INT./EXT.'])
      : (vocab.times || ['DAY', 'NIGHT', 'CONTINUOUS']);

    var picker = document.createElement('div');
    picker.className = 'rga-slug-picker';
    items.forEach(function(item) {
      var opt = document.createElement('div');
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

    // Position below the active span
    var anchor = zone === 'setting' ? this._settingSpan : this._timeSpan;
    var rect = anchor.getBoundingClientRect();
    var domRect = this.dom.getBoundingClientRect();
    picker.style.left = (rect.left - domRect.left) + 'px';
  };

  SceneLineNodeView.prototype._closePicker = function() {
    if (this._picker && this._picker.parentNode) {
      this._picker.parentNode.removeChild(this._picker);
    }
    this._picker = null;
  };

  SceneLineNodeView.prototype._applyZoneValue = function(zone, value) {
    var view = this._view;
    var pos = this._getPos();
    var node = view.state.doc.nodeAt(pos);
    if (!node) return;
    var attrs = zone === 'setting'
      ? Object.assign({}, node.attrs, { setting: value })
      : Object.assign({}, node.attrs, { time: value });
    view.dispatch(view.state.tr.setNodeMarkup(pos, null, attrs));
  };

  SceneLineNodeView.prototype.update = function(node) {
    if (node.type.name !== 'sceneLine') return false;
    this._settingSpan.textContent = node.attrs.setting;
    this._timeSpan.textContent = node.attrs.time;
    return true;
  };

  SceneLineNodeView.prototype.selectNode = function() {
    this.activateZone('location');
  };

  SceneLineNodeView.prototype.deselectNode = function() {
    this._closePicker();
    this._activeZone = 'location';
    this.dom.dataset.activeZone = 'location';
  };

  SceneLineNodeView.prototype.destroy = function() {
    this._closePicker();
  };

  // ============================================================
  // Factory
  // ============================================================

  function sceneLineNodeViewFactory(getSettings) {
    return function(node, view, getPos) {
      return new SceneLineNodeView(node, view, getPos, getSettings);
    };
  }

  // ============================================================
  // Zone-key plugin
  // ============================================================

  function zoneKeyPlugin() {
    return new PM.Plugin({
      props: {
        handleKeyDown: function(view, event) {
          // ArrowLeft/Right edge transitions when cursor is IN the location zone
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            var locationLine = document.querySelector('.rga-scene-line[data-active-zone="location"]');
            if (locationLine && locationLine._rgaNodeView) {
              var sel = view.state.selection;
              var $head = sel.$head;
              if ($head.parent.type.name === 'sceneLine') {
                var nv2 = locationLine._rgaNodeView;
                if (event.key === 'ArrowLeft' && $head.parentOffset === 0) {
                  nv2.activateZone('setting');
                  nv2._showPicker('setting');
                  event.preventDefault();
                  return true;
                }
                if (event.key === 'ArrowRight' && $head.parentOffset === $head.parent.content.size) {
                  nv2.activateZone('time');
                  nv2._showPicker('time');
                  event.preventDefault();
                  return true;
                }
              }
            }
          }

          // Find any scene-line with a non-location active zone
          var activeLine = document.querySelector(
            '.rga-scene-line[data-active-zone="setting"], .rga-scene-line[data-active-zone="time"]'
          );
          if (!activeLine || !activeLine._rgaNodeView) return false;
          var nv = activeLine._rgaNodeView;

          // Show picker if it isn't open yet (triggered by keymap zone activation)
          if (!nv._picker) {
            nv._showPicker(nv._activeZone);
          }

          if (event.key === 'Tab' && !event.shiftKey) {
            if (nv._activeZone === 'setting') {
              nv._closePicker();
              nv.activateZone('location');
              event.preventDefault();
              return true;
            }
            if (nv._activeZone === 'time') {
              nv._closePicker();
              nv.activateZone('location');
              event.preventDefault();
              var enterBehavior = Rga.DocTypes
                && Rga.DocTypes.screenplay
                && Rga.DocTypes.screenplay._keymapInternals
                && Rga.DocTypes.screenplay._keymapInternals.enterBehavior;
              if (enterBehavior) {
                return enterBehavior(Rga.DocTypes.screenplay.schema)(view.state, view.dispatch, view);
              }
              return true;
            }
          }

          if (event.key === 'Tab' && event.shiftKey) {
            nv._closePicker();
            nv.activateZone('location');
            event.preventDefault();
            return true;
          }

          if (event.key === 'Enter') {
            nv._closePicker();
            nv.activateZone('location');
            event.preventDefault();
            var eb = Rga.DocTypes
              && Rga.DocTypes.screenplay
              && Rga.DocTypes.screenplay._keymapInternals
              && Rga.DocTypes.screenplay._keymapInternals.enterBehavior;
            if (eb) {
              return eb(Rga.DocTypes.screenplay.schema)(view.state, view.dispatch, view);
            }
            return true;
          }

          if (event.key === 'Escape') {
            nv._closePicker();
            nv.activateZone('location');
            event.preventDefault();
            return true;
          }

          // Arrow keys from non-location zone → reset to location
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ||
              event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            nv._closePicker();
            nv.activateZone('location');
            return false;
          }

          // Intercept all other typing on non-location zones (read-only until picker selection)
          if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault();
            return true;
          }

          return false;
        }
      }
    });
  }

  // ============================================================
  // Exports
  // ============================================================

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.sceneLineNodeViewFactory = sceneLineNodeViewFactory;
  Rga.DocTypes.screenplay.zoneKeyPlugin = zoneKeyPlugin;
})();
