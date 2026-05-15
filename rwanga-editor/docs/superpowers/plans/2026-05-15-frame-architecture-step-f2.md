# Frame Architecture Step F2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `SceneFramePlaceholder` (F1 read-only box) with `SceneFrameNodeView`, which mounts a fully interactive **nested ProseMirror EditorView** inside each `sceneFrame` atom — so users can type screenplay content (sceneLine slug zones, action, character, dialogue, parenthetical, transition, shot, inlineFreeText) without the outer view interfering.

**Architecture:** Each `sceneFrame` atom in the outer doc owns one inner `EditorView` built from a separate `innerSchema`. The inner view's `dispatchTransaction` propagates doc changes back to the outer doc as a `setNodeMarkup` on `sceneFrame.attrs.innerDoc`. Reference equality on the just-sent JSON guards against the resulting outer→inner update loop. Old `SceneFramePlaceholder` stays alive as a fallback and remains testable.

**Tech Stack:** ProseMirror (`prosemirror-state`, `prosemirror-view`, `prosemirror-model`, `prosemirror-keymap`, `prosemirror-commands`, `prosemirror-history`), vanilla JS (no framework), Node.js `node:test` for unit tests.

---

## §0 Contract

This plan implements exactly what is described and no more. If any step reveals a gap — a missing API, a test that cannot be made to pass, behavior that is ambiguous — **STOP** and report to the designer before continuing. Do not fill gaps by guessing. The GO/NO-GO checkpoint at Task 6 is a hard gate; do not proceed past it without a clean smoke-test pass. The fallback (revert NodeView, keep schema/keymap/inner-schema additions) is documented at the bottom.

---

## §1 Scope

**In scope (F2):**
- Inner schema with full screenplay grammar (sceneLine, action, character, dialogue, parenthetical, transition, shot, inlineFreeText)
- Inner keymap: Tab/Shift-Tab block-type cycling, Enter for next-block-of-same-type, mark toggles (Mod-B, Mod-I)
- Inner slug-zone NodeView (Setting/Location/Time) with vocabulary pickers
- Zone-key plugin for arrow/Tab edge navigation between zones
- SceneFrame NodeView mounting an inner EditorView per atom
- Wire-up in `mount.js`, `index.html`, `doc-types/screenplay/index.js`
- CSS for scene-frame container, header (number badge), body, slug zones, pickers
- Smoke test: open the migrated v2.0 fixture, edit content inside its scene, save, reload, undo

**Out of scope (deferred to F3):**
- Ctrl+Enter to insert a new sceneFrame (outer-level command)
- Annotations / tags / revisionFlag context-menu actions working inside an inner view (each inner view needs its own plugin instance)
- Page-breaks computed across multiple sceneFrames
- Active-scene highlight plugin
- Cursor-position persistence across tab switches
- Per-inner-view undo history (F2 relies on outer history; one outer transaction per inner edit)

---

## §2 File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `renderer/js/doc-types/screenplay/inner-schema.js` | `Rga.DocTypes.screenplay.innerSchema` (Schema) + `emptyInnerDoc(schema)` helper |
| Create | `renderer/js/doc-types/screenplay/inner-keymap.js` | `buildInnerKeymap(schema)` returning a `prosemirror-keymap` plugin |
| Create | `renderer/js/doc-types/screenplay/inner-scene-line-node-view.js` | `sceneLineNodeViewFactory(getSettings)` — segmented slug-zone NodeView |
| Create | `renderer/js/doc-types/screenplay/inner-zone-key-plugin.js` | `buildZoneKeyPlugin()` — Tab/Shift-Tab/Arrow edge nav |
| Create | `renderer/js/doc-types/screenplay/scene-frame-node-view.js` | `sceneFrameNodeViewFactory()` — mounts inner view per atom |
| Modify | `renderer/js/doc-types/screenplay/index.js` | Validate + register the new module exports |
| Modify | `renderer/js/editor/mount.js` | Prefer `sceneFrameNodeViewFactory` over `placeholderNodeViewFactory` when present |
| Modify | `renderer/index.html` | Add five new `<script>` tags in correct order |
| Modify | `renderer/css/editor-prosemirror.css` | Scene-frame container, slug zones, picker styles |
| Create | `tests/unit/doc-types/screenplay/inner-schema.test.js` | Schema shape + node round-trip |
| Create | `tests/unit/doc-types/screenplay/inner-keymap.test.js` | Command behavior for Tab / Shift-Tab / Enter |
| Create | `tests/unit/doc-types/screenplay/inner-scene-line-node-view.test.js` | Factory shape + picker item list |
| Create | `tests/unit/doc-types/screenplay/inner-zone-key-plugin.test.js` | Plugin construction |
| Create | `tests/unit/doc-types/screenplay/scene-frame-node-view.test.js` | Factory shape + lifecycle smoke |

`SceneFramePlaceholder` (renderer/js/doc-types/screenplay/scene-frame-placeholder.js) and its tests (in `tests/unit/doc-types/screenplay/outer-schema.test.js`) **stay** — used as a fallback and as load-order guard in `index.js`.

---

## Task 1: Inner schema

**Files:**
- Create: `renderer/js/doc-types/screenplay/inner-schema.js`
- Create: `tests/unit/doc-types/screenplay/inner-schema.test.js`

- [ ] **Step 1: Write the failing tests in `tests/unit/doc-types/screenplay/inner-schema.test.js`**

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

function loadInnerSchemaModule() {
  // Reset module cache so each test gets a fresh load
  const path = require.resolve('../../../../renderer/js/doc-types/screenplay/inner-schema.js');
  delete require.cache[path];

  global.window = { Rga: { DocTypes: { screenplay: {} }, Framework: {} } };
  // Minimal mark set the inner schema will reuse
  global.window.Rga.Framework.baseOuterMarks = {
    bold: { toDOM() { return ['strong', 0]; } },
    italic: { toDOM() { return ['em', 0]; } },
    underline: { toDOM() { return ['u', 0]; } },
    strikethrough: { toDOM() { return ['s', 0]; } },
    tag: { attrs: { tagType: {}, entityId: {} }, inclusive: false, excludes: '', toDOM() { return ['span', 0]; } },
    annotation: { attrs: { id: {}, text: { default: '' }, color: { default: '#FFE08A' }, createdAt: { default: null }, author: { default: null } }, inclusive: false, excludes: '', toDOM() { return ['span', 0]; } },
    revisionFlag: { attrs: { id: { default: null }, reason: { default: '' }, color: { default: '#F44747' }, createdAt: { default: null }, status: { default: 'open' } }, inclusive: false, excludes: '', toDOM() { return ['span', 0]; } }
  };
  // Stub PM Schema constructor onto the global the module reads from
  global.window.RgaProseMirror = { Schema: Schema };

  require(path);
  return global.window.Rga.DocTypes.screenplay;
}

test('innerSchema is a Schema instance', () => {
  const sp = loadInnerSchemaModule();
  assert.ok(sp.innerSchema, 'innerSchema must exist');
  assert.ok(sp.innerSchema instanceof Schema, 'innerSchema must be a prosemirror Schema');
});

test('innerSchema has all required nodes', () => {
  const sp = loadInnerSchemaModule();
  const names = Object.keys(sp.innerSchema.nodes).sort();
  for (const required of ['doc', 'sceneLine', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'shot', 'inlineFreeText', 'text']) {
    assert.ok(names.includes(required), 'missing node: ' + required);
  }
});

test('sceneLine has setting and time attrs with defaults', () => {
  const sp = loadInnerSchemaModule();
  const sl = sp.innerSchema.nodes.sceneLine;
  assert.equal(sl.spec.attrs.setting.default, 'INT.');
  assert.equal(sl.spec.attrs.time.default, 'DAY');
});

test('all block nodes are in the block group', () => {
  const sp = loadInnerSchemaModule();
  for (const name of ['sceneLine', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'shot', 'inlineFreeText']) {
    const spec = sp.innerSchema.nodes[name].spec;
    assert.equal(spec.group, 'block', name + ' must be in block group');
  }
});

test('emptyInnerDoc returns a doc with sceneLine + action', () => {
  const sp = loadInnerSchemaModule();
  const doc = sp.emptyInnerDoc(sp.innerSchema);
  assert.equal(doc.type.name, 'doc');
  assert.equal(doc.childCount, 2);
  assert.equal(doc.child(0).type.name, 'sceneLine');
  assert.equal(doc.child(1).type.name, 'action');
});

