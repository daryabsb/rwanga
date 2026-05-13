// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// esbuild entry — re-exports ProseMirror APIs as window.RgaProseMirror.*
const { EditorState, Plugin, PluginKey, TextSelection, NodeSelection } = require('prosemirror-state');
const { EditorView, Decoration, DecorationSet } = require('prosemirror-view');
const { Schema, DOMParser, DOMSerializer, Node: PMNode, Fragment } = require('prosemirror-model');
const { keymap } = require('prosemirror-keymap');
const { history, undo, redo } = require('prosemirror-history');
const { baseKeymap, toggleMark, chainCommands, setBlockType, wrapIn } = require('prosemirror-commands');
const { schema: basicSchema } = require('prosemirror-schema-basic');
const { addListNodes } = require('prosemirror-schema-list');
const { inputRules, InputRule } = require('prosemirror-inputrules');

module.exports = {
  EditorState, Plugin, PluginKey, TextSelection, NodeSelection,
  EditorView, Decoration, DecorationSet,
  Schema, DOMParser, DOMSerializer, PMNode, Fragment,
  keymap,
  history, undo, redo,
  baseKeymap, toggleMark, chainCommands, setBlockType, wrapIn,
  basicSchema,
  addListNodes,
  inputRules, InputRule
};
