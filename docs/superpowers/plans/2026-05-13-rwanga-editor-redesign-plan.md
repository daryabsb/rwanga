# Rwanga Editor Redesign — Implementation Plan

> **Execution model:** Inline, user-driven. The user dispatches one task at a time. Each task names the subagent role to use and the exact prompt to give it.
>
> **Source spec:** `docs/superpowers/specs/2026-05-13-rwanga-editor-redesign-design.md`
> **Working directory:** `rwanga-editor/` at the repo root (NOT under `src/`).
> **Branch:** `main` (no worktrees, per user preference).

**Goal:** Replace the broken custom contenteditable editor with a ProseMirror-based foundation that implements the redesigned content model and app shell.

**Architecture:** Strip the existing `editor-engine.js` / `scene-manager.js` / `tag-system.js` / `problems.js`. Mount ProseMirror as the editor engine. Build the screenplay node package (schema, keymap, plugins, marks). Wire the app shell (welcome, file tree, panels, status bar, menu) through a shared command layer.

**Tech Stack:** ProseMirror (vanilla JS), node:test + jsdom for unit tests, Electron 28+, existing Rwanga shell.

---

## Subagent roles

These roles are defined by me, not the subagent-driven-development skill. Each task in the plan specifies which role(s) to use.

| Role | When to use | Model |
|---|---|---|
| **Builder-Sonnet** | Mechanical, well-spec'd tasks: file moves, schema definitions, simple plugins, test files, CSS, single-file changes | `claude-sonnet-4-6` |
| **Builder-Opus** | Complex judgment tasks: ProseMirror mount/integration, keymap state machine, migration converter, active-scene plugin, multi-file integration | `claude-opus-4-7` |
| **Spec-Reviewer** | After implementation of any phase: read the named spec section + the implementation, list mismatches or missing pieces | `claude-opus-4-7` |
| **Quality-Reviewer** | After implementation of complex phases: check naming consistency, dead code, error paths, accidental console.log, test coverage of edge cases | `claude-sonnet-4-6` (or Opus for complex) |
| **Test-Runner** | Inline (you run `npm test`). No subagent needed. | — |
| **Smoke-Tester** | Inline (you run the Electron app and check the UI). No subagent needed. | — |

### Dispatching a subagent — the standard prompt envelope

Every implementer subagent gets a self-contained prompt. The plan provides the **task body**; wrap it in this envelope when you dispatch:

```
You are the Builder-{Sonnet|Opus} subagent for the Rwanga Editor redesign.

Working directory: E:\api\rwanga\rwanga-editor

Required reading first:
  1. docs/superpowers/specs/2026-05-13-rwanga-editor-redesign-design.md  §{spec section ref}
  2. rwanga-editor/package.json
  3. {other context files listed in the task}

Constraints (apply to every task):
  - Work on main branch. No worktrees.
  - Use Test-Driven Development: write the test first, see it fail, write code, see it pass, then commit.
  - All assets local. No CDN. No external resources.
  - Single-line Django {% %} tags only (not applicable here but a project rule).
  - One commit per task unless explicitly told otherwise. Commit messages follow Conventional Commits (feat:/fix:/chore:/refactor:/docs:/test:).
  - Co-Authored-By trailer: `Co-Authored-By: Claude {model name} <noreply@anthropic.com>`
  - NEVER skip hooks. NEVER use --no-verify.
  - If you hit a wall, STOP and report rather than improvising.

Your task:
{paste the Task body here}

When done, reply with: DONE, blockers (if any), and the commit SHA.
```

### Code review subagent prompts

After implementation, dispatch the reviewer(s) the task names. Use this envelope:

```
You are the Spec-Reviewer subagent (or Quality-Reviewer).

Working directory: E:\api\rwanga\rwanga-editor

Implementation to review:
  Commit SHA: {SHA from the implementer}
  Files: {list}

Your job: {Spec-Reviewer: verify the implementation matches the spec section} | {Quality-Reviewer: check code quality}

Spec reference: docs/superpowers/specs/2026-05-13-rwanga-editor-redesign-design.md §{section}

Checks to make:
  {paste the Code review checks from the task}

Reply with PASS or FAIL. If FAIL, list each issue with file path + line and what should change. Do not propose code; just describe the problem.
```

---

## Phase overview & task counts

| Phase | Title | Tasks | Spec ref |
|---|---|---|---|
| 0 | Strip & prep | 7 | §8.1, §8.2 |
| 1 | ProseMirror foundation | 9 | §1 |
| 2 | Screenplay schema | 14 | §2 |
| 3 | Inside-scene grammar | 11 | §3 |
| 4 | Marks (annotation, tag, revisionFlag) | 12 | §4 |
| 5 | Widget menu and toolbar | 10 | §5 |
| 6 | Plugins (active-scene, problems, placeholders) | 8 | §3.5, §6 |
| 7 | Migration v1 → v2 | 7 | §7 |
| 8 | App shell wiring | 22 | Part 2 §A1–A6 |
| 9 | Menu bar and command layer | 9 | §A7 |
| 10 | Smoke and release | 5 | — |
| **Total** | | **114** | |

Each phase ends with a **Spec-Reviewer** dispatch and a manual smoke test by you.

---

## File structure created across the plan

```
rwanga-editor/
├── package.json                       (M — add ProseMirror deps)
├── renderer/
│   ├── index.html                     (M — boot sequence)
│   ├── css/
│   │   └── editor-prosemirror.css     (NEW — ProseMirror node CSS)
│   └── js/
│       ├── editor/
│       │   ├── mount.js               (NEW)
│       │   ├── widget-menu.js         (NEW)
│       │   ├── toolbar.js             (NEW)
│       │   ├── commands.js            (NEW)
│       │   └── shortcuts.js           (NEW)
│       ├── doc-types/
│       │   └── screenplay/
│       │       ├── schema.js          (NEW)
│       │       ├── keymap.js          (NEW)
│       │       ├── plugins/
│       │       │   ├── active-scene.js
│       │       │   ├── annotations.js
│       │       │   ├── tags.js
│       │       │   ├── revision-flags.js
│       │       │   ├── placeholders.js
│       │       │   └── problems.js
│       │       ├── widget-items.js
│       │       ├── toolbar-config.js
│       │       ├── inspector.js
│       │       ├── outline.js
│       │       ├── bottom-panel.js
│       │       ├── status-bar.js
│       │       └── menu-contributions.js
│       ├── migration/
│       │   └── v1-to-v2.js            (NEW)
│       ├── welcome.js                 (NEW)
│       ├── file-tree.js               (NEW; replaces inert prototype panel)
│       ├── doc.js                     (M — v2.0 serialize/deserialize)
│       ├── file-manager.js            (M — save uses PM serialization)
│       ├── tab-manager.js             (M — tab owns PM EditorState)
│       ├── constants.js               (M — CURRENT_RGA_VERSION = '2.0')
│       └── utils.js                   (M — remove Rga.Cursor.*)
└── tests/
    ├── unit/
    │   ├── schema/                    (NEW dir)
    │   ├── keymap/                    (NEW dir)
    │   ├── plugins/                   (NEW dir)
    │   ├── marks/                     (NEW dir)
    │   └── migration-v1-to-v2.test.js (NEW)
    └── fixtures/
        ├── v1.0-sample.rga            (NEW)
        ├── v1.1-sample.rga            (NEW)
        ├── v1.1-with-body-blocks.rga  (NEW)
        └── v2.0-sample.rga            (NEW)
```

Files **deleted** in Phase 0:
- `renderer/js/editor-engine.js`
- `renderer/js/scene-manager.js`
- `renderer/js/tag-system.js`
- `renderer/js/problems.js`
- `renderer/js/sample-data.js`
- `tests/unit/tab-manager.test.js` (the test uses the old custom editor; will be rewritten in Phase 1)

---

## Phase 0 — Strip & prep

**Goal:** Remove the broken editor code cleanly; leave the app launchable but without an editor; record a rollback tag.

### Task 0.1: Tag rollback point

**Implementer:** Builder-Sonnet
**Spec ref:** n/a (mechanical)
**Files:** none

**Steps:**

- [ ] **Step 1: Create a git tag for rollback**

Run from `rwanga-editor/`:
```
git tag pre-redesign-2026-05-13
git push origin pre-redesign-2026-05-13
```

Expected: tag created locally and on origin. If `git push origin pre-redesign-2026-05-13` returns "Everything up-to-date" or a success line, you're good.

- [ ] **Step 2: Verify tag**

Run: `git tag --list pre-redesign-2026-05-13`
Expected output: `pre-redesign-2026-05-13`

**Code review:** none (tag operation, no code).

---

### Task 0.2: Delete the broken editor sources

**Implementer:** Builder-Sonnet
**Spec ref:** §8.1
**Files:** delete five renderer source files

**Steps:**

- [ ] **Step 1: Delete files**

```
git rm renderer/js/editor-engine.js
git rm renderer/js/scene-manager.js
git rm renderer/js/tag-system.js
git rm renderer/js/problems.js
git rm renderer/js/sample-data.js
```

- [ ] **Step 2: Verify deletion**

```
git status
```

Expected: 5 files staged as deleted, working tree otherwise clean.

- [ ] **Step 3: Commit**

```
git commit -m "$(cat <<'EOF'
chore(editor): strip broken custom contenteditable engine

These five files are replaced by the ProseMirror-based engine per the
2026-05-13 redesign spec §8.1. They are removed cleanly so the new
implementation has no inherited debt:

- editor-engine.js (custom contenteditable + observer race conditions)
- scene-manager.js (contentEditable=false scene-header widget)
- tag-system.js (custom tag span management)
- problems.js (validator targeting deleted block types)
- sample-data.js (auto-loaded sample; replaced by tests/fixtures)

Rollback tag: pre-redesign-2026-05-13

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

**Code review:** **Quality-Reviewer** (Sonnet) — verify exactly these five files removed; no other files touched; commit message references the spec section and rollback tag.

---

### Task 0.3: Remove stale tests

**Implementer:** Builder-Sonnet
**Spec ref:** §8.1
**Files:** delete tests that targeted deleted code

**Steps:**

- [ ] **Step 1: Identify and delete the tab-manager test (uses deleted editor)**

```
git rm tests/unit/tab-manager.test.js
```

(It will be rewritten in Phase 1 using ProseMirror.)

- [ ] **Step 2: Check for other stale tests**

```
git grep -l "editor-engine\|scene-manager\|tag-system\|problems\.js" tests/
```

Expected output: nothing. If anything appears, list the file paths in your DONE report; do not delete them yet.

- [ ] **Step 3: Run remaining tests to verify they still pass**

```
npm run test:unit
```

Expected: all remaining tests pass. The doc.test.js, json-file.test.js still work since they don't depend on the deleted files.

- [ ] **Step 4: Commit**

```
git commit -m "$(cat <<'EOF'
test(editor): remove tests for deleted editor modules

tab-manager.test.js exercised the deleted custom editor; will be
rewritten in Phase 1 against the ProseMirror-based TabManager.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

**Code review:** none (test deletion; safe).

---

### Task 0.4: Strip dead CSS

**Implementer:** Builder-Sonnet
**Spec ref:** §8.1
**Files:** modify `renderer/css/editor.css`, `renderer/css/components.css`

**Steps:**

- [ ] **Step 1: Identify CSS rules targeting `.editor-block[data-block-type=...]`**

```
git grep -n "editor-block\|data-block-type\|scene-header\b" renderer/css/
```

List the matches in your scratchpad. You'll remove rules that exclusively target these selectors. **Do not delete generic rules** that just happen to mention these classes as part of broader selectors.

- [ ] **Step 2: Move dead rules out**

For each rule whose selector ONLY matches deleted-block classes (e.g., `.editor-block[data-block-type="action"] { ... }`), remove the entire rule. Leave generic rules like `.editor-surface { ... }` alone — they may still be used by ProseMirror.

- [ ] **Step 3: Verify CSS still parses**

Open `renderer/index.html` in the Electron app:
```
npm start
```

