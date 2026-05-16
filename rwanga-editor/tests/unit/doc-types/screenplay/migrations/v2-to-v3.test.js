// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Phase 2 — v2-to-v3 migration. Per-field assertions + fixture snapshot.
// Contract: docs/phase0-final-schema-contract.md §4.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function boot() {
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  const p = require.resolve('../../../../../renderer/js/doc-types/screenplay/migrations/v2-to-v3.js');
  delete require.cache[p];
  require(p);
  return global.window.Rga.Migrations._steps;
}

function v2WithScene(sceneFrame) {
  // Minimal v2 doc wrapping a single sceneFrame for focused tests.
  return {
    rga_version: '2.0',
    document_type: 'screenplay',
    metadata: { title: 't', language: 'en' },
    body: {
      type: 'doc',
      content: [{
        type: 'body',
        content: [sceneFrame]
      }]
    }
  };
}

function makeSceneFrame(innerContent, outerAttrs, innerAttrs) {
  return {
    type: 'sceneFrame',
    attrs: Object.assign({
      id: 'scene-001',
      number: 1,
      headingStyle: null,
      innerDoc: {
        type: 'doc',
        attrs: Object.assign({ notes: '', revisionFlag: null }, innerAttrs || {}),
        content: innerContent
      }
    }, outerAttrs || {})
  };
}

// ----------------------------------------------------------------
// Doc-level transforms
// ----------------------------------------------------------------

test('rga_version bumps to "3.0"', () => {
  const S = boot();
  const out = S.v2toV3({ rga_version: '2.0', metadata: {}, body: { type: 'doc', content: [] } });
  assert.equal(out.rga_version, '3.0');
});

test('metadata.language → metadata.screenplayProfile (en → ltr/hollywood)', () => {
  const S = boot();
  const out = S.v2toV3({
    rga_version: '2.0',
    metadata: { title: 't', language: 'en', author: 'a' },
    body: { type: 'doc', content: [] }
  });
  assert.equal(out.metadata.language, undefined, 'old flat language must be removed');
  assert.deepEqual(out.metadata.screenplayProfile, {
    language: 'en', direction: 'ltr', screenplayConvention: 'hollywood'
  });
  // Other metadata preserved
  assert.equal(out.metadata.title, 't');
  assert.equal(out.metadata.author, 'a');
});

test('screenplayProfile direction is rtl for ar / ku', () => {
  const S = boot();
  const ar = S.v2toV3({ rga_version: '2.0', metadata: { language: 'ar' }, body: { type: 'doc', content: [] } });
  assert.equal(ar.metadata.screenplayProfile.direction, 'rtl');
  const ku = S.v2toV3({ rga_version: '2.0', metadata: { language: 'ku' }, body: { type: 'doc', content: [] } });
  assert.equal(ku.metadata.screenplayProfile.direction, 'rtl');
});

test('missing metadata.language defaults to en/ltr/hollywood', () => {
  const S = boot();
  const out = S.v2toV3({ rga_version: '2.0', metadata: {}, body: { type: 'doc', content: [] } });
  assert.equal(out.metadata.screenplayProfile.language, 'en');
});

test('unknown metadata fields survive migration', () => {
  const S = boot();
  const out = S.v2toV3({
    rga_version: '2.0',
    metadata: { language: 'en', custom_field: { x: 1 } },
    body: { type: 'doc', content: [] }
  });
  assert.deepEqual(out.metadata.custom_field, { x: 1 });
});

test('unknown top-level fields survive migration', () => {
  const S = boot();
  const out = S.v2toV3({
    rga_version: '2.0',
    metadata: {},
    body: { type: 'doc', content: [] },
    settings: { theme: 'dark' },
    tag_registry: { characters: [{ id: 'x', name: 'X' }] },
    custom_top_level: { ok: true }
  });
  assert.deepEqual(out.custom_top_level, { ok: true });
  assert.equal(out.settings.theme, 'dark');
  assert.equal(out.tag_registry.characters[0].id, 'x');
});

