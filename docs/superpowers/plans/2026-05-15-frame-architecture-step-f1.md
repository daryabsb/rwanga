# Frame Architecture — Step F1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. **Implementer subagent model: `sonnet`** — set this explicitly when spawning the implementer.

> **Spec reference (read first):** `docs/superpowers/specs/2026-05-15-rwanga-editor-frame-architecture-design.md`. Sections that govern F1 specifically: § 0 (Contract), § 1 (Ground/Sky model), § 2.1 (Doc-type registry), § 3.1 (Outer-schema additions), § 4.1 (Migration), § 7 row F1 (verification), § 8 (Stop-Point Register).

**Goal:** Land the new outer/inner split by replacing the current `scene`-as-PM-content schema with a `sceneFrame` atom in the outer schema, behind a doc-type registry. **The frame mounts no inner editor yet** — it renders a non-editable placeholder showing "Scene N". Old `.rga` files migrate on load. The outer view (paragraphs, headings, lists, blockquote) keeps working end-to-end. This is the foundation F2 builds on.

**Architecture:** A new global module `Rga.DocTypes` registers doc-type modules at script-tag load time. The screenplay doc-type registers an outer-schema addition: `sceneFrame` is an atom node whose `attrs.innerDoc` holds the entire screenplay-grammar subtree as opaque JSON. `mount.js` looks up the active doc-type, composes the outer schema from base nodes plus the doc-type's additions, and registers a `SceneFramePlaceholder` NodeView that shows "Scene N" (plus an optional one-line slug preview pulled from `innerDoc`). `doc.js` `deserialize` migrates legacy `scene` nodes to `sceneFrame` nodes before PM parses anything.

**Tech Stack:** ProseMirror (model, state, view, schema-basic), vanilla JS, `node:test` for unit tests, esbuild for the renderer bundle. No new dependencies.

---

## §0 Contract — read before any task

This plan implements **F1 only**, exactly as the spec describes it. The frame architecture has failed five times because implementers guessed past gaps. The rules:

1. **If any step reveals a gap — a missing API, a test that cannot be made to pass, a behavior that is ambiguous — STOP and report.** Do not infer. Do not "continue reasonably." Quote the gap and the file/line where you found it.
2. **F1 does NOT include:** the inner `EditorView`, the slug NodeView, the picker, element styles, the SCENE N identity line, auto-renumber, folding, drag-and-drop, the toolbox, the slash-menu. Each of those is a later step (F2–F7). If a task seems to require any of them, STOP — you have a gap.
3. **F1 DOES include:** doc-type registry, outer schema with `sceneFrame` atom, migration from old `scene` nodes, `SceneFramePlaceholder` NodeView, mount.js refactor, deletion of the obsolete files listed in the File Map, removal of the obsolete tests listed in Task 7. Nothing more.
4. **The verification at the end of this plan is the GO criterion for F1.** Do not declare F1 done until every item in Task 9 passes.
5. **Migration must be lossless.** Open a current `v2.0-sample.rga`, save it, reopen — the in-memory PM tree must be identical to the first load. Visible text must be identical. Tests in Task 4 enforce this.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `renderer/js/framework/doc-type-registry.js` | `Rga.DocTypes.register(name, config)` + `Rga.DocTypes.get(name)` |
| Create | `renderer/js/doc-types/screenplay/outer-schema-additions.js` | Exposes `Rga.DocTypes.screenplay.outerNodes.sceneFrame` (the node spec). |
| Create | `renderer/js/doc-types/screenplay/index.js` | Registers `'screenplay'` with the registry; pulls outer-schema-additions; placeholder for future F2+ wiring. |
| Create | `renderer/js/doc-types/screenplay/scene-frame-placeholder.js` | `SceneFramePlaceholder` NodeView class + `sceneFramePlaceholderFactory()`. Renders `Scene N` and an optional one-line slug preview from `attrs.innerDoc`. |
| Modify | `renderer/js/doc.js` | Add `_migrateScenesToFrames(node)` walker. Call it inside `deserialize` after `_migrateSceneLineLocations`. |
| Modify | `renderer/js/editor/mount.js` | Build outer schema from `Rga.DocTypes.get(doc.documentType).outerNodes`. Register the placeholder NodeView. **Remove** the existing screenplay keymap registration, the active-scene plugin, the slug NodeView factory registration, the zoneKeyPlugin, the autoRenumberPlugin. F1 has only outer-view editing. |
| Modify | `renderer/css/editor-prosemirror.css` | Add `.rga-scene-frame-placeholder` styles. **Remove** all `.rga-scene-line`, `.rga-slug-*`, `.rga-scene-identity`, `.rga-scene-content`, `.rga-scene[data-heading-style="..."]`, `.rga-action`, `.rga-character`, `.rga-dialogue`, `.rga-parenthetical`, `.rga-transition`, `.rga-shot`, `.rga-inline-free-text` rules — those nodes no longer live in the outer view. |
| Modify | `renderer/index.html` | Add `<script>` tags for the four new files in the right load order. Remove the tags for the four deleted files. |
| Delete | `renderer/js/doc-types/screenplay/schema.js` | Replaced by outer-schema-additions.js. The screenplay grammar's inner schema returns in F2. |
| Delete | `renderer/js/doc-types/screenplay/keymap.js` | Inner keymap returns in F2 (it lives inside the frame's inner editor). |
| Delete | `renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js` | The slug NodeView returns in F3 inside the inner editor. |
| Delete | `renderer/js/doc-types/screenplay/plugins/active-scene.js` | Per-frame focus events replace this in F2+. |
| Delete | `tests/unit/keymap/enter.test.js` | Tests the old PM-content scene grammar — no longer in the outer schema. |
| Delete | `tests/unit/keymap/tab-cycle.test.js` | Same. |
| Delete | `tests/unit/keymap/getSceneContext.test.js` | Same. |
| Delete | `tests/unit/keymap/helpers.js` | Helper for the deleted tests. |
| Delete | `tests/unit/doc-types/screenplay/scene-line-node-view.test.js` | Tested the deleted file. |
| Modify | `tests/unit/schema/nodes.test.js` | Replace the local mini-schema with the new outer schema (no `scene`, no `sceneLine`, no `action`, etc.; gains `sceneFrame`). |
| Modify | `tests/unit/schema/invariants.test.js` | Same schema swap. Remove the "scene without sceneLine fails to construct" invariant — that invariant no longer applies (no `scene` node in the outer schema). Add the new invariant: "sceneFrame is an atom that cannot contain inline content directly". |
| Modify | `tests/unit/schema/marks.test.js` | Same schema swap if it references the inner-grammar nodes. |
| Modify | `tests/unit/round-trip.test.js` | New outer schema; the fixture now round-trips through sceneFrame nodes after migration. |
| Modify | `tests/unit/doc.test.js` | Replace the old "migrate sceneLine location attr" test with the F1 migration test (scene → sceneFrame). Other doc tests unchanged. |
| Modify | `tests/fixtures/v2.0-sample.rga` | **Do not edit by hand.** This file is the *input* for the migration test. Leave it as the legacy format (scene with sceneLine children). Migration produces the new shape on load. |
| Create | `tests/unit/framework/doc-type-registry.test.js` | Tests `register` + `get` round-trip; error on duplicate; error on unknown. |
| Create | `tests/unit/doc-types/screenplay/outer-schema.test.js` | Tests the screenplay outer schema constructs and validates `sceneFrame` correctly. |
| Create | `tests/unit/doc-types/screenplay/migration.test.js` | Tests `_migrateScenesToFrames` end-to-end against multiple input shapes (empty scene, scene with children, scene inside a paragraph wrapper, nested impossible cases). |

---

## Task 1 — Doc-type registry framework

**Files:**
- Create: `renderer/js/framework/doc-type-registry.js`
- Create: `tests/unit/framework/doc-type-registry.test.js`

### Steps

- [ ] **Step 1.1: Write the failing tests**

Create `tests/unit/framework/doc-type-registry.test.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function loadRegistry() {
  const modPath = require.resolve('../../../renderer/js/framework/doc-type-registry.js');
  delete require.cache[modPath];
  global.window = { Rga: {} };
  require(modPath);
  return global.window.Rga.DocTypes;
}

test('register stores a config that get returns', () => {
  const reg = loadRegistry();
  const config = { outerNodes: { foo: {} } };
  reg.register('test-type', config);
  assert.equal(reg.get('test-type'), config);
});

test('register throws on duplicate name', () => {
  const reg = loadRegistry();
  reg.register('dup', { outerNodes: {} });
  assert.throws(() => reg.register('dup', { outerNodes: {} }), /already registered/);
});

test('get throws on unknown name', () => {
  const reg = loadRegistry();
  assert.throws(() => reg.get('not-registered'), /unknown doc-type/i);
});

test('has returns false for unregistered, true after register', () => {
  const reg = loadRegistry();
  assert.equal(reg.has('xyz'), false);
  reg.register('xyz', { outerNodes: {} });
  assert.equal(reg.has('xyz'), true);
});
```

- [ ] **Step 1.2: Run tests — verify 4 failures**

```
cd /e/api/rwanga/rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

Expected: 4 new failures. Do not proceed until you see the failures.

- [ ] **Step 1.3: Create the registry**

Create `renderer/js/framework/doc-type-registry.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Doc-type registry. Each doc-type module (screenplay, novel, theatre, …)
// calls Rga.DocTypes.register(name, config) at script-tag load time.
// mount.js / doc.js read the active document's documentType and look up
// its config to compose the outer schema, attach NodeViews, etc.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const _registry = Object.create(null);

  function register(name, config) {
    if (typeof name !== 'string' || !name) {
      throw new Error('DocTypes.register: name must be a non-empty string');
    }
    if (!config || typeof config !== 'object') {
      throw new Error('DocTypes.register: config must be an object');
    }
    if (_registry[name]) {
      throw new Error('DocTypes.register: "' + name + '" is already registered');
    }
    _registry[name] = config;
  }

  function get(name) {
    if (!_registry[name]) {
      throw new Error('DocTypes.get: unknown doc-type "' + name + '"');
    }
    return _registry[name];
  }

  function has(name) {
    return !!_registry[name];
  }

  Rga.DocTypes = { register: register, get: get, has: has };
})();
```

- [ ] **Step 1.4: Run tests — verify all 4 pass**

```
cd /e/api/rwanga/rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