test('innerSchema can deserialize a minimal sceneLine + action structure', () => {
  const sp = loadInnerSchemaModule();
  const node = sp.innerSchema.nodeFromJSON({
    type: 'doc',
    content: [
      { type: 'sceneLine', attrs: { setting: 'EXT.', time: 'NIGHT' }, content: [{ type: 'text', text: 'PARK' }] },
      { type: 'action', content: [{ type: 'text', text: 'A man walks.' }] }
    ]
  });
  assert.equal(node.firstChild.attrs.setting, 'EXT.');
  assert.equal(node.firstChild.textContent, 'PARK');
  assert.equal(node.lastChild.type.name, 'action');
  assert.equal(node.lastChild.textContent, 'A man walks.');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | tail -20
```

Expected: 70+ pass, 6 new fail with "Cannot find module ...inner-schema.js" or similar.

- [ ] **Step 3: Create `renderer/js/doc-types/screenplay/inner-schema.js`**

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Inner schema for the screenplay doc-type.
// Used by the nested EditorView inside each sceneFrame atom (F2+).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  const PM = window.RgaProseMirror;
  if (!PM || !PM.Schema) {
    console.error('[doc-types/screenplay/inner-schema] RgaProseMirror.Schema not available');
    return;
  }

  const marks = (Rga.Framework && Rga.Framework.baseOuterMarks) || {};

  const nodes = {
    doc: { content: 'block+' },

    sceneLine: {
      content: 'inline*',
      group: 'block',
      defining: true,
      attrs: {
        setting: { default: 'INT.' },
        time:    { default: 'DAY' }
      },
      parseDOM: [{ tag: 'div.rga-scene-line' }],
      toDOM: function(node) {
        return ['div', {
          class: 'rga-scene-line',
          'data-setting': node.attrs.setting,
          'data-time': node.attrs.time
        }, 0];
      }
    },

    action: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'div.rga-action' }],
      toDOM: function() { return ['div', { class: 'rga-action' }, 0]; }
    },

    character: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'div.rga-character' }],
      toDOM: function() { return ['div', { class: 'rga-character' }, 0]; }
    },

    dialogue: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'div.rga-dialogue' }],
      toDOM: function() { return ['div', { class: 'rga-dialogue' }, 0]; }
    },

    parenthetical: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'div.rga-parenthetical' }],
      toDOM: function() { return ['div', { class: 'rga-parenthetical' }, 0]; }
    },

    transition: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'div.rga-transition' }],
      toDOM: function() { return ['div', { class: 'rga-transition' }, 0]; }
    },

    shot: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'div.rga-shot' }],
      toDOM: function() { return ['div', { class: 'rga-shot' }, 0]; }
    },

    inlineFreeText: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'div.rga-inline-free-text' }],
      toDOM: function() { return ['div', { class: 'rga-inline-free-text' }, 0]; }
    },

    text: { group: 'inline' }
  };

  const innerSchema = new PM.Schema({ nodes: nodes, marks: marks });

  function emptyInnerDoc(schema) {
    schema = schema || innerSchema;
    return schema.node('doc', null, [
      schema.node('sceneLine', { setting: 'INT.', time: 'DAY' }),
      schema.node('action')
    ]);
  }

  Rga.DocTypes.screenplay.innerSchema = innerSchema;
  Rga.DocTypes.screenplay.emptyInnerDoc = emptyInnerDoc;
})();
```

- [ ] **Step 4: Run tests — expect all 6 new tests to pass**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | tail -10
```

Expected: all tests pass (70 + 6 = 76 minimum).

- [ ] **Step 5: Commit**

```
git add renderer/js/doc-types/screenplay/inner-schema.js tests/unit/doc-types/screenplay/inner-schema.test.js
git commit -m "feat(f2): inner schema for nested EditorView (screenplay grammar)"
```

---

## Task 2: Inner keymap

**Files:**
- Create: `renderer/js/doc-types/screenplay/inner-keymap.js`
- Create: `tests/unit/doc-types/screenplay/inner-keymap.test.js`

### Cycle order

| Forward (Tab)                | Backward (Shift-Tab)         |
|------------------------------|------------------------------|
| `action`        → `character`| `action`        → (end of sceneLine) |
| `character`     → `dialogue` | `character`     → `action`   |
| `dialogue`      → `parenthetical` | `dialogue`  → `character` |
| `parenthetical` → `transition` | `parenthetical` → `dialogue` |
| `transition`    → `shot`     | `transition`    → `parenthetical` |
| `shot`          → `inlineFreeText` | `shot`     → `transition` |
| `inlineFreeText`→ `action`   | `inlineFreeText`→ `shot`     |
| `sceneLine`     → (let zone plugin handle — return false) | `sceneLine` → (let zone plugin handle — return false) |

### Enter behavior

| Current block       | After Enter                                          |
|---------------------|------------------------------------------------------|
| `sceneLine`         | Move cursor to existing first action (or create one) |
| `action`            | Insert new `action` after, move cursor               |
| `character`         | Insert new `dialogue` after (standard screenplay)    |
| `dialogue`          | Insert new `action` after                            |
| `parenthetical`     | Insert new `dialogue` after                          |
| `transition`        | Insert new `action` after                            |
| `shot`              | Insert new `action` after                            |
| `inlineFreeText`    | Insert new `inlineFreeText` after                    |

- [ ] **Step 1: Write failing tests in `tests/unit/doc-types/screenplay/inner-keymap.test.js`**

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');
const { EditorState, TextSelection } = require('prosemirror-state');

function loadInnerKeymap() {
  const path = require.resolve('../../../../renderer/js/doc-types/screenplay/inner-keymap.js');
  delete require.cache[path];

  const { keymap } = require('prosemirror-keymap');
  const { toggleMark, chainCommands } = require('prosemirror-commands');

  global.window = { Rga: { DocTypes: { screenplay: {} }, Framework: { baseOuterMarks: {} } } };
  global.window.RgaProseMirror = { keymap, toggleMark, chainCommands, Schema, TextSelection };

  require(path);
  return global.window.Rga.DocTypes.screenplay;
}

function buildInnerSchema() {
  return new Schema({
    nodes: {
      doc: { content: 'block+' },
      sceneLine: { content: 'inline*', group: 'block', attrs: { setting: { default: 'INT.' }, time: { default: 'DAY' } }, toDOM() { return ['div', 0]; } },
      action: { content: 'inline*', group: 'block', toDOM() { return ['div', 0]; } },
      character: { content: 'inline*', group: 'block', toDOM() { return ['div', 0]; } },
      dialogue: { content: 'inline*', group: 'block', toDOM() { return ['div', 0]; } },
      parenthetical: { content: 'inline*', group: 'block', toDOM() { return ['div', 0]; } },
      transition: { content: 'inline*', group: 'block', toDOM() { return ['div', 0]; } },
      shot: { content: 'inline*', group: 'block', toDOM() { return ['div', 0]; } },
      inlineFreeText: { content: 'inline*', group: 'block', toDOM() { return ['div', 0]; } },
      text: { group: 'inline' }
    },
    marks: {}
  });
}

function docWith(s, type, otherChildren) {
  const sceneLine = s.node('sceneLine', { setting: 'INT.', time: 'DAY' });
  const block = s.node(type);
  return s.node('doc', null, [sceneLine, block].concat(otherChildren || []));
}

// place cursor at start of the second child (the block we care about)
function stateAt(s, doc, childIndex) {
  // child 0 is sceneLine (nodeSize 2 for empty, content size 0)
  let pos = 0;
  for (let i = 0; i < childIndex; i += 1) {
    pos += doc.child(i).nodeSize;
  }
  // pos is now at the start of child[childIndex]; +1 to enter content
  const $pos = doc.resolve(pos + 1);
  return EditorState.create({ schema: s, doc, selection: TextSelection.near($pos) });
}

function applyTabForward(sp, state) {
  const cmd = sp._innerKeymapInternals.cycleForward(state.schema);
  let next = null;
  cmd(state, (tr) => { next = state.apply(tr); });
  return next;
}

function applyTabBackward(sp, state) {
  const cmd = sp._innerKeymapInternals.cycleBackward(state.schema);
  let next = null;
  cmd(state, (tr) => { next = state.apply(tr); });
  return next;
}

function applyEnter(sp, state) {
  const cmd = sp._innerKeymapInternals.enterBehavior(state.schema);
  let next = null;
  cmd(state, (tr) => { next = state.apply(tr); });
  return next;
}

test('buildInnerKeymap returns a plugin', () => {
  const sp = loadInnerKeymap();
  const plugin = sp.buildInnerKeymap(buildInnerSchema());
  assert.ok(plugin, 'plugin must be returned');
});

test('Tab on action → character', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'action');
  const state = stateAt(s, doc, 1);
  const next = applyTabForward(sp, state);
  assert.ok(next, 'command must dispatch');
  assert.equal(next.doc.child(1).type.name, 'character');
});

test('Tab on character → dialogue', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'character');
  const state = stateAt(s, doc, 1);
  const next = applyTabForward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'dialogue');
});

test('Tab on dialogue → parenthetical', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'dialogue');
  const state = stateAt(s, doc, 1);
  const next = applyTabForward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'parenthetical');
});

test('Tab on parenthetical → transition', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'parenthetical');
  const state = stateAt(s, doc, 1);
  const next = applyTabForward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'transition');
});

test('Tab on transition → shot', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'transition');
  const state = stateAt(s, doc, 1);
  const next = applyTabForward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'shot');
});

test('Tab on shot → inlineFreeText', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'shot');
  const state = stateAt(s, doc, 1);
  const next = applyTabForward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'inlineFreeText');
});

test('Tab on inlineFreeText → action (wraps)', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'inlineFreeText');
  const state = stateAt(s, doc, 1);
  const next = applyTabForward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'action');
});

test('Shift-Tab on character → action', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'character');
  const state = stateAt(s, doc, 1);
  const next = applyTabBackward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'action');
});

test('Shift-Tab on inlineFreeText → shot', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'inlineFreeText');
  const state = stateAt(s, doc, 1);
  const next = applyTabBackward(sp, state);
  assert.equal(next.doc.child(1).type.name, 'shot');
});

test('Enter on action inserts a new action after', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'action');
  const state = stateAt(s, doc, 1);
  const next = applyEnter(sp, state);
  assert.ok(next, 'Enter must dispatch');
  // doc was [sceneLine, action] (2 children) — after Enter we expect [sceneLine, action, action]
  assert.equal(next.doc.childCount, 3);
  assert.equal(next.doc.child(2).type.name, 'action');
});

test('Enter on character inserts a new dialogue after', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'character');
  const state = stateAt(s, doc, 1);
  const next = applyEnter(sp, state);
  assert.equal(next.doc.childCount, 3);
  assert.equal(next.doc.child(2).type.name, 'dialogue');
});

test('Enter on dialogue inserts a new action after', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'dialogue');
  const state = stateAt(s, doc, 1);
  const next = applyEnter(sp, state);
  assert.equal(next.doc.childCount, 3);
  assert.equal(next.doc.child(2).type.name, 'action');
});

test('Enter on parenthetical inserts a new dialogue after', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'parenthetical');
  const state = stateAt(s, doc, 1);
  const next = applyEnter(sp, state);
  assert.equal(next.doc.child(2).type.name, 'dialogue');
});

test('Enter on transition inserts a new action after', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'transition');
  const state = stateAt(s, doc, 1);
  const next = applyEnter(sp, state);
  assert.equal(next.doc.child(2).type.name, 'action');
});

test('Enter on shot inserts a new action after', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'shot');
  const state = stateAt(s, doc, 1);
  const next = applyEnter(sp, state);
  assert.equal(next.doc.child(2).type.name, 'action');
});

test('Enter on inlineFreeText inserts a new inlineFreeText after', () => {
  const sp = loadInnerKeymap();
  const s = buildInnerSchema();
  const doc = docWith(s, 'inlineFreeText');
  const state = stateAt(s, doc, 1);
  const next = applyEnter(sp, state);
  assert.equal(next.doc.child(2).type.name, 'inlineFreeText');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | tail -20
```

Expected: many new failures with "Cannot find module".

- [ ] **Step 3: Create `renderer/js/doc-types/screenplay/inner-keymap.js`**

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Inner keymap: Tab/Shift-Tab block-type cycling, Enter behavior.
// Bound to the nested EditorView inside each sceneFrame (F2+).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  const PM = window.RgaProseMirror;
  if (!PM || !PM.keymap) {
    console.error('[inner-keymap] RgaProseMirror.keymap not available');
    return;
  }

  const FORWARD = {
    action: 'character',
    character: 'dialogue',
    dialogue: 'parenthetical',
    parenthetical: 'transition',
    transition: 'shot',
    shot: 'inlineFreeText',
    inlineFreeText: 'action'
  };

  const BACKWARD = {
    character: 'action',
    dialogue: 'character',
    parenthetical: 'dialogue',
    transition: 'parenthetical',
    shot: 'transition',
    inlineFreeText: 'shot'
  };

  const ENTER_NEXT = {
    action: 'action',
    character: 'dialogue',
    dialogue: 'action',
    parenthetical: 'dialogue',
    transition: 'action',
    shot: 'action',
    inlineFreeText: 'inlineFreeText'
  };

  function _parentBlock(state) {
    const $head = state.selection.$head;
    // Inner schema: doc > block. Block depth is 1.
    if ($head.depth < 1) return null;
    const node = $head.node(1);
    const pos = $head.before(1);
    return { node: node, pos: pos };
  }

  function cycleForward(schema) {
    return function(state, dispatch) {
      const parent = _parentBlock(state);
      if (!parent) return false;
      const name = parent.node.type.name;
      // sceneLine handled by zone-key plugin — let event fall through
      if (name === 'sceneLine') return false;
      const nextName = FORWARD[name];
      if (!nextName) return false;
      const nextType = schema.nodes[nextName];
      if (!nextType) return false;
      if (!dispatch) return true;
      dispatch(state.tr.setNodeMarkup(parent.pos, nextType));
      return true;
    };
  }

  function cycleBackward(schema) {
    return function(state, dispatch) {
      const parent = _parentBlock(state);
      if (!parent) return false;
      const name = parent.node.type.name;
      if (name === 'sceneLine') return false;
      // Special: Shift-Tab on action → move cursor to end of sceneLine
      if (name === 'action') {
        // Find sceneLine before action
        const $head = state.selection.$head;
        const docNode = state.doc;
        let sceneLinePos = null;
        for (let i = 0; i < docNode.childCount; i += 1) {
          const child = docNode.child(i);
          if (child.type.name === 'sceneLine') {
            sceneLinePos = 0;
            for (let j = 0; j < i; j += 1) sceneLinePos += docNode.child(j).nodeSize;
            sceneLinePos += child.nodeSize - 1; // end inside content
            break;
          }
        }
        if (sceneLinePos == null) return false;
        if (!dispatch) return true;
        const TextSelection = PM.TextSelection || window.RgaProseMirror.TextSelection;
        const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(sceneLinePos)));
        dispatch(tr.scrollIntoView());
        return true;
      }
      const prevName = BACKWARD[name];
      if (!prevName) return false;
      const prevType = schema.nodes[prevName];
      if (!prevType) return false;
      if (!dispatch) return true;
      dispatch(state.tr.setNodeMarkup(parent.pos, prevType));
      return true;
    };
  }

  function enterBehavior(schema) {
    return function(state, dispatch) {
      const parent = _parentBlock(state);
      if (!parent) return false;
      const name = parent.node.type.name;

      if (name === 'sceneLine') {
        // Move cursor to first action (or create one) — simplest: find next action
        const TextSelection = PM.TextSelection || window.RgaProseMirror.TextSelection;
        const docNode = state.doc;
        let actionPos = null;
        let cursor = 0;
        for (let i = 0; i < docNode.childCount; i += 1) {
          const child = docNode.child(i);
          if (child.type.name === 'action') {
            actionPos = cursor + 1; // inside action content
            break;
          }
          cursor += child.nodeSize;
        }
        if (actionPos == null) {
          // No action: append one after current block
          if (!dispatch) return true;
          const action = schema.nodes.action.create();
          const insertPos = parent.pos + parent.node.nodeSize;
          const tr = state.tr.insert(insertPos, action);
          tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));
          dispatch(tr.scrollIntoView());
          return true;
        }
        if (!dispatch) return true;
        const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(actionPos)));
        dispatch(tr.scrollIntoView());
        return true;
      }

      const nextName = ENTER_NEXT[name];
      if (!nextName) return false;
      const nextType = schema.nodes[nextName];
      if (!nextType) return false;
      if (!dispatch) return true;
      const TextSelection = PM.TextSelection || window.RgaProseMirror.TextSelection;
      const insertPos = parent.pos + parent.node.nodeSize;
      const tr = state.tr.insert(insertPos, nextType.create());
      tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));
      dispatch(tr.scrollIntoView());
      return true;
    };
  }

  function buildInnerKeymap(schema) {
    const entries = {
      Tab: cycleForward(schema),
      'Shift-Tab': cycleBackward(schema),
      Enter: enterBehavior(schema)
    };
    return PM.keymap(entries);
  }

  Rga.DocTypes.screenplay.buildInnerKeymap = buildInnerKeymap;
  Rga.DocTypes.screenplay._innerKeymapInternals = {
    cycleForward: cycleForward,
    cycleBackward: cycleBackward,
    enterBehavior: enterBehavior,
    FORWARD: FORWARD,
    BACKWARD: BACKWARD,
    ENTER_NEXT: ENTER_NEXT
  };
})();
```

- [ ] **Step 4: Run tests — expect new tests to pass**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | tail -10
```

