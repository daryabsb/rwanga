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
  // Block-type cycle tables — mirror v1 placeholder behavior.
  // Transition is structural (last picker row), not in the cycle.
  // ============================================================
  const FORWARD_TAB  = { action: 'character', character: 'dialogue', dialogue: 'shot', shot: 'action' };
  const BACKWARD_TAB = { action: 'shot',     character: 'action',   dialogue: 'character', shot: 'dialogue' };

  const TRANSITION_OPTIONS = [
    'CUT', 'MIX', 'FADE IN', 'FADE OUT', 'DISSOLVE', 'MATCH CUT', 'SMASH CUT', 'JUMP CUT'
  ];

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

  // Read the trailing transition text out of innerDoc. Defaults to 'CUT'
  // when no transition node is present (consistent with v1 placeholder).
  function _extractTransition(innerDoc) {
    if (innerDoc && Array.isArray(innerDoc.content)) {
      for (let i = innerDoc.content.length - 1; i >= 1; i -= 1) {
        const node = innerDoc.content[i];
        if (node && node.type === 'transition') {
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

  // Pull every non-sceneLine, non-transition block out of innerDoc as
  // { type, text } records. Transition is structural (its own picker row).
  function _extractBlocks(innerDoc) {
    if (!innerDoc || !Array.isArray(innerDoc.content)) return [];
    return innerDoc.content.slice(1)
      .filter(function(node) { return node && node.type !== 'transition'; })
      .map(function(node) {
        let text = '';
        if (Array.isArray(node.content)) {
          node.content.forEach(function(child) {
            if (child.type === 'text' && typeof child.text === 'string') text += child.text;
          });
        }
        return { type: node.type, text: text };
      });
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
  // Inner ProseMirror schema
  // ============================================================
  // Step 4b: doc -> paragraph+ -> text (no marks).
  // Step 5a: adds the four simple toggle marks (bold/italic/underline/
  //          strikethrough) — lifted from Rga.Framework.baseOuterMarks so
  //          the inner and outer schemas can't drift apart on shared
  //          marks. Mark specs have no attrs and serialize cleanly via
  //          the existing parseDOM/toDOM rules.
  // Later steps add color/highlight (5b), annotation/tag/revisionFlag (5c+).
  //
  // Lazy-init so the module loads before window.RgaProseMirror is ready.
  let _innerSchema = null;
  function _getInnerSchema() {
    if (_innerSchema) return _innerSchema;
    const PM = window.RgaProseMirror;
    if (!PM || !PM.Schema) return null;
    const baseOuterMarks = (Rga.Framework && Rga.Framework.baseOuterMarks) || {};
    const innerMarks = {};
    ['bold', 'italic', 'underline', 'strikethrough'].forEach(function(name) {
      if (baseOuterMarks[name]) innerMarks[name] = baseOuterMarks[name];
    });
    _innerSchema = new PM.Schema({
      nodes: {
        doc:       { content: 'paragraph+' },
        paragraph: { content: 'text*', toDOM: function() { return ['p', 0]; } },
        text:      {}
      },
      marks: innerMarks
    });
    return _innerSchema;
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
    this._settingPicker.addEventListener('change', function() { self._dispatchInner(); });
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
    this._timePicker.addEventListener('change', function() { self._dispatchInner(); });
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
    this._locationInput.addEventListener('input', function() { self._dispatchInner(); });
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

    // ---- Row 3+: blocks container ----
    // Step 4a: read-only render of each block as a static div. Same CSS
    // classes as the locked v1 placeholder so Flow-view typography applies
    // unchanged. Step 4b mounts an inner ProseMirror EditorView in place of
    // a block when the user clicks to edit.
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
    this._transitionPicker.addEventListener('change', function() { self._dispatchInner(); });
    this._transitionRow.appendChild(this._transitionPicker);
    this.dom.appendChild(this._transitionRow);

    // Initial block render — bypasses the loop guard in _refreshValues
    // (which exists for echo updates after self-dispatch). Mirrors the v1
    // placeholder's pattern at scene-frame-placeholder.js:311.
    this._renderBlocksReadOnly(node);
    this._refreshValues(node);
  };

  // Step 4d: dispose of an inner PM EditorView attached to a block div.
  // Must be called before removing the block from the DOM, otherwise PM
  // listeners + plugin state leak. Safe to call on a block that was never
  // mounted (no-op).
  SceneFramePm.prototype._destroyBlockInnerEditor = function(blockEl) {
    if (!blockEl || !blockEl._innerView) return;
    try { blockEl._innerView.destroy(); } catch (_) { /* swallow — already destroyed */ }
    blockEl._innerView = null;
  };

  // Step 4a: render each block from attrs.innerDoc as a non-editable div.
  // Step 4b: clicking a block mounts a tiny inner PM EditorView in place.
  // Step 4d: each existing block's inner editor is properly destroyed
  // before the container is cleared, so re-renders don't leak PM state.
  // Idempotent: called on initial build and on every external node update.
  // The loop guard in _refreshValues prevents echo re-renders from
  // self-dispatch destroying a mounted inner editor mid-keystroke.
  SceneFramePm.prototype._renderBlocksReadOnly = function(node) {
    const container = this._blocksContainer;
    if (!container) return;
    const self = this;
    Array.prototype.slice.call(container.children).forEach(function(child) {
      self._destroyBlockInnerEditor(child);
    });
    while (container.firstChild) container.removeChild(container.firstChild);

    const blocks = _extractBlocks(node.attrs.innerDoc);
    blocks.forEach(function(b, index) {
      const el = document.createElement('div');
      el.className = 'rga-scene-block rga-block-' + b.type;
      el.dataset.blockType = b.type;
      el.dataset.blockIndex = String(index);
      el.contentEditable = 'false';
      el.textContent = b.text;
      // Click handler kept as a defensive fallback: the eager mount below
      // should always have populated _innerView already, in which case the
      // guard inside _mountInnerEditor makes this a no-op. shouldFocus=true
      // because if we ever fall through here, the user just clicked and
      // expects the cursor.
      el.addEventListener('click', function() {
        self._mountInnerEditor(el, b.type, b.text, true);
      });
      container.appendChild(el);
      // Eager mount, no focus — every block is alive from first paint so
      // blocks feel real, not "dead until clicked". Safe at playground
      // scale (5 scenes × ~5 blocks ≈ 25 inner editors). At full-script
      // scale this will be scoped to "active page ± N pages" via viewport
      // tracking once Steps 4c (propagation) and 4d (teardown) land —
      // both are prerequisites for safely unmounting offscreen blocks.
      self._mountInnerEditor(el, b.type, b.text, false);
    });
  };

  // Build the full innerDoc from live UI state — form controls for the slug,
  // each block's inner ProseMirror editor for the block text, and the trailing
  // transition preserved-from-previous (Step 6 plugs the real picker in).
  // Single dispatch path keeps slug-change and block-change from clobbering
  // each other's in-flight edits, replacing the Step-2 _dispatchSlug helper.
  SceneFramePm.prototype._dispatchInner = function() {
    if (!this._view || !this._getPos) return;
    const pos = this._getPos();
    if (typeof pos !== 'number') return;
    const outerNode = this._view.state.doc.nodeAt(pos);
    if (!outerNode) return;

    const prevInnerDoc = outerNode.attrs.innerDoc || { type: 'doc', attrs: { notes: '', revisionFlag: null }, content: [] };
    const prevContent = Array.isArray(prevInnerDoc.content) ? prevInnerDoc.content : [];

    // 1. sceneLine — straight from form controls.
    const sceneLine = {
      type: 'sceneLine',
      attrs: { setting: this._settingPicker.value, time: this._timePicker.value },
      content: this._locationInput.value
        ? [{ type: 'text', text: this._locationInput.value }]
        : []
    };

    // 2. blocks — serialize each block's content while preserving marks
    // (Step 5a). We walk the inner doc's text nodes and toJSON each, which
    // emits { type:'text', text, marks?:[...] } records — exactly the shape
    // the outer block expects. Falls back to the div's plain textContent
    // for the rare unmounted case (mount race).
    const blocks = [];
    const blockEls = this._blocksContainer ? this._blocksContainer.children : [];
    for (let i = 0; i < blockEls.length; i += 1) {
      const el = blockEls[i];
      const blockType = el.dataset.blockType || 'action';
      let blockContent = [];
      if (el._innerView) {
        el._innerView.state.doc.descendants(function(n) {
          if (n.isText) blockContent.push(n.toJSON());
        });
      } else {
        const text = el.textContent || '';
        if (text) blockContent = [{ type: 'text', text: text }];
      }
      blocks.push({
        type: blockType,
        content: blockContent
      });
    }

    // 3. transition — read from the picker (Package 2). Always emit one
    // transition node so each scene ends visually closed; default 'CUT'
    // matches v1 and the spec.
    const transitionText = (this._transitionPicker && this._transitionPicker.value) || 'CUT';
    const tail = [{
      type: 'transition',
      content: [{ type: 'text', text: transitionText }]
    }];

    const newInnerDoc = {
      type: 'doc',
      attrs: prevInnerDoc.attrs || { notes: '', revisionFlag: null },
      content: [sceneLine].concat(blocks).concat(tail)
    };

    this._lastDispatchedInnerDoc = newInnerDoc;
    const newAttrs = Object.assign({}, outerNode.attrs, { innerDoc: newInnerDoc });
    const tr = this._view.state.tr.setNodeMarkup(pos, null, newAttrs);
    this._view.dispatch(tr);
  };

  // Step 4b: replace a read-only block div with a live inner PM EditorView.
  // Scope is deliberately narrow — proves the mount mechanics work without
  // F2's eager-everywhere failure mode. Edits are LOCAL only: typing
  // works inside the editor but is not propagated back to attrs.innerDoc.
  // Step 4c wires propagation; Step 4d wires blur-teardown.
  //
  // Known temporary edge case until Step 4d lands: if an outer-doc update
  // (e.g. undo) fires _renderBlocksReadOnly while an inner editor is
  // mounted, the editor is destroyed along with its in-flight edits. The
  // loop guard in _refreshValues already protects against self-dispatch
  // echoes (slug edits); other paths are rare in normal playground use.
  SceneFramePm.prototype._mountInnerEditor = function(blockEl, blockType, blockText, shouldFocus) {
    if (blockEl._innerView) return; // already mounted — re-call is a no-op
    const PM = window.RgaProseMirror;
    const schema = _getInnerSchema();
    if (!PM || !schema || !PM.EditorState || !PM.EditorView) return;

    const paragraphContent = blockText ? [schema.text(blockText)] : [];
    const innerDoc = schema.node('doc', null, [
      schema.node('paragraph', null, paragraphContent)
    ]);

    // Step 5a: per-block plugins — history (Ctrl+Z scoped to this block,
    // not the entire outer doc) + keymap with mark toggles for the four
    // simple text marks + baseKeymap so Enter/Backspace/etc. behave.
    // Mark commands are resolved against this inner schema; missing marks
    // (e.g. when later schema steps add color/highlight) yield no-op
    // commands, never throws.
    const innerPlugins = [];
    if (PM.history) innerPlugins.push(PM.history());
    if (PM.keymap) {
      const keymapEntries = {};
      if (PM.undo) {
        keymapEntries['Mod-z'] = PM.undo;
        keymapEntries['Mod-y'] = PM.redo;
        keymapEntries['Mod-Shift-z'] = PM.redo;
      }
      if (PM.toggleMark) {
        if (schema.marks.bold)          keymapEntries['Mod-b'] = PM.toggleMark(schema.marks.bold);
        if (schema.marks.italic)        keymapEntries['Mod-i'] = PM.toggleMark(schema.marks.italic);
        if (schema.marks.underline)     keymapEntries['Mod-u'] = PM.toggleMark(schema.marks.underline);
        if (schema.marks.strikethrough) keymapEntries['Mod-Shift-x'] = PM.toggleMark(schema.marks.strikethrough);
      }
      // Tab / Shift-Tab cycle the OUTER block's type (action ↔ character ↔
      // dialogue ↔ shot). Captured here as closures over blockEl + self so
      // each block's keymap knows which block it lives on.
      keymapEntries['Tab'] = function() {
        const currentType = blockEl.dataset.blockType;
        const nextType = FORWARD_TAB[currentType];
        if (!nextType) return false;
        self._changeBlockType(blockEl, nextType);
        self._dispatchInner();
        return true;
      };
      keymapEntries['Shift-Tab'] = function() {
        const currentType = blockEl.dataset.blockType;
        const prevType = BACKWARD_TAB[currentType];
        if (!prevType) return false;
        self._changeBlockType(blockEl, prevType);
        self._dispatchInner();
        return true;
      };
      innerPlugins.push(PM.keymap(keymapEntries));
      if (PM.baseKeymap) innerPlugins.push(PM.keymap(PM.baseKeymap));
    }
    const state = PM.EditorState.create({ schema: schema, doc: innerDoc, plugins: innerPlugins });

    while (blockEl.firstChild) blockEl.removeChild(blockEl.firstChild);
    const self = this;
    const innerView = new PM.EditorView(blockEl, {
      state: state,
      // Step 4c: apply the transaction locally, then propagate to outer
      // attrs.innerDoc whenever the inner doc changes so block edits
      // persist to .rga. The outer's _refreshValues loop guard recognises
      // this as a self-dispatch and skips re-rendering the blocks, so the
      // inner editor isn't destroyed mid-keystroke.
      dispatchTransaction: function(tr) {
        const newState = innerView.state.apply(tr);
        innerView.updateState(newState);
        if (tr.docChanged) self._dispatchInner();
      }
    });
    blockEl._innerView = innerView;
    // Only steal focus on explicit caller request (click) — eager mount on
    // initial render must NOT focus, else the last block of the last scene
    // grabs focus on file open.
    if (shouldFocus) innerView.focus();
  };

  // Mutates the block div's type — used by the inner Tab keymap and by the
  // scene-toolbox block-type dropdown (which finds this via _rgaScenePlaceholder).
  SceneFramePm.prototype._changeBlockType = function(blockEl, newType) {
    if (!blockEl || !newType) return;
    blockEl.dataset.blockType = newType;
    blockEl.className = 'rga-scene-block rga-block-' + newType;
  };

  SceneFramePm.prototype._refreshNum = function(node) {
    this._numEl.textContent = _sceneWord() + ' ' + (node.attrs.number == null ? '?' : node.attrs.number);
    this.dom.dataset.sceneId     = node.attrs.id     || '';
    this.dom.dataset.sceneNumber = node.attrs.number == null ? '' : String(node.attrs.number);
  };

  SceneFramePm.prototype._refreshTransition = function(node) {
    if (!this._transitionPicker) return;
    if (document.activeElement === this._transitionPicker) return;
    const value = _extractTransition(node.attrs.innerDoc);
    _setPickerValue(this._transitionPicker, value, TRANSITION_OPTIONS);
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
    this._refreshTransition(node);
    // Skip the block re-render if this update is our own self-dispatch echo
    // (slug edits today, block edits in Step 4c) — otherwise we'd clobber
    // the user's in-flight typing the moment Step 4b's inner editor lands.
    if (node.attrs.innerDoc !== this._lastDispatchedInnerDoc) {
      this._renderBlocksReadOnly(node);
    }
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

  // Step 4d: PM NodeView lifecycle hook — called when the outer destroys
  // this NodeView (e.g. the sceneFrame node was removed from the outer doc,
  // or the EditorView itself is being torn down on tab close). Destroy
  // every inner editor we created so PM listeners / plugin state don't
  // outlive the NodeView.
  SceneFramePm.prototype.destroy = function() {
    if (!this._blocksContainer) return;
    const self = this;
    Array.prototype.slice.call(this._blocksContainer.children).forEach(function(child) {
      self._destroyBlockInnerEditor(child);
    });
  };

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