Expected: previous count + 4 passing, 0 failing.

- [ ] **Step 1.5: Commit**

```
git add rwanga-editor/renderer/js/framework/doc-type-registry.js \
        rwanga-editor/tests/unit/framework/doc-type-registry.test.js
git commit -m "feat(framework): doc-type registry (F1.1)"
```

---

## Task 2 — Outer-schema addition: `sceneFrame`

**Files:**
- Create: `renderer/js/doc-types/screenplay/outer-schema-additions.js`
- Create: `tests/unit/doc-types/screenplay/outer-schema.test.js`

### Node spec — exact shape

```
sceneFrame:
  group:    'block'
  atom:     true                          ← outer view treats as opaque
  selectable: true
  attrs:
    id:           { default: null }       ← uuid; stable across edits
    number:       { default: null }       ← integer; managed by auto-renumber (F5); F1 reads it for display
    headingStyle: { default: null }       ← null | 'plain' | 'underline' | 'band'
    innerDoc:     { default: null }       ← JSON sub-document (see § 4 of spec)
  toDOM(node): ['div', {
                  class: 'rga-scene-frame',
                  'data-scene-id':     node.attrs.id || '',
                  'data-scene-number': node.attrs.number == null ? '' : String(node.attrs.number)
               }]
  parseDOM:  [{ tag: 'div.rga-scene-frame' }]
```

`sceneFrame` is `atom: true`. PM treats it as a single opaque unit — no editable child positions, no inline content. Anything visible inside the rendered DOM comes from the NodeView (Task 5), not from PM-managed content.

### Steps

- [ ] **Step 2.1: Write the failing test**

Create `tests/unit/doc-types/screenplay/outer-schema.test.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

function loadOuterSchemaAdditions() {
  const modPath = require.resolve('../../../../renderer/js/doc-types/screenplay/outer-schema-additions.js');
  delete require.cache[modPath];
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  global.window.Rga.DocTypes = global.window.Rga.DocTypes || {};
  global.window.Rga.DocTypes.screenplay = global.window.Rga.DocTypes.screenplay || {};
  require(modPath);
  return global.window.Rga.DocTypes.screenplay.outerNodes;
}

function buildSchema(outerNodes) {
  return new Schema({
    nodes: Object.assign({
      doc:        { content: 'block+' },
      paragraph:  { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      text:       { group: 'inline' }
    }, outerNodes),
    marks: {}
  });
}

test('outer-schema-additions exports a sceneFrame node spec', () => {
  const outerNodes = loadOuterSchemaAdditions();
  assert.ok(outerNodes, 'outerNodes must exist');
  assert.ok(outerNodes.sceneFrame, 'sceneFrame must be present');
});

test('sceneFrame node has the four expected attrs with correct defaults', () => {
  const outerNodes = loadOuterSchemaAdditions();
  const spec = outerNodes.sceneFrame;
  assert.deepEqual(Object.keys(spec.attrs).sort(),
    ['headingStyle', 'id', 'innerDoc', 'number']);
  assert.equal(spec.attrs.id.default, null);
  assert.equal(spec.attrs.number.default, null);
  assert.equal(spec.attrs.headingStyle.default, null);
  assert.equal(spec.attrs.innerDoc.default, null);
});

test('sceneFrame is atomic and in the block group', () => {
  const outerNodes = loadOuterSchemaAdditions();
  const spec = outerNodes.sceneFrame;
  assert.equal(spec.atom, true);
  assert.equal(spec.group, 'block');
});

test('schema with sceneFrame constructs and a doc with one sceneFrame is valid', () => {
  const outerNodes = loadOuterSchemaAdditions();
  const s = buildSchema(outerNodes);
  const node = s.node('sceneFrame', { id: 'a', number: 1, headingStyle: null, innerDoc: null });
  const doc = s.node('doc', null, [node]);
  assert.equal(doc.firstChild.type.name, 'sceneFrame');
  assert.equal(doc.firstChild.attrs.id, 'a');
  assert.equal(doc.firstChild.attrs.number, 1);
});

test('sceneFrame.toDOM produces the expected element', () => {
  const outerNodes = loadOuterSchemaAdditions();
  const s = buildSchema(outerNodes);
  const node = s.node('sceneFrame', { id: 'x', number: 3, headingStyle: null, innerDoc: null });
  const dom = outerNodes.sceneFrame.toDOM(node);
  assert.deepEqual(dom, ['div', {
    class: 'rga-scene-frame',
    'data-scene-id': 'x',
    'data-scene-number': '3'
  }]);
});
```

- [ ] **Step 2.2: Run tests — verify 5 failures**

```
cd /e/api/rwanga/rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

Expected: 5 new failures.

- [ ] **Step 2.3: Create the outer-schema additions**

Create `renderer/js/doc-types/screenplay/outer-schema-additions.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Screenplay doc-type — additions to the outer schema.
// F1 contribution: the sceneFrame atom node.
// Inner-grammar nodes (sceneLine, action, character, dialogue, etc.)
// are NOT in the outer schema. They live inside attrs.innerDoc as JSON
// and will be parsed by the inner EditorView mounted in F2.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  const sceneFrame = {
    group: 'block',
    atom: true,
    selectable: true,
    attrs: {
      id:           { default: null },
      number:       { default: null },
      headingStyle: { default: null },
      innerDoc:     { default: null }
    },
    toDOM: function(node) {
      return ['div', {
        class: 'rga-scene-frame',
        'data-scene-id':     node.attrs.id || '',
        'data-scene-number': node.attrs.number == null ? '' : String(node.attrs.number)
      }];
    },
    parseDOM: [{ tag: 'div.rga-scene-frame' }]
  };

  Rga.DocTypes.screenplay.outerNodes = { sceneFrame: sceneFrame };
})();
```

- [ ] **Step 2.4: Run tests — verify all 5 new tests pass**

- [ ] **Step 2.5: Commit**

```
git add rwanga-editor/renderer/js/doc-types/screenplay/outer-schema-additions.js \
        rwanga-editor/tests/unit/doc-types/screenplay/outer-schema.test.js
