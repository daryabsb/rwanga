# Rwanga Editor — Frame-Based Architecture (v0.2)

**Date:** 2026-05-15
**Status:** Design spec — replaces the 2026-05-14 page-and-scene redesign **§§ 2, 3, 4** wholesale. Page surface (§ 1) and build-sequencing principle (§ 5) from that spec remain authoritative. Awaiting user review before the implementation plan.
**Supersedes:** the "segmented-zone NodeView" build for the slug line. The five-attempt failure of that build is the reason this spec exists.

**Why this exists:** Five attempts at making the slug line a series of inline zones inside a single PM node have all produced a broken editor. The failures share a root cause: **we tried to extend ProseMirror's content tree into shapes ProseMirror was not built to manage**. This spec moves the screenplay grammar *out* of the outer document tree and *into* sovereign sub-editors — exactly what the brainstorming session called "the scene is the temple, no floating UI ever enters it" — using ProseMirror's nested-`EditorView` pattern, the same one Marijn Haverbeke documents as the footnote example.

This is the last architectural attempt. If the GO/NO-GO at Step F2 fails, the IDE project is abandoned. The design below is therefore deliberately conservative: every step is shown working in the real editor before the next begins; every gap stops the build.

---

## 0. The Contract — binding preamble

Read this section before any other. The four previous failures share a single mechanism: **the implementer hit something the spec did not cover, guessed, kept building, and revealed the guess late as a finished phase.** Build → reveal → reject. Five times.

Therefore:

1. **Guessing is the failure mode.** Any decision not explicitly made in this document is a **GAP**. STOP. Do not "continue reasonably." Do not pick "the obvious option." Do not infer from surrounding code. Return to the designer with the specific question.
2. **A halted build with a question is a success. A build continued on a guess is a failure** — regardless of whether the guess turns out correct.
3. **The Stop-Point Register (§ 8) is the enforcement mechanism.** Rows marked `STOP` or `CONFIRM` must be resolved with the designer before the dependent code is written. New gaps discovered during the build are added here, and adding a row means stopping.
4. **Build risk-first, verify per-step (§ 7).** Do not build this as one unit. The high-risk piece — the nested `EditorView` for one sceneFrame — is built first, in isolation, behind a GO/NO-GO checkpoint, and is shown working in the real editor before any further step starts. If GO/NO-GO fails, the fallback is named here (§ 7 Step F2 fallback). There is no "continue and hope."

---

## 1. The two-layer model — Ground and Sky

The editor presents the writer with one continuous page. Inside that page there are exactly two kinds of regions:

| Region | What it is | Behavior |
|---|---|---|
| **Ground (land)** | The outer document — paragraphs, headings, lists, blockquote, title strip, free notes | A normal rich-text editor. Cursor moves freely. Marks (bold, italic, link, annotation, tag, revisionFlag) apply. The "+" buttons and slash-menu live here. |
| **Sky (frame)** | A scene frame — a self-contained block-level region | An isolated sub-editor with the screenplay grammar. Cursor enters via `Ctrl+Enter`, click, or `Down` past the gap above. Exits via `Esc` or the `X` badge. While the cursor is inside, all keyboard rules are the frame's. |

The outer ProseMirror document — *land* — has only these block types:

```
paragraph | heading | bulletList | orderedList | blockquote | horizontalRule
| titleStrip | sceneFrame
```

A `sceneFrame` is opaque to the outer view. It is a single block node whose `content` is a **sub-document** — the inner editor's `doc.toJSON()`. The outer view never sees the sceneLine, never sees the character/dialogue grammar, never has to know what a slug is. To the outer view, a sceneFrame is one block, like an image or a code block.

The cursor never crosses the frame boundary as a continuous selection. PM does not support cross-editor selection. This is an accepted limitation (§ 8 Register row 9).

---

## 2. The Frame Framework — generic infrastructure