Expected: all tests pass (76 + ~16 = ~92).

- [ ] **Step 5: Commit**

```
git add renderer/js/doc-types/screenplay/inner-keymap.js tests/unit/doc-types/screenplay/inner-keymap.test.js
git commit -m "feat(f2): inner keymap — Tab/Shift-Tab cycle, Enter behavior"
```

---

## Task 3: Inner sceneLine NodeView (slug zones with pickers)

**Files:**
- Create: `renderer/js/doc-types/screenplay/inner-scene-line-node-view.js`
- Create: `tests/unit/doc-types/screenplay/inner-scene-line-node-view.test.js`

### DOM structure

```
div.rga-scene-line  [data-active-zone="location"|"setting"|"time"]   = dom
  span.rga-slug-setting     [contenteditable=false]   shows setting attr
  span.rga-slug-sep         [contenteditable=false]   " — "
  span.rga-slug-location                              = contentDOM (PM-managed)
  span.rga-slug-sep         [contenteditable=false]   " — "
  span.rga-slug-time        [contenteditable=false]   shows time attr
```

- [ ] **Step 1: Write failing tests**

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

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
      _listeners: {},
      addEventListener: function(ev, fn) { this._listeners[ev] = this._listeners[ev] || []; this._listeners[ev].push(fn); },
      appendChild: function(c) { this._children.push(c); return c; },
      removeChild: function(c) { this._children = this._children.filter(function(x) { return x !== c; }); return c; },
      get firstChild() { return this._children[0] || null; },
      setAttribute: function() {},
      getBoundingClientRect: function() { return { left: 0, top: 0, width: 0, height: 0 }; }
    };
    return node;
  }
  global.document = { createElement: el };
}

