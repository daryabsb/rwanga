# Scene-Line NodeView (Step B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `sceneLine` node (single editable text block) with a segmented slug-zone NodeView — Setting (picker), Location (free-text, PM-managed), Time (picker) — so a director-grade heading like `INT. CAFÉ — DAY` is structurally impossible to corrupt.

**Architecture:** The `location` attr is removed from the `sceneLine` schema and its text becomes the node's inline content (PM-managed); `setting` and `time` remain attrs driven by vocabulary pickers. A ProseMirror NodeView renders three zones inside a single `div.rga-scene-line`; the Setting and Time zones are `contenteditable=false` spans whose activation is tracked by `data-active-zone`; a companion `zoneKeyPlugin` intercepts Tab/Shift-Tab/Enter when focus is on a non-location zone. Old .rga files that stored location text in the `location` attr are migrated on load.

**Tech Stack:** ProseMirror NodeView API (`dom`/`contentDOM` pattern), vanilla JS (no framework), Node.js `node:test` for unit tests, `prosemirror-model` + `prosemirror-state` in tests.

---

## §0 Contract

This plan implements exactly what is described and no more. If any step reveals a gap — a missing API, a test that cannot be made to pass, behavior that is ambiguous — **STOP** and report to the designer before continuing. Do not fill gaps by guessing. The GO/NO-GO checkpoint at Task 4 is a hard gate; do not proceed to Task 5 without passing it.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `renderer/js/constants.js` | Add `DEFAULT_VOCABULARY` |
| Modify | `renderer/js/doc.js` | Add vocabulary/headingStyle to settings; `_migrateSceneLineLocations()` |
| Modify | `renderer/js/doc-types/screenplay/schema.js` | Remove `location` attr; fix `setting` default; add `scene.headingStyle` |
| Modify | `renderer/js/doc-types/screenplay/keymap.js` | Tab/Shift-Tab zone activation; newSceneAfterCurrent fix |
| Create | `renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js` | NodeView class, factory, zoneKeyPlugin |
| Modify | `renderer/css/editor-prosemirror.css` | Slug zone styles |
| Modify | `renderer/js/editor/mount.js` | Register NodeView factory + zoneKeyPlugin |
| Modify | `renderer/index.html` | Script tag for scene-line-node-view.js |
| Modify | `tests/unit/doc.test.js` | 3 new vocabulary tests |
| Modify | `tests/unit/schema/nodes.test.js` | Fix local mini-schema (remove `location` attr) |
| Modify | `tests/unit/keymap/helpers.js` | Fix local mini-schema (remove `location` attr) |
| Modify | `tests/unit/keymap/tab-cycle.test.js` | Update Tab-sceneLine test; add 2 zone-activation tests |
| Modify | `tests/unit/keymap/enter.test.js` | Update newSceneAfterCurrent test (no text content) |
| Create | `tests/unit/doc-types/screenplay/scene-line-node-view.test.js` | Factory/plugin shape tests |

---

## Task 1: Vocabulary in settings

**Files:**
- Modify: `renderer/js/constants.js`
- Modify: `renderer/js/doc.js`
- Modify: `tests/unit/doc.test.js`

- [ ] **Step 1: Write 3 failing tests in `tests/unit/doc.test.js`**

Add after the existing pageSetup tests:

```javascript
test('Doc settings include vocabulary with default settings/times', () => {
  const doc = Doc.create();
  assert.ok(doc.settings.vocabulary, 'vocabulary key must exist');
  assert.ok(Array.isArray(doc.settings.vocabulary.settings), 'settings is an array');
  assert.ok(doc.settings.vocabulary.settings.includes('INT.'), 'INT. is present');
  assert.ok(Array.isArray(doc.settings.vocabulary.times), 'times is an array');
  assert.ok(doc.settings.vocabulary.times.includes('DAY'), 'DAY is present');
});

test('Doc settings include sceneHeadingStyle', () => {
  const doc = Doc.create();
  assert.equal(doc.settings.sceneHeadingStyle, 'twoLine');
});

test('Doc.deserialize backfills vocabulary on old file', () => {
  const schema = buildTestSchema();
  const doc = Doc.create();
  doc.body = schema.node('doc', null, [schema.node('body')]);
  const str = JSON.parse(Doc.serialize(doc));
  delete str.settings.vocabulary;
  delete str.settings.sceneHeadingStyle;
  const reloaded = Doc.deserialize(JSON.stringify(str), null, { schema });
  assert.ok(reloaded.settings.vocabulary);
  assert.equal(reloaded.settings.sceneHeadingStyle, 'twoLine');
});
```

- [ ] **Step 2: Run tests to verify 3 new tests fail**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

Expected: 97 pass, 3 fail.

- [ ] **Step 3: Add `DEFAULT_VOCABULARY` to `renderer/js/constants.js`**

After the `PAPER_SIZES` block (after line 35), add:

```javascript
    DEFAULT_VOCABULARY: {
      settings: ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.'],
      times: ['DAY', 'NIGHT', 'CONTINUOUS', 'DUSK', 'DAWN'],
      sceneWord: 'SCENE'
    },
```

- [ ] **Step 4: Add `vocabulary` and `sceneHeadingStyle` to `defaultSettings()` in `renderer/js/doc.js`**

In `defaultSettings()` (around line 45–57), add two fields after `pageSetup`:

```javascript
  function defaultSettings() {
    return {
      theme: 'dark',
      font_size: 12,
      font_family: 'Courier Prime',
      show_scene_numbers: true,
      page_size: 'Letter',
      pageSetup: {
        paperSize: 'Letter',
        margins: { top: 1, right: 1, bottom: 1, left: 1.5 },
      },
      vocabulary: {
        settings: ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.'],
        times: ['DAY', 'NIGHT', 'CONTINUOUS', 'DUSK', 'DAWN'],
        sceneWord: 'SCENE'
      },
      sceneHeadingStyle: 'twoLine',
    };
  }
```

- [ ] **Step 5: Add backfill in `deserialize()` in `renderer/js/doc.js`**

In `deserialize()`, after the existing `if (!settings.pageSetup)` line (line 201), add:

```javascript
    if (!settings.vocabulary) settings.vocabulary = defaultSettings().vocabulary;
    if (!settings.sceneHeadingStyle) settings.sceneHeadingStyle = 'twoLine';
```