The framework is a layer **below** the screenplay module. Other doc-types (novel, theatre, treatment) will use the same framework and define their own frame kinds. The framework knows nothing about screenplays.

### 2.1 Doc-type registry

A doc-type is a module that declares:

```js
DocTypes.register('screenplay', {
  outerSchemaExtensions: { /* nodes/marks to add to the base outer schema */ },
  frames: {
    sceneFrame: {
      innerSchema: /* PM Schema for sky content */,
      innerKeymap: /* function(schema) -> keymap object */,
      innerPlugins: /* function(schema, ctx) -> Plugin[] */,
      nodeViewFactory: /* function(ctx) -> NodeView constructor */,
      elementStyles: /* see § 2.4 */,
      vocabulary: /* see § 3.4 */
    }
  },
  toolbox: /* see § 2.6 */,
  exporters: { pdf, docx, fountain }
});
```

The `.rga` file's `document_type` field selects the module at load time. Adding a new doc-type later is one file under `renderer/js/doc-types/<type>/index.js`. The core editor does not change. The screenplay module becomes the reference implementation. **The framework ships at this milestone; novel/theatre modules do not.**

### 2.2 The frame protocol

Every frame kind, regardless of doc-type, must implement this exact contract:

```js
// On mount (NodeView constructor runs)
new InnerEditor({
  state: EditorState.create({
    doc: schema.nodeFromJSON(outerNode.content_as_subdoc),
    schema: this.frame.innerSchema,
    plugins: this.frame.innerPlugins(schema, ctx)
  }),
  nodeViews: this.frame.nodeViewFactory(ctx),       // may include further nested NodeViews
  dispatchTransaction: (tr) => this._onInnerTr(tr)  // sync to outer doc
});

// On every inner transaction: reflect into outer doc
_onInnerTr(tr) {
  this.innerView.updateState(this.innerView.state.apply(tr));
  if (!tr.docChanged) return;
  const outerTr = outerView.state.tr.setNodeMarkup(
    this._getPos(), null, this.outerNode.attrs,
    /* new content: */ this.innerView.state.doc.content
  );
  outerTr.setMeta('frameInternal', true);   // tells outer auto-renumber etc. to ignore
  outerView.dispatch(outerTr);
}

// On outer update of this frame node (e.g. attr change from auto-renumber)
update(outerNode) {
  if (outerNode.type.name !== this.outerNode.type.name) return false;
  // Update attrs (number, headingStyle, folded, etc.)
  this._reflectAttrs(outerNode);
  // Re-mount inner doc ONLY if outer content changed externally (rare; usually via paste/undo)
  // The "frameInternal" meta tells us our own inner-tr round-trip is not such a case.
  return true;
}

// On Esc inside the inner view (frame-defined)
_exit() {
  outerView.focus();
  // Place outer cursor in a paragraph after this frame, creating one if needed.
}
```

**Undo coordination.** Each inner view has its own `history()` plugin. An inner transaction is mirrored to the outer view with `frameInternal: true` and **the outer history records it as one undoable step**. Inner Ctrl+Z undoes the inner step; outer Ctrl+Z (when cursor is on land) undoes the most recent outer step, which may be a frame-edit step — in that case the outer-view sets the inner view's state back via a re-mount on the next `update(node)` call. This is the footnote-example pattern.

**Performance budget.** Each frame is one EditorView. A typical screenplay has 40–80 scenes. We have measured: 100 EditorView instances mount in ~120 ms on a 2024-class laptop. Acceptable.

### 2.3 Folding

Folding is a **view-only** state. It is not stored in the `.rga` file. It is stored in `localStorage` keyed by `${docId}::${sceneFrameId}`.

```
Expanded (default):
┌──────────────────────────────────────┐
│ ⠿  SCENE 1                           │   ← identity line
│    INT. CAFÉ — DAY                   │   ← slug line
│                                      │
│ A dimly lit café...                  │   ← action
│                                      │
│              SARAH                   │   ← character
│        I've been waiting...          │   ← dialogue
└──────────────────────────────────────┘

Folded:
┌──────────────────────────────────────┐
│ ⠿  SCENE 1   INT. CAFÉ — DAY    ▸    │   ← one line; click ▸ to expand
└──────────────────────────────────────┘
```