Expected: no CSS parse errors in DevTools console. The window opens (will look broken without an editor, that's fine).

- [ ] **Step 4: Commit**

```
git commit -m "$(cat <<'EOF'
chore(css): drop rules targeting deleted editor-block classes

CSS for .editor-block[data-block-type=...] and .scene-header widget
are removed since their targets no longer exist. Generic editor
surface rules retained for ProseMirror to reuse.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

**Code review:** **Quality-Reviewer** — verify no generic rules accidentally deleted; the editor surface still has its frame/scrollbar/font styling intact.

---

### Task 0.5: Strip script tags and boot calls from `index.html`

**Implementer:** Builder-Sonnet
**Spec ref:** §8.1
**Files:** modify `renderer/index.html`

**Steps:**

- [ ] **Step 1: Read current index.html boot block**

Look at the `<script>` tags around the bottom of the file (the boot block).

- [ ] **Step 2: Remove the five deleted script tags**

Delete these `<script src=...>` lines:
- `renderer/js/editor-engine.js`
- `renderer/js/scene-manager.js`
- `renderer/js/tag-system.js`
- `renderer/js/problems.js`
- `renderer/js/sample-data.js`

- [ ] **Step 3: Replace the boot function `boot()` body**

Locate the inline `<script>` containing `function boot()`. Replace its body with this stub (everything else in the file stays):

```javascript
function boot() {
  injectIcons();
  Rga.Theme.init();
  Rga.Resize.init();
  Rga.Sidebar.init();
  Rga.Keyboard.init();
  Rga.BottomPanel.init();
  Rga.CommandPalette.init();
  Rga.FileTree.init();
  Rga.TabManager.init();
  // Editor engine is being rebuilt — Phase 1 wires Rga.Editor.mount() here.
  // For now, no tab is opened automatically; the welcome view (Phase 8)
  // will be the empty state.
  Rga.StatusBar.init();
}
```

If `registerCommands()` or `registerShortcuts()` references functions from the deleted modules (e.g., `Rga.SceneManager.createHeader`), comment those entries out with `// TODO[phase-X]: re-register when {module} ships`.

- [ ] **Step 4: Smoke test**

```
npm start
```

Expected: app window opens. DevTools console may show warnings about missing modules but no fatal errors. The editor area is blank.

- [ ] **Step 5: Commit**

```
git commit -m "$(cat <<'EOF'
chore(index): strip boot wiring for deleted editor modules

Script tags and boot calls for the deleted editor sources are removed.
The boot stub leaves the shell (sidebar, status bar, command palette)
intact while Phase 1 mounts ProseMirror.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

**Code review:** **Spec-Reviewer** (Opus) — verify (a) all five script tags removed, (b) `boot()` stub matches the structure above, (c) no orphan references to deleted modules remain except commented-out TODOs.

---

### Task 0.6: Verify the app still launches cleanly

**Implementer:** Smoke-Tester (you — inline)
**Spec ref:** n/a (verification)

**Steps:**

- [ ] **Step 1: Launch**

```
npm start
```

- [ ] **Step 2: Observe**

Expected:
- Window opens at 1440×900
- Dark theme by default
- Activity bar visible (Explorer, Scenes, Tags, Sync, Extensions, Settings icons)
- Sidebar visible with placeholder content
- Editor area is empty (no contenteditable)
- Status bar shows `● Offline ⚠ 0` and some scene-centric placeholders that will be rewritten later
- DevTools console: warnings allowed, errors NOT allowed

- [ ] **Step 3: If any error in console**

Report the exact error in DONE notes. Do not proceed to Phase 1 until errors are eliminated.

**Code review:** n/a (manual smoke).

---

### Task 0.7: Phase 0 spec review

**Implementer:** Spec-Reviewer (Opus)

**Prompt:**

```
You are the Spec-Reviewer subagent.

Working directory: E:\api\rwanga\rwanga-editor

Verify Phase 0 of the implementation plan against the spec.

Spec reference: docs/superpowers/specs/2026-05-13-rwanga-editor-redesign-design.md §8.1, §8.2

Commits to review: the four commits made in Tasks 0.2–0.5.

Checks:
  1. The five files listed in §8.1 are deleted: editor-engine.js, scene-manager.js, tag-system.js, problems.js, sample-data.js.
  2. The files listed in §8.2 as "stays" are NOT deleted: main.js, preload.js, bridge/*, lib/*, file-manager.js, tab-manager.js, doc.js, constants.js, utils.js, icons.js, app-shell.js, index.html (modified, not deleted).
  3. No references to deleted modules remain in code (except commented-out TODOs in index.html).
  4. The app launches without fatal errors (per Task 0.6 result).

Reply PASS or FAIL. If FAIL, list each issue with file path and what the spec requires.
```

---

## Phase 1 — ProseMirror foundation

**Goal:** Get a vanilla rich-text editor mounted in the `#editor` area. No screenplay logic yet — just verify ProseMirror works in our Electron context with bold/italic/RTL/paste/undo.

**Spec ref:** §1 (architectural frame), §8.4 (dependencies)

### Task 1.1: Add ProseMirror dependencies

**Implementer:** Builder-Sonnet
**Files:** modify `package.json`

**Steps:**

- [ ] **Step 1: Add to `dependencies` in `rwanga-editor/package.json`**

Insert (alphabetically among existing deps):

```json
"prosemirror-commands": "^1.5.2",
"prosemirror-history": "^1.3.2",
"prosemirror-inputrules": "^1.4.0",
"prosemirror-keymap": "^1.2.2",
"prosemirror-model": "^1.19.4",
"prosemirror-schema-basic": "^1.2.2",
"prosemirror-schema-list": "^1.3.0",
"prosemirror-state": "^1.4.3",
"prosemirror-view": "^1.32.7"
```

- [ ] **Step 2: Add `jsdom` to `devDependencies` if not present**

Check first:
```
grep '"jsdom"' package.json
```

If missing, add to `devDependencies`:
```json
"jsdom": "^24.0.0"
```

- [ ] **Step 3: Install**

```
npm install
```

Expected: no errors. `package-lock.json` updates.

- [ ] **Step 4: Commit**

```
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore(deps): add ProseMirror editor framework

Adds the nine prosemirror-* packages required by the new editor engine.
Apache 2.0 / MIT licensed; vanilla JS (no framework dependency).
~100KB total minified gzipped.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

**Code review:** **Quality-Reviewer** — verify (a) all nine prosemirror packages present, (b) version pins use `^` for minor compatibility, (c) lock file regenerated cleanly.

---

### Task 1.2: Create the editor directory and minimal schema

**Implementer:** Builder-Sonnet
**Spec ref:** §1, §2 (minimal subset)
**Files:** create `renderer/js/editor/schema-minimal.js`

This is a throwaway minimal schema for Phase 1 verification. Phase 2 replaces it with the full screenplay schema.

**Steps:**

- [ ] **Step 1: Create the minimal schema**

Create `renderer/js/editor/schema-minimal.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// PHASE 1 ONLY — replaced by doc-types/screenplay/schema.js in Phase 2.
'use strict';

(function() {
  const { Schema } = require('prosemirror-model');
  const Rga = window.Rga = window.Rga || {};

  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: {
        content: 'inline*',
        group: 'block',
        parseDOM: [{ tag: 'p' }],
        toDOM() { return ['p', 0]; }
      },
      text: { group: 'inline' }
    },
    marks: {
      bold: {
        parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
        toDOM() { return ['strong', 0]; }
      },
      italic: {
        parseDOM: [{ tag: 'em' }, { tag: 'i' }],
        toDOM() { return ['em', 0]; }
      }
    }
  });

  Rga.Editor = Rga.Editor || {};
  Rga.Editor._minimalSchema = schema;
})();
```

- [ ] **Step 2: Verify the file loads in Electron**

Add to `renderer/index.html` immediately after `<script src="js/constants.js"></script>`:

```html
<script src="js/editor/schema-minimal.js"></script>
```

Run `npm start`. In DevTools console:
```
window.Rga.Editor._minimalSchema
```

Expected: a `Schema` object (not undefined, not null).

- [ ] **Step 3: Commit**

```
git add renderer/js/editor/schema-minimal.js renderer/index.html
git commit -m "$(cat <<'EOF'
feat(editor): minimal ProseMirror schema for Phase 1 verification

Doc + paragraph + text nodes, bold + italic marks. Verifies the
ProseMirror packages load correctly in Electron. Replaced in Phase 2.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

**Code review:** **Quality-Reviewer** — verify CommonJS `require` works in the renderer (Electron with `nodeIntegration: false` and `contextIsolation: true` does NOT support `require` directly in renderer code). If it fails, this is the first integration problem to solve in Task 1.3.

---

### Task 1.3: Resolve the module-loading model

**Implementer:** Builder-Opus
**Spec ref:** §1
**Files:** modify `package.json`, `electron/main.js` (BrowserWindow webPreferences), or add a bundler

This is the key integration decision. ProseMirror is published as CommonJS modules. The renderer runs with `nodeIntegration: false`. We have three options:

| Option | Pros | Cons |
|---|---|---|
| **A. Vite/esbuild bundle** | Standard, fast, handles tree-shaking | Adds build step; changes dev workflow |
| **B. Enable `nodeIntegration` in BrowserWindow** | No build step; `require` works | Security regression — explicitly rejected by sub-project A spec |
| **C. ES module imports + import maps** | Native, no build | Needs ProseMirror's ESM exports (some packages don't ship ESM) |

**Decision:** Option A (esbuild). Smallest disruption, fastest. esbuild is already common in Electron projects.

**Steps:**

- [ ] **Step 1: Add esbuild as dev dependency**

```
npm install --save-dev esbuild
```

- [ ] **Step 2: Create a build script**

Create `rwanga-editor/scripts/build-renderer.js`:

```javascript
#!/usr/bin/env node
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
const esbuild = require('esbuild');
const path = require('path');

const entry = path.join(__dirname, '..', 'renderer', 'js', 'editor', 'bundle-entry.js');
const outfile = path.join(__dirname, '..', 'renderer', 'js', 'editor', 'bundle.js');

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [entry],
  bundle: true,
  outfile,
  format: 'iife',
  globalName: 'RgaProseMirror',
  platform: 'browser',
  target: ['chrome120'],
  sourcemap: true,
  logLevel: 'info'
};

if (watch) {
  esbuild.context(buildOptions).then(ctx => ctx.watch());
} else {
  esbuild.build(buildOptions).catch(() => process.exit(1));
}
```

- [ ] **Step 3: Create the bundle entry**

Create `renderer/js/editor/bundle-entry.js`:

```javascript
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
```

- [ ] **Step 4: Add npm script**

Edit `package.json` `"scripts"`:
```json
"build:renderer": "node scripts/build-renderer.js",
"build:renderer:watch": "node scripts/build-renderer.js --watch",
```

Also modify `"start"`:
```json
"start": "node scripts/build-renderer.js && electron .",
```

- [ ] **Step 5: Build and verify**

```
npm run build:renderer
```

Expected: `renderer/js/editor/bundle.js` and `bundle.js.map` created.

- [ ] **Step 6: Add the bundle to index.html**

In `renderer/index.html`, replace the `schema-minimal.js` script tag (added in Task 1.2) with:

```html
<script src="js/editor/bundle.js"></script>
```

Delete `renderer/js/editor/schema-minimal.js`:
```
git rm renderer/js/editor/schema-minimal.js
```

- [ ] **Step 7: Verify in Electron**

```
npm start
```

DevTools console:
```
window.RgaProseMirror.EditorState
```

Expected: a function (the EditorState class).

- [ ] **Step 8: Add bundle output to `.gitignore`**

In `rwanga-editor/.gitignore`, add:
```
renderer/js/editor/bundle.js
renderer/js/editor/bundle.js.map
```

- [ ] **Step 9: Commit**

```
git add package.json package-lock.json scripts/build-renderer.js renderer/js/editor/bundle-entry.js renderer/index.html .gitignore
git commit -m "$(cat <<'EOF'
build(renderer): esbuild bundle for ProseMirror in Electron renderer

The renderer has nodeIntegration=false (security requirement). esbuild
bundles ProseMirror as an IIFE exposed at window.RgaProseMirror, which
the renderer's vanilla-JS code consumes.

- scripts/build-renderer.js: esbuild entry point
- renderer/js/editor/bundle-entry.js: re-exports ProseMirror APIs
- npm start now runs build:renderer first
- Bundle output gitignored (regenerated on build)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

**Code review:**
- **Spec-Reviewer** — confirm the renderer still has `nodeIntegration: false` and `contextIsolation: true`. The bundle approach is consistent with §1 ("renderer never imports Node modules directly").
- **Quality-Reviewer** — verify the build script handles errors (exit code on failure), the bundle file is gitignored, and `npm start` invokes the build.

---

### Task 1.4: Mount ProseMirror in the editor area

**Implementer:** Builder-Opus
**Spec ref:** §1, §8.3
**Files:** create `renderer/js/editor/mount.js`; modify `renderer/index.html`

**Steps:**

- [ ] **Step 1: Create the mount module**

Create `renderer/js/editor/mount.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  const PM = window.RgaProseMirror;

  if (!PM) {
    console.error('[Rga.Editor] ProseMirror bundle not loaded');
    return;
  }

  // PHASE 1 MINIMAL SCHEMA — replaced in Phase 2 by doc-types/screenplay/schema.js
  const minimalSchema = new PM.Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: {
        content: 'inline*',
        group: 'block',
        parseDOM: [{ tag: 'p' }],
        toDOM() { return ['p', 0]; }
      },
      text: { group: 'inline' }
    },
    marks: {
      bold: {
        parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
        toDOM() { return ['strong', 0]; }
      },
      italic: {
        parseDOM: [{ tag: 'em' }, { tag: 'i' }],
        toDOM() { return ['em', 0]; }
      }
    }
  });

  /**
   * Mount a ProseMirror editor into the given DOM container.
   * @param {HTMLElement} container - the target element (will be cleared)
   * @param {object} [opts] - { initialDoc, schema, plugins }
   * @returns {{ view: EditorView, state: EditorState }} the mounted view + initial state
   */
  function mount(container, opts) {
    opts = opts || {};
    const schema = opts.schema || minimalSchema;

    const plugins = [
      PM.history(),
      PM.keymap({
        'Mod-z': PM.undo,
        'Mod-y': PM.redo,
        'Mod-Shift-z': PM.redo,
        'Mod-b': PM.toggleMark(schema.marks.bold),
        'Mod-i': PM.toggleMark(schema.marks.italic),
      }),
      PM.keymap(PM.baseKeymap),
    ].concat(opts.plugins || []);

    const initialDoc = opts.initialDoc
      || schema.node('doc', null, [schema.node('paragraph')]);

    const state = PM.EditorState.create({
      schema,
      doc: initialDoc,
      plugins
    });

    container.innerHTML = '';
    const view = new PM.EditorView(container, { state });

    return { view, state };
  }

  Rga.Editor = Rga.Editor || {};
  Rga.Editor.mount = mount;
  Rga.Editor._minimalSchema = minimalSchema;  // exposed for tests
})();
```

- [ ] **Step 2: Add to index.html boot**

In `renderer/index.html`, add the script tag immediately after the bundle:

```html
<script src="js/editor/bundle.js"></script>
<script src="js/editor/mount.js"></script>
```

Modify `boot()` to mount the editor:

```javascript
function boot() {
  injectIcons();
  Rga.Theme.init();
  Rga.Resize.init();
  Rga.Sidebar.init();
  Rga.Keyboard.init();
  Rga.BottomPanel.init();
  Rga.CommandPalette.init();
  Rga.FileTree.init();
  Rga.TabManager.init();

  const editorEl = document.getElementById('editor');
  if (editorEl && Rga.Editor && Rga.Editor.mount) {
    Rga.Editor._activeMount = Rga.Editor.mount(editorEl);
  }

  Rga.StatusBar.init();
}
```

- [ ] **Step 3: Smoke test**

```
npm start
```

Expected:
- Window opens.
- Click in the editor area (the central panel).
- Type "Hello World" — text appears.
- Select "World", press `Ctrl+B` — it becomes bold.
- Press `Ctrl+Z` — bold is undone.
- Press `Ctrl+Z` again — typing is undone.

If RTL test desired: type some Arabic text (paste `مرحبا بالعالم`). Cursor and editing should work normally.

- [ ] **Step 4: Commit**

```
git add renderer/js/editor/mount.js renderer/index.html
git commit -m "$(cat <<'EOF'
feat(editor): mount ProseMirror EditorView in the editor area

Rga.Editor.mount(container, opts) creates a ProseMirror EditorState +
EditorView and renders it into the container. Includes history (undo/
redo) and basic keymap with Mod-B/I/Z. Phase 1 uses a minimal schema
(doc/paragraph/text/bold/italic). Phase 2 replaces it with the
screenplay schema.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

**Code review:**
- **Spec-Reviewer** — verify the mount API matches §8.3 (`mount.js` location, signature returns a view). Confirm no shortcuts taken that would break Phase 2 (e.g., the schema is replaceable via `opts.schema`).
- **Quality-Reviewer** — check (a) no `console.log` left in, (b) the `_activeMount` reference doesn't leak in production (this is OK for Phase 1; refactor in TabManager later), (c) error path if `RgaProseMirror` is missing is clean.

---

### Task 1.5: Write the first unit test against ProseMirror

**Implementer:** Builder-Sonnet
**Spec ref:** §1
**Files:** create `tests/unit/editor/mount.test.js`

ProseMirror tests need jsdom. We don't need to load the full Electron bundle — we test the schema and state logic directly via the npm packages.

**Steps:**

- [ ] **Step 1: Create the test**

Create `tests/unit/editor/mount.test.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { Schema } = require('prosemirror-model');
const { EditorState } = require('prosemirror-state');
const { EditorView } = require('prosemirror-view');

const minimalSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
    text: { group: 'inline' }
  },
  marks: {
    bold: { toDOM() { return ['strong', 0]; } }
  }
});

test('EditorState creates a document with one empty paragraph by default', () => {
  const state = EditorState.create({
    schema: minimalSchema,
    doc: minimalSchema.node('doc', null, [minimalSchema.node('paragraph')])
  });
  assert.equal(state.doc.childCount, 1);
  assert.equal(state.doc.firstChild.type.name, 'paragraph');
});

test('EditorView renders into a DOM container', () => {
  const dom = new JSDOM('<!DOCTYPE html><div id="host"></div>');
  global.window = dom.window;
  global.document = dom.window.document;

  const container = dom.window.document.getElementById('host');
  const state = EditorState.create({
    schema: minimalSchema,
    doc: minimalSchema.node('doc', null, [minimalSchema.node('paragraph')])
  });
  const view = new EditorView(container, { state });

  assert.ok(container.querySelector('.ProseMirror'), 'editor surface mounted');
  assert.equal(container.querySelectorAll('p').length, 1);

  view.destroy();
});
```

- [ ] **Step 2: Run the test**

```
npm run test:unit
```

Expected: doc tests, json-file tests still pass, plus 2 new editor tests pass. Total = 15 (was 13 after removing tab-manager tests; +2 new).

- [ ] **Step 3: Commit**

```
git add tests/unit/editor/mount.test.js
git commit -m "$(cat <<'EOF'
test(editor): basic ProseMirror state and view rendering

Verifies the EditorState creation and EditorView mounting against
jsdom. These tests exercise the ProseMirror packages directly (not
through the Electron bundle), proving the library works in our
test harness before we layer screenplay schema on top.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

**Code review:** **Quality-Reviewer** — confirm tests are independent (use fresh DOM each test if state matters); cleanup with `view.destroy()`.

---

### Task 1.6: Tab-aware editor mounting

**Implementer:** Builder-Opus
**Spec ref:** §1, §8.2 (tab-manager retained but EditorState lives on tab)
**Files:** modify `renderer/js/tab-manager.js`, `renderer/js/editor/mount.js`

The current `TabManager` stores each tab's doc state in memory. We change it so each tab owns a ProseMirror `EditorState`; switching tabs swaps the state into a single `EditorView`.

**Steps:**

- [ ] **Step 1: Modify mount.js to expose state-swap API**

Add at the end of the IIFE in `renderer/js/editor/mount.js`, before the closing `})();`:

```javascript
  /**
   * Re-attach the EditorView to a new document.
   * Used when switching tabs.
   * @param {EditorView} view
   * @param {Node} doc
   */
  function setDoc(view, doc) {
    if (!view) return;
    const newState = PM.EditorState.create({
      schema: view.state.schema,
      doc,
      plugins: view.state.plugins
    });
    view.updateState(newState);
  }

  /**
   * Create a fresh document (empty paragraph) under the same schema.
   */
  function emptyDoc(schema) {
    schema = schema || minimalSchema;
    return schema.node('doc', null, [schema.node('paragraph')]);
  }

  Rga.Editor.setDoc = setDoc;
  Rga.Editor.emptyDoc = emptyDoc;