- [ ] **Step 6: Run tests — expect 100 pass, 0 fail**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

Expected: 100 pass, 0 fail.

- [ ] **Step 7: Commit**

```
git add renderer/js/constants.js renderer/js/doc.js tests/unit/doc.test.js
git commit -m "feat(doc): vocabulary + sceneHeadingStyle in doc settings"
```

---

## Task 2: Schema update + migration

**Files:**
- Modify: `renderer/js/doc-types/screenplay/schema.js`
- Modify: `renderer/js/doc.js` (migration function)
- Modify: `tests/unit/schema/nodes.test.js`
- Modify: `tests/unit/keymap/helpers.js`

- [ ] **Step 1: Write 1 failing migration test in `tests/unit/doc.test.js`**

Add at the end:

```javascript
test('Doc.deserialize migrates old sceneLine location attr to inline text content', () => {
  // Simulate a v2.0 file that stored location as an attr (old schema)
  const { Schema } = require('prosemirror-model');
  const newSchema = new Schema({
    nodes: {
      doc: { content: 'body' },
      body: { content: 'block*', toDOM() { return ['div', 0]; } },
      scene: {
        content: 'sceneLine action*',
        group: 'block',
        attrs: { id: { default: null }, number: { default: null }, notes: { default: '' }, revisionFlag: { default: null } },
        toDOM() { return ['div', 0]; }
      },
      sceneLine: {
        content: 'inline*',
        group: 'screenplay',
        attrs: { setting: { default: 'INT.' }, time: { default: 'DAY' } },
        toDOM() { return ['div', 0]; }
      },
      action: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', 0]; } },
      text: { group: 'inline' }
    },
    marks: {}
  });

  const oldBodyJson = {
    type: 'doc',
    content: [{
      type: 'body',
      content: [{
        type: 'scene',
        attrs: { id: null, number: null, notes: '', revisionFlag: null },
        content: [
          {
            type: 'sceneLine',
            attrs: { setting: 'INT', location: 'CAFÉ', time: 'DAY' },
            content: []
          },
          { type: 'action', content: [] }
        ]
      }]
    }]
  };

  const fileJson = {
    rga_version: '2.0',
    document_type: 'screenplay',
    metadata: {},
    settings: {},
    body: oldBodyJson,
    tag_registry: {},
    flag_log: [],
    export_settings: {},
    runtime: {}
  };

  const reloaded = Doc.deserialize(JSON.stringify(fileJson), null, { schema: newSchema });
  const sceneLine = reloaded.body.firstChild.firstChild.child(0);
  assert.equal(sceneLine.type.name, 'sceneLine');
  assert.equal(sceneLine.textContent, 'CAFÉ');
  assert.equal(sceneLine.attrs.setting, 'INT');
  assert.equal(sceneLine.attrs.time, 'DAY');
});
```

- [ ] **Step 2: Run to verify this test fails**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

Expected: 100 pass, 1 fail.

- [ ] **Step 3: Add `_migrateSceneLineLocations` to `renderer/js/doc.js`**

Add this function BEFORE the `deserialize` function:

```javascript
  function _migrateSceneLineLocations(node) {
    if (!node || typeof node !== 'object') return node;
    if (node.type === 'sceneLine' && node.attrs && node.attrs.location !== undefined) {
      const locationText = node.attrs.location;
      const newAttrs = {};
      if (node.attrs.setting !== undefined) newAttrs.setting = node.attrs.setting;
      if (node.attrs.time !== undefined) newAttrs.time = node.attrs.time;
      const newContent = locationText ? [{ type: 'text', text: locationText }] : [];
      return { type: 'sceneLine', attrs: newAttrs, content: newContent };
    }
    if (Array.isArray(node.content)) {
      return Object.assign({}, node, { content: node.content.map(_migrateSceneLineLocations) });
    }
    return node;
  }
```

- [ ] **Step 4: Call migration in `deserialize()` before `schema.nodeFromJSON`**

In `deserialize()`, change the body parsing block (lines 187–193):

```javascript
    if (isV2 && parsed.body && schema) {
      try {
        const migratedBody = _migrateSceneLineLocations(parsed.body);
        pmBody = schema.nodeFromJSON(migratedBody);
      } catch (err) {
        throw new Error('Document body is invalid: ' + err.message);
      }
    }
```

- [ ] **Step 5: Run test — expect migration test to pass (101 pass, 0 fail)**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

- [ ] **Step 6: Update `sceneLine` in `renderer/js/doc-types/screenplay/schema.js`**

Replace the `sceneLine` node definition (lines 130–147):

```javascript
    sceneLine: {
      content: 'inline*',
      group: 'screenplay',
      attrs: {
        setting: { default: 'INT.' },   // INT. | EXT. | INT./EXT. | EXT./INT.
        time: { default: 'DAY' }
      },
      parseDOM: [{ tag: 'div.rga-scene-line' }],
      toDOM(node) {
        return ['div', {
          class: 'rga-scene-line',
          'data-setting': node.attrs.setting,
          'data-time': node.attrs.time
        }, 0];
      }
    },
```

Also add `headingStyle` attr to the `scene` node (after `revisionFlag`):

```javascript
      attrs: {
        id: { default: null },
        number: { default: null },
        notes: { default: '' },
        revisionFlag: { default: null },
        headingStyle: { default: null }
      },
```

- [ ] **Step 7: Fix the local mini-schema in `tests/unit/schema/nodes.test.js` (line 28)**

Change the `sceneLine` entry:

```javascript
      sceneLine: { content: 'inline*', group: 'screenplay', attrs: { setting: { default: 'INT.' }, time: { default: 'DAY' } }, toDOM() { return ['div', { class: 'rga-scene-line' }, 0]; } },
```

Also add `headingStyle` to `scene.attrs` in that file:

```javascript
      scene: {
        content: 'sceneLine (action | character | dialogue | parenthetical | transition | shot | inlineFreeText)*',
        group: 'block',
        attrs: { id: { default: null }, number: { default: null }, notes: { default: '' }, revisionFlag: { default: null }, headingStyle: { default: null } },
        toDOM() { return ['div', { class: 'rga-scene' }, 0]; }
      },
```

- [ ] **Step 8: Fix the local mini-schema in `tests/unit/keymap/helpers.js` (line 20)**