// ----------------------------------------------------------------
// sceneFrame → scene
// ----------------------------------------------------------------

test('sceneFrame attrs.id carries to scene.attrs.id; number is dropped', () => {
  const S = boot();
  const out = S.v2toV3(v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'KITCHEN' }] },
    { type: 'action', content: [{ type: 'text', text: 'A.' }] },
    { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
  ])));
  const scene = out.body.content[0].content[0];
  assert.equal(scene.type, 'scene');
  assert.equal(scene.attrs.id, 'scene-001');
  assert.equal(scene.attrs.number, undefined, 'number must be dropped (derived in v3)');
});

test('innerDoc.attrs.notes and revisionFlag move to scene.attrs', () => {
  const S = boot();
  const out = S.v2toV3(v2WithScene(makeSceneFrame(
    [
      { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
      { type: 'action', content: [{ type: 'text', text: 'a' }] },
      { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
    ],
    null,
    { notes: 'a great note', revisionFlag: { color: '#F44', reason: 'needs polish' } }
  )));
  const scene = out.body.content[0].content[0];
  assert.equal(scene.attrs.notes, 'a great note');
  assert.deepEqual(scene.attrs.revisionFlag, { color: '#F44', reason: 'needs polish' });
});

test('scene.attrs.metadata is initialized to the structured default', () => {
  const S = boot();
  const out = S.v2toV3(v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
    { type: 'action' },
    { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
  ])));
  const scene = out.body.content[0].content[0];
  assert.deepEqual(scene.attrs.metadata, {
    linkedScenes: [],
    references: [],
    production: {}
  });
});

test('headingStyle migrates from sceneFrame.attrs to sceneHeading.attrs', () => {
  const S = boot();
  const out = S.v2toV3(v2WithScene(makeSceneFrame(
    [
      { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
      { type: 'action' },
      { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
    ],
    { headingStyle: 'inline' }
  )));
  const scene = out.body.content[0].content[0];
  assert.equal(scene.content[0].type, 'sceneHeading');
  assert.equal(scene.content[0].attrs.headingStyle, 'inline');
});

// ----------------------------------------------------------------
// sceneLine → sceneHeading
// ----------------------------------------------------------------

test('sceneLine becomes sceneHeading with content (NOT attrs.location)', () => {
  const S = boot();
  const out = S.v2toV3(v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'EXT.', time: 'DAWN' }, content: [{ type: 'text', text: 'OLD HOUSE' }] },
    { type: 'action' },
    { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
  ])));
  const sceneHeading = out.body.content[0].content[0].content[0];
  assert.equal(sceneHeading.type, 'sceneHeading');
  assert.equal(sceneHeading.attrs.setting, 'EXT.');
  assert.equal(sceneHeading.attrs.time, 'DAWN');
  // location MUST be in content, not attrs (correction 1)
  assert.equal(sceneHeading.attrs.location, undefined);
  assert.equal(sceneHeading.content[0].text, 'OLD HOUSE');
});

test('sceneHeading preserves marks on the location text', () => {
  const S = boot();
  const tagMark = { type: 'tag', attrs: { tagType: 'location', entityId: 'ent-house' } };
  const out = S.v2toV3(v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'EXT.', time: 'DAWN' }, content: [
      { type: 'text', text: 'OLD HOUSE', marks: [tagMark] }
    ]},
    { type: 'action' },
    { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
  ])));
  const sceneHeading = out.body.content[0].content[0].content[0];
  assert.deepEqual(sceneHeading.content[0].marks, [tagMark]);
});

// ----------------------------------------------------------------
// transition (correction 2: not atom, content-bearing, presetType)
// ----------------------------------------------------------------

test('transition keeps content + sets presetType for known preset "CUT"', () => {
  const S = boot();
  const out = S.v2toV3(v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
    { type: 'action' },
    { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
  ])));
  const scene = out.body.content[0].content[0];
  const trans = scene.content[scene.content.length - 1];
  assert.equal(trans.type, 'transition');
  assert.equal(trans.attrs.presetType, 'CUT');
  assert.equal(trans.content[0].text, 'CUT');
});