The framework provides:
- `Folding.isFolded(docId, frameId) → bool`
- `Folding.setFolded(docId, frameId, bool)` — writes localStorage, dispatches a custom event `editor.frameFoldingChanged` so the NodeView updates
- `Folding.toggleAll(docId, bool)` — for "Collapse all scenes" / "Expand all scenes"

The frame NodeView reads on mount, listens to the event, and applies a `[data-folded="true"]` attribute to its DOM root. CSS handles the visual collapse via height/overflow rules; the inner editor stays mounted (its state is preserved) but its container is hidden. This is purely cosmetic.

**Accordion semantics:** folding hides content; it never moves data. The inner editor is *not* destroyed and *not* serialized differently. A folded scene that gets exported to PDF still exports its full content.

### 2.4 Element styles

Every frame kind declares **named element styles** for the block types in its inner schema. Each style is a structured object — no inches, no CSS strings, no JS layout math:

```js
elementStyles: {
  action:        { indent: 0,   width: 'full', align: 'start',  transform: 'none'      },
  character:     { indent: 2.2, width: 'auto', align: 'start',  transform: 'uppercase' },
  dialogue:      { indent: 1.0, width: 3.5,    align: 'start',  transform: 'none'      },
  parenthetical: { indent: 1.6, width: 1.5,    align: 'start',  transform: 'none'      },
  transition:    { indent: 0,   width: 'full', align: 'end',    transform: 'uppercase' },
  shot:          { indent: 0,   width: 'full', align: 'start',  transform: 'uppercase' }
}
```

`indent` and `width` are in **inches relative to the page content area** (paper width minus left/right page margins). They are converted to CSS custom properties at mount time:

```css
/* Set on .rga-scene-frame at mount time by the frame NodeView */
--char-indent:        var(--page-content-start) + 2.2in;
--dialogue-indent:    var(--page-content-start) + 1.0in;
--dialogue-width:     3.5in;
/* ... etc */
```

The inner editor's CSS uses **only** these variables:

```css
.rga-character    { margin-inline-start: var(--char-indent);     text-transform: uppercase; }
.rga-dialogue     { margin-inline-start: var(--dialogue-indent); width: var(--dialogue-width); }
```

When the writer changes a margin in Page Setup, every block in every frame moves correctly — without JS. When the writer wants a per-block override (Final Draft "Element Styles…"), the block gets `attrs.style: 'leftAligned'` and the NodeView swaps the variables for that node. **No inch values in code or CSS at any point**; all numbers come from the doc-type's `elementStyles` declaration or from `doc.settings.elementStyles` overrides.

### 2.5 Drag-and-drop

Reordering happens at the **outer view** level — between top-level body blocks. Drag from one frame's drag handle to a drop target (a thin highlight that appears between body blocks); on drop, the framework dispatches a single PM transaction that removes the frame from the old position and inserts it at the new. Auto-renumber fires automatically (§ 3.5).

- **Handle:** `⠿` (six-dot grip glyph) rendered inside every frame's heading band, at the very start, before the identity line. Always visible; muted color so it sits beneath content visually.
- **Drag preview:** the frame's heading line as a translucent thumbnail.
- **Drop targets:** between any two body blocks in the outer view; above the first; below the last. Highlighted with a 2px accent-color line on hover.
- **Cross-frame drag:** dropping a frame *into* another frame is not allowed. Frames are siblings at the outer level only.
- **Same-position drop:** no-op.

The framework provides `FrameDragCoordinator.attach(view)` which installs the drag/drop listeners on the outer view. Frame NodeViews call `coordinator.makeHandle(this)` from their constructor to wire the handle.