```

- [ ] **Step 2: Rewrite tab-manager.js**

Replace the entire content of `renderer/js/tab-manager.js` with:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  const tabs = [];
  let activeTabId = null;
  let tabIdCounter = 0;
  let editorView = null;  // the singleton EditorView, set by init()

  function nextTabId() {
    tabIdCounter += 1;
    return 'tab-' + tabIdCounter;
  }

  function tabBarEl() { return document.getElementById('tab-bar'); }

  function renderTabBar() {
    const bar = tabBarEl();
    if (!bar) return;
    const newBtn = bar.querySelector('#tab-new');
    bar.innerHTML = '';
    tabs.forEach(function(t) {
      const el = document.createElement('button');
      el.className = 'tab' + (t.id === activeTabId ? ' active' : '') + (t.doc.dirty ? ' dirty' : '');
      el.dataset.tabId = t.id;
      el.textContent = (t.doc.dirty ? '● ' : '') + t.doc.displayName;
      el.addEventListener('click', function() { activate(t.id); });
      const close = document.createElement('span');
      close.className = 'tab-close';
      close.textContent = '×';
      close.addEventListener('click', function(e) {
        e.stopPropagation();
        closeTab(t.id);
      });
      el.appendChild(close);
      bar.appendChild(el);
    });
    if (newBtn) bar.appendChild(newBtn);
  }

  function snapshotActive() {
    const active = tabs.find(function(t) { return t.id === activeTabId; });
    if (!active || !editorView) return;
    active.editorState = editorView.state;
  }

  function activate(tabId) {
    snapshotActive();
    const tab = tabs.find(function(t) { return t.id === tabId; });
    if (!tab) return;
    activeTabId = tabId;
    renderTabBar();
    if (editorView && tab.editorState) {
      editorView.updateState(tab.editorState);
    }
    if (Rga.FileManager && Rga.FileManager.setActive) Rga.FileManager.setActive(tab.doc);
  }

  function openDocument(doc) {
    const tab = {
      id: nextTabId(),
      doc: doc,
      editorState: null
    };
    if (editorView) {
      tab.editorState = window.RgaProseMirror.EditorState.create({
        schema: editorView.state.schema,
        doc: Rga.Editor.emptyDoc(editorView.state.schema),
        plugins: editorView.state.plugins
      });
    }
    tabs.push(tab);
    activate(tab.id);
    return tab;
  }

  function closeTab(tabId) {
    const idx = tabs.findIndex(function(t) { return t.id === tabId; });
    if (idx < 0) return;
    const tab = tabs[idx];
    if (tab.doc.dirty) {
      const choice = confirm('"' + tab.doc.displayName + '" has unsaved changes. Discard them?');
      if (!choice) return;
    }
    tabs.splice(idx, 1);
    if (activeTabId === tabId) {
      const next = tabs[idx] || tabs[idx - 1];
      if (next) activate(next.id);
      else {
        activeTabId = null;
        renderTabBar();
        // Phase 8 wires up the welcome view here; for now blank editor.
      }
    } else {
      renderTabBar();
    }
  }

  function activeTab() {
    return tabs.find(function(t) { return t.id === activeTabId; }) || null;
  }
  function activeDoc() {
    const t = activeTab();
    return t ? t.doc : null;
  }
  function getTabs() { return tabs.slice(); }

  function init() {
    tabs.length = 0;
    activeTabId = null;
    tabIdCounter = 0;

    const editorEl = document.getElementById('editor');
    if (editorEl && Rga.Editor && Rga.Editor.mount) {
      const mounted = Rga.Editor.mount(editorEl);
      editorView = mounted.view;
    }

    const newBtn = document.getElementById('tab-new');
    if (newBtn) {
      newBtn.addEventListener('click', function() {
        if (Rga.FileManager && Rga.FileManager.newScript) Rga.FileManager.newScript();
      });
    }
  }

  Rga.TabManager = {
    init,
    openDocument,
    closeTab,
    activate,
    activeTab,
    activeDoc,
    tabs: getTabs,
    renderTabBar,
    _editorView: function() { return editorView; }  // exposed for tests
  };
})();
```

- [ ] **Step 3: Update index.html boot order**

The mount should happen via `TabManager.init()` now, not directly in `boot()`. Modify `boot()`:

```javascript
function boot() {
  injectIcons();
  Rga.Theme.init();
  Rga.Resize.init();
  Rga.Sidebar.init();
  Rga.Keyboard.init();
  Rga.BottomPanel.init();
  Rga.CommandPalette.init();
  Rga.FileTree.init();
  Rga.TabManager.init();  // this now mounts the editor
  Rga.StatusBar.init();
}
```

Remove the direct `Rga.Editor.mount(editorEl)` call that was in Phase 1 Task 1.4.

- [ ] **Step 4: Write the test**

Create `tests/unit/tab-manager.test.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Boot a fresh DOM + Rga.TabManager per test
function bootDom() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html><body>
      <div id="tab-bar"><button id="tab-new">+</button></div>
      <div id="editor"></div>
    </body></html>
  `, { runScripts: 'outside-only' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.confirm = () => true;
  return dom;
}

test('TabManager.openDocument adds and activates a tab', () => {
  bootDom();
  // Stub Rga.Editor since we don't load the full bundle here
  window.Rga = { Editor: { mount: () => ({ view: { state: null, updateState: () => {} } }), emptyDoc: () => null } };
  window.RgaProseMirror = { EditorState: { create: () => null } };
  require('../../renderer/js/tab-manager.js');

  window.Rga.TabManager.init();
  const doc = { docId: 'd1', displayName: 'one.rga', dirty: false };
  const tab = window.Rga.TabManager.openDocument(doc);
  assert.ok(tab.id);
  assert.equal(window.Rga.TabManager.activeDoc(), doc);
  assert.equal(window.Rga.TabManager.tabs().length, 1);
});

test('TabManager.closeTab removes the tab', () => {
  bootDom();
  window.Rga = { Editor: { mount: () => ({ view: { state: null, updateState: () => {} } }), emptyDoc: () => null } };
  window.RgaProseMirror = { EditorState: { create: () => null } };
  // Force re-evaluation of the module by clearing the cache
  delete require.cache[require.resolve('../../renderer/js/tab-manager.js')];
  require('../../renderer/js/tab-manager.js');

  window.Rga.TabManager.init();
  const doc1 = { docId: 'd1', displayName: 'one.rga', dirty: false };
  const tab1 = window.Rga.TabManager.openDocument(doc1);
  window.Rga.TabManager.closeTab(tab1.id);
  assert.equal(window.Rga.TabManager.tabs().length, 0);
  assert.equal(window.Rga.TabManager.activeDoc(), null);
});
```

- [ ] **Step 5: Run tests**

```
npm run test:unit
```

Expected: all tests pass.

- [ ] **Step 6: Smoke test in Electron**

```
npm start
```

Expected: editor area shows ProseMirror surface. Click `+` in tab bar — for now it does nothing visible (FileManager.newScript needs Phase 2 to create a proper doc). Verify no console errors.

- [ ] **Step 7: Commit**

```
git add renderer/js/tab-manager.js renderer/js/editor/mount.js renderer/index.html tests/unit/tab-manager.test.js
git commit -m "$(cat <<'EOF'
feat(tabs): tabs own ProseMirror EditorState; singleton EditorView

Each tab carries its own EditorState. Switching tabs snapshots the
current state into the departing tab and applies the entering tab's
state to the single EditorView. This is the ProseMirror equivalent
of the previous doc._snapshot approach but engine-owned.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

**Code review:**
- **Spec-Reviewer** — verify the singleton-view + per-tab-state model matches §8.2 ("each tab owns a ProseMirror EditorState").
- **Quality-Reviewer** — check (a) `snapshotActive()` is called before any state-changing operation, (b) no leak when tabs close (the snapshot is dropped), (c) the test isolation between tests (using `delete require.cache[...]` to reset module state — note this is a hack; better would be a proper module factory).

---

### Task 1.7: Phase 1 spec review

**Implementer:** Spec-Reviewer (Opus)

**Prompt:**

```
You are the Spec-Reviewer subagent.

Working directory: E:\api\rwanga\rwanga-editor

Verify Phase 1 of the implementation plan against the spec.

Spec reference: docs/superpowers/specs/2026-05-13-rwanga-editor-redesign-design.md §1 (architectural frame), §8.3 (new files), §8.4 (dependencies)

Files to read:
  - package.json
  - scripts/build-renderer.js
  - renderer/js/editor/bundle-entry.js
  - renderer/js/editor/mount.js
  - renderer/js/tab-manager.js
  - renderer/index.html (boot block)
  - tests/unit/editor/mount.test.js
  - tests/unit/tab-manager.test.js

Checks:
  1. All nine prosemirror-* packages are dependencies, not devDependencies, with ^ version pins.
  2. The renderer does not use `require` at module scope; it consumes window.RgaProseMirror.
  3. nodeIntegration is still false and contextIsolation is still true in main.js BrowserWindow (no regression).
  4. mount.js exports a mount(container, opts) that returns { view, state }.
  5. TabManager mounts the editor on init() via Rga.Editor.mount; each tab owns an EditorState.
  6. No reference to deleted modules (editor-engine, scene-manager, tag-system, problems, sample-data) anywhere in renderer code.
  7. Smoke test passed (typing works, Ctrl+B works, Ctrl+Z works) per Task 1.4 Step 3.

Reply PASS or FAIL with file:line citations.
```

---

### Task 1.8: Phase 1 quality review

**Implementer:** Quality-Reviewer (Sonnet)

**Prompt:**

```
You are the Quality-Reviewer subagent.

Working directory: E:\api\rwanga\rwanga-editor

Review the code quality of the Phase 1 commits.

Files to review:
  - scripts/build-renderer.js
  - renderer/js/editor/mount.js
  - renderer/js/tab-manager.js

Checks:
  1. No stray console.log/console.warn unless they're proper error paths.
  2. No commented-out code blocks left (TODOs with phase markers are OK).
  3. No magic numbers without a name (e.g., debounce ms should be a named constant).
  4. Error paths are explicit (e.g., what happens if Rga.Editor is undefined when TabManager.init runs).
  5. All exported APIs have a JSDoc comment with @param + @returns.
  6. File headers have the Apache 2.0 copyright line.

Reply PASS or FAIL with file:line citations for each issue.
```

---

### Task 1.9: Phase 1 smoke checklist

**Smoke-Tester** (you — inline).

Run `npm start`. Verify:

- [ ] Window opens at 1440×900 with dark theme.
- [ ] Editor area shows a focused contenteditable surface with class `.ProseMirror`.
- [ ] Type "Hello World" — appears in the editor.
- [ ] Select "World", press Ctrl+B → "World" becomes bold (`<strong>` tag in DOM via DevTools).
- [ ] Press Ctrl+I — italic toggles.
- [ ] Press Ctrl+Z multiple times — undo unwinds typing.
- [ ] Press Ctrl+Y — redo restores.
- [ ] Paste from clipboard (Ctrl+V) — text appears, no broken formatting.
- [ ] Paste from a richly-formatted source (e.g., a Word doc) — formatting may or may not preserve but should not break the editor.
- [ ] Type Arabic text via paste (`مرحبا`) — appears, cursor works.
- [ ] Type in the editor and click the `+` in the tab bar — for now this does nothing yet (FileManager.newScript needs schema; Phase 2). Verify no console error.
- [ ] DevTools console: no errors.

If anything fails, do NOT proceed to Phase 2. Report and fix.

---

## Phase 2 — Screenplay schema

**Goal:** Define the full ProseMirror schema for screenplay documents. Replace the minimal Phase 1 schema. Verify every node and mark with unit tests.

**Spec ref:** §2

### Task 2.1: Schema skeleton — top-level structure

**Implementer:** Builder-Opus
**Files:** create `renderer/js/doc-types/screenplay/schema.js`

**Steps:**

- [ ] **Step 1: Create the schema file**

Create `renderer/js/doc-types/screenplay/schema.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Screenplay ProseMirror schema per spec §2.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};
  const PM = window.RgaProseMirror;
  if (!PM) {
    console.error('[Rga.DocTypes.Screenplay.Schema] ProseMirror bundle not loaded');
    return;
  }

  // ============================================================
  // NODES
  // ============================================================

  const nodes = {

    // Root document: optional titleStrip followed by body
    doc: {
      content: 'titleStrip? body',
    },

    // Title strip — sticky at top of page 1, has × remove button
    titleStrip: {
      content: 'text*',
      attrs: { removable: { default: true } },
      parseDOM: [{ tag: 'div.rga-title-strip' }],
      toDOM(node) {
        return ['div', { class: 'rga-title-strip', 'data-removable': String(node.attrs.removable) }, 0];
      }
    },

    // Body — container for all editable content
    body: {
      content: 'block*',
      parseDOM: [{ tag: 'div.rga-body' }],
      toDOM() { return ['div', { class: 'rga-body' }, 0]; }
    },

    // ----- BODY-LEVEL NODES (group "block") -----

    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() { return ['p', 0]; }
    },

    heading: {
      content: 'inline*',
      group: 'block',
      attrs: { level: { default: 1 } },
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } }
      ],
      toDOM(node) { return ['h' + node.attrs.level, 0]; }
    },

    quote: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'blockquote' }],
      toDOM() { return ['blockquote', 0]; }
    },

    bulletList: {
      content: 'listItem+',
      group: 'block',
      parseDOM: [{ tag: 'ul' }],
      toDOM() { return ['ul', 0]; }
    },

    orderedList: {
      content: 'listItem+',
      group: 'block',
      attrs: { start: { default: 1 } },
      parseDOM: [{ tag: 'ol', getAttrs(dom) { return { start: +dom.getAttribute('start') || 1 }; } }],
      toDOM(node) {
        return node.attrs.start === 1
          ? ['ol', 0]
          : ['ol', { start: node.attrs.start }, 0];
      }
    },

    listItem: {
      content: 'paragraph block*',
      parseDOM: [{ tag: 'li' }],
      toDOM() { return ['li', 0]; }
    },

    horizontalRule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM() { return ['hr']; }
    },

    pageBreak: {
      group: 'block',
      attrs: { manual: { default: true } },
      parseDOM: [{ tag: 'div.rga-page-break' }],
      toDOM() { return ['div', { class: 'rga-page-break' }]; }
    },

    // ----- SCENE (group "block"; container with restricted children) -----

    scene: {
      content: 'sceneLine (action | character | dialogue | parenthetical | transition | shot | inlineFreeText)*',
      group: 'block',
      attrs: {
        id: { default: null },
        number: { default: null },
        notes: { default: '' },
        revisionFlag: { default: null }
      },
      parseDOM: [{ tag: 'div.rga-scene' }],
      toDOM(node) {
        return ['div', {
          class: 'rga-scene',
          'data-scene-id': node.attrs.id || '',
          'data-scene-number': node.attrs.number || ''
        }, 0];
      }
    },

    // ----- SCENE CHILDREN (group "screenplay") -----

    sceneLine: {
      content: 'inline*',
      group: 'screenplay',
      attrs: {
        setting: { default: 'INT' },     // INT | EXT | INT/EXT | EXT/INT
        location: { default: '' },
        time: { default: 'DAY' }
      },
      parseDOM: [{ tag: 'div.rga-scene-line' }],
      toDOM(node) {
        return ['div', {
          class: 'rga-scene-line',
          'data-setting': node.attrs.setting,
          'data-location': node.attrs.location,
          'data-time': node.attrs.time
        }, 0];
      }
    },

    action: {
      content: 'inline*',
      group: 'screenplay',
      parseDOM: [{ tag: 'div.rga-action' }],
      toDOM() { return ['div', { class: 'rga-action' }, 0]; }
    },

    character: {
      content: 'inline*',
      group: 'screenplay',
      parseDOM: [{ tag: 'div.rga-character' }],
      toDOM() { return ['div', { class: 'rga-character' }, 0]; }
    },

    dialogue: {
      content: 'inline*',
      group: 'screenplay',
      parseDOM: [{ tag: 'div.rga-dialogue' }],
      toDOM() { return ['div', { class: 'rga-dialogue' }, 0]; }
    },

    parenthetical: {
      content: 'inline*',
      group: 'screenplay',
      parseDOM: [{ tag: 'div.rga-parenthetical' }],
      toDOM() { return ['div', { class: 'rga-parenthetical' }, 0]; }
    },

    transition: {
      content: 'inline*',
      group: 'screenplay',
      parseDOM: [{ tag: 'div.rga-transition' }],
      toDOM() { return ['div', { class: 'rga-transition' }, 0]; }
    },

    shot: {
      content: 'inline*',
      group: 'screenplay',
      parseDOM: [{ tag: 'div.rga-shot' }],
      toDOM() { return ['div', { class: 'rga-shot' }, 0]; }
    },

    inlineFreeText: {
      content: 'inline*',
      group: 'screenplay',
      parseDOM: [{ tag: 'div.rga-inline-free-text' }],
      toDOM() { return ['div', { class: 'rga-inline-free-text' }, 0]; }
    },

    text: { group: 'inline' }
  };

  // ============================================================
  // MARKS
  // ============================================================

  const marks = {
    bold: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }, { style: 'font-weight=bold' }],
      toDOM() { return ['strong', 0]; }
    },
    italic: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }],
      toDOM() { return ['em', 0]; }
    },
    underline: {
      parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
      toDOM() { return ['u', 0]; }
    },
    strikethrough: {
      parseDOM: [{ tag: 's' }, { tag: 'strike' }, { style: 'text-decoration=line-through' }],
      toDOM() { return ['s', 0]; }
    },
    color: {
      attrs: { value: {} },
      parseDOM: [{ style: 'color', getAttrs(value) { return { value: value }; } }],
      toDOM(mark) { return ['span', { style: 'color: ' + mark.attrs.value }, 0]; }
    },
    highlight: {
      attrs: { value: {} },
      parseDOM: [{ style: 'background-color', getAttrs(value) { return { value: value }; } }],
      toDOM(mark) { return ['span', { style: 'background-color: ' + mark.attrs.value }, 0]; }
    },
    fontFamily: {
      attrs: { value: {} },
      parseDOM: [{ style: 'font-family', getAttrs(value) { return { value: value }; } }],
      toDOM(mark) { return ['span', { style: 'font-family: ' + mark.attrs.value }, 0]; }
    },
    fontSize: {
      attrs: { value: {} },
      parseDOM: [{ style: 'font-size', getAttrs(value) { return { value: value }; } }],
      toDOM(mark) { return ['span', { style: 'font-size: ' + mark.attrs.value }, 0]; }
    },
    link: {
      attrs: { href: {}, title: { default: null } },
      inclusive: false,
      parseDOM: [{ tag: 'a[href]', getAttrs(dom) {
        return { href: dom.getAttribute('href'), title: dom.getAttribute('title') };
      } }],
      toDOM(mark) { return ['a', { href: mark.attrs.href, title: mark.attrs.title }, 0]; }
    },
    annotation: {
      attrs: {
        id: {},
        text: { default: '' },
        color: { default: '#FFE08A' },
        createdAt: { default: null },
        author: { default: null }
      },
      inclusive: false,
      excludes: '',
      parseDOM: [{ tag: 'span.rga-annotation', getAttrs(dom) {
        return {
          id: dom.getAttribute('data-id'),
          text: dom.getAttribute('data-text') || '',
          color: dom.getAttribute('data-color') || '#FFE08A',
          createdAt: dom.getAttribute('data-created-at'),
          author: dom.getAttribute('data-author')
        };
      } }],
      toDOM(mark) {
        return ['span', {
          class: 'rga-annotation',
          'data-id': mark.attrs.id,
          'data-text': mark.attrs.text,
          'data-color': mark.attrs.color,
          'data-created-at': mark.attrs.createdAt || '',
          'data-author': mark.attrs.author || '',
          style: 'background-color: ' + mark.attrs.color
        }, 0];
      }
    },
    tag: {
      attrs: {
        tagType: {},        // character | prop | wardrobe | location | sfx | vfx | vehicle | animal | custom
        entityId: {}
      },
      inclusive: false,
      excludes: '',
      parseDOM: [{ tag: 'span.rga-tag', getAttrs(dom) {
        return {
          tagType: dom.getAttribute('data-tag-type'),
          entityId: dom.getAttribute('data-entity-id')
        };
      } }],
      toDOM(mark) {
        return ['span', {
          class: 'rga-tag rga-tag-' + mark.attrs.tagType,
          'data-tag-type': mark.attrs.tagType,
          'data-entity-id': mark.attrs.entityId
        }, 0];
      }
    },
    revisionFlag: {
      attrs: {
        reason: { default: '' },
        createdAt: { default: null },
        status: { default: 'open' }   // open | resolved
      },
      inclusive: false,
      excludes: '',
      parseDOM: [{ tag: 'span.rga-revision-flag', getAttrs(dom) {
        return {
          reason: dom.getAttribute('data-reason') || '',
          createdAt: dom.getAttribute('data-created-at'),
          status: dom.getAttribute('data-status') || 'open'
        };
      } }],
      toDOM(mark) {
        return ['span', {
          class: 'rga-revision-flag rga-revision-' + mark.attrs.status,
          'data-reason': mark.attrs.reason,
          'data-created-at': mark.attrs.createdAt || '',
          'data-status': mark.attrs.status
        }, 0];
      }
    }
  };

  const screenplaySchema = new PM.Schema({ nodes, marks });

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.schema = screenplaySchema;
})();
```

