// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Inner keymap: Tab/Shift-Tab block-type cycling, Enter behavior.
// Bound to the nested EditorView inside each sceneFrame (F2+).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  const PM = window.RgaProseMirror;
  if (!PM || !PM.keymap) {
    console.error('[inner-keymap] RgaProseMirror.keymap not available');
    return;
  }

  const FORWARD = {
    action: 'character',
    character: 'dialogue',
    dialogue: 'parenthetical',
    parenthetical: 'transition',
    transition: 'shot',
    shot: 'inlineFreeText',
    inlineFreeText: 'action'
  };

  const BACKWARD = {
    character: 'action',
    dialogue: 'character',
    parenthetical: 'dialogue',
    transition: 'parenthetical',
    shot: 'transition',
    inlineFreeText: 'shot'
  };

  const ENTER_NEXT = {
    action: 'action',
    character: 'dialogue',
    dialogue: 'action',
    parenthetical: 'dialogue',
    transition: 'action',
    shot: 'action',
    inlineFreeText: 'inlineFreeText'
  };

  function _parentBlock(state) {
    const $head = state.selection.$head;
    // Inner schema: doc > block. Block depth is 1.
    if ($head.depth < 1) return null;
    const node = $head.node(1);
    const pos = $head.before(1);
    return { node: node, pos: pos };
  }

  function cycleForward(schema) {
    return function(state, dispatch) {
      const parent = _parentBlock(state);
      if (!parent) return false;
      const name = parent.node.type.name;
      // sceneLine handled by zone-key plugin — let event fall through
      if (name === 'sceneLine') return false;
      const nextName = FORWARD[name];
      if (!nextName) return false;
      const nextType = schema.nodes[nextName];
      if (!nextType) return false;
      if (!dispatch) return true;
      dispatch(state.tr.setNodeMarkup(parent.pos, nextType));
      return true;
    };
  }

  function cycleBackward(schema) {
    return function(state, dispatch) {
      const parent = _parentBlock(state);
      if (!parent) return false;
      const name = parent.node.type.name;
      if (name === 'sceneLine') return false;
      // Special: Shift-Tab on action → move cursor to end of sceneLine
      if (name === 'action') {
        // Find sceneLine before action
        const docNode = state.doc;
        let sceneLinePos = null;
        for (let i = 0; i < docNode.childCount; i += 1) {
          const child = docNode.child(i);
          if (child.type.name === 'sceneLine') {
            sceneLinePos = 0;
            for (let j = 0; j < i; j += 1) sceneLinePos += docNode.child(j).nodeSize;
            sceneLinePos += child.nodeSize - 1; // end inside content
            break;
          }
        }
        if (sceneLinePos == null) return false;
        if (!dispatch) return true;
        const TextSelection = PM.TextSelection || window.RgaProseMirror.TextSelection;
        const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(sceneLinePos)));
        dispatch(tr.scrollIntoView());
        return true;
      }
      const prevName = BACKWARD[name];
      if (!prevName) return false;
      const prevType = schema.nodes[prevName];
      if (!prevType) return false;
      if (!dispatch) return true;
      dispatch(state.tr.setNodeMarkup(parent.pos, prevType));
      return true;
    };
  }

  function enterBehavior(schema) {
    return function(state, dispatch) {
      const parent = _parentBlock(state);
      if (!parent) return false;
      const name = parent.node.type.name;

      if (name === 'sceneLine') {
        // Move cursor to first action (or create one) — simplest: find next action
        const TextSelection = PM.TextSelection || window.RgaProseMirror.TextSelection;
        const docNode = state.doc;
        let actionPos = null;
        let cursor = 0;
        for (let i = 0; i < docNode.childCount; i += 1) {
          const child = docNode.child(i);
          if (child.type.name === 'action') {
            actionPos = cursor + 1; // inside action content
            break;
          }
          cursor += child.nodeSize;
        }
        if (actionPos == null) {
          // No action: append one after current block
          if (!dispatch) return true;
          const action = schema.nodes.action.create();
          const insertPos = parent.pos + parent.node.nodeSize;
          const tr = state.tr.insert(insertPos, action);
          tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));
          dispatch(tr.scrollIntoView());
          return true;
        }
        if (!dispatch) return true;
        const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(actionPos)));
        dispatch(tr.scrollIntoView());
        return true;
      }

      const nextName = ENTER_NEXT[name];
      if (!nextName) return false;
      const nextType = schema.nodes[nextName];
      if (!nextType) return false;
      if (!dispatch) return true;
      const TextSelection = PM.TextSelection || window.RgaProseMirror.TextSelection;
      const insertPos = parent.pos + parent.node.nodeSize;
      const tr = state.tr.insert(insertPos, nextType.create());
      tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));
      dispatch(tr.scrollIntoView());
      return true;
    };
  }

  function buildInnerKeymap(schema) {
    const entries = {
      Tab: cycleForward(schema),
      'Shift-Tab': cycleBackward(schema),
      Enter: enterBehavior(schema)
    };
    return PM.keymap(entries);
  }

  Rga.DocTypes.screenplay.buildInnerKeymap = buildInnerKeymap;
  Rga.DocTypes.screenplay._innerKeymapInternals = {
    cycleForward: cycleForward,
    cycleBackward: cycleBackward,
    enterBehavior: enterBehavior,
    FORWARD: FORWARD,
    BACKWARD: BACKWARD,
    ENTER_NEXT: ENTER_NEXT
  };
})();