```javascript
      sceneLine: { content: 'inline*', group: 'screenplay', attrs: { setting: { default: 'INT.' }, time: { default: 'DAY' } }, toDOM() { return ['div', 0]; } },
```

Also add `headingStyle` to `scene.attrs` in helpers.js (line 16):

```javascript
      scene: {
        content: 'sceneLine (action | character | dialogue | parenthetical | transition | shot | inlineFreeText)*',
        group: 'block',
        attrs: { id: { default: null }, number: { default: null }, notes: { default: '' }, revisionFlag: { default: null }, headingStyle: { default: null } },
        toDOM() { return ['div', 0]; }
      },
```

- [ ] **Step 9: Check `tests/unit/round-trip.test.js` for any sceneLine schema — fix if present**

```
grep -n "sceneLine\|location" E:\api\rwanga\rwanga-editor\tests\unit\round-trip.test.js
```

If `location: { default: '' }` appears, remove it and fix `setting` default to `'INT.'`.

- [ ] **Step 10: Run tests — expect 101 pass, 0 fail**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

- [ ] **Step 11: Commit**

```
git add renderer/js/doc-types/screenplay/schema.js renderer/js/doc.js \
        tests/unit/schema/nodes.test.js tests/unit/keymap/helpers.js \
        tests/unit/round-trip.test.js tests/unit/doc.test.js
git commit -m "feat(schema): segmented slug zones — remove location attr, add headingStyle, migrate old files"
```

---

## Task 3: Keymap — zone activation and new-scene fix

**Files:**
- Modify: `renderer/js/doc-types/screenplay/keymap.js`
- Modify: `tests/unit/keymap/tab-cycle.test.js`
- Modify: `tests/unit/keymap/enter.test.js`

### What changes

| Command | Old behavior on `sceneLine` | New behavior |
|---------|----------------------------|--------------|
| `cycleBlockTypeForward` (Tab) | return `false` (no-op) | if cursor at end of location → `view.nodeDOM(pos)._rgaNodeView.activateZone('time')`, return `true`; otherwise return `false` |
| `cycleBlockTypeBackward` (Shift-Tab) | return `false` (no-op) | if cursor at start of location → `view.nodeDOM(pos)._rgaNodeView.activateZone('setting')`, return `true`; otherwise return `false` |
| `newSceneAfterCurrent` | inserts `schema.text('INT. ')` prefill, cursor after text | inserts sceneLine with `setting`/`time` attrs (empty content), cursor at position 0 of location |

### Tests: what changes

- The existing test `'Tab: sceneLine → no-op (returns false)'` in `tab-cycle.test.js` (line 76) places cursor at **start** of a non-empty sceneLine (`INT. X — DAY`). `parentOffset === 0`, `content.size === 14`, so `atEnd` is false → still returns `false`. **Test passes unchanged.**
- Add 2 new tests: Tab-at-end activates time zone; Shift-Tab-at-start activates setting zone.
- Add 1 new test: `newSceneAfterCurrent` creates sceneLine with empty content.

- [ ] **Step 1: Add 3 tests to `tests/unit/keymap/tab-cycle.test.js`**

Add these imports at the top of the file if not already present:

```javascript
const { EditorState, TextSelection } = require('prosemirror-state');
```

Add at the end of the file:

```javascript
test('Tab: sceneLine cursor at end → activates time zone (returns true)', () => {
  const locText = s.text('CAFÉ');
  const doc = s.node('doc', null, [
    s.node('body', null, [
      s.node('scene', null, [
        s.node('sceneLine', null, [locText]),
        s.node('action')
      ])
    ])
  ]);
  const base = EditorState.create({ schema: s, doc });
  // Place cursor at end of sceneLine content
  const slPos = posInNode(doc, 'sceneLine');
  const endPos = slPos + locText.nodeSize;
  const state = base.apply(base.tr.setSelection(TextSelection.near(base.doc.resolve(endPos))));
  let capturedZone = null;
  const mockView = { nodeDOM() { return { _rgaNodeView: { activateZone(z) { capturedZone = z; } } }; } };
  const cmd = internals.cycleBlockTypeForward(s);
  const handled = cmd(state, () => {}, mockView);
  assert.equal(handled, true);
  assert.equal(capturedZone, 'time');
});

test('Shift-Tab: sceneLine cursor at start → activates setting zone (returns true)', () => {
  const doc = sceneWithBlock('action');
  // stateWithCursorIn places cursor at start (offset 0) of sceneLine
  const state = stateWithCursorIn(s, doc, 'sceneLine');
  let capturedZone = null;
  const mockView = { nodeDOM() { return { _rgaNodeView: { activateZone(z) { capturedZone = z; } } }; } };
  const cmd = internals.cycleBlockTypeBackward(s);
  const handled = cmd(state, () => {}, mockView);
  assert.equal(handled, true);
  assert.equal(capturedZone, 'setting');
});

test('Shift-Tab: sceneLine cursor not at start → no-op (returns false)', () => {
  const locText = s.text('CAFÉ');
  const doc = s.node('doc', null, [
    s.node('body', null, [
      s.node('scene', null, [
        s.node('sceneLine', null, [locText]),
        s.node('action')
      ])
    ])
  ]);
  const base = EditorState.create({ schema: s, doc });
  // Cursor at end (offset 4) — not at start
  const slPos = posInNode(doc, 'sceneLine');
  const endPos = slPos + locText.nodeSize;
  const state = base.apply(base.tr.setSelection(TextSelection.near(base.doc.resolve(endPos))));
  const cmd = internals.cycleBlockTypeBackward(s);
  const handled = cmd(state, () => {});
  assert.equal(handled, false);
});
```

- [ ] **Step 2: Add 1 test to `tests/unit/keymap/enter.test.js`**

Find the `newSceneAfterCurrent` tests. After the existing ones, add:

```javascript
test('Ctrl+Enter: sceneLine in new scene has empty content (no prefill text)', () => {
  const doc = s.node('doc', null, [
    s.node('body', null, [
      s.node('paragraph', null, [s.text('outside')])
    ])
  ]);
  const state = stateWithCursorIn(s, doc, 'paragraph');
  const cmd = internals.newSceneAfterCurrent(s);
  const next = applyCmd(state, cmd);
  assert.ok(next, 'command handled');
  const scene = next.doc.firstChild.lastChild;
  assert.equal(scene.type.name, 'scene');
  const sceneLine = scene.child(0);
  assert.equal(sceneLine.type.name, 'sceneLine');
  assert.equal(sceneLine.content.size, 0, 'sceneLine content must be empty — no prefill text');
  assert.ok(sceneLine.attrs.setting, 'sceneLine has a setting attr');
});
```