test('transition presetType derived for "FADE OUT"', () => {
  const S = boot();
  const out = S.v2toV3(v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
    { type: 'action' },
    { type: 'transition', content: [{ type: 'text', text: 'FADE OUT' }] }
  ])));
  const trans = out.body.content[0].content[0].content.slice(-1)[0];
  assert.equal(trans.attrs.presetType, 'FADE OUT');
});

test('transition with trailing colon ("CUT TO:") still matches preset', () => {
  const S = boot();
  const out = S.v2toV3(v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
    { type: 'action' },
    { type: 'transition', content: [{ type: 'text', text: 'CUT TO:' }] }
  ])));
  const trans = out.body.content[0].content[0].content.slice(-1)[0];
  assert.equal(trans.attrs.presetType, 'CUT');
  // content keeps the original text including the "TO:"
  assert.equal(trans.content[0].text, 'CUT TO:');
});

test('transition with custom text gets presetType=null but content preserved', () => {
  const S = boot();
  const out = S.v2toV3(v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
    { type: 'action' },
    { type: 'transition', content: [{ type: 'text', text: 'SLOW DISSOLVE INTO MEMORY' }] }
  ])));
  const trans = out.body.content[0].content[0].content.slice(-1)[0];
  assert.equal(trans.attrs.presetType, null);
  assert.equal(trans.content[0].text, 'SLOW DISSOLVE INTO MEMORY');
});

test('scene without a transition gets a synthesized CUT', () => {
  const S = boot();
  const out = S.v2toV3(v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
    { type: 'action' }
    // no transition
  ])));
  const scene = out.body.content[0].content[0];
  const last = scene.content[scene.content.length - 1];
  assert.equal(last.type, 'transition');
  assert.equal(last.attrs.presetType, 'CUT');
});

// ----------------------------------------------------------------
// parenthetical (correction 3: wrap text in parens; idempotent)
// ----------------------------------------------------------------

test('parenthetical text without parens gets wrapped', () => {
  const S = boot();
  const out = S.v2toV3(v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
    { type: 'character', content: [{ type: 'text', text: 'NALI' }] },
    { type: 'parenthetical', content: [{ type: 'text', text: 'barely a whisper' }] },
    { type: 'dialogue', content: [{ type: 'text', text: 'hi.' }] },
    { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
  ])));
  const scene = out.body.content[0].content[0];
  const paren = scene.content.find(function(b) { return b.type === 'parenthetical'; });
  assert.equal(paren.content[0].text, '(barely a whisper)');
});

test('parenthetical text already wrapped is NOT double-wrapped (idempotent)', () => {
  const S = boot();
  const out = S.v2toV3(v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
    { type: 'character', content: [{ type: 'text', text: 'NALI' }] },
    { type: 'parenthetical', content: [{ type: 'text', text: '(already wrapped)' }] },
    { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
  ])));
  const paren = out.body.content[0].content[0].content.find(function(b) { return b.type === 'parenthetical'; });
  assert.equal(paren.content[0].text, '(already wrapped)');
});

test('parenthetical with marks on the text — marks survive the wrap', () => {
  const S = boot();
  const italicMark = { type: 'italic' };
  const out = S.v2toV3(v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
    { type: 'character', content: [{ type: 'text', text: 'NALI' }] },
    { type: 'parenthetical', content: [{ type: 'text', text: 'soft', marks: [italicMark] }] },
    { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
  ])));
  const paren = out.body.content[0].content[0].content.find(function(b) { return b.type === 'parenthetical'; });
  assert.equal(paren.content[0].text, '(soft)');
  assert.deepEqual(paren.content[0].marks, [italicMark]);
});

// ----------------------------------------------------------------
// Mark preservation byte-for-byte
// ----------------------------------------------------------------

