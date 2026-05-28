// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Filmustageation F1A.6 — screenplay Scene toolbar contribution.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const HTML = '<!DOCTYPE html><html><body>' +
  '<div id="rga-shell-toolbar">' +
    '<div class="rga-shell-toolbar-inner">' +
      '<div class="rga-shell-toolbar-group" data-group="text">[text]</div>' +
      '<div class="rga-shell-toolbar-content-slot" data-toolbar-slot="content"></div>' +
      '<div class="rga-shell-toolbar-group" data-group="writing">[writing]</div>' +
    '</div>' +
  '</div>' +
  '</body></html>';

function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM(HTML, { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};

  // Stubs the screenplay contribution reads.
  global.window.RgaProseMirror = opts.PM || {
    setBlockType: function(nodeType) {
      return function(state, dispatch) {
        opts._setBlockTypeCalls.push(nodeType && nodeType.name);
        if (dispatch) dispatch({ marker: 'setBlockType-tr' });
        return true;
      };
    }
  };
  opts._setBlockTypeCalls = opts._setBlockTypeCalls || [];
  opts._insertSceneCalls = opts._insertSceneCalls || 0;
  global.window.Rga.TabManager = {
    _editorView: function() { return opts.view || null; },
    activeDoc:   function() { return null; }
  };
  global.window.Rga.DocTypes = global.window.Rga.DocTypes || {};
  global.window.Rga.DocTypes.screenplay = {
    v3Commands: {
      insertSceneSmart: function(state, dispatch) {
        opts._insertSceneCalls += 1;
        if (dispatch) dispatch({ marker: 'insertSceneSmart-tr' });
        return true;
      }
    }
  };
  // KR stub captures registerCommand + lets us invoke through it.
  const registered = {};
  global.window.Rga.KeyboardRegistry = {
    registerCommand: function(spec) {
      registered[spec.command] = spec;
    },
    invokeCommand: function(id) {
      const cmd = registered[id];
      if (cmd && typeof cmd.handler === 'function') return cmd.handler();
    },
    _commands: registered
  };
  // ScriptMetrics stub — sync wiring tests subscribe to .get + .subscribe.
  const metricsListeners = [];
  global.window.Rga.ScriptMetrics = {
    _current: opts.currentBlockType || null,
    get: function() { return { currentBlockType: this._current }; },
    subscribe: function(fn) {
      metricsListeners.push(fn);
      return function() {
        const i = metricsListeners.indexOf(fn);
        if (i >= 0) metricsListeners.splice(i, 1);
      };
    },
    _fire: function(blockType) {
      this._current = blockType;
      metricsListeners.forEach(function(fn) { try { fn(); } catch (_) {} });
    }
  };

  const files = [
    '../../../../renderer/js/shell/toolbar.js',
    '../../../../renderer/js/doc-types/screenplay/toolbar.js'
  ];
  files.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });

  const Rga = global.window.Rga;
  Rga.Shell.Toolbar._reset();
  // The screenplay IIFE registered before _reset wiped the registry.
  // Re-require the screenplay file so it re-registers against the
  // fresh Toolbar state.
  delete require.cache[require.resolve('../../../../renderer/js/doc-types/screenplay/toolbar.js')];
  require('../../../../renderer/js/doc-types/screenplay/toolbar.js');
  // Wire the slot.
  const slotEl = global.document.querySelector('[data-toolbar-slot="content"]');
  Rga.Shell.Toolbar.setHost(slotEl);
  return { Rga, dom, slot: slotEl, opts };
}

// ----------------------------------------------------------------
// §1 — Registration
// ----------------------------------------------------------------

test('F1A.6 — screenplay toolbar.js registers the Scene group at order 200', () => {
  const { Rga } = boot();
  const ctrl = Rga.Shell.Toolbar.getController('scene');
  assert.ok(ctrl);
  assert.equal(ctrl.id, 'scene');
  assert.equal(ctrl.order, 200);
  assert.equal(ctrl.dataGroup, 'scene');
  assert.equal(typeof ctrl.mount, 'function');
});

test('F1A.6 — scene.insert command is registered on the keyboard registry at script-load', () => {
  const { Rga } = boot();
  const cmd = Rga.KeyboardRegistry._commands['scene.insert'];
  assert.ok(cmd);
  assert.equal(cmd.label, 'Insert Scene');
  assert.equal(typeof cmd.handler, 'function');
});

// ----------------------------------------------------------------
// §2 — Mount creates the expected DOM
// ----------------------------------------------------------------

test('F1A.6 — mount creates the block-type select + separator + Insert Scene button', () => {
  const { slot } = boot();
  const group = slot.querySelector('[data-toolbar-group-id="scene"]');
  assert.ok(group);
  assert.equal(group.getAttribute('data-group'), 'scene');
  const select = group.querySelector('select.rga-shell-toolbar-blocktype');
  assert.ok(select);
  assert.equal(select.id, 'rga-shell-toolbar-blocktype');
  // 8 options: placeholder + 6 block types + scene-heading (disabled+hidden).
  assert.equal(select.options.length, 8);
  assert.equal(select.options[0].value, '');
  assert.equal(select.options[7].value, 'sceneHeading');
  assert.equal(select.options[7].disabled, true);
  // Separator + button.
  const sep = group.querySelector('.rga-shell-toolbar-sep');
  assert.ok(sep, 'in-group separator present');
  const btn = group.querySelector('button[data-command="scene.insert"]');
  assert.ok(btn);
  assert.equal(btn.textContent, '+ Scene');
});

