// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function mockDom() {
  function el(tag) {
    return {
      tagName: tag.toUpperCase(),
      className: '',
      textContent: '',
      dataset: {},
      style: {},
      _children: [],
      _listeners: {},
      addEventListener: function() {},
      appendChild: function(c) { this._children.push(c); return c; },
      removeChild: function(c) { this._children = this._children.filter(function(x) { return x !== c; }); return c; },
      get firstChild() { return this._children[0] || null; },
      setAttribute: function() {},
      querySelector: function() { return null; },
      getBoundingClientRect: function() { return { left: 0, top: 0, width: 0, height: 0 }; }
    };
  }
  global.document = { createElement: el };
}

function loadModule() {
  const path = require.resolve('../../../../renderer/js/doc-types/screenplay/scene-frame-node-view.js');
  delete require.cache[path];
  mockDom();
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  global.window.Rga.DocTypes = global.window.Rga.DocTypes || {};
  global.window.Rga.DocTypes.screenplay = global.window.Rga.DocTypes.screenplay || {};

  // Stub inner schema with a node() and nodeFromJSON()
  global.window.Rga.DocTypes.screenplay.innerSchema = {
    nodeFromJSON: function(j) { return { _stub: true, toJSON: function() { return j; } }; },
    node: function(name, attrs, content) { return { _stub: true, name: name, content: content, toJSON: function() { return { type: name }; } }; }
  };
  global.window.Rga.DocTypes.screenplay.emptyInnerDoc = function() {
    return { _stub: true, toJSON: function() { return { type: 'doc', content: [] }; } };
  };
  global.window.Rga.DocTypes.screenplay.buildInnerKeymap = function() { return { _stub: 'innerKeymap' }; };
  global.window.Rga.DocTypes.screenplay.buildZoneKeyPlugin = function() { return { _stub: 'zoneKey' }; };
  global.window.Rga.DocTypes.screenplay.sceneLineNodeViewFactory = function() { return function() { return {}; }; };

  // Stub a fake PM
  let lastViewCreated = null;
  global.window.RgaProseMirror = {
    EditorState: {
      create: function(spec) {
        return {
          schema: spec.schema,
          doc: spec.doc,
          plugins: spec.plugins,
          apply: function(tr) { return Object.assign({}, this, { doc: tr._newDoc || this.doc }); }
        };
      }
    },
    EditorView: function(container, props) {
      this.state = props.state;
      this.dom = container;
      this.dispatch = function(tr) {
        const newState = this.state.apply(tr);
        this.updateState(newState);
        if (props.dispatchTransaction) props.dispatchTransaction(tr);
      };
      this.updateState = function(s) { this.state = s; };
      this.destroy = function() { this._destroyed = true; };
      lastViewCreated = this;
    },
    history: function() { return { _stub: 'history' }; }
  };
  global.window.__lastViewCreated = function() { return lastViewCreated; };

  require(path);
  return global.window.Rga.DocTypes.screenplay;
}

test('sceneFrameNodeViewFactory is exported as a function', () => {
  const sp = loadModule();
  assert.equal(typeof sp.sceneFrameNodeViewFactory, 'function');
});

test('factory() returns a NodeView constructor', () => {
  const sp = loadModule();
  const ctor = sp.sceneFrameNodeViewFactory();
  assert.equal(typeof ctor, 'function');
});

test('NodeView constructor builds header + body DOM and mounts inner view', () => {
  const sp = loadModule();
  const ctor = sp.sceneFrameNodeViewFactory();
  const fakeOuterView = { state: { doc: {}, tr: { setNodeMarkup: function() { return this; } } }, dispatch: function() {} };
  const fakeNode = { attrs: { id: 'a', number: 1, headingStyle: null, innerDoc: null }, type: { name: 'sceneFrame' } };
  const nv = ctor(fakeNode, fakeOuterView, function() { return 0; });
  assert.ok(nv.dom);
  assert.equal(nv.dom.className, 'rga-scene-frame');
  // Header + body
  assert.equal(nv.dom._children.length, 2);
  assert.equal(nv.dom._children[0].className, 'rga-scene-frame-header');
  assert.equal(nv.dom._children[1].className, 'rga-scene-frame-body');
  // Inner view mounted into body
  assert.ok(nv._innerView, 'inner view must be created');
});

