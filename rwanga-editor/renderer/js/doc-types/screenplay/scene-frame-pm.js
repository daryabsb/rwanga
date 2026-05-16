// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PM-based Scene NodeView (replacement-in-progress for scene-frame-placeholder.js).
//
// Built incrementally to avoid the F2 "eager nested EditorView" failure mode
// recorded in memory: project-ide-f2-no-go. Each step is verified before the
// next so we never reveal a broken intermediate to users mid-build.
//
// Roadmap (each step gets its own commit + user verification):
//   Step 1: file skeleton — DONE (commit 27d4b914^..HEAD).
//   Step 2 (current): slug chrome rendering. Pickers visible, Enter chain
//                     setting→time→location works, edits patch only the
//                     sceneLine in attrs.innerDoc (existing blocks +
//                     transition preserved). Factory exposed but NOT yet
//                     registered.
//   Step 3: routing — screenplay/index.js registers sceneFramePmFactory;
//                     mount.js picks per-doc via metadata.useV2SceneFrame;
//                     playground-the-last-light.rga opts in.
//   Step 4: on-demand inner ProseMirror EditorView mount for one block at a
//           time (PM footnote pattern).
//   Step 5+: block typing cycle, Enter flow, transition picker, trailing-
//            empty pruning, character tinting — each ported one behavior at
//            a time from scene-frame-placeholder.js.
//
// When this module reaches feature parity with the placeholder, the placeholder
// moves to renderer/js/doc-types/screenplay/archived/ and this file renames to
// scene-frame.js. Per feedback-no-orphaned-files.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  // ============================================================
  // Slug helpers — duplicated from scene-frame-placeholder.js to keep the
  // locked module untouched. Collapses to a single copy when v1 archives.
  // ============================================================

  function _vocab() {
    const activeDoc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
    return (activeDoc && activeDoc.settings && activeDoc.settings.vocabulary)
      || (Rga.Constants && Rga.Constants.DEFAULT_VOCABULARY)
      || {};
  }

  function _sceneWord() {
    const v = _vocab();
    if (v.sceneWord) return v.sceneWord;
    const c = Rga.Constants && Rga.Constants.DEFAULT_VOCABULARY;
    return (c && c.sceneWord) || 'SCENE';
  }

  function _settingOptions() {
    return _vocab().settings || ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.'];
  }

  function _timeOptions() {
    return _vocab().times || ['DAY', 'NIGHT', 'CONTINUOUS', 'DUSK', 'DAWN'];
  }

  function _extractSlug(innerDoc) {
    if (innerDoc && Array.isArray(innerDoc.content)) {
      const first = innerDoc.content[0];
      if (first && first.type === 'sceneLine') {
        const setting = (first.attrs && first.attrs.setting) || 'INT.';
        const time    = (first.attrs && first.attrs.time)    || 'DAY';
        let location = '';
        if (Array.isArray(first.content)) {
          first.content.forEach(function(child) {
            if (child.type === 'text' && typeof child.text === 'string') location += child.text;
          });
        }
        return { setting: setting, location: location, time: time };
      }
    }
    return { setting: 'INT.', location: '', time: 'DAY' };
  }

  function _setPickerValue(picker, value, options) {
    if (options.indexOf(value) === -1) {
      const o = document.createElement('option');
      o.className = 'rga-slug-picker-option rga-slug-picker-option-custom';
      o.value = value; o.textContent = value;
      picker.appendChild(o);
    }
    picker.value = value;
  }

  // ============================================================
  // NodeView
  // ============================================================

  function SceneFramePm(node, view, getPos) {
    this._view = view;
    this._getPos = getPos;
    this._node = node;
    this._lastDispatchedInnerDoc = node.attrs.innerDoc;

    // Reuse the placeholder's CSS classes — visually identical chrome.
    this.dom = document.createElement('div');
    this.dom.className = 'rga-scene-frame-placeholder';
    this.dom.setAttribute('contenteditable', 'false');
    this.dom._rgaScenePlaceholder = this; // backref for the toolbar's cache
    this._build(node);
  }

  SceneFramePm.prototype._build = function(node) {
    const self = this;

    // ---- Row 1: SCENE N ----
    this._numEl = document.createElement('div');
    this._numEl.className = 'rga-scene-frame-placeholder-num';
    this.dom.appendChild(this._numEl);

    // ---- Row 2: slug row (setting — time / location) ----
    this._slugRow = document.createElement('div');
    this._slugRow.className = 'rga-scene-frame-placeholder-slug';

    this._settingPicker = document.createElement('select');
    this._settingPicker.className = 'rga-slug-setting-picker';
    _settingOptions().forEach(function(opt) {
      const o = document.createElement('option');
      o.className = 'rga-slug-picker-option';
      o.value = opt; o.textContent = opt;
      self._settingPicker.appendChild(o);
    });
    this._settingPicker.addEventListener('change', function() { self._dispatchSlug(); });
    this._settingPicker.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); self._timePicker.focus(); }
    });

    this._sepA = document.createElement('span');
    this._sepA.className = 'rga-slug-separator rga-slug-sep-major';
    this._sepA.textContent = ' — ';

    this._timePicker = document.createElement('select');
    this._timePicker.className = 'rga-slug-time-picker';
    _timeOptions().forEach(function(opt) {
      const o = document.createElement('option');
      o.className = 'rga-slug-picker-option';
      o.value = opt; o.textContent = opt;
      self._timePicker.appendChild(o);
    });
    this._timePicker.addEventListener('change', function() { self._dispatchSlug(); });
    this._timePicker.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        self._locationInput.focus();
        self._locationInput.select();
      }
    });

    this._sepB = document.createElement('span');
    this._sepB.className = 'rga-slug-separator rga-slug-sep-pair';
    this._sepB.textContent = ' / ';

    this._locationInput = document.createElement('input');
    this._locationInput.type = 'text';
    this._locationInput.className = 'rga-slug-location-input';
    this._locationInput.placeholder = 'Location';
    this._locationInput.addEventListener('input', function() { self._dispatchSlug(); });
    this._locationInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        // TODO Step 4: hand focus off to the first inner block once the
        // inner ProseMirror editor is mounted. For now Enter on location
        // simply blurs — the next step plugs in.
        self._locationInput.blur();
      }
    });

    this._slugRow.appendChild(this._settingPicker);
    this._slugRow.appendChild(this._sepA);
    this._slugRow.appendChild(this._timePicker);
    this._slugRow.appendChild(this._sepB);
    this._slugRow.appendChild(this._locationInput);
    this.dom.appendChild(this._slugRow);

    // ---- Blocks + transition: deferred to later steps. ----
    // The blocks container and transition picker land in Step 4 / Step 5+.

    this._refreshValues(node);
  };

  // Patch only the sceneLine in attrs.innerDoc; preserve every block + the
  // trailing transition untouched. This means an early-iteration v2 user can
  // edit slug values without destroying scene content that v2 doesn't render
  // yet — a safety guarantee while the migration is in progress.
  SceneFramePm.prototype._dispatchSlug = function() {
    if (!this._view || !this._getPos) return;
    const pos = this._getPos();
    if (typeof pos !== 'number') return;
    const outerNode = this._view.state.doc.nodeAt(pos);
    if (!outerNode) return;

    const prevInnerDoc = outerNode.attrs.innerDoc || { type: 'doc', attrs: { notes: '', revisionFlag: null }, content: [] };
    const prevContent = Array.isArray(prevInnerDoc.content) ? prevInnerDoc.content : [];

    const newSceneLine = {
      type: 'sceneLine',
      attrs: { setting: this._settingPicker.value, time: this._timePicker.value },
      content: this._locationInput.value
        ? [{ type: 'text', text: this._locationInput.value }]
        : []
    };

    // Replace the first child if it's a sceneLine; otherwise prepend.
    let restContent;
    if (prevContent.length > 0 && prevContent[0] && prevContent[0].type === 'sceneLine') {
      restContent = prevContent.slice(1);
    } else {
      restContent = prevContent.slice();
    }

    const newInnerDoc = {
      type: 'doc',
      attrs: prevInnerDoc.attrs || { notes: '', revisionFlag: null },
      content: [newSceneLine].concat(restContent)
    };

    this._lastDispatchedInnerDoc = newInnerDoc;
    const newAttrs = Object.assign({}, outerNode.attrs, { innerDoc: newInnerDoc });
    const tr = this._view.state.tr.setNodeMarkup(pos, null, newAttrs);
    this._view.dispatch(tr);
  };

  SceneFramePm.prototype._refreshNum = function(node) {
    this._numEl.textContent = _sceneWord() + ' ' + (node.attrs.number == null ? '?' : node.attrs.number);
    this.dom.dataset.sceneId     = node.attrs.id     || '';
    this.dom.dataset.sceneNumber = node.attrs.number == null ? '' : String(node.attrs.number);
  };

  SceneFramePm.prototype._refreshSlug = function(node) {
    const slug = _extractSlug(node.attrs.innerDoc);
    if (document.activeElement !== this._locationInput && this._locationInput.value !== slug.location) {
      this._locationInput.value = slug.location;
    }
    if (document.activeElement !== this._settingPicker) {
      _setPickerValue(this._settingPicker, slug.setting, _settingOptions());
    }
    if (document.activeElement !== this._timePicker) {
      _setPickerValue(this._timePicker, slug.time, _timeOptions());
    }
  };

  SceneFramePm.prototype._refreshValues = function(node) {
    this._node = node;
    this._refreshNum(node);
    this._refreshSlug(node);
  };

  // PM NodeView contract.
  SceneFramePm.prototype.update = function(node) {
    if (node.type.name !== 'sceneFrame') return false;
    this._refreshValues(node);
    return true;
  };

  // The placeholder is contenteditable=false at the outer; events on our form
  // controls are owned by the browser and must not reach the outer PM view.
  SceneFramePm.prototype.stopEvent = function() { return true; };
  SceneFramePm.prototype.ignoreMutation = function() { return true; };

  // ============================================================
  // Factory — exposed but NOT yet registered with Rga.DocTypes (Step 3).
  // ============================================================
  function sceneFramePmFactory() {
    return function(node, view, getPos) {
      return new SceneFramePm(node, view, getPos);
    };
  }

  Rga.DocTypes.screenplay.sceneFramePmFactory = sceneFramePmFactory;
})();
