// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

function buildSchema() {
  return new Schema({
    nodes: {
      doc:        { content: 'body' },
      body:       { content: 'block*', toDOM() { return ['div', 0]; } },
      paragraph:  { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      sceneFrame: {
        group: 'block',
        atom: true,
        attrs: { id: { default: null }, number: { default: null }, headingStyle: { default: null }, innerDoc: { default: null } },
        toDOM() { return ['div', 0]; }
      },
      text: { group: 'inline' }
    },
    marks: {}
  });
}

test('invariant 1: sceneFrame is atomic — cannot contain children', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('sceneFrame', { id: null, number: null, headingStyle: null, innerDoc: null }, [s.text('illegal')]);
  });
});

test('invariant 2: sceneFrame is in the block group', () => {
  const s = buildSchema();
  assert.ok(s.nodes.sceneFrame.isInGroup('block'));
});
