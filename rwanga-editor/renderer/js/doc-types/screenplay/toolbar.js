// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Screenplay plugin — Scene toolbar group (Filmustageation F1A.6).
//
// First production consumer of the F1A.6 toolbar contribution API.
// Registers a screenplay-owned group at order 200 (between the
// CORE-owned text group at the toolbar's leading edge and the writing
// group that follows). The group contains:
//
//   - block-type <select> — change to action / character / dialogue /
//     parenthetical / shot / transition. The select.value tracks the
//     cursor via a Rga.ScriptMetrics.subscribe handler so the
//     dropdown reflects the current block at the cursor.
//     `sceneHeading` is held by a disabled+hidden option so `value`
//     can carry it without showing in the list.
//   - separator
//   - "+ Scene" button — dispatched as `scene.insert` via the
//     keyboard-registry command surface (registered here, since
//     pre-F1A.6 the command was registered by the CORE
//     format-toolbar.js init).
//
// Visible behaviour is identical to pre-F1A.6. Block-type vocabulary,
// the insertSceneSmart engine call, and the ScriptMetrics
// subscription all live here now — CORE's format-toolbar.js no longer
// knows about scenes.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.Shell || !Rga.Shell.Toolbar
      || typeof Rga.Shell.Toolbar.registerGroup !== 'function') {
    // shell/toolbar.js loads BEFORE doc-types/screenplay/* in
    // renderer/index.html, so this branch only fires in stripped-down
    // test scaffolding. Bail silently; tests that need the group
    // load both files explicitly in order.
    return;
  }

  const SCENE_BLOCKS = [
    { value: 'action',        label: 'Action' },
    { value: 'character',     label: 'Character' },
    { value: 'dialogue',      label: 'Dialogue' },
    { value: 'parenthetical', label: 'Parenthetical' },
    { value: 'shot',          label: 'Shot' },
    { value: 'transition',    label: 'Transition' }
  ];

  // ==========================================================================
  // Engine dispatchers — pure functions; same engine touch points the
  // pre-F1A.6 format-toolbar.js used, simply relocated here.
  // ==========================================================================

  function _view() {
    const TM = window.Rga && window.Rga.TabManager;
    if (!TM || typeof TM._editorView !== 'function') return null;
    return TM._editorView();
  }

  function _PM() {
    return window.RgaProseMirror || null;
  }

  function _dispatchBlockType(nodeTypeName) {
    if (!nodeTypeName) return;
    const view = _view();
    const sp = window.Rga && window.Rga.DocTypes && window.Rga.DocTypes.screenplay;
    const PM = _PM();
    if (!view || !sp || !PM) return;
    const nodeType = view.state.schema.nodes[nodeTypeName];
    if (!nodeType || !PM.setBlockType) return;
    PM.setBlockType(nodeType)(view.state, view.dispatch.bind(view));
    if (typeof view.focus === 'function') view.focus();
  }

  function _dispatchInsertScene() {
    const view = _view();
    const sp = window.Rga && window.Rga.DocTypes && window.Rga.DocTypes.screenplay;
    if (!view || !sp || !sp.v3Commands || typeof sp.v3Commands.insertSceneSmart !== 'function') return;
    sp.v3Commands.insertSceneSmart(view.state, view.dispatch.bind(view));
    if (typeof view.focus === 'function') view.focus();
  }

  // Register the scene.insert command exactly once at script-load. The
  // toolbar group's button below carries data-command="scene.insert"
  // so the existing CORE click-delegation in format-toolbar.js routes
  // through it. KR dedupes by command id (last-wins semantics) so a
  // re-load is harmless.
  function _registerSceneInsertCommand() {
    const KR = window.Rga && window.Rga.KeyboardRegistry;
    if (!KR || typeof KR.registerCommand !== 'function') return;
    KR.registerCommand({
      command: 'scene.insert',
      label:   'Insert Scene',
      handler: _dispatchInsertScene,
      source:  'F1A.6 screenplay toolbar (scene.insert)'
    });
  }

  // ==========================================================================
  // Toolbar group mount
  // ==========================================================================

  function _mount(groupEl) {
    // ---- block-type select --------------------------------------------------
    const select = document.createElement('select');
    select.className = 'rga-shell-toolbar-blocktype';
    select.id = 'rga-shell-toolbar-blocktype';
    select.setAttribute('aria-label', 'Block type');
    select.setAttribute('title', 'Change block type');
    // Placeholder.
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '—';
    select.appendChild(placeholder);
    // Selectable block types.
    SCENE_BLOCKS.forEach(function(b) {
      const opt = document.createElement('option');
      opt.value = b.value;
      opt.textContent = b.label;
      select.appendChild(opt);
    });
    // Scene heading — disabled+hidden so the select can carry the
    // value when the cursor lands on a scene-heading line, but it's
    // never user-selectable (industry: scene headings are managed via
    // the slug-line flow, not by changing block type).
    const sceneHeading = document.createElement('option');
    sceneHeading.value = 'sceneHeading';
    sceneHeading.textContent = 'Scene Heading';
    sceneHeading.disabled = true;
    sceneHeading.hidden = true;
    select.appendChild(sceneHeading);
    groupEl.appendChild(select);

    // ---- separator ----------------------------------------------------------
    const sep = document.createElement('div');
    sep.className = 'rga-shell-toolbar-sep';
    sep.setAttribute('role', 'separator');
    sep.setAttribute('aria-hidden', 'true');
    groupEl.appendChild(sep);

    // ---- + Scene button -----------------------------------------------------
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rga-shell-toolbar-btn rga-shell-toolbar-btn--text';
    btn.setAttribute('data-command', 'scene.insert');
    btn.setAttribute('title', 'Insert scene after current');
    btn.textContent = '+ Scene';
    groupEl.appendChild(btn);

    // ---- wiring --------------------------------------------------------------
    // Block-type change → dispatch.
    const onChange = function() { _dispatchBlockType(select.value); };
    select.addEventListener('change', onChange);

    // Selection-aware sync: subscribe to ScriptMetrics so the
    // dropdown reflects the cursor's current block type. Same
    // semantics the pre-F1A.6 code had.
    const SM = window.Rga && window.Rga.ScriptMetrics;
    let unsubMetrics = null;
    function _syncFromMetrics() {
      const snap = SM && typeof SM.get === 'function' ? SM.get() : null;
      const bt = snap && snap.currentBlockType;
      if (!bt) { select.value = ''; return; }
      const exists = Array.prototype.some.call(select.options,
        function(o) { return o.value === bt; });
      select.value = exists ? bt : '';
    }
    if (SM && typeof SM.subscribe === 'function') {
      unsubMetrics = SM.subscribe(_syncFromMetrics);
      _syncFromMetrics();   // initial paint
    }

    // ---- cleanup -------------------------------------------------------------
    return function _unmount() {
      try { if (unsubMetrics) unsubMetrics(); }
      catch (err) { console.error('[screenplay/toolbar] ScriptMetrics unsubscribe threw:', err); }
      select.removeEventListener('change', onChange);
    };
  }

  // Register the scene.insert command + the toolbar group at script-load.
  _registerSceneInsertCommand();
  Rga.Shell.Toolbar.registerGroup({
    id:        'scene',
    order:     200,
    dataGroup: 'scene',
    mount:     _mount
  });
})();