git commit -m "feat(screenplay): outer-schema sceneFrame atom (F1.2)"
```

---

## Task 3 — Screenplay doc-type registration

**Files:**
- Create: `renderer/js/doc-types/screenplay/index.js`
- Modify: `renderer/index.html` — add script tags for the three new files

### Load order

The three new screenplay files must load AFTER `framework/doc-type-registry.js` and BEFORE `editor/mount.js`. The required order:

```
1. js/framework/doc-type-registry.js
2. js/doc-types/screenplay/outer-schema-additions.js
3. js/doc-types/screenplay/scene-frame-placeholder.js     ← created in Task 5
4. js/doc-types/screenplay/index.js                       ← registers; needs 1, 2, 3 already loaded
5. js/editor/mount.js
```

### Steps

- [ ] **Step 3.1: Create the index file**

Create `renderer/js/doc-types/screenplay/index.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Screenplay doc-type module — registers with Rga.DocTypes at load time.
// F1 contribution: outer-schema additions + the placeholder NodeView factory.
// F2+ will add: innerSchema, innerKeymap, innerPlugins, slug NodeView, etc.
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

  Rga.DocTypes.register('screenplay', {
    outerNodes: sp.outerNodes,
    placeholderNodeViewFactory: sp.sceneFramePlaceholderFactory
    // F2+ keys (innerSchema, innerKeymap, innerPlugins, nodeViewFactory,
    //  elementStyles, vocabulary, toolbox, exporters) are added in later steps.
  });
})();
```

- [ ] **Step 3.2: Update `renderer/index.html`**

Find the existing screenplay-plugin script tags. Replace the entire screenplay block with the new load order. **The existing tags being removed** are:

```html
<script src="js/doc-types/screenplay/schema.js"></script>
<script src="js/doc-types/screenplay/keymap.js"></script>
<script src="js/doc-types/screenplay/plugins/active-scene.js"></script>
<script src="js/doc-types/screenplay/plugins/scene-line-node-view.js"></script>
```

(plus possibly other plugin tags — leave annotation, tag, revisionFlag, context-menu, page-breaks tags alone for now; they will be re-integrated in F2/F3.)

**The new tags to insert** (in this exact order, BEFORE `js/editor/mount.js`):

```html
<script src="js/framework/doc-type-registry.js"></script>
<script src="js/doc-types/screenplay/outer-schema-additions.js"></script>
<script src="js/doc-types/screenplay/scene-frame-placeholder.js"></script>
<script src="js/doc-types/screenplay/index.js"></script>
```

If the script order in `index.html` differs from the above example, **STOP and report** — do not guess at how to merge.

- [ ] **Step 3.3: Smoke-load test**

Skip a Node test (DOM not available). Instead add a regression test that verifies the script-tag block exists in `index.html`:

Create `tests/unit/framework/script-load-order.test.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INDEX_HTML = path.join(__dirname, '..', '..', '..', 'renderer', 'index.html');

test('index.html loads doc-type-registry before screenplay/index.js', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const reg  = html.indexOf('framework/doc-type-registry.js');
  const sp   = html.indexOf('doc-types/screenplay/index.js');
  assert.ok(reg > -1, 'doc-type-registry.js tag missing');
  assert.ok(sp  > -1, 'screenplay/index.js tag missing');
  assert.ok(reg < sp, 'doc-type-registry must load before screenplay/index.js');
});

test('index.html loads outer-schema-additions and scene-frame-placeholder before screenplay/index.js', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const out  = html.indexOf('outer-schema-additions.js');
  const ph   = html.indexOf('scene-frame-placeholder.js');
  const sp   = html.indexOf('doc-types/screenplay/index.js');
  assert.ok(out < sp, 'outer-schema-additions must load before screenplay/index.js');
  assert.ok(ph  < sp, 'scene-frame-placeholder must load before screenplay/index.js');
});

test('index.html does NOT reference the deleted screenplay files', () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  assert.equal(html.indexOf('screenplay/schema.js'), -1, 'schema.js must be removed');
  assert.equal(html.indexOf('screenplay/keymap.js'), -1, 'keymap.js must be removed');
  assert.equal(html.indexOf('plugins/active-scene.js'), -1, 'active-scene.js must be removed');
  assert.equal(html.indexOf('plugins/scene-line-node-view.js'), -1, 'scene-line-node-view.js must be removed');
});
```

- [ ] **Step 3.4: Run tests — verify the 3 new ones fail**

(They will fail because the new tags aren't present yet AND the deleted tags still are. Re-run after Step 3.2 is applied.)

- [ ] **Step 3.5: Commit**

```
git add rwanga-editor/renderer/js/doc-types/screenplay/index.js \
        rwanga-editor/renderer/index.html \
        rwanga-editor/tests/unit/framework/script-load-order.test.js
git commit -m "feat(screenplay): doc-type module registration + script-tag refactor (F1.3)"
```

---

## Task 4 — Migration: `scene` → `sceneFrame` in `doc.js`

**Files:**
- Modify: `renderer/js/doc.js`
- Create: `tests/unit/doc-types/screenplay/migration.test.js`

### What the migration does

For every node in the deserialized PM JSON tree, if `node.type === 'scene'`, transform it to:

```jsonc
{
  "type": "sceneFrame",
  "attrs": {
    "id":           oldScene.attrs.id           || null,
    "number":       oldScene.attrs.number       || null,
    "headingStyle": oldScene.attrs.headingStyle || null,
    "innerDoc": {
      "type": "doc",
      "attrs": {
        "notes":        oldScene.attrs.notes        || "",
        "revisionFlag": oldScene.attrs.revisionFlag || null
      },
      "content": oldScene.content || []
    }
  }
}
```

`oldScene.content` is the original array of `sceneLine`, `action`, `character`, etc. — kept verbatim. The migration does not parse it; it preserves it.

The walker also descends into any `content` array recursively so nested cases (a `scene` inside an unexpected wrapper) still work. If `node.content` is absent, nothing to recurse into.

The function is **pure**: takes JSON, returns JSON. No PM dependency.

### Steps

- [ ] **Step 4.1: Write failing tests**

Create `tests/unit/doc-types/screenplay/migration.test.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function loadDoc() {
  const modPath = require.resolve('../../../../renderer/js/doc.js');
  delete require.cache[modPath];
  global.window = { Rga: {} };
  require('../../../../renderer/js/constants.js');
  require(modPath);
  return global.window.Rga.Doc;
}

test('_migrateScenesToFrames converts a scene with full attrs', () => {
  const Doc = loadDoc();
  const input = {
    type: 'scene',
    attrs: { id: 's1', number: 1, notes: 'mood', revisionFlag: null, headingStyle: 'band' },
    content: [
      { type: 'sceneLine', attrs: { setting: 'INT.', time: 'DAY' },
        content: [{ type: 'text', text: 'CAFÉ' }] },
      { type: 'action', content: [{ type: 'text', text: 'A door opens.' }] }
    ]
  };
  const out = Doc._migrateScenesToFrames(input);
  assert.equal(out.type, 'sceneFrame');
  assert.equal(out.attrs.id, 's1');
  assert.equal(out.attrs.number, 1);
  assert.equal(out.attrs.headingStyle, 'band');
  assert.ok(out.attrs.innerDoc);
  assert.equal(out.attrs.innerDoc.type, 'doc');
  assert.equal(out.attrs.innerDoc.attrs.notes, 'mood');
  assert.equal(out.attrs.innerDoc.attrs.revisionFlag, null);
  assert.equal(out.attrs.innerDoc.content.length, 2);
  assert.equal(out.attrs.innerDoc.content[0].type, 'sceneLine');
  assert.equal(out.attrs.innerDoc.content[1].type, 'action');
});