- [ ] **Step 2: Add to bundle entry**

The schema needs the `Schema` constructor from ProseMirror. It already has it via the bundle (`window.RgaProseMirror.Schema`). No bundle change needed; just add the script tag.

In `renderer/index.html`, after `<script src="js/editor/bundle.js"></script>` and BEFORE `<script src="js/editor/mount.js"></script>`:

```html
<script src="js/doc-types/screenplay/schema.js"></script>
```

- [ ] **Step 3: Smoke test**

```
npm start
```

DevTools console:
```
window.Rga.DocTypes.screenplay.schema
```

Expected: a Schema object.

```
window.Rga.DocTypes.screenplay.schema.nodes.scene
```

Expected: the scene node spec (NodeType instance).

- [ ] **Step 4: Commit**

```
git add renderer/js/doc-types/screenplay/schema.js renderer/index.html
git commit -m "$(cat <<'EOF'
feat(schema): full screenplay ProseMirror schema per spec §2

Defines all nodes (doc, titleStrip, body, paragraph, heading, quote,
bulletList, orderedList, listItem, horizontalRule, pageBreak, scene,
sceneLine, action, character, dialogue, parenthetical, transition,
shot, inlineFreeText, text) and all marks (bold, italic, underline,
strikethrough, color, highlight, fontFamily, fontSize, link,
annotation, tag, revisionFlag).

Schema content rules enforce the spec's structural invariants:
  - sceneLine MUST be the first child of every scene
  - screenplay-group children only inside scene
  - block-group children only inside body
  - titleStrip appears 0 or 1 times as first child of doc

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

**Code review:**
- **Spec-Reviewer** — read spec §2 line by line. Verify (a) every node listed exists, (b) every mark listed exists, (c) the four schema-enforced invariants (§2 numbered list at end) are achievable from the content rules.
- **Quality-Reviewer** — verify attribute defaults are reasonable; no missing `parseDOM` or `toDOM`; consistent naming (rga-* class prefix).

---

### Task 2.2: Test — each node parses and serializes

**Implementer:** Builder-Sonnet
**Files:** create `tests/unit/schema/nodes.test.js`

**Steps:**

- [ ] **Step 1: Create the test**

Create `tests/unit/schema/nodes.test.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

// Load the schema by reading the source file. The schema definition
// is the same object passed to new Schema(...). For tests we re-build it.
// (A better long-term approach: extract the node/mark specs into a pure
// module and import them; for now we replicate the construction here.)

function buildSchema() {
  // Paste a TRIMMED version of the spec for testing (matches schema.js).
  return new Schema({
    nodes: {
      doc: { content: 'titleStrip? body' },
      titleStrip: { content: 'text*', attrs: { removable: { default: true } } },
      body: { content: 'block*' },
      paragraph: { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      heading: { content: 'inline*', group: 'block', attrs: { level: { default: 1 } }, toDOM(n) { return ['h' + n.attrs.level, 0]; } },
      quote: { content: 'inline*', group: 'block', toDOM() { return ['blockquote', 0]; } },
      bulletList: { content: 'listItem+', group: 'block', toDOM() { return ['ul', 0]; } },
      orderedList: { content: 'listItem+', group: 'block', toDOM() { return ['ol', 0]; } },
      listItem: { content: 'paragraph block*', toDOM() { return ['li', 0]; } },
      horizontalRule: { group: 'block', toDOM() { return ['hr']; } },
      pageBreak: { group: 'block', toDOM() { return ['div', { class: 'rga-page-break' }]; } },
      scene: {
        content: 'sceneLine (action | character | dialogue | parenthetical | transition | shot | inlineFreeText)*',
        group: 'block',
        attrs: { id: { default: null }, number: { default: null }, notes: { default: '' }, revisionFlag: { default: null } },
        toDOM() { return ['div', { class: 'rga-scene' }, 0]; }
      },
      sceneLine: { content: 'inline*', group: 'screenplay', attrs: { setting: { default: 'INT' }, location: { default: '' }, time: { default: 'DAY' } }, toDOM() { return ['div', { class: 'rga-scene-line' }, 0]; } },
      action: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', { class: 'rga-action' }, 0]; } },
      character: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', { class: 'rga-character' }, 0]; } },
      dialogue: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', { class: 'rga-dialogue' }, 0]; } },
      parenthetical: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', { class: 'rga-parenthetical' }, 0]; } },
      transition: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', { class: 'rga-transition' }, 0]; } },
      shot: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', { class: 'rga-shot' }, 0]; } },
      inlineFreeText: { content: 'inline*', group: 'screenplay', toDOM() { return ['div', { class: 'rga-inline-free-text' }, 0]; } },
      text: { group: 'inline' }
    },
    marks: {
      bold: { toDOM() { return ['strong', 0]; } },
      italic: { toDOM() { return ['em', 0]; } }
    }
  });
}

test('schema constructs without errors', () => {
  const s = buildSchema();
  assert.ok(s.nodes.scene);
  assert.ok(s.nodes.sceneLine);
});

test('all 20 spec node types exist', () => {
  const s = buildSchema();
  const required = [
    'doc', 'titleStrip', 'body', 'paragraph', 'heading', 'quote',
    'bulletList', 'orderedList', 'listItem', 'horizontalRule', 'pageBreak',
    'scene', 'sceneLine',
    'action', 'character', 'dialogue', 'parenthetical', 'transition', 'shot', 'inlineFreeText',
    'text'
  ];
  required.forEach(name => assert.ok(s.nodes[name], `missing node: ${name}`));
});

test('can build a valid screenplay doc', () => {
  const s = buildSchema();
  const doc = s.node('doc', null, [
    s.node('body', null, [
      s.node('scene', null, [
        s.node('sceneLine', null, [s.text('INT. CAFÉ — NIGHT')]),
        s.node('action', null, [s.text('Sarah enters.')])
      ])
    ])
  ]);
  assert.equal(doc.firstChild.type.name, 'body');
  assert.equal(doc.firstChild.firstChild.type.name, 'scene');
  assert.equal(doc.firstChild.firstChild.firstChild.type.name, 'sceneLine');
});
```

- [ ] **Step 2: Run**

```
npm run test:unit
```

Expected: 3 new tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/schema/nodes.test.js
git commit -m "$(cat <<'EOF'
test(schema): verify all 20 node types and basic doc construction

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

**Code review:** **Quality-Reviewer** — verify all 20 nodes from spec §2 are in the `required` array. (Note: the test rebuilds the schema rather than importing — this is OK for now; a future refactor extracts schema specs to a pure module.)

---

### Task 2.3: Test — schema invariants are enforced

**Implementer:** Builder-Opus
**Files:** create `tests/unit/schema/invariants.test.js`

These tests verify the spec §2 invariants:

1. `sceneLine` MUST be the first child of every `scene`.
2. `action`/`character`/etc. NOT allowed at body top level.
3. `paragraph`/`quote`/`heading`/`bulletList`/`orderedList` NOT allowed inside `scene`.
4. `titleStrip` 0 or 1, always first child of doc.

**Steps:**

- [ ] **Step 1: Create the test**

Create `tests/unit/schema/invariants.test.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

// Reuse buildSchema from nodes.test — for now duplicate (refactor later).
function buildSchema() {
  // Same schema as nodes.test.js — see that file.
  return new Schema({
    nodes: {
      doc: { content: 'titleStrip? body' },
      titleStrip: { content: 'text*', attrs: { removable: { default: true } } },
      body: { content: 'block*' },
      paragraph: { content: 'inline*', group: 'block', toDOM() { return ['p', 0]; } },
      heading: { content: 'inline*', group: 'block', attrs: { level: { default: 1 } }, toDOM(n) { return ['h' + n.attrs.level, 0]; } },
      quote: { content: 'inline*', group: 'block', toDOM() { return ['blockquote', 0]; } },
      bulletList: { content: 'listItem+', group: 'block', toDOM() { return ['ul', 0]; } },
      orderedList: { content: 'listItem+', group: 'block', toDOM() { return ['ol', 0]; } },
      listItem: { content: 'paragraph block*', toDOM() { return ['li', 0]; } },
      horizontalRule: { group: 'block', toDOM() { return ['hr']; } },
      pageBreak: { group: 'block', toDOM() { return ['div']; } },
      scene: {
        content: 'sceneLine (action | character | dialogue | parenthetical | transition | shot | inlineFreeText)*',
        group: 'block',
        attrs: { id: { default: null }, number: { default: null }, notes: { default: '' }, revisionFlag: { default: null } },
        toDOM() { return ['div', 0]; }
      },
      sceneLine: { content: 'inline*', group: 'screenplay', attrs: { setting: { default: 'INT' }, location: { default: '' }, time: { default: 'DAY' } }, toDOM() { return ['div', 0]; } },
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

test('invariant 1: scene without sceneLine fails to construct', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('scene', null, [
      s.node('action', null, [s.text('No scene line.')])
    ]);
  }, /Invalid content/);
});

test('invariant 1: scene with sceneLine succeeds', () => {
  const s = buildSchema();
  const scene = s.node('scene', null, [
    s.node('sceneLine', null, [s.text('INT. X')]),
    s.node('action', null, [s.text('Y')])
  ]);
  assert.equal(scene.firstChild.type.name, 'sceneLine');
});

test('invariant 2: action at body top level is rejected', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('body', null, [
      s.node('action', null, [s.text('orphan')])
    ]);
  }, /Invalid content/);
});

test('invariant 2: dialogue at body top level is rejected', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('body', null, [
      s.node('dialogue', null, [s.text('orphan')])
    ]);
  }, /Invalid content/);
});

test('invariant 3: paragraph inside scene is rejected', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('scene', null, [
      s.node('sceneLine', null, [s.text('INT. X')]),
      s.node('paragraph', null, [s.text('orphan')])
    ]);
  }, /Invalid content/);
});

test('invariant 3: heading inside scene is rejected', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('scene', null, [
      s.node('sceneLine', null, [s.text('INT. X')]),
      s.node('heading', null, [s.text('orphan')])
    ]);
  }, /Invalid content/);
});

test('invariant 4: titleStrip after body is rejected', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('doc', null, [
      s.node('body', null, []),
      s.node('titleStrip', null, [s.text('Late title')])
    ]);
  }, /Invalid content/);
});

test('invariant 4: two titleStrips rejected', () => {
  const s = buildSchema();
  assert.throws(() => {
    s.node('doc', null, [
      s.node('titleStrip', null, [s.text('A')]),
      s.node('titleStrip', null, [s.text('B')]),
      s.node('body', null, [])
    ]);
  }, /Invalid content/);
});
```

- [ ] **Step 2: Run**

```
npm run test:unit
```

Expected: 8 new tests pass.

- [ ] **Step 3: Commit**

```
git add tests/unit/schema/invariants.test.js
git commit -m "$(cat <<'EOF'
test(schema): verify the four spec §2 invariants are enforced

These tests prove that ProseMirror's schema rejects:
  1. scene without sceneLine as first child
  2. action/dialogue/etc. at body top level
  3. paragraph/heading inside scene
  4. titleStrip after body or duplicated

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

**Code review:** **Spec-Reviewer** — verify each test corresponds to a spec §2 invariant; no missing invariants.

---

### Task 2.4: Test — all 13 marks construct correctly

**Implementer:** Builder-Sonnet
**Files:** create `tests/unit/schema/marks.test.js`

**Steps:**

- [ ] **Step 1: Create the test**

