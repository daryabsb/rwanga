# Page Surface (Step A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mandatory paper-page editor surface — a theme-aware page on a desk, configurable Page Setup, and estimated page-break markers — and remove the three rejected Phase-5 chrome files.

**Architecture:** The editor area becomes a scrollable **desk** (`#editor-container`) holding a centered **page** (`.rga-page`) with a drop shadow. The page's width and margin-padding are driven by `doc.settings.pageSetup` (paper size + 4 margins), stored in the `.rga` file. A self-contained `page-breaks.js` view-plugin overlays estimated page-break lines and numbers by pixel math, structured so true pagination can replace it later without touching anything else.

**Tech Stack:** Vanilla JS (IIFE modules on `window.Rga`), ProseMirror (`window.RgaProseMirror`), CSS custom properties, `node --test` unit tests, esbuild renderer bundle.

**Scope boundary:** This plan is **Step A only** of spec `docs/superpowers/specs/2026-05-14-rwanga-editor-page-and-scene-redesign-design.md` § 5. Step B (the segmented slug-zone NodeView) is a GO/NO-GO checkpoint with a fallback branch — it gets its own plan, written after this one is verified. Do not begin Step B work from this plan.

**Working agreement (spec § 0 Contract):** If you hit any decision this plan does not explicitly make, you have hit a GAP — **STOP**, do not guess, return to the designer. New gaps get added to the Stop-Point Register. Known gaps this plan surfaces are listed in the final section.

---

## File Structure

**Deleted:**
- `rwanga-editor/renderer/js/editor/widget-menu.js` — rejected "+" widget menu
- `rwanga-editor/renderer/js/editor/toolbar.js` — rejected persistent toolbar
- `rwanga-editor/renderer/js/doc-types/screenplay/plugins/scene-line-parser.js` — obsolete (Step B replaces the whole sceneLine model)
- `rwanga-editor/tests/unit/widget-menu.test.js` — tests for the deleted widget menu

**Created:**
- `rwanga-editor/renderer/js/editor/page-surface.js` — applies `pageSetup` (size + margins) to the `.rga-page` element
- `rwanga-editor/renderer/js/editor/page-setup-dialog.js` — the Page Setup modal (`Rga.PageSetup.open`)
- `rwanga-editor/renderer/js/doc-types/screenplay/plugins/page-breaks.js` — estimated page-break overlay plugin + `estimateLinesPerPage`
- `rwanga-editor/tests/unit/editor/page-surface.test.js` — unit tests for `_cssVarsFor`
- `rwanga-editor/tests/unit/editor/page-breaks.test.js` — unit tests for `estimateLinesPerPage`

**Modified:**
- `rwanga-editor/renderer/js/constants.js` — add `PAPER_SIZES`
- `rwanga-editor/renderer/js/doc.js` — add `pageSetup` to `defaultSettings()`, backfill on deserialize
- `rwanga-editor/renderer/js/editor/mount.js` — remove 4 rejected plugin registrations, add `pageBreaksPlugin`
- `rwanga-editor/renderer/js/tab-manager.js` — call `Rga.PageSurface.apply` on tab activation
- `rwanga-editor/renderer/js/editor/shortcuts.js` — remove the dead `Ctrl+/` binding
- `rwanga-editor/renderer/index.html` — script tags, remove `#editor-toolbar`, add `.rga-page` class, remove `#gutter` (pending check), boot wiring
- `rwanga-editor/renderer/css/tokens.css` — re-set desk/page color tokens
- `rwanga-editor/renderer/css/shell.css` — collapse the toolbar grid row, make `#editor-container` a flex desk
- `rwanga-editor/renderer/css/editor-prosemirror.css` — remove widget/toolbar CSS, add desk/page CSS
- `rwanga-editor/tests/unit/doc.test.js` — add `pageSetup` round-trip tests

**Test count:** starts at 99. Task 1 removes `widget-menu.test.js` (−10 → 89). Task 2 adds 3 (→ 92). Task 5 adds 2 (→ 94). Task 7 adds 3 (→ 97).

---

## Task 1: Remove the rejected Phase-5 chrome and its wiring

The "+" widget menu, the persistent toolbar, and the scene-line parser were all rejected or made obsolete by the redesign (spec § 4.3). Remove them and every wire that touches them, leaving the build green.

**Files:**
- Delete: `rwanga-editor/renderer/js/editor/widget-menu.js`
- Delete: `rwanga-editor/renderer/js/editor/toolbar.js`
- Delete: `rwanga-editor/renderer/js/doc-types/screenplay/plugins/scene-line-parser.js`
- Delete: `rwanga-editor/tests/unit/widget-menu.test.js`
- Modify: `rwanga-editor/renderer/js/editor/mount.js:76-87`
- Modify: `rwanga-editor/renderer/js/editor/shortcuts.js:17-21`
- Modify: `rwanga-editor/renderer/index.html` (script tags ~337-339, `#editor-toolbar` div ~185, boot call)
- Modify: `rwanga-editor/renderer/css/editor-prosemirror.css` (widget + toolbar CSS blocks)
- Modify: `rwanga-editor/renderer/css/shell.css` (`#editor-area` grid)

- [ ] **Step 1: Delete the four files**