test('_migrateScenesToFrames handles a scene with default/missing attrs', () => {
  const Doc = loadDoc();
  const out = Doc._migrateScenesToFrames({ type: 'scene', attrs: {}, content: [] });
  assert.equal(out.type, 'sceneFrame');
  assert.equal(out.attrs.id, null);
  assert.equal(out.attrs.number, null);
  assert.equal(out.attrs.headingStyle, null);
  assert.equal(out.attrs.innerDoc.content.length, 0);
  assert.equal(out.attrs.innerDoc.attrs.notes, '');
  assert.equal(out.attrs.innerDoc.attrs.revisionFlag, null);
});

test('_migrateScenesToFrames recurses into doc/body wrappers', () => {
  const Doc = loadDoc();
  const input = {
    type: 'doc',
    content: [{
      type: 'body',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'pre' }] },
        { type: 'scene', attrs: { id: 's1' },
          content: [{ type: 'sceneLine', attrs: { setting: 'INT.' }, content: [] }] }
      ]
    }]
  };
  const out = Doc._migrateScenesToFrames(input);
  assert.equal(out.content[0].content[0].type, 'paragraph');
  assert.equal(out.content[0].content[1].type, 'sceneFrame');
  assert.equal(out.content[0].content[1].attrs.id, 's1');
});

test('_migrateScenesToFrames leaves non-scene nodes untouched', () => {
  const Doc = loadDoc();
  const para = { type: 'paragraph', content: [{ type: 'text', text: 'hello' }] };
  assert.deepEqual(Doc._migrateScenesToFrames(para), para);
});

test('_migrateScenesToFrames is idempotent on already-migrated content', () => {
  const Doc = loadDoc();
  const alreadyMigrated = {
    type: 'sceneFrame',
    attrs: { id: 'a', number: 1, headingStyle: null, innerDoc: { type: 'doc', attrs: {}, content: [] } }
  };
  assert.deepEqual(Doc._migrateScenesToFrames(alreadyMigrated), alreadyMigrated);
});
```

- [ ] **Step 4.2: Run tests — verify 5 failures**

- [ ] **Step 4.3: Implement `_migrateScenesToFrames` in `renderer/js/doc.js`**

Add the function near `_migrateSceneLineLocations` (which can stay — it will still apply *inside* the migrated `innerDoc` content, so legacy `location` attrs in sceneLines are also handled). Insert the new function definition right after `_migrateSceneLineLocations`:

```javascript
  function _migrateScenesToFrames(node) {
    if (!node || typeof node !== 'object') return node;
    if (node.type === 'scene') {
      const oldAttrs = node.attrs || {};
      const migratedContent = Array.isArray(node.content)
        ? node.content.map(_migrateSceneLineLocations)
        : [];
      return {
        type: 'sceneFrame',
        attrs: {
          id:           oldAttrs.id           || null,
          number:       oldAttrs.number       || null,
          headingStyle: oldAttrs.headingStyle || null,
          innerDoc: {
            type: 'doc',
            attrs: {
              notes:        oldAttrs.notes        || '',
              revisionFlag: oldAttrs.revisionFlag || null
            },
            content: migratedContent
          }
        }
      };
    }
    if (Array.isArray(node.content)) {
      return Object.assign({}, node, { content: node.content.map(_migrateScenesToFrames) });
    }
    return node;
  }
```

Also expose it on the `Rga.Doc` object so tests can call it. Find the `Rga.Doc = { … }` (or wherever the export is) and add `_migrateScenesToFrames`:

```javascript
  Rga.Doc = {
    // …existing exports…
    _migrateScenesToFrames: _migrateScenesToFrames,
    _migrateSceneLineLocations: _migrateSceneLineLocations
  };
```

(If `_migrateSceneLineLocations` is not yet exported, also add it. The migration test in `doc.test.js` already requires it indirectly via `deserialize`.)

- [ ] **Step 4.4: Wire it into `deserialize`**

Find the `deserialize` function and the block that runs the existing location migration:

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

Replace with the two-step migration (scenes → frames first, then location attrs inside the inner doc):

```javascript
    if (isV2 && parsed.body && schema) {
      try {
        const sceneMigrated = _migrateScenesToFrames(parsed.body);
        const fullyMigrated = _migrateSceneLineLocations(sceneMigrated);
        pmBody = schema.nodeFromJSON(fullyMigrated);
      } catch (err) {
        throw new Error('Document body is invalid: ' + err.message);
      }
    }
```

Order matters: `_migrateScenesToFrames` runs first so its output (with sceneLines living inside `attrs.innerDoc.content`) is then walked by `_migrateSceneLineLocations`, which only acts on `sceneLine` nodes wherever it finds them — including inside the migrated inner-doc JSON, because the location migration's recursion descends into any `content` array.

**Verify behavior:** `_migrateSceneLineLocations` already walks `node.content` arrays. The migrated `sceneFrame` node has no `content` array (it's an atom; inner data lives in `attrs.innerDoc`). But `innerDoc.content` is a normal content array, and the walker will recurse into the `innerDoc` value via the `node.content` check **only if** `node.attrs.innerDoc.content` is visited as an array. Since `_migrateSceneLineLocations` only recurses into `node.content` (not `node.attrs.innerDoc.content`), **we need to teach it to descend into innerDoc** too. Update `_migrateSceneLineLocations` to also walk into `attrs.innerDoc`:

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
    let out = node;
    if (Array.isArray(node.content)) {
      out = Object.assign({}, out, { content: node.content.map(_migrateSceneLineLocations) });
    }
    if (out.attrs && out.attrs.innerDoc) {
      out = Object.assign({}, out, {
        attrs: Object.assign({}, out.attrs, {
          innerDoc: _migrateSceneLineLocations(out.attrs.innerDoc)
        })
      });
    }
    return out;
  }
```

- [ ] **Step 4.5: Run tests — verify the 5 migration tests pass**

```
cd /e/api/rwanga/rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

Note: at this point other tests (round-trip, doc.test) may now fail because the outer schema in those tests doesn't include `sceneFrame`. That's fixed in Tasks 6 and 7.

- [ ] **Step 4.6: Commit**

```
git add rwanga-editor/renderer/js/doc.js \
        rwanga-editor/tests/unit/doc-types/screenplay/migration.test.js
