// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// Minimal DOM mock — enough to load the module without a browser
function setupMockDom() {
  function el(tag) {
    return {
      tagName: tag.toUpperCase(),
      className: '',
      textContent: '',
      contentEditable: 'inherit',
      dataset: {},
      style: {},
      _children: [],
      addEventListener() {},
      appendChild(child) { this._children.push(child); return child; }
    };
  }
  global.document = { createElement: el };
}

function loadNodeView() {
  const modPath = require.resolve('../../../../renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js');
  delete require.cache[modPath];
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  global.window.Rga.DocTypes = global.window.Rga.DocTypes || {};
  global.window.Rga.DocTypes.screenplay = global.window.Rga.DocTypes.screenplay || {};
  global.window.RgaProseMirror = {
    Plugin: class Plugin { constructor(spec) { this.spec = spec; } }
  };
  require(modPath);
  return global.window.Rga.DocTypes.screenplay;
}

test('sceneLineNodeViewFactory is exported as a function', () => {
  setupMockDom();
  const sp = loadNodeView();
  assert.equal(typeof sp.sceneLineNodeViewFactory, 'function',
    'sceneLineNodeViewFactory must be a function');
});

test('sceneLineNodeViewFactory(getSettings) returns a constructor function', () => {
  setupMockDom();
  const sp = loadNodeView();
  const factory = sp.sceneLineNodeViewFactory(function() { return {}; });
  assert.equal(typeof factory, 'function',
    'factory(getSettings) must return a constructor function');
});

test('zoneKeyPlugin is exported as a function returning a Plugin instance', () => {
  setupMockDom();
  const sp = loadNodeView();
  assert.equal(typeof sp.zoneKeyPlugin, 'function', 'zoneKeyPlugin must be a function');
  const plugin = sp.zoneKeyPlugin();
  assert.ok(plugin instanceof global.window.RgaProseMirror.Plugin, 'result must be a Plugin');
});
