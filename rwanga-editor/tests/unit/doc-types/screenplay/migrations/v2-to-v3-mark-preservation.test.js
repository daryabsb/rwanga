// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 5 acceptance gate: "migrated fixture preserves all notes/tags/flags".
// Pure-function tests on the v2→v3 migration — feeds it a hand-authored v2
// JSON doc carrying annotation / tag / revisionFlag marks (in every place
// they can legally live: action text, character cue, dialogue, parenthetical,
// transition, treatment), runs migration, asserts every mark survives.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function bootMig() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.Rga = {};
  const paths = [
    '../../../../../renderer/js/doc-types/screenplay/migrations/v1-to-v2.js',
    '../../../../../renderer/js/doc-types/screenplay/migrations/v2-to-v3.js',
    '../../../../../renderer/js/doc-types/screenplay/migrations/index.js'
  ];
  paths.forEach(function(p) { delete require.cache[require.resolve(p)]; require(p); });
  return { Migrations: global.window.Rga.Migrations };
}

// ----------------------------------------------------------------
// V2 fixture with EVERY mark-bearing surface marked
// ----------------------------------------------------------------
function buildV2DocWithMarks() {
  return {
    rga_version: '2.0',
    document_type: 'screenplay',
    metadata: { title: 'Marks fixture', language: 'en' },
    settings: {},
    tag_registry: { characters: [{ id: 'nali-id', name: 'NALI', color: '#fff' }] },
    flag_log: [],
    body: {
      type: 'doc',
      content: [
        { type: 'titleStrip', attrs: { removable: true }, content: [
          { type: 'heading', content: [{ type: 'text', text: 'Marks fixture' }] }
        ]},
        { type: 'body', content: [
        // Treatment paragraph (lives outside any sceneFrame; v2 supports
        // notes/flags here too).
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Treatment ' },
            { type: 'text', text: 'highlighted', marks: [
              { type: 'annotation', attrs: { id: 'treat-note', color: '#ff0', text: 'check', status: 'open', createdAt: '2026-01-01', author: null } }
            ]},
            { type: 'text', text: ' rest.' }
          ]
        },
        {
          type: 'sceneFrame',
          attrs: {
            id: 'sc-1',
            number: 1,
            headingStyle: null,
            innerDoc: {
              type: 'doc',
              attrs: { notes: 'scene-level note', revisionFlag: 'red' },
              content: [
                // sceneLine (heading) — with annotation mark on location
                {
                  type: 'sceneLine',
                  attrs: { setting: 'INT.', time: 'DAY' },
                  content: [
                    { type: 'text', text: 'OLD HOUSE', marks: [
                      { type: 'annotation', attrs: { id: 'head-note', color: '#0ff', text: 'set name?', status: 'open', createdAt: '2026-01-01', author: null } }
                    ]}
                  ]
                },
                // action with revisionFlag mark
                {
                  type: 'action',
                  content: [
                    { type: 'text', text: 'Alex enters. ' },
                    { type: 'text', text: 'rough', marks: [
                      { type: 'revisionFlag', attrs: { id: 'flag-action', color: '#f00', reason: 'fix later', status: 'open', createdAt: '2026-01-01' } }
                    ]},
                    { type: 'text', text: ' draft.' }
                  ]
                },
                // character cue with tag mark
                {
                  type: 'character',
                  content: [
                    { type: 'text', text: 'NALI', marks: [
                      { type: 'tag', attrs: { tagType: 'character', entityId: 'nali-id' } }
                    ]}
                  ]
                },
                // parenthetical (no parens; migration wraps them)
                {
                  type: 'parenthetical',
                  content: [
                    { type: 'text', text: 'softly', marks: [
                      { type: 'annotation', attrs: { id: 'paren-note', color: '#0f0', text: 'rephrase', status: 'open', createdAt: '2026-01-01', author: null } }
                    ]}
                  ]
                },
                // dialogue with tag mark (character mention mid-line)
                {
                  type: 'dialogue',
                  content: [
                    { type: 'text', text: 'I am ' },
                    { type: 'text', text: 'NALI', marks: [
                      { type: 'tag', attrs: { tagType: 'character', entityId: 'nali-id' } }
                    ]},
                    { type: 'text', text: '.' }
                  ]
                },
                // transition with annotation mark (THE bug this phase fixes)
                {
                  type: 'transition',
                  content: [
                    { type: 'text', text: 'CUT TO:', marks: [
                      { type: 'annotation', attrs: { id: 'trans-note', color: '#f0f', text: 'soft cut?', status: 'open', createdAt: '2026-01-01', author: null } }
                    ]}
                  ]
                }
              ]
            }
          }
        }
        ]} // close inner body
      ]
    }
  };
}

