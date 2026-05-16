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

  // Enter from block of type X creates a new sibling block of type
  // ENTER_NEXT[X]. Mirrors v1 placeholder rules — writers expect Enter from
  // CHARACTER to land in DIALOGUE, Enter from DIALOGUE to make another
  // DIALOGUE (continued speech), Enter from SHOT back to ACTION, etc.
  const ENTER_NEXT = {
    action:         'action',
    character:      'dialogue',
    dialogue:       'dialogue',
    shot:           'action',
    parenthetical:  'dialogue',
    inlineFreeText: 'inlineFreeText'
  };

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
  // { type, content } records. content is the JSON array of inline children
  // — preserves marks (bold, italic, annotation, tag, revisionFlag, etc.)
  // so reopen + remount doesn't drop the user's saved annotations / flags /
  // tags. Transition is structural (its own picker row).
  function _extractBlocks(innerDoc) {
    if (!innerDoc || !Array.isArray(innerDoc.content)) return [];
    return innerDoc.content.slice(1)
      .filter(function(node) { return node && node.type !== 'transition'; })
      .map(function(node) {
        return { type: node.type, content: Array.isArray(node.content) ? node.content : [] };
      });
  }

  // Plain-text concat of a block's JSON content (fallback when the inner PM
  // editor hasn't mounted yet — e.g. mount race during initial paint).
  function _blockJsonToText(content) {
    let text = '';
    (content || []).forEach(function(child) {
      if (child && child.type === 'text' && typeof child.text === 'string') text += child.text;
    });
    return text;
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
  // Character-cue autocomplete (no-AI, registry-only)
  // ============================================================
  // When the user types in a character cue block and the typed prefix
  // (>= 2 chars, case-insensitive) matches an already-registered
  // character name, a ghost-text suggestion appears at the cursor
  // showing the remainder of the name. Enter / Tab / ArrowRight confirms:
  // the full name is inserted with the tag mark already applied + the
  // matching entityId. No AI, no scoring, no fuzzy matching — pure
  // startsWith lookup against doc.tagRegistry.characters. AI-flavoured
  // suggestions across other block types stay deferred to v2/Pro.
  //
  // Plugin runs on every inner editor but only fires when the block
  // currently has type=character (reads blockEl.dataset.blockType on
  // each transaction — so Tab-cycling into character mid-typing also
  // activates the suggestion without remounting the editor).

  let _autocompleteKey = null;
  function _getAutocompleteKey(PM) {
    if (!_autocompleteKey) _autocompleteKey = new PM.PluginKey('rga-character-autocomplete');
    return _autocompleteKey;
  }

  function _findCharacterMatch(text) {
    const doc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
    if (!doc || !doc.tagRegistry) return null;
    const chars = doc.tagRegistry.characters || [];
    if (!chars.length) return null;
    const lower = text.toLowerCase();
    for (let i = 0; i < chars.length; i += 1) {
      const c = chars[i];
      if (!c || !c.name) continue;
      const name = String(c.name);
      if (name.length > text.length && name.toLowerCase().indexOf(lower) === 0) {
        return c;
      }
    }
    return null;
  }

  // Exact case-insensitive match — used by the on-blur "Tag as NALI?"
  // popup that catches the case where the writer ignored autocomplete and
  // typed the full name manually.
  function _findCharacterByExactName(text) {
    const doc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
    if (!doc || !doc.tagRegistry) return null;
    const chars = doc.tagRegistry.characters || [];
    const trimmed = text.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    for (let i = 0; i < chars.length; i += 1) {
      const c = chars[i];
      if (c && c.name && String(c.name).toLowerCase() === lower) return c;
    }
    return null;
  }

  // Small confirmation popup near a character cue block, fired on blur
  // when the typed text exactly matches a registered character but has
  // no tag mark yet. Auto-dismisses after 6s; click anywhere to act.
  function _showTagSuggestPopup(blockEl, innerView, match) {
    // Reject duplicates — if a popup is already up for this block, leave it.
    if (blockEl._tagSuggestPopup) return;

    const popup = document.createElement('div');
    popup.className = 'rga-tag-suggest-popup';

    const label = document.createElement('span');
    label.className = 'rga-tag-suggest-label';
    label.textContent = 'Tag as ' + match.name + ' ?';
    popup.appendChild(label);

    const yes = document.createElement('button');
    yes.className = 'rga-tag-suggest-btn rga-tag-suggest-yes';
    yes.textContent = 'Yes';
    const no = document.createElement('button');
    no.className = 'rga-tag-suggest-btn rga-tag-suggest-no';
    no.textContent = 'No';
    popup.appendChild(yes);
    popup.appendChild(no);

    const rect = blockEl.getBoundingClientRect();
    popup.style.left = Math.min(rect.right + 8, window.innerWidth - 220) + 'px';
    popup.style.top = (rect.top + window.scrollY) + 'px';
    document.body.appendChild(popup);
    blockEl._tagSuggestPopup = popup;

    function dismiss() {
      clearTimeout(timer);
      if (popup.parentNode) popup.parentNode.removeChild(popup);
      blockEl._tagSuggestPopup = null;
    }
    const timer = setTimeout(dismiss, 6000);

    yes.addEventListener('mousedown', function(e) {
      e.preventDefault();
      const schema = innerView.state.schema;
      const tagMark = schema.marks.tag;
      if (tagMark) {
        const tr = innerView.state.tr.addMark(0, innerView.state.doc.content.size, tagMark.create({
          tagType: 'character',
          entityId: match.id
        }));
        innerView.dispatch(tr);
      }
      dismiss();
    });
    no.addEventListener('mousedown', function(e) {
      e.preventDefault();
      dismiss();
    });
  }

  function _buildCharacterAutocompletePlugin(blockEl) {
    const PM = window.RgaProseMirror;
    if (!PM || !PM.Plugin || !PM.PluginKey || !PM.Decoration || !PM.DecorationSet) return null;
    const key = _getAutocompleteKey(PM);
    return new PM.Plugin({
      key: key,
      state: {
        init: function() { return { match: null }; },
        apply: function(tr, prev, oldState, newState) {
          if (!blockEl || blockEl.dataset.blockType !== 'character') return { match: null };
          const text = newState.doc.textContent;
          if (text.length < 2) return { match: null };
          return { match: _findCharacterMatch(text) };
        }
      },
      props: {
        decorations: function(state) {
          const ps = key.getState(state);
          if (!ps || !ps.match) return PM.DecorationSet.empty;
          const text = state.doc.textContent;
          const remainder = ps.match.name.slice(text.length);
          if (!remainder) return PM.DecorationSet.empty;
          // Widget at end of the paragraph's text (last position inside the
          // paragraph node — content.size - 1 in a single-paragraph doc).
          const widget = document.createElement('span');
          widget.className = 'rga-autocomplete-ghost';
          widget.textContent = remainder;
          // Small arrow hint so the writer knows to press → to accept.
          // (Enter / Tab can't accept — they're already taken by Enter-flow
          // and block-type cycle.)
          const arrow = document.createElement('span');
          arrow.className = 'rga-autocomplete-arrow';
          arrow.textContent = ' →';
          widget.appendChild(arrow);
          const insertPos = Math.max(0, state.doc.content.size - 1);
          return PM.DecorationSet.create(state.doc, [
            PM.Decoration.widget(insertPos, widget, { side: 1 })
          ]);
        },
        handleKeyDown: function(view, event) {
          // ArrowRight only — Enter creates next block (ENTER_NEXT) and Tab
          // cycles block type; both are higher-priority screenplay rules.
          if (event.key !== 'ArrowRight') return false;
          const ps = key.getState(view.state);
          if (!ps || !ps.match) return false;
          const text = view.state.doc.textContent;
          if (!text || ps.match.name.length <= text.length) return false;
          // Only trigger when cursor is at the end of the typed text — pressing
          // ArrowRight in the middle of "NA" should still move the caret.
          if (view.state.selection.from < view.state.doc.content.size - 1) return false;
          event.preventDefault();

          const schema = view.state.schema;
          const tagMark = schema.marks.tag;
          const fullName = ps.match.name;
          const taggedText = tagMark
            ? schema.text(fullName, [tagMark.create({ tagType: 'character', entityId: ps.match.id })])
            : schema.text(fullName);
          const newP = schema.node('paragraph', null, [taggedText]);
          let tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newP);
          // Place cursor at end of the inserted name.
          const endPos = tr.doc.content.size - 1;
          if (PM.TextSelection) {
            tr = tr.setSelection(PM.TextSelection.create(tr.doc, endPos));
          }
          view.dispatch(tr);
          view.focus();
          return true;
        }
      }
    });
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
    // Step 5a: toggle marks. Package 3: color/highlight/link (attrs marks,
    // toolbar popovers/dialogs already route to focused view via _view).
    // Package 4: annotation, tag, revisionFlag — the original "notes/flags/
    // tags inside scenes" motivation. With these in the inner schema, the
    // mark commands fired by the toolbar Note/Flag/Tag buttons + the
    // annotation/tag/revision-flag plugins below apply to inner content.
    ['bold', 'italic', 'underline', 'strikethrough',
     'color', 'highlight', 'link',
     'annotation', 'tag', 'revisionFlag'].forEach(function(name) {
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
      el.textContent = _blockJsonToText(b.content);
      // Click handler kept as a defensive fallback: the eager mount below
      // should always have populated _innerView already, in which case the
      // guard inside _mountInnerEditor makes this a no-op. shouldFocus=true
      // because if we ever fall through here, the user just clicked and
      // expects the cursor.
      el.addEventListener('click', function() {
        self._mountInnerEditor(el, b.type, b.content, true);
      });
      container.appendChild(el);
      // Eager mount, no focus — every block is alive from first paint so
      // blocks feel real, not "dead until clicked". Safe at playground
      // scale (5 scenes × ~5 blocks ≈ 25 inner editors). At full-script
      // scale this will be scoped to "active page ± N pages" via viewport
      // tracking once Steps 4c (propagation) and 4d (teardown) land —
      // both are prerequisites for safely unmounting offscreen blocks.
      self._mountInnerEditor(el, b.type, b.content, false);
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
  SceneFramePm.prototype._mountInnerEditor = function(blockEl, blockType, blockContent, shouldFocus) {
    if (blockEl._innerView) return; // already mounted — re-call is a no-op
    const PM = window.RgaProseMirror;
    const schema = _getInnerSchema();
    if (!PM || !schema || !PM.EditorState || !PM.EditorView) return;

    // blockContent is the JSON array of inline children from attrs.innerDoc
    // (or [{type:'text', text:'foo'}] for fresh-typed blocks). Marks on each
    // text node are validated against the inner schema; missing mark types
    // are silently dropped so the inner editor never crashes on schema
    // mismatch. This is the read path that pairs with _dispatchInner's
    // mark-preserving write path — together they round-trip annotations /
    // flags / tags / bold / italic etc through save + reopen.
    const paragraphContent = [];
    (blockContent || []).forEach(function(child) {
      if (!child || child.type !== 'text' || typeof child.text !== 'string' || !child.text) return;
      const marks = (child.marks || []).map(function(mJson) {
        const mt = schema.marks[mJson.type];
        if (!mt) return null;
        try { return mt.create(mJson.attrs || null); } catch (_) { return null; }
      }).filter(Boolean);
      paragraphContent.push(schema.text(child.text, marks));
    });
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
        // Inner undo first; if inner history is empty (which is the case
        // for outer-level changes like spawn-next-scene that the user
        // wants to undo from the previous scene's inner editor), fall
        // through to the outer view's undo so the spawn becomes
        // reversible.
        keymapEntries['Mod-z'] = function(innerState, innerDispatch) {
          if (PM.undo(innerState, innerDispatch)) return true;
          if (self._view && PM.undo) {
            PM.undo(self._view.state, self._view.dispatch.bind(self._view));
          }
          return true;
        };
        const redoFn = function(innerState, innerDispatch) {
          if (PM.redo(innerState, innerDispatch)) return true;
          if (self._view && PM.redo) {
            PM.redo(self._view.state, self._view.dispatch.bind(self._view));
          }
          return true;
        };
        keymapEntries['Mod-y'] = redoFn;
        keymapEntries['Mod-Shift-z'] = redoFn;
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

      // Enter — screenplay rule:
      //   * empty trailing block → spawn next scene (the "second Enter"
      //     escalation that writers expect after closing the previous one)
      //   * otherwise → create a new sibling block of type ENTER_NEXT
      //     [currentType] and move focus there. NEVER lets PM's baseKeymap
      //     fire (which would split the inner editor's paragraph in-place,
      //     leaving the writer stuck inside one block — the bug this
      //     replaces).
      keymapEntries['Enter'] = function(state) {
        const currentType = blockEl.dataset.blockType;
        const currentText = state.doc.textContent;
        const blocksContainer = self._blocksContainer;
        const blockCount = blocksContainer ? blocksContainer.children.length : 0;

        if (currentText.length === 0 && blockCount > 1) {
          self._spawnNextScene();
          return true;
        }

        const nextType = ENTER_NEXT[currentType] || currentType;
        const newEl = self._insertBlockAfter(blockEl, nextType, []);
        if (newEl && newEl._innerView) newEl._innerView.focus();
        self._dispatchInner();
        return true;
      };

      // Mod-Enter from anywhere inside an inner editor spawns the next
      // scene immediately. Mirrors mount.js's outer Mod-Enter binding,
      // which never reaches us because the NodeView's stopEvent=true
      // prevents events bubbling out of the inner contenteditable.
      keymapEntries['Mod-Enter'] = function() {
        self._spawnNextScene();
        return true;
      };

      // Backspace at the start of an empty block removes the block and
      // moves the cursor to the end of the previous block. For non-empty
      // blocks (or non-start cursor) we return false → PM's baseKeymap
      // joinBackward / default deletion takes over.
      keymapEntries['Backspace'] = function(state) {
        const text = state.doc.textContent;
        const cursorPos = state.selection.from;
        const atStart = cursorPos <= 1; // pos 1 = start of paragraph
        if (text.length !== 0 || !atStart) return false;
        const prevEl = blockEl.previousElementSibling;
        if (!prevEl) return false;
        self._removeBlock(blockEl);
        if (prevEl._innerView) {
          prevEl._innerView.focus();
          if (PM.TextSelection) {
            const endPos = Math.max(0, prevEl._innerView.state.doc.content.size - 1);
            const tr = prevEl._innerView.state.tr.setSelection(
              PM.TextSelection.create(prevEl._innerView.state.doc, endPos)
            );
            prevEl._innerView.dispatch(tr);
          }
        }
        return true;
      };

      innerPlugins.push(PM.keymap(keymapEntries));
      if (PM.baseKeymap) innerPlugins.push(PM.keymap(PM.baseKeymap));
    }
    // Package 4: mount the same context-menu / annotations / tags /
    // revision-flags plugins on each inner editor so right-click works
    // inside scenes and click-on-mark popups open at the right coords.
    // Plugins are no-ops on schemas missing their target marks, safe to
    // attach unconditionally.
    const sp = Rga.DocTypes && Rga.DocTypes.screenplay;
    if (sp) {
      if (sp.contextMenuPlugin)   innerPlugins.push(sp.contextMenuPlugin());
      if (sp.annotationsPlugin)   innerPlugins.push(sp.annotationsPlugin());
      if (sp.tagsPlugin)          innerPlugins.push(sp.tagsPlugin());
      if (sp.revisionFlagsPlugin) innerPlugins.push(sp.revisionFlagsPlugin());
    }
    // Character-cue autocomplete: ghost-text suggestion from
    // doc.tagRegistry.characters when this block is type=character. The
    // plugin gates on blockEl.dataset.blockType per-transaction so a Tab
    // cycle into character also activates suggestions without remounting.
    const acPlugin = _buildCharacterAutocompletePlugin(blockEl);
    if (acPlugin) innerPlugins.push(acPlugin);
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
    // Blur listener for the "Tag as NALI?" suggestion popup — fires when
    // focus leaves the inner editor with text that exactly matches a
    // registered character but has no tag mark yet. Only relevant for
    // character cue blocks.
    if (innerView.dom && innerView.dom.addEventListener) {
      innerView.dom.addEventListener('blur', function() {
        // Defer so the focus has settled and so quick click-into-another-
        // block doesn't fire a popup the user immediately overrides.
        setTimeout(function() {
          if (!blockEl || !blockEl.parentNode) return;
          if (blockEl.dataset.blockType !== 'character') return;
          const v = blockEl._innerView;
          if (!v) return;
          const text = v.state.doc.textContent;
          if (!text || !text.trim()) return;
          const tagMark = v.state.schema.marks.tag;
          if (!tagMark) return;
          // Skip if any text node in the block already carries a tag mark —
          // either from autocomplete or from a prior confirmation.
          let alreadyTagged = false;
          v.state.doc.descendants(function(n) {
            if (alreadyTagged) return false;
            if (n.isText && n.marks.some(function(m) { return m.type === tagMark; })) {
              alreadyTagged = true;
            }
          });
          if (alreadyTagged) return;
          const match = _findCharacterByExactName(text);
          if (!match) return;
          _showTagSuggestPopup(blockEl, v, match);
        }, 100);
      });
    }
    // Only steal focus on explicit caller request (click) — eager mount on
    // initial render must NOT focus, else the last block of the last scene
    // grabs focus on file open.
    if (shouldFocus) innerView.focus();
  };

  // Mutates the block div's type — used by the inner Tab keymap and by the
  // scene-toolbox block-type dropdown (which finds this via _rgaScenePlaceholder).
  // Triggers FlowChrome.refresh so character tinting + line gutter pick up
  // the new className — FlowChrome's MutationObserver doesn't watch attribute
  // changes, only childList/subtree/characterData.
  SceneFramePm.prototype._changeBlockType = function(blockEl, newType) {
    if (!blockEl || !newType) return;
    blockEl.dataset.blockType = newType;
    blockEl.className = 'rga-scene-block rga-block-' + newType;
    if (Rga.FlowChrome && typeof Rga.FlowChrome.refresh === 'function') {
      Rga.FlowChrome.refresh();
    }
  };

  // Insert a new sibling scene-block AFTER refBlockEl with its own mounted
  // inner editor. Returns the new block element. Used by the inner Enter
  // keymap to create the "next typed block" per ENTER_NEXT.
  SceneFramePm.prototype._insertBlockAfter = function(refBlockEl, type, content) {
    if (!refBlockEl || !this._blocksContainer) return null;
    const self = this;
    const el = document.createElement('div');
    el.className = 'rga-scene-block rga-block-' + type;
    el.dataset.blockType = type;
    el.contentEditable = 'false';
    el.addEventListener('click', function() {
      self._mountInnerEditor(el, type, content || [], true);
    });
    refBlockEl.parentNode.insertBefore(el, refBlockEl.nextSibling);
    this._mountInnerEditor(el, type, content || [], false);
    return el;
  };

  // Remove a block + its inner editor. Used by the inner Backspace keymap
  // when the user backspaces at the start of an empty trailing block.
  SceneFramePm.prototype._removeBlock = function(blockEl) {
    if (!blockEl || !this._blocksContainer) return;
    this._destroyBlockInnerEditor(blockEl);
    if (blockEl.parentNode === this._blocksContainer) {
      this._blocksContainer.removeChild(blockEl);
    }
    this._dispatchInner();
  };

  // Insert a fresh empty sceneFrame after this one in the outer doc. Mirrors
  // mount.js's insertSceneFrame command — duplicated inline here because
  // mount.js doesn't export it and pulling it down through Rga.Editor would
  // create a coupling we'd have to unwind when v2 archives v1. New scene's
  // number = current scene count + 1; the routing factory's per-doc check
  // picks v2 / v1 NodeView based on metadata.useV2SceneFrame.
  SceneFramePm.prototype._spawnNextScene = function() {
    const PM = window.RgaProseMirror;
    if (!PM || !this._view || !this._getPos) return;
    const view = this._view;
    const sceneFrameType = view.state.schema.nodes.sceneFrame;
    if (!sceneFrameType) return;

    let sceneCount = 0;
    view.state.doc.descendants(function(node) {
      if (node.type === sceneFrameType) sceneCount += 1;
    });

    const newFrame = sceneFrameType.create({
      id: 'scene-' + Date.now().toString(36),
      number: sceneCount + 1,
      headingStyle: null,
      innerDoc: null
    });

    const pos = this._getPos();
    if (typeof pos !== 'number') return;
    const currentNode = view.state.doc.nodeAt(pos);
    const insertPos = pos + (currentNode ? currentNode.nodeSize : 1);
    const tr = view.state.tr.insert(insertPos, newFrame);
    view.dispatch(tr);
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