function loadModule() {
  const path = require.resolve('../../../../renderer/js/doc-types/screenplay/inner-scene-line-node-view.js');
  delete require.cache[path];
  mockDom();
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  global.window.Rga.DocTypes = global.window.Rga.DocTypes || {};
  global.window.Rga.DocTypes.screenplay = global.window.Rga.DocTypes.screenplay || {};
  global.window.Rga.Constants = { DEFAULT_VOCABULARY: { settings: ['INT.', 'EXT.'], times: ['DAY', 'NIGHT'] } };
  require(path);
  return global.window.Rga.DocTypes.screenplay;
}

test('sceneLineNodeViewFactory is exported as a function', () => {
  const sp = loadModule();
  assert.equal(typeof sp.sceneLineNodeViewFactory, 'function');
});

test('factory(getSettings) returns a NodeView constructor', () => {
  const sp = loadModule();
  const factory = sp.sceneLineNodeViewFactory(function() { return null; });
  assert.equal(typeof factory, 'function');
});

test('NodeView constructor builds the 5-child slug DOM', () => {
  const sp = loadModule();
  const factory = sp.sceneLineNodeViewFactory(function() { return null; });
  const fakeNode = { attrs: { setting: 'INT.', time: 'DAY' }, type: { name: 'sceneLine' } };
  const nv = factory(fakeNode, null, function() { return 0; });
  assert.ok(nv.dom);
  assert.equal(nv.dom.className, 'rga-scene-line');
  assert.equal(nv.dom._children.length, 5);
  assert.equal(nv.dom._children[0].className, 'rga-slug-setting');
  assert.equal(nv.dom._children[0].textContent, 'INT.');
  assert.equal(nv.dom._children[2].className, 'rga-slug-location');  // contentDOM
  assert.equal(nv.dom._children[4].className, 'rga-slug-time');
  assert.equal(nv.dom._children[4].textContent, 'DAY');
});

test('contentDOM is the location span', () => {
  const sp = loadModule();
  const factory = sp.sceneLineNodeViewFactory(function() { return null; });
  const fakeNode = { attrs: { setting: 'INT.', time: 'DAY' }, type: { name: 'sceneLine' } };
  const nv = factory(fakeNode, null, function() { return 0; });
  assert.equal(nv.contentDOM.className, 'rga-slug-location');
});

test('activateZone updates data-active-zone', () => {
  const sp = loadModule();
  const factory = sp.sceneLineNodeViewFactory(function() { return null; });
  const fakeNode = { attrs: { setting: 'INT.', time: 'DAY' }, type: { name: 'sceneLine' } };
  const nv = factory(fakeNode, null, function() { return 0; });
  nv.activateZone('time');
  assert.equal(nv.dom.dataset.activeZone, 'time');
  assert.equal(nv._activeZone, 'time');
});

test('update(node) returns true and updates setting/time text', () => {
  const sp = loadModule();
  const factory = sp.sceneLineNodeViewFactory(function() { return null; });
  const fakeNode = { attrs: { setting: 'INT.', time: 'DAY' }, type: { name: 'sceneLine' } };
  const nv = factory(fakeNode, null, function() { return 0; });
  const newNode = { attrs: { setting: 'EXT.', time: 'NIGHT' }, type: { name: 'sceneLine' } };
  assert.equal(nv.update(newNode), true);
  assert.equal(nv._settingSpan.textContent, 'EXT.');
  assert.equal(nv._timeSpan.textContent, 'NIGHT');
});

test('update returns false for non-sceneLine node', () => {
  const sp = loadModule();
  const factory = sp.sceneLineNodeViewFactory(function() { return null; });
  const fakeNode = { attrs: { setting: 'INT.', time: 'DAY' }, type: { name: 'sceneLine' } };
  const nv = factory(fakeNode, null, function() { return 0; });
  assert.equal(nv.update({ type: { name: 'action' } }), false);
});

test('_pickerItems returns settings list for "setting" zone', () => {
  const sp = loadModule();
  // Module exports the helper for tests
  assert.deepEqual(sp._sceneLineNodeViewInternals._pickerItems('setting', null), ['INT.', 'EXT.']);
});

test('_pickerItems returns times list for "time" zone', () => {
  const sp = loadModule();
  assert.deepEqual(sp._sceneLineNodeViewInternals._pickerItems('time', null), ['DAY', 'NIGHT']);
});