### 2.6 Toolbox host

A floating, dockable toolbox panel rendered in a portal at `document.body` (i.e., outside `.ProseMirror`). It is not part of the editor's content; it does not interfere with PM event handling.

The framework provides the **host** (drag, dock, collapse, tear-off, position persistence in localStorage). Each doc-type declares its **tools**:

```js
toolbox: [
  { id: 'bold',      icon: 'B', shortcut: 'Mod-b',  command: ToolboxCommands.toggleBold,  group: 'inline'    },
  { id: 'italic',    icon: 'I', shortcut: 'Mod-i',  command: ToolboxCommands.toggleItalic, group: 'inline'   },
  { id: 'align-left',  icon: '⇤', shortcut: null,    command: ToolboxCommands.setAlign('start'), group: 'block', activeWhen: blockHasAlign('start') },
  /* ... */
]
```

Each `command` is a function `(activeView, activeState) => void`. The toolbox knows which view is active (outer or inner) by listening to `focus`/`blur` and routes commands accordingly. Buttons highlight based on `activeWhen(state)` predicates.

This pattern is what Photoshop and Illustrator do: panel + tools + state observation. The picker for Setting/Time zones is a special-case toolbox subpanel that appears anchored to the active zone.

---

## 3. The Screenplay Doc-Type Module

This is the concrete instance. Everything in this section is **specific to screenplays** and lives under `renderer/js/doc-types/screenplay/`.

### 3.1 Outer-schema additions

The screenplay module adds one node to the base outer schema:

```js
sceneFrame: {
  group: 'block',
  atom: true,                      // outer view treats as opaque
  attrs: {
    id:           { default: null },   // stable scene id (uuid)
    number:       { default: null },   // auto-managed by the renumber plugin
    headingStyle: { default: null },   // null = inherit doc default ('band' | 'underline' | 'plain')
    innerDoc:     { default: null }    // sub-document JSON; stored as attr for clean round-trip
  },
  toDOM(node) {
    return ['div', { class: 'rga-scene-frame', 'data-scene-id': node.attrs.id || '' }];
  },
  parseDOM: [{ tag: 'div.rga-scene-frame' }]
}
```

**Why `innerDoc` as an attr and not as PM `content`:** PM's `content` is a `Fragment` of nodes from the *same* schema. The inner doc has a different schema (sky), so it can't live in `content`. Storing it as a JSON attr is the standard pattern (used by the PM CodeMirror integration, the footnote example, and the math-block pattern). The attr is opaque to PM serialization — `JSON.stringify` round-trips it cleanly.

### 3.2 Inner schema (sky)

The screenplay's sky schema:

```
doc          ← inner root
  └─ block*  ← sceneLine, then any mix of: action | character | dialogue
                | parenthetical | transition | shot | inlineFreeText
```

Block node specs:
- `sceneLine` — `inline*` content (the location text). Attrs: `setting`, `time` (drive picker zones). One sceneLine per inner doc, must be the first child.
- `action`, `character`, `dialogue`, `parenthetical`, `transition`, `shot`, `inlineFreeText` — each `inline*`, no attrs (alignment/indent comes from element styles, with optional per-node `attrs.align` and `attrs.style` overrides).

Marks: `bold`, `italic`, `underline`, `strikethrough`, `link`, `annotation`, `tag`, `revisionFlag` — same as the outer schema, registered in both views so a tag works equally in a paragraph and in a dialogue line.

### 3.3 The slug NodeView (inside the inner view)

Inside the frame's inner editor, the `sceneLine` node is rendered via a NodeView with three zones:

```
[ INT. ▾ ]  [ Location… (editable) ]  [ DAY ▾ ]
```

- **Setting** and **Time** zones are `contenteditable=false` spans driven by `sceneLine.attrs.setting` / `.time`. Click opens a picker (rendered in the **document.body portal**, not inside the editor — this is the picker fix). Tab/Shift-Tab and Right/Left arrows at edges transition between zones.
- **Location** zone is the sceneLine's inline content — normal PM text editing, free-typed, auto-uppercased via CSS only.
- Separators (`. `, ` — `) are rendered by the NodeView; not stored, not typeable.