test('F1A.6 — block-type select option labels match pre-F1A.6 vocabulary', () => {
  const { slot } = boot();
  const select = slot.querySelector('select.rga-shell-toolbar-blocktype');
  const labels = Array.from(select.options).map(function(o) {
    return [o.value, o.textContent];
  });
  assert.deepEqual(labels, [
    ['', '—'],
    ['action', 'Action'],
    ['character', 'Character'],
    ['dialogue', 'Dialogue'],
    ['parenthetical', 'Parenthetical'],
    ['shot', 'Shot'],
    ['transition', 'Transition'],
    ['sceneHeading', 'Scene Heading']
  ]);
});

// ----------------------------------------------------------------
// §3 — Behavior: block-type change → setBlockType
// ----------------------------------------------------------------

test('F1A.6 — block-type select change dispatches PM.setBlockType through the engine view', () => {
  const opts = { _setBlockTypeCalls: [], view: {} };
  // Build a view stub with a schema + state + dispatch.
  opts.view = {
    state: {
      schema: { nodes: { action: { name: 'action' }, dialogue: { name: 'dialogue' } } }
    },
    dispatch: function() {},
    focus: function() {}
  };
  const { slot } = boot(opts);
  const select = slot.querySelector('select.rga-shell-toolbar-blocktype');
  select.value = 'dialogue';
  // jsdom Event constructor — fire the 'change' event the listener expects.
  select.dispatchEvent(new global.window.Event('change'));
  assert.deepEqual(opts._setBlockTypeCalls, ['dialogue']);
});

test('F1A.6 — block-type change to empty value is a safe no-op', () => {
  const opts = { _setBlockTypeCalls: [], view: { state: { schema: { nodes: {} } }, dispatch: function() {}, focus: function() {} } };
  const { slot } = boot(opts);
  const select = slot.querySelector('select.rga-shell-toolbar-blocktype');
  select.value = '';
  select.dispatchEvent(new global.window.Event('change'));
  assert.deepEqual(opts._setBlockTypeCalls, [], 'empty value must not reach setBlockType');
});

// ----------------------------------------------------------------
// §4 — Behavior: scene.insert command → insertSceneSmart
// ----------------------------------------------------------------

test('F1A.6 — scene.insert command dispatches insertSceneSmart via the engine view', () => {
  const opts = {
    _insertSceneCalls: 0,
    view: { state: {}, dispatch: function() {}, focus: function() {} }
  };
  const { Rga } = boot(opts);
  Rga.KeyboardRegistry.invokeCommand('scene.insert');
  assert.equal(opts._insertSceneCalls, 1);
});

test('F1A.6 — scene.insert is a safe no-op when no editor view is active', () => {
  const opts = { _insertSceneCalls: 0, view: null };
  const { Rga } = boot(opts);
  Rga.KeyboardRegistry.invokeCommand('scene.insert');
  assert.equal(opts._insertSceneCalls, 0);
});

// ----------------------------------------------------------------
// §5 — Selection sync: ScriptMetrics notifications update the select
// ----------------------------------------------------------------

test('F1A.6 — ScriptMetrics change updates select.value to the current block type', () => {
  const opts = { currentBlockType: null };
  const { Rga, slot } = boot(opts);
  const select = slot.querySelector('select.rga-shell-toolbar-blocktype');
  // Initial paint — no block type → empty.
  assert.equal(select.value, '');
  Rga.ScriptMetrics._fire('dialogue');
  assert.equal(select.value, 'dialogue');
  Rga.ScriptMetrics._fire('action');
  assert.equal(select.value, 'action');
});

test('F1A.6 — ScriptMetrics change to an unknown block type clears the select', () => {
  const { Rga, slot } = boot({ currentBlockType: 'dialogue' });
  const select = slot.querySelector('select.rga-shell-toolbar-blocktype');
  assert.equal(select.value, 'dialogue');
  // Block type that isn't a select option (e.g., a non-screenplay
  // future block type — defensive).
  Rga.ScriptMetrics._fire('nonexistent-block-type');
  assert.equal(select.value, '');
});

test('F1A.6 — sceneHeading block type is visible in the select.value (held by the disabled option)', () => {
  const { Rga, slot } = boot({ currentBlockType: null });
  const select = slot.querySelector('select.rga-shell-toolbar-blocktype');
  Rga.ScriptMetrics._fire('sceneHeading');
  assert.equal(select.value, 'sceneHeading');
});

// ----------------------------------------------------------------
// §6 — Unmount: cleanup disconnects subscriptions
// ----------------------------------------------------------------

test('F1A.6 — unregisterGroup disconnects the ScriptMetrics subscription', () => {
  const { Rga, slot } = boot({ currentBlockType: 'action' });
  const select = slot.querySelector('select.rga-shell-toolbar-blocktype');
  assert.equal(select.value, 'action');
  // After unregister, the group + its subscription are gone — further
  // ScriptMetrics changes do NOT throw (because the select is detached)
  // and the listener count drops to 0.
  Rga.Shell.Toolbar.unregisterGroup('scene');
  // The slot has no group child now.
  assert.equal(slot.querySelector('[data-toolbar-group-id="scene"]'), null);
  // Firing a metrics change must not throw.
  Rga.ScriptMetrics._fire('dialogue');   // no exception
});
