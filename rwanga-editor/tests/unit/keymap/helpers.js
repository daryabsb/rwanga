// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { Schema } = require('prosemirror-model');
const { EditorState, TextSelection } = require('prosemirror-state');

function buildSchema() {
  return new Schema({
    nodes: {
      doc: { content: 'titleStrip? body' },
      titleStrip: { content: 'text*', attrs: { removable: { default: true } }, toDOM() { return ['div', 0]; } },
      body: { content: 'block*', toDOM() { return ['div', 0]; } },
      paragraph: { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      scene: {
        content: 'sceneLine (action | character | dialogue | parenthetical | transition | shot | inlineFreeText)*',
        group: 'block',
        attrs: { id: { default: null }, number: { default: null }, notes: { default: '' }, revisionFlag: { default: null }, headingStyle: { default: null } },
        toDOM() { return ['div', 0]; }
      },
      sceneLine: { content: 'inline*', group: 'screenplay', attrs: { setting: { default: 'INT.' }, time: { default: 'DAY' } }, toDOM() { return ['div', 0]; } },
      action: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      character: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      dialogue: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      parenthetical: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      transition: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      shot: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      inlineFreeText: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      text: { group: 'inline' }
    },
    marks: {}
  });
}

/** Find first position inside a node of typeName. */
function posInNode(doc, typeName) {
  let result = null;
  doc.descendants(function(node, pos) {
    if (result == null && node.type.name === typeName) {
      result = pos + 1;
    }
  });
  return result;
}

/** Create an EditorState with cursor placed at posInNode(doc, typeName). */
function stateWithCursorIn(s, doc, typeName) {
  const pos = posInNode(doc, typeName);
  const base = EditorState.create({ schema: s, doc });
  return base.apply(base.tr.setSelection(TextSelection.near(base.doc.resolve(pos))));
}

/** Apply a command and return the resulting state (or null if command declined). */
function applyCmd(state, cmd) {
  let result = null;
  const handled = cmd(state, function(tr) { result = state.apply(tr); });
  return handled ? result : null;
}

/** Set up window globals so keymap.js can be required in Node. */
function setupKeymapGlobals() {
  global.window = global.window || {};
  global.window.RgaProseMirror = { TextSelection };
  global.window.Rga = {};
}

/** Load keymap module fresh and return its internals. */
function loadKeymap() {
  const path = require.resolve('../../../renderer/js/doc-types/screenplay/keymap.js');
  delete require.cache[path];
  setupKeymapGlobals();
  require('../../../renderer/js/doc-types/screenplay/keymap.js');
  return global.window.Rga.DocTypes.screenplay._keymapInternals;
}

module.exports = { buildSchema, posInNode, stateWithCursorIn, applyCmd, loadKeymap };