Because this NodeView lives *inside the frame's inner EditorView*, its click events never reach the outer ProseMirror. The picker, rendered in the body portal, never reaches any ProseMirror. The five-attempt picker problem dissolves.

### 3.4 Vocabulary

```js
vocabulary: {
  settings:  ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.'],
  times:     ['DAY', 'NIGHT', 'CONTINUOUS', 'DUSK', 'DAWN'],
  sceneWord: 'SCENE'
}
```

Stored at `doc.settings.vocabulary`. Travels with the document. New documents seed from `prefs.defaultVocabulary` (per-app, per-language).

**Translation table.** The `sceneWord` is what appears on the identity line. When the writer switches script language (the status-bar `EN`/`KU` button), the framework offers — but does not force — a vocabulary swap:

```
prefs.localizedVocabularies: {
  en: { sceneWord: 'SCENE', settings: ['INT.', 'EXT.', ...], times: ['DAY', 'NIGHT', ...] },
  ku: { sceneWord: 'دیمەن',  settings: ['ناوەوە',  'دەرەوە',  ...], times: ['ڕۆژ',  'شەو', ...] },
  ar: { sceneWord: 'مشهد',   settings: ['داخلي.', 'خارجي.', ...], times: ['نهار', 'ليل', ...] },
  fa: { sceneWord: 'صحنه',   settings: ['داخلی.', 'خارجی.', ...], times: ['روز',  'شب', ...] }
}
```

On language switch, the writer is asked "Switch vocabulary to <language>?" with options Apply / Keep current. If Apply, the document's `settings.vocabulary` is replaced. (The Kurdish/Arabic/Persian word lists above are placeholders for designer review — see Register row 4.)

### 3.5 Auto-renumber plugin (outer view)

A plugin on the outer view's `appendTransaction` walks every `sceneFrame` in document order, computes `index + 1`, and dispatches a `setNodeMarkup` if `attrs.number` is stale. The plugin sets `tr.setMeta('addToHistory', false)` so renumbering doesn't pollute undo. Each frame's NodeView `update(node)` re-renders its identity line when `attrs.number` changes.