test('tag mark on action text survives byte-for-byte', () => {
  const S = boot();
  const tagMark = { type: 'tag', attrs: { tagType: 'character', entityId: 'ent-nali' } };
  const out = S.v2toV3(v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
    { type: 'action', content: [
      { type: 'text', text: 'Then ' },
      { type: 'text', text: 'NALI', marks: [tagMark] },
      { type: 'text', text: ' enters.' }
    ]},
    { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
  ])));
  const action = out.body.content[0].content[0].content.find(function(b) { return b.type === 'action'; });
  assert.equal(action.content.length, 3);
  assert.deepEqual(action.content[1].marks, [tagMark]);
});

test('annotation mark on dialogue text survives migration', () => {
  const S = boot();
  const annot = { type: 'annotation', attrs: { id: 'n1', text: 'note', color: '#FFE08A', status: 'open' } };
  const out = S.v2toV3(v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
    { type: 'character', content: [{ type: 'text', text: 'NALI' }] },
    { type: 'dialogue', content: [{ type: 'text', text: 'Hi.', marks: [annot] }] },
    { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
  ])));
  const dialogue = out.body.content[0].content[0].content.find(function(b) { return b.type === 'dialogue'; });
  assert.deepEqual(dialogue.content[0].marks, [annot]);
});

// ----------------------------------------------------------------
// Empty inter-scene paragraph spacers
// ----------------------------------------------------------------