test('NodeView uses emptyInnerDoc when attrs.innerDoc is null', () => {
  const sp = loadModule();
  const ctor = sp.sceneFrameNodeViewFactory();
  const fakeOuterView = { state: { doc: {}, tr: { setNodeMarkup: function() { return this; } } }, dispatch: function() {} };
  const fakeNode = { attrs: { id: 'a', number: 1, headingStyle: null, innerDoc: null }, type: { name: 'sceneFrame' } };
  const nv = ctor(fakeNode, fakeOuterView, function() { return 0; });
  // The inner view's doc came from emptyInnerDoc
  assert.ok(nv._innerView.state.doc);
});

test('update returns false for non-sceneFrame node', () => {
  const sp = loadModule();
  const ctor = sp.sceneFrameNodeViewFactory();
  const fakeOuterView = { state: { doc: {}, tr: { setNodeMarkup: function() { return this; } } }, dispatch: function() {} };
  const fakeNode = { attrs: { id: 'a', number: 1, headingStyle: null, innerDoc: null }, type: { name: 'sceneFrame' } };
  const nv = ctor(fakeNode, fakeOuterView, function() { return 0; });
  assert.equal(nv.update({ type: { name: 'paragraph' } }), false);
});

test('stopEvent returns true', () => {
  const sp = loadModule();
  const ctor = sp.sceneFrameNodeViewFactory();
  const fakeOuterView = { state: { doc: {}, tr: { setNodeMarkup: function() { return this; } } }, dispatch: function() {} };
  const fakeNode = { attrs: { id: 'a', number: 1, headingStyle: null, innerDoc: null }, type: { name: 'sceneFrame' } };
  const nv = ctor(fakeNode, fakeOuterView, function() { return 0; });
  assert.equal(nv.stopEvent({}), true);
});

test('ignoreMutation returns true', () => {
  const sp = loadModule();
  const ctor = sp.sceneFrameNodeViewFactory();
  const fakeOuterView = { state: { doc: {}, tr: { setNodeMarkup: function() { return this; } } }, dispatch: function() {} };
  const fakeNode = { attrs: { id: 'a', number: 1, headingStyle: null, innerDoc: null }, type: { name: 'sceneFrame' } };
  const nv = ctor(fakeNode, fakeOuterView, function() { return 0; });
  assert.equal(nv.ignoreMutation({}), true);
});

test('destroy calls innerView.destroy', () => {
  const sp = loadModule();
  const ctor = sp.sceneFrameNodeViewFactory();
  const fakeOuterView = { state: { doc: {}, tr: { setNodeMarkup: function() { return this; } } }, dispatch: function() {} };
  const fakeNode = { attrs: { id: 'a', number: 1, headingStyle: null, innerDoc: null }, type: { name: 'sceneFrame' } };
  const nv = ctor(fakeNode, fakeOuterView, function() { return 0; });
  nv.destroy();
  assert.equal(nv._innerView._destroyed, true);
});

test('header renders the scene number', () => {
  const sp = loadModule();
  const ctor = sp.sceneFrameNodeViewFactory();
  const fakeOuterView = { state: { doc: {}, tr: { setNodeMarkup: function() { return this; } } }, dispatch: function() {} };
  const fakeNode = { attrs: { id: 'a', number: 7, headingStyle: null, innerDoc: null }, type: { name: 'sceneFrame' } };
  const nv = ctor(fakeNode, fakeOuterView, function() { return 0; });
  const header = nv.dom._children[0];
  const numEl = header._children[0];
  assert.equal(numEl.className, 'rga-scene-number');
  assert.equal(numEl.textContent, '7');
});

test('header renders "?" when number is null', () => {
  const sp = loadModule();
  const ctor = sp.sceneFrameNodeViewFactory();
  const fakeOuterView = { state: { doc: {}, tr: { setNodeMarkup: function() { return this; } } }, dispatch: function() {} };
  const fakeNode = { attrs: { id: 'a', number: null, headingStyle: null, innerDoc: null }, type: { name: 'sceneFrame' } };
  const nv = ctor(fakeNode, fakeOuterView, function() { return 0; });
  const numEl = nv.dom._children[0]._children[0];
  assert.equal(numEl.textContent, '?');
});