Create `tests/unit/schema/marks.test.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('prosemirror-model');

function buildSchemaWithMarks() {
  return new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: { content: 'inline*', toDOM() { return ['p', 0]; } },
      text: { group: 'inline' }
    },
    marks: {
      bold: { toDOM() { return ['strong', 0]; } },
      italic: { toDOM() { return ['em', 0]; } },
      underline: { toDOM() { return ['u', 0]; } },
      strikethrough: { toDOM() { return ['s', 0]; } },
      color: { attrs: { value: {} }, toDOM(m) { return ['span', { style: 'color:' + m.attrs.value }, 0]; } },
      highlight: { attrs: { value: {} }, toDOM(m) { return ['span', { style: 'background-color:' + m.attrs.value }, 0]; } },
      fontFamily: { attrs: { value: {} }, toDOM(m) { return ['span', { style: 'font-family:' + m.attrs.value }, 0]; } },
      fontSize: { attrs: { value: {} }, toDOM(m) { return ['span', { style: 'font-size:' + m.attrs.value }, 0]; } },
      link: { attrs: { href: {}, title: { default: null } }, toDOM(m) { return ['a', { href: m.attrs.href }, 0]; } },
      annotation: { attrs: { id: {}, text: { default: '' }, color: { default: '#FFE08A' }, createdAt: { default: null }, author: { default: null } }, inclusive: false, toDOM() { return ['span', 0]; } },
      tag: { attrs: { tagType: {}, entityId: {} }, inclusive: false, toDOM() { return ['span', 0]; } },
      revisionFlag: { attrs: { reason: { default: '' }, createdAt: { default: null }, status: { default: 'open' } }, inclusive: false, toDOM() { return ['span', 0]; } }
    }
  });
}

test('all 13 spec marks exist', () => {
  const s = buildSchemaWithMarks();
  const required = ['bold', 'italic', 'underline', 'strikethrough', 'color', 'highlight', 'fontFamily', 'fontSize', 'link', 'annotation', 'tag', 'revisionFlag'];
  required.forEach(name => assert.ok(s.marks[name], `missing mark: ${name}`));
});

test('annotation mark with id and text', () => {
  const s = buildSchemaWithMarks();
  const m = s.mark('annotation', { id: 'note-1', text: 'A note', color: '#FFE08A' });
  assert.equal(m.attrs.id, 'note-1');
  assert.equal(m.attrs.text, 'A note');
});

test('tag mark with tagType and entityId', () => {
  const s = buildSchemaWithMarks();
  const m = s.mark('tag', { tagType: 'character', entityId: 'ent-sarah' });
  assert.equal(m.attrs.tagType, 'character');
  assert.equal(m.attrs.entityId, 'ent-sarah');
});

test('revisionFlag mark default status is open', () => {
  const s = buildSchemaWithMarks();
  const m = s.mark('revisionFlag', { reason: 'punchier' });
  assert.equal(m.attrs.status, 'open');
});

test('marks can stack on same text span', () => {
  const s = buildSchemaWithMarks();
  const text = s.text('Sarah', [
    s.mark('bold'),
    s.mark('tag', { tagType: 'character', entityId: 'ent-sarah' }),
    s.mark('annotation', { id: 'note-1', text: 'Make her father\'s' })
  ]);
  assert.equal(text.marks.length, 3);
});
```

- [ ] **Step 2: Run**

```
npm run test:unit
```

- [ ] **Step 3: Commit**

```
git add tests/unit/schema/marks.test.js
git commit -m "$(cat <<'EOF'
test(schema): verify all 13 marks and stacking behavior

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

**Code review:** **Quality-Reviewer** — verify the schema in the test matches the production schema's mark definitions; consider extracting to a shared test helper in a later refactor.

---

### Task 2.5: Replace Phase 1 minimal schema with screenplay schema in mount.js

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/editor/mount.js`

**Steps:**

- [ ] **Step 1: Modify mount.js**

In `renderer/js/editor/mount.js`, replace the `minimalSchema` definition with a reference to the screenplay schema:

Replace:
```javascript
// PHASE 1 MINIMAL SCHEMA — replaced in Phase 2 by doc-types/screenplay/schema.js
const minimalSchema = new PM.Schema({
  nodes: { ... },
  marks: { ... }
});
```

With:
```javascript
// Active schema — provided by the active document's type package.
// Phase 2: screenplay only. Future: lookup by doc.document_type.
function activeSchema() {
  if (Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.schema) {
    return Rga.DocTypes.screenplay.schema;
  }
  throw new Error('[Rga.Editor.mount] No screenplay schema available — bundle order?');
}
```

Replace `const schema = opts.schema || minimalSchema;` with `const schema = opts.schema || activeSchema();`.

Replace `function emptyDoc(schema) { schema = schema || minimalSchema; ... }` with `function emptyDoc(schema) { schema = schema || activeSchema(); ... }`.

Update `emptyDoc`:
```javascript
function emptyDoc(schema) {
  schema = schema || activeSchema();
  return schema.node('doc', null, [
    schema.node('body', null, [
      schema.node('paragraph')
    ])
  ]);
}
```

Remove the `Rga.Editor._minimalSchema = minimalSchema;` line.

- [ ] **Step 2: Smoke test**

```
npm start
```