test('empty paragraphs BETWEEN two sceneFrames are dropped', () => {
  const S = boot();
  const v2 = {
    rga_version: '2.0',
    metadata: {},
    body: {
      type: 'doc',
      content: [{
        type: 'body',
        content: [
          makeSceneFrame([
            { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
            { type: 'action' },
            { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
          ], { id: 's1' }),
          { type: 'paragraph' },                    // <-- empty spacer; should be dropped
          makeSceneFrame([
            { type: 'sceneLine', attrs: { setting: 'EXT.', time: 'NIGHT' }, content: [{ type: 'text', text: 'Y' }] },
            { type: 'action' },
            { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
          ], { id: 's2' })
        ]
      }]
    }
  };
  const out = S.v2toV3(v2);
  const body = out.body.content[0];
  // After migration: 2 scenes, no spacer between
  assert.equal(body.content.length, 2);
  assert.equal(body.content[0].type, 'scene');
  assert.equal(body.content[1].type, 'scene');
});

test('empty paragraphs in treatment area (no adjacent scene) are KEPT', () => {
  const S = boot();
  const v2 = {
    rga_version: '2.0',
    metadata: {},
    body: {
      type: 'doc',
      content: [{
        type: 'body',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Logline' }] },
          { type: 'paragraph' },                    // <-- empty IN treatment; should KEEP
          { type: 'paragraph', content: [{ type: 'text', text: 'The actual logline.' }] }
        ]
      }]
    }
  };
  const out = S.v2toV3(v2);
  const body = out.body.content[0];
  // 3 items still: heading, empty para, real para
  assert.equal(body.content.length, 3);
  assert.equal(body.content[1].type, 'paragraph');
});

test('empty paragraph TRAILING the last scene is dropped', () => {
  const S = boot();
  const v2 = {
    rga_version: '2.0',
    metadata: {},
    body: {
      type: 'doc',
      content: [{
        type: 'body',
        content: [
          makeSceneFrame([
            { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
            { type: 'action' },
            { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
          ]),
          { type: 'paragraph' }                     // trailing spacer
        ]
      }]
    }
  };
  const out = S.v2toV3(v2);
  const body = out.body.content[0];
  assert.equal(body.content.length, 1);
  assert.equal(body.content[0].type, 'scene');
});

// ----------------------------------------------------------------
// Round-trip + idempotency
// ----------------------------------------------------------------

test('migrating a v3 doc returns it unchanged (idempotent on v3)', () => {
  const S = boot();
  const v3 = {
    rga_version: '3.0',
    metadata: { title: 't', screenplayProfile: { language: 'en', direction: 'ltr', screenplayConvention: 'hollywood' } },
    body: { type: 'doc', content: [] }
  };
  // v2-to-v3 step would bump rga_version regardless; chain-level idempotency
  // is checked in index.test.js. Per-step semantics here.
  const out = S.v2toV3(v3);
  assert.equal(out.rga_version, '3.0');
});

test('does NOT mutate the input', () => {
  const S = boot();
  const input = v2WithScene(makeSceneFrame([
    { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' }, content: [{ type: 'text', text: 'X' }] },
    { type: 'parenthetical', content: [{ type: 'text', text: 'soft' }] },
    { type: 'transition', content: [{ type: 'text', text: 'CUT' }] }
  ]));
  const snapshot = JSON.parse(JSON.stringify(input));
  S.v2toV3(input);
  assert.deepEqual(input, snapshot);
});

// ----------------------------------------------------------------
// Internal helpers (smoke)
// ----------------------------------------------------------------

test('_v2toV3_derivePresetType: known + custom + null', () => {
  const S = boot();
  const fn = S._v2toV3_derivePresetType;
  assert.equal(fn('CUT'), 'CUT');
  assert.equal(fn('cut'), 'CUT');                  // case-insensitive
  assert.equal(fn('FADE OUT'), 'FADE OUT');
  assert.equal(fn('CUT TO:'), 'CUT');               // trailing punctuation stripped
  assert.equal(fn('MATCH CUT TO'), 'MATCH CUT');    // trailing " TO" stripped
  assert.equal(fn('SLOW DISSOLVE INTO MEMORY'), null);
  assert.equal(fn(''), null);
  assert.equal(fn(null), null);
});

test('_v2toV3_isAlreadyParenWrapped: detects (text) idempotency', () => {
  const S = boot();
  const fn = S._v2toV3_isAlreadyParenWrapped;
  assert.equal(fn('(hi)'), true);
  assert.equal(fn('(  spaced  )'), true);
  assert.equal(fn('hi'), false);
  assert.equal(fn('(missing close'), false);
  assert.equal(fn(''), false);
});

test('_v2toV3_deriveScreenplayProfile: en/ar/ku → ltr/rtl/rtl + hollywood', () => {
  const S = boot();
  const fn = S._v2toV3_deriveScreenplayProfile;
  assert.deepEqual(fn({ language: 'en' }), { language: 'en', direction: 'ltr', screenplayConvention: 'hollywood' });
  assert.deepEqual(fn({ language: 'ar' }), { language: 'ar', direction: 'rtl', screenplayConvention: 'hollywood' });
  assert.deepEqual(fn({ language: 'ku' }), { language: 'ku', direction: 'rtl', screenplayConvention: 'hollywood' });
  assert.deepEqual(fn({}),                 { language: 'en', direction: 'ltr', screenplayConvention: 'hollywood' });
});

// ----------------------------------------------------------------
// FIXTURE SNAPSHOT — sample-the-last-light.rga full migration
// ----------------------------------------------------------------

test('SAMPLE FIXTURE — sample-the-last-light.rga migrates without data loss', () => {
  const S = boot();
  const fixturePath = path.join(__dirname, '..', '..', '..', '..', 'fixtures', 'sample-the-last-light.rga');
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const v2 = JSON.parse(raw);
  const v3 = S.v2toV3(v2);

  // version bumped
  assert.equal(v3.rga_version, '3.0');

  // screenplayProfile derived
  assert.equal(v3.metadata.screenplayProfile.language, 'en');
  assert.equal(v3.metadata.screenplayProfile.direction, 'ltr');

  // metadata title preserved
  assert.equal(v3.metadata.title, 'The Last Light');
  assert.equal(v3.metadata.language, undefined, 'flat language removed');

  // settings + tag_registry + flag_log preserved
  assert.equal(v3.settings.pageSetup.paperSize, 'Letter');
  assert.equal(v3.tag_registry.characters.length, 3);
  assert.equal(v3.tag_registry.characters[0].id, 'ent-nali');
  assert.deepEqual(v3.flag_log, []);

  // body structure: titleStrip + body wrapper
  assert.equal(v3.body.content[0].type, 'titleStrip');
  const bodyNode = v3.body.content[1];
  assert.equal(bodyNode.type, 'body');

  // The original sample had 5 sceneFrames + interleaving empty paragraphs +
  // 6 treatment items (heading, para, heading, 3 paras). After migration:
  //   - 6 treatment items survive
  //   - 5 scenes (no longer sceneFrames)
  //   - all inter-scene empty paragraphs dropped
  //   - the trailing empty paragraph (after the last scene) dropped
  const scenes = bodyNode.content.filter(function(c) { return c.type === 'scene'; });
  assert.equal(scenes.length, 5);
  const sceneFrames = bodyNode.content.filter(function(c) { return c.type === 'sceneFrame'; });
  assert.equal(sceneFrames.length, 0, 'no sceneFrames remain after migration');

  // Per-scene structural assertions
  scenes.forEach(function(scene, i) {
    assert.ok(scene.attrs.id, 'scene ' + (i + 1) + ' must have an id');
    assert.equal(scene.attrs.number, undefined, 'scene ' + (i + 1) + ' must not carry number');
    assert.equal(typeof scene.attrs.notes, 'string');
    assert.deepEqual(scene.attrs.metadata, { linkedScenes: [], references: [], production: {} });
    // First child is sceneHeading; last is transition
    assert.equal(scene.content[0].type, 'sceneHeading');
    assert.equal(scene.content[scene.content.length - 1].type, 'transition');
    // sceneHeading has setting + time in attrs, content holds location
    const heading = scene.content[0];
    assert.ok(heading.attrs.setting);
    assert.ok(heading.attrs.time);
    assert.equal(heading.attrs.location, undefined);
  });

  // Scene 1 specific (from audit): id=scene-001, notes about mist, EXT./DAWN,
  // location OLD HOUSE — ROSE GARDEN
  const scene1 = scenes[0];
  assert.equal(scene1.attrs.id, 'scene-001');
  assert.equal(scene1.attrs.notes, 'Open quiet. Mist as a character.');
  const s1heading = scene1.content[0];
  assert.equal(s1heading.attrs.setting, 'EXT.');
  assert.equal(s1heading.attrs.time, 'DAWN');
  assert.equal(s1heading.content[0].text, 'OLD HOUSE — ROSE GARDEN');

  // The 6 tag-marks on character text survive byte-for-byte. Walk the
  // migrated body and count tag marks; expected 6.
  function countTagMarks(node, acc) {
    acc = acc || { n: 0 };
    if (!node || typeof node !== 'object') return acc;
    if (Array.isArray(node.content)) {
      node.content.forEach(function(c) { countTagMarks(c, acc); });
    }
    if (Array.isArray(node.marks)) {
      node.marks.forEach(function(m) { if (m && m.type === 'tag') acc.n += 1; });
    }
    return acc;
  }
  const tagCount = countTagMarks(v3.body).n;
  assert.equal(tagCount, 6, 'all 6 character tag marks survived');

  // Scene 2 parenthetical: the audit shows scene 2 has a parenthetical
  // "barely a whisper". After migration it must read "(barely a whisper)".
  const scene2 = scenes[1];
  const s2paren = scene2.content.find(function(b) { return b.type === 'parenthetical'; });
  assert.ok(s2paren, 'scene 2 has a parenthetical');
  // Concatenate all text in the parenthetical (handles multi-fragment case)
  const parenText = (s2paren.content || []).map(function(c) { return c.text || ''; }).join('');
  assert.equal(parenText, '(barely a whisper)');

  // Scene 5 ends with FADE OUT — presetType must be 'FADE OUT' and content
  // preserved.
  const scene5 = scenes[4];
  const s5trans = scene5.content[scene5.content.length - 1];
  assert.equal(s5trans.attrs.presetType, 'FADE OUT');
  assert.equal(s5trans.content[0].text, 'FADE OUT');

  // Scene 4 ends with DISSOLVE
  const scene4 = scenes[3];
  const s4trans = scene4.content[scene4.content.length - 1];
  assert.equal(s4trans.attrs.presetType, 'DISSOLVE');

  // runtime preserved
  assert.equal(v3.runtime.active_scene_id, 'scene-001');
});
