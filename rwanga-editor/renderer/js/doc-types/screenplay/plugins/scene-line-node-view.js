// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Scene + SceneLine NodeViews — two-line heading (identity + segmented slug).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  const PM = window.RgaProseMirror;

  // ============================================================
  // SceneNodeView — wraps the whole scene, draws "SCENE N" line
  // ============================================================

  function SceneNodeView(node, view, getPos, getSettings) {
    this._view = view;
    this._getPos = getPos;
    this._getSettings = getSettings;

    this.dom = document.createElement('div');
    this.dom.className = 'rga-scene';

    this._identityLine = document.createElement('div');
    this._identityLine.className = 'rga-scene-identity';
    this._identityLine.contentEditable = 'false';

    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'rga-scene-content';

    this.dom.appendChild(this._identityLine);
    this.dom.appendChild(this.contentDOM);

    this._apply(node);
  }

  SceneNodeView.prototype._apply = function(node) {
    const settings = this._getSettings && this._getSettings();
    const sceneWord = (settings && settings.vocabulary && settings.vocabulary.sceneWord)
      || (Rga.Constants && Rga.Constants.DEFAULT_VOCABULARY && Rga.Constants.DEFAULT_VOCABULARY.sceneWord)
      || 'SCENE';
    const headingStyle = node.attrs.headingStyle
      || (settings && settings.sceneHeadingStyle)
      || 'band';
    this._identityLine.textContent = sceneWord + ' ' + (node.attrs.number || 1);
    this.dom.dataset.sceneId = node.attrs.id || '';
    this.dom.dataset.sceneNumber = node.attrs.number || '';
    this.dom.dataset.headingStyle = headingStyle;
  };

  SceneNodeView.prototype.update = function(node) {
    if (node.type.name !== 'scene') return false;
    this._apply(node);
    return true;
  };

  SceneNodeView.prototype.stopEvent = function(event) {
    // Don't let PM swallow clicks on the identity line (read-only)
    return event.target === this._identityLine;
  };

  SceneNodeView.prototype.ignoreMutation = function(mutation) {
    // PM should ignore mutations inside the identity line (we own it)
    return this._identityLine.contains(mutation.target);
  };

  function sceneNodeViewFactory(getSettings) {
    return function(node, view, getPos) {
      return new SceneNodeView(node, view, getPos, getSettings);
    };
  }

  // ============================================================
  // SceneLineNodeView — the slug line: Setting | Location | Time
  // ============================================================

  function SceneLineNodeView(node, view, getPos, getSettings) {
    this._view = view;
    this._getPos = getPos;
    this._getSettings = getSettings;
    this._picker = null;

    this.dom = document.createElement('div');
    this.dom.className = 'rga-scene-line';
    this.dom._rgaNodeView = this;

    this._settingSpan = document.createElement('span');
    this._settingSpan.className = 'rga-slug-setting';
    this._settingSpan.contentEditable = 'false';
    this._settingSpan.textContent = node.attrs.setting;

    var sep1 = document.createElement('span');
    sep1.className = 'rga-slug-sep';
    sep1.contentEditable = 'false';
    sep1.textContent = ' ';

    this.contentDOM = document.createElement('span');
    this.contentDOM.className = 'rga-slug-location';
    this.contentDOM.dataset.placeholder = 'Location';

    var sep2 = document.createElement('span');
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
    this._reflectEmpty(node);

    this._settingSpan.addEventListener('mousedown', this._onZoneClick.bind(this, 'setting'));
    this._timeSpan.addEventListener('mousedown', this._onZoneClick.bind(this, 'time'));
  }

  SceneLineNodeView.prototype._reflectEmpty = function(node) {
    this.contentDOM.dataset.empty = node.content.size === 0 ? 'true' : 'false';
  };

  SceneLineNodeView.prototype.activateZone = function(zone) {
    this._activeZone = zone;
    this.dom.dataset.activeZone = zone;
    if (zone === 'location') this._closePicker();
  };

  SceneLineNodeView.prototype._onZoneClick = function(zone, e) {
    e.preventDefault();
    e.stopPropagation();
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
    picker.contentEditable = 'false';
    items.forEach(function(item) {
      var opt = document.createElement('div');
      opt.className = 'rga-slug-picker-item';
      opt.textContent = item;
      opt.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        self._applyZoneValue(zone, item);
        self._closePicker();
        self.activateZone('location');
      });
      picker.appendChild(opt);
    });

    this.dom.appendChild(picker);
    this._picker = picker;

    var anchor = zone === 'setting' ? this._settingSpan : this._timeSpan;
    picker.style.left = anchor.offsetLeft + 'px';
    picker.style.top = (anchor.offsetTop + anchor.offsetHeight + 2) + 'px';
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
    this._reflectEmpty(node);
    return true;
  };

  SceneLineNodeView.prototype.stopEvent = function(event) {
    if (!event.target) return false;
    var t = event.target;
    if (t === this._settingSpan || t === this._timeSpan) return true;
    if (t.classList && (
      t.classList.contains('rga-slug-setting') ||
      t.classList.contains('rga-slug-time') ||
      t.classList.contains('rga-slug-picker') ||
      t.classList.contains('rga-slug-picker-item')
    )) return true;
    return false;
  };

  SceneLineNodeView.prototype.ignoreMutation = function(mutation) {
    // PM must ignore mutations inside the non-editable zones and picker
    if (this._picker && this._picker.contains(mutation.target)) return true;
    if (this._settingSpan.contains(mutation.target)) return true;
    if (this._timeSpan.contains(mutation.target)) return true;
    return false;
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

  function sceneLineNodeViewFactory(getSettings) {
    return function(node, view, getPos) {
      return new SceneLineNodeView(node, view, getPos, getSettings);
    };
  }

  // ============================================================
  // Zone-key plugin — handles keyboard when a non-location zone is active
  // ============================================================

  function zoneKeyPlugin() {
    return new PM.Plugin({
      props: {
        handleKeyDown: function(view, event) {
          // Edge transitions inside location zone
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            var locationLine = document.querySelector('.rga-scene-line[data-active-zone="location"]');
            if (locationLine && locationLine._rgaNodeView) {
              var $head = view.state.selection.$head;
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

          var activeLine = document.querySelector(
            '.rga-scene-line[data-active-zone="setting"], .rga-scene-line[data-active-zone="time"]'
          );
          if (!activeLine || !activeLine._rgaNodeView) return false;
          var nv = activeLine._rgaNodeView;

          if (!nv._picker) nv._showPicker(nv._activeZone);

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

          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ||
              event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            nv._closePicker();
            nv.activateZone('location');
            return false;
          }

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
  // Auto-renumber plugin — keeps scene.attrs.number in document order
  // ============================================================

  function autoRenumberPlugin() {
    return new PM.Plugin({
      appendTransaction: function(transactions, oldState, newState) {
        var docChanged = transactions.some(function(tr) { return tr.docChanged; });
        if (!docChanged) return null;

        var updates = [];
        var n = 0;
        newState.doc.descendants(function(node, pos) {
          if (node.type.name === 'scene') {
            n += 1;
            if (node.attrs.number !== n) {
              updates.push({ pos: pos, attrs: Object.assign({}, node.attrs, { number: n }) });
            }
            return false; // don't descend into scene
          }
          return true;
        });

        if (!updates.length) return null;
        var tr = newState.tr;
        updates.forEach(function(u) { tr.setNodeMarkup(u.pos, null, u.attrs); });
        tr.setMeta('addToHistory', false);
        return tr;
      }
    });
  }

  // ============================================================
  // Exports
  // ============================================================

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.sceneLineNodeViewFactory = sceneLineNodeViewFactory;
  Rga.DocTypes.screenplay.sceneNodeViewFactory = sceneNodeViewFactory;
  Rga.DocTypes.screenplay.zoneKeyPlugin = zoneKeyPlugin;
  Rga.DocTypes.screenplay.autoRenumberPlugin = autoRenumberPlugin;
})();