git commit -m "feat(doc): migrate scene → sceneFrame on load; preserve inner content as JSON (F1.4)"
```

---

## Task 5 — `SceneFramePlaceholder` NodeView

**Files:**
- Create: `renderer/js/doc-types/screenplay/scene-frame-placeholder.js`

### What it renders

```
┌────────────────────────────────────────────────┐
│ Scene 1                                        │
│ INT. CAFÉ — DAY                                │   ← optional preview from innerDoc
└────────────────────────────────────────────────┘
```

If `innerDoc` is present and its first child is a `sceneLine`, the preview reads `setting + ' ' + locationText + ' — ' + time` (the three pieces). If `setting`/`time` are missing, fall back to `'INT.'` / `'DAY'`. If `innerDoc` is absent, the preview line is omitted (only "Scene N" shows).

The NodeView is **read-only** — no events handled, no editing surface. It is the placeholder shape that F2 replaces with the real inner editor.

### Steps

- [ ] **Step 5.1: Create the file**

Create `renderer/js/doc-types/screenplay/scene-frame-placeholder.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// SceneFramePlaceholder — F1-only NodeView. Renders a non-editable box
// labeled "Scene N" with an optional one-line slug preview drawn from
// attrs.innerDoc. Replaced by the real inner-editor NodeView in F2.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};

  function _slugPreview(innerDoc) {
    if (!innerDoc || !Array.isArray(innerDoc.content) || innerDoc.content.length === 0) return null;
    const first = innerDoc.content[0];
    if (!first || first.type !== 'sceneLine') return null;
    const setting = (first.attrs && first.attrs.setting) || 'INT.';
    const time    = (first.attrs && first.attrs.time)    || 'DAY';
    let locationText = '';
    if (Array.isArray(first.content)) {
      first.content.forEach(function(child) {
        if (child.type === 'text' && typeof child.text === 'string') locationText += child.text;
      });
    }
    locationText = locationText.trim();
    return locationText
      ? (setting + ' ' + locationText + ' — ' + time)
      : (setting + ' — ' + time);
  }

  function SceneFramePlaceholder(node) {
    this.dom = document.createElement('div');
    this.dom.className = 'rga-scene-frame-placeholder';
    this.dom.setAttribute('contenteditable', 'false');
    this._render(node);
  }

  SceneFramePlaceholder.prototype._render = function(node) {
    while (this.dom.firstChild) this.dom.removeChild(this.dom.firstChild);

    const num = document.createElement('div');
    num.className = 'rga-scene-frame-placeholder-num';
    num.textContent = 'Scene ' + (node.attrs.number == null ? '?' : node.attrs.number);

    this.dom.appendChild(num);

    const preview = _slugPreview(node.attrs.innerDoc);
    if (preview) {
      const slug = document.createElement('div');
      slug.className = 'rga-scene-frame-placeholder-slug';
      slug.textContent = preview;
      this.dom.appendChild(slug);
    }

    this.dom.dataset.sceneId     = node.attrs.id     || '';
    this.dom.dataset.sceneNumber = node.attrs.number == null ? '' : String(node.attrs.number);
  };

  SceneFramePlaceholder.prototype.update = function(node) {
    if (node.type.name !== 'sceneFrame') return false;
    this._render(node);
    return true;
  };

  SceneFramePlaceholder.prototype.stopEvent = function() {
    return false; // F1: read-only; PM handles selection/click normally
  };

  function sceneFramePlaceholderFactory() {
    return function(node /*, view, getPos */) {
      return new SceneFramePlaceholder(node);
    };
  }

  Rga.DocTypes.screenplay.sceneFramePlaceholderFactory = sceneFramePlaceholderFactory;
  Rga.DocTypes.screenplay._slugPreview = _slugPreview; // exposed for unit tests
})();
```

- [ ] **Step 5.2: Test `_slugPreview` (a pure function we can unit-test)**

Append to `tests/unit/doc-types/screenplay/outer-schema.test.js`:

```javascript
function loadPlaceholder() {
  const modPath = require.resolve('../../../../renderer/js/doc-types/screenplay/scene-frame-placeholder.js');
  delete require.cache[modPath];
  global.window = global.window || {};
  global.window.Rga = global.window.Rga || {};
  global.window.Rga.DocTypes = global.window.Rga.DocTypes || {};
  global.window.Rga.DocTypes.screenplay = global.window.Rga.DocTypes.screenplay || {};
  // The module touches document.createElement only inside the constructor,
  // not at module load. _slugPreview is exported as a side-effect of load.
  global.document = { createElement: function() { return { setAttribute() {}, appendChild() {}, dataset: {} }; } };
  require(modPath);
  return global.window.Rga.DocTypes.screenplay._slugPreview;
}

test('_slugPreview: returns formatted slug from a sceneLine with content', () => {
  const slug = loadPlaceholder();
  const innerDoc = {
    type: 'doc',
    content: [
      { type: 'sceneLine',
        attrs: { setting: 'INT.', time: 'NIGHT' },
        content: [{ type: 'text', text: 'CAFÉ' }] }
    ]
  };
  assert.equal(slug(innerDoc), 'INT. CAFÉ — NIGHT');
});

test('_slugPreview: empty location falls back to "SETTING — TIME"', () => {
  const slug = loadPlaceholder();
  const innerDoc = {
    type: 'doc',
    content: [{ type: 'sceneLine', attrs: { setting: 'EXT.', time: 'DAY' }, content: [] }]
  };
  assert.equal(slug(innerDoc), 'EXT. — DAY');
});

test('_slugPreview: null innerDoc returns null', () => {
  const slug = loadPlaceholder();
  assert.equal(slug(null), null);
});

test('_slugPreview: missing setting/time defaults to INT./DAY', () => {
  const slug = loadPlaceholder();
  const innerDoc = {
    type: 'doc',
    content: [{ type: 'sceneLine', attrs: {}, content: [{ type: 'text', text: 'PARK' }] }]
  };
  assert.equal(slug(innerDoc), 'INT. PARK — DAY');
});
```

- [ ] **Step 5.3: Add CSS for the placeholder**

In `renderer/css/editor-prosemirror.css`, add (anywhere near other block styles, but **not inside any selector** like `.ProseMirror .rga-scene-line` — keep at top-level):

```css
/* ---- F1 placeholder for sceneFrame (F2 will replace with the real inner editor) ---- */
.ProseMirror .rga-scene-frame {
  margin: 0 0 1em 0;
}