// ----------------------------------------------------------------
// Helpers — collect every mark of a given type from any text node
// reachable from `node`. Works on v2 OR v3 JSON.
// ----------------------------------------------------------------
function collectMarkIds(node, markType, key) {
  const ids = [];
  (function walk(n) {
    if (!n) return;
    if (Array.isArray(n.content)) n.content.forEach(walk);
    if (Array.isArray(n.marks)) {
      n.marks.forEach(function(m) {
        if (m && m.type === markType) {
          if (key === 'attrs.id' && m.attrs) ids.push(m.attrs.id);
          else if (key === 'attrs.entityId' && m.attrs) ids.push(m.attrs.entityId);
        }
      });
    }
    // v2-specific: walk into sceneFrame.attrs.innerDoc
    if (n.type === 'sceneFrame' && n.attrs && n.attrs.innerDoc) walk(n.attrs.innerDoc);
  })(node);
  return ids.sort();
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------
test('v2→v3 migration preserves every annotation mark id', () => {
  const { Migrations } = bootMig();
  const v2 = buildV2DocWithMarks();
  const before = collectMarkIds(v2.body, 'annotation', 'attrs.id').sort();

  const v3 = Migrations.migrate(v2);
  assert.equal(v3.rga_version, '3.0');
  const after = collectMarkIds(v3.body, 'annotation', 'attrs.id').sort();
  assert.deepEqual(after, before, 'all annotation ids preserved (incl. on transition)');
});

test('v2→v3 migration preserves every tag mark entityId', () => {
  const { Migrations } = bootMig();
  const v2 = buildV2DocWithMarks();
  const before = collectMarkIds(v2.body, 'tag', 'attrs.entityId').sort();

  const v3 = Migrations.migrate(v2);
  const after = collectMarkIds(v3.body, 'tag', 'attrs.entityId').sort();
  assert.deepEqual(after, before, 'all tag entityIds preserved');
});

test('v2→v3 migration preserves every revisionFlag mark id', () => {
  const { Migrations } = bootMig();
  const v2 = buildV2DocWithMarks();
  const before = collectMarkIds(v2.body, 'revisionFlag', 'attrs.id').sort();

  const v3 = Migrations.migrate(v2);
  const after = collectMarkIds(v3.body, 'revisionFlag', 'attrs.id').sort();
  assert.deepEqual(after, before, 'all revisionFlag ids preserved');
});

test('v2→v3 migration carries scene-level notes + revisionFlag from innerDoc.attrs to scene.attrs', () => {
  const { Migrations } = bootMig();
  const v2 = buildV2DocWithMarks();
  const v3 = Migrations.migrate(v2);
  // Find the migrated scene.
  let scene = null;
  (function walk(n) {
    if (!n || scene) return;
    if (n.type === 'scene') { scene = n; return; }
    if (Array.isArray(n.content)) n.content.forEach(walk);
  })(v3.body);
  assert.ok(scene, 'migrated scene found');
  assert.equal(scene.attrs.notes, 'scene-level note');
  assert.equal(scene.attrs.revisionFlag, 'red');
});

test('v2→v3 migration preserves marks on the TRANSITION block (Phase 5 fix)', () => {
  const { Migrations } = bootMig();
  const v2 = buildV2DocWithMarks();
  const v3 = Migrations.migrate(v2);
  // Find the migrated transition.
  let transition = null;
  (function walk(n) {
    if (!n || transition) return;
    if (n.type === 'transition') { transition = n; return; }
    if (Array.isArray(n.content)) n.content.forEach(walk);
  })(v3.body);
  assert.ok(transition, 'migrated transition found');
  assert.ok(Array.isArray(transition.content) && transition.content.length > 0);
  const text = transition.content[0];
  assert.equal(text.text, 'CUT TO:');
  assert.ok(Array.isArray(text.marks) && text.marks.length === 1);
  assert.equal(text.marks[0].type, 'annotation');
  assert.equal(text.marks[0].attrs.id, 'trans-note');
  // And the derived presetType still falls back correctly for "CUT TO:"
  assert.equal(transition.attrs.presetType, 'CUT');
});

test('v2→v3 migration preserves marks across treatment area (paragraph outside any scene)', () => {
  const { Migrations } = bootMig();
  const v2 = buildV2DocWithMarks();
  const v3 = Migrations.migrate(v2);
  // doc → [titleStrip, body]; body.content[0] = treatment paragraph.
  const body = v3.body.content.find(function(c) { return c.type === 'body'; });
  assert.ok(body, 'body wrapper present in v3 doc');
  const first = body.content[0];
  assert.equal(first.type, 'paragraph');
  const fragWithMark = first.content.find(function(c) { return c && Array.isArray(c.marks) && c.marks.length > 0; });
  assert.ok(fragWithMark, 'paragraph fragment with marks present');
  assert.equal(fragWithMark.marks[0].type, 'annotation');
  assert.equal(fragWithMark.marks[0].attrs.id, 'treat-note');
});