test('_pickerItems uses doc-settings vocabulary when present', () => {
  const sp = loadModule();
  const settings = { vocabulary: { settings: ['INT.', 'EXT.', 'I/E'], times: ['DAY', 'NIGHT', 'DUSK'] } };
  assert.deepEqual(sp._sceneLineNodeViewInternals._pickerItems('setting', settings), ['INT.', 'EXT.', 'I/E']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | tail -10
```

- [ ] **Step 3: Create `renderer/js/doc-types/screenplay/inner-scene-line-node-view.js`**

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// SceneLine NodeView for the inner EditorView — segmented Setting/Location/Time
// zones with vocabulary pickers.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  function _pickerItems(zone, docSettings) {
    const vocab = (docSettings && docSettings.vocabulary)
      || (Rga.Constants && Rga.Constants.DEFAULT_VOCABULARY)
      || {};
    if (zone === 'setting') return (vocab.settings || ['INT.', 'EXT.']).slice();
    if (zone === 'time')    return (vocab.times    || ['DAY', 'NIGHT']).slice();
    return [];
  }

  function SceneLineNodeView(node, view, getPos, getSettings) {
    this._view = view;
    this._getPos = getPos;
    this._getSettings = getSettings;
    this._node = node;
    this._picker = null;

    this.dom = document.createElement('div');
    this.dom.className = 'rga-scene-line';
    this.dom._rgaNodeView = this;

    this._settingSpan = document.createElement('span');
    this._settingSpan.className = 'rga-slug-setting';
    this._settingSpan.contentEditable = 'false';
    this._settingSpan.textContent = node.attrs.setting;

    const sep1 = document.createElement('span');
    sep1.className = 'rga-slug-sep';
    sep1.contentEditable = 'false';
    sep1.textContent = ' — ';

    this.contentDOM = document.createElement('span');
    this.contentDOM.className = 'rga-slug-location';

    const sep2 = document.createElement('span');
    sep2.className = 'rga-slug-sep';
    sep2.contentEditable = 'false';
    sep2.textContent = ' — ';

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

    const self = this;
    this._settingSpan.addEventListener('mousedown', function(e) {
      e.preventDefault();
      self.activateZone('setting');
      self._showPicker('setting');
    });
    this._timeSpan.addEventListener('mousedown', function(e) {
      e.preventDefault();
      self.activateZone('time');
      self._showPicker('time');
    });
  }

  SceneLineNodeView.prototype.activateZone = function(zone) {
    this._activeZone = zone;
    this.dom.dataset.activeZone = zone;
    if (zone === 'location') this._closePicker();
  };

  SceneLineNodeView.prototype.update = function(node) {
    if (node.type.name !== 'sceneLine') return false;
    this._node = node;
    this._settingSpan.textContent = node.attrs.setting;
    this._timeSpan.textContent = node.attrs.time;
    return true;
  };

  SceneLineNodeView.prototype.destroy = function() {
    this._closePicker();
  };

  SceneLineNodeView.prototype._closePicker = function() {
    if (this._picker && this._picker.parentNode) {
      this._picker.parentNode.removeChild(this._picker);
    }
    this._picker = null;
  };

  SceneLineNodeView.prototype._showPicker = function(zone) {
    this._closePicker();
    const settings = this._getSettings ? this._getSettings() : null;
    const items = _pickerItems(zone, settings);
    if (!items.length) return;

    const picker = document.createElement('div');
    picker.className = 'rga-slug-picker';
    picker.contentEditable = 'false';
    const self = this;
    items.forEach(function(item) {
      const opt = document.createElement('div');
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

    this.dom.appendChild(picker);
    this._picker = picker;
  };

  SceneLineNodeView.prototype._applyZoneValue = function(zone, value) {
    if (!this._view) return;
    const pos = this._getPos();
    const node = this._view.state.doc.nodeAt(pos);
    if (!node) return;
    const newAttrs = Object.assign({}, node.attrs);
    newAttrs[zone] = value;
    const tr = this._view.state.tr.setNodeMarkup(pos, null, newAttrs);
    this._view.dispatch(tr);
  };

  function sceneLineNodeViewFactory(getSettings) {
    return function(node, view, getPos) {
      return new SceneLineNodeView(node, view, getPos, getSettings);
    };
  }

  Rga.DocTypes.screenplay.sceneLineNodeViewFactory = sceneLineNodeViewFactory;
  Rga.DocTypes.screenplay._sceneLineNodeViewInternals = {
    _pickerItems: _pickerItems,
    SceneLineNodeView: SceneLineNodeView
  };
})();
```

- [ ] **Step 4: Run tests — expect all to pass**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```
git add renderer/js/doc-types/screenplay/inner-scene-line-node-view.js tests/unit/doc-types/screenplay/inner-scene-line-node-view.test.js
git commit -m "feat(f2): inner sceneLine NodeView with segmented slug zones + pickers"
```

---

## Task 4: Zone-key plugin

**Files:**
- Create: `renderer/js/doc-types/screenplay/inner-zone-key-plugin.js`
- Create: `tests/unit/doc-types/screenplay/inner-zone-key-plugin.test.js`

This plugin runs INSIDE the inner EditorView. It handles edge transitions between the location zone (PM-managed text content) and the setting/time zones (NodeView-managed picker activations).

| Trigger                                | Action |
|----------------------------------------|--------|
| Tab while location cursor at end       | `nv.activateZone('time')`, show picker, prevent default |
| Shift-Tab while location cursor at start | `nv.activateZone('setting')`, show picker, prevent default |
| ArrowRight while location cursor at end | same as Tab |
| ArrowLeft while location cursor at start | same as Shift-Tab |
| Tab/ArrowRight while setting active    | `nv.activateZone('location')`, prevent default |
| Tab/ArrowRight while time active       | `nv.activateZone('location')`, prevent default (next Tab inside the inner keymap will then cycle blocks from sceneLine — but sceneLine cycle returns false so nothing happens; acceptable for F2) |
| Escape from any non-location zone      | `nv.activateZone('location')`, prevent default |
| Letter keys while setting/time active  | prevent default (read-only via picker) |

- [ ] **Step 1: Write failing tests**

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function loadModule() {
  const path = require.resolve('../../../../renderer/js/doc-types/screenplay/inner-zone-key-plugin.js');
  delete require.cache[path];
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  global.window.Rga.DocTypes = global.window.Rga.DocTypes || {};
  global.window.Rga.DocTypes.screenplay = global.window.Rga.DocTypes.screenplay || {};
  // Provide a minimal Plugin class
  global.window.RgaProseMirror = { Plugin: class Plugin { constructor(spec) { this.spec = spec; } } };
  require(path);
  return global.window.Rga.DocTypes.screenplay;
}

test('buildZoneKeyPlugin is exported as a function', () => {
  const sp = loadModule();
  assert.equal(typeof sp.buildZoneKeyPlugin, 'function');
});

test('buildZoneKeyPlugin returns a Plugin instance with handleKeyDown', () => {
  const sp = loadModule();
  const plugin = sp.buildZoneKeyPlugin();
  assert.ok(plugin);
  assert.ok(plugin.spec.props.handleKeyDown, 'plugin must expose handleKeyDown');
  assert.equal(typeof plugin.spec.props.handleKeyDown, 'function');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | tail -10
```

- [ ] **Step 3: Create `renderer/js/doc-types/screenplay/inner-zone-key-plugin.js`**

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Zone-key plugin for inner EditorViews — handles Tab/Shift-Tab/Arrow edges
// between the location zone (PM-managed) and the setting/time zones
// (NodeView-managed).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  const PM = window.RgaProseMirror;
  if (!PM || !PM.Plugin) {
    console.error('[inner-zone-key-plugin] RgaProseMirror.Plugin not available');
    return;
  }

  function _findNodeView(viewDom, attrValue) {
    if (!viewDom || !viewDom.querySelector) return null;
    const sel = '.rga-scene-line[data-active-zone="' + attrValue + '"]';
    const el = viewDom.querySelector(sel);
    return el && el._rgaNodeView ? el._rgaNodeView : null;
  }

  function buildZoneKeyPlugin() {
    return new PM.Plugin({
      props: {
        handleKeyDown: function(view, event) {
          // Case A: a non-location zone is active
          const nvNonLoc = _findNodeView(view.dom, 'setting') || _findNodeView(view.dom, 'time');
          if (nvNonLoc) {
            const zone = nvNonLoc._activeZone;

            if (event.key === 'Escape') {
              nvNonLoc.activateZone('location');
              event.preventDefault();
              return true;
            }

            if (event.key === 'Tab' || event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
              nvNonLoc.activateZone('location');
              event.preventDefault();
              return true;
            }

            // Block letter typing while a picker zone is active
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
              event.preventDefault();
              return true;
            }
            return false;
          }

          // Case B: cursor is in location (or anywhere else in inner doc)
          if (event.key === 'Tab' || event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            const sel = view.state.selection;
            const $head = sel.$head;
            if ($head.parent.type.name !== 'sceneLine') return false;

            const nvLoc = _findNodeView(view.dom, 'location');
            if (!nvLoc) return false;

            const atStart = $head.parentOffset === 0;
            const atEnd   = $head.parentOffset === $head.parent.content.size;

            if ((event.key === 'Tab' && !event.shiftKey) || event.key === 'ArrowRight') {
              if (atEnd) {
                nvLoc.activateZone('time');
                if (typeof nvLoc._showPicker === 'function') nvLoc._showPicker('time');
                event.preventDefault();
                return true;
              }
            }
            if ((event.key === 'Tab' && event.shiftKey) || event.key === 'ArrowLeft') {
              if (atStart) {
                nvLoc.activateZone('setting');
                if (typeof nvLoc._showPicker === 'function') nvLoc._showPicker('setting');
                event.preventDefault();
                return true;
              }
            }
          }

          return false;
        }
      }
    });
  }

  Rga.DocTypes.screenplay.buildZoneKeyPlugin = buildZoneKeyPlugin;
})();
```

- [ ] **Step 4: Run tests — expect new tests to pass**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```
git add renderer/js/doc-types/screenplay/inner-zone-key-plugin.js tests/unit/doc-types/screenplay/inner-zone-key-plugin.test.js
git commit -m "feat(f2): inner zone-key plugin — Tab/Arrow edge nav between slug zones"
```

---

## Task 5: SceneFrame NodeView (the heart of F2)

**Files:**
- Create: `renderer/js/doc-types/screenplay/scene-frame-node-view.js`
- Create: `tests/unit/doc-types/screenplay/scene-frame-node-view.test.js`

### DOM structure

```
div.rga-scene-frame
  div.rga-scene-frame-header
    span.rga-scene-number    e.g. "1"
  div.rga-scene-frame-body                       ← inner EditorView mounts here
```

### Lifecycle

| Hook                  | Behavior |
|-----------------------|----------|
| constructor           | Build DOM, build inner state from `node.attrs.innerDoc` (or `emptyInnerDoc()` if null), mount inner EditorView with inner schema + inner keymap + sceneLine NodeView + zone-key plugin + history. |
| `update(node)`        | If `node.attrs.innerDoc === this._lastSentInnerDoc` (reference equal — we sent it), just refresh number badge and return true. Otherwise, rebuild inner state from new innerDoc JSON. |
| `dispatchTransaction` (inner) | Apply to inner state, update inner view, then if inner doc changed, build `outerView.tr.setNodeMarkup(getPos, null, { ...attrs, innerDoc: jsonRef })`, set `_lastSentInnerDoc = jsonRef`, dispatch on outer view. |
| `destroy()`           | Call `innerView.destroy()`. |
| `stopEvent(event)`    | Return true (all events handled by inner view). |
| `ignoreMutation()`    | Return true (outer view never re-parses inner DOM). |
| `selectNode()`        | Focus inner view. |

- [ ] **Step 1: Write failing tests**

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | tail -15
```

- [ ] **Step 3: Create `renderer/js/doc-types/screenplay/scene-frame-node-view.js`**

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// SceneFrame NodeView — mounts a nested ProseMirror EditorView per
// sceneFrame atom node. Replaces SceneFramePlaceholder when registered.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  const PM = window.RgaProseMirror;
  if (!PM || !PM.EditorState || !PM.EditorView) {
    console.error('[scene-frame-node-view] RgaProseMirror not available');
    return;
  }

  function _getInnerSchema() {
    return Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.innerSchema;
  }

  function _buildInnerDoc(node, innerSchema) {
    if (node.attrs.innerDoc) {
      try {
        return innerSchema.nodeFromJSON(node.attrs.innerDoc);
      } catch (err) {
        console.error('[SceneFrameNodeView] innerDoc invalid; using empty doc', err);
      }
    }
    const empty = Rga.DocTypes.screenplay.emptyInnerDoc;
    return empty ? empty(innerSchema) : innerSchema.node('doc');
  }

  function _buildInnerPlugins(innerSchema) {
    const sp = Rga.DocTypes.screenplay;
    const plugins = [];
    if (PM.history) plugins.push(PM.history());
    if (sp.buildInnerKeymap) plugins.push(sp.buildInnerKeymap(innerSchema));
    if (sp.buildZoneKeyPlugin) plugins.push(sp.buildZoneKeyPlugin());
    return plugins;
  }

  function _settingsAccessor() {
    return (Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc())
      ? Rga.TabManager.activeDoc().settings
      : null;
  }

  function SceneFrameNodeView(node, outerView, getPos) {
    this._node = node;
    this._outerView = outerView;
    this._getPos = getPos;
    this._lastSentInnerDoc = node.attrs.innerDoc;

    const innerSchema = _getInnerSchema();

    this.dom = document.createElement('div');
    this.dom.className = 'rga-scene-frame';
    this.dom.setAttribute('contenteditable', 'false');

    const header = document.createElement('div');
    header.className = 'rga-scene-frame-header';
    this._numberEl = document.createElement('span');
    this._numberEl.className = 'rga-scene-number';
    this._numberEl.textContent = (node.attrs.number == null) ? '?' : String(node.attrs.number);
    header.appendChild(this._numberEl);

    const body = document.createElement('div');
    body.className = 'rga-scene-frame-body';
    body.setAttribute('contenteditable', 'true');

    this.dom.appendChild(header);
    this.dom.appendChild(body);

    const innerDoc = _buildInnerDoc(node, innerSchema);
    const plugins = _buildInnerPlugins(innerSchema);

    const innerState = PM.EditorState.create({ schema: innerSchema, doc: innerDoc, plugins: plugins });

    const self = this;
    const nodeViews = {};
    if (typeof Rga.DocTypes.screenplay.sceneLineNodeViewFactory === 'function') {
      nodeViews.sceneLine = Rga.DocTypes.screenplay.sceneLineNodeViewFactory(_settingsAccessor);
    }

    this._innerView = new PM.EditorView(body, {
      state: innerState,
      nodeViews: nodeViews,
      dispatchTransaction: function(tr) {
        const newState = self._innerView.state.apply(tr);
        self._innerView.updateState(newState);
        if (tr.docChanged) {
          self._propagateToOuter(newState.doc);
        }
      }
    });
  }

  SceneFrameNodeView.prototype._propagateToOuter = function(innerDocNode) {
    const json = innerDocNode.toJSON();
    this._lastSentInnerDoc = json;
    const pos = this._getPos();
    if (pos == null) return;
    const outerView = this._outerView;
    const outerNode = outerView.state.doc.nodeAt(pos);
    if (!outerNode) return;
    const newAttrs = Object.assign({}, outerNode.attrs, { innerDoc: json });
    const tr = outerView.state.tr.setNodeMarkup(pos, null, newAttrs);
    outerView.dispatch(tr);
  };

  SceneFrameNodeView.prototype.update = function(node) {
    if (node.type.name !== 'sceneFrame') return false;
    this._node = node;
    this._numberEl.textContent = (node.attrs.number == null) ? '?' : String(node.attrs.number);

    if (node.attrs.innerDoc === this._lastSentInnerDoc) {
      return true;
    }

    // External change (undo/redo or tab switch) — rebuild inner state
    const innerSchema = _getInnerSchema();
    const newInnerDoc = _buildInnerDoc(node, innerSchema);
    const newInnerState = PM.EditorState.create({
      schema: innerSchema,
      doc: newInnerDoc,
      plugins: this._innerView.state.plugins
    });
    this._innerView.updateState(newInnerState);
    this._lastSentInnerDoc = node.attrs.innerDoc;
    return true;
  };

  SceneFrameNodeView.prototype.destroy = function() {
    if (this._innerView) this._innerView.destroy();
  };

  SceneFrameNodeView.prototype.stopEvent = function() {
    return true;
  };

  SceneFrameNodeView.prototype.ignoreMutation = function() {
    return true;
  };

  SceneFrameNodeView.prototype.selectNode = function() {
    if (this._innerView && this._innerView.focus) this._innerView.focus();
  };

  function sceneFrameNodeViewFactory() {
    return function(node, outerView, getPos) {
      return new SceneFrameNodeView(node, outerView, getPos);
    };
  }

  Rga.DocTypes.screenplay.sceneFrameNodeViewFactory = sceneFrameNodeViewFactory;
})();
```

- [ ] **Step 4: Run tests — expect new tests to pass**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```
git add renderer/js/doc-types/screenplay/scene-frame-node-view.js tests/unit/doc-types/screenplay/scene-frame-node-view.test.js
git commit -m "feat(f2): SceneFrame NodeView mounts nested EditorView per atom"
```

---

## Task 6: Wire-up + GO/NO-GO smoke test ★

**Files:**
- Modify: `renderer/js/doc-types/screenplay/index.js`
- Modify: `renderer/js/editor/mount.js`
- Modify: `renderer/index.html`

- [ ] **Step 1: Update `renderer/js/doc-types/screenplay/index.js`**

Replace the file contents with:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Screenplay doc-type module — registers with Rga.DocTypes at load time.
// F1: outer-schema additions + placeholder NodeView (fallback).
// F2: innerSchema + inner keymap + slug NodeView + zone-key plugin + SceneFrame NodeView.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  if (!Rga.DocTypes || typeof Rga.DocTypes.register !== 'function') {
    console.error('[doc-types/screenplay] doc-type-registry not loaded — script order is wrong');
    return;
  }
  const sp = Rga.DocTypes.screenplay || {};
  if (!sp.outerNodes || !sp.outerNodes.sceneFrame) {
    console.error('[doc-types/screenplay] outer-schema-additions not loaded — script order is wrong');
    return;
  }
  if (typeof sp.sceneFramePlaceholderFactory !== 'function') {
    console.error('[doc-types/screenplay] scene-frame-placeholder not loaded — script order is wrong');
    return;
  }
  // F2 dependencies (optional in registration — fall back to placeholder if any are missing)
  const hasF2 =
    sp.innerSchema &&
    typeof sp.emptyInnerDoc === 'function' &&
    typeof sp.buildInnerKeymap === 'function' &&
    typeof sp.buildZoneKeyPlugin === 'function' &&
    typeof sp.sceneLineNodeViewFactory === 'function' &&
    typeof sp.sceneFrameNodeViewFactory === 'function';

  const config = {
    outerNodes: sp.outerNodes,
    placeholderNodeViewFactory: sp.sceneFramePlaceholderFactory
  };
  if (hasF2) {
    config.sceneFrameNodeViewFactory = sp.sceneFrameNodeViewFactory;
  } else {
    console.warn('[doc-types/screenplay] F2 modules not all present — using F1 placeholder');
  }

  Rga.DocTypes.register('screenplay', config);
})();
```

- [ ] **Step 2: Update `renderer/js/editor/mount.js`**

Find this block (around line 145):

```javascript
    const docType = Rga.DocTypes.get(documentType);
    const nodeViews = {};
    if (typeof docType.placeholderNodeViewFactory === 'function') {
      nodeViews.sceneFrame = docType.placeholderNodeViewFactory();
    }
```

Replace with:

```javascript
    const docType = Rga.DocTypes.get(documentType);
    const nodeViews = {};
    if (typeof docType.sceneFrameNodeViewFactory === 'function') {
      nodeViews.sceneFrame = docType.sceneFrameNodeViewFactory();
    } else if (typeof docType.placeholderNodeViewFactory === 'function') {
      nodeViews.sceneFrame = docType.placeholderNodeViewFactory();
    }
```

- [ ] **Step 3: Update `renderer/index.html`**

Find the line `<script src="js/doc-types/screenplay/scene-frame-placeholder.js"></script>` and add the F2 script tags AFTER `scene-frame-placeholder.js` but BEFORE `doc-types/screenplay/index.js`:

```html
<script src="js/doc-types/screenplay/scene-frame-placeholder.js"></script>
<!-- F2 inner-editor modules — order matters: schema → keymap/views/plugins → frame node view -->
<script src="js/doc-types/screenplay/inner-schema.js"></script>
<script src="js/doc-types/screenplay/inner-keymap.js"></script>
<script src="js/doc-types/screenplay/inner-scene-line-node-view.js"></script>
<script src="js/doc-types/screenplay/inner-zone-key-plugin.js"></script>
<script src="js/doc-types/screenplay/scene-frame-node-view.js"></script>
<script src="js/doc-types/screenplay/index.js"></script>
```

(Verify the existing `index.js` script tag is still after these five; remove any duplicate.)

- [ ] **Step 4: Run all unit tests — expect zero failures**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | tail -10
```

Expected: every test passes.

- [ ] **Step 5: Build and smoke-test**

```
cd /e/api/rwanga/rwanga-editor && npm run build:renderer 2>&1 | tail -5
```

Then `npm start` to launch Electron. The fixture migration that already exists should produce one editable sceneFrame.

**Open the v2.0 fixture (`tests/fixtures/v2.0-sample.rga`).** Verify:

| # | Action | Expected |
|---|--------|----------|
| 1 | Fixture opens without errors | One scene frame visible with header "1" and inner content |
| 2 | Click inside the scene frame body | Cursor lands inside the inner editor |
| 3 | Slug zone shows three segments | "INT." — "CAFÉ" — "NIGHT" |
| 4 | Type at end of action text | Characters appear, no other content moves |
| 5 | Press Tab in an action block | Block type changes to character (text styling may differ) |
| 6 | Press Enter in an action block | New empty action appears below |
| 7 | Press Ctrl+Z | Last change reverts at outer level |
| 8 | Save (Ctrl+S) → close → reopen | All inner content persisted exactly |
| 9 | Click on "INT." span | Picker dropdown appears with INT./EXT./etc. |
| 10 | Click "EXT." in picker | Setting updates to "EXT.", picker closes |
| 11 | Click on "NIGHT" span | Picker dropdown appears with DAY/NIGHT/etc. |
| 12 | Press Escape with a picker open | Picker closes |
| 13 | Outer paragraph editing outside scenes | Still works — paragraphs editable, no sceneFrame interference |

If ANY item fails, **STOP** and report. Do not proceed past this checkpoint.

- [ ] **Step 6: Commit wire-up if all smoke items pass**

```
git add renderer/js/doc-types/screenplay/index.js renderer/js/editor/mount.js renderer/index.html
git commit -m "feat(f2): wire SceneFrame NodeView into outer mount (replaces placeholder)"
```

If smoke items 1–13 all pass: **GO**. Continue to Task 7.

If any fail: **NO-GO**. See Fallback Plan at bottom of document.

---

## Task 7: CSS

**Files:**
- Modify: `renderer/css/editor-prosemirror.css`

- [ ] **Step 1: Read the file**

```
cat renderer/css/editor-prosemirror.css | head -80
```

(Use Read tool — the file is large; only the relevant sections need to be located.)

- [ ] **Step 2: Append the F2 styles at the end of the file**

```css
/* ============================================================
   F2: Scene frame container (one nested EditorView per scene)
   ============================================================ */
.rga-scene-frame {
  border: 1px solid var(--border-secondary, #3a3a3a);
  border-radius: 4px;
  margin: 12px 0;
  padding: 0;
  background: var(--bg-page, #1e1e1e);
}

.rga-scene-frame-header {
  padding: 4px 12px;
  background: var(--bg-secondary, #252525);
  border-bottom: 1px solid var(--border-secondary, #3a3a3a);
  font-family: var(--font-mono, 'Courier Prime', monospace);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary, #888);
  user-select: none;
}

.rga-scene-number {
  display: inline-block;
}

.rga-scene-number::before {
  content: 'Scene ';
}

.rga-scene-frame-body {
  padding: 10px 16px 14px 16px;
  outline: none;
  min-height: 1.5em;
}

/* ============================================================
   F2: Inner-editor block styling
   ============================================================ */
.rga-scene-frame-body .rga-scene-line {
  font-family: var(--font-mono, 'Courier Prime', monospace);
  font-weight: 700;
  text-transform: uppercase;
  margin: 0 0 0.5em 0;
}

.rga-scene-frame-body .rga-action {
  font-family: var(--font-mono, 'Courier Prime', monospace);
  margin: 0.5em 0;
}

.rga-scene-frame-body .rga-character {
  font-family: var(--font-mono, 'Courier Prime', monospace);
  font-weight: 700;
  text-transform: uppercase;
  margin: 0.75em 0 0 0;
  padding-left: 2.2in;
}

.rga-scene-frame-body .rga-dialogue {
  font-family: var(--font-mono, 'Courier Prime', monospace);
  margin: 0 0 0.5em 0;
  padding-left: 1in;
  padding-right: 1in;
}

.rga-scene-frame-body .rga-parenthetical {
  font-family: var(--font-mono, 'Courier Prime', monospace);
  font-style: italic;
  padding-left: 1.6in;
  margin: 0;
}

.rga-scene-frame-body .rga-transition {
  font-family: var(--font-mono, 'Courier Prime', monospace);
  font-weight: 700;
  text-transform: uppercase;
  text-align: right;
  margin: 0.75em 0;
}

.rga-scene-frame-body .rga-shot {
  font-family: var(--font-mono, 'Courier Prime', monospace);
  font-weight: 700;
  text-transform: uppercase;
  margin: 0.5em 0;
}

.rga-scene-frame-body .rga-inline-free-text {
  font-family: var(--font-mono, 'Courier Prime', monospace);
  font-style: italic;
  color: var(--text-tertiary, #888);
  margin: 0.5em 0;
}

/* ============================================================
   F2: Slug zones inside the scene-line NodeView
   ============================================================ */
.rga-slug-setting,
.rga-slug-time {
  cursor: pointer;
  border-radius: 2px;
  padding: 0 3px;
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
  min-width: 1ch;
  display: inline-block;
}

.rga-slug-location:empty::before {
  content: 'LOCATION';
  color: var(--text-tertiary, #555);
  pointer-events: none;
}

.rga-scene-line[data-active-zone="setting"] .rga-slug-setting,
.rga-scene-line[data-active-zone="time"]    .rga-slug-time {
  background: var(--accent-primary, #569cd6);
  color: #fff;
}

.rga-slug-setting:hover,
.rga-slug-time:hover {
  background: var(--bg-hover, rgba(255,255,255,0.08));
}

/* ============================================================
   F2: Slug-zone picker
   ============================================================ */
.rga-slug-picker {
  position: absolute;
  z-index: 200;
  background: var(--bg-secondary, #2d2d2d);
  border: 1px solid var(--border-secondary, #444);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  min-width: 80px;
  overflow: hidden;
  margin-top: 2px;
}

.rga-slug-picker-item {
  padding: 5px 10px;
  font-size: 11px;
  font-family: var(--font-mono, 'Courier Prime', monospace);
  cursor: pointer;
  color: var(--text-primary, #d4d4d4);
  white-space: nowrap;
}

.rga-slug-picker-item:hover {
  background: var(--accent-primary, #569cd6);
  color: #fff;
}
```

- [ ] **Step 3: Build and verify visually**

```
cd /e/api/rwanga/rwanga-editor && npm run build:renderer 2>&1 | tail -5
```

Reload the app. Open the fixture. Verify:
- Scene frame has a thin border with a header bar reading "SCENE 1"
- Inside, the slug line is uppercase bold with " — " separators
- Action blocks are monospace, normal weight
- Character names center indented (~2.2in)
- Dialogue is indented (~1in)
- Picker dropdown appears on click and has the same dark theme

- [ ] **Step 4: Commit**

```
git add renderer/css/editor-prosemirror.css
git commit -m "feat(f2): CSS for scene-frame container, inner blocks, slug zones, pickers"
```

---

## Task 8: Formal smoke test + GO/NO-GO declaration

This task is a structured manual verification. Work each item; record PASS/FAIL. A single un-fixable FAIL means NO-GO.

- [ ] **Build final bundle**

```
cd /e/api/rwanga/rwanga-editor && npm run build:renderer 2>&1 | tail -5
```

- [ ] **Run all unit tests**

```
cd E:\api\rwanga\rwanga-editor && npm run test:unit 2>&1 | tail -10
```

Expected: 0 failures. Record the pass count.

- [ ] **Open the app and verify every item below**

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 1 | Open `tests/fixtures/v2.0-sample.rga` | One scene frame renders with header "SCENE 1" and visible inner content | |
| 2 | Click inside the scene frame's body | Cursor lands in the inner editor | |
| 3 | Slug shows three zones | "INT." — "CAFÉ" — "NIGHT" with " — " separators | |
| 4 | Click on "INT." span | Picker appears with INT./EXT./INT./EXT./EXT./INT. | |
| 5 | Click "EXT." in picker | Setting updates to "EXT.", picker closes, cursor in location | |
| 6 | Click on "NIGHT" span | Picker appears with DAY/NIGHT/CONTINUOUS/DUSK/DAWN | |
| 7 | Click "DAY" in picker | Time updates to "DAY", picker closes | |
| 8 | Press Escape with picker open | Picker closes | |
| 9 | Type "FOO" in location zone | Text appears in the middle zone only | |
| 10 | Tab at end of location zone | Time zone activates, picker appears | |
| 11 | Shift-Tab at start of location zone | Setting zone activates, picker appears | |
| 12 | Press Tab in an action block | Block type changes to character | |
| 13 | Press Tab again on character | Block type changes to dialogue | |
| 14 | Press Shift-Tab on dialogue | Block type changes back to character | |
| 15 | Press Enter on an action block | New empty action appears below | |
| 16 | Press Enter on a character block | New empty dialogue appears below | |
| 17 | Press Ctrl+Z after typing | Last keystroke reverts | |
| 18 | Press Ctrl+Z multiple times | Reverts each prior change in order | |
| 19 | Save (Ctrl+S) → close → reopen | All inner content persisted exactly | |
| 20 | Outer paragraph editing outside scenes | Paragraph still editable, no interference from sceneFrame | |
| 21 | New tab (no doc) → New Script | Empty state behavior unaffected | |
| 22 | Switch between two tabs with scenes | Inner content of each tab is independent | |

- [ ] **Record GO / NO-GO**

If ALL 22 pass:

```
git commit --allow-empty -m "chore(f2): GO — frame-architecture nested EditorView smoke test 22/22 pass"
```

If any fail: do not commit. See Fallback Plan.

---

## Fallback Plan — if smoke test fails

Activate this plan if the SceneFrame NodeView cannot be made to work cleanly (focus issues, infinite update loops, inner-state desync, irreconcilable PM API mismatch).

**What to revert:**

1. In `renderer/js/doc-types/screenplay/index.js`, remove the `sceneFrameNodeViewFactory` key from the registered config (force fallback to placeholder).

2. In `renderer/js/editor/mount.js`, the existing fallback (`else if placeholderNodeViewFactory`) handles it automatically; no change needed.

3. Optional: in `renderer/index.html`, comment out the script tag for `scene-frame-node-view.js` if it logs errors at load time.

**What to keep:**

- `inner-schema.js`, `inner-keymap.js`, `inner-scene-line-node-view.js`, `inner-zone-key-plugin.js` — all independent and tested in isolation; valuable groundwork for the next attempt.
- The CSS — no harm leaving it in even if unused.

**Fallback commit:**

```
git revert <commit-hash-of-task-6-wire-up>
git commit -m "revert(f2): SceneFrame NodeView NO-GO — fallback to F1 placeholder, keep inner-grammar modules"
```

Then file a follow-up STOP-point note with the specific failure symptom (e.g., "inner view loses focus on every keystroke", "outer doc grows by 1 child per keystroke", "innerDoc not persisted on save").

---

## Stop-Point Register (deferred from F2)

These are scheduled for F3 or later. None block F2 GO.

| ID | Item | Trigger |
|----|------|---------|
| SP-F2-1 | Ctrl+Enter inserts a new sceneFrame after current outer block | F3 (outer commands) |
| SP-F2-2 | Annotations / tags / revisionFlag context-menu actions work inside inner views | F3 (per-view plugin instances) |
| SP-F2-3 | Page-breaks computed across multi-scene docs | F3 (cross-frame layout) |
| SP-F2-4 | Active-scene highlight plugin (visual cue for current frame) | F3 |
| SP-F2-5 | Cursor-position persistence across tab switches | F3 |
| SP-F2-6 | Picker keyboard navigation (arrow up/down to cycle, Enter to commit) | F4 (UX polish) |
| SP-F2-7 | Auto-uppercase typing in location zone | F4 (UX polish) |
| SP-F2-8 | Per-inner-view undo history (vs current per-keystroke outer transaction) | F4 (UX polish) |