.rga-scene-frame-placeholder {
  user-select: none;
  cursor: default;
  background: var(--bg-secondary, #2a2a2a);
  border: 1px dashed var(--border-secondary, #555);
  border-radius: 4px;
  padding: 10px 14px;
  font-family: var(--font-editor, 'Courier Prime', monospace);
  color: var(--text-primary, #cccccc);
}

.rga-scene-frame-placeholder-num {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.95em;
  color: var(--text-secondary, #aaa);
  margin-bottom: 4px;
}

.rga-scene-frame-placeholder-slug {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 1em;
}

[data-theme="light"] .rga-scene-frame-placeholder {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.18);
}
```

- [ ] **Step 5.4: Run tests — verify the 4 new `_slugPreview` tests pass**

- [ ] **Step 5.5: Commit**

```
git add rwanga-editor/renderer/js/doc-types/screenplay/scene-frame-placeholder.js \
        rwanga-editor/renderer/css/editor-prosemirror.css \
        rwanga-editor/tests/unit/doc-types/screenplay/outer-schema.test.js
git commit -m "feat(screenplay): SceneFramePlaceholder NodeView + CSS (F1.5)"
```

---

## Task 6 — `mount.js` refactor: use the doc-type registry

**Files:**
- Modify: `renderer/js/editor/mount.js`

### What changes

The current `mount.js`:
- Hardcodes `Rga.DocTypes.screenplay.schema` (the old scene-grammar schema, which Task 7 deletes).
- Hardcodes registration of: `buildKeymap` (screenplay keymap), `activeScenePlugin`, `sceneLineNodeViewFactory`, `sceneNodeViewFactory`, `zoneKeyPlugin`, `autoRenumberPlugin`.

The new `mount.js`:
- Reads `doc.documentType` (default `'screenplay'`) from the active tab's doc, or defaults to `'screenplay'` if no active doc yet.
- Looks up the registered doc-type via `Rga.DocTypes.get(documentType)`.
- Composes the outer schema: base nodes + `docType.outerNodes`.
- Registers `nodeViews: { sceneFrame: docType.placeholderNodeViewFactory() }`.
- **Removes** all the F2+ plugin registrations (buildKeymap, activeScenePlugin, sceneNodeViewFactory, zoneKeyPlugin, autoRenumberPlugin, sceneLineNodeViewFactory). Leaves the mark plugins (contextMenuPlugin, annotationsPlugin, tagsPlugin, revisionFlagsPlugin) and page-breaks. **Note:** `contextMenuPlugin` and the mark plugins depend on `Rga.DocTypes.screenplay.schema` indirectly. Leave them registered in `mount.js`, but in F1 they are no-ops on the placeholder (marks can't apply to atom nodes' attrs). They become useful again in F2 when the inner editor mounts them.

### The base outer schema

Define the base outer schema inside `mount.js` (or inline it for now — F1 keeps this local; F2 may move it to `framework/base-outer-schema.js`):

```javascript
const baseOuterNodes = {
  doc:        { content: 'titleStrip? body' },
  titleStrip: { content: 'text*',
                attrs: { removable: { default: true } },
                parseDOM: [{ tag: 'div.rga-title-strip' }],
                toDOM: function(node) { return ['div', { class: 'rga-title-strip', 'data-removable': String(node.attrs.removable) }, 0]; } },
  body:       { content: 'block*',
                parseDOM: [{ tag: 'div.rga-body' }],
                toDOM: function() { return ['div', { class: 'rga-body' }, 0]; } },
  paragraph:  { content: 'inline*', group: 'block',
                parseDOM: [{ tag: 'p' }],
                toDOM: function() { return ['p', 0]; } },
  heading:    { content: 'inline*', group: 'block',
                attrs: { level: { default: 1 } },
                parseDOM: [
                  { tag: 'h1', attrs: { level: 1 } },
                  { tag: 'h2', attrs: { level: 2 } },
                  { tag: 'h3', attrs: { level: 3 } }
                ],
                toDOM: function(node) { return ['h' + node.attrs.level, 0]; } },
  blockquote: { content: 'inline*', group: 'block',
                parseDOM: [{ tag: 'blockquote' }],
                toDOM: function() { return ['blockquote', 0]; } },
  bulletList:  { content: 'listItem+', group: 'block',
                 parseDOM: [{ tag: 'ul' }],
                 toDOM: function() { return ['ul', 0]; } },
  orderedList: { content: 'listItem+', group: 'block',
                 attrs: { start: { default: 1 } },
                 parseDOM: [{ tag: 'ol', getAttrs: function(dom) { return { start: +dom.getAttribute('start') || 1 }; } }],
                 toDOM: function(node) { return node.attrs.start === 1 ? ['ol', 0] : ['ol', { start: node.attrs.start }, 0]; } },
  listItem:    { content: 'paragraph block*',
                 parseDOM: [{ tag: 'li' }],
                 toDOM: function() { return ['li', 0]; } },
  horizontalRule: { group: 'block',
                    parseDOM: [{ tag: 'hr' }],
                    toDOM: function() { return ['hr']; } },
  pageBreak: { group: 'block',
               attrs: { manual: { default: true } },
               parseDOM: [{ tag: 'div.rga-page-break' }],
               toDOM: function() { return ['div', { class: 'rga-page-break' }]; } },
  text: { group: 'inline' }
};

const baseOuterMarks = {
  // Use the same mark specs as before — copy from the old schema.js. F1 keeps
  // marks working at the outer level; F2 also registers them in the inner view.
  // (Implementer: copy the marks block verbatim from the deleted schema.js
  // before deleting that file in Task 7.)
};
```

The marks block in the deleted `schema.js` is large (annotation, tag, revisionFlag, etc.). Copy it verbatim. Do **not** rewrite. If the marks block references helpers (e.g., `_contrastColor`), copy those helpers too.

### Steps

- [ ] **Step 6.1: Copy the marks block out of the to-be-deleted schema.js**

Open `renderer/js/doc-types/screenplay/schema.js`. Locate the `const marks = { … };` block and the `_contrastColor` helper. Copy them into a new file:

```
renderer/js/framework/base-outer-marks.js
```

Wrap them in the IIFE pattern:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Base outer-schema marks. Same set works for every doc-type for now.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  Rga.Framework = Rga.Framework || {};

  function _contrastColor(hex) {
    // …verbatim copy from schema.js…
  }

  const marks = {
    // …verbatim copy of the marks block from schema.js…
  };

  Rga.Framework.baseOuterMarks = marks;
  Rga.Framework._contrastColor  = _contrastColor;
})();
```

Add a script tag for it in `index.html`, AFTER `framework/doc-type-registry.js` and BEFORE any doc-type module:

```html
<script src="js/framework/base-outer-marks.js"></script>
```

- [ ] **Step 6.2: Rewrite `mount.js`**

Replace the existing `activeSchema()` function and the plugins-array building so the schema is composed from registry + base, and the F2+ plugin registrations are gone.

Open `renderer/js/editor/mount.js`. Find `activeSchema()` and the plugins-array assembly. Replace with:

```javascript
  // Build the active outer schema by composing the base outer nodes/marks
  // with the registered doc-type's outerNodes.
  function activeSchema(documentType) {
    const PM = window.RgaProseMirror;
    if (!PM) {
      console.error('[Rga.Editor] ProseMirror bundle not loaded');
      return null;
    }
    if (!Rga.DocTypes || !Rga.DocTypes.has(documentType)) {
      console.error('[Rga.Editor] No doc-type registered for "' + documentType + '"');
      return null;
    }
    const docType = Rga.DocTypes.get(documentType);
    const nodes = Object.assign({}, baseOuterNodes, docType.outerNodes);
    const marks = (Rga.Framework && Rga.Framework.baseOuterMarks) || {};
    return new PM.Schema({ nodes: nodes, marks: marks });
  }
```

Define `baseOuterNodes` at the top of the IIFE (paste the block from Task 6 above).

Find `function mount(container, opts)`. Replace its body so it:

1. Gets `documentType` from `opts.documentType` (passed by tab-manager) or defaults to `'screenplay'`.
2. Calls `activeSchema(documentType)`.
3. Composes plugins **without** the F2+ ones — keep only:
   - `PM.history()`
   - `PM.keymap({ 'Mod-z': PM.undo, 'Mod-y': PM.redo, 'Mod-Shift-z': PM.redo })` (no Tab trap — Tab in F1 is just default base keymap)
   - `PM.keymap(PM.baseKeymap)`
   - Page-breaks plugin (already wired; leave as-is)
   - Mark plugins (contextMenuPlugin, annotationsPlugin, tagsPlugin, revisionFlagsPlugin) — leave as-is.

4. Builds `nodeViews`:

```javascript
const docType = Rga.DocTypes.get(documentType);
const nodeViews = {};
if (typeof docType.placeholderNodeViewFactory === 'function') {
  nodeViews.sceneFrame = docType.placeholderNodeViewFactory();
}
```

5. **Remove** every reference to:
   - `Rga.DocTypes.screenplay.buildKeymap`
   - `Rga.DocTypes.screenplay.activeScenePlugin`
   - `Rga.DocTypes.screenplay.sceneLineNodeViewFactory`
   - `Rga.DocTypes.screenplay.sceneNodeViewFactory`
   - `Rga.DocTypes.screenplay.zoneKeyPlugin`
   - `Rga.DocTypes.screenplay.autoRenumberPlugin`
   - `Rga.DocTypes.screenplay.schema`

If you find references the plan didn't mention — **STOP and report**. Don't guess.

- [ ] **Step 6.3: Check tab-manager.js passes documentType**

Open `renderer/js/tab-manager.js`. Find where `mount(container, opts)` is called. Add `documentType: tab.doc.documentType || 'screenplay'` to the opts. If the call signature differs, **STOP and report**.

- [ ] **Step 6.4: Build the bundle and check for errors**

```
cd /e/api/rwanga/rwanga-editor && npm run build:renderer 2>&1 | tail -10
```

Expected: no errors. The bundle builds.

- [ ] **Step 6.5: Run the unit tests — note remaining failures**

```
cd /e/api/rwanga/rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

Expected: tests that test the old keymap/scene-grammar still fail; they are deleted in Task 7.

- [ ] **Step 6.6: Commit**

```
git add rwanga-editor/renderer/js/editor/mount.js \
        rwanga-editor/renderer/js/tab-manager.js \
        rwanga-editor/renderer/js/framework/base-outer-marks.js \
        rwanga-editor/renderer/index.html
git commit -m "feat(editor): compose outer schema from doc-type registry; remove F2+ plugin wiring (F1.6)"
```

---

## Task 7 — Delete obsolete files and tests

### Files to delete

```
renderer/js/doc-types/screenplay/schema.js
renderer/js/doc-types/screenplay/keymap.js
renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js
renderer/js/doc-types/screenplay/plugins/active-scene.js
tests/unit/keymap/enter.test.js
tests/unit/keymap/tab-cycle.test.js
tests/unit/keymap/getSceneContext.test.js
tests/unit/keymap/helpers.js
tests/unit/doc-types/screenplay/scene-line-node-view.test.js
```

### Tests to update

```
tests/unit/schema/nodes.test.js
tests/unit/schema/invariants.test.js
tests/unit/schema/marks.test.js
tests/unit/round-trip.test.js
tests/unit/doc.test.js
```

### Steps

- [ ] **Step 7.1: Delete the obsolete renderer files**

```
rm rwanga-editor/renderer/js/doc-types/screenplay/schema.js
rm rwanga-editor/renderer/js/doc-types/screenplay/keymap.js
rm rwanga-editor/renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js
rm rwanga-editor/renderer/js/doc-types/screenplay/plugins/active-scene.js
```

- [ ] **Step 7.2: Delete the obsolete tests**

```
rm rwanga-editor/tests/unit/keymap/enter.test.js
rm rwanga-editor/tests/unit/keymap/tab-cycle.test.js
rm rwanga-editor/tests/unit/keymap/getSceneContext.test.js
rm rwanga-editor/tests/unit/keymap/helpers.js
rm rwanga-editor/tests/unit/doc-types/screenplay/scene-line-node-view.test.js
rmdir rwanga-editor/tests/unit/keymap
```

- [ ] **Step 7.3: Rewrite `tests/unit/schema/nodes.test.js`**

Replace the entire file with:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

function buildSchema() {
  return new Schema({
    nodes: {
      doc:        { content: 'titleStrip? body' },
      titleStrip: { content: 'text*', attrs: { removable: { default: true } }, toDOM() { return ['div', { class: 'rga-title-strip' }, 0]; } },
      body:       { content: 'block*', toDOM() { return ['div', { class: 'rga-body' }, 0]; } },
      paragraph:  { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      heading:    { content: 'inline*', group: 'block', attrs: { level: { default: 1 } }, toDOM(n) { return ['h' + n.attrs.level, 0]; } },
      blockquote: { content: 'inline*', group: 'block', toDOM() { return ['blockquote', 0]; } },
      bulletList:  { content: 'listItem+', group: 'block', toDOM() { return ['ul', 0]; } },
      orderedList: { content: 'listItem+', group: 'block', attrs: { start: { default: 1 } }, toDOM() { return ['ol', 0]; } },
      listItem:    { content: 'paragraph block*', toDOM() { return ['li', 0]; } },
      horizontalRule: { group: 'block', toDOM() { return ['hr']; } },
      pageBreak:  { group: 'block', attrs: { manual: { default: true } }, toDOM() { return ['div', { class: 'rga-page-break' }]; } },
      sceneFrame: {
        group: 'block',
        atom: true,
        attrs: {
          id:           { default: null },
          number:       { default: null },
          headingStyle: { default: null },
          innerDoc:     { default: null }
        },
        toDOM(node) {
          return ['div', { class: 'rga-scene-frame', 'data-scene-id': node.attrs.id || '', 'data-scene-number': node.attrs.number == null ? '' : String(node.attrs.number) }];
        }
      },
      text: { group: 'inline' }
    },
    marks: {}
  });
}

test('outer schema constructs without errors', () => {
  const s = buildSchema();
  assert.ok(s.nodes.paragraph);
  assert.ok(s.nodes.sceneFrame);
});

test('sceneFrame can sit as a body block alongside paragraphs', () => {
  const s = buildSchema();
  const frame = s.node('sceneFrame', { id: 's1', number: 1, headingStyle: null, innerDoc: null });
  const doc = s.node('doc', null, [
    s.node('body', null, [
      s.node('paragraph', null, [s.text('hello')]),
      frame,
      s.node('paragraph', null, [s.text('world')])
    ])
  ]);
  assert.equal(doc.firstChild.child(1).type.name, 'sceneFrame');
});
```

- [ ] **Step 7.4: Rewrite `tests/unit/schema/invariants.test.js`**

Replace its body. The new invariants:

```javascript
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
```

- [ ] **Step 7.5: Update `tests/unit/schema/marks.test.js`**

Open the file. If it builds a schema that references `sceneLine`, `action`, etc., replace those references with `paragraph` and `sceneFrame` only. Mark behavior is the same. If the existing tests are agnostic to which block nodes exist, leave them.

If you discover marks tests deeply tied to inner-grammar nodes, **STOP and report** — they may need to be moved to F2.

- [ ] **Step 7.6: Update `tests/unit/round-trip.test.js`**

The fixture `tests/fixtures/v2.0-sample.rga` is the legacy format (with `scene` nodes). Migration converts it on load. The round-trip test now needs the new outer schema:

Replace the `buildScreenplaySchema` function with:

```javascript
function buildScreenplaySchema() {
  return new Schema({
    nodes: {
      doc:        { content: 'titleStrip? body' },
      titleStrip: { content: 'text*', attrs: { removable: { default: true } }, toDOM() { return ['div', 0]; } },
      body:       { content: 'block*', toDOM() { return ['div', 0]; } },
      paragraph:  { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      heading:    { content: 'inline*', group: 'block', attrs: { level: { default: 1 } }, toDOM(n) { return ['h' + n.attrs.level, 0]; } },
      blockquote: { content: 'inline*', group: 'block', toDOM() { return ['blockquote', 0]; } },
      bulletList:  { content: 'listItem+', group: 'block', toDOM() { return ['ul', 0]; } },
      orderedList: { content: 'listItem+', group: 'block', attrs: { start: { default: 1 } }, toDOM() { return ['ol', 0]; } },
      listItem:    { content: 'paragraph block*', toDOM() { return ['li', 0]; } },
      horizontalRule: { group: 'block', toDOM() { return ['hr']; } },
      pageBreak:  { group: 'block', attrs: { manual: { default: true } }, toDOM() { return ['div']; } },
      sceneFrame: {
        group: 'block',
        atom: true,
        attrs: { id: { default: null }, number: { default: null }, headingStyle: { default: null }, innerDoc: { default: null } },
        toDOM() { return ['div', 0]; }
      },
      text: { group: 'inline' }
    },
    marks: {
      // Copy the existing marks block as-is; round-trip test relies on them.
    }
  });
}
```

(Copy the marks block from the prior version of the file. Marks haven't changed.)

The existing assertions about `sceneNode.firstChild.type.name === 'sceneLine'` no longer apply — the migrated outer doc has a `sceneFrame` node whose first child does not exist (atom). Replace the third test:

```javascript
test('scene structure survives the round-trip — appears as sceneFrame', () => {
  const schema = buildScreenplaySchema();
  const content = fs.readFileSync(FIXTURE, 'utf8');
  const doc = Doc.deserialize(content, FIXTURE, { schema });

  let bodyContent = null;
  doc.body.forEach(child => {
    if (child.type.name === 'body') bodyContent = child;
  });
  assert.ok(bodyContent);

  let frameNode = null;
  bodyContent.forEach(child => {
    if (child.type.name === 'sceneFrame') frameNode = child;
  });
  assert.ok(frameNode, 'sceneFrame node should exist after migration');
  assert.equal(frameNode.attrs.id, 'scene-7f2a');
  assert.ok(frameNode.attrs.innerDoc, 'innerDoc must be populated');
  assert.equal(frameNode.attrs.innerDoc.type, 'doc');
  // The inner doc's first child is the legacy sceneLine JSON
  assert.equal(frameNode.attrs.innerDoc.content[0].type, 'sceneLine');
});
```

- [ ] **Step 7.7: Update `tests/unit/doc.test.js`**

The existing migration test (`Doc.deserialize migrates old sceneLine location attr to inline text content`) used a local schema with `scene` and `sceneLine`. Replace its local schema with one that has only `paragraph` + `sceneFrame` (since `scene` and `sceneLine` are no longer outer-schema nodes). The migrated form now lives in `frame.attrs.innerDoc.content[0]`:

```javascript
test('Doc.deserialize migrates old sceneLine location attr to inline text content', () => {
  const { Schema } = require('prosemirror-model');
  const newSchema = new Schema({
    nodes: {
      doc:        { content: 'body' },
      body:       { content: 'block*', toDOM() { return ['div', 0]; } },
      paragraph:  { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      sceneFrame: {
        group: 'block', atom: true,
        attrs: { id: { default: null }, number: { default: null }, headingStyle: { default: null }, innerDoc: { default: null } },
        toDOM() { return ['div', 0]; }
      },
      text: { group: 'inline' }
    },
    marks: {}
  });

  const fileJson = {
    rga_version: '2.0',
    document_type: 'screenplay',
    metadata: {},
    settings: {},
    body: {
      type: 'doc',
      content: [{
        type: 'body',
        content: [{
          type: 'scene',
          attrs: { id: 's1', number: 1, notes: '', revisionFlag: null, headingStyle: null },
          content: [
            { type: 'sceneLine',
              attrs: { setting: 'INT', location: 'CAFÉ', time: 'DAY' },
              content: [] },
            { type: 'action', content: [] }
          ]
        }]
      }]
    },
    tag_registry: {},
    flag_log: [],
    export_settings: {},
    runtime: {}
  };

  const reloaded = Doc.deserialize(JSON.stringify(fileJson), null, { schema: newSchema });
  const frame = reloaded.body.firstChild.firstChild;
  assert.equal(frame.type.name, 'sceneFrame');
  assert.equal(frame.attrs.id, 's1');
  const sceneLine = frame.attrs.innerDoc.content[0];
  assert.equal(sceneLine.type, 'sceneLine');
  assert.equal(sceneLine.attrs.setting, 'INT');
  assert.equal(sceneLine.attrs.time, 'DAY');
  // location attr removed; text content added
  assert.equal(sceneLine.attrs.location, undefined);
  assert.equal(sceneLine.content[0].text, 'CAFÉ');
});
```

Leave all other tests in this file unchanged.

- [ ] **Step 7.8: Run tests — expect green**

```
cd /e/api/rwanga/rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

Expected: all pass, 0 fail. If any other test breaks, fix it in this task (and add a note in the commit) — but **do not change behavior**, only update the test to the new outer schema. If a test cannot be reconciled, **STOP and report**.

- [ ] **Step 7.9: Commit**

```
git add -A rwanga-editor/renderer/js/doc-types/screenplay/ \
       rwanga-editor/tests/unit/
git commit -m "refactor(editor): delete obsolete scene-grammar code; rewrite schema tests for F1 (F1.7)"
```

---

## Task 8 — Build & headless verification

- [ ] **Step 8.1: Build the renderer bundle**

```
cd /e/api/rwanga/rwanga-editor && npm run build:renderer 2>&1 | tail -3
```

Expected: bundle builds, no errors.

- [ ] **Step 8.2: Re-run all unit tests; record count**

```
cd /e/api/rwanga/rwanga-editor && npm run test:unit 2>&1 | grep -E "pass|fail"
```

Expected: all pass, 0 fail. Record the final count for the commit message.

- [ ] **Step 8.3: Verify no hardcoded inch values remain in CSS for outer-view block positioning**

```
grep -nE 'margin-inline-(start|end):\s*[0-9.]+in' rwanga-editor/renderer/css/editor-prosemirror.css || echo "OK — no hardcoded inch margins"
```

Expected: `OK — no hardcoded inch margins`. If any hits remain, they belong to the deleted inner-grammar nodes and must be removed.

- [ ] **Step 8.4: Verify no references to deleted modules remain in source**

```
grep -rn "buildKeymap\|activeScenePlugin\|sceneLineNodeViewFactory\|sceneNodeViewFactory\|zoneKeyPlugin\|autoRenumberPlugin" rwanga-editor/renderer/ || echo "OK — no stale references"
```

Expected: `OK — no stale references`. If any hits remain in `renderer/js/`, **STOP and report**.

- [ ] **Step 8.5: Commit (verification artifacts only)**

If no code changed, no commit needed. If you had to remove a stray reference in 8.4, commit that fix separately.

---

## Task 9 — Manual smoke test (the designer runs this; do not declare F1 done without it)

The implementer cannot run Electron. After Task 8 passes, **stop and report** the unit-test count and the four verification outputs (8.3, 8.4) to the designer. The designer runs:

```
cd /e/api/rwanga/rwanga-editor && npm run dev
```

The designer verifies:

| # | Action | Expected |
|---|--------|----------|
| 1 | App opens | Window shows. No console errors that mention undefined `Rga.DocTypes.screenplay.schema` or similar deleted symbols. |
| 2 | A new untitled doc has an empty paragraph | Cursor sits in a paragraph; typing produces text. |
| 3 | Open the existing fixture `tests/fixtures/v2.0-sample.rga` from the File menu | Document loads. Where the old scene used to render, a placeholder box now reads: `Scene 1` / `INT. CAFÉ — NIGHT`. The paragraph "Opening should feel quiet." appears above the placeholder. |
| 4 | Click in the paragraph above the placeholder; type "hello world" | Text appears as paragraph text; placeholder is unaffected. |
| 5 | Click on the placeholder | Browser selects it as a single unit; cursor cannot enter; typing produces no text in the placeholder. |
| 6 | Save (Ctrl+S) | File saves without error. |
| 7 | Close and reopen the same file | The document looks identical to step 3. |
| 8 | Theme toggle (status bar) | Works (already wired in a prior commit). |
| 9 | Language toggle (status bar) | Works (already wired in a prior commit). |

**If any of 1–7 fails, F1 is NOT done. STOP and report to the designer.**

Items 8–9 are not part of F1 but should still work; if they regress, fix in this task.

---

## §6 Stop-Point Register additions

| ID | Item | Trigger |
|----|------|---------|
| SP-F1-1 | Marks plugins (annotations, tags, revisionFlags) in F1 attach to the outer view but cannot apply to atoms. They are harmless no-ops in F1. **Confirm** they neither error nor consume CPU during outer-view editing. | Step 9.3 (manual paragraph editing) |
| SP-F1-2 | Page-breaks plugin estimates pages based on outer-view scrollHeight; with frames as placeholders the estimate is off until F2 mounts real inner content. **Acceptable for F1** since pagination is itself a v0.2 concern. | Spec § 1.4 — already noted |
| SP-F1-3 | F2 will reuse `attrs.innerDoc` as the source of truth for the inner editor. The placeholder reads it; F2 writes it. F1 must not mutate `innerDoc` from JS — only the migration writes it. | Carries forward to F2 |

---

## Definition of done (F1)

- [ ] All 9 tasks completed and committed.
- [ ] Unit-test count up by at least 12 (registry: 4, outer-schema: 5, migration: 5, slug-preview: 4 = 18 added; some old tests deleted; net positive).
- [ ] Zero failing unit tests.
- [ ] Designer ran Task 9's 7-item smoke test and reports PASS.
- [ ] Stop-Point Register additions recorded.

When PASS is reported by the designer, F1 is GO. The next plan (F2) is the GO/NO-GO step — nested `EditorView` for a single sceneFrame.

If anything in Task 9 fails, the implementer does NOT attempt repairs alone. Report the exact failure and wait for designer guidance. Five attempts have failed in this area; the sixth one stops at the first sign of trouble.

---

*End of F1 plan.*