```bash
git rm rwanga-editor/renderer/js/editor/widget-menu.js
git rm rwanga-editor/renderer/js/editor/toolbar.js
git rm rwanga-editor/renderer/js/doc-types/screenplay/plugins/scene-line-parser.js
git rm rwanga-editor/tests/unit/widget-menu.test.js
```

- [ ] **Step 2: Remove the 4 rejected plugin registrations from `mount.js`**

In `rwanga-editor/renderer/js/editor/mount.js`, delete these four blocks (currently lines 76-87):

```javascript
    if (Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.widgetMenuPlugin) {
      plugins.push(Rga.DocTypes.screenplay.widgetMenuPlugin());
    }
    if (Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.slashCommandPlugin) {
      plugins.push(Rga.DocTypes.screenplay.slashCommandPlugin());
    }
    if (Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.toolbarPlugin) {
      plugins.push(Rga.DocTypes.screenplay.toolbarPlugin());
    }
    if (Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.sceneLineParserPlugin) {
      plugins.push(Rga.DocTypes.screenplay.sceneLineParserPlugin());
    }
```

Leave the surrounding plugin registrations (active-scene, context-menu, annotations, tags, revision-flags) untouched.

- [ ] **Step 3: Remove the dead `Ctrl+/` binding from `shortcuts.js`**

In `rwanga-editor/renderer/js/editor/shortcuts.js`, delete this block (currently lines 17-21):

```javascript
    // Ctrl+/ — open widget insert menu at cursor
    K.register('/', { ctrl: true, shift: false, alt: false }, function() {
      const view = _view();
      if (view) Rga.WidgetMenu && Rga.WidgetMenu.openWidgetMenu(view, null);
    });
```

Leave the `Ctrl+Shift+H`, `Ctrl+Shift+F`, `Ctrl+Shift+T` registrations — they point at Phase-4 code that is untouched.

- [ ] **Step 4: Remove the script tags and toolbar div from `index.html`**

In `rwanga-editor/renderer/index.html`:

Delete these three `<script>` lines (currently ~337-339):
```html
<script src="js/doc-types/screenplay/plugins/scene-line-parser.js"></script>
<script src="js/editor/widget-menu.js"></script>
<script src="js/editor/toolbar.js"></script>
```
Keep `<script src="js/editor/shortcuts.js"></script>`.

Delete the toolbar container (currently ~line 185):
```html
        <!-- Toolbar -->
        <div id="editor-toolbar"></div>
```

Find the boot call to `Rga.Toolbar.init()` (grep `Rga.Toolbar` in `index.html`) and delete that line. Leave `Rga.EditorShortcuts && Rga.EditorShortcuts.registerShortcuts();` in place.

- [ ] **Step 5: Collapse the toolbar grid row in `shell.css`**

In `rwanga-editor/renderer/css/shell.css`, change the `#editor-area` rule:

```css
#editor-area {
  display: grid;
  grid-template-rows: var(--tab-bar-height) var(--toolbar-height) 1fr;
  overflow: hidden;
  min-height: 0;
}
```
to:
```css
#editor-area {
  display: grid;
  grid-template-rows: var(--tab-bar-height) 1fr;
  overflow: hidden;
  min-height: 0;
}
```

- [ ] **Step 6: Remove the widget and toolbar CSS from `editor-prosemirror.css`**

In `rwanga-editor/renderer/css/editor-prosemirror.css`, delete every rule whose selector starts with `.rga-widget`, `.editor-toolbar`, or `.tb-`, together with their section-header comment blocks (the comments containing `PHASE 5 — WIDGET` and any `PHASE 5 — ... TOOLBAR`). Leave all `.ProseMirror`, `.rga-scene`, `.rga-action`, `.rga-character`, `.rga-dialogue`, and mark-related rules untouched.

- [ ] **Step 7: Build the renderer bundle**

Run: `cd rwanga-editor && npm run build:renderer`
Expected: esbuild prints a success line, no errors. (The bundle itself is unchanged — this confirms nothing references the deleted files.)

- [ ] **Step 8: Run the unit tests**

Run: `cd rwanga-editor && npm run test:unit`
Expected: `pass 89`, `fail 0`. (99 minus the 10 tests in the deleted `widget-menu.test.js`.)

- [ ] **Step 9: Boot the app and confirm a clean console**

Run: `cd rwanga-editor && npm start`
Expected: the app window opens, the editor area shows the (still old-style) editor with no toolbar strip, and the DevTools console has no `ReferenceError` / `undefined` errors mentioning `WidgetMenu`, `Toolbar`, or `sceneLineParser`. Close the app.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(editor): remove rejected Phase-5 widget menu, toolbar, scene-line parser"
```

---

## Task 2: Add the `pageSetup` data model

The page's dimensions live in `doc.settings.pageSetup` so they travel with the `.rga` file (spec § 1.3, § 4.2). Paper dimensions go in `constants.js` so both `page-surface.js` and `page-breaks.js` share one source.

**Note (Register Row 13):** spec § 1.3 says new documents should seed `pageSetup` from a global preference `prefs.defaultPageSetup`. The prefs system's existence and shape are unverified in this codebase, so this task uses a hardcoded `Letter` default in `defaultSettings()` as the interim seed source. When the prefs system is confirmed, the seed source must be rewired — this is flagged in the Stop-Point Register additions below.

**Files:**
- Modify: `rwanga-editor/renderer/js/constants.js`
- Modify: `rwanga-editor/renderer/js/doc.js:45-53` (`defaultSettings`), `:206` (deserialize)
- Test: `rwanga-editor/tests/unit/doc.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `rwanga-editor/tests/unit/doc.test.js`, after the existing `Doc.create` tests:

```javascript
test('Doc.create includes pageSetup in settings with Letter defaults', () => {
  const doc = Doc.create();
  assert.equal(doc.settings.pageSetup.paperSize, 'Letter');
  assert.deepEqual(doc.settings.pageSetup.margins, { top: 1, right: 1, bottom: 1, left: 1.5 });
});

test('Doc.serialize/deserialize round-trips pageSetup', () => {
  const schema = buildTestSchema();
  const doc = Doc.create();
  doc.settings.pageSetup.paperSize = 'A4';
  doc.settings.pageSetup.margins.left = 2;
  const reloaded = Doc.deserialize(Doc.serialize(doc), '/p.rga', { schema });
  assert.equal(reloaded.settings.pageSetup.paperSize, 'A4');
  assert.equal(reloaded.settings.pageSetup.margins.left, 2);
});

test('Doc.deserialize backfills pageSetup when an older v2.0 file lacks it', () => {
  const schema = buildTestSchema();
  const noPageSetup = JSON.stringify({
    rga_version: '2.0',
    metadata: { title: 'X' },
    settings: { theme: 'dark', font_size: 12 },
    body: null
  });
  const doc = Doc.deserialize(noPageSetup, '/old2.rga', { schema });
  assert.equal(doc.settings.pageSetup.paperSize, 'Letter');
  assert.deepEqual(doc.settings.pageSetup.margins, { top: 1, right: 1, bottom: 1, left: 1.5 });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd rwanga-editor && npm run test:unit`
Expected: FAIL — the three new tests error with `Cannot read properties of undefined (reading 'paperSize')`.

- [ ] **Step 3: Add `PAPER_SIZES` to `constants.js`**

In `rwanga-editor/renderer/js/constants.js`, add this entry to the `Rga.Constants` object (alongside the existing constants):

```javascript
    // Paper dimensions in inches { width, height }
    PAPER_SIZES: {
      Letter: { width: 8.5,  height: 11 },
      A4:     { width: 8.27, height: 11.69 },
      Legal:  { width: 8.5,  height: 14 }
    },
```

- [ ] **Step 4: Add `pageSetup` to `defaultSettings()` in `doc.js`**

In `rwanga-editor/renderer/js/doc.js`, replace the `defaultSettings` function (lines 45-53):

```javascript
  function defaultSettings() {
    return {
      theme: 'dark',
      font_size: 12,
      font_family: 'Courier Prime',
      show_scene_numbers: true,
      page_size: 'Letter',
    };
  }
```
with:
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
    };
  }
```

- [ ] **Step 5: Backfill `pageSetup` on deserialize**

In `rwanga-editor/renderer/js/doc.js`, in the `deserialize` function, the return object currently has:

```javascript
      settings: parsed.settings || defaultSettings(),