- [ ] **Step 3: Run tests to verify 4 new tests fail**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

Expected: 101 pass, 4 fail.

- [ ] **Step 4: Update `cycleBlockTypeForward` in `renderer/js/doc-types/screenplay/keymap.js`**

Replace the entire `cycleBlockTypeForward` function:

```javascript
  function cycleBlockTypeForward(schema) {
    return function(state, dispatch, view) {
      const ctx = getSceneContext(state);
      if (!ctx.inSide) return false;

      if (ctx.sceneChildNode.type.name === 'sceneLine') {
        const $head = state.selection.$head;
        const atEnd = $head.parentOffset === ctx.sceneChildNode.content.size;
        if (!atEnd) return false;
        if (view) {
          const domNode = view.nodeDOM(ctx.sceneChildPos);
          const nv = domNode && domNode._rgaNodeView;
          if (nv) nv.activateZone('time');
        }
        return true;
      }

      const targetTypeName = FORWARD_CYCLE[ctx.sceneChildNode.type.name];
      if (!targetTypeName) return false;
      const targetType = schema.nodes[targetTypeName];
      if (!dispatch) return true;
      dispatch(state.tr.setNodeMarkup(ctx.sceneChildPos, targetType));
      return true;
    };
  }
```

- [ ] **Step 5: Update `cycleBlockTypeBackward` in `renderer/js/doc-types/screenplay/keymap.js`**

Replace the entire `cycleBlockTypeBackward` function:

```javascript
  function cycleBlockTypeBackward(schema) {
    return function(state, dispatch, view) {
      const ctx = getSceneContext(state);
      if (!ctx.inSide) return false;

      if (ctx.sceneChildNode.type.name === 'sceneLine') {
        const $head = state.selection.$head;
        const atStart = $head.parentOffset === 0;
        if (!atStart) return false;
        if (view) {
          const domNode = view.nodeDOM(ctx.sceneChildPos);
          const nv = domNode && domNode._rgaNodeView;
          if (nv) nv.activateZone('setting');
        }
        return true;
      }

      if (ctx.sceneChildNode.type.name === 'action') {
        const sceneLinePos = ctx.scenePos + 1;
        const sceneLineNode = ctx.sceneNode.child(0);
        const endOfSceneLine = sceneLinePos + sceneLineNode.nodeSize - 1;
        if (!dispatch) return true;
        const tr = state.tr;
        if (ctx.sceneChildNode.content.size === 0) {
          tr.delete(ctx.sceneChildPos, ctx.sceneChildPos + ctx.sceneChildNode.nodeSize);
        }
        const TextSelection = window.RgaProseMirror.TextSelection;
        tr.setSelection(TextSelection.near(tr.doc.resolve(endOfSceneLine)));
        dispatch(tr.scrollIntoView());
        return true;
      }

      const targetTypeName = BACKWARD_CYCLE[ctx.sceneChildNode.type.name];
      if (!targetTypeName) return false;
      const targetType = schema.nodes[targetTypeName];
      if (!dispatch) return true;
      dispatch(state.tr.setNodeMarkup(ctx.sceneChildPos, targetType));
      return true;
    };
  }
```

- [ ] **Step 6: Update `newSceneAfterCurrent` in `renderer/js/doc-types/screenplay/keymap.js`**

Replace the entire `newSceneAfterCurrent` function:

```javascript
  function newSceneAfterCurrent(schema) {
    return function(state, dispatch) {
      if (!dispatch) return true;
      const ctx = getSceneContext(state);
      const tr = state.tr;
      let insertPos;
      if (ctx.inSide) {
        insertPos = ctx.scenePos + ctx.sceneNode.nodeSize;
      } else {
        const $head = state.selection.$head;
        const bodyChildDepth = Math.min($head.depth, 2);
        insertPos = $head.after(bodyChildDepth);
      }
      const vocab = (Rga.Constants && Rga.Constants.DEFAULT_VOCABULARY) || {};
      const defaultSetting = (vocab.settings && vocab.settings[0]) || 'INT.';
      const defaultTime = (vocab.times && vocab.times[0]) || 'DAY';
      const sceneNode = schema.nodes.scene.create({}, [
        schema.nodes.sceneLine.create({ setting: defaultSetting, time: defaultTime }),
        schema.nodes.action.create()
      ]);
      tr.insert(insertPos, sceneNode);
      const TextSelection = window.RgaProseMirror.TextSelection;
      // Cursor lands at position 0 of sceneLine content (location zone)
      tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 2)));
      dispatch(tr.scrollIntoView());
      return true;
    };
  }
```

- [ ] **Step 7: Run tests — expect 105 pass, 0 fail**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

- [ ] **Step 8: Commit**

```
git add renderer/js/doc-types/screenplay/keymap.js \
        tests/unit/keymap/tab-cycle.test.js \
        tests/unit/keymap/enter.test.js
git commit -m "feat(keymap): Tab/Shift-Tab activate slug zones; newScene uses vocab attrs"
```

---

## Task 4: NodeView — structure + zone-key plugin  ← GO/NO-GO CHECKPOINT

**Files:**
- Create: `renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js`
- Modify: `renderer/css/editor-prosemirror.css`
- Modify: `renderer/js/editor/mount.js`
- Modify: `renderer/index.html`
- Create: `tests/unit/doc-types/screenplay/scene-line-node-view.test.js`

### Structure of the NodeView DOM

```
div.rga-scene-line  [data-active-zone="location"|"setting"|"time"]  (= dom)
  span.rga-slug-setting  [contenteditable=false]   shows setting attr
  span.rga-slug-sep                                 " — "
  span.rga-slug-location                            (= contentDOM, PM manages inline content)
  span.rga-slug-sep                                 " — "
  span.rga-slug-time  [contenteditable=false]       shows time attr
```

- [ ] **Step 1: Write 2 failing shape tests in `tests/unit/doc-types/screenplay/scene-line-node-view.test.js`**

First create the test directory if needed:

