// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Scene Toolbox / format-toolbar focus-tracking tests.
//
// Regression coverage for Bug: clicking the block-type <select> stole focus
// from the .rga-scene-block, causing changeBlockType to read a null
// activeElement and the toolbox to mark itself disabled.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bootDom() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html><body>
      <div id="format-toolbar" role="toolbar"></div>
      <div id="editor-container">
        <div id="editor" class="rga-page"></div>
        <aside id="scene-toolbox" class="scene-toolbox-vertical disabled">
          <select id="format-block-type">
            <option value=""></option>
            <option value="action">Action</option>
            <option value="character">Character</option>
            <option value="dialogue">Dialogue</option>
          </select>
          <button id="format-btn-annotation"></button>
          <button id="format-btn-flag"></button>
          <select id="scene-tb-tag">
            <option value=""></option>
            <option value="character">Character</option>
          </select>
        </aside>
      </div>
    </body></html>
  `, { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  // Stub editor view (FormatToolbar reads view.state.schema.marks / selection)
  const fakeSchema = { marks: {} };
  const fakeView = {
    state: { schema: fakeSchema, selection: { from: 0, to: 0, empty: true, $from: { marks: () => [] } } },
    focus: () => {},
    dispatch: () => {}
  };
  dom.window.Rga = {
    TabManager: { _editorView: () => fakeView }
  };
  dom.window.RgaProseMirror = {};
  return dom;
}

function loadFormatToolbar() {
  const p = require.resolve('../../renderer/js/format-toolbar.js');
  delete require.cache[p];
  require(p);
  return global.window.Rga.FormatToolbar;
}

function buildSceneBlock(spy) {
  const frame = document.createElement('div');
  frame.className = 'rga-scene-frame-placeholder';
  frame._rgaScenePlaceholder = {
    _changeBlockType: function(el, newType) { spy.calls.push({ el: el, type: newType }); },
    _dispatchInner: function() { spy.dispatched++; }
  };
  const block = document.createElement('div');
  block.className = 'rga-scene-block rga-block-action';
  block.dataset.blockType = 'action';
  block.tabIndex = 0;
  frame.appendChild(block);
  document.body.appendChild(frame);
  return { frame, block };
}

test('block-type dropdown change targets the last-focused scene block', () => {
  bootDom();
  const FT = loadFormatToolbar();
  FT.init();

  const spy = { calls: [], dispatched: 0 };
  const { block } = buildSceneBlock(spy);

  // Simulate focus landing in the scene block.
  block.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));

  // User opens the select and picks 'character'. In the browser this steals
  // focus from `block` onto the select before `change` fires.
  const select = document.getElementById('format-block-type');
  select.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
  select.value = 'character';
  select.dispatchEvent(new window.Event('change', { bubbles: true }));

  assert.equal(spy.calls.length, 1, 'changeBlockType should be invoked once');
  assert.equal(spy.calls[0].el, block, 'target element should be the previously focused scene block');
  assert.equal(spy.calls[0].type, 'character');
});

test('scene toolbox stays enabled while focus is on its own controls', () => {
  bootDom();
  const FT = loadFormatToolbar();
  FT.init();

  const spy = { calls: [], dispatched: 0 };
  const { block } = buildSceneBlock(spy);
  const toolbox = document.getElementById('scene-toolbox');
  const select = document.getElementById('format-block-type');

  block.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
  FT.refresh();
  assert.equal(toolbox.classList.contains('disabled'), false, 'enabled when focused inside frame');

  // Now focus moves into the toolbar select — toolbox must remain enabled
  // because the user is acting on the prior scene block.
  select.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
  FT.refresh();
  assert.equal(toolbox.classList.contains('disabled'), false, 'enabled while toolbar select is focused');
});

test('scene toolbox disables when focus moves to non-frame editor content', () => {
  bootDom();
  const FT = loadFormatToolbar();
  FT.init();

  const spy = { calls: [], dispatched: 0 };
  const { block } = buildSceneBlock(spy);
  const toolbox = document.getElementById('scene-toolbox');

  block.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
  FT.refresh();
  assert.equal(toolbox.classList.contains('disabled'), false);

  // Focus moves to a plain editor paragraph outside any scene frame.
  const para = document.createElement('p');
  para.tabIndex = 0;
  document.getElementById('editor').appendChild(para);
  para.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
  FT.refresh();
  assert.equal(toolbox.classList.contains('disabled'), true, 'disabled when focus leaves frame for editor body');
});