```

Replace that single line with a block that backfills `pageSetup` for older v2.0 files. Just before the `return {` statement in `deserialize`, add:

```javascript
    const settings = parsed.settings || defaultSettings();
    if (!settings.pageSetup) settings.pageSetup = defaultSettings().pageSetup;
```

and change the return object's line to:

```javascript
      settings: settings,
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd rwanga-editor && npm run test:unit`
Expected: `pass 92`, `fail 0`.

- [ ] **Step 7: Commit**

```bash
git add rwanga-editor/renderer/js/constants.js rwanga-editor/renderer/js/doc.js rwanga-editor/tests/unit/doc.test.js
git commit -m "feat(doc): add pageSetup to .rga settings with PAPER_SIZES constants"
```

---

## Task 3: Re-set the desk and page color tokens

The current tokens make the page darker than and nearly identical to the desk (spec § 1.2). Re-set them so the page is clearly distinct in both themes, and add a shadow token.

**Files:**
- Modify: `rwanga-editor/renderer/css/tokens.css`

- [ ] **Step 1: Update the dark-theme tokens**

In `rwanga-editor/renderer/css/tokens.css`, inside the `:root, [data-theme="dark"]` block, find:

```css
  --editor-bg: #1e1e1e;
  --editor-page-bg: #1a1a1a;
```
Replace with:
```css
  --editor-bg: #141414;            /* the desk — darkest */
  --editor-page-bg: #262626;       /* the page — a clear step lighter */
  --editor-page-shadow: 0 8px 28px rgba(0, 0, 0, 0.6);
```

- [ ] **Step 2: Update the light-theme tokens**

In `rwanga-editor/renderer/css/tokens.css`, inside the `[data-theme="light"]` block, find:

```css
  --editor-bg: #ffffff;
  --editor-page-bg: #fafafa;
```
Replace with:
```css
  --editor-bg: #d6d6d6;            /* the desk — grey */
  --editor-page-bg: #ffffff;       /* the page — white */
  --editor-page-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
```

- [ ] **Step 3: Commit**

```bash
git add rwanga-editor/renderer/css/tokens.css
git commit -m "style(tokens): re-set desk/page colors so the page is distinct from the desk"
```

---

## Task 4: Build the desk + page surface

Restructure the editor area: `#editor-container` becomes a scrollable desk that centers a `.rga-page` (the paper). The page owns the background, shadow, and margin-padding; `.ProseMirror` sits inside it with no padding of its own.

**Files:**
- Modify: `rwanga-editor/renderer/index.html` (~line 188-192)
- Modify: `rwanga-editor/renderer/css/shell.css` (`#editor-container`)
- Modify: `rwanga-editor/renderer/css/editor-prosemirror.css` (`.ProseMirror` rule + new desk/page rules)

- [ ] **Step 1: Check whether `#gutter` is referenced by JS**

Run: `cd rwanga-editor && grep -rn "gutter" renderer/js`
Expected: **no matches.** If there ARE matches (any JS reading `#gutter` / `getElementById('gutter')`), **STOP** — `#gutter` has a behavioral purpose this plan does not account for. Add a Stop-Point Register row and return to the designer. If there are no matches, continue.

- [ ] **Step 2: Restructure the editor container in `index.html`**

In `rwanga-editor/renderer/index.html`, find (currently ~188-192):

```html
        <!-- Editor Container (gutter + writing surface) -->
        <div id="editor-container">
          <div id="gutter"></div>
          <!-- ProseMirror mounts here in Phase 1; contenteditable managed by PM -->
          <div id="editor"></div>
        </div>
```
Replace with:
```html
        <!-- Editor Container — the "desk"; #editor is the "page" -->
        <div id="editor-container">
          <!-- ProseMirror mounts into #editor; .rga-page styles it as paper -->
          <div id="editor" class="rga-page"></div>
        </div>
```

- [ ] **Step 3: Make `#editor-container` a flex desk in `shell.css`**

In `rwanga-editor/renderer/css/shell.css`, find the `#editor-container` rule:

```css
#editor-container {
  display: grid;
  grid-template-columns: var(--gutter-width) 1fr;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--editor-bg);
  position: relative;
}
```
Replace with:
```css
#editor-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow-y: auto;
  overflow-x: auto;
  background: var(--editor-bg);
  padding: 32px 0;
  position: relative;
}
```

- [ ] **Step 4: Add the `.rga-page` rule and adjust `.ProseMirror` in `editor-prosemirror.css`**

In `rwanga-editor/renderer/css/editor-prosemirror.css`, find the `.ProseMirror` rule at the top of the file and remove its `padding` and change its `background` — replace:

```css
  line-height: 1.5;
  padding: 1.5rem;
  color: var(--text-primary);
  background: var(--bg-editor, var(--bg-primary));
}
```
with:
```css
  line-height: 1.5;
  padding: 0;
  color: var(--text-primary);
  background: transparent;
}
```

Then add this block immediately after the `.ProseMirror` rule:

```css
/* ----- THE PAGE (the paper) -----
   width / min-height / margin-padding are set inline by page-surface.js
   from doc.settings.pageSetup. These are fallbacks for before that runs. */
.rga-page {
  flex-shrink: 0;
  background: var(--editor-page-bg);
  box-shadow: var(--editor-page-shadow);
  width: 8.5in;
  min-height: 11in;
  padding: 1in 1in 1in 1.5in;
  position: relative;
}
```

- [ ] **Step 5: Build and visually verify**

Run: `cd rwanga-editor && npm run build:renderer && npm start`
Expected: the editor area now shows a distinct page (lighter rectangle with a drop shadow) centered on a darker desk. Toggle the theme (status bar theme button) — in light theme the desk is grey and the page is white. The page is wider than tall content but has a real `min-height`. Close the app.

- [ ] **Step 6: Commit**

```bash
git add rwanga-editor/renderer/index.html rwanga-editor/renderer/css/shell.css rwanga-editor/renderer/css/editor-prosemirror.css
git commit -m "feat(editor): desk + page surface — centered paper with shadow"
```

---

## Task 5: Apply `pageSetup` to the page from the document

`page-surface.js` reads `doc.settings.pageSetup` and writes the page's width / min-height / margin-padding as inline styles on `.rga-page`. The tab manager calls it whenever a tab activates.

**Files:**
- Create: `rwanga-editor/renderer/js/editor/page-surface.js`
- Modify: `rwanga-editor/renderer/js/tab-manager.js` (`activate`)
- Modify: `rwanga-editor/renderer/index.html` (script tag)
- Test: `rwanga-editor/tests/unit/editor/page-surface.test.js`

- [ ] **Step 1: Write the failing test**

Create `rwanga-editor/tests/unit/editor/page-surface.test.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('../../../renderer/js/constants.js');
require('../../../renderer/js/editor/page-surface.js');
const PageSurface = global.window.Rga.PageSurface;

test('_cssVarsFor maps a Letter pageSetup to inch CSS values', () => {
  const v = PageSurface._cssVarsFor({
    paperSize: 'Letter',
    margins: { top: 1, right: 1, bottom: 1, left: 1.5 }
  });
  assert.equal(v.width, '8.5in');
  assert.equal(v.minHeight, '11in');
  assert.equal(v.paddingTop, '1in');
  assert.equal(v.paddingLeft, '1.5in');
});

test('_cssVarsFor falls back to Letter when paperSize is unknown', () => {
  const v = PageSurface._cssVarsFor({
    paperSize: 'NotAPaper',
    margins: { top: 1, right: 1, bottom: 1, left: 1 }
  });
  assert.equal(v.width, '8.5in');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd rwanga-editor && npm run test:unit`
Expected: FAIL — `Cannot read properties of undefined (reading '_cssVarsFor')` (the module does not exist yet).

- [ ] **Step 3: Create `page-surface.js`**

Create `rwanga-editor/renderer/js/editor/page-surface.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Applies doc.settings.pageSetup (paper size + margins) to the .rga-page element.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  function _paperSizes() {
    return (Rga.Constants && Rga.Constants.PAPER_SIZES) || {
      Letter: { width: 8.5, height: 11 }
    };
  }

  // Pure: pageSetup -> { width, minHeight, paddingTop/Right/Bottom/Left } in CSS inch units.
  function cssVarsFor(pageSetup) {
    const sizes = _paperSizes();
    const paper = sizes[pageSetup.paperSize] || sizes.Letter;
    const m = pageSetup.margins;
    return {
      width: paper.width + 'in',
      minHeight: paper.height + 'in',
      paddingTop: m.top + 'in',
      paddingRight: m.right + 'in',
      paddingBottom: m.bottom + 'in',
      paddingLeft: m.left + 'in'
    };
  }

  // Apply to the live .rga-page element.
  function apply(pageSetup) {
    const page = document.querySelector('.rga-page');
    if (!page || !pageSetup || !pageSetup.margins) return;
    const v = cssVarsFor(pageSetup);
    page.style.width = v.width;
    page.style.minHeight = v.minHeight;
    page.style.paddingTop = v.paddingTop;
    page.style.paddingRight = v.paddingRight;
    page.style.paddingBottom = v.paddingBottom;
    page.style.paddingLeft = v.paddingLeft;
  }

  Rga.PageSurface = { apply, _cssVarsFor: cssVarsFor };
})();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd rwanga-editor && npm run test:unit`
Expected: `pass 94`, `fail 0`.

- [ ] **Step 5: Load `page-surface.js` in `index.html`**

In `rwanga-editor/renderer/index.html`, add this script tag immediately after `<script src="js/editor/mount.js"></script>`:

```html
<script src="js/editor/page-surface.js"></script>
```

- [ ] **Step 6: Call `PageSurface.apply` on tab activation**

In `rwanga-editor/renderer/js/tab-manager.js`, in the `activate` function, find:

```javascript
    if (editorView && tab.editorState) {
      editorView.updateState(tab.editorState);
      editorView.focus();
    }
```
Replace with:
```javascript
    if (editorView && tab.editorState) {
      editorView.updateState(tab.editorState);
      editorView.focus();
    }
    if (Rga.PageSurface && tab.doc && tab.doc.settings) {
      Rga.PageSurface.apply(tab.doc.settings.pageSetup);
    }
```

- [ ] **Step 7: Build and visually verify**

Run: `cd rwanga-editor && npm run build:renderer && npm start`
Expected: the page renders at US-Letter proportions (8.5in × 11in min) with a 1.5in left / 1in other margins of empty space between the page edge and the text. Close the app.

- [ ] **Step 8: Commit**

```bash
git add rwanga-editor/renderer/js/editor/page-surface.js rwanga-editor/renderer/js/tab-manager.js rwanga-editor/renderer/index.html rwanga-editor/tests/unit/editor/page-surface.test.js
git commit -m "feat(editor): page-surface.js applies pageSetup dimensions to the page"
```

---

## Task 6: The Page Setup dialog

A modal that edits paper size and the four margins, writes them to `doc.settings.pageSetup`, marks the doc dirty, and re-lays the page. Reuses the existing `.modal-overlay` / `.modal-dialog` CSS pattern.

**Files:**
- Create: `rwanga-editor/renderer/js/editor/page-setup-dialog.js`
- Modify: `rwanga-editor/renderer/index.html` (script tag + boot wiring)

- [ ] **Step 1: Create `page-setup-dialog.js`**

Create `rwanga-editor/renderer/js/editor/page-setup-dialog.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Page Setup modal — edits doc.settings.pageSetup (paper size + 4 margins).
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  function _paperSizeNames() {
    const sizes = (Rga.Constants && Rga.Constants.PAPER_SIZES) || { Letter: {} };
    return Object.keys(sizes);
  }

  // Build (once) and return the modal overlay element.
  function _ensureModal() {
    let overlay = document.getElementById('page-setup-modal');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'page-setup-modal';
    overlay.className = 'modal-overlay';
    overlay.hidden = true;

    const sizeOptions = _paperSizeNames()
      .map(function(n) { return '<option value="' + n + '">' + n + '</option>'; })
      .join('');

    overlay.innerHTML =
      '<div class="modal-dialog">' +
        '<div class="modal-title">Page Setup</div>' +
        '<div class="modal-msg">' +
          '<label>Paper size ' +
            '<select id="ps-paper">' + sizeOptions + '</select>' +
          '</label>' +
          '<label>Top margin (in) <input id="ps-top" type="number" step="0.1" min="0"></label>' +
          '<label>Right margin (in) <input id="ps-right" type="number" step="0.1" min="0"></label>' +
          '<label>Bottom margin (in) <input id="ps-bottom" type="number" step="0.1" min="0"></label>' +
          '<label>Left margin (in) <input id="ps-left" type="number" step="0.1" min="0"></label>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="modal-btn primary" data-choice="apply">Apply</button>' +
          '<button class="modal-btn secondary" data-choice="cancel">Cancel</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    return overlay;
  }

  // open(doc, onApply): show the modal seeded from doc.settings.pageSetup.
  // On Apply: write doc.settings.pageSetup, mark dirty, call onApply().
  function open(doc, onApply) {
    if (!doc || !doc.settings || !doc.settings.pageSetup) return;
    const overlay = _ensureModal();
    const ps = doc.settings.pageSetup;

    const paper  = overlay.querySelector('#ps-paper');
    const top    = overlay.querySelector('#ps-top');
    const right  = overlay.querySelector('#ps-right');
    const bottom = overlay.querySelector('#ps-bottom');
    const left   = overlay.querySelector('#ps-left');

    paper.value  = ps.paperSize;
    top.value    = ps.margins.top;
    right.value  = ps.margins.right;
    bottom.value = ps.margins.bottom;
    left.value   = ps.margins.left;

    function close() {
      overlay.hidden = true;
      overlay.onclick = null;
    }

    overlay.onclick = function(e) {
      const choice = e.target && e.target.dataset && e.target.dataset.choice;
      if (choice === 'cancel') { close(); return; }
      if (choice === 'apply') {
        ps.paperSize = paper.value;
        ps.margins = {
          top:    parseFloat(top.value)    || 0,
          right:  parseFloat(right.value)  || 0,
          bottom: parseFloat(bottom.value) || 0,
          left:   parseFloat(left.value)   || 0
        };
        if (Rga.Doc && Rga.Doc.markDirty) Rga.Doc.markDirty(doc);
        if (typeof onApply === 'function') onApply(ps);
        close();
      }
    };

    overlay.hidden = false;
  }

  Rga.PageSetup = { open };

  // TEMPORARY trigger for Step A verification — Ctrl+Shift+G opens Page Setup.
  // The permanent trigger (a File menu item) is tracked in the Stop-Point Register.
  if (Rga.Keyboard && Rga.Keyboard.register) {
    Rga.Keyboard.register('g', { ctrl: true, shift: true, alt: false }, function() {
      const doc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
      if (doc) open(doc, function(ps) {
        if (Rga.PageSurface) Rga.PageSurface.apply(ps);
      });
    });
  }
})();
```

- [ ] **Step 2: Load `page-setup-dialog.js` in `index.html`**

In `rwanga-editor/renderer/index.html`, add this script tag immediately after `<script src="js/editor/page-surface.js"></script>`:

```html
<script src="js/editor/page-setup-dialog.js"></script>
```

- [ ] **Step 3: Build and verify the dialog re-lays the page**

Run: `cd rwanga-editor && npm run build:renderer && npm start`
Expected: with a document open, press `Ctrl+Shift+G` → the Page Setup modal appears, seeded with `Letter` and `1 / 1 / 1 / 1.5`. Change paper size to `A4` and left margin to `2`, click **Apply** → the page visibly changes proportions and the left margin widens. The tab shows the dirty indicator. Close the app.

- [ ] **Step 4: Run the unit tests (regression check)**

Run: `cd rwanga-editor && npm run test:unit`
Expected: `pass 94`, `fail 0` (no new tests; this confirms nothing broke).

- [ ] **Step 5: Commit**

```bash
git add rwanga-editor/renderer/js/editor/page-setup-dialog.js rwanga-editor/renderer/index.html
git commit -m "feat(editor): Page Setup dialog edits paper size and margins"
```

---

## Task 7: Estimated page-break markers

`page-breaks.js` exposes the pure `estimateLinesPerPage` function (unit-tested) and a `pageBreaksPlugin` that overlays horizontal break lines + page numbers on the page by pixel math. It is self-contained so true pagination can replace it later (spec § 1.4).

**Files:**
- Create: `rwanga-editor/renderer/js/doc-types/screenplay/plugins/page-breaks.js`
- Test: `rwanga-editor/tests/unit/editor/page-breaks.test.js`

- [ ] **Step 1: Write the failing test**

Create `rwanga-editor/tests/unit/editor/page-breaks.test.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('../../../renderer/js/constants.js');
require('../../../renderer/js/doc-types/screenplay/plugins/page-breaks.js');
const PageBreaks = global.window.Rga.PageBreaks;

test('estimateLinesPerPage: Letter with 1in top/bottom margins = 54 lines', () => {
  // (11 - 1 - 1) usable inches * 6 lines/inch = 54
  const lpp = PageBreaks.estimateLinesPerPage({
    paperSize: 'Letter',
    margins: { top: 1, right: 1, bottom: 1, left: 1.5 }
  });
  assert.equal(lpp, 54);
});

test('estimateLinesPerPage: A4 with 1in top/bottom margins = 58 lines', () => {
  // (11.69 - 2) * 6 = 58.14 -> floor 58
  const lpp = PageBreaks.estimateLinesPerPage({
    paperSize: 'A4',
    margins: { top: 1, right: 1, bottom: 1, left: 1.5 }
  });
  assert.equal(lpp, 58);
});

test('estimateLinesPerPage: unknown paper size falls back to Letter', () => {
  const lpp = PageBreaks.estimateLinesPerPage({
    paperSize: 'NotAPaper',
    margins: { top: 1, right: 1, bottom: 1, left: 1 }
  });
  assert.equal(lpp, 54);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd rwanga-editor && npm run test:unit`
Expected: FAIL — `Cannot read properties of undefined (reading 'estimateLinesPerPage')`.

- [ ] **Step 3: Create `page-breaks.js`**

Create `rwanga-editor/renderer/js/doc-types/screenplay/plugins/page-breaks.js`:

```javascript
// Copyright (c) 2026 Rwanga. Licensed under Apache 2.0.
// Estimated page-break overlay. Step A: pixel-math estimate, not true pagination.
// Self-contained so true pagination (v0.2) can replace it without touching callers.
'use strict';

(function() {
  const Rga = window.Rga = window.Rga || {};

  // 12pt Courier sets 6 lines per inch — the industry estimate.
  const LINES_PER_INCH = 6;
  // CSS resolves 1 inch as 96 px.
  const PX_PER_INCH = 96;

  function _paperSizes() {
    return (Rga.Constants && Rga.Constants.PAPER_SIZES) || {
      Letter: { width: 8.5, height: 11 }
    };
  }

  // Pure: pageSetup -> estimated text lines that fit on one page.
  function estimateLinesPerPage(pageSetup) {
    const sizes = _paperSizes();
    const paper = sizes[pageSetup.paperSize] || sizes.Letter;
    const usableHeightIn = paper.height - pageSetup.margins.top - pageSetup.margins.bottom;
    return Math.floor(usableHeightIn * LINES_PER_INCH);
  }

  // Full page height in CSS px. The .rga-page element's height includes its
  // margin-padding, so page breaks are placed against the FULL page height —
  // usable height is only for estimateLinesPerPage, not for break placement.
  function _fullPageHeightPx(pageSetup) {
    const sizes = _paperSizes();
    const paper = sizes[pageSetup.paperSize] || sizes.Letter;
    return paper.height * PX_PER_INCH;
  }

  // Render break-line + page-number overlay elements inside .rga-page.
  function _renderBreaks(pageEl, pageSetup) {
    let layer = pageEl.querySelector('.rga-page-break-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'rga-page-break-layer';
      pageEl.appendChild(layer);
    }
    const fullPx = _fullPageHeightPx(pageSetup);
    if (fullPx <= 0) { layer.innerHTML = ''; return; }

    // ceil(height / page) - 1 = page boundaries inside the content.
    // An exactly-one-page document yields 0 breaks; just-over-one-page yields 1.
    const nBreaks = Math.max(0, Math.ceil(pageEl.scrollHeight / fullPx) - 1);

    layer.innerHTML = '';
    for (let i = 1; i <= nBreaks; i++) {
      const mark = document.createElement('div');
      mark.className = 'rga-page-break';
      mark.style.top = (i * fullPx) + 'px';
      mark.dataset.pageLabel = 'page ' + (i + 1);
      layer.appendChild(mark);
    }
  }

  // ProseMirror view-plugin: re-renders the overlay on every editor update.
  // getPageSetup() must return the active doc's pageSetup object.
  function pageBreaksPlugin(getPageSetup) {
    const PM = window.RgaProseMirror;
    return new PM.Plugin({
      view: function() {
        return {
          update: function() {
            const pageEl = document.querySelector('.rga-page');
            const ps = getPageSetup && getPageSetup();
            if (pageEl && ps && ps.margins) _renderBreaks(pageEl, ps);
          }
        };
      }
    });
  }

  Rga.PageBreaks = {
    estimateLinesPerPage,
    pageBreaksPlugin,
    _LINES_PER_INCH: LINES_PER_INCH,
    _PX_PER_INCH: PX_PER_INCH
  };
  Rga.DocTypes = Rga.DocTypes || {};
  Rga.DocTypes.screenplay = Rga.DocTypes.screenplay || {};
  Rga.DocTypes.screenplay.pageBreaksPlugin = pageBreaksPlugin;
})();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd rwanga-editor && npm run test:unit`
Expected: `pass 97`, `fail 0`.

- [ ] **Step 5: Add the break-marker CSS**

In `rwanga-editor/renderer/css/editor-prosemirror.css`, add this block immediately after the `.rga-page` rule added in Task 4:

```css
/* ----- ESTIMATED PAGE BREAKS (Step A — replaced by true pagination in v0.2) ----- */
.rga-page-break-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.rga-page-break {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed var(--border-secondary, #444);
}
.rga-page-break::after {
  content: attr(data-page-label);
  position: absolute;
  right: 8px;
  top: 2px;
  font-size: var(--font-size-xs, 10px);
  color: var(--text-tertiary, #6e6e6e);
}
```

- [ ] **Step 6: Commit**

```bash
git add rwanga-editor/renderer/js/doc-types/screenplay/plugins/page-breaks.js rwanga-editor/tests/unit/editor/page-breaks.test.js rwanga-editor/renderer/css/editor-prosemirror.css
git commit -m "feat(editor): page-breaks.js — estimated page-break overlay plugin"
```

---

## Task 8: Wire the page-breaks plugin and verify Step A end to end

**Files:**
- Modify: `rwanga-editor/renderer/index.html` (script tag)
- Modify: `rwanga-editor/renderer/js/editor/mount.js` (register `pageBreaksPlugin`)

- [ ] **Step 1: Load `page-breaks.js` in `index.html`**

In `rwanga-editor/renderer/index.html`, add this script tag immediately after `<script src="js/doc-types/screenplay/plugins/revision-flags.js"></script>`:

```html
<script src="js/doc-types/screenplay/plugins/page-breaks.js"></script>
```

- [ ] **Step 2: Register `pageBreaksPlugin` in `mount.js`**

In `rwanga-editor/renderer/js/editor/mount.js`, find the block where the remaining doc-type plugins are pushed (after the revision-flags registration). Add:

```javascript
    if (Rga.DocTypes && Rga.DocTypes.screenplay && Rga.DocTypes.screenplay.pageBreaksPlugin) {
      plugins.push(Rga.DocTypes.screenplay.pageBreaksPlugin(function() {
        const doc = Rga.TabManager && Rga.TabManager.activeDoc && Rga.TabManager.activeDoc();
        return doc && doc.settings ? doc.settings.pageSetup : null;
      }));
    }
```

- [ ] **Step 3: Build the renderer**

Run: `cd rwanga-editor && npm run build:renderer`
Expected: esbuild success, no errors.

- [ ] **Step 4: Run the full unit suite**

Run: `cd rwanga-editor && npm run test:unit`
Expected: `pass 97`, `fail 0`.

- [ ] **Step 5: Full Step A manual verification (spec § 5 Step A)**

Run: `cd rwanga-editor && npm start`. Confirm all four:
1. **Paper on a desk** — the editor area shows a distinct page (lighter, with a drop shadow) centered on a darker desk.
2. **Theme flip** — toggling the theme flips both layers (dark: dark page on darker desk; light: white page on grey desk).
3. **Page Setup re-lays** — `Ctrl+Shift+G` opens the Page Setup dialog; changing paper size / margins and clicking Apply visibly re-lays the page.
4. **Estimated page breaks** — type or paste enough content to exceed one page height; dashed break lines with "page N" labels appear at each page-height interval.

If any of the four fails, **STOP** and diagnose before committing — Step A is the foundation every later step sits on.

- [ ] **Step 6: Commit**

```bash
git add rwanga-editor/renderer/index.html rwanga-editor/renderer/js/editor/mount.js
git commit -m "feat(editor): wire page-breaks plugin; Step A page surface complete"
```

---

## End of Step A — STOP

Step A is a complete, shippable unit: a mandatory paper page, theme-aware, with configurable Page Setup and estimated page breaks.

**Do not continue to Step B from this plan.** Step B (the segmented slug-zone NodeView) is a GO/NO-GO checkpoint with a fallback branch (spec § 5, Register Row 3). It requires its own plan, written after Step A is verified and accepted. Steps C, D, E are planned only after Step B's checkpoint resolves, because they depend on whether B took the primary path or the fallback.

## Stop-Point Register additions (fold back into spec § 6)

This plan surfaced these gaps. The designer should add them to the spec's Stop-Point Register:

| # | Point | Status |
|---|---|---|
| 9 | `shortcuts.js` `Ctrl+/` binding was removed with `widget-menu.js` (Task 1). The `/` slash-command surface is now fully unimplemented — consistent with existing Register Row 8 (STOP: `/` slash-command home undecided). | Consequence of Row 8 |
| 10 | `#gutter` element — Task 4 Step 1 checks for JS usage and removes it if unused. If it WAS used, the build stops there. | Resolved by in-task check |
| 11 | Page Setup dialog permanent trigger — Step A wires a TEMPORARY `Ctrl+Shift+G` shortcut. The permanent home (a `File > Page Setup…` menu item) must be wired when the menu bar is addressed. | **STOP — undecided** |
| 12 | No-tab empty state — when all tabs are closed, `.rga-page` keeps the last document's dimensions (no doc → no `pageSetup`). Acceptable for Step A; revisit when the Welcome view is built. | Deferred — acceptable |
| 13 | Spec § 1.3 says `pageSetup` seeds from a global preference `prefs.defaultPageSetup`. The prefs system is unverified in this codebase; Task 2 uses a hardcoded `Letter` default in `defaultSettings()` as the interim seed source. | **STOP — verify the prefs system, then rewire the seed source** |
| 14 | `page-breaks.js` uses a self-contained DOM pixel-overlay synced by a view-plugin (not ProseMirror `Decoration` objects) and places breaks by measured pixel height (not a computed line count). It meets § 1.4's core requirement — self-contained and replaceable — but deviates from § 1.4's literal "ProseMirror decorations" / "lines-per-page" wording. `estimateLinesPerPage` is still provided and unit-tested. | **CONFIRM** the deviation is acceptable, or update § 1.4 wording |