```
mkdir -p E:\api\rwanga\rwanga-editor\tests\unit\doc-types\screenplay
```

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// Minimal DOM mock — enough to construct the NodeView
function mockDom() {
  function el(tag) {
    const node = {
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
    return node;
  }
  global.document = { createElement: el };
}

function loadNodeView() {
  const path = require.resolve('../../../../renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js');
  delete require.cache[path];
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  global.window.Rga.DocTypes = global.window.Rga.DocTypes || {};
  global.window.Rga.DocTypes.screenplay = global.window.Rga.DocTypes.screenplay || {};
  global.window.RgaProseMirror = { Plugin: class Plugin { constructor(spec) { this.spec = spec; } } };
  require(path);
  return global.window.Rga.DocTypes.screenplay;
}

test('sceneLineNodeViewFactory is exported as a function', () => {
  mockDom();
  const sp = loadNodeView();
  assert.equal(typeof sp.sceneLineNodeViewFactory, 'function',
    'sceneLineNodeViewFactory must be a function');
});

test('sceneLineNodeViewFactory returns a constructor function', () => {
  mockDom();
  const sp = loadNodeView();
  const factory = sp.sceneLineNodeViewFactory(function() { return {}; });
  assert.equal(typeof factory, 'function',
    'factory(getSettings) must return a constructor function');
});

test('zoneKeyPlugin is exported as a function returning a Plugin', () => {
  mockDom();
  const sp = loadNodeView();
  assert.equal(typeof sp.zoneKeyPlugin, 'function', 'zoneKeyPlugin must be a function');
  const plugin = sp.zoneKeyPlugin();
  assert.ok(plugin instanceof global.window.RgaProseMirror.Plugin, 'result must be a Plugin');
});
```

- [ ] **Step 2: Run tests to verify 3 new tests fail**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

Expected: 105 pass, 3 fail.

- [ ] **Step 3: Create `renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js`**

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// SceneLine NodeView — segmented slug zones (Setting / Location / Time).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  const PM = window.RgaProseMirror;

  // ============================================================
  // SceneLineNodeView
  // ============================================================

  function SceneLineNodeView(node, view, getPos, getSettings) {
    this._view = view;
    this._getPos = getPos;
    this._getSettings = getSettings;

    // Root element — PM treats this as `dom`
    this.dom = document.createElement('div');
    this.dom.className = 'rga-scene-line';
    this.dom._rgaNodeView = this;  // backref for keymap commands

    // Setting zone (non-editable)
    this._settingSpan = document.createElement('span');
    this._settingSpan.className = 'rga-slug-setting';
    this._settingSpan.contentEditable = 'false';
    this._settingSpan.textContent = node.attrs.setting;

    // Separator 1
    var sep1 = document.createElement('span');
    sep1.className = 'rga-slug-sep';
    sep1.contentEditable = 'false';
    sep1.textContent = ' — ';  // em dash

    // Location zone — this is contentDOM (PM renders inline* here)
    this.contentDOM = document.createElement('span');
    this.contentDOM.className = 'rga-slug-location';

    // Separator 2
    var sep2 = document.createElement('span');
    sep2.className = 'rga-slug-sep';
    sep2.contentEditable = 'false';
    sep2.textContent = ' — ';

    // Time zone (non-editable)
    this._timeSpan = document.createElement('span');
    this._timeSpan.className = 'rga-slug-time';
    this._timeSpan.contentEditable = 'false';
    this._timeSpan.textContent = node.attrs.time;

    this.dom.appendChild(this._settingSpan);
    this.dom.appendChild(sep1);
    this.dom.appendChild(this.contentDOM);
    this.dom.appendChild(sep2);
    this.dom.appendChild(this._timeSpan);

    this._activeZone = 'location';
    this.dom.dataset.activeZone = 'location';

    this._settingSpan.addEventListener('mousedown', this._onZoneClick.bind(this, 'setting'));
    this._timeSpan.addEventListener('mousedown', this._onZoneClick.bind(this, 'time'));
  }

  SceneLineNodeView.prototype.activateZone = function(zone) {
    this._activeZone = zone;
    this.dom.dataset.activeZone = zone;
  };

  SceneLineNodeView.prototype._onZoneClick = function(zone, e) {
    e.preventDefault();
    this.activateZone(zone);
  };

  SceneLineNodeView.prototype.update = function(node) {
    if (node.type.name !== 'sceneLine') return false;
    this._settingSpan.textContent = node.attrs.setting;
    this._timeSpan.textContent = node.attrs.time;
    return true;
  };

  SceneLineNodeView.prototype.selectNode = function() {
    this.activateZone('location');
  };

  SceneLineNodeView.prototype.deselectNode = function() {
    this.dom.dataset.activeZone = 'location';
    this._activeZone = 'location';
  };

  // ============================================================
  // Factory
  // ============================================================

  function sceneLineNodeViewFactory(getSettings) {
    return function(node, view, getPos) {
      return new SceneLineNodeView(node, view, getPos, getSettings);
    };
  }

  // ============================================================
  // Zone-key plugin
  // ============================================================

  function zoneKeyPlugin() {
    return new PM.Plugin({
      props: {
        handleKeyDown: function(view, event) {
          // Find any scene-line with a non-location active zone
          var activeLine = document.querySelector(
            '.rga-scene-line[data-active-zone="setting"], .rga-scene-line[data-active-zone="time"]'
          );
          if (!activeLine || !activeLine._rgaNodeView) return false;
          var nv = activeLine._rgaNodeView;

          if (event.key === 'Tab' && !event.shiftKey) {
            if (nv._activeZone === 'setting') {
              // Tab from setting → move to location (contentDOM)
              nv.activateZone('location');
              event.preventDefault();
              return true;
            }
            if (nv._activeZone === 'time') {
              // Tab from time → activate action (same as Enter on sceneLine)
              nv.activateZone('location');
              event.preventDefault();
              var enterBehavior = Rga.DocTypes
                && Rga.DocTypes.screenplay
                && Rga.DocTypes.screenplay._keymapInternals
                && Rga.DocTypes.screenplay._keymapInternals.enterBehavior;
              if (enterBehavior) {
                var schema = Rga.DocTypes.screenplay.schema;
                return enterBehavior(schema)(view.state, view.dispatch, view);
              }
              return true;
            }
          }

          if (event.key === 'Tab' && event.shiftKey) {
            if (nv._activeZone === 'time') {
              // Shift-Tab from time → back to location
              nv.activateZone('location');
              event.preventDefault();
              return true;
            }
            if (nv._activeZone === 'setting') {
              // Shift-Tab from setting → nothing (already at the edge)
              nv.activateZone('location');
              event.preventDefault();
              return true;
            }
          }

          if (event.key === 'Enter') {
            // Enter on a non-location zone → same as Tab from time
            nv.activateZone('location');
            event.preventDefault();
            var eb = Rga.DocTypes
              && Rga.DocTypes.screenplay
              && Rga.DocTypes.screenplay._keymapInternals
              && Rga.DocTypes.screenplay._keymapInternals.enterBehavior;
            if (eb) {
              var sch = Rga.DocTypes.screenplay.schema;
              return eb(sch)(view.state, view.dispatch, view);
            }
            return true;
          }

          if (event.key === 'Escape') {
            nv.activateZone('location');
            event.preventDefault();
            return true;
          }

          // Arrow keys: let PM handle, reset active zone to location
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ||
              event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            nv.activateZone('location');
            return false;
          }

          // For setting zone: letter keys update the setting attr
          if (nv._activeZone === 'setting') {
            // Intercept all typing — setting is read-only until picker is built (Task 5)
            event.preventDefault();
            return true;
          }

          // For time zone: same
          if (nv._activeZone === 'time') {
            event.preventDefault();
            return true;
          }

          return false;
        }
      }
    });
  }

  // ============================================================
  // Exports
  // ============================================================

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.sceneLineNodeViewFactory = sceneLineNodeViewFactory;
  Rga.DocTypes.screenplay.zoneKeyPlugin = zoneKeyPlugin;
})();
```

- [ ] **Step 4: Add slug zone CSS to `renderer/css/editor-prosemirror.css`**

Add after the `.rga-scene-line` rule (or after the `.rga-shot` rule if scene-line styles are elsewhere):

```css
/* ---- Slug zones ---- */
.rga-slug-setting,
.rga-slug-time {
  cursor: pointer;
  border-radius: 2px;
  padding: 0 2px;
  user-select: none;
  font-weight: 700;
  letter-spacing: 0.03em;
  transition: background 0.1s;
}

.rga-slug-sep {
  user-select: none;
  color: var(--text-tertiary, #666);
}

.rga-slug-location {
  outline: none;
}

/* Active zone highlight */
.rga-scene-line[data-active-zone="setting"] .rga-slug-setting {
  background: var(--accent-primary, #569cd6);
  color: #fff;
}

.rga-scene-line[data-active-zone="time"] .rga-slug-time {
  background: var(--accent-primary, #569cd6);
  color: #fff;
}

/* Hover hint */
.rga-slug-setting:hover,
.rga-slug-time:hover {
  background: var(--bg-hover, rgba(255,255,255,0.08));
}
```

- [ ] **Step 5: Add NodeView factory and zone-key plugin registration to `renderer/js/editor/mount.js`**

In `mount()`, add `nodeViews` to the `EditorView` constructor (find the `new PM.EditorView` call, around line 88):

```javascript
    const view = new PM.EditorView(container, {
      state,
      nodeViews: Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.sceneLineNodeViewFactory
        ? { sceneLine: Rga.DocTypes.screenplay.sceneLineNodeViewFactory(function() {
              var doc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
              return doc && doc.settings ? doc.settings : null;
            })
          }
        : {},
      dispatchTransaction: function(tr) {
```

Also register `zoneKeyPlugin` in the plugins array (after the `pageBreaksPlugin` block):

```javascript
    if (Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.zoneKeyPlugin) {
      plugins.push(Rga.DocTypes.screenplay.zoneKeyPlugin());
    }
```

- [ ] **Step 6: Add script tag to `renderer/index.html`**

After the `page-breaks.js` script tag, add:

```html
<script src="js/doc-types/screenplay/plugins/scene-line-node-view.js"></script>
```

- [ ] **Step 7: Run unit tests — expect 108 pass, 0 fail**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

- [ ] **Step 8: Build and do a quick sanity smoke in browser / Electron**

```
cd /e/api/rwanga/rwanga-editor && npm run build:renderer 2>&1 | tail -5
```

Open the app. Create a new doc. Press Ctrl+Enter to insert a scene. Verify:
- Scene line renders as three zones: "INT." — (empty location) — "DAY"
- Click on "DAY" → it highlights blue
- Tab in location → "DAY" highlights blue
- Shift-Tab at start of location → "INT." highlights blue
- Esc or arrow key → highlight clears, cursor returns to location
- Typing in location → text appears normally

If any of these fail, **STOP** and report before continuing.

- [ ] **Step 9: Commit**

```
git add renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js \
        renderer/css/editor-prosemirror.css \
        renderer/js/editor/mount.js \
        renderer/index.html \
        tests/unit/doc-types/screenplay/scene-line-node-view.test.js
git commit -m "feat(editor): segmented slug NodeView with zone-key plugin"
```

---

## ★ GO/NO-GO CHECKPOINT

After Task 4 Step 8 smoke test, answer these questions honestly:

1. Does the three-zone slug render correctly in the DOM?
2. Does clicking Setting/Time highlight the zone?
3. Does Tab from location end activate Time?
4. Does Shift-Tab from location start activate Setting?
5. Does Escape/arrow clear the zone activation?
6. Does typing in location work normally?

**If ALL YES → GO.** Continue to Task 5.

**If ANY NO → NO-GO.** Activate the Fallback Plan (see end of document). Do **not** continue to Task 5.

---

## Task 5: Constrained pickers — vocabulary dropdowns for Setting/Time zones

**Files:**
- Modify: `renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js`
- Modify: `renderer/css/editor-prosemirror.css`

When a user activates the Setting or Time zone (by click or Tab navigation), a small dropdown appears immediately below the active zone span showing vocabulary options. Clicking an option updates the attr via a PM transaction.

- [ ] **Step 1: Add `_showPicker` to `SceneLineNodeView`**

Inside `SceneLineNodeView` (after `deselectNode`), add:

```javascript
  SceneLineNodeView.prototype._showPicker = function(zone) {
    var self = this;
    // Remove any existing picker
    this._closePicker();

    var items = [];
    var settings = this._getSettings && this._getSettings();
    var vocab = (settings && settings.vocabulary)
      || (Rga.Constants && Rga.Constants.DEFAULT_VOCABULARY)
      || {};
    items = zone === 'setting' ? (vocab.settings || ['INT.', 'EXT.', 'INT./EXT.']) : (vocab.times || ['DAY', 'NIGHT', 'CONTINUOUS']);

    var picker = document.createElement('div');
    picker.className = 'rga-slug-picker';
    items.forEach(function(item) {
      var opt = document.createElement('div');
      opt.className = 'rga-slug-picker-item';
      opt.textContent = item;
      opt.addEventListener('mousedown', function(e) {
        e.preventDefault();
        self._applyZoneValue(zone, item);
        self._closePicker();
        self.activateZone('location');
      });
      picker.appendChild(opt);
    });

    // Position below the active span
    var anchor = zone === 'setting' ? this._settingSpan : this._timeSpan;
    this.dom.appendChild(picker);
    this._picker = picker;
    // Use getBoundingClientRect for positioning
    var rect = anchor.getBoundingClientRect();
    var domRect = this.dom.getBoundingClientRect();
    picker.style.left = (rect.left - domRect.left) + 'px';
  };

  SceneLineNodeView.prototype._closePicker = function() {
    if (this._picker && this._picker.parentNode) {
      this._picker.parentNode.removeChild(this._picker);
    }
    this._picker = null;
  };

  SceneLineNodeView.prototype._applyZoneValue = function(zone, value) {
    var view = this._view;
    var pos = this._getPos();
    var node = view.state.doc.nodeAt(pos);
    if (!node) return;
    var attrs = zone === 'setting'
      ? Object.assign({}, node.attrs, { setting: value })
      : Object.assign({}, node.attrs, { time: value });
    var tr = view.state.tr.setNodeMarkup(pos, null, attrs);
    view.dispatch(tr);
  };
```

- [ ] **Step 2: Call `_showPicker` in `_onZoneClick` and in `activateZone`**

Update `_onZoneClick`:

```javascript
  SceneLineNodeView.prototype._onZoneClick = function(zone, e) {
    e.preventDefault();
    this.activateZone(zone);
    this._showPicker(zone);
  };
```

Update `activateZone` to close picker when returning to location:

```javascript
  SceneLineNodeView.prototype.activateZone = function(zone) {
    this._activeZone = zone;
    this.dom.dataset.activeZone = zone;
    if (zone === 'location') this._closePicker();
  };
```

Update the zone-key plugin Tab handling for setting zone to also show picker:

```javascript
            if (nv._activeZone === 'setting') {
              nv.activateZone('location');
              event.preventDefault();
              return true;
            }
```

Change to:

```javascript
            if (nv._activeZone === 'setting') {
              // Tab from Setting → go to location (picker already visible; Tab selects focused item or closes)
              nv._closePicker();
              nv.activateZone('location');
              event.preventDefault();
              return true;
            }
```

And after `nv.activateZone('setting')` in keymap zone-key plugin call `nv._showPicker('setting')`:

In the `handleKeyDown` of `zoneKeyPlugin`, wherever `nv.activateZone('...')` is called from keymap commands, also trigger the picker. But since keymap commands call `activateZone` before the zone-key plugin sees the event, the picker won't be triggered from keymap navigation.

Instead, add the picker trigger inside the zone-key plugin itself for when we detect the zone has become active via `data-active-zone`. Because keymap commands run before this plugin's `handleKeyDown`, the `data-active-zone` will already be updated by the time we reach this plugin's handler. We can detect the zone from `activeLine._rgaNodeView._activeZone` and show the picker.

Update the beginning of `handleKeyDown` in `zoneKeyPlugin`:

```javascript
          // If a non-location zone just became active (set by keymap), show picker
          var activeLine = document.querySelector(
            '.rga-scene-line[data-active-zone="setting"], .rga-scene-line[data-active-zone="time"]'
          );
          if (!activeLine || !activeLine._rgaNodeView) return false;
          var nv = activeLine._rgaNodeView;

          // Show picker on first entry into a non-location zone
          if (!nv._picker) {
            nv._showPicker(nv._activeZone);
          }
```

- [ ] **Step 3: Add picker CSS to `renderer/css/editor-prosemirror.css`**

```css
.rga-slug-picker {
  position: absolute;
  z-index: 200;
  background: var(--bg-secondary, #2d2d2d);
  border: 1px solid var(--border-secondary, #444);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  min-width: 80px;
  overflow: hidden;
}

.rga-slug-picker-item {
  padding: 5px 10px;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  color: var(--text-primary, #d4d4d4);
  white-space: nowrap;
}

.rga-slug-picker-item:hover {
  background: var(--accent-primary, #569cd6);
  color: #fff;
}
```

- [ ] **Step 4: Run tests — expect 108 pass, 0 fail**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

- [ ] **Step 5: Build and smoke test picker**

```
cd /e/api/rwanga/rwanga-editor && npm run build:renderer 2>&1 | tail -5
```

Open the app. Verify:
- Click "INT." → dropdown appears with INT., EXT., INT./EXT., EXT./INT.
- Click "EXT." → slug updates, picker closes, cursor moves to location
- Tab from end of location → DAY picker appears
- Click "NIGHT" → slug updates to NIGHT

If any fail, **STOP** and report.

- [ ] **Step 6: Commit**

```
git add renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js \
        renderer/css/editor-prosemirror.css
git commit -m "feat(editor): vocabulary pickers for Setting and Time slug zones"
```

---

## Task 6: Full zone navigation — arrow key edge handling

**Files:**
- Modify: `renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js`

The goal is: pressing ArrowLeft at position 0 of the location zone activates the Setting zone (instead of jumping to the previous node). ArrowRight at end of location activates Time zone.

- [ ] **Step 1: Add `ArrowLeft`/`ArrowRight` handling to `zoneKeyPlugin`**

In `handleKeyDown`, replace the existing arrow key block:

```javascript
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ||
              event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            nv.activateZone('location');
            return false;
          }
```

With:

```javascript
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ||
              event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            nv.activateZone('location');
            return false;
          }
```

(This block stays as-is — resetting to location when arrows are pressed from non-location zones is correct.)

Now add edge handling for when the cursor IS in the location zone. This must be added in a separate `handleKeyDown` check BEFORE the `activeLine` query, since the activeLine query only matches non-location zones:

```javascript
        handleKeyDown: function(view, event) {
          // ArrowLeft at start of location → activate setting zone
          // ArrowRight at end of location → activate time zone
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            var locationLine = document.querySelector('.rga-scene-line[data-active-zone="location"]');
            if (locationLine && locationLine._rgaNodeView) {
              var sel = view.state.selection;
              var $head = sel.$head;
              if ($head.parent.type.name === 'sceneLine') {
                var nv2 = locationLine._rgaNodeView;
                if (event.key === 'ArrowLeft' && $head.parentOffset === 0) {
                  nv2.activateZone('setting');
                  nv2._showPicker('setting');
                  event.preventDefault();
                  return true;
                }
                if (event.key === 'ArrowRight' && $head.parentOffset === $head.parent.content.size) {
                  nv2.activateZone('time');
                  nv2._showPicker('time');
                  event.preventDefault();
                  return true;
                }
              }
            }
          }

          // ... rest of the existing handleKeyDown ...
```

- [ ] **Step 2: Run tests — expect 108 pass, 0 fail**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

- [ ] **Step 3: Build and smoke test arrow navigation**

```
cd /e/api/rwanga/rwanga-editor && npm run build:renderer 2>&1 | tail -5
```

Open the app. Verify:
- Type a location (e.g., "CAFÉ"), then ArrowRight at the end → Time zone activates
- ArrowLeft when Time zone is active → returns to location
- Press ArrowLeft from position 0 of location → Setting zone activates
- Press ArrowRight or Tab when Setting zone is active → returns to location

If any fail, **STOP** and report.

- [ ] **Step 4: Commit**

```
git add renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js
git commit -m "feat(editor): arrow-key edge navigation between slug zones"
```

---

## Task 7: Formal smoke test + GO/NO-GO declaration

This task is a structured manual verification. Work through every item; record PASS or FAIL for each. A single FAIL that can't be fixed within 30 minutes means NO-GO.

- [ ] **Build final bundle**

```
cd /e/api/rwanga/rwanga-editor && npm run build:renderer 2>&1 | tail -5
```

- [ ] **Run unit tests**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

Expected: 108 pass, 0 fail.

- [ ] **Open the app and verify every item below**

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 1 | Ctrl+Enter from outside a scene | New scene inserted; slug shows "INT." — empty location — "DAY" | |
| 2 | Click on "INT." zone | Zone highlights; picker shows INT./EXT./INT.\/EXT./EXT.\/INT. | |
| 3 | Click "EXT." in picker | Slug changes to "EXT.", picker closes, cursor in location | |
| 4 | Click on "DAY" zone | Zone highlights; picker shows DAY/NIGHT/CONTINUOUS/DUSK/DAWN | |
| 5 | Click "NIGHT" in picker | Slug changes to "NIGHT", picker closes, cursor in location | |
| 6 | Type "CAFÉ BALCON" in location | Text appears normally in the middle zone | |
| 7 | Tab at end of location | DAY/NIGHT picker opens | |
| 8 | Shift-Tab at start of location | INT./EXT. picker opens | |
| 9 | ArrowRight at end of location | Time zone activates | |
| 10 | ArrowLeft at start of location | Setting zone activates | |
| 11 | Escape from Setting zone | Zone deactivates, cursor back in location | |
| 12 | Enter in a scene (inside action) | Normal Enter behavior (new action) unaffected | |
| 13 | Enter with Tab-active Time zone | Action created after sceneLine | |
| 14 | Save file and reopen | Slug attrs persisted; location text persisted | |
| 15 | Load a file created with old schema | Location text appears correctly in location zone | |
| 16 | Page Setup dialog still works (Ctrl+Shift+G) | Dialog opens, margins apply | |
| 17 | Annotations, tags, revision flags unaffected | Context menu / marks still work inside action/dialogue | |

- [ ] **Record result and commit test log (or note in commit message)**

If all 17 pass:

```
git commit --allow-empty -m "chore(step-b): GO — slug NodeView smoke test 17/17 pass"
```

If any fail: do not commit. See Fallback Plan.

---

## STOP — Do Not Proceed to Step C

**After Task 7, STOP and report the GO/NO-GO result to the designer.**

Provide:
1. Unit test count (expected: 108 pass, 0 fail)
2. Smoke test results (17 items)
3. Any regressions observed (marks, tabs, save/open)
4. Your GO / NO-GO recommendation

**Do not begin Step C (two-line scene heading, segmented slug display CSS) until the designer has confirmed GO.**

---

## Fallback Plan — If GO/NO-GO Fails at Task 4 or Later

Activate this plan if the NodeView cannot be made to work cleanly (DOM issues, PM API mismatch, irreconcilable event conflicts).

**What to revert:**

1. Delete `renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js`

2. Remove the `nodeViews` option and `zoneKeyPlugin` registration from `renderer/js/editor/mount.js`

3. Remove the `scene-line-node-view.js` script tag from `renderer/index.html`

4. Restore `sceneLine` attrs in schema: add `location: { default: '' }` back (or keep it gone but lose the zone UI — the NodeView is the only consumer)

5. Keep schema change (location attr removed) — the migration was correct regardless; location text is in content. The slug line just renders as a flat editable line (current behavior).

6. Keep keymap changes (Tab/Shift-Tab no-op on sceneLine is fine; the zone-activation code silently no-ops without a NodeView).

7. Keep vocabulary settings and `newSceneAfterCurrent` fix — both are improvements regardless.

**What the fallback delivers:**

- Slug line is a flat editable line with the full text "INT. CAFÉ — DAY" (user types the whole thing)
- Validation pass (to be planned separately): after focus leaves the sceneLine, a regex validates the pattern; if it fails, a visual warning is shown
- Picker UI is deferred until a stable NodeView approach is found

**Fallback commit sequence:**

```
git revert HEAD~N..HEAD   # or manual deletion
git commit -m "revert(step-b): NodeView NO-GO — fallback to flat sceneLine with validation"
```

---

## Stop-Point Register additions

These items were deferred in this step and must be resolved before Step D (scene-level UX):

| ID | Item | Trigger |
|----|------|---------|
| SP-B-1 | Picker keyboard: arrow-up/down in open picker to cycle options | Step C design review |
| SP-B-2 | Auto-uppercase for location zone text | Step C design review |
| SP-B-3 | Scene heading two-line style CSS (Step C) | After GO confirmed |
| SP-B-4 | Permanent trigger for Page Setup (File menu item) | Phase 9 |
