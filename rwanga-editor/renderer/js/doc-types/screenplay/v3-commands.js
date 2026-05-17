// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// v3 screenplay commands — pure ProseMirror commands operating on a single
// canonical doc + v3 schema. No DOM access. No nested editor logic.
//
// Exposes (under Rga.DocTypes.screenplay.v3Commands):
//   makeEmptyScene(schema, opts)        → PM Node (a valid scene)
//   insertSceneAtEnd                    → command
//   insertSceneAfter(scenePos)          → command (factory)
//   cycleBlockType(direction)           → command (factory)
//   enterFlow                           → command
//   spawnNextScene                      → command
//   newSceneId()                        → string (stable-ish id)
//
// All commands follow the PM command contract: (state, dispatch?, view?) → boolean.
// Returning false means the command is not applicable.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  // ENTER_NEXT mirrors the locked v1/v2 screenplay rules.
  // sceneHeading → action (Enter from the slug starts the first action block).
  const ENTER_NEXT = {
    action:         'action',
    character:      'dialogue',
    dialogue:       'dialogue',
    shot:           'action',
    parenthetical:  'dialogue',
    sceneHeading:   'action'
  };
  const FORWARD_TAB  = { action: 'character', character: 'dialogue', dialogue: 'shot', shot: 'action' };
  const BACKWARD_TAB = { action: 'shot',     character: 'action',   dialogue: 'character', shot: 'dialogue' };

  // ----------------------------------------------------------------
  // Construction helpers
  // ----------------------------------------------------------------

  let _idCounter = 0;
  function newSceneId() {
    _idCounter += 1;
    return 'scene-' + Date.now().toString(36) + '-' + _idCounter;
  }

  // makeEmptyScene(schema, { id?, setting?, time? }) → PM Node.
  // Minimal valid scene: sceneHeading + one empty action + CUT transition.
  function makeEmptyScene(schema, opts) {
    opts = opts || {};
    const heading = schema.nodes.sceneHeading.create({
      setting:      opts.setting || 'INT.',
      time:         opts.time    || 'DAY',
      headingStyle: null
    });
    const action     = schema.nodes.action.create();
    const transition = schema.nodes.transition.create(
      { presetType: 'CUT' },
      schema.text('CUT')
    );
    return schema.nodes.scene.create({
      id:           opts.id || newSceneId(),
      notes:        '',
      revisionFlag: null,
      metadata:     { linkedScenes: [], references: [], production: {} }
    }, [heading, action, transition]);
  }

  // ----------------------------------------------------------------
  // Doc walks — find the body node + ancestor scene of a position
  // ----------------------------------------------------------------

  // Returns { node, pos } of the body wrapper, or null if absent.
  function _findBody(doc) {
    let found = null;
    doc.descendants(function(node, pos) {
      if (found) return false;
      if (node.type.name === 'body') { found = { node: node, pos: pos }; return false; }
      return true;
    });
    return found;
  }

  // Find the nearest ancestor `scene` node enclosing the given position.
  // Returns { node, pos, depth } or null.
  function _findEnclosingScene($pos) {
    for (let d = $pos.depth; d > 0; d -= 1) {
      const node = $pos.node(d);
      if (node.type.name === 'scene') {
        return { node: node, pos: $pos.before(d), depth: d };
      }
    }
    return null;
  }

  // ----------------------------------------------------------------
  // Insertion commands
  // ----------------------------------------------------------------

  // Append a fresh empty scene at the end of body. Cursor lands in the
  // new scene's location text (sceneHeading content).
  function insertSceneAtEnd(state, dispatch) {
    const body = _findBody(state.doc);
    if (!body) return false;
    const scene = makeEmptyScene(state.schema);
    if (!dispatch) return true;
    const PM = window.RgaProseMirror;
    // Insert at the END of body (just before its closing token).
    const insertAt = body.pos + 1 + body.node.content.size;
    let tr = state.tr.insert(insertAt, scene);
    // Move cursor into the new scene's sceneHeading content (which is
    // empty location text). The PM positions: insertAt+1 puts us inside
    // scene; +1 puts us inside sceneHeading content.
    if (PM && PM.TextSelection) {
      try {
        const targetPos = insertAt + 2; // inside sceneHeading content
        const $target = tr.doc.resolve(targetPos);
        tr = tr.setSelection(PM.TextSelection.near($target));
      } catch (_) { /* ignore selection if invalid; insertion still landed */ }
    }
    dispatch(tr);
    return true;
  }

  // Insert a new scene immediately after the scene that contains the
  // given outer-doc position. Returns false when no enclosing scene.
  function insertSceneAfter(refPos) {
    return function(state, dispatch) {
      const $ref = state.doc.resolve(refPos);
      const enclosing = _findEnclosingScene($ref);
      if (!enclosing) return false;
      if (!dispatch) return true;
      const scene = makeEmptyScene(state.schema);
      const insertAt = enclosing.pos + enclosing.node.nodeSize;
      const PM = window.RgaProseMirror;
      let tr = state.tr.insert(insertAt, scene);
      if (PM && PM.TextSelection) {
        try {
          const targetPos = insertAt + 2;
          const $target = tr.doc.resolve(targetPos);
          tr = tr.setSelection(PM.TextSelection.near($target));
        } catch (_) {}
      }
      dispatch(tr);
      return true;
    };
  }

  // Spawn a new scene after the one containing the current selection.
  // Falls back to insertSceneAtEnd when not inside a scene (e.g., cursor
  // in a treatment paragraph).
  function spawnNextScene(state, dispatch) {
    const enclosing = _findEnclosingScene(state.selection.$from);
    if (!enclosing) return insertSceneAtEnd(state, dispatch);
    return insertSceneAfter(enclosing.pos + 1)(state, dispatch);
  }

  // ----------------------------------------------------------------
  // Block-type cycle (Tab / Shift-Tab)
  // ----------------------------------------------------------------

  function cycleBlockType(direction) {
    const TABLE = direction === 'backward' ? BACKWARD_TAB : FORWARD_TAB;
    return function(state, dispatch) {
      const $from = state.selection.$from;
      // Walk up depths looking for a node whose type is in the cycle.
      let targetDepth = -1;
      let currentTypeName = null;
      for (let d = $from.depth; d > 0; d -= 1) {
        const name = $from.node(d).type.name;
        if (TABLE[name]) { targetDepth = d; currentTypeName = name; break; }
      }
      if (targetDepth < 0 || !currentTypeName) return false;
      const nextTypeName = TABLE[currentTypeName];
      const nextType = state.schema.nodes[nextTypeName];
      if (!nextType) return false;
      if (!dispatch) return true;
      const targetNodePos = $from.before(targetDepth);
      const tr = state.tr.setNodeMarkup(targetNodePos, nextType);
      dispatch(tr);
      return true;
    };
  }

  // ----------------------------------------------------------------
  // Enter flow — split / insert next block / spawn scene escalation
  // ----------------------------------------------------------------

  function enterFlow(state, dispatch) {
    const $from = state.selection.$from;
    if (!state.selection.empty) return false;
    // Find the enclosing block (action/character/dialogue/etc.) AT depth $from.depth
    // and the enclosing scene (deeper up).
    let blockDepth = -1;
    let blockTypeName = null;
    for (let d = $from.depth; d > 0; d -= 1) {
      const name = $from.node(d).type.name;
      if (ENTER_NEXT[name]) { blockDepth = d; blockTypeName = name; break; }
    }
    if (blockDepth < 0) return false;
    const block = $from.node(blockDepth);
    const blockStart = $from.before(blockDepth) + 1;
    const blockEnd = $from.after(blockDepth) - 1;
    const blockText = block.textContent;

    const enclosingScene = _findEnclosingScene($from);

    // Escalation: empty trailing block in a scene → spawn next scene.
    if (blockText.length === 0 && enclosingScene) {
      // Trailing-most body block? Skip transition (always last).
      const sceneNode = enclosingScene.node;
      const lastNonTransitionIdx = (function() {
        let idx = -1;
        for (let i = sceneNode.childCount - 1; i >= 0; i -= 1) {
          if (sceneNode.child(i).type.name !== 'transition') { idx = i; break; }
        }
        return idx;
      })();
      // The blockDepth's parent is the scene; figure out current child index.
      const indexInScene = $from.index(blockDepth - 1);
      if (indexInScene === lastNonTransitionIdx && sceneNode.childCount > 2) {
        return spawnNextScene(state, dispatch);
      }
    }

    // Standard: split at cursor, set the NEW block's type to ENTER_NEXT[current].
    const nextTypeName = ENTER_NEXT[blockTypeName] || blockTypeName;
    const nextType = state.schema.nodes[nextTypeName];
    if (!nextType) return false;
    if (!dispatch) return true;

    const PM = window.RgaProseMirror;
    let tr = state.tr;
    // Split the current block at the cursor.
    tr = tr.split($from.pos, 1, [{ type: nextType }]);
    // Move cursor into the new block (the second half of the split).
    // After split, cursor sits at the start of the new block.
    dispatch(tr.scrollIntoView());
    return true;
  }

  // ----------------------------------------------------------------
  // Backspace at start of empty block → join with prev / delete block
  // ----------------------------------------------------------------

  function backspaceJoin(state, dispatch) {
    const $from = state.selection.$from;
    if (!state.selection.empty) return false;
    // Only fire when cursor is at start of a sceneBody block AND that
    // block is empty.
    let blockDepth = -1;
    for (let d = $from.depth; d > 0; d -= 1) {
      const name = $from.node(d).type.name;
      if (ENTER_NEXT[name] && name !== 'sceneHeading') { blockDepth = d; break; }
    }
    if (blockDepth < 0) return false;
    const block = $from.node(blockDepth);
    const blockStart = $from.before(blockDepth) + 1;
    if ($from.pos !== blockStart) return false;
    if (block.content.size > 0) return false;
    // Find the previous sibling — if it's in the same scene + is a
    // sceneBody block, joining is the right move. PM's joinBackward
    // command handles it; defer to it.
    const PM = window.RgaProseMirror;
    if (PM && PM.joinBackward) return PM.joinBackward(state, dispatch);
    return false;
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  Rga.DocTypes.screenplay.v3Commands = {
    ENTER_NEXT:        ENTER_NEXT,
    FORWARD_TAB:       FORWARD_TAB,
    BACKWARD_TAB:      BACKWARD_TAB,
    newSceneId:        newSceneId,
    makeEmptyScene:    makeEmptyScene,
    insertSceneAtEnd:  insertSceneAtEnd,
    insertSceneAfter:  insertSceneAfter,
    spawnNextScene:    spawnNextScene,
    cycleBlockType:    cycleBlockType,
    enterFlow:         enterFlow,
    backspaceJoin:     backspaceJoin,
    // Test hooks
    _findBody:            _findBody,
    _findEnclosingScene:  _findEnclosingScene
  };
})();
