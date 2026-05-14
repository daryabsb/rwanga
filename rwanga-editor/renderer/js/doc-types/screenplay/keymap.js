// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // ============================================================
  // CYCLE TABLES  (spec §3.1)
  // ============================================================

  const FORWARD_CYCLE = {
    action:       'character',
    character:    'dialogue',
    dialogue:     'action',
    parenthetical:'transition',
    transition:   'shot',
    shot:         'action'
  };

  const BACKWARD_CYCLE = {
    character:    'action',
    dialogue:     'character',
    parenthetical:'dialogue',
    transition:   'parenthetical',
    shot:         'transition'
    // action: special — cursor moves to sceneLine
  };

  const ENTER_NEXT = {
    sceneLine:    'action',
    action:       'action',
    character:    'dialogue',
    dialogue:     'action',
    parenthetical:'dialogue',
    transition:   'action',
    shot:         'action'
  };

  // ============================================================
  // HELPER
  // ============================================================

  /**
   * Finds the cursor's screenplay context: which scene child, and the scene itself.
   * Returns { inSide: false } when the cursor is not inside any scene node.
   */
  function getSceneContext(state) {
    const $head = state.selection.$head;
    let sceneDepth = -1;
    for (let d = $head.depth; d >= 0; d--) {
      if ($head.node(d).type.name === 'scene') {
        sceneDepth = d;
        break;
      }
    }
    if (sceneDepth < 0) return { inSide: false };
    const sceneChildDepth = sceneDepth + 1;
    if ($head.depth < sceneChildDepth) return { inSide: false };
    return {
      inSide: true,
      sceneNode: $head.node(sceneDepth),
      scenePos: $head.before(sceneDepth),
      sceneChildNode: $head.node(sceneChildDepth),
      sceneChildIndex: $head.index(sceneDepth),
      sceneChildPos: $head.before(sceneChildDepth)
    };
  }

  // ============================================================
  // COMMANDS
  // ============================================================

  function cycleBlockTypeForward(schema) {
    return function(state, dispatch) {
      const ctx = getSceneContext(state);
      if (!ctx.inSide) return false;
      if (ctx.sceneChildNode.type.name === 'sceneLine') return false; // no-op per §3.1
      const targetTypeName = FORWARD_CYCLE[ctx.sceneChildNode.type.name];
      if (!targetTypeName) return false;
      const targetType = schema.nodes[targetTypeName];
      if (!dispatch) return true;
      dispatch(state.tr.setNodeMarkup(ctx.sceneChildPos, targetType));
      return true;
    };
  }

  function cycleBlockTypeBackward(schema) {
    return function(state, dispatch) {
      const ctx = getSceneContext(state);
      if (!ctx.inSide) return false;
      if (ctx.sceneChildNode.type.name === 'sceneLine') return false;

      if (ctx.sceneChildNode.type.name === 'action') {
        // Move cursor to end of sceneLine (always scene's first child)
        const sceneLinePos = ctx.scenePos + 1;
        const sceneLineNode = ctx.sceneNode.child(0);
        const endOfSceneLine = sceneLinePos + sceneLineNode.nodeSize - 1;
        if (!dispatch) return true;
        const tr = state.tr;
        if (ctx.sceneChildNode.content.size === 0) {
          tr.delete(ctx.sceneChildPos, ctx.sceneChildPos + ctx.sceneChildNode.nodeSize);
        }
        const TextSelection = window.RgaProseMirror.TextSelection;
        tr.setSelection(TextSelection.near(tr.doc.resolve(endOfSceneLine)));
        dispatch(tr.scrollIntoView());
        return true;
      }

      const targetTypeName = BACKWARD_CYCLE[ctx.sceneChildNode.type.name];
      if (!targetTypeName) return false;
      const targetType = schema.nodes[targetTypeName];
      if (!dispatch) return true;
      dispatch(state.tr.setNodeMarkup(ctx.sceneChildPos, targetType));
      return true;
    };
  }

  function exitScene(schema) {
    return function(state, dispatch) {
      const ctx = getSceneContext(state);
      if (!ctx.inSide) return false;
      if (!dispatch) return true;
      const tr = state.tr;
      const afterScenePos = ctx.scenePos + ctx.sceneNode.nodeSize;
      const newPara = schema.nodes.paragraph.create();
      tr.insert(afterScenePos, newPara);
      const TextSelection = window.RgaProseMirror.TextSelection;
      tr.setSelection(TextSelection.near(tr.doc.resolve(afterScenePos + 1)));
      dispatch(tr.scrollIntoView());
      return true;
    };
  }

  function enterBehavior(schema) {
    return function(state, dispatch) {
      const ctx = getSceneContext(state);
      if (!ctx.inSide) return false;

      // Smart Enter on empty action → exit scene (double-Enter pattern, spec §3.2)
      if (ctx.sceneChildNode.type.name === 'action' &&
          ctx.sceneChildNode.content.size === 0) {
        return exitScene(schema)(state, dispatch);
      }

      const nextTypeName = ENTER_NEXT[ctx.sceneChildNode.type.name];
      if (!nextTypeName) return false;
      const nextType = schema.nodes[nextTypeName];
      if (!dispatch) return true;
      const tr = state.tr;
      const insertPos = ctx.sceneChildPos + ctx.sceneChildNode.nodeSize;
      tr.insert(insertPos, nextType.create());
      const TextSelection = window.RgaProseMirror.TextSelection;
      tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));
      dispatch(tr.scrollIntoView());
      return true;
    };
  }

  function newSceneAfterCurrent(schema) {
    return function(state, dispatch) {
      if (!dispatch) return true;
      const ctx = getSceneContext(state);
      const tr = state.tr;
      let insertPos;
      if (ctx.inSide) {
        insertPos = ctx.scenePos + ctx.sceneNode.nodeSize;
      } else {
        // Not in a scene: insert after the current body-level block
        const $head = state.selection.$head;
        const bodyChildDepth = Math.min($head.depth, 2);
        insertPos = $head.after(bodyChildDepth);
      }
      const prefill = schema.text('INT. ');
      const sceneNode = schema.nodes.scene.create({}, [
        schema.nodes.sceneLine.create(null, [prefill]),
        schema.nodes.action.create()
      ]);
      tr.insert(insertPos, sceneNode);
      const TextSelection = window.RgaProseMirror.TextSelection;
      // Cursor lands after "INT. " — ready for the user to type the location
      tr.setSelection(TextSelection.create(tr.doc, insertPos + 1 + prefill.nodeSize));
      dispatch(tr.scrollIntoView());
      return true;
    };
  }

  // ============================================================
  // BUILDER
  // ============================================================

  function buildKeymap(schema) {
    return {
      'Tab':       cycleBlockTypeForward(schema),
      'Shift-Tab': cycleBlockTypeBackward(schema),
      'Enter':     enterBehavior(schema),
      'Escape':    exitScene(schema),
      'Mod-Enter': newSceneAfterCurrent(schema)
    };
  }

  // ============================================================
  // EXPORTS
  // ============================================================

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.buildKeymap = buildKeymap;

  // Internals exposed for unit tests
  Rga.DocTypes.screenplay._keymapInternals = {
    getSceneContext,
    cycleBlockTypeForward,
    cycleBlockTypeBackward,
    enterBehavior,
    exitScene,
    newSceneAfterCurrent
  };
})();