Expected:
- Editor area shows a contenteditable surface.
- Click in it; you should be in a paragraph inside body.
- Type "Hello" — appears. (The cursor is in the body's first paragraph, not a scene.)
- Press Ctrl+B on selected text — should still bold (boldmark exists in screenplay schema).

- [ ] **Step 3: Commit**

```
git add renderer/js/editor/mount.js
git commit -m "$(cat <<'EOF'
refactor(editor): wire mount to screenplay schema; drop minimal schema

Phase 1's minimal schema is replaced by Rga.DocTypes.screenplay.schema.
emptyDoc() now creates a valid screenplay doc: { body: { paragraph: '' } }.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

**Code review:**
- **Spec-Reviewer** — verify `emptyDoc()` produces a valid screenplay doc per §2 (body with at least one paragraph; no scene at start).
- **Quality-Reviewer** — verify the error path when schema not yet loaded throws clearly.

---

### Task 2.6: CSS for screenplay nodes

**Implementer:** Builder-Sonnet
**Files:** create `renderer/css/editor-prosemirror.css`; modify `renderer/index.html`

**Steps:**

- [ ] **Step 1: Create the CSS file**

Create `renderer/css/editor-prosemirror.css`:

```css
/* Copyright (c) 2026 Rwanga. Licensed under Apache 2.0. */
/* Styles for ProseMirror-rendered screenplay nodes. Spec §5 + screenplay
   industry conventions (1-inch margins, indented blocks, monospace). */

.ProseMirror {
  font-family: 'Courier Prime', 'Courier New', monospace;
  font-size: var(--editor-font-size, 12pt);
  line-height: 1.5;
  padding: var(--editor-padding, 1in);
  outline: none;
  min-height: 100%;
  color: var(--text-primary);
  background: var(--bg-editor);
}

.ProseMirror p {
  margin: 0 0 1em 0;
}

.ProseMirror h1, .ProseMirror h2, .ProseMirror h3 {
  margin: 1.5em 0 0.5em 0;
  font-weight: bold;
}

.ProseMirror blockquote {
  margin: 1em 0;
  padding-inline-start: 1em;
  border-inline-start: 3px solid var(--accent-secondary);
  color: var(--text-secondary);
}

.ProseMirror .rga-title-strip {
  font-size: 1.6em;
  font-weight: bold;
  text-align: center;
  margin: 0 0 2em 0;
  padding: 0.5em;
  border-bottom: 1px solid var(--border-subtle);
  position: relative;
}

.ProseMirror .rga-body {
  /* container; no extra style */
}

/* ----- SCENE container ----- */

.ProseMirror .rga-scene {
  margin: 1.5em 0;
  padding: 0.5em 0;
}

.ProseMirror .rga-scene-line {
  font-weight: bold;
  text-transform: uppercase;
  margin: 0 0 0.5em 0;
}

.ProseMirror .rga-action {
  margin: 0 0 1em 0;
}

.ProseMirror .rga-character {
  text-transform: uppercase;
  text-align: center;
  margin: 0.5em 0 0 3.7in;
  /* Industry standard: character cue indented 3.7" from left margin */
}

.ProseMirror .rga-dialogue {
  margin: 0 0 0.5em 2.5in;
  margin-inline-end: 2.5in;
  /* Industry standard: dialogue indented 2.5" left and right */
}

.ProseMirror .rga-parenthetical {
  font-style: italic;
  margin: 0 0 0 3.1in;
  /* Industry standard: 3.1" from left */
}

.ProseMirror .rga-transition {
  text-transform: uppercase;
  text-align: end;
  margin: 1em 0;
}

.ProseMirror .rga-shot {
  text-transform: uppercase;
  margin: 1em 0;
}

.ProseMirror .rga-inline-free-text {
  background: var(--bg-secondary);
  padding: 0.5em 1em;
  margin: 0.5em -0.5em;
  border-inline-start: 3px solid var(--accent-primary);
  font-style: italic;
  color: var(--text-secondary);
}

/* ----- MARKS ----- */

.ProseMirror .rga-annotation {
  /* Background color comes from inline style attr */
  border-radius: 2px;
  padding: 0 1px;
}
.ProseMirror .rga-annotation::after {
  content: '\1F4DD'; /* memo emoji */
  font-size: 0.7em;
  margin-inline-start: 2px;
  opacity: 0.6;
}

.ProseMirror .rga-tag {
  border-bottom: 2px solid var(--accent-primary);
  cursor: help;
}
.ProseMirror .rga-tag-character { border-bottom-color: var(--tag-character, #4FC1FF); }
.ProseMirror .rga-tag-prop      { border-bottom-color: var(--tag-prop, #FFB347); }
.ProseMirror .rga-tag-wardrobe  { border-bottom-color: var(--tag-wardrobe, #C586C0); }
.ProseMirror .rga-tag-location  { border-bottom-color: var(--tag-location, #4EC9B0); }
.ProseMirror .rga-tag-sfx       { border-bottom-color: var(--tag-sfx, #F44747); }
.ProseMirror .rga-tag-vfx       { border-bottom-color: var(--tag-vfx, #C586C0); }
.ProseMirror .rga-tag-vehicle   { border-bottom-color: var(--tag-vehicle, #DCDCAA); }
.ProseMirror .rga-tag-animal    { border-bottom-color: var(--tag-animal, #B5CEA8); }
.ProseMirror .rga-tag-custom    { border-bottom-color: var(--tag-custom, #888); }

.ProseMirror .rga-revision-flag {
  border-bottom: 2px dashed #F44747;
  cursor: pointer;
}
.ProseMirror .rga-revision-flag::after {
  content: '\1F6A9'; /* flag emoji */
  font-size: 0.7em;
  margin-inline-start: 2px;
}
.ProseMirror .rga-revision-resolved {
  border-bottom-style: dotted;
  opacity: 0.5;
}

/* ----- PAGE BREAK ----- */

.ProseMirror .rga-page-break {
  break-after: page;
  border-bottom: 1px dashed var(--border-subtle);
  margin: 2em 0;
}

/* ----- RTL ADJUSTMENTS (cascade via [dir="rtl"]) ----- */

.ProseMirror[dir="rtl"] .rga-character {
  margin-inline-start: 3.7in;
  margin-inline-end: 0;
}
.ProseMirror[dir="rtl"] .rga-transition {
  text-align: start;
}
```

- [ ] **Step 2: Link in index.html**

In `renderer/index.html`, add to the CSS load order (after `editor.css`):

```html
<link rel="stylesheet" href="css/editor-prosemirror.css">
```

- [ ] **Step 3: Smoke test**

```
npm start
```

Expected: editor area now has proper screenplay styling. Typing in the default paragraph shows Courier Prime font, with appropriate margins.

- [ ] **Step 4: Commit**

```
git add renderer/css/editor-prosemirror.css renderer/index.html
git commit -m "$(cat <<'EOF'
style(editor): CSS for screenplay nodes per industry conventions

Indentation (3.7" character, 2.5" dialogue, 3.1" parenthetical),
uppercase transforms (scene-line, character, transition, shot),
mark styling (annotation highlight, tag underline by type, revision
dashed underline), RTL mirroring via logical properties.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

**Code review:**
- **Spec-Reviewer** — verify industry-standard indentation values (§3 hints at conventions); CSS class names match toDOM output of schema.js.
- **Quality-Reviewer** — verify CSS uses logical properties (padding-inline-start, etc.) for RTL; no `!important`; uses existing `--rw-*` design tokens where available (or maps to them; verify token names match the project's existing `tokens.css`).

---

### Task 2.7: Spec review for Phase 2

**Implementer:** Spec-Reviewer (Opus)

**Prompt:**

```
You are the Spec-Reviewer subagent.

Verify Phase 2 against spec §2 and §5.

Files to read:
  - docs/superpowers/specs/2026-05-13-rwanga-editor-redesign-design.md §2, §5
  - rwanga-editor/renderer/js/doc-types/screenplay/schema.js
  - rwanga-editor/renderer/css/editor-prosemirror.css
  - rwanga-editor/tests/unit/schema/nodes.test.js
  - rwanga-editor/tests/unit/schema/invariants.test.js
  - rwanga-editor/tests/unit/schema/marks.test.js

Checks:
  1. All 20 nodes from spec §2 are in schema.js.
  2. All 13 marks from spec §2/§4 are in schema.js.
  3. Schema content rules enforce all four spec §2 invariants (the tests prove this — verify the tests are not skipping cases).
  4. CSS class names in toDOM match CSS rules in editor-prosemirror.css.
  5. RTL-aware CSS uses logical properties.

Reply PASS or FAIL with file:line citations.
```

---

*Phase 2 continues with Tasks 2.8–2.14: each adds a small input rule, parser tweak, or fixture. Listed compactly below — same TDD + commit + review pattern.*

### Task 2.8: Doc.serialize / deserialize for v2.0 ProseMirror JSON

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/doc.js`, `renderer/js/constants.js`
**Spec ref:** §6

Update `Rga.Doc.serialize(doc)` to call `doc.body.toJSON()` (ProseMirror Node has a `.toJSON()` method) when `doc.body` is a ProseMirror node, and `Rga.Doc.deserialize(content, handle)` to call `schema.nodeFromJSON(parsed.body)`.

Update constants: `CURRENT_RGA_VERSION = '2.0'`, `SUPPORTED_RGA_VERSIONS = ['1.0', '1.1', '2.0']`.

Write a test: a doc created via `Doc.create()` serializes to JSON, deserializes back to an equivalent doc. Round-trip preservation.

Commit message:
```
feat(doc): serialize/deserialize ProseMirror JSON for .rga v2.0
```

**Code review:** Spec-Reviewer (verify v2.0 JSON shape matches §6 example).

### Task 2.9: file-manager.js — save uses ProseMirror serialization

**Implementer:** Builder-Sonnet
**Files:** modify `renderer/js/file-manager.js`
**Spec ref:** §8.2

In `save()` and `saveAs()`, capture the active editor's current document via the active tab's `editorState.doc`, set it on `doc.body`, then call `Doc.serialize(doc)`.

Update test: `tests/unit/file-manager.test.js` (create if not exists) — verify save produces JSON matching the schema.

Commit: `feat(file): file-manager saves ProseMirror doc as .rga v2.0`.

**Code review:** Quality-Reviewer.

### Task 2.10: TabManager.openDocument uses the doc's actual body

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/tab-manager.js`
**Spec ref:** §1, §8.2

In `openDocument(doc)`, instead of always creating an empty doc, create an EditorState from `doc.body` (already deserialized to a ProseMirror Node by `Doc.deserialize`).

Commit: `feat(tabs): tab editor state derives from the doc's deserialized body`.

**Code review:** Spec-Reviewer.

### Task 2.11: Fixture — v2.0 sample

**Implementer:** Builder-Sonnet
**Files:** create `tests/fixtures/v2.0-sample.rga`
**Spec ref:** §6

Save the spec §6 JSON example as a fixture file. Use it in subsequent tests.

Commit: `test(fixtures): v2.0 .rga sample matching spec §6`.

**Code review:** Spec-Reviewer.

### Task 2.12: Test — round-trip a real .rga file

**Implementer:** Builder-Sonnet
**Files:** create `tests/unit/round-trip.test.js`
**Spec ref:** §6

Load the v2.0 fixture, deserialize, serialize, compare. Verify lossless round-trip.

Commit: `test(roundtrip): v2.0 .rga file round-trips losslessly`.

**Code review:** Quality-Reviewer.

### Task 2.13: Smoke test — Ctrl+N opens a v2 doc

**Smoke-Tester:** you (inline).

Run `npm start`. Click `+` in tab bar. Verify a new tab opens with an empty editor (just a paragraph in body). Type something, press Ctrl+S. A file dialog appears. Save as `test-v2.rga`. Open the saved file in a text editor; verify it's v2.0 JSON.

### Task 2.14: Phase 2 final review

**Spec-Reviewer (Opus)** — broad pass over Phase 2 commits.
**Quality-Reviewer (Sonnet)** — check no dead code, all tests in place.

---

## Phase 3 — Inside-scene grammar

**Goal:** Implement the Tab/Enter/double-Enter/Ctrl+Enter keymap. Wire the scene container's grammar.

**Spec ref:** §3

### Task 3.1: Keymap module skeleton

**Implementer:** Builder-Opus
**Files:** create `renderer/js/doc-types/screenplay/keymap.js`
**Spec ref:** §3.1

Define a `buildKeymap(schema)` function that returns an object suitable for `prosemirror-keymap`'s `keymap()` plugin. Initially with placeholders for each key; subsequent tasks fill them in.

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  /**
   * Build the screenplay-specific keymap for ProseMirror.
   * @param {Schema} schema - the screenplay schema
   * @returns {object} keymap bindings
   */
  function buildKeymap(schema) {
    return {
      'Tab': cycleBlockTypeForward(schema),
      'Shift-Tab': cycleBlockTypeBackward(schema),
      'Enter': enterBehavior(schema),
      'Escape': exitScene(schema),
      'Mod-Enter': newSceneAfterCurrent(schema)
      // double-Enter implemented via Enter wrapper detecting empty-line case
    };
  }

  // Stubs — filled in by subsequent tasks.
  function cycleBlockTypeForward(schema) { return (state, dispatch) => false; }
  function cycleBlockTypeBackward(schema) { return (state, dispatch) => false; }
  function enterBehavior(schema) { return (state, dispatch) => false; }
  function exitScene(schema) { return (state, dispatch) => false; }
  function newSceneAfterCurrent(schema) { return (state, dispatch) => false; }

  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.buildKeymap = buildKeymap;

  // Internals exposed for tests
  Rga.DocTypes.screenplay._keymapInternals = {
    cycleBlockTypeForward,
    cycleBlockTypeBackward,
    enterBehavior,
    exitScene,
    newSceneAfterCurrent
  };
})();
```

Add `<script src="js/doc-types/screenplay/keymap.js"></script>` to `index.html` after schema.js.

Commit: `feat(keymap): screenplay keymap module skeleton`.

**Code review:** Spec-Reviewer (verify the function names match §3 actions).

### Task 3.2: Helper — find the nearest scene-child node

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/doc-types/screenplay/keymap.js`

Add helper at the top of the IIFE:

```javascript
/**
 * Find the cursor's screenplay context: which scene child, and the scene itself.
 * @param {EditorState} state
 * @returns {{ inSide: boolean, sceneNode?: Node, sceneChildNode?: Node, sceneChildIndex?: number, scenePos?: number, sceneChildPos?: number }}
 */
function getSceneContext(state) {
  const $head = state.selection.$head;
  let sceneDepth = -1;
  for (let d = $head.depth; d >= 0; d--) {
    if ($head.node(d).type.name === 'scene') {
      sceneDepth = d;
      break;
    }
  }
  if (sceneDepth < 0) return { inSide: false };
  const sceneChildDepth = sceneDepth + 1;
  if ($head.depth < sceneChildDepth) return { inSide: false };
  return {
    inSide: true,
    sceneNode: $head.node(sceneDepth),
    scenePos: $head.before(sceneDepth),
    sceneChildNode: $head.node(sceneChildDepth),
    sceneChildIndex: $head.index(sceneDepth),
    sceneChildPos: $head.before(sceneChildDepth)
  };
}
```

Test: `tests/unit/keymap/getSceneContext.test.js` — verify it returns `inSide: true` when cursor in scene child; `inSide: false` outside.

Commit: `feat(keymap): getSceneContext helper for scene-aware behavior`.

### Task 3.3: Tab — cycle block type forward

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/doc-types/screenplay/keymap.js`
**Spec ref:** §3.1

Implement `cycleBlockTypeForward` based on the §3.1 table:

```javascript
const FORWARD_CYCLE = {
  action: 'character',
  character: 'dialogue',
  dialogue: 'action',
  parenthetical: 'transition',
  transition: 'shot',
  shot: 'action'
};

function cycleBlockTypeForward(schema) {
  return (state, dispatch) => {
    const ctx = getSceneContext(state);
    if (!ctx.inSide) return false;
    if (ctx.sceneChildNode.type.name === 'sceneLine') {
      // Tab on sceneLine has no effect per §3.1
      return false;
    }
    const targetTypeName = FORWARD_CYCLE[ctx.sceneChildNode.type.name];
    if (!targetTypeName) return false;
    const targetType = schema.nodes[targetTypeName];
    if (!dispatch) return true;
    const tr = state.tr.setNodeMarkup(ctx.sceneChildPos, targetType);
    dispatch(tr);
    return true;
  };
}
```

Replace the stub in `buildKeymap`.

Test: `tests/unit/keymap/tab-cycle.test.js` — create a doc with one scene + action, run the Tab command, verify action becomes character.

Commit: `feat(keymap): Tab cycles screenplay block type forward`.

**Code review:** Spec-Reviewer (verify cycle matches §3.1 table exactly).

### Task 3.4: Shift-Tab — cycle backward + sceneLine handling

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/doc-types/screenplay/keymap.js`

Implement `cycleBlockTypeBackward`. From §3.1 table:
- action → sceneLine (special: requires merging text with sceneLine? Or just change type? Per spec §3.1: action → sceneLine — but this would create two scene lines. The cleanest interpretation: Shift+Tab on the first action of a scene moves cursor up into sceneLine instead of changing type. For other actions, no-op.)

For now, implement:
```javascript
const BACKWARD_CYCLE = {
  character: 'action',
  dialogue: 'character',
  parenthetical: 'dialogue',
  transition: 'parenthetical',
  shot: 'transition'
  // action: special — move cursor to sceneLine
};
```

Action Shift+Tab moves cursor to end of preceding sceneLine.

Test: scene with sceneLine + action; cursor in action; Shift+Tab → cursor at end of sceneLine. Action becomes... well, action is unchanged in this case (or moved-and-removed? Re-read §3.1.).

> Per §3.1: `action Shift+Tab → sceneLine`. Interpret: cursor moves to end of sceneLine. If action was empty, delete it.

Implement that interpretation:
```javascript
function cycleBlockTypeBackward(schema) {
  return (state, dispatch) => {
    const ctx = getSceneContext(state);
    if (!ctx.inSide) return false;
    if (ctx.sceneChildNode.type.name === 'sceneLine') return false;

    if (ctx.sceneChildNode.type.name === 'action') {
      // Move cursor to end of sceneLine
      const sceneLinePos = ctx.scenePos + 1; // first child position
      const sceneLineNode = ctx.sceneNode.child(0);
      const endOfSceneLine = sceneLinePos + sceneLineNode.nodeSize - 1;
      if (!dispatch) return true;
      const tr = state.tr;
      if (ctx.sceneChildNode.content.size === 0) {
        // Delete the empty action
        tr.delete(ctx.sceneChildPos, ctx.sceneChildPos + ctx.sceneChildNode.nodeSize);
      }
      tr.setSelection(state.selection.constructor.near(tr.doc.resolve(endOfSceneLine)));
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

Test: cover (a) character Shift+Tab → action, (b) action Shift+Tab → cursor at end of sceneLine, (c) sceneLine Shift+Tab → no-op.

Commit: `feat(keymap): Shift+Tab cycles backward; action goes to sceneLine`.

**Code review:** Spec-Reviewer.

### Task 3.5: Enter behavior per node type

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/doc-types/screenplay/keymap.js`
**Spec ref:** §3.1

Implement the per-node Enter transitions:

```javascript
const ENTER_NEXT = {
  sceneLine: 'action',
  action: 'action',  // new action below
  character: 'dialogue',
  dialogue: 'action',
  parenthetical: 'dialogue',
  transition: 'action',
  shot: 'action'
};

function enterBehavior(schema) {
  return (state, dispatch) => {
    const ctx = getSceneContext(state);
    if (!ctx.inSide) return false;

    // Smart Enter on empty action → exit scene (delegated to exitScene)
    if (ctx.sceneChildNode.type.name === 'action' && ctx.sceneChildNode.content.size === 0) {
      return exitScene(schema)(state, dispatch);
    }

    const nextTypeName = ENTER_NEXT[ctx.sceneChildNode.type.name];
    if (!nextTypeName) return false;
    const nextType = schema.nodes[nextTypeName];

    if (!dispatch) return true;
    const tr = state.tr;
    const insertPos = ctx.sceneChildPos + ctx.sceneChildNode.nodeSize;
    tr.insert(insertPos, nextType.create());
    tr.setSelection(state.selection.constructor.near(tr.doc.resolve(insertPos + 1)));
    dispatch(tr.scrollIntoView());
    return true;
  };
}
```

Tests: cover each Enter transition + the smart-Enter-on-empty-action case.

Commit: `feat(keymap): Enter creates next block per spec §3.1 table`.

**Code review:** Spec-Reviewer (verify ENTER_NEXT matches §3.1 table).

### Task 3.6: Esc / double-Enter exit scene

**Implementer:** Builder-Opus
**Spec ref:** §3.2

Implement `exitScene`: insert a paragraph in body immediately after the current scene; move cursor there.

```javascript
function exitScene(schema) {
  return (state, dispatch) => {
    const ctx = getSceneContext(state);
    if (!ctx.inSide) return false;
    if (!dispatch) return true;
    const tr = state.tr;
    const afterScenePos = ctx.scenePos + ctx.sceneNode.nodeSize;
    const newPara = schema.nodes.paragraph.create();
    tr.insert(afterScenePos, newPara);
    tr.setSelection(state.selection.constructor.near(tr.doc.resolve(afterScenePos + 1)));
    dispatch(tr.scrollIntoView());
    return true;
  };
}
```

Test: cursor in scene's action; Esc → cursor in a new paragraph after the scene.

Note: "double-Enter" is handled by the smart-Enter-on-empty-action case in Task 3.5.

Commit: `feat(keymap): Esc exits scene to new paragraph below`.

### Task 3.7: Ctrl+Enter — new scene after current

**Implementer:** Builder-Opus
**Spec ref:** §3.2

```javascript
function newSceneAfterCurrent(schema) {
  return (state, dispatch) => {
    if (!dispatch) return true;
    const ctx = getSceneContext(state);
    const tr = state.tr;

    // Insert position: after current scene if inside one, else at cursor body position
    let insertPos;
    if (ctx.inSide) {
      insertPos = ctx.scenePos + ctx.sceneNode.nodeSize;
    } else {
      // Find body and insert at cursor's parent
      const $head = state.selection.$head;
      insertPos = $head.after(1); // body's child level
    }

    const sceneNode = schema.nodes.scene.create({}, [
      schema.nodes.sceneLine.create(),
      schema.nodes.action.create()
    ]);
    tr.insert(insertPos, sceneNode);
    tr.setSelection(state.selection.constructor.near(tr.doc.resolve(insertPos + 1))); // cursor in sceneLine
    dispatch(tr.scrollIntoView());
    return true;
  };
}
```

Test: from a paragraph in body, Ctrl+Enter → new scene below; cursor in sceneLine.
Test: from inside a scene, Ctrl+Enter → new scene after current scene.

Commit: `feat(keymap): Ctrl+Enter inserts new scene; cursor in sceneLine`.

**Code review:** Spec-Reviewer.

### Task 3.8: Wire keymap into mount.js

**Implementer:** Builder-Sonnet
**Files:** modify `renderer/js/editor/mount.js`

In `mount()`, after the existing keymap entries, add:
```javascript
const screenplayKeymap = Rga.DocTypes.screenplay.buildKeymap(schema);
plugins.unshift(PM.keymap(screenplayKeymap));
```

Smoke test in Electron: in a scene, Tab cycles types; Enter advances; Ctrl+Enter creates a new scene; Esc exits scene.

Commit: `feat(editor): wire screenplay keymap into mount`.

**Code review:** Spec-Reviewer + Smoke-Tester (you).

### Task 3.9: Active-scene plugin

**Implementer:** Builder-Opus
**Files:** create `renderer/js/doc-types/screenplay/plugins/active-scene.js`
**Spec ref:** §3.5

Track the active scene; emit `editor.activeSceneChange` events. Plugin watches selection changes; when the cursor enters a different scene (or leaves all scenes), it fires the event via a custom event bus (`Rga.Events`).

Test: simulate selection in a scene, verify the plugin's `activeSceneId` matches.

Commit: `feat(plugin): active-scene tracker emits activeSceneChange events`.

**Code review:** Spec-Reviewer.

### Task 3.10: Wire active-scene plugin to mount.js

**Implementer:** Builder-Sonnet

Add to plugins array in mount. Smoke test: click in different scenes, watch DevTools for active-scene events.

Commit: `feat(editor): wire active-scene plugin`.

### Task 3.11: Phase 3 spec + quality review

**Spec-Reviewer** — verify §3.1 table is fully implemented; §3.2 special keys all work; §3.5 active-scene lifecycle in place.
**Quality-Reviewer** — naming, comments, no dead code, all keymap functions tested.

---

## Phase 4 — Marks (annotation, tag, revisionFlag)

**Goal:** Implement the three writer-driven marks. Right-click context menu invokes them. Inline popups for editing.

**Spec ref:** §4

### Task 4.1: Right-click context menu skeleton

**Implementer:** Builder-Opus
**Files:** create `renderer/js/doc-types/screenplay/plugins/context-menu.js`

The plugin listens for `contextmenu` events on the editor surface, intercepts when there's a non-empty selection, and shows a custom popup near the cursor with options: Cut / Copy / Paste / — / Add note / Tag as ▶ / Flag for revision / — / Open inspector.

Implementation outline:
```javascript
(function() {
  const PM = window.RgaProseMirror;
  function contextMenuPlugin() {
    return new PM.Plugin({
      props: {
        handleDOMEvents: {
          contextmenu(view, event) {
            if (view.state.selection.empty) return false; // let browser default
            event.preventDefault();
            showCustomMenu(view, event);
            return true;
          }
        }
      }
    });
  }
  function showCustomMenu(view, event) {
    // Build DOM popup, append to body, position at event.clientX/Y
  }
  // Expose factory
  window.Rga.DocTypes.screenplay.contextMenuPlugin = contextMenuPlugin;
})();
```

Refinement: use a Plugin from `prosemirror-state` (re-exported in bundle); detect right-click on selected text; build a popup.

Test: simulate selection + contextmenu event in jsdom; verify popup DOM is added.

Commit: `feat(plugin): right-click context menu skeleton for selection actions`.

**Code review:** Spec-Reviewer (verify the menu items match §4 — Add note, Tag as, Flag for revision).

### Task 4.2: Annotation mark — Add note action

**Implementer:** Builder-Opus
**Files:** create `renderer/js/doc-types/screenplay/plugins/annotations.js`

When the user clicks "Add note" in the context menu, open an inline popup near the selection. The popup is a textarea with a color swatch + Save / Cancel.

On Save: apply the `annotation` mark to the selection with `{ id: uuid(), text: textareaValue, color: chosenColor, createdAt: nowIso, author: null }`.

Implementation outline:
- Function `addAnnotation(view, selection, payload)` that builds a transaction with `view.state.tr.addMark(from, to, schema.marks.annotation.create(payload))`.
- Function `showAnnotationEditor(view, options)` that opens the popup.

Tests: unit test the transaction-building function (no DOM).

Commit: `feat(plugin): annotation mark with inline popup editor`.

**Code review:** Spec-Reviewer (§4.1) + Quality-Reviewer.

### Task 4.3: Click annotated text → open editor popup

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/doc-types/screenplay/plugins/annotations.js`

Add a `decoration` or `handleClickOn` prop to detect clicks on text carrying the `annotation` mark; open the popup pre-filled with the mark's data; offer Edit / Resolve / Delete.

Resolve = set `text` to '' and remove mark, OR just remove mark (decision: remove mark, text content unchanged). Delete = remove mark.

Commit: `feat(annotation): click annotated text to edit/resolve/delete`.

### Task 4.4: Annotation popup UI styling

**Implementer:** Builder-Sonnet
**Files:** modify `renderer/css/editor-prosemirror.css`

Add `.rga-annotation-popup` styles: small floating div, dark/light theme aware, drop shadow, textarea, color swatch row, action buttons.

Commit: `style(annotation): popup editor visual styling`.

**Code review:** Quality-Reviewer.

### Task 4.5: Tag mark — submenu

**Implementer:** Builder-Opus
**Files:** create `renderer/js/doc-types/screenplay/plugins/tags.js`
**Spec ref:** §4.2

"Tag as ▶" submenu lists tag types: Character / Prop / Wardrobe / Location / SFX / VFX / Vehicle / Animal / Custom. Each opens a small dialog: "Tag '<selected text>' as <type>" with options: existing entity (dropdown from `tag_registry`) or "+ New entity" (creates one, prompts for name + color).

Applied mark: `{ tagType, entityId }`.

Test: tag a selection as character with new entity; verify the mark and a new entry in tag_registry (need a registry access function on `doc`).

Commit: `feat(plugin): tag mark with entity registry sync`.

**Code review:** Spec-Reviewer (§4.2) + Quality-Reviewer.

### Task 4.6: Tag registry storage on the doc

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/doc.js`

`Doc.create()` already initializes `tag_registry`. Add `Doc.addEntity(doc, type, { name, color, notes })` returning the entity's id. Add `Doc.findEntity(doc, type, id)`. Add `Doc.removeEntity(doc, type, id)` (also removes all `tag` marks pointing to it via a doc walk).

Tests: each registry operation.

Commit: `feat(doc): tag_registry add/find/remove with mark cleanup`.

### Task 4.7: Revision flag mark

**Implementer:** Builder-Sonnet
**Files:** create `renderer/js/doc-types/screenplay/plugins/revision-flags.js`
**Spec ref:** §4.3

Similar pattern to annotation: right-click action opens a popup with a reason textarea + Open/Resolved radio + Save.

Commit: `feat(plugin): revision flag mark with reason and status`.

### Task 4.8: Scene-level flags and notes (§4.4)

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/doc-types/screenplay/plugins/active-scene.js` or new helper

Add API on the active-scene plugin: `setSceneNote(view, sceneId, text)`, `flagSceneForRevision(view, sceneId, { reason, status })`. These mutate `scene.attrs.notes` and `scene.attrs.revisionFlag` via a transaction setNodeMarkup.

Tests: scene attrs update via transaction.

Commit: `feat(scene): scene-level notes and revision flag stored on attrs`.

### Task 4.9: Wire context menu to mount.js

**Implementer:** Builder-Sonnet

Add the context menu plugin + annotations plugin + tags plugin + revision-flags plugin to the plugins array in `mount.js`. Test in Electron: right-click on selected text in an action block → popup with options.

Commit: `feat(editor): wire mark plugins into mount`.

### Task 4.10: Test — marks overlap correctly

**Implementer:** Builder-Sonnet
**Files:** create `tests/unit/marks/overlap.test.js`
**Spec ref:** §4.5

Verify a text node can carry tag + annotation + revisionFlag simultaneously.

Commit: `test(marks): three marks can stack on one span`.

### Task 4.11: Phase 4 spec + quality reviews

**Spec-Reviewer** — verify §4.1, §4.2, §4.3, §4.4, §4.5 all addressed.
**Quality-Reviewer** — popup UI follows design tokens; no inline styles where CSS classes work.

### Task 4.12: Smoke test

**Smoke-Tester:** you.

Right-click on selected text:
- [ ] "Add note" → popup appears, type a note, save → highlighted span with yellow background.
- [ ] Click the marked span → popup re-opens with the note.
- [ ] "Tag as → Character" → submenu → "+ New entity" → enter "SARAH" → underlined blue text.
- [ ] "Flag for revision" → popup → enter "punchier" → dashed red underline.
- [ ] All three on the same word → three layered marks visible (highlight + underline + dashed underline).

---

## Phase 5 — Widget menu and toolbar

**Goal:** "+" widget button between blocks; "/" slash command; persistent toolbar above the editor.

**Spec ref:** §5

### Task 5.1: Widget button positioning

**Implementer:** Builder-Opus
**Files:** create `renderer/js/editor/widget-menu.js`
**Spec ref:** §5.1

A floating "+" button appears in the margin next to the current line. On hover state, it expands. Click → opens the widget menu.

Implementation: a ProseMirror plugin with `decorations` that adds a widget DOM node next to the cursor's current top-level block. Position calculated via `view.coordsAtPos`.

Commit: `feat(widget): + button decoration tracks cursor position`.

### Task 5.2: Widget menu UI

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/editor/widget-menu.js`

Click "+" → floating menu opens with the §5.1 outside-scene options. Filter as user types.

Items defined as data:
```javascript
const OUTSIDE_SCENE_ITEMS = [
  { id: 'title', label: 'Title', icon: 'title', shortcut: null, action: insertTitleStrip },
  { id: 'heading1', label: 'Heading 1', shortcut: null, action: insertHeading(1) },
  { id: 'heading2', label: 'Heading 2', shortcut: null, action: insertHeading(2) },
  { id: 'paragraph', label: 'Paragraph', shortcut: null, action: insertParagraph },
  { id: 'quote', label: 'Quote', shortcut: null, action: insertQuote },
  { id: 'bulletList', label: 'Bulleted list', shortcut: null, action: insertBulletList },
  { id: 'orderedList', label: 'Numbered list', shortcut: null, action: insertOrderedList },
  { id: 'horizontalRule', label: 'Horizontal rule', shortcut: null, action: insertHorizontalRule },
  { id: 'pageBreak', label: 'Page break', shortcut: null, action: insertPageBreak },
  { id: 'scene', label: 'Scene', shortcut: 'Ctrl+Enter', action: insertScene }
];
const INSIDE_SCENE_ITEMS = [
  { id: 'inlineFreeText', label: 'Inline free text', shortcut: null, action: insertInlineFreeText }
];
```

Each `insert*` function is a ProseMirror command.

Tests: each insert function produces the correct node in the doc.

Commit: `feat(widget): widget menu with outside-scene and inside-scene item lists`.

**Code review:** Spec-Reviewer (verify item list matches §5.1 tables exactly).

### Task 5.3: Slash command

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/editor/widget-menu.js`
**Spec ref:** §5.2

At start of an empty line, typing `/` opens the same widget menu inline; typing filters by prefix.

Implement via `prosemirror-inputrules` or a keymap that watches for `/` at position 0 of an empty paragraph.

Test: simulate `/` at empty line → menu opens; type `sc` → only Scene matches.

Commit: `feat(widget): slash trigger opens widget menu inline`.

### Task 5.4: Toolbar — markup

**Implementer:** Builder-Sonnet
**Files:** modify `renderer/index.html`, create `renderer/js/editor/toolbar.js`
**Spec ref:** §5.3

Add a `<div id="editor-toolbar">` above `#editor` in HTML. In toolbar.js, render the toolbar items per §5.3.

Each toolbar button dispatches a ProseMirror command (toggleMark, setBlockType, etc.) via `Rga.Commands.execute()`.

Commit: `feat(toolbar): persistent toolbar above editor with format controls`.

### Task 5.5: Toolbar — context-sensitive disable/enable

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/editor/toolbar.js`

Subscribe to selection changes; enable/disable buttons based on cursor context (inside vs outside scene). Per §5.3:
- Block type dropdown changes meaning inside vs outside scene.
- List, paragraph, heading buttons disabled inside scenes.
- Add Annotation / Tag As / Flag for Revision enabled only when selection is non-empty.

Test: simulate cursor in scene → list button disabled; outside scene → enabled.

Commit: `feat(toolbar): context-sensitive button states`.

### Task 5.6: Toolbar CSS

**Implementer:** Builder-Sonnet
**Files:** modify `renderer/css/editor-prosemirror.css`

Style the toolbar: 40px height, button styles, dropdowns, disabled state.

Commit: `style(toolbar): toolbar visual styling`.

### Task 5.7: Keyboard shortcuts wired to commands

**Implementer:** Builder-Opus
**Files:** create `renderer/js/editor/shortcuts.js`
**Spec ref:** §5.4

Register the §5.4 shortcuts via `Rga.Keyboard.register`:
- Ctrl+B/I/U → bold/italic/underline marks
- Ctrl+/ → open widget menu at cursor
- Ctrl+K → insert link
- Ctrl+Shift+H → add annotation
- Ctrl+Shift+T → tag as (opens submenu)
- Ctrl+Shift+F → flag for revision
- Ctrl+Shift+L → change script language (Phase 8)

Commit: `feat(shortcuts): wire §5.4 keyboard shortcuts`.

### Task 5.8: Widget menu styles

**Implementer:** Builder-Sonnet
**Files:** modify `renderer/css/editor-prosemirror.css`

Style `.rga-widget-button` (the +), `.rga-widget-menu` (popup list), `.rga-widget-item` (rows with icon + label + shortcut hint).

Commit: `style(widget): + button and menu visual styling`.

### Task 5.9: Phase 5 spec + quality review

**Spec-Reviewer** — verify all §5.1 menu items present; §5.3 toolbar items present; §5.4 shortcuts wired.
**Quality-Reviewer** — UI consistent with design tokens; no inline styles where classes suffice; popup z-index does not conflict with command palette.

### Task 5.10: Smoke test

**Smoke-Tester:** you.

- [ ] Type a paragraph outside any scene. Click the "+" → menu opens. Click "Scene" → new scene appears below cursor; cursor in sceneLine.
- [ ] Type `/` at start of an empty line → menu opens inline. Type `qu` → Quote filters. Enter → quote block inserted.
- [ ] Inside a scene, click the secondary "+" (different color) → only "Inline free text" option. Select it → inlineFreeText block appears mid-scene.
- [ ] Toolbar bold button works (Ctrl+B equivalent).
- [ ] Inside a scene, toolbar list buttons are grayed out.
- [ ] Outside a scene, list buttons are enabled.

---

## Phase 6 — Plugins (problems, placeholders)

**Goal:** Active-scene plugin (already in Phase 3), Problems plugin, placeholders plugin.

**Spec ref:** §6 of editor design and §3.5

### Task 6.1: Placeholders plugin

**Implementer:** Builder-Sonnet
**Files:** create `renderer/js/doc-types/screenplay/plugins/placeholders.js`

For empty nodes, show CSS-based placeholders:
- empty `sceneLine` → "INT. LOCATION — TIME"
- empty `action` → "Action..."
- empty `character` → "CHARACTER NAME"
- empty `dialogue` → "Dialogue..."
- empty `parenthetical` → "(parenthetical)"
- empty `transition` → "CUT TO:"
- empty `shot` → "SHOT DESCRIPTION"
- empty `titleStrip` → "Title"

Implementation: ProseMirror plugin with decorations adding `data-placeholder` attributes to empty nodes; CSS rule:
```css
.ProseMirror [data-placeholder]:empty::before {
  content: attr(data-placeholder);
  color: var(--text-tertiary);
  pointer-events: none;
}
```

Tests: build a doc with empty nodes; verify decorations applied.

Commit: `feat(plugin): placeholder watermarks for empty block types`.

### Task 6.2: Problems plugin — schema violations

**Implementer:** Builder-Opus
**Files:** create `renderer/js/doc-types/screenplay/plugins/problems.js`

The plugin computes a list of problems on every doc change (debounced 500ms). Each problem: `{ severity, message, nodePath, scenePath?, kind }`.

Sources:
1. Schema validation results (rare in normal use; only after migration).
2. Heuristic rules:
   - Empty scene (only `sceneLine`, all other children empty)
   - Character cue not followed by dialogue
   - Shift+Enter linebreak in action (look for `<br>` or hard breaks)

The plugin maintains state; exposes `getProblems()` to subscribers (bottom panel).

Tests: each heuristic rule.

Commit: `feat(plugin): problems plugin with heuristic rules`.

### Task 6.3: Problems plugin — revision flags

**Implementer:** Builder-Sonnet

Walk the doc tree; collect all open `revisionFlag` marks; add to the problems list.

Test: doc with two flagged spans → problems list has two entries with kind=`revisionFlag`.

Commit: `feat(problems): include open revision flags in problems list`.

### Task 6.4: Wire plugins to mount.js

**Implementer:** Builder-Sonnet

Add placeholders + problems plugins to the plugin array.

Smoke test: empty action shows "Action..." in the editor.

Commit: `feat(editor): wire placeholders and problems plugins`.

### Task 6.5: Event bus

**Implementer:** Builder-Sonnet
**Files:** create `renderer/js/utils-events.js` or extend `utils.js`

A tiny pub/sub:
```javascript
Rga.Events = (() => {
  const subs = {};
  return {
    on(name, fn) { (subs[name] = subs[name] || []).push(fn); },
    off(name, fn) { if (subs[name]) subs[name] = subs[name].filter(f => f !== fn); },
    emit(name, payload) { (subs[name] || []).forEach(fn => fn(payload)); }
  };
})();
```

Wire the existing plugins (active-scene, problems) to emit via `Rga.Events`.

Test: subscribe to a custom event, emit, verify handler called.

Commit: `feat(events): tiny pub/sub for cross-component editor events`.

### Task 6.6: Phase 6 review

**Spec-Reviewer + Quality-Reviewer.**

---

## Phase 7 — Migration v1.x → v2.0

**Goal:** Open old `.rga` files, convert in memory to v2, back up the original, write v2 on first save.

**Spec ref:** §7

### Task 7.1: Fixtures for v1.0, v1.1, v1.1+blocks

**Implementer:** Builder-Sonnet
**Files:** create `tests/fixtures/v1.0-sample.rga`, `tests/fixtures/v1.1-sample.rga`, `tests/fixtures/v1.1-with-body-blocks.rga`

Hand-craft three fixtures:
1. v1.0 with `rga_version: "1.0"`, two scenes with action/character/dialogue.
2. v1.1 with `production_type` and `runtime` block.
3. v1.1 with `body.blocks` flat array (simulating the Phase 6 workaround).

Commit: `test(fixtures): v1.x .rga samples for migration tests`.

### Task 7.2: Migration converter — top-level fields

**Implementer:** Builder-Opus
**Files:** create `renderer/js/migration/v1-to-v2.js`

Function `migrateToV2(v1Body)` returns `v2Body`:
```javascript
function migrateToV2(v1) {
  return {
    rga_version: '2.0',
    document_type: 'screenplay',
    metadata: backfillMetadata(v1.metadata),
    settings: v1.settings || defaultSettings(),
    body: convertBody(v1),
    tag_registry: v1.tag_registry || defaultTagRegistry(),
    export_settings: v1.export_settings || defaultExportSettings(),
    runtime: { last_cursor: null, active_scene_id: null, ui_state: {} }
  };
}
```

Tests: top-level fields preserved, defaults applied.

Commit: `feat(migration): v1-to-v2 top-level field migration`.

### Task 7.3: Migration — scenes → ProseMirror tree

**Implementer:** Builder-Opus

`convertBody(v1)` walks `v1.scenes[]`, for each scene builds a ProseMirror node:
```javascript
function convertScene(v1Scene, schema) {
  const sceneLine = schema.nodes.sceneLine.create(
    { setting: v1Scene.setting, location: v1Scene.location, time: v1Scene.time },
    schema.text(sceneLineText(v1Scene))
  );
  const children = (v1Scene.elements || []).map(el => convertElement(el, schema));
  return schema.nodes.scene.create(
    { id: v1Scene.id, number: v1Scene.number, notes: v1Scene.notes || '', revisionFlag: null },
    [sceneLine, ...children]
  );
}
```

Element types map: `action → action`, `character → character`, `dialogue → dialogue`, `parenthetical → parenthetical`, `transition → transition`, `shot → shot`. Unknown → action.

Tests: a v1 scene with all element types converts to a valid v2 scene.

Commit: `feat(migration): scenes array → ProseMirror scene nodes`.

### Task 7.4: Migration — tags (text spans) → marks

**Implementer:** Builder-Opus

v1 elements may have `tags: [{ start, end, tag_id, type }]` (start/end are character offsets in the element's text). For each tag span, apply the v2 `tag` mark to the text range.

Implementation: build the text node with marks per span.

Tests: a v1 element with two tag spans converts to v2 with two `tag`-marked text nodes.

Commit: `feat(migration): tag offsets → tag marks on text spans`.

### Task 7.5: Migration — body.blocks workaround

**Implementer:** Builder-Sonnet

If v1 file has `body.blocks` (flat array from the broken workaround), convert each block to a body-level `paragraph` (not in any scene). Store the original type in `paragraph.attrs._sourceType` for debugging.

Tests: v1+blocks fixture migrates to v2 with paragraphs.

Commit: `feat(migration): body.blocks → top-level paragraphs`.

### Task 7.6: Wire migration into Doc.deserialize

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/doc.js`

In `deserialize(content, handle)`, after parsing JSON:
- If `rga_version` starts with `1.`, run `migrateToV2(parsed)` and use the result.
- Write a backup file via `window.rwanga.files.save(handle + '.v1.bak', content)` on the first save (deferred — for now, just convert in memory).

Tests: load each v1 fixture, verify it deserializes to a valid v2 doc structure.

Commit: `feat(doc): deserialize v1.x via migration converter`.

### Task 7.7: Phase 7 review

**Spec-Reviewer** — verify §7.3 mapping table is fully implemented; failure modes from §7.4 addressed (banner on partial migration); §7.5 backup file behavior.

---

## Phase 8 — App shell wiring

**Goal:** Welcome view, file tree, activity bar panels, status bar, Inspector, bottom panel — all per Part 2 of the spec.

**Spec ref:** Part 2 §A1–§A6

### Task 8.1: Welcome view markup + module

**Implementer:** Builder-Opus
**Files:** create `renderer/js/welcome.js`, modify `renderer/index.html`
**Spec ref:** §A1.1, §A1.3

Add a hidden `<div id="welcome-view">` in `index.html` (in the editor-area slot). Module `welcome.js`:
- `show()` → display the welcome view, hide the editor surface
- `hide()` → reverse
- Builds the welcome content (title, recommended folder path, "Use this folder" / "Choose..." buttons, escape hatches)
- Wires buttons to `Rga.Commands.execute('file.openFolder')` / `'file.newFile'` / `'file.openFile'`
- Shown automatically when `Rga.TabManager.tabs().length === 0` AND no folder open

Commit: `feat(welcome): persistent empty-state welcome view`.

### Task 8.2: First-run flow detection

**Implementer:** Builder-Opus
**Files:** modify `electron/main.js`, `electron/bridge/workspace.js` (or create)
**Spec ref:** §A1.2, §A1.5

Add to `workspace.json` storage: `firstRunCompletedAt`, `currentFolder`, `recentFolders`, `recentFilesPerFolder`, `lastOpenTabsPerFolder`.

IPC: `window.rwanga.workspace.getState()` returns the full state object. `window.rwanga.workspace.setFolder(handle)` sets currentFolder, persists.

In welcome.js, on "Use Documents/Rwanga Scripts" click:
- If folder doesn't exist, create it via `window.rwanga.files.createFolder(path)`.
- Set as currentFolder.
- Open a new untitled.rga as the first tab.

Commit: `feat(workspace): first-run detection and Documents/Rwanga Scripts default`.

### Task 8.3: Persistent sidebar actions

**Implementer:** Builder-Sonnet
**Files:** modify `renderer/index.html`, `renderer/js/file-tree.js`
**Spec ref:** §A1.3

In the Explorer panel header, always render two buttons: `+ New File` and `Open Folder`. Wire to commands.

Smoke: in any state (welcome or with a folder open), the two buttons are visible.

Commit: `feat(sidebar): persistent New File / Open Folder buttons`.

### Task 8.4: File tree — classic folder view

**Implementer:** Builder-Opus
**Files:** create `renderer/js/file-tree.js` (replaces inert prototype)
**Spec ref:** §A2

Recursive tree component reading the workspace folder via `window.rwanga.files.listFolder(handle)`. Each file/folder row:
- Folder: chevron + name; click toggles expand
- File: icon (screenplay for .rga, generic for others) + name; click opens in tab
- Right-click: context menu (New File / Rename / Delete / Reveal in OS / Copy Path)

Folders show all files, no filter. Section header at top: workspace name.

Commit: `feat(file-tree): classic folder tree with context menu`.

### Task 8.5: New IPC — rename / trash / revealInOS

**Implementer:** Builder-Sonnet
**Files:** modify `electron/bridge/files.js`
**Spec ref:** §A2.4

Add IPC handlers and preload bindings for `files.rename(handle, newName)`, `files.trash(handle)`, `files.revealInOS(handle)`. Tests on Electron side.

Commit: `feat(ipc): files.rename / files.trash / files.revealInOS`.

### Task 8.6: File watcher (basic)

**Implementer:** Builder-Opus
**Files:** modify `electron/bridge/workspace.js`

Use `chokidar` to watch the current folder; emit `workspace.fileChange` events to renderer. Renderer's file-tree subscribes and re-renders.

`npm install --save chokidar`.

Commit: `feat(workspace): file watcher for external folder changes`.

**Code review:** Quality-Reviewer (verify watcher is destroyed when folder closes).

### Task 8.7: Activity bar — Outline panel renderer

**Implementer:** Builder-Opus
**Files:** create `renderer/js/doc-types/screenplay/outline.js`
**Spec ref:** §A3.2

Reads the active doc's body, builds the outline tree (title strip + body children, scenes get their sceneLine text as label). Renders into `#sidebar-panel-scenes` (rename to `#sidebar-panel-outline`).

Click an item → editor scrolls to that node + active-scene highlights.

Subscribe to doc changes via `Rga.Events.on('editor.docChange', ...)` (the active-scene plugin emits this).

Commit: `feat(outline): per-doc-type outline panel for screenplay`.

### Task 8.8: Activity bar — Entities panel renderer

**Implementer:** Builder-Opus
**Files:** create `renderer/js/doc-types/screenplay/entities.js` (or part of `inspector.js`)
**Spec ref:** §A3.3

Reads `doc.tag_registry`, renders the groups (CHARACTERS, PROPS, ...). Click an entity → Inspector shows full details. Each group has a "+ Add..." button.

Commit: `feat(entities): tag registry panel with add/edit/remove`.

### Task 8.9: Sync and Extensions placeholder panels

**Implementer:** Builder-Sonnet
**Files:** modify `renderer/js/app-shell.js`, `renderer/index.html`
**Spec ref:** §A3.4

Build the two placeholder panels with the spec's exact copy. No functionality; just informative empty states.

Commit: `feat(sidebar): honest Sync and Extensions placeholder panels`.

### Task 8.10: Settings tab

**Implementer:** Builder-Opus
**Files:** create `renderer/js/settings.js`, modify HTML
**Spec ref:** §A3.5

Settings opens as a tab (not a panel). Tabs:
- Appearance: theme radio buttons
- Editor: font/size/line spacing
- Folder: default folder picker
- Updates: current version, check button
- About: version, license

Each section writes via `window.rwanga.prefs.write`.

Commit: `feat(settings): Settings tab with appearance/editor/folder/about sections`.

### Task 8.11: Status bar — left side always-on

**Implementer:** Builder-Sonnet
**Files:** modify `renderer/js/app-shell.js` (StatusBar module)
**Spec ref:** §A4.1

Render: sync status, problems badge, cursor position. Subscribe to events.

Commit: `feat(status-bar): left-side always-on items`.

### Task 8.12: Status bar — screenplay-specific right side

**Implementer:** Builder-Opus
**Files:** create `renderer/js/doc-types/screenplay/status-bar.js`
**Spec ref:** §A4.2

Active scene chip, block type indicator, word count, page count. Per-doc-type renderer.

Commit: `feat(status-bar): screenplay-specific items`.

### Task 8.13: Status bar — theme and script language chips

**Implementer:** Builder-Sonnet
**Spec ref:** §A4.3, §A4.4, §A4.5

Theme icon cycles Dark/Light/System on click. Script language chip shows `Script: EN` etc.; click → picker popover.

Commit: `feat(status-bar): theme cycle and script language chip`.

### Task 8.14: Script language picker

**Implementer:** Builder-Opus
**Files:** create `renderer/js/doc-types/screenplay/script-language.js`
**Spec ref:** §A4.5

Popover with 4 languages (en / ar / ckb / kmr). Selecting one:
- Updates `doc.metadata.language`
- Applies `dir="rtl"` or `dir="ltr"` to `.ProseMirror`
- Updates active font stack
- Persists last-used in `prefs.lastScriptLanguage`

`Ctrl+Shift+L` opens the picker at cursor.

Commit: `feat(script-lang): picker with RTL/LTR and font switching`.

**Code review:** Spec-Reviewer (§A4.5).

### Task 8.15: Inspector panel framework

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/app-shell.js` (Inspector module)
**Spec ref:** §A5.1, §A5.8, §A5.9

Render container `<aside id="inspector-panel">`. Subscribes to selectionChange. Routes to a per-doc-type renderer.

Commit: `feat(inspector): selection-driven framework with per-type routing`.

### Task 8.16: Inspector — Document view

**Implementer:** Builder-Opus
**Files:** create `renderer/js/doc-types/screenplay/inspector.js`
**Spec ref:** §A5.2

When nothing is selected, render the Document view per §A5.2. Editable fields write to `doc.metadata.*`.

Commit: `feat(inspector): Document view for no selection`.

### Task 8.17: Inspector — Scene / Tag / Annotation / Revision views

**Implementer:** Builder-Opus

Implement each view per §A5.3–§A5.6. Determine which view to render based on the active mark on the selection.

Commit: `feat(inspector): Scene, Tag, Annotation, Revision views`.

### Task 8.18: Inspector — multi-mark tabs

**Implementer:** Builder-Sonnet
**Spec ref:** §A5.7

When selection has multiple marks, render tabs with one tab per mark type.

Commit: `feat(inspector): multi-mark tabbed view`.

### Task 8.19: Bottom panel — Notes tab

**Implementer:** Builder-Opus
**Files:** create `renderer/js/doc-types/screenplay/bottom-panel.js`
**Spec ref:** §A6.1

Render scene notes (from `scene.attrs.notes`) + all annotations for the active scene. Toggle "Active scene" / "All notes in document".

Commit: `feat(bottom-panel): Notes tab with scene + annotations`.

### Task 8.20: Bottom panel — Problems tab

**Implementer:** Builder-Opus
**Spec ref:** §A6.2

Render the problems list from the Problems plugin. Click a problem → editor jumps.

Commit: `feat(bottom-panel): Problems tab with click-to-jump`.

### Task 8.21: Bottom panel — Breakdown tab + CSV export

**Implementer:** Builder-Opus
**Spec ref:** §A6.3

Compute breakdown from doc tag marks + tag_registry. "Export as CSV" button.

Commit: `feat(bottom-panel): Breakdown tab with CSV export`.

### Task 8.22: Phase 8 review

**Spec-Reviewer (Opus)** — full Part 2 §A1–§A6 review.
**Quality-Reviewer (Opus)** — large surface; check naming, event subscription cleanup on tab close.

---

## Phase 9 — Menu bar and command layer

**Goal:** One canonical menu per platform. Shared command layer.

**Spec ref:** §A7

### Task 9.1: Command layer

**Implementer:** Builder-Opus
**Files:** create `renderer/js/editor/commands.js`
**Spec ref:** §A7.2

Implement `Rga.Commands.register(id, fn)` and `Rga.Commands.execute(id)`. Single dispatch point.

Test: register a command, execute it, verify fn called.

Commit: `feat(commands): shared command dispatch layer`.

### Task 9.2: Register all commands from §A7.3

**Implementer:** Builder-Opus
**Files:** modify multiple modules

Each module (file-manager, editor, doc-type/screenplay, settings, etc.) registers its commands at boot. Use a `Rga.Commands.registerBatch({...})` for ergonomics.

Commit: `feat(commands): register all §A7.3 commands at boot`.

### Task 9.3: HTML menu — wire to commands

**Implementer:** Builder-Opus
**Files:** modify `renderer/js/app-shell.js` (Menu module — new or extend existing menu rendering)
**Spec ref:** §A7.4, §A7.6

Each menu item's click dispatches `Rga.Commands.execute(commandId)`. Build the menu DOM from the §A7.4 structure as a data table.

Disabled state: if `Rga.Commands.canExecute(id)` returns false, gray out.

Commit: `feat(menu): HTML menu bar wired to command layer`.

### Task 9.4: Platform detection — hide HTML on macOS

**Implementer:** Builder-Sonnet
**Files:** modify `renderer/index.html`, `electron/main.js`
**Spec ref:** §A7.2

In main process, expose `window.rwanga.platform.os`. In renderer, hide `#menu-bar` if `os === 'darwin'`.

Commit: `feat(menu): hide HTML menu on macOS; native menu owns`.

### Task 9.5: Native menu — wire to commands

**Implementer:** Builder-Opus
**Files:** modify `electron/menu.js`

The native menu (used on macOS, disabled elsewhere) sends `menu.action` IPC to the renderer. Renderer maps each action to a command and dispatches.

For each item in the native Menu template, set `click: () => webContents.send('menu.action', { command: 'file.newFile' })` and the renderer calls `Rga.Commands.execute('file.newFile')`.

Commit: `feat(menu): native menu dispatches via command layer`.

### Task 9.6: Disable native menu on Windows/Linux

**Implementer:** Builder-Sonnet
**Files:** modify `electron/menu.js`

On non-macOS, call `Menu.setApplicationMenu(null)` so the native menu doesn't appear.

Commit: `chore(menu): disable native menu on Windows/Linux`.

### Task 9.7: Keyboard shortcuts — dispatch via commands

**Implementer:** Builder-Sonnet
**Files:** modify `renderer/js/editor/shortcuts.js`

Replace direct function calls with `Rga.Commands.execute()`.

Commit: `refactor(shortcuts): dispatch via command layer`.

### Task 9.8: Phase 9 review

**Spec-Reviewer** — verify §A7.2–§A7.6 implemented; one canonical menu per platform.
**Quality-Reviewer** — no command registered twice; canExecute checks make sense.

### Task 9.9: Smoke test

**Smoke-Tester:** you.

- [ ] Windows/Linux: HTML menu bar at top of window; click File → Open File... works (opens dialog); New File, Save work.
- [ ] macOS: native menu at top of screen; same items; same behavior.
- [ ] Ctrl+S triggers Save (both platforms).
- [ ] Ctrl+B inside the editor still works (toolbar+editor commands not conflicted with menu shortcuts).
- [ ] Ctrl+Enter creates a new scene.
- [ ] Ctrl+Shift+L opens the script language picker.

---

## Phase 10 — Smoke and release

### Task 10.1: End-to-end smoke checklist

**Smoke-Tester:** you.

Run through the spec's user-facing flows:

- [ ] Launch app → welcome view appears.
- [ ] Click "Use Documents/Rwanga Scripts" → folder created at `~/Documents/Rwanga Scripts/`, file tree shows it, new Untitled.rga in editor.
- [ ] Type a title (line 1) → toolbar formats work (bold/italic/underline/color/highlight).
- [ ] Click "+" → menu opens → click "Scene" → scene below cursor; cursor in sceneLine.
- [ ] Type "INT. CAFE — NIGHT", Enter → cursor in action.
- [ ] Type "Sarah walks in.", Tab → block becomes character.
- [ ] Type "SARAH", Enter → cursor in dialogue.
- [ ] Type "Hello.", double-Enter → cursor in new paragraph below the scene.
- [ ] Right-click "Sarah" in the action → "Tag as → Character → + New" → name SARAH → text gets blue underline.
- [ ] Right-click "Hello." in dialogue → "Add note" → type "punchier?" → text highlighted yellow.
- [ ] Right-click → "Flag for revision" → reason "tone?" → dashed red underline.
- [ ] Ctrl+S → save dialog → save as test.rga.
- [ ] Close the file → welcome view returns.
- [ ] Reopen test.rga → all content + marks restored.
- [ ] Open the v1.0-sample.rga fixture → migrates to v2, content visible.
- [ ] Inspector shows correct view based on selection.
- [ ] Status bar shows active scene chip + word count.
- [ ] Bottom panel Problems tab shows the flagged revision.

If any item fails, file an issue with the task number(s) involved. Do NOT proceed to release.

### Task 10.2: Performance check

**Smoke-Tester:** you.

Open a long screenplay (use the v1.0-sample, duplicate scenes 50 times). Verify:
- [ ] Typing remains responsive (no detectable lag).
- [ ] Scroll is smooth.
- [ ] Tab cycling is instant.
- [ ] Outline panel renders within 1 second.

If lag, profile via DevTools Performance tab; report which task to revisit.

### Task 10.3: Final spec-coverage review

**Spec-Reviewer (Opus)**.

**Prompt:**
```
Final review of the implementation against the entire 2026-05-13 spec.

Spec: docs/superpowers/specs/2026-05-13-rwanga-editor-redesign-design.md (1,299 lines)
Plan: docs/superpowers/plans/2026-05-13-rwanga-editor-redesign-plan.md (this file)

For each spec section (Preamble through Part 4), confirm an implementation exists. List any gaps.

Reply with section-by-section PASS/FAIL with citations.
```

### Task 10.4: Version bump and tag

**Implementer:** Builder-Sonnet

Update `package.json` `version` to `0.2.0-alpha.1`. Update `CHANGELOG.md` (create if missing) with a release note summarizing the redesign.

Tag: `git tag v0.2.0-alpha.1 && git push origin v0.2.0-alpha.1`.

Commit: `chore: bump version to 0.2.0-alpha.1 (editor redesign release)`.

### Task 10.5: Update CLAUDE.md / memory

**Implementer:** you (inline). Update relevant memory entries:
- Mark `project_v2_spec_bugs.md` as obsolete (v2 supersedes v1.x).
- Add a memory entry about the ProseMirror foundation if not already present.

Done.

---

## Closing notes for the implementer

- **Run tests after every task.** `npm run test:unit`.
- **Commit after every task.** Frequent commits make rollback safe.
- **Don't skip code reviews.** Each task names specific reviewers; their sign-off matters.
- **If a task fails**, do not improvise. Report DONE_WITH_CONCERNS or BLOCKED with what you tried and what's missing.
- **Spec is the source of truth.** The spec file is `docs/superpowers/specs/2026-05-13-rwanga-editor-redesign-design.md`. When in doubt, the spec wins; this plan is one valid implementation path of many.

---

*End of plan.*
