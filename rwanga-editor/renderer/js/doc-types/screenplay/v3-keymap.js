// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// v3 keymap factory — composes the v3 screenplay-rule keymap that the v3
// editor mount installs above PM's baseKeymap.
//
// Exposes: Rga.DocTypes.screenplay.buildV3Keymap(schema) → keymap object
// suitable for `prosemirror-keymap`'s `keymap(entries)` plugin.
//
// Bindings (per Phase 4 directive):
//   Tab          → cycleBlockType('forward')
//   Shift-Tab    → cycleBlockType('backward')
//   Enter        → enterFlow  (ENTER_NEXT + empty-trailing → spawnNextScene)
//   Mod-Enter    → spawnNextScene
//   Backspace    → backspaceJoin (only at start of empty body block)
//
// All commands come from v3-commands.js. No DOM / no schema spec embedded
// here — this file is pure command wiring.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  function buildV3Keymap(/* schema currently unused — commands look it up via state */) {
    const cmds = (Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.v3Commands) || null;
    if (!cmds) {
      console.error('[v3-keymap] v3Commands not loaded — load v3-commands.js before v3-keymap.js');
      return {};
    }
    return {
      'Tab':         cmds.cycleBlockType('forward'),
      'Shift-Tab':   cmds.cycleBlockType('backward'),
      'Enter':       cmds.enterFlow,
      'Mod-Enter':   cmds.spawnNextScene,
      'Backspace':   cmds.backspaceJoin
    };
  }

  Rga.DocTypes.screenplay.buildV3Keymap = buildV3Keymap;
})();