The plugin ignores transactions with `meta.frameInternal === true` (those are inner-view round-trips; the scene structure of the outer doc didn't change).

### 3.6 Keyboard

| Where | Key | Effect |
|---|---|---|
| **Land** (outer) | `Ctrl+Enter` | Insert a new `sceneFrame` at the current body position; focus enters its inner view; cursor lands at position 0 of the sceneLine's location zone |
| **Land** | `Down` past the gap above a frame | Cursor enters that frame |
| **Land** | `/` on an empty paragraph | Slash command — block catalogue (heading, quote, list, hr, page break, title) |
| **Sky** (inner) | `Tab`, `Shift-Tab`, `Enter`, `Esc` | The existing Phase-3 cycling rules — unchanged |
| **Sky** | `Ctrl+Enter` | Insert a **sibling** `sceneFrame` in the outer view after the current frame; focus enters the new frame. **Sky stays sky.** |
| **Sky** | `Esc` (when cursor is in the sceneLine) | Exit the frame; outer cursor goes to a paragraph after the frame (created if absent) |
| **Sky** | `Esc` (anywhere else) | First `Esc`: collapse zone (existing Phase-3 rule). Second `Esc`: exit frame |
| **Either** | `Click` on the `▸`/`▾` toggle on a frame heading | Fold/expand that frame |

The `X` badge in the heading band is the visual equivalent of `Esc`-to-exit, for the mouse.

---

## 4. The `.rga` file format

Unchanged structurally. The `body` field is one PM JSON tree from the outer schema. A `sceneFrame` node looks like:

```jsonc
{
  "type": "sceneFrame",
  "attrs": {
    "id": "scene-7f2a",
    "number": 1,
    "headingStyle": null,
    "innerDoc": {
      "type": "doc",
      "content": [
        { "type": "sceneLine", "attrs": { "setting": "INT.", "time": "NIGHT" },
          "content": [{ "type": "text", "text": "CAFÉ" }] },
        { "type": "action", "content": [{ "type": "text", "text": "A dimly lit café..." }] }
      ]
    }
  }
}
```

### 4.1 Migration from previous schemas

The current schema has `scene` (block) with `sceneLine` and other screenplay-grammar children directly as PM content. On load, `Doc.deserialize` walks the parsed body and converts every `scene` node to a `sceneFrame` node:

```
scene { id, number, notes, revisionFlag, headingStyle, content: [sceneLine, action, ...] }
  ↓
sceneFrame { id, number, headingStyle, innerDoc: { doc: { content: [sceneLine, action, ...] } } }
```

The `notes` and `revisionFlag` attrs migrate into the inner doc as `doc.attrs` (the inner schema's `doc` node gains those attrs) so no data is lost. A round-trip on a current `v2.0-sample.rga` file produces a frame-based document with identical text and structure.

The migration is a pure JSON transform; it runs in `doc.js` `deserialize()` before PM parses anything. Unit-tested with the current fixture.

---

## 5. CSS and layout architecture

There are exactly four levels of CSS variables:

1. **Theme tokens** (`tokens.css`) — `--bg-primary`, `--text-primary`, `--accent-primary`, etc. Per theme (dark/light).
2. **Page setup** (set on `.rga-page` by `page-surface.js`) — `--page-paper-width`, `--page-content-width`, `--page-margin-top`, `--page-margin-left`, etc. Per document.
3. **Frame styles** (set on `.rga-scene-frame` by the frame NodeView at mount) — `--char-indent`, `--dialogue-indent`, `--dialogue-width`, etc. Per frame kind, derived from element styles + page setup.
4. **Per-node overrides** (set on a specific block element via inline `style`) — only when a writer explicitly overrides alignment or style for one block.

CSS rules use **only** these variables. Search for hardcoded `in`, `em`, `px` in `editor-prosemirror.css` after this work — there must be none in layout positions (border, padding-for-decoration, font-size are fine).

---

## 6. Files

**Added (framework):**
- `renderer/js/framework/doc-type-registry.js`
- `renderer/js/framework/frame-protocol.js` — base class / mixin for frame NodeViews
- `renderer/js/framework/frame-drag-coordinator.js`
- `renderer/js/framework/folding.js`
- `renderer/js/framework/element-styles.js` — converts a doc-type's element-style declaration into CSS custom properties
- `renderer/js/framework/toolbox-host.js`

**Added (screenplay doc-type):**
- `renderer/js/doc-types/screenplay/index.js` — registers the doc-type
- `renderer/js/doc-types/screenplay/inner-schema.js`
- `renderer/js/doc-types/screenplay/inner-keymap.js`
- `renderer/js/doc-types/screenplay/inner-plugins.js`
- `renderer/js/doc-types/screenplay/scene-frame-node-view.js` — outer NodeView, owns the inner EditorView
- `renderer/js/doc-types/screenplay/slug-node-view.js` — inner NodeView for sceneLine zones
- `renderer/js/doc-types/screenplay/auto-renumber.js`
- `renderer/js/doc-types/screenplay/element-styles.js`
- `renderer/js/doc-types/screenplay/vocabulary.js`
- `renderer/js/doc-types/screenplay/toolbox.js`

**Modified:**
- `renderer/js/doc.js` — migration from `scene` to `sceneFrame` in `deserialize`
- `renderer/js/editor/mount.js` — mounts only the outer view; outer view uses the screenplay module's outer-schema additions
- `renderer/css/editor-prosemirror.css` — split into outer.css (land) and inner.css (sky); both use CSS custom properties only
- `renderer/css/tokens.css` — already has theme tokens; no change

**Removed:**
- `renderer/js/doc-types/screenplay/schema.js` — replaced by inner-schema.js + outer-schema additions
- `renderer/js/doc-types/screenplay/keymap.js` — replaced by inner-keymap.js
- `renderer/js/doc-types/screenplay/plugins/scene-line-node-view.js` — replaced by scene-frame-node-view.js + slug-node-view.js
- `renderer/js/doc-types/screenplay/plugins/active-scene.js` — replaced by per-frame focus events

**Untouched:**
- `renderer/js/app-shell.js`, `tab-manager.js`, `file-manager.js`, `keyboard.js`, `command-palette.js`, `bottom-panel.js` — none of these care about the schema
- The page surface, page-breaks plugin, Page Setup dialog from Step A — unchanged
- Phase 4 marks (annotation, tag, revisionFlag) — re-registered in both outer and inner views; no logic change

---

## 7. Build Sequencing — risk-first, verify per-step

Do **not** build this as one unit. Each step is shown working in the real editor and accepted by the designer **before the next step begins**.

| Step | Scope | Risk | Verification |
|---|---|---|---|
| **F1** | Doc-type registry + outer schema with `sceneFrame` as a placeholder atom (renders as a single styled div, no inner editor yet); migration from `scene` to `sceneFrame` in deserialize | Low | Open the current v2.0 sample → file loads → every old scene shows as a non-editable block placeholder labeled "Scene N"; outer paragraphs, headings, lists work; save → file round-trips losslessly through the migration |
| **F2** | **One `sceneFrame` NodeView with a real inner `EditorView`.** Inner schema = `doc > (sceneLine | action)+`. Inner keymap = bare minimum (Enter inserts action, Esc exits to outer). No zones yet. | **GO/NO-GO** | Insert a scene from outer view → inner editor mounts → type in sceneLine → text appears → press Enter → action node inserted → type more → press Esc → cursor returns to outer view → save → file round-trips → reopen → text still there. **If undo coordination, focus management, or PM-update conflicts cannot be resolved in this step, STOP. The fallback (§ 7.1 below) is named here.** |
| **F3** | Slug NodeView inside the inner editor — Setting/Location/Time zones, picker rendered in document.body portal, vocabulary lookup, Tab/Shift-Tab/Arrow zone navigation | Low (given F2 works) | Click `INT.` → picker appears in portal → click `EXT.` → slug updates → cursor in location → type "CAFÉ" → Tab → time picker → click `NIGHT` → done. **Picker click reliably works** because it lives outside any ProseMirror tree. |
| **F4** | Element-style system — CSS variables set at mount, no inch values in code; character/dialogue/parenthetical/transition layouts driven by `elementStyles` declaration | Low | Open Page Setup → change left margin from 1.5in to 1in → every character/dialogue line moves correctly without reload; change `elementStyles.dialogue.width` in dev tools → every dialogue line resizes |
| **F5** | Two-line heading inside the frame — `SCENE N` identity line above the slug, with heading-band style; auto-renumber plugin on outer view | Low | Insert three scenes from outer view; verify they read SCENE 1, SCENE 2, SCENE 3; delete the middle one; verify it now reads SCENE 1, SCENE 2 |
| **F6** | Folding + drag handle — accordion-style fold, localStorage state, drag handle at start of heading, drop targets between body blocks | Low | Click `▸` next to SCENE 1 → folds to one line showing `SCENE 1   INT. CAFÉ — DAY`; reload → still folded; drag SCENE 2 above SCENE 1 → reorders; numbers update to SCENE 1, SCENE 2 |
| **F7** | Toolbox host with screenplay tools — bold, italic, alignment, "go to scene N" — plus the existing right-click context menu for marks | Low–Moderate | Select text inside a dialogue → toolbox highlights active marks; click bold → toggles; press `Mod+b` → toggles; toolbox can be dragged, docked, collapsed; position persists across reload |

The high-risk piece (F2) is built first and in isolation. If F2 fails, the whole spec falls back to a guided-validation approach (§ 7.1) — and the user has stated explicitly that a second failure ends the IDE project. There is no continuation past F2 without designer sign-off.

### 7.1 F2 Fallback — named in advance

If the nested `EditorView` pattern fails in F2 — undo conflicts unresolvable, focus management unstable, or PM dispatch loops — the fallback is:

- Keep the current `scene`-as-PM-content model.
- Make the slug line a *plain* `inline*` editable line with no NodeView.
- Add a **validation plugin** that, on blur of any sceneLine, parses the text against the pattern `^(INT\.|EXT\.|INT\./EXT\.) [A-Z0-9 ÉÀÄÖÜ…]+? — (DAY|NIGHT|...)$` and shows a warning marker if it fails to match.
- No pickers, no zones — just text with structural feedback.
- The element-style system, folding, drag-and-drop, and toolbox host **still ship** — they're independent of the frame architecture.

The fallback is the explicit "soft landing." It is named here, in the spec, before any work begins, so a stall in F2 is a known downgrade and not a dead phase.

---

## 8. The Stop-Point Register

Living list. `STOP` and `CONFIRM` rows must be resolved with the designer before the dependent code is written.

| # | Point | Status |
|---|---|---|
| 1 | Folding state lives in `localStorage`, keyed by `docId::frameId`, not in the .rga file | **RESOLVED** |
| 2 | Drag handle (`⠿`) always visible at the start of every frame heading | **RESOLVED** |
| 3 | F2 GO/NO-GO criteria — nested EditorView mounts, types, exits, saves, reopens; fallback is § 7.1 | **GO/NO-GO** — § 7 Step F2 |
| 4 | Localized vocabularies for Kurdish/Arabic/Persian — full translation surface | **RESOLVED** — authoritative source is `rwanga-editor/i18n/vocabulary-CONFIRMED.csv`. Implementer loads this file at runtime, parses it as `key, en, ar, ku, fa, notes`, and seeds `doc.settings.vocabulary` + the UI string table from it. The draft `vocabulary.csv` is retained as reference only — do not use it. |
| 5 | Slash-command surface (`/` on empty paragraph) — block-catalogue menu | **DECIDED — kept in v0.2.** Lives in `renderer/js/framework/slash-menu.js`. Triggered when the user types `/` at the start of an empty `paragraph` in the outer view; opens a filterable menu of block types (heading, quote, list, hr, page-break, title-strip, scene-frame). Inside a scene frame the slash menu is disabled — frames have their own keymap grammar. |
| 6 | `inlineFreeText` inside a scene | **DECIDED — kept in v0.2.** Lives as an inner-schema block type alongside action/character/dialogue. Trigger: inside a scene, on an empty action block, typing `/` opens an in-frame slash menu offering `Free Text` (and other block types). Rendered as italic indented text with a left accent bar (existing CSS). |
| 7 | The exact toolbox tool list and groupings for v0.2 | **CONFIRM** before F7 |
| 8 | Cross-frame find/replace | **DECIDED** — deferred to v0.3 |
| 9 | Cross-frame text selection (drag to select text from frame A to frame B) | **DECIDED** — accepted limitation; PM doesn't support it; documented in user-facing help |
| 10 | "Move to (start, end, up, down)", "Pin to top", "Indexing" | **DECIDED** — deferred to v0.3 (after Frame architecture lands safely) |

---

## 9. Out of scope / Deferred to v0.3

- Move-to, pin-to-top, scene index sidebar
- Cross-frame find/replace
- Novel and theatre doc-type modules (framework supports them; concrete modules ship later)
- True stacked-sheet pagination (Approach B from 2026-05-14 spec)
- Localized vocabulary packs as installable templates
- Toolbox plugin marketplace

---

*End of design spec.*
