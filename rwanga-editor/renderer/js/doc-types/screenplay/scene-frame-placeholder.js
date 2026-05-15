// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// SceneFramePlaceholder NodeView. Renders an interactive scene container:
//   row 1: "SCENE N" header
//   row 2: setting picker / location input / time picker  (the slug)
//   row 3+: writable block divs (action / character / dialogue / shot / transition)
//
// Each block is its own contenteditable=true div with a `rga-block-<type>` class.
// Tab/Shift-Tab cycle the focused block's type; Enter inserts a new block whose
// type depends on the source. All edits write back to attrs.innerDoc via
// setNodeMarkup on the outer view; the loop guard prevents the outer
// re-render from clobbering the user's typing.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  // ============================================================
  // Cycle tables (per user 2026-05-15)
  // ============================================================
  // Transition is structural — always the last line of the scene as a picker.
  // It is NOT part of the Tab cycle anymore.
  //   Tab forward:  action → character → dialogue → shot → (wrap) action
  //   Tab backward: action → shot → dialogue → character → (wrap) action
  // Enter (block creation):
  //   action→action, character→dialogue, dialogue→dialogue,
  //   shot→action, parenthetical→dialogue
  // ============================================================

  const FORWARD_TAB = {
    action:    'character',
    character: 'dialogue',
    dialogue:  'shot',
    shot:      'action'
  };

  const BACKWARD_TAB = {
    action:    'shot',
    character: 'action',
    dialogue:  'character',
    shot:      'dialogue'
  };

  const ENTER_NEXT = {
    action:         'action',
    character:      'dialogue',
    dialogue:       'dialogue',
    shot:           'action',
    parenthetical:  'dialogue',
    inlineFreeText: 'inlineFreeText'
  };

  const BLOCK_PLACEHOLDER = {
    action:         'Action…',
    character:      'CHARACTER',
    dialogue:       'Dialogue…',
    parenthetical:  '(parenthetical)',
    shot:           'SHOT',
    inlineFreeText: 'Note…'
  };

  // Transition vocabulary (extend or move to doc.settings.vocabulary.transitions later)
  const TRANSITION_OPTIONS = [
    'CUT', 'MIX', 'FADE IN', 'FADE OUT', 'DISSOLVE', 'MATCH CUT', 'SMASH CUT', 'JUMP CUT'
  ];

  // ============================================================
  // Helpers
  // ============================================================

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

  function _sceneWord() {
    const activeDoc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
    const vocab = activeDoc && activeDoc.settings && activeDoc.settings.vocabulary;
    if (vocab && vocab.sceneWord) return vocab.sceneWord;
    const c = Rga.Constants && Rga.Constants.DEFAULT_VOCABULARY;
    return (c && c.sceneWord) || 'SCENE';
  }

  function _vocab() {
    const activeDoc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
    return (activeDoc && activeDoc.settings && activeDoc.settings.vocabulary)
      || (Rga.Constants && Rga.Constants.DEFAULT_VOCABULARY)
      || {};
  }

  function _settingOptions() {
    const v = _vocab();
    return v.settings || ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.'];
  }

  function _timeOptions() {
    const v = _vocab();
    return v.times || ['DAY', 'NIGHT', 'CONTINUOUS', 'DUSK', 'DAWN'];
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

  function _extractBlocks(innerDoc) {
    if (!innerDoc || !Array.isArray(innerDoc.content)) return [];
    return innerDoc.content.slice(1).map(function(node) {
      let text = '';
      if (Array.isArray(node.content)) {
        node.content.forEach(function(child) {
          if (child.type === 'text' && typeof child.text === 'string') text += child.text;
        });
      }
      return { type: node.type, text: text };
    });
  }

  // Pull the trailing transition block's text out of innerDoc.
  // Returns "CUT" by default if no transition exists.
  function _extractTransition(innerDoc) {
    if (innerDoc && Array.isArray(innerDoc.content)) {
      for (let i = innerDoc.content.length - 1; i >= 1; i -= 1) {
        const node = innerDoc.content[i];
        if (node.type === 'transition') {
          let text = '';
          if (Array.isArray(node.content)) {
            node.content.forEach(function(c) {
              if (c.type === 'text' && typeof c.text === 'string') text += c.text;
            });
          }
          return text || 'CUT';
        }
      }
    }
    return 'CUT';
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

  function SceneFramePlaceholder(node, view, getPos) {
    this._view = view;
    this._getPos = getPos;
    this._node = node;
    this._lastDispatchedInnerDoc = node.attrs.innerDoc; // loop guard

    this.dom = document.createElement('div');
    this.dom.className = 'rga-scene-frame-placeholder';
    this.dom.setAttribute('contenteditable', 'false');
    this._build(node);
  }

  SceneFramePlaceholder.prototype._build = function(node) {
    const self = this;

    // ---- Row 1: SCENE N ----
    this._numEl = document.createElement('div');
    this._numEl.className = 'rga-scene-frame-placeholder-num';
    this.dom.appendChild(this._numEl);

    // ---- Row 2: slug row ----
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
    this._settingPicker.addEventListener('change', function() { self._dispatchInner(); });
    this._settingPicker.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        self._locationInput.focus();
        self._locationInput.select();
      }
    });

    this._sepA = document.createElement('span');
    this._sepA.className = 'rga-slug-separator';
    this._sepA.textContent = ' ';

    this._locationInput = document.createElement('input');
    this._locationInput.type = 'text';
    this._locationInput.className = 'rga-slug-location-input';
    this._locationInput.placeholder = 'Location';
    this._locationInput.addEventListener('input', function() { self._dispatchInner(); });
    this._locationInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        self._timePicker.focus();
      }
    });

    this._sepB = document.createElement('span');
    this._sepB.className = 'rga-slug-separator';
    this._sepB.textContent = ' ';

    this._timePicker = document.createElement('select');
    this._timePicker.className = 'rga-slug-time-picker';
    _timeOptions().forEach(function(opt) {
      const o = document.createElement('option');
      o.className = 'rga-slug-picker-option';
      o.value = opt; o.textContent = opt;
      self._timePicker.appendChild(o);
    });
    this._timePicker.addEventListener('change', function() { self._dispatchInner(); });
    this._timePicker.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstBlock = self._blocksContainer && self._blocksContainer.firstElementChild;
        if (firstBlock && typeof firstBlock.focus === 'function') firstBlock.focus();
      }
    });

    this._slugRow.appendChild(this._settingPicker);
    this._slugRow.appendChild(this._sepA);
    this._slugRow.appendChild(this._locationInput);
    this._slugRow.appendChild(this._sepB);
    this._slugRow.appendChild(this._timePicker);
    this.dom.appendChild(this._slugRow);

    // ---- Row 3+: blocks container ----
    this._blocksContainer = document.createElement('div');
    this._blocksContainer.className = 'rga-scene-frame-placeholder-blocks';
    this.dom.appendChild(this._blocksContainer);

    // ---- Last row: transition picker (structural — always present) ----
    this._transitionRow = document.createElement('div');
    this._transitionRow.className = 'rga-scene-frame-placeholder-transition';

    this._transitionPicker = document.createElement('select');
    this._transitionPicker.className = 'rga-slug-transition-picker';
    TRANSITION_OPTIONS.forEach(function(opt) {
      const o = document.createElement('option');
      o.className = 'rga-slug-picker-option';
      o.value = opt; o.textContent = opt;
      self._transitionPicker.appendChild(o);
    });
    this._transitionPicker.addEventListener('change', function() {
      self._pruneTrailingEmpties();
      self._dispatchInner();
    });
    this._transitionPicker.addEventListener('focus', function() {
      self._pruneTrailingEmpties();
      self._dispatchInner();
    });
    this._transitionPicker.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Stay inside the frame: append an empty action block above the
        // transition so the user can either type a note there OR press Enter
        // again to spawn the next scene (existing block-keydown rule:
        // Enter on empty trailing block → spawn next scene).
        const newEl = self._appendBlock('action', '');
        newEl.focus();
        self._dispatchInner();
      }
    });

    this._transitionRow.appendChild(this._transitionPicker);
    this.dom.appendChild(this._transitionRow);

    this._renderBlocks(node);
    this._refreshSlug(node);
    this._refreshTransition(node);
    this._refreshNum(node);
  };

  // ---- block rendering ---------------------------------------

  SceneFramePlaceholder.prototype._renderBlocks = function(node) {
    while (this._blocksContainer.firstChild) {
      this._blocksContainer.removeChild(this._blocksContainer.firstChild);
    }
    // Transition blocks belong to the bottom picker, not the blocks container.
    const blocks = _extractBlocks(node.attrs.innerDoc).filter(function(b) {
      return b.type !== 'transition';
    });
    if (blocks.length === 0) {
      // Brand-new scene: seed one empty action block
      this._appendBlock('action', '');
    } else {
      const self = this;
      blocks.forEach(function(b) { self._appendBlock(b.type, b.text); });
    }
  };

  SceneFramePlaceholder.prototype._appendBlock = function(type, text) {
    const el = this._createBlockEl(type, text);
    this._blocksContainer.appendChild(el);
    return el;
  };

  SceneFramePlaceholder.prototype._insertBlockAfter = function(refEl, type, text) {
    const el = this._createBlockEl(type, text);
    this._blocksContainer.insertBefore(el, refEl.nextSibling);
    return el;
  };

  SceneFramePlaceholder.prototype._createBlockEl = function(type, text) {
    const el = document.createElement('div');
    el.className = 'rga-scene-block rga-block-' + type;
    el.dataset.blockType = type;
    el.contentEditable = 'true';
    el.textContent = text || '';
    el.setAttribute('data-placeholder', BLOCK_PLACEHOLDER[type] || '');
    this._wireBlockEvents(el);
    return el;
  };

  SceneFramePlaceholder.prototype._wireBlockEvents = function(el) {
    const self = this;
    el.addEventListener('input', function() { self._dispatchInner(); });
    el.addEventListener('keydown', function(ev) { self._onBlockKeydown(el, ev); });
    el.addEventListener('blur', function() {
      // When focus leaves the blocks area entirely, prune trailing empties so
      // the transition picker becomes the visible last line.
      setTimeout(function() {
        const ae = document.activeElement;
        if (ae && self._blocksContainer.contains(ae)) return;
        self._pruneTrailingEmpties();
      }, 0);
    });
  };

  // Trim any empty trailing block divs so the transition row sits flush
  // against the last filled block.
  SceneFramePlaceholder.prototype._pruneTrailingEmpties = function() {
    let changed = false;
    while (this._blocksContainer.children.length > 1) {
      const last = this._blocksContainer.lastElementChild;
      if (last.textContent.length > 0) break;
      if (last === document.activeElement) break;
      this._blocksContainer.removeChild(last);
      changed = true;
    }
    if (changed) this._dispatchInner();
  };

  SceneFramePlaceholder.prototype._changeBlockType = function(el, newType) {
    el.dataset.blockType = newType;
    el.className = 'rga-scene-block rga-block-' + newType;
    el.setAttribute('data-placeholder', BLOCK_PLACEHOLDER[newType] || '');
  };

  // ---- key handling ------------------------------------------

  SceneFramePlaceholder.prototype._onBlockKeydown = function(el, event) {
    const type = el.dataset.blockType;

    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      const nextType = FORWARD_TAB[type];
      if (nextType) {
        this._changeBlockType(el, nextType);
        this._dispatchInner();
      }
      // else: type not in cycle (dialogue/parenthetical/inlineFreeText) — swallow
      return;
    }

    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      const prevType = BACKWARD_TAB[type];
      if (prevType) {
        this._changeBlockType(el, prevType);
        this._dispatchInner();
      }
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      // "Second enter" — if cursor is on an empty trailing block, escalate to
      // spawning a brand new scene below the current frame, with a blank
      // paragraph between for spacing.
      if (el.textContent.length === 0 && this._blocksContainer.children.length > 1) {
        event.preventDefault();
        this._spawnNextScene();
        return;
      }
      event.preventDefault();
      const nextType = ENTER_NEXT[type] || type;
      const newEl = this._insertBlockAfter(el, nextType, '');
      newEl.focus();
      this._dispatchInner();
      return;
    }

    // Backspace at start of empty block (not the first one) — remove this block
    // and move focus to the end of the previous block.
    if (event.key === 'Backspace' && el.textContent.length === 0) {
      const prev = el.previousElementSibling;
      if (prev && prev.classList.contains('rga-scene-block')) {
        event.preventDefault();
        el.parentNode.removeChild(el);
        prev.focus();
        // place caret at end of prev
        const range = document.createRange();
        range.selectNodeContents(prev);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        this._dispatchInner();
      }
      return;
    }

    // Other keys: default browser editing behavior
  };

  // ---- spawn next scene -------------------------------------

  SceneFramePlaceholder.prototype._spawnNextScene = function() {
    if (!this._view || !this._getPos) return;
    const view = this._view;
    const schema = view.state.schema;
    const sceneFrameType = schema.nodes.sceneFrame;
    const paragraphType = schema.nodes.paragraph;
    if (!sceneFrameType) return;

    const myPos = this._getPos();
    if (typeof myPos !== 'number') return;
    const myNode = view.state.doc.nodeAt(myPos);
    if (!myNode || myNode.type !== sceneFrameType) return;

    let sceneCount = 0;
    view.state.doc.descendants(function(node) {
      if (node.type === sceneFrameType) sceneCount += 1;
      return true;
    });

    const newId = 'scene-' + Date.now().toString(36);
    const newFrame = sceneFrameType.create({
      id: newId,
      number: sceneCount + 1,
      headingStyle: null,
      innerDoc: null
    });

    const afterCurrent = myPos + myNode.nodeSize;
    let tr = view.state.tr;
    let newFramePos = afterCurrent;

    // Blank paragraph between scenes (per "leave one line as space")
    if (paragraphType) {
      tr = tr.insert(afterCurrent, paragraphType.create());
      newFramePos = afterCurrent + 2; // paragraph is 2 positions wide (open + close)
    }
    tr = tr.insert(newFramePos, newFrame);

    // Trailing paragraph so outer cursor always has somewhere to land
    const afterNewFrame = newFramePos + newFrame.nodeSize;
    const nodeAfter = tr.doc.resolve(afterNewFrame).nodeAfter;
    if (!nodeAfter && paragraphType) {
      tr.insert(afterNewFrame, paragraphType.create());
    }

    view.dispatch(tr.scrollIntoView());

    // Focus the new scene's setting picker (same UX as Ctrl+Enter)
    if (typeof view.nodeDOM === 'function') {
      const frameDom = view.nodeDOM(newFramePos);
      if (frameDom && frameDom.querySelector) {
        const settingPicker = frameDom.querySelector('.rga-slug-setting-picker');
        if (settingPicker && typeof settingPicker.focus === 'function') {
          settingPicker.focus();
        }
      }
    }
  };

  // ---- dispatch + refresh -----------------------------------

  SceneFramePlaceholder.prototype._buildInnerDoc = function() {
    const sceneLine = {
      type: 'sceneLine',
      attrs: { setting: this._settingPicker.value, time: this._timePicker.value },
      content: this._locationInput.value ? [{ type: 'text', text: this._locationInput.value }] : []
    };
    const blocks = Array.prototype.slice.call(this._blocksContainer.children).map(function(el) {
      const text = el.textContent;
      return {
        type: el.dataset.blockType,
        content: text ? [{ type: 'text', text: text }] : []
      };
    });

    // Strip trailing empty blocks so the saved doc never carries them.
    // The block currently holding focus is preserved (user is mid-edit).
    const focusedEl = document.activeElement;
    let focusedIndex = -1;
    if (focusedEl && this._blocksContainer.contains(focusedEl)) {
      focusedIndex = Array.prototype.indexOf.call(this._blocksContainer.children, focusedEl);
    }
    while (blocks.length > 0) {
      const lastIdx = blocks.length - 1;
      const last = blocks[lastIdx];
      if (last.content.length > 0) break;
      if (lastIdx === focusedIndex) break;
      blocks.pop();
    }

    // Always end the scene with a transition block (picker value, default CUT).
    const transitionText = (this._transitionPicker && this._transitionPicker.value) || 'CUT';
    blocks.push({
      type: 'transition',
      content: [{ type: 'text', text: transitionText }]
    });

    return {
      type: 'doc',
      attrs: { notes: '', revisionFlag: null },
      content: [sceneLine].concat(blocks)
    };
  };

  SceneFramePlaceholder.prototype._dispatchInner = function() {
    if (!this._view || !this._getPos) return;
    const pos = this._getPos();
    if (typeof pos !== 'number') return;
    const outerNode = this._view.state.doc.nodeAt(pos);
    if (!outerNode) return;
    const innerDoc = this._buildInnerDoc();
    this._lastDispatchedInnerDoc = innerDoc;
    const newAttrs = Object.assign({}, outerNode.attrs, { innerDoc: innerDoc });
    const tr = this._view.state.tr.setNodeMarkup(pos, null, newAttrs);
    this._view.dispatch(tr);
  };

  SceneFramePlaceholder.prototype._refreshNum = function(node) {
    this._numEl.textContent = _sceneWord() + ' ' + (node.attrs.number == null ? '?' : node.attrs.number);
    this.dom.dataset.sceneId     = node.attrs.id     || '';
    this.dom.dataset.sceneNumber = node.attrs.number == null ? '' : String(node.attrs.number);
  };

  SceneFramePlaceholder.prototype._refreshSlug = function(node) {
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

  SceneFramePlaceholder.prototype._refreshTransition = function(node) {
    if (!this._transitionPicker) return;
    if (document.activeElement === this._transitionPicker) return;
    const value = _extractTransition(node.attrs.innerDoc);
    _setPickerValue(this._transitionPicker, value, TRANSITION_OPTIONS);
  };

  SceneFramePlaceholder.prototype._refreshValues = function(node) {
    this._node = node;
    this._refreshNum(node);
    // Loop guard: if this update came from our own dispatch, the DOM already
    // matches; rebuilding blocks would destroy focus mid-keystroke.
    if (node.attrs.innerDoc !== this._lastDispatchedInnerDoc) {
      this._renderBlocks(node);
    }
    this._refreshSlug(node);
    this._refreshTransition(node);
  };

  SceneFramePlaceholder.prototype.update = function(node) {
    if (node.type.name !== 'sceneFrame') return false;
    this._refreshValues(node);
    return true;
  };

  SceneFramePlaceholder.prototype.stopEvent = function() {
    // The whole placeholder is contenteditable=false at the outer level.
    // Events on our form controls / block divs are handled by the browser
    // and never reach the outer PM view.
    return true;
  };

  SceneFramePlaceholder.prototype.ignoreMutation = function() {
    return true;
  };

  function sceneFramePlaceholderFactory() {
    return function(node, view, getPos) {
      return new SceneFramePlaceholder(node, view, getPos);
    };
  }

  Rga.DocTypes.screenplay.sceneFramePlaceholderFactory = sceneFramePlaceholderFactory;
  Rga.DocTypes.screenplay._slugPreview = _slugPreview; // kept for unit tests
})();
